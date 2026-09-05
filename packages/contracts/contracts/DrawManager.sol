// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, ebool, euint64, euint128} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {ConfidentialVault} from "./ConfidentialVault.sol";
import {PrizePool} from "./PrizePool.sol";
import {TicketEngine} from "./TicketEngine.sol";

/**
 * @title DrawManager
 * @notice Multi-tier pull-based draws using Zama-native encrypted randomness.
 * @dev One encrypted random value is stored per bounded prize slot. Each account
 *      checks only its immutable historical range; no function loops over depositors.
 */
contract DrawManager is ZamaEthereumConfig, ReentrancyGuard {
    uint64 public constant MIN_DRAW_INTERVAL = 20 minutes;
    uint64 public constant CLAIM_WINDOW = 20 minutes;
    uint128 private constant RANDOM_DOMAIN = uint128(1) << 64;

    struct Draw {
        uint64 startVersion;
        uint64 startTime;
        uint64 endVersion;
        uint64 endTime;
        uint64 totalScore;
        uint64 claimDeadline;
        bool closed;
        bool awarded;
        bool reconciliationPrepared;
        bool reconciled;
    }

    TicketEngine public immutable ticketEngine;
    ConfidentialVault public immutable vault;
    PrizePool public immutable prizePool;

    uint256 public drawId;
    uint64 public periodStartVersion;
    uint64 public periodStartTime;

    mapping(uint256 id => Draw draw) public draws;
    mapping(uint256 id => mapping(uint8 tier => mapping(uint8 slot => euint64 random))) private _slotRandom;
    mapping(uint256 id => mapping(uint8 tier => mapping(uint8 slot => mapping(address account => bool)))) public
        hasChecked;
    mapping(uint256 id => mapping(uint8 tier => mapping(uint8 slot => mapping(address account => bool)))) public
        hasClaimed;
    mapping(uint256 id => mapping(uint8 tier => mapping(uint8 slot => mapping(address account => ebool)))) private
        _won;
    mapping(uint256 id => mapping(uint8 tier => mapping(uint8 slot => mapping(address account => euint64)))) private
        _pendingPrize;
    mapping(uint256 id => mapping(address account => euint64)) private _rangeStart;
    mapping(uint256 id => mapping(address account => euint64)) private _drawWeight;
    mapping(uint256 id => mapping(address account => bool)) public rangePrepared;
    mapping(uint256 id => mapping(uint8 tier => mapping(uint8 slot => mapping(address account => bool)))) public
        winRevealed;
    mapping(uint256 id => mapping(uint8 tier => mapping(uint8 slot => mapping(address account => bool)))) public
        winRevealPrepared;

    event DrawClosed(uint256 indexed drawId);
    event DrawAwarded(uint256 indexed drawId);
    event EmptyDrawCancelled(uint256 indexed drawId);
    event PrizeChecked(uint256 indexed drawId, address indexed account, uint8 tier, uint8 slot);
    event PrizeClaimed(uint256 indexed drawId, address indexed account, uint8 tier, uint8 slot);
    event WinRevealPrepared(uint256 indexed drawId, address indexed account, uint8 tier, uint8 slot);
    event WinRevealed(uint256 indexed drawId, address indexed account, uint8 tier, uint8 slot);
    event DrawReconciliationStarted(uint256 indexed drawId);
    event DrawReconciled(uint256 indexed drawId);

    error InvalidTicketEngine();
    error InvalidVault();
    error InvalidPrizePool();
    error AssetMismatch();
    error VaultMismatch();
    error DrawIntervalNotElapsed();
    error DrawNotClosed();
    error DrawAlreadyAwarded();
    error DrawNotAwarded();
    error DrawExpired();
    error DrawNotExpired();
    error DrawNotReconciled();
    error ZeroTotalScore();
    error InvalidDraw();
    error InvalidTier();
    error InvalidSlot();
    error NotRegistered();
    error AlreadyChecked();
    error NotChecked();
    error AlreadyClaimed();
    error AlreadyRevealed();
    error RevealNotPrepared();
    error NotAWinner();
    error ReconciliationNotPrepared();

    /**
     * @param ticketEngine_ Versioned encrypted ticket engine.
     * @param vault_ Confidential principal vault.
     * @param prizePool_ Isolated prize-liquidity pool.
     */
    constructor(address ticketEngine_, address vault_, address prizePool_) {
        if (ticketEngine_ == address(0)) revert InvalidTicketEngine();
        if (vault_ == address(0)) revert InvalidVault();
        if (prizePool_ == address(0)) revert InvalidPrizePool();
        ticketEngine = TicketEngine(ticketEngine_);
        vault = ConfidentialVault(vault_);
        prizePool = PrizePool(prizePool_);
        if (ticketEngine.vault() != vault_) revert VaultMismatch();
        if (address(prizePool.asset()) != address(vault.asset())) revert AssetMismatch();
        periodStartVersion = ticketEngine.currentVersion();
        periodStartTime = uint64(block.timestamp);
    }

    /**
     * @notice Closes the current accrual period and prepares its aggregate score.
     * @return id Newly closed draw id.
     * @return totalScoreHandle Publicly decryptable encrypted period score.
     */
    function closeDraw() external nonReentrant returns (uint256 id, euint64 totalScoreHandle) {
        if (drawId != 0 && !draws[drawId].reconciled) revert DrawNotReconciled();
        uint64 nowTime = uint64(block.timestamp);
        uint64 elapsed = nowTime - periodStartTime;
        if (elapsed < MIN_DRAW_INTERVAL) revert DrawIntervalNotElapsed();

        (uint64 endVersion, uint64 endTime) = ticketEngine.snapshot();
        unchecked {
            id = ++drawId;
        }
        draws[id] = Draw({
            startVersion: periodStartVersion,
            startTime: periodStartTime,
            endVersion: endVersion,
            endTime: endTime,
            totalScore: 0,
            claimDeadline: 0,
            closed: true,
            awarded: false,
            reconciliationPrepared: false,
            reconciled: false
        });

        totalScoreHandle = ticketEngine.prepareTotalScore(
            periodStartVersion,
            periodStartTime,
            endVersion,
            endTime
        );
        emit DrawClosed(id);
    }

    /**
     * @notice Verifies the aggregate score, allocates liquidity, and generates FHE random slots.
     * @param id Closed draw id.
     * @param totalScore Public aggregate balance-time score.
     * @param proof KMS public-decryption proof for the prepared score.
     */
    function awardDraw(uint256 id, uint64 totalScore, bytes calldata proof) external nonReentrant {
        Draw storage draw = draws[id];
        if (id == 0 || id != drawId || !draw.closed) revert DrawNotClosed();
        if (draw.awarded) revert DrawAlreadyAwarded();
        if (totalScore == 0) revert ZeroTotalScore();

        ticketEngine.verifyPreparedTotal(totalScore, proof);
        uint64 deadline = uint64(block.timestamp) + CLAIM_WINDOW;
        prizePool.allocateDraw(id, deadline);

        for (uint8 tier = 0; tier < prizePool.TIER_COUNT(); ++tier) {
            uint8 slots = prizePool.slotCount(tier);
            for (uint8 slot = 0; slot < slots; ++slot) {
                euint64 random = FHE.randEuint64();
                FHE.allowThis(random);
                _slotRandom[id][tier][slot] = random;
            }
        }

        draw.totalScore = totalScore;
        draw.claimDeadline = deadline;
        draw.awarded = true;
        periodStartVersion = draw.endVersion;
        periodStartTime = draw.endTime;
        emit DrawAwarded(id);
    }

    /**
     * @notice Cancels a closed draw whose verified aggregate score is zero.
     * @param id Closed draw id.
     * @param proof KMS public-decryption proof for a zero score.
     */
    function cancelEmptyDraw(uint256 id, bytes calldata proof) external {
        Draw storage draw = draws[id];
        if (id == 0 || id != drawId || !draw.closed) revert DrawNotClosed();
        if (draw.awarded) revert DrawAlreadyAwarded();
        ticketEngine.verifyPreparedTotal(0, proof);
        draw.reconciled = true;
        emit EmptyDrawCancelled(id);
    }

    /**
     * @notice Checks the caller against one tier prize slot.
     * @param id Awarded draw id.
     * @param tier Tier index.
     * @param slot Prize slot index.
     */
    function checkPrize(uint256 id, uint8 tier, uint8 slot) external nonReentrant {
        Draw storage draw = draws[id];
        _validateOpenSlot(draw, id, tier, slot);
        if (hasChecked[id][tier][slot][msg.sender]) revert AlreadyChecked();

        uint256 index = ticketEngine.indexOf(msg.sender);
        if (index == 0) revert NotRegistered();
        hasChecked[id][tier][slot][msg.sender] = true;

        (euint64 start, euint64 weight) = _loadRange(draw, id, index);
        ebool won = _computeWin(draw.totalScore, id, tier, slot, start, weight);
        FHE.allowThis(won);
        _won[id][tier][slot][msg.sender] = won;

        uint64 amount = prizePool.prizePerSlot(id, tier);
        euint64 pending = FHE.select(won, FHE.asEuint64(amount), FHE.asEuint64(0));
        FHE.allowThis(pending);
        FHE.allow(pending, msg.sender);
        _pendingPrize[id][tier][slot][msg.sender] = pending;

        emit PrizeChecked(id, msg.sender, tier, slot);
    }

    /**
     * @notice Transfers a checked prize or encrypted zero to the caller.
     * @param id Awarded draw id.
     * @param tier Tier index.
     * @param slot Prize slot index.
     */
    function claim(uint256 id, uint8 tier, uint8 slot) external nonReentrant {
        Draw storage draw = draws[id];
        _validateOpenSlot(draw, id, tier, slot);
        if (!hasChecked[id][tier][slot][msg.sender]) revert NotChecked();
        if (hasClaimed[id][tier][slot][msg.sender]) revert AlreadyClaimed();
        hasClaimed[id][tier][slot][msg.sender] = true;

        ebool won = _won[id][tier][slot][msg.sender];
        FHE.allowTransient(won, address(prizePool));
        prizePool.payout(id, msg.sender, tier, slot, won);
        emit PrizeClaimed(id, msg.sender, tier, slot);
    }

    /**
     * @notice Returns a caller's encrypted pending prize for one slot.
     */
    function getPendingPrize(uint256 id, uint8 tier, uint8 slot) external view returns (euint64) {
        return _pendingPrize[id][tier][slot][msg.sender];
    }

    /**
     * @notice Returns an account's encrypted pending prize handle.
     */
    function getPendingPrizeOf(
        uint256 id,
        uint8 tier,
        uint8 slot,
        address account
    ) external view returns (euint64) {
        return _pendingPrize[id][tier][slot][account];
    }

    /**
     * @notice Returns the caller's encrypted score for a prepared draw range.
     */
    function getDrawWeight(uint256 id) external view returns (euint64) {
        return _drawWeight[id][msg.sender];
    }

    /**
     * @notice Opts a checked result into public decryption for selective disclosure.
     */
    function prepareWinReveal(uint256 id, uint8 tier, uint8 slot) external nonReentrant {
        if (!hasChecked[id][tier][slot][msg.sender]) revert NotChecked();
        if (winRevealPrepared[id][tier][slot][msg.sender]) revert AlreadyRevealed();
        ebool publicWon = FHE.makePubliclyDecryptable(_won[id][tier][slot][msg.sender]);
        _won[id][tier][slot][msg.sender] = publicWon;
        winRevealPrepared[id][tier][slot][msg.sender] = true;
        emit WinRevealPrepared(id, msg.sender, tier, slot);
    }

    /**
     * @notice Publishes a prepared, verified tier-slot win without an amount.
     */
    function revealWin(
        uint256 id,
        uint8 tier,
        uint8 slot,
        bool wonCleartext,
        bytes calldata proof
    ) external nonReentrant {
        if (!hasChecked[id][tier][slot][msg.sender]) revert NotChecked();
        if (winRevealed[id][tier][slot][msg.sender]) revert AlreadyRevealed();
        if (!winRevealPrepared[id][tier][slot][msg.sender]) revert RevealNotPrepared();
        if (!wonCleartext) revert NotAWinner();
        ebool won = _won[id][tier][slot][msg.sender];
        bytes32[] memory handles = new bytes32[](1);
        handles[0] = ebool.unwrap(won);
        FHE.checkSignatures(handles, abi.encode(wonCleartext), proof);
        winRevealed[id][tier][slot][msg.sender] = true;
        emit WinRevealed(id, msg.sender, tier, slot);
    }

    /**
     * @notice Returns a prepared encrypted win flag.
     */
    function getWonFlag(uint256 id, uint8 tier, uint8 slot, address account) external view returns (ebool) {
        return _won[id][tier][slot][account];
    }

    /**
     * @notice Prepares the expired prize pool balance for aggregate reconciliation.
     */
    function prepareReconciliation(uint256 id) external nonReentrant returns (euint64 handle) {
        Draw storage draw = draws[id];
        if (!draw.awarded || block.timestamp <= draw.claimDeadline) revert DrawNotExpired();
        if (draw.reconciled) revert DrawNotReconciled();
        handle = prizePool.prepareReconciliation();
        draw.reconciliationPrepared = true;
        emit DrawReconciliationStarted(id);
    }

    /**
     * @notice Finalizes expiry rollover using the actual prize-pool token balance.
     */
    function finalizeReconciliation(
        uint256 id,
        uint64 clearBalance,
        bytes calldata proof
    ) external nonReentrant {
        Draw storage draw = draws[id];
        if (!draw.reconciliationPrepared) revert ReconciliationNotPrepared();
        prizePool.finalizeReconciliation(clearBalance, proof);
        draw.reconciled = true;
        emit DrawReconciled(id);
    }

    function _validateOpenSlot(Draw storage draw, uint256 id, uint8 tier, uint8 slot) private view {
        if (id == 0 || !draw.awarded) revert DrawNotAwarded();
        if (block.timestamp > draw.claimDeadline) revert DrawExpired();
        if (tier >= prizePool.TIER_COUNT()) revert InvalidTier();
        if (slot >= prizePool.slotCount(tier)) revert InvalidSlot();
    }

    function _loadRange(
        Draw storage draw,
        uint256 id,
        uint256 index
    ) private returns (euint64 start, euint64 weight) {
        if (rangePrepared[id][msg.sender]) {
            return (_rangeStart[id][msg.sender], _drawWeight[id][msg.sender]);
        }
        (start, weight) = ticketEngine.rangeForDraw(
            index,
            draw.startVersion,
            draw.startTime,
            draw.endVersion,
            draw.endTime
        );
        FHE.allowThis(start);
        FHE.allowThis(weight);
        FHE.allow(start, msg.sender);
        FHE.allow(weight, msg.sender);
        _rangeStart[id][msg.sender] = start;
        _drawWeight[id][msg.sender] = weight;
        rangePrepared[id][msg.sender] = true;
        return (start, weight);
    }

    /// @dev Maps rand in [0, 2^64) onto [0, totalScore) by multiply-high.
    /// Relative bias is at most (totalScore - 1) / 2^64. See docs/privacy.md.
    function _computeWin(
        uint64 totalScore,
        uint256 id,
        uint8 tier,
        uint8 slot,
        euint64 start,
        euint64 weight
    ) private returns (ebool) {
        euint64 end = FHE.add(start, weight);
        euint128 point = FHE.mul(FHE.asEuint128(_slotRandom[id][tier][slot]), uint128(totalScore));
        euint128 lower = FHE.mul(FHE.asEuint128(start), RANDOM_DOMAIN);
        euint128 upper = FHE.mul(FHE.asEuint128(end), RANDOM_DOMAIN);
        return FHE.and(FHE.ge(point, lower), FHE.lt(point, upper));
    }
}
