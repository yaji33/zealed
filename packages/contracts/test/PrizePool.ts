import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";

import { PrizePool__factory } from "../types";
import {
  closeAndAward,
  deploySystem,
  deposit,
  OPERATOR_UNTIL,
  publicDecrypt,
  SystemFixture,
  synchronizePrizeLiquidity,
} from "./helpers";

describe("PrizePool", function () {
  let fixture: SystemFixture;
  let sponsor: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;

  before(async function () {
    [sponsor, alice, bob] = await ethers.getSigners();
  });

  beforeEach(async function () {
    if (!fhevm.isMock) this.skip();
    fixture = await deploySystem();
  });

  it("validates immutable configuration and owner-only one-time wiring", async function () {
    const factory = (await ethers.getContractFactory("PrizePool")) as PrizePool__factory;
    await expect(factory.deploy(ethers.ZeroAddress, [1, 1, 1], [1, 1, 1], 1))
      .to.be.revertedWithCustomError(factory, "InvalidAsset");
    await expect(factory.deploy(fixture.tokenAddress, [1, 1, 1], [1, 1, 5], 1))
      .to.be.revertedWithCustomError(factory, "InvalidConfiguration");
    await expect(fixture.prizePool.connect(alice).setDrawManager(alice.address))
      .to.be.revertedWithCustomError(fixture.prizePool, "OwnableUnauthorizedAccount")
      .withArgs(alice.address);
    await expect(fixture.prizePool.setDrawManager(fixture.drawAddress)).to.be.revertedWithCustomError(
      fixture.prizePool,
      "AlreadyConfigured",
    );
  });

  it("synchronizes public accounting to the actual confidential token balance", async function () {
    await synchronizePrizeLiquidity(fixture, sponsor, 120_000);
    expect(await fixture.prizePool.availableLiquidity()).to.eq(120_000n);

    await (await fixture.token.mint(fixture.prizePoolAddress, 5_000)).wait();
    await (await fixture.prizePool.prepareLiquidity()).wait();
    const handle = await fixture.prizePool.liquidityBalanceHandle();
    const actual = await publicDecrypt(handle);
    await (await fixture.prizePool.finalizeLiquidity(actual.clear, actual.proof)).wait();

    expect(actual.clear).to.eq(125_000n);
    expect(await fixture.prizePool.availableLiquidity()).to.eq(125_000n);
    expect(await fixture.prizePool.reserveLiquidity()).to.eq(0n);
  });

  it("allocates all three tiers, multiple slots, reserve, and rounding dust", async function () {
    const exact = await deploySystem([5_000, 3_000, 1_000], [1, 2, 3], 1_000);
    await synchronizePrizeLiquidity(exact, sponsor, 100_003);
    await deposit(exact, alice, 10);
    await time.increase(Number(await exact.draw.MIN_DRAW_INTERVAL()));
    const { id } = await closeAndAward(exact);

    expect(await exact.prizePool.prizePerSlot(id, 0)).to.eq(50_001n);
    expect(await exact.prizePool.prizePerSlot(id, 1)).to.eq(15_000n);
    expect(await exact.prizePool.prizePerSlot(id, 2)).to.eq(3_333n);
    expect(await exact.prizePool.reserveLiquidity()).to.eq(10_003n);
    expect(await exact.prizePool.availableLiquidity()).to.eq(0n);
    expect(await exact.prizePool.activeDrawId()).to.eq(id);
    await expect(exact.prizePool.prepareLiquidity()).to.be.revertedWithCustomError(
      exact.prizePool,
      "ActiveDraw",
    );
  });

  it("remains reserve-solvent after every allocated slot is claimed", async function () {
    await synchronizePrizeLiquidity(fixture, sponsor, 600_000);
    await deposit(fixture, alice, 10);
    await deposit(fixture, bob, 10);
    await time.increase(Number(await fixture.draw.MIN_DRAW_INTERVAL()));
    const { id } = await closeAndAward(fixture);

    for (const [tier, slots] of [
      [0, 1],
      [1, 2],
      [2, 3],
    ] as const) {
      for (let slot = 0; slot < slots; slot++) {
        for (const user of [alice, bob]) {
          await (await fixture.draw.connect(user).checkPrize(id, tier, slot)).wait();
          await (await fixture.draw.connect(user).claim(id, tier, slot)).wait();
        }
      }
    }

    const draw = await fixture.draw.draws(id);
    await time.increaseTo(draw.claimDeadline + 1n);
    await (await fixture.draw.prepareReconciliation(id)).wait();
    const handle = await fixture.prizePool.reconciliationBalanceHandle();
    const actual = await publicDecrypt(handle);
    expect(actual.clear).to.eq(await fixture.prizePool.reserveLiquidity());
    expect(actual.clear).to.eq(60_000n);
  });

  it("requires nonzero contributions and operator authorization", async function () {
    await expect(fixture.prizePool.contribute(0)).to.be.revertedWithCustomError(
      fixture.prizePool,
      "ZeroContribution",
    );
    await (await fixture.token.mint(alice.address, 1_000)).wait();
    await expect(fixture.prizePool.connect(alice).contribute(1_000)).to.be.reverted;
    await (
      await fixture.token.connect(alice).setOperator(fixture.prizePoolAddress, OPERATOR_UNTIL)
    ).wait();
    await expect(fixture.prizePool.connect(alice).contribute(1_000))
      .to.emit(fixture.prizePool, "LiquidityContributed")
      .withArgs(alice.address);
  });
});
