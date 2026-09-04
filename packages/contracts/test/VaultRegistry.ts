import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";

import { VaultRegistry, VaultRegistry__factory } from "../types";
import { decryptUserValue, deploySystem, deposit, SystemFixture, withdraw } from "./helpers";

describe("VaultRegistry", function () {
  let registry: VaultRegistry;
  let first: SystemFixture;
  let second: SystemFixture;
  let alice: HardhatEthersSigner;

  const firstId = ethers.encodeBytes32String("cusdc");
  const secondId = ethers.encodeBytes32String("cusdt");

  before(async function () {
    [, alice] = await ethers.getSigners();
  });

  beforeEach(async function () {
    if (!fhevm.isMock) this.skip();
    const factory = (await ethers.getContractFactory("VaultRegistry")) as VaultRegistry__factory;
    registry = (await factory.deploy()) as VaultRegistry;
    first = await deploySystem();
    second = await deploySystem();
  });

  async function register(id: string, system: SystemFixture): Promise<void> {
    await (
      await registry.registerVault(
        id,
        system.tokenAddress,
        system.vaultAddress,
        system.ticketsAddress,
        system.prizePoolAddress,
        system.drawAddress,
      )
    ).wait();
  }

  it("registers and enumerates two independently wired asset vaults", async function () {
    await expect(
      registry.registerVault(
        firstId,
        first.tokenAddress,
        first.vaultAddress,
        first.ticketsAddress,
        first.prizePoolAddress,
        first.drawAddress,
      ),
    )
      .to.emit(registry, "VaultRegistered")
      .withArgs(
        firstId,
        first.tokenAddress,
        first.vaultAddress,
        first.ticketsAddress,
        first.prizePoolAddress,
        first.drawAddress,
      );
    await register(secondId, second);

    expect(await registry.vaultCount()).to.eq(2n);
    expect(await registry.vaultIdAt(0)).to.eq(firstId);
    expect(await registry.vaultIdAt(1)).to.eq(secondId);

    const firstSystem = await registry.getVault(firstId);
    const secondSystem = await registry.getVault(secondId);
    expect(firstSystem.asset).to.eq(first.tokenAddress);
    expect(firstSystem.vault).to.eq(first.vaultAddress);
    expect(firstSystem.active).to.eq(true);
    expect(secondSystem.asset).to.eq(second.tokenAddress);
    expect(secondSystem.vault).to.eq(second.vaultAddress);
    expect(secondSystem.active).to.eq(true);
  });

  it("keeps balances and principal custody isolated between vaults", async function () {
    await register(firstId, first);
    await register(secondId, second);

    await deposit(first, alice, 125);
    await deposit(second, alice, 40);

    expect(await decryptUserValue(await first.vault.getBalanceOf(alice.address), first.vaultAddress, alice)).to.eq(
      125n,
    );
    expect(await decryptUserValue(await second.vault.getBalanceOf(alice.address), second.vaultAddress, alice)).to.eq(
      40n,
    );
  });

  it("rejects unauthorized, duplicate, incomplete, and mismatched systems", async function () {
    await expect(
      registry
        .connect(alice)
        .registerVault(
          firstId,
          first.tokenAddress,
          first.vaultAddress,
          first.ticketsAddress,
          first.prizePoolAddress,
          first.drawAddress,
        ),
    )
      .to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount")
      .withArgs(alice.address);

    await expect(
      registry.registerVault(
        firstId,
        ethers.ZeroAddress,
        first.vaultAddress,
        first.ticketsAddress,
        first.prizePoolAddress,
        first.drawAddress,
      ),
    ).to.be.revertedWithCustomError(registry, "InvalidComponent");

    await expect(
      registry.registerVault(
        firstId,
        second.tokenAddress,
        first.vaultAddress,
        first.ticketsAddress,
        first.prizePoolAddress,
        first.drawAddress,
      ),
    ).to.be.revertedWithCustomError(registry, "AssetMismatch");

    await register(firstId, first);
    await expect(
      registry.registerVault(
        firstId,
        second.tokenAddress,
        second.vaultAddress,
        second.ticketsAddress,
        second.prizePoolAddress,
        second.drawAddress,
      ),
    ).to.be.revertedWithCustomError(registry, "VaultAlreadyRegistered");
    await expect(
      registry.registerVault(
        secondId,
        first.tokenAddress,
        first.vaultAddress,
        first.ticketsAddress,
        first.prizePoolAddress,
        first.drawAddress,
      ),
    ).to.be.revertedWithCustomError(registry, "AssetAlreadyRegistered");
    await expect(
      registry.registerVault(
        secondId,
        second.tokenAddress,
        first.vaultAddress,
        second.ticketsAddress,
        second.prizePoolAddress,
        second.drawAddress,
      ),
    ).to.be.revertedWithCustomError(registry, "ComponentAlreadyRegistered");
  });

  it("rejects every cross-wired component relationship", async function () {
    await expect(
      registry.registerVault(
        firstId,
        first.tokenAddress,
        first.vaultAddress,
        second.ticketsAddress,
        first.prizePoolAddress,
        first.drawAddress,
      ),
    ).to.be.revertedWithCustomError(registry, "VaultMismatch");

    await expect(
      registry.registerVault(
        firstId,
        first.tokenAddress,
        first.vaultAddress,
        first.ticketsAddress,
        first.prizePoolAddress,
        second.drawAddress,
      ),
    ).to.be.revertedWithCustomError(registry, "TicketEngineMismatch");

    const poolFactory = await ethers.getContractFactory("PrizePool");
    const alternatePool = await poolFactory.deploy(first.tokenAddress, [5_000, 3_000, 1_500], [1, 2, 4], 500);
    const alternatePoolAddress = await alternatePool.getAddress();
    await expect(
      registry.registerVault(
        firstId,
        first.tokenAddress,
        first.vaultAddress,
        first.ticketsAddress,
        alternatePoolAddress,
        first.drawAddress,
      ),
    ).to.be.revertedWithCustomError(registry, "PrizePoolMismatch");

    const drawFactory = await ethers.getContractFactory("DrawManager");
    const alternateDraw = await drawFactory.deploy(first.ticketsAddress, first.vaultAddress, first.prizePoolAddress);
    await expect(
      registry.registerVault(
        firstId,
        first.tokenAddress,
        first.vaultAddress,
        first.ticketsAddress,
        first.prizePoolAddress,
        await alternateDraw.getAddress(),
      ),
    ).to.be.revertedWithCustomError(registry, "DrawManagerMismatch");
  });

  it("can hide a vault from discovery without blocking principal withdrawal", async function () {
    await register(firstId, first);
    await deposit(first, alice, 100);

    await expect(registry.setVaultActive(firstId, false))
      .to.emit(registry, "VaultStatusChanged")
      .withArgs(firstId, false);
    expect((await registry.getVault(firstId)).active).to.eq(false);

    await withdraw(first, alice, 100);
    expect(await decryptUserValue(await first.vault.getBalanceOf(alice.address), first.vaultAddress, alice)).to.eq(0n);
    await expect(registry.getVault(ethers.encodeBytes32String("unknown"))).to.be.revertedWithCustomError(
      registry,
      "UnknownVault",
    );
  });
});
