// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TicketEngine
 * @notice Fenwick tree (binary indexed tree) over encrypted per-user ticket weights.
 * @dev Each depositor gets a permanent 1-based index on first sync; slots are never reused.
 *      Cumulative ticket starts are not stored — DrawManager computes them on demand via
 *      `prefixSumBefore`. Weight updates touch O(log n) tree nodes with encrypted addition
 *      / subtraction only (no encrypted comparisons on the update path).
 *
 *      Vault wiring: `ConfidentialVault` calls `syncWeightFromVault` after deposit /
 *      withdraw with ACL granted on the TWAB handle. While frozen for a draw,
 *      `syncWeightFromVault` no-ops (vault withdraw must never revert); self-service
 *      `syncWeight` still reverts. Accounts may also self-sync via `syncWeight` when
 *      unfrozen (tests use this path).
 */
contract TicketEngine is ZamaEthereumConfig, ReentrancyGuard {
    /// @notice Maximum permanent depositor slots (Fenwick indices `1..MAX_DEPOSITORS`).
    /// @dev Caps update/query walks at O(log MAX) so a single sync stays under the HCU tx limit.
    uint256 public constant MAX_DEPOSITORS = type(uint16).max; // 65535

    /// @notice Vault authorized to push TWAB-derived weights as `euint64` handles.
    address public vault;

    /// @notice Draw manager authorized to freeze weights for a draw and read tree queries.
    address public drawManager;

    /// @notice Next Fenwick index to assign (1-based; 0 means "unregistered").
    uint256 public nextIndex;

    /// @notice When true, weight syncs revert so the draw sees a stable ticket space.
    bool public frozen;

    /// @notice Permanent Fenwick slot per depositor. Never reused or reassigned.
    mapping(address account => uint256 index) public indexOf;

    /// @dev Leaf ticket weight at each Fenwick index (not a tree node).
    mapping(uint256 index => euint64 weight) private _weights;

    /// @dev Fenwick tree nodes. Index 0 unused; totals tracked in `_totalTickets`.
    mapping(uint256 index => euint64 node) private _tree;

    /// @dev Encrypted sum of all leaf weights (publicly decryptable aggregate at draw time).
    euint64 private _totalTickets;

    /// @notice Emitted when an account is assigned its permanent Fenwick index.
    event IndexAssigned(address indexed account, uint256 indexed index);

    /// @notice Emitted when an account's ticket weight is synced. No amounts included.
    event WeightSynced(address indexed account, uint256 indexed index);

    /// @notice Emitted when the tree is frozen or unfrozen for a draw.
    event FreezeSet(bool frozen);

    error InvalidVault();
    error InvalidDrawManager();
    error NotVault();
    error NotDrawManager();
    error NotAuthorized();
    error WeightsFrozen();
    error InvalidIndex();
    error ZeroAddress();
    error MaxDepositorsReached();

    modifier onlyVault() {
        if (msg.sender != vault) revert NotVault();
        _;
    }

    modifier onlyDrawManager() {
        if (msg.sender != drawManager) revert NotDrawManager();
        _;
    }

    modifier whenNotFrozen() {
        if (frozen) revert WeightsFrozen();
        _;
    }

    /**
     * @param vault_ Address authorized to call `syncWeightFromVault` (ConfidentialVault).
     * @dev `vault_` may be zero at deploy if the vault is wired later via `setVault`.
     */
    constructor(address vault_) {
        vault = vault_;
        nextIndex = 1;
        _totalTickets = FHE.asEuint64(0);
        FHE.allowThis(_totalTickets);
    }

    /**
     * @notice Sets the vault authorized to push TWAB-derived weights.
     * @param vault_ ConfidentialVault address (non-zero).
     * @dev Callable once while unset, or by the current vault to rotate.
     */
    function setVault(address vault_) external {
        if (vault_ == address(0)) revert InvalidVault();
        if (vault != address(0) && msg.sender != vault) revert NotVault();
        vault = vault_;
    }

    /**
     * @notice Sets the DrawManager authorized to freeze weights and consume tree queries.
     * @param drawManager_ DrawManager address (non-zero).
     * @dev Callable once while unset, or by the current draw manager to rotate.
     */
    function setDrawManager(address drawManager_) external {
        if (drawManager_ == address(0)) revert InvalidDrawManager();
        if (drawManager != address(0) && msg.sender != drawManager) revert NotDrawManager();
        drawManager = drawManager_;
    }

    /**
     * @notice Freeze or unfreeze weight updates for the active draw window.
     * @param frozen_ True to freeze syncs; false to reopen updates.
     */
    function setFrozen(bool frozen_) external onlyDrawManager {
        frozen = frozen_;
        emit FreezeSet(frozen_);
    }

    /**
     * @notice Sync `account`'s ticket weight from an encrypted input (self-service / tests).
     * @param account Depositor whose weight is updated.
     * @param encryptedWeight New absolute ticket weight (`externalEuint64`).
     * @param inputProof ZK proof authenticating `encryptedWeight`.
     * @dev Caller must be `account` or `vault`. Assigns a permanent index on first sync.
     *      Encrypt for `address(this)`.
     */
    function syncWeight(
        address account,
        externalEuint64 encryptedWeight,
        bytes calldata inputProof
    ) external nonReentrant whenNotFrozen {
        if (account == address(0)) revert ZeroAddress();
        if (msg.sender != account && msg.sender != vault) revert NotAuthorized();

        euint64 newWeight = FHE.fromExternal(encryptedWeight, inputProof);
        _syncWeight(account, newWeight);
    }

    /**
     * @notice Sync `account`'s ticket weight from a vault-held encrypted TWAB handle.
     * @param account Depositor whose weight is updated.
     * @param newWeight Absolute ticket weight (typically the account's current TWAB).
     * @dev Only `vault`. Vault must `FHE.allowTransient(newWeight, ticketEngine)` before calling.
     *      When `frozen`, this is a no-op (does not revert) so `ConfidentialVault.withdraw`
     *      never fails during an active draw — principal has no lockup. Self-service
     *      `syncWeight` still reverts while frozen. Weight catches up on the next vault
     *      sync after the freeze lifts.
     */
    function syncWeightFromVault(address account, euint64 newWeight) external nonReentrant onlyVault {
        if (account == address(0)) revert ZeroAddress();
        if (frozen) {
            return;
        }
        _syncWeight(account, newWeight);
    }

    /**
     * @notice View accessor for the encrypted leaf weight at Fenwick `index`.
     * @param index Permanent 1-based depositor index.
     */
    function getWeight(uint256 index) external view returns (euint64) {
        if (index == 0 || index >= nextIndex) revert InvalidIndex();
        return _weights[index];
    }

    /**
     * @notice Returns the encrypted leaf weight at Fenwick `index` with transient ACL for the caller.
     * @param index Permanent 1-based depositor index.
     * @dev Used by DrawManager during `checkIfWon`.
     */
    function weightOf(uint256 index) external returns (euint64 weight) {
        if (index == 0 || index >= nextIndex) revert InvalidIndex();
        weight = _weights[index];
        if (!FHE.isInitialized(weight)) {
            weight = FHE.asEuint64(0);
        }
        FHE.allowThis(weight);
        FHE.allowTransient(weight, msg.sender);
    }

    /**
     * @notice Encrypted prefix sum of leaf weights in `[1, index]` (inclusive).
     * @param index Fenwick index to sum through (1-based).
     * @dev O(log n) encrypted additions. Grants transient ACL to the caller.
     */
    function prefixSum(uint256 index) external returns (euint64 sum) {
        if (index == 0 || index >= nextIndex) revert InvalidIndex();
        sum = _prefixSum(index);
        FHE.allowThis(sum);
        FHE.allowTransient(sum, msg.sender);
    }

    /**
     * @notice Encrypted cumulative start for the depositor at `index`: sum of `[1, index)`.
     * @param index Permanent 1-based depositor index.
     * @dev Used by `DrawManager.checkIfWon` so starts are never stored. Index 1 → zero.
     *      Grants transient ACL to the caller.
     */
    function prefixSumBefore(uint256 index) external returns (euint64 sum) {
        if (index == 0 || index >= nextIndex) revert InvalidIndex();
        if (index == 1) {
            sum = FHE.asEuint64(0);
        } else {
            sum = _prefixSum(index - 1);
        }
        FHE.allowThis(sum);
        FHE.allowTransient(sum, msg.sender);
    }

    /**
     * @notice Encrypted total ticket count (tree root / running leaf sum).
     * @dev Aggregate only — safe to publicly decrypt at draw time (same class as TVL).
     */
    function totalTickets() external view returns (euint64) {
        return _totalTickets;
    }

    /**
     * @notice Marks the total ticket count as publicly decryptable for the draw reveal path.
     * @dev Only DrawManager. Does not decrypt on-chain; client self-relays and submits proof.
     */
    function makeTotalPubliclyDecryptable() external onlyDrawManager {
        _totalTickets = FHE.makePubliclyDecryptable(_totalTickets);
    }

    /**
     * @dev Assigns index if needed, replaces leaf weight, and applies Fenwick delta.
     */
    function _syncWeight(address account, euint64 newWeight) private {
        uint256 index = indexOf[account];
        if (index == 0) {
            if (nextIndex > MAX_DEPOSITORS) revert MaxDepositorsReached();
            index = nextIndex;
            unchecked {
                nextIndex = index + 1;
            }
            indexOf[account] = index;
            emit IndexAssigned(account, index);
        }

        euint64 oldWeight = _weights[index];
        bool hadOld = FHE.isInitialized(oldWeight);

        // Apply +newWeight then -oldWeight (skip remove on first sync). Encrypted add/sub only.
        _fenwickAdd(index, newWeight);
        if (hadOld) {
            _fenwickSub(index, oldWeight);
            euint64 total = FHE.add(FHE.sub(_totalTickets, oldWeight), newWeight);
            FHE.allowThis(total);
            _totalTickets = total;
        } else {
            euint64 total = FHE.add(_totalTickets, newWeight);
            FHE.allowThis(total);
            _totalTickets = total;
        }

        FHE.allowThis(newWeight);
        FHE.allow(newWeight, account);
        _weights[index] = newWeight;

        emit WeightSynced(account, index);
    }

    /**
     * @dev Inclusive prefix sum over `[1, index]` via classic Fenwick interrogation.
     */
    function _prefixSum(uint256 index) private returns (euint64 sum) {
        sum = FHE.asEuint64(0);
        uint256 i = index;
        while (i > 0) {
            sum = FHE.add(sum, _tree[i]);
            unchecked {
                i -= i & (~i + 1); // i -= lsb(i)
            }
        }
        FHE.allowThis(sum);
    }

    /**
     * @dev Adds `delta` into Fenwick nodes covering `index` (O(log MAX_DEPOSITORS)).
     */
    function _fenwickAdd(uint256 index, euint64 delta) private {
        uint256 i = index;
        while (i <= MAX_DEPOSITORS) {
            euint64 updated = FHE.add(_tree[i], delta);
            FHE.allowThis(updated);
            _tree[i] = updated;
            unchecked {
                i += i & (~i + 1); // i += lsb(i)
            }
        }
    }

    /**
     * @dev Subtracts `delta` from Fenwick nodes covering `index` (O(log MAX_DEPOSITORS)).
     */
    function _fenwickSub(uint256 index, euint64 delta) private {
        uint256 i = index;
        while (i <= MAX_DEPOSITORS) {
            euint64 updated = FHE.sub(_tree[i], delta);
            FHE.allowThis(updated);
            _tree[i] = updated;
            unchecked {
                i += i & (~i + 1);
            }
        }
    }
}
