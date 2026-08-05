// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, ebool, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";
import {FHESafeMath} from "@openzeppelin/confidential-contracts/utils/FHESafeMath.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ConfidentialVault
 * @notice Holds cUSDC (ERC-7984) deposits with encrypted balances and TWAB.
 * @dev Principal is withdrawable at any time with no draw-cycle lockup.
 *      Events signal that an action occurred but never include plaintext amounts.
 */
contract ConfidentialVault is ZamaEthereumConfig, ReentrancyGuard {
    /// @notice Confidential deposit asset (cUSDC / ERC-7984).
    IERC7984 public immutable asset;

    /// @dev Encrypted share of the vault held by each depositor.
    mapping(address account => euint64 balance) private _balances;

    /// @dev Encrypted time-weighted average balance for ticket weighting.
    mapping(address account => euint64 twab) private _twabs;

    /// @dev Last TWAB checkpoint timestamp (plaintext; timing is not sensitive).
    mapping(address account => uint256 timestamp) private _lastUpdate;

    /// @dev First checkpoint timestamp for the running TWAB window.
    mapping(address account => uint256 timestamp) private _firstUpdate;

    /// @notice Emitted when `account` deposits. No amount is included.
    event Deposited(address indexed account);

    /// @notice Emitted when `account` withdraws. No amount is included.
    event Withdrawn(address indexed account);

    /// @notice Asset address cannot be the zero address.
    error InvalidAsset();

    /**
     * @param asset_ ERC-7984 confidential token used as the deposit asset (cUSDC).
     */
    constructor(address asset_) {
        if (asset_ == address(0)) revert InvalidAsset();
        asset = IERC7984(asset_);
    }

    /**
     * @notice Returns the caller's encrypted vault balance handle.
     * @dev Decryptable client-side by the balance owner via user-decrypt / EIP-712.
     */
    function getBalance() external view returns (euint64) {
        return _balances[msg.sender];
    }

    /**
     * @notice Returns `account`'s encrypted vault balance handle.
     * @param account Depositor to query.
     * @dev Only useful to the account (or anyone granted ACL); others cannot decrypt.
     */
    function getBalanceOf(address account) external view returns (euint64) {
        return _balances[account];
    }

    /**
     * @notice Returns the caller's encrypted TWAB handle.
     */
    function getTwab() external view returns (euint64) {
        return _twabs[msg.sender];
    }

    /**
     * @notice Returns `account`'s encrypted TWAB handle.
     * @param account Depositor to query.
     */
    function getTwabOf(address account) external view returns (euint64) {
        return _twabs[account];
    }

    /**
     * @notice Returns the last TWAB checkpoint timestamp for `account`.
     * @param account Depositor to query.
     */
    function lastUpdateOf(address account) external view returns (uint256) {
        return _lastUpdate[account];
    }

    /**
     * @notice Deposit an encrypted cUSDC amount into the vault.
     * @param encryptedAmount Externally encrypted deposit amount (`externalEuint64`).
     * @param inputProof ZK proof authenticating `encryptedAmount`.
     * @dev Caller must have set this vault as an ERC-7984 operator on `asset`
     *      before calling. The input is verified against this vault (encrypt for
     *      `address(this)`), then pulled via the `euint64` transferFrom overload.
     *      Balance and TWAB update homomorphically; no lockup.
     */
    function deposit(externalEuint64 encryptedAmount, bytes calldata inputProof) external nonReentrant {
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        FHE.allowTransient(amount, address(asset));

        euint64 transferred = asset.confidentialTransferFrom(msg.sender, address(this), amount);

        _checkpoint(msg.sender);
        _credit(msg.sender, transferred);

        emit Deposited(msg.sender);
    }

    /**
     * @notice Withdraw an encrypted principal amount at any time (no lockup).
     * @param encryptedAmount Externally encrypted withdrawal amount (`externalEuint64`).
     * @param inputProof ZK proof authenticating `encryptedAmount`.
     * @dev Underflow-safe: if the requested amount exceeds balance, zero is transferred
     *      (via FHE select) rather than reverting, so win/loss-style leakage cannot
     *      occur through transaction success alone. Withdrawal is never gated by draws.
     */
    function withdraw(externalEuint64 encryptedAmount, bytes calldata inputProof) external nonReentrant {
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);

        _checkpoint(msg.sender);

        euint64 balance = _balances[msg.sender];
        (ebool success, euint64 newBalance) = FHESafeMath.tryDecrease(balance, amount);
        euint64 toWithdraw = FHE.select(success, amount, FHE.asEuint64(0));

        FHE.allowThis(newBalance);
        FHE.allow(newBalance, msg.sender);
        _balances[msg.sender] = newBalance;

        // Seed TWAB to the post-withdraw balance when this is still within the first
        // second of the account's life (no prior elapsed window to average over).
        if (_firstUpdate[msg.sender] == _lastUpdate[msg.sender]) {
            _grantTwab(msg.sender, newBalance);
        }

        FHE.allowThis(toWithdraw);
        FHE.allowTransient(toWithdraw, address(asset));
        asset.confidentialTransfer(msg.sender, toWithdraw);

        emit Withdrawn(msg.sender);
    }

    /**
     * @dev Accrues TWAB for `account` using the balance held since the last checkpoint.
     *      Timestamps stay plaintext; only the balance weight is encrypted.
     */
    function _checkpoint(address account) private {
        uint256 last = _lastUpdate[account];
        uint256 ts = block.timestamp;

        if (last == 0) {
            _firstUpdate[account] = ts;
            _lastUpdate[account] = ts;
            return;
        }

        if (ts == last) {
            return;
        }

        uint64 elapsed = uint64(ts - last);
        uint64 totalDuration = uint64(ts - _firstUpdate[account]);
        uint64 priorDuration = totalDuration - elapsed;

        euint64 balance = _balances[account];
        euint64 prevTwab = _twabs[account];

        // newTwab = (prevTwab * priorDuration + balance * elapsed) / totalDuration
        // When priorDuration is 0 (first accrual after initial deposit), average = balance.
        euint64 weightedSum = FHE.add(FHE.mul(prevTwab, priorDuration), FHE.mul(balance, elapsed));
        euint64 newTwab = FHE.div(weightedSum, totalDuration);

        _grantTwab(account, newTwab);
        _lastUpdate[account] = ts;
    }

    /**
     * @dev Credits `amount` to `account` and initializes TWAB on first deposit.
     */
    function _credit(address account, euint64 amount) private {
        euint64 newBalance = FHE.add(_balances[account], amount);
        FHE.allowThis(newBalance);
        FHE.allow(newBalance, account);
        _balances[account] = newBalance;

        // Before any time has elapsed, TWAB equals the current balance.
        if (_firstUpdate[account] == _lastUpdate[account]) {
            _grantTwab(account, newBalance);
        }
    }

    /**
     * @dev Persists an encrypted TWAB handle with ACL for the vault and owner.
     */
    function _grantTwab(address account, euint64 twab) private {
        FHE.allowThis(twab);
        FHE.allow(twab, account);
        _twabs[account] = twab;
    }
}
