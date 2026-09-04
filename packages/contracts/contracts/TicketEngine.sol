// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TicketEngine
 * @notice Versioned Fenwick tree for encrypted draw-period balance integrals.
 * @dev A user's integral is represented as `intercept + balance * timestamp`.
 *      Each balance change checkpoints affected tree nodes under one version.
 *      Draws compare two immutable versions, so withdrawals never require a
 *      freeze and never change an already closed draw.
 */
contract TicketEngine is ZamaEthereumConfig, Ownable, ReentrancyGuard {
    uint256 public constant MAX_DEPOSITORS = 1 << 16;

    struct Checkpoint {
        uint64 version;
        euint64 slope;
        euint64 intercept;
    }

    address public vault;
    address public drawManager;
    uint256 public nextIndex = 1;
    uint64 public currentVersion;
    uint64 public immutable genesisTimestamp;

    mapping(address account => uint256 index) public indexOf;
    mapping(uint256 index => euint64 balance) private _balances;
    mapping(uint256 index => euint64 intercept) private _intercepts;
    mapping(uint256 index => euint64 slope) private _treeSlope;
    mapping(uint256 index => euint64 intercept) private _treeIntercept;
    mapping(uint256 index => Checkpoint[]) private _nodeHistory;
    mapping(uint256 index => Checkpoint[]) private _leafHistory;

    euint64 private _preparedTotal;

    event IndexAssigned(address indexed account, uint256 indexed index);
    event WeightSynced(address indexed account, uint256 indexed index);
    event VaultConfigured(address indexed vault);
    event DrawManagerConfigured(address indexed drawManager);

    error InvalidVault();
    error InvalidDrawManager();
    error NotVault();
    error NotDrawManager();
    error InvalidIndex();
    error ZeroAddress();
    error MaxDepositorsReached();
    error AlreadyConfigured();
    error InvalidSnapshot();

    modifier onlyVault() {
        if (msg.sender != vault) revert NotVault();
        _;
    }

    modifier onlyDrawManager() {
        if (msg.sender != drawManager) revert NotDrawManager();
        _;
    }

    /**
     * @param vault_ Initial vault. May be zero when contracts are deployed in stages.
     */
    constructor(address vault_) Ownable(msg.sender) {
        vault = vault_;
        genesisTimestamp = uint64(block.timestamp);
    }

    /**
     * @notice Configures the vault once.
     * @param vault_ ConfidentialVault address.
     */
    function setVault(address vault_) external onlyOwner {
        if (vault_ == address(0)) revert InvalidVault();
        if (vault != address(0)) revert AlreadyConfigured();
        vault = vault_;
        emit VaultConfigured(vault_);
    }

    /**
     * @notice Configures the draw manager once.
     * @param drawManager_ DrawManager address.
     */
    function setDrawManager(address drawManager_) external onlyOwner {
        if (drawManager_ == address(0)) revert InvalidDrawManager();
        if (drawManager != address(0)) revert AlreadyConfigured();
        drawManager = drawManager_;
        emit DrawManagerConfigured(drawManager_);
    }

    /**
     * @notice Checkpoints an account's new encrypted balance.
     * @param account Depositor whose balance changed.
     * @param newBalance New absolute vault balance.
     */
    function syncBalanceFromVault(address account, euint64 newBalance) external nonReentrant onlyVault {
        if (account == address(0)) revert ZeroAddress();

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

        uint64 version;
        unchecked {
            version = ++currentVersion;
        }

        euint64 oldBalance = _initialized(_balances[index]);
        euint64 oldIntercept = _initialized(_intercepts[index]);
        euint64 cumulativeNow = FHE.add(oldIntercept, FHE.mul(oldBalance, uint64(block.timestamp)));
        euint64 newIntercept = FHE.sub(cumulativeNow, FHE.mul(newBalance, uint64(block.timestamp)));
        euint64 slopeDelta = FHE.sub(newBalance, oldBalance);
        euint64 interceptDelta = FHE.sub(newIntercept, oldIntercept);

        FHE.allowThis(newBalance);
        FHE.allow(newBalance, account);
        FHE.allowThis(newIntercept);
        _balances[index] = newBalance;
        _intercepts[index] = newIntercept;
        _leafHistory[index].push(Checkpoint(version, newBalance, newIntercept));

        uint256 i = index;
        while (i <= MAX_DEPOSITORS) {
            euint64 slope = FHE.add(_initialized(_treeSlope[i]), slopeDelta);
            euint64 intercept = FHE.add(_initialized(_treeIntercept[i]), interceptDelta);
            FHE.allowThis(slope);
            FHE.allowThis(intercept);
            _treeSlope[i] = slope;
            _treeIntercept[i] = intercept;
            _nodeHistory[i].push(Checkpoint(version, slope, intercept));
            unchecked {
                i += i & (~i + 1);
            }
        }

        emit WeightSynced(account, index);
    }

    /**
     * @notice Returns the current encrypted vault balance at an index.
     * @param index Permanent depositor index.
     */
    function getWeight(uint256 index) external view returns (euint64) {
        if (index == 0 || index >= nextIndex) revert InvalidIndex();
        return _balances[index];
    }

    /**
     * @notice Returns the current immutable snapshot cursor.
     */
    function snapshot() external view onlyDrawManager returns (uint64 version, uint64 timestamp) {
        return (currentVersion, uint64(block.timestamp));
    }

    /**
     * @notice Makes a draw-period aggregate score available for public decryption.
     * @param startVersion Version at period start.
     * @param startTime Timestamp at period start.
     * @param endVersion Version at period end.
     * @param endTime Timestamp at period end.
     * @return handle Publicly decryptable encrypted total score.
     */
    function prepareTotalScore(
        uint64 startVersion,
        uint64 startTime,
        uint64 endVersion,
        uint64 endTime
    ) external onlyDrawManager returns (euint64 handle) {
        _validateSnapshot(startVersion, startTime, endVersion, endTime);
        euint64 endCumulative = _prefixCumulativeAt(MAX_DEPOSITORS, endVersion, endTime);
        euint64 startCumulative = _prefixCumulativeAt(MAX_DEPOSITORS, startVersion, startTime);
        handle = FHE.sub(endCumulative, startCumulative);
        FHE.allowThis(handle);
        _preparedTotal = FHE.makePubliclyDecryptable(handle);
        return _preparedTotal;
    }

    /**
     * @notice Verifies the most recently prepared aggregate score.
     * @param cleartext Claimed aggregate draw-period score.
     * @param proof KMS public-decryption proof.
     */
    function verifyPreparedTotal(uint64 cleartext, bytes calldata proof) external onlyDrawManager {
        bytes32[] memory handles = new bytes32[](1);
        handles[0] = euint64.unwrap(_preparedTotal);
        FHE.checkSignatures(handles, abi.encode(cleartext), proof);
    }

    /**
     * @notice Returns the aggregate handle prepared by the latest draw close.
     */
    function preparedTotal() external view returns (euint64) {
        return _preparedTotal;
    }

    /**
     * @notice Computes a caller-independent encrypted ticket range for one draw.
     * @param index Permanent depositor index.
     * @param startVersion Version at period start.
     * @param startTime Timestamp at period start.
     * @param endVersion Version at period end.
     * @param endTime Timestamp at period end.
     * @return start Encrypted cumulative score before this depositor.
     * @return weight Encrypted score held by this depositor during the period.
     */
    function rangeForDraw(
        uint256 index,
        uint64 startVersion,
        uint64 startTime,
        uint64 endVersion,
        uint64 endTime
    ) external onlyDrawManager returns (euint64 start, euint64 weight) {
        if (index == 0 || index >= nextIndex) revert InvalidIndex();
        _validateSnapshot(startVersion, startTime, endVersion, endTime);

        if (index == 1) {
            start = FHE.asEuint64(0);
        } else {
            euint64 prefixEnd = _prefixCumulativeAt(index - 1, endVersion, endTime);
            euint64 prefixStart = _prefixCumulativeAt(index - 1, startVersion, startTime);
            start = FHE.sub(prefixEnd, prefixStart);
        }

        Checkpoint memory endLeaf = _checkpointAt(_leafHistory[index], endVersion);
        Checkpoint memory startLeaf = _checkpointAt(_leafHistory[index], startVersion);
        euint64 endValue = _evaluate(endLeaf, endTime);
        euint64 startValue = _evaluate(startLeaf, startTime);
        weight = FHE.sub(endValue, startValue);

        FHE.allowThis(start);
        FHE.allowThis(weight);
        FHE.allowTransient(start, msg.sender);
        FHE.allowTransient(weight, msg.sender);
    }

    function _prefixCumulativeAt(
        uint256 index,
        uint64 version,
        uint64 timestamp
    ) private returns (euint64 sum) {
        sum = FHE.asEuint64(0);
        uint256 i = index;
        while (i > 0) {
            Checkpoint memory point = _checkpointAt(_nodeHistory[i], version);
            sum = FHE.add(sum, _evaluate(point, timestamp));
            unchecked {
                i -= i & (~i + 1);
            }
        }
        FHE.allowThis(sum);
    }

    function _checkpointAt(
        Checkpoint[] storage history,
        uint64 version
    ) private view returns (Checkpoint memory point) {
        uint256 length = history.length;
        if (length == 0 || history[0].version > version) {
            return Checkpoint(0, euint64.wrap(bytes32(0)), euint64.wrap(bytes32(0)));
        }

        uint256 low;
        uint256 high = length;
        while (low < high) {
            uint256 mid = (low + high) >> 1;
            if (history[mid].version <= version) {
                low = mid + 1;
            } else {
                high = mid;
            }
        }
        return history[low - 1];
    }

    function _evaluate(Checkpoint memory point, uint64 timestamp) private returns (euint64) {
        euint64 slope = _initialized(point.slope);
        euint64 intercept = _initialized(point.intercept);
        return FHE.add(intercept, FHE.mul(slope, timestamp));
    }

    function _initialized(euint64 value) private returns (euint64) {
        return FHE.isInitialized(value) ? value : FHE.asEuint64(0);
    }

    function _validateSnapshot(
        uint64 startVersion,
        uint64 startTime,
        uint64 endVersion,
        uint64 endTime
    ) private view {
        if (
            startVersion > endVersion ||
            endVersion > currentVersion ||
            startTime < genesisTimestamp ||
            startTime >= endTime
        ) {
            revert InvalidSnapshot();
        }
    }
}
