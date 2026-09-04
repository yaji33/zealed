// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, ebool, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PrizePool
 * @notice Solvent, reserve-backed prize liquidity isolated from vault principal.
 * @dev Contributions and tier allocations are public aggregates. Transfers remain
 *      ERC-7984 confidential, and events never contain token amounts.
 */
contract PrizePool is ZamaEthereumConfig, Ownable, ReentrancyGuard {
    uint8 public constant TIER_COUNT = 3;
    uint8 public constant MAX_SLOTS_PER_TIER = 4;

    IERC7984 public immutable asset;
    uint16 public immutable reserveShares;
    address public drawManager;

    uint64 public availableLiquidity;
    uint64 public reserveLiquidity;
    uint256 public activeDrawId;
    uint64 public activeClaimDeadline;

    mapping(uint8 tier => uint16 shares) public tierShares;
    mapping(uint8 tier => uint8 slots) public slotCount;
    mapping(uint256 draw => mapping(uint8 tier => uint64 amount)) public prizePerSlot;

    euint64 private _reconciliationBalance;
    euint64 private _liquidityBalance;

    event LiquidityContributed(address indexed contributor);
    event LiquiditySynchronized();
    event DrawAllocated(uint256 indexed drawId);
    event PrizeTransferAttempted(uint256 indexed drawId, address indexed account, uint8 tier, uint8 slot);
    event DrawReconciled(uint256 indexed drawId);
    event DrawManagerConfigured(address indexed drawManager);

    error InvalidAsset();
    error InvalidConfiguration();
    error InvalidDrawManager();
    error AlreadyConfigured();
    error NotDrawManager();
    error ZeroContribution();
    error InsufficientPrizeLiquidity();
    error ActiveDraw();
    error NoActiveDraw();
    error ClaimWindowOpen();
    error InvalidTier();
    error InvalidSlot();

    modifier onlyDrawManager() {
        if (msg.sender != drawManager) revert NotDrawManager();
        _;
    }

    /**
     * @param asset_ ERC-7984 prize token.
     * @param shares_ Liquidity shares for the three prize tiers.
     * @param slots_ Prize slot count for each tier.
     * @param reserveShares_ Liquidity shares retained as reserve.
     */
    constructor(
        address asset_,
        uint16[3] memory shares_,
        uint8[3] memory slots_,
        uint16 reserveShares_
    ) Ownable(msg.sender) {
        if (asset_ == address(0)) revert InvalidAsset();
        uint256 totalShares = reserveShares_;
        for (uint8 tier = 0; tier < TIER_COUNT; ++tier) {
            if (shares_[tier] == 0 || slots_[tier] == 0 || slots_[tier] > MAX_SLOTS_PER_TIER) {
                revert InvalidConfiguration();
            }
            tierShares[tier] = shares_[tier];
            slotCount[tier] = slots_[tier];
            totalShares += shares_[tier];
        }
        if (reserveShares_ == 0 || totalShares > type(uint16).max) revert InvalidConfiguration();
        asset = IERC7984(asset_);
        reserveShares = reserveShares_;
    }

    /**
     * @notice Configures the only DrawManager once.
     * @param drawManager_ DrawManager address.
     */
    function setDrawManager(address drawManager_) external onlyOwner {
        if (drawManager_ == address(0)) revert InvalidDrawManager();
        if (drawManager != address(0)) revert AlreadyConfigured();
        drawManager = drawManager_;
        emit DrawManagerConfigured(drawManager_);
    }

    /**
     * @notice Contributes a public aggregate amount of mock yield.
     * @param amount Amount of cUSDC to transfer from the contributor.
     * @dev Contributor must first set this contract as an ERC-7984 operator.
     */
    function contribute(uint64 amount) external nonReentrant {
        if (amount == 0) revert ZeroContribution();
        euint64 encrypted = FHE.asEuint64(amount);
        FHE.allowTransient(encrypted, address(asset));
        asset.confidentialTransferFrom(msg.sender, address(this), encrypted);
        emit LiquidityContributed(msg.sender);
    }

    /**
     * @notice Makes the actual pool balance decryptable before draw allocation.
     * @return handle Encrypted prize-pool token balance.
     */
    function prepareLiquidity() external nonReentrant returns (euint64 handle) {
        if (activeDrawId != 0) revert ActiveDraw();
        handle = asset.confidentialBalanceOf(address(this));
        FHE.allowThis(handle);
        _liquidityBalance = FHE.makePubliclyDecryptable(handle);
        return _liquidityBalance;
    }

    /**
     * @notice Synchronizes public aggregate liquidity to the verified token balance.
     * @param clearBalance Public aggregate prize-pool balance.
     * @param proof KMS public-decryption proof.
     */
    function finalizeLiquidity(uint64 clearBalance, bytes calldata proof) external nonReentrant {
        if (activeDrawId != 0) revert ActiveDraw();
        bytes32[] memory handles = new bytes32[](1);
        handles[0] = euint64.unwrap(_liquidityBalance);
        FHE.checkSignatures(handles, abi.encode(clearBalance), proof);
        reserveLiquidity = clearBalance < reserveLiquidity ? clearBalance : reserveLiquidity;
        availableLiquidity = clearBalance - reserveLiquidity;
        emit LiquiditySynchronized();
    }

    /**
     * @notice Returns the handle prepared by the latest liquidity synchronization.
     */
    function liquidityBalanceHandle() external view returns (euint64) {
        return _liquidityBalance;
    }

    /**
     * @notice Allocates available liquidity across immutable tiers and reserve.
     * @param drawId Draw receiving the allocation.
     * @param claimDeadline Timestamp after which obligations can be reconciled.
     */
    function allocateDraw(uint256 drawId, uint64 claimDeadline) external onlyDrawManager {
        if (activeDrawId != 0) revert ActiveDraw();
        uint64 liquidity = availableLiquidity;
        if (liquidity == 0) revert InsufficientPrizeLiquidity();

        uint256 totalShares = reserveShares;
        for (uint8 tier = 0; tier < TIER_COUNT; ++tier) {
            totalShares += tierShares[tier];
        }

        uint64 reserveAdded = uint64((uint256(liquidity) * reserveShares) / totalShares);
        uint64 allocated = reserveAdded;
        for (uint8 tier = 0; tier < TIER_COUNT; ++tier) {
            uint64 tierLiquidity = uint64((uint256(liquidity) * tierShares[tier]) / totalShares);
            uint64 perSlot = tierLiquidity / slotCount[tier];
            if (perSlot == 0) revert InsufficientPrizeLiquidity();
            prizePerSlot[drawId][tier] = perSlot;
            allocated += perSlot * slotCount[tier];
        }

        reserveLiquidity += reserveAdded + (liquidity - allocated);
        availableLiquidity = 0;
        activeDrawId = drawId;
        activeClaimDeadline = claimDeadline;
        emit DrawAllocated(drawId);
    }

    /**
     * @notice Transfers a tier prize or encrypted zero.
     * @param drawId Active draw id.
     * @param account Prize recipient.
     * @param tier Prize tier.
     * @param slot Prize slot within the tier.
     * @param won Encrypted eligibility result.
     */
    function payout(
        uint256 drawId,
        address account,
        uint8 tier,
        uint8 slot,
        ebool won
    ) external nonReentrant onlyDrawManager {
        if (drawId != activeDrawId) revert NoActiveDraw();
        _validateSlot(tier, slot);
        euint64 amount = FHE.select(won, FHE.asEuint64(prizePerSlot[drawId][tier]), FHE.asEuint64(0));
        FHE.allowThis(amount);
        FHE.allowTransient(amount, address(asset));
        asset.confidentialTransfer(account, amount);
        emit PrizeTransferAttempted(drawId, account, tier, slot);
    }

    /**
     * @notice Makes the pool's actual token balance publicly decryptable after expiry.
     * @return handle Encrypted pool balance handle.
     */
    function prepareReconciliation() external nonReentrant onlyDrawManager returns (euint64 handle) {
        if (activeDrawId == 0) revert NoActiveDraw();
        if (block.timestamp <= activeClaimDeadline) revert ClaimWindowOpen();
        handle = asset.confidentialBalanceOf(address(this));
        FHE.allowThis(handle);
        _reconciliationBalance = FHE.makePubliclyDecryptable(handle);
        return _reconciliationBalance;
    }

    /**
     * @notice Reconciles unclaimed prizes against the actual confidential token balance.
     * @param clearBalance Public aggregate pool balance.
     * @param proof KMS public-decryption proof.
     */
    function finalizeReconciliation(
        uint64 clearBalance,
        bytes calldata proof
    ) external nonReentrant onlyDrawManager {
        if (activeDrawId == 0) revert NoActiveDraw();
        if (block.timestamp <= activeClaimDeadline) revert ClaimWindowOpen();
        bytes32[] memory handles = new bytes32[](1);
        handles[0] = euint64.unwrap(_reconciliationBalance);
        FHE.checkSignatures(handles, abi.encode(clearBalance), proof);

        uint256 expiredDraw = activeDrawId;
        reserveLiquidity = clearBalance < reserveLiquidity ? clearBalance : reserveLiquidity;
        availableLiquidity = clearBalance - reserveLiquidity;
        activeDrawId = 0;
        activeClaimDeadline = 0;
        emit DrawReconciled(expiredDraw);
    }

    /**
     * @notice Returns the handle prepared for expired-draw reconciliation.
     */
    function reconciliationBalanceHandle() external view returns (euint64) {
        return _reconciliationBalance;
    }

    function _validateSlot(uint8 tier, uint8 slot) private view {
        if (tier >= TIER_COUNT) revert InvalidTier();
        if (slot >= slotCount[tier]) revert InvalidSlot();
    }
}
