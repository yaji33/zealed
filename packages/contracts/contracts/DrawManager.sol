// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, ebool, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {TicketEngine} from "./TicketEngine.sol";

/**
 * @title DrawManager
 * @notice Pull-based confidential prize draws over TicketEngine's Fenwick ticket tree.
 * @dev Winner selection never loops over depositors. Each user calls `checkIfWon` for
 *      themselves: one O(log n) encrypted prefix-sum + one encrypted range comparison
 *      against the public random value `r`. Losing resolves to an encrypted zero via
 *      `FHE.select` (never a revert), so win/loss is not leaked through tx success.
 *
 *      Randomness: commit to a future block, reveal with that block's hash bounded by
 *      the publicly decrypted total ticket count. The committer cannot know `r` at
 *      commit time; reveal rejects past/too-late blocks so the hash cannot be withheld
 *      or substituted.
 */
contract DrawManager is ZamaEthereumConfig, ReentrancyGuard {
    /// @notice Minimum blocks between commit and the randomness source block (~1 min on Sepolia).
    /// @dev Demo-scaled; production would use a larger gap. Separate from MIN_DRAW_INTERVAL.
    uint256 public constant MIN_REVEAL_DELAY = 5;

    /// @notice Minimum wall-clock gap between successive commits (20 minutes, Sepolia demo scale).
    /// @dev Production would use a longer cadence (e.g. daily). Enforced from the prior commit timestamp.
    uint256 public constant MIN_DRAW_INTERVAL = 20 minutes;

    /// @notice blockhash is only available for the most recent 256 blocks.
    uint256 public constant MAX_REVEAL_WINDOW = 256;

    /// @notice Ticket tree used for on-demand range computation.
    TicketEngine public immutable ticketEngine;

    /// @notice Current draw id (incremented on each commit).
    uint256 public drawId;

    /// @notice Public plaintext random draw value `r` for the current revealed draw.
    uint64 public drawRandomValue;

    /// @notice Whether the current draw has been revealed (r finalized).
    bool public revealed;

    /// @notice Future block whose hash seeds `r`.
    uint256 public revealBlock;

    /// @notice Timestamp of the most recent `commitDraw` (0 before the first commit).
    uint256 public lastCommitTimestamp;

    /// @notice Plaintext total tickets used to bound `r` (set at reveal after public decrypt).
    uint64 public totalTicketsPlain;

    /// @notice Public prize size for the current draw (aggregate disclosure).
    uint64 public prizeAmountPlain;

    /// @notice Single prize tier for the current protocol (ship-if-time selective disclosure).
    uint8 public constant TIER_MAIN = 1;

    /// @dev Per-draw, per-user guard — one checkIfWon attempt each.
    mapping(uint256 draw => mapping(address account => bool checked)) public hasChecked;

    /// @notice Whether `account` has optionally published a win for `draw` (off by default).
    mapping(uint256 draw => mapping(address account => bool revealed)) public winRevealed;

    /// @dev Encrypted pending prize per user (ACL-gated to that user).
    mapping(address account => euint64 prize) private _pendingPrize;

    /// @dev Encrypted win flag from checkIfWon; publicly decryptable for optional revealWin.
    mapping(uint256 draw => mapping(address account => ebool won)) private _won;

    /// @notice Emitted when a draw is committed to a future randomness block.
    event DrawCommitted(uint256 indexed drawId, uint256 revealBlock, uint64 prizeAmount);

    /// @notice Emitted when `r` is finalized. No per-user data.
    event DrawRevealed(uint256 indexed drawId, uint64 randomValue, uint64 totalTickets);

    /// @notice Emitted when a user checks the current draw. No win/loss or amount.
    event DrawChecked(uint256 indexed drawId, address indexed account);

    /// @notice Optional selective disclosure: address won a tier. No prize amount.
    event WinRevealed(uint256 indexed drawId, address indexed account, uint8 tier);

    error InvalidTicketEngine();
    error DrawNotCommitted();
    error DrawPendingReveal();
    error DrawAlreadyRevealed();
    error DrawNotRevealed();
    error InvalidRevealBlock();
    error DrawIntervalNotElapsed();
    error RevealTooEarly();
    error RevealTooLate();
    error ZeroTotalTickets();
    error ZeroPrize();
    error AlreadyChecked();
    error WrongDrawId();
    error NotRegistered();
    error NotChecked();
    error AlreadyWinRevealed();
    error NotAWinner();

    /**
     * @param ticketEngine_ Deployed TicketEngine (Fenwick ticket weights).
     */
    constructor(address ticketEngine_) {
        if (ticketEngine_ == address(0)) revert InvalidTicketEngine();
        ticketEngine = TicketEngine(ticketEngine_);
    }

    /**
     * @notice Commit the next draw to a future blockhash randomness source.
     * @param revealBlock_ Block number whose hash will seed `r` (must be >= now + MIN_REVEAL_DELAY).
     * @param prizeAmount Public prize size credited to the winner (encrypted at claim time).
     * @dev Freezes TicketEngine weights and marks total tickets publicly decryptable.
     *      Anyone may call; the committer cannot predict `blockhash(revealBlock_)`.
     */
    function commitDraw(uint256 revealBlock_, uint64 prizeAmount) external nonReentrant {
        if (prizeAmount == 0) revert ZeroPrize();
        if (revealBlock_ < block.number + MIN_REVEAL_DELAY) revert InvalidRevealBlock();

        // Allow a new commit only from idle (no open commit) or after the prior draw revealed.
        if (drawId != 0 && !revealed) revert DrawPendingReveal();

        if (lastCommitTimestamp != 0 && block.timestamp < lastCommitTimestamp + MIN_DRAW_INTERVAL) {
            revert DrawIntervalNotElapsed();
        }

        if (ticketEngine.frozen()) {
            ticketEngine.setFrozen(false);
        }

        unchecked {
            drawId += 1;
        }
        revealed = false;
        drawRandomValue = 0;
        totalTicketsPlain = 0;
        prizeAmountPlain = prizeAmount;
        revealBlock = revealBlock_;
        lastCommitTimestamp = block.timestamp;

        ticketEngine.setFrozen(true);
        ticketEngine.makeTotalPubliclyDecryptable();

        emit DrawCommitted(drawId, revealBlock_, prizeAmount);
    }

    /**
     * @notice Reveal `r` from the committed blockhash, bounded by the publicly decrypted total.
     * @param totalTicketsCleartext Public decryption of TicketEngine.totalTickets().
     * @param decryptionProof KMS self-relay proof for `totalTicketsCleartext`.
     * @dev Rejects early reveals and reveals after the 256-block hash window so the
     *      randomness source cannot be predicted at commit or replaced after expiry.
     */
    function revealDraw(uint64 totalTicketsCleartext, bytes calldata decryptionProof) external nonReentrant {
        if (drawId == 0) revert DrawNotCommitted();
        if (revealed) revert DrawAlreadyRevealed();
        if (block.number <= revealBlock) revert RevealTooEarly();
        if (block.number > revealBlock + MAX_REVEAL_WINDOW) revert RevealTooLate();
        if (totalTicketsCleartext == 0) revert ZeroTotalTickets();

        euint64 totalHandle = ticketEngine.totalTickets();
        bytes32[] memory handles = new bytes32[](1);
        handles[0] = euint64.unwrap(totalHandle);
        FHE.checkSignatures(handles, abi.encode(totalTicketsCleartext), decryptionProof);

        bytes32 h = blockhash(revealBlock);
        if (h == bytes32(0)) revert RevealTooLate();

        uint64 r = uint64(uint256(h) % uint256(totalTicketsCleartext));

        totalTicketsPlain = totalTicketsCleartext;
        drawRandomValue = r;
        revealed = true;

        emit DrawRevealed(drawId, r, totalTicketsCleartext);
    }

    /**
     * @notice Pull-based win check for `msg.sender` on draw `_drawId`.
     * @param _drawId Draw to check (must be the current revealed draw).
     * @dev Computes `[start, start+weight)` via TicketEngine prefix sum, then one
     *      encrypted comparison against plaintext `r`. Losers receive encrypted zero
     *      (no revert). `hasChecked` prevents repeat calls per draw.
     */
    function checkIfWon(uint256 _drawId) external nonReentrant {
        if (_drawId == 0 || _drawId != drawId) revert WrongDrawId();
        if (!revealed) revert DrawNotRevealed();
        if (hasChecked[_drawId][msg.sender]) revert AlreadyChecked();

        uint256 index = ticketEngine.indexOf(msg.sender);
        if (index == 0) revert NotRegistered();

        hasChecked[_drawId][msg.sender] = true;

        euint64 start = ticketEngine.prefixSumBefore(index);
        euint64 weight = ticketEngine.weightOf(index);
        euint64 end = FHE.add(start, weight);
        FHE.allowThis(end);

        euint64 rEnc = FHE.asEuint64(drawRandomValue);
        ebool inRange = FHE.and(FHE.ge(rEnc, start), FHE.lt(rEnc, end));
        FHE.allowThis(inRange);
        // Publicly decryptable so a winner can optionally prove the flag via self-relay
        // without revealing their encrypted prize amount.
        ebool wonFlag = FHE.makePubliclyDecryptable(inRange);
        _won[_drawId][msg.sender] = wonFlag;

        euint64 prize = FHE.select(wonFlag, FHE.asEuint64(prizeAmountPlain), FHE.asEuint64(0));
        FHE.allowThis(prize);
        FHE.allow(prize, msg.sender);
        _pendingPrize[msg.sender] = prize;

        emit DrawChecked(_drawId, msg.sender);
    }

    /**
     * @notice Optionally publish that `msg.sender` won tier `TIER_MAIN` for `_drawId`.
     * @param _drawId Draw previously checked via `checkIfWon`.
     * @param wonCleartext Public decryption of the caller's encrypted win flag (must be true).
     * @param decryptionProof KMS self-relay proof for `wonCleartext`.
     * @dev Off by default — callers opt in. Verifies the stored `ebool` via `checkSignatures`
     *      so losers (or unchecked addresses) cannot falsely claim a win. Emits tier only;
     *      never the prize amount. Safe for past draws as long as `hasChecked` was set.
     */
    function revealWin(uint256 _drawId, bool wonCleartext, bytes calldata decryptionProof) external nonReentrant {
        if (_drawId == 0) revert WrongDrawId();
        if (!hasChecked[_drawId][msg.sender]) revert NotChecked();
        if (winRevealed[_drawId][msg.sender]) revert AlreadyWinRevealed();
        if (!wonCleartext) revert NotAWinner();

        ebool flag = _won[_drawId][msg.sender];
        if (!FHE.isInitialized(flag)) revert NotChecked();

        bytes32[] memory handles = new bytes32[](1);
        handles[0] = ebool.unwrap(flag);
        FHE.checkSignatures(handles, abi.encode(wonCleartext), decryptionProof);

        winRevealed[_drawId][msg.sender] = true;
        emit WinRevealed(_drawId, msg.sender, TIER_MAIN);
    }

    /**
     * @notice Returns the caller's encrypted pending prize handle for client-side user-decrypt.
     */
    function getPendingPrize() external view returns (euint64) {
        return _pendingPrize[msg.sender];
    }

    /**
     * @notice Returns `account`'s encrypted pending prize handle.
     * @param account User to query.
     */
    function getPendingPrizeOf(address account) external view returns (euint64) {
        return _pendingPrize[account];
    }

    /**
     * @notice Encrypted win flag for `account` on `draw` (publicly decryptable after checkIfWon).
     * @param draw Draw id.
     * @param account User who called `checkIfWon`.
     */
    function getWonFlag(uint256 draw, address account) external view returns (ebool) {
        return _won[draw][account];
    }

    /**
     * @notice Re-opens TicketEngine weight syncs after the current draw has been revealed.
     * @dev Kept separate from `revealDraw` on purpose: `checkIfWon` reads live Fenwick weights,
     *      so unfreezing immediately after reveal would let a user inflate their range against
     *      an already-finalized `r`. Call this (permissionless) after the claim window, or let
     *      the next `commitDraw` unfreeze-then-refreeze.
     */
    function unfreezeWeights() external {
        if (!revealed) revert DrawNotRevealed();
        if (ticketEngine.frozen()) {
            ticketEngine.setFrozen(false);
        }
    }
}
