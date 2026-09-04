// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {ConfidentialVault} from "./ConfidentialVault.sol";
import {DrawManager} from "./DrawManager.sol";
import {PrizePool} from "./PrizePool.sol";
import {TicketEngine} from "./TicketEngine.sol";

/**
 * @title VaultRegistry
 * @notice Curates independently accounted confidential prize-vault systems.
 * @dev The registry never receives principal or prize assets. Each entry binds one
 *      asset to one fully wired vault, ticket engine, prize pool, and draw manager.
 */
contract VaultRegistry is Ownable {
    struct VaultSystem {
        address asset;
        address vault;
        address ticketEngine;
        address prizePool;
        address drawManager;
        bool active;
    }

    bytes32[] private _vaultIds;
    mapping(bytes32 vaultId => VaultSystem system) private _systems;
    mapping(address component => bytes32 vaultId) public vaultIdForAsset;
    mapping(address component => bytes32 vaultId) public vaultIdForVault;
    mapping(address component => bytes32 vaultId) public vaultIdForTicketEngine;
    mapping(address component => bytes32 vaultId) public vaultIdForPrizePool;
    mapping(address component => bytes32 vaultId) public vaultIdForDrawManager;

    event VaultRegistered(
        bytes32 indexed vaultId,
        address indexed asset,
        address indexed vault,
        address ticketEngine,
        address prizePool,
        address drawManager
    );
    event VaultStatusChanged(bytes32 indexed vaultId, bool active);

    error InvalidVaultId();
    error InvalidComponent();
    error VaultAlreadyRegistered();
    error AssetAlreadyRegistered();
    error ComponentAlreadyRegistered();
    error UnknownVault();
    error AssetMismatch();
    error VaultMismatch();
    error TicketEngineMismatch();
    error PrizePoolMismatch();
    error DrawManagerMismatch();

    /**
     * @notice Creates an empty curated registry.
     */
    constructor() Ownable(msg.sender) {}

    /**
     * @notice Registers one completely wired, asset-isolated vault system.
     * @param vaultId Stable protocol identifier for the vault.
     * @param asset ERC-7984 principal and prize asset used by this system.
     * @param vault Principal custodian.
     * @param ticketEngine Versioned eligibility engine.
     * @param prizePool Sponsor-funded prize-liquidity custodian.
     * @param drawManager Draw coordinator.
     */
    function registerVault(
        bytes32 vaultId,
        address asset,
        address vault,
        address ticketEngine,
        address prizePool,
        address drawManager
    ) external onlyOwner {
        if (vaultId == bytes32(0)) revert InvalidVaultId();
        if (_systems[vaultId].vault != address(0)) revert VaultAlreadyRegistered();
        _requireContracts(asset, vault, ticketEngine, prizePool, drawManager);
        if (vaultIdForAsset[asset] != bytes32(0)) revert AssetAlreadyRegistered();
        if (
            vaultIdForVault[vault] != bytes32(0) ||
            vaultIdForTicketEngine[ticketEngine] != bytes32(0) ||
            vaultIdForPrizePool[prizePool] != bytes32(0) ||
            vaultIdForDrawManager[drawManager] != bytes32(0)
        ) {
            revert ComponentAlreadyRegistered();
        }

        _validateSystem(asset, vault, ticketEngine, prizePool, drawManager);

        _systems[vaultId] = VaultSystem({
            asset: asset,
            vault: vault,
            ticketEngine: ticketEngine,
            prizePool: prizePool,
            drawManager: drawManager,
            active: true
        });
        _vaultIds.push(vaultId);
        vaultIdForAsset[asset] = vaultId;
        vaultIdForVault[vault] = vaultId;
        vaultIdForTicketEngine[ticketEngine] = vaultId;
        vaultIdForPrizePool[prizePool] = vaultId;
        vaultIdForDrawManager[drawManager] = vaultId;

        emit VaultRegistered(vaultId, asset, vault, ticketEngine, prizePool, drawManager);
    }

    /**
     * @notice Enables or disables a vault for new frontend activity.
     * @param vaultId Registered vault identifier.
     * @param active Whether clients should present this vault as active.
     * @dev Disabling registry discovery never blocks direct principal withdrawal.
     */
    function setVaultActive(bytes32 vaultId, bool active) external onlyOwner {
        VaultSystem storage system = _systems[vaultId];
        if (system.vault == address(0)) revert UnknownVault();
        system.active = active;
        emit VaultStatusChanged(vaultId, active);
    }

    /**
     * @notice Returns the complete immutable component binding and current status.
     * @param vaultId Registered vault identifier.
     * @return system Vault system metadata.
     */
    function getVault(bytes32 vaultId) external view returns (VaultSystem memory system) {
        system = _systems[vaultId];
        if (system.vault == address(0)) revert UnknownVault();
    }

    /**
     * @notice Returns the number of vault systems ever registered.
     * @return count Registry entry count.
     */
    function vaultCount() external view returns (uint256 count) {
        return _vaultIds.length;
    }

    /**
     * @notice Returns a vault identifier by registration order.
     * @param index Zero-based registry index.
     * @return vaultId Registered vault identifier.
     */
    function vaultIdAt(uint256 index) external view returns (bytes32 vaultId) {
        return _vaultIds[index];
    }

    function _requireContracts(
        address asset,
        address vault,
        address ticketEngine,
        address prizePool,
        address drawManager
    ) private view {
        if (
            asset.code.length == 0 ||
            vault.code.length == 0 ||
            ticketEngine.code.length == 0 ||
            prizePool.code.length == 0 ||
            drawManager.code.length == 0
        ) {
            revert InvalidComponent();
        }
    }

    function _validateSystem(
        address asset,
        address vault,
        address ticketEngine,
        address prizePool,
        address drawManager
    ) private view {
        ConfidentialVault principalVault = ConfidentialVault(vault);
        TicketEngine tickets = TicketEngine(ticketEngine);
        PrizePool pool = PrizePool(prizePool);
        DrawManager draw = DrawManager(drawManager);

        if (address(principalVault.asset()) != asset || address(pool.asset()) != asset) {
            revert AssetMismatch();
        }
        if (address(principalVault.ticketEngine()) != ticketEngine || tickets.vault() != vault) {
            revert VaultMismatch();
        }
        if (address(draw.ticketEngine()) != ticketEngine) revert TicketEngineMismatch();
        if (address(draw.vault()) != vault) revert VaultMismatch();
        if (address(draw.prizePool()) != prizePool) revert PrizePoolMismatch();
        if (tickets.drawManager() != drawManager || pool.drawManager() != drawManager) {
            revert DrawManagerMismatch();
        }
    }
}
