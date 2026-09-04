import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";

import {
  awardDraw,
  closeAndAward,
  closeDraw,
  decryptPendingPrize,
  decryptTokenBalance,
  decryptUserValue,
  deploySystem,
  deposit,
  publicDecrypt,
  SystemFixture,
  synchronizePrizeLiquidity,
  withdraw,
} from "./helpers";

type Slot = { tier: number; slot: number };

function allSlots(): Slot[] {
  return [
    { tier: 0, slot: 0 },
    { tier: 1, slot: 0 },
    { tier: 1, slot: 1 },
    { tier: 2, slot: 0 },
    { tier: 2, slot: 1 },
    { tier: 2, slot: 2 },
  ];
}

describe("DrawManager", function () {
  let fixture: SystemFixture;
  let sponsor: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;
  let carol: HardhatEthersSigner;
  let users: HardhatEthersSigner[];

  before(async function () {
    const signers = await ethers.getSigners();
    [sponsor, alice, bob, carol] = signers;
    users = signers.slice(1);
  });

  beforeEach(async function () {
    if (!fhevm.isMock) this.skip();
    fixture = await deploySystem();
  });

  async function seedAwardedDraw(
    participants: HardhatEthersSigner[] = [alice, bob, carol],
  ): Promise<bigint> {
    await synchronizePrizeLiquidity(fixture, sponsor, 600_000);
    for (let i = 0; i < participants.length; i++) {
      await deposit(fixture, participants[i], (i + 1) * 10);
    }
    await time.increase(Number(await fixture.draw.MIN_DRAW_INTERVAL()));
    return (await closeAndAward(fixture)).id;
  }

  it("closes, verifies the public total, allocates, and awards bounded FHE-random slots", async function () {
    await synchronizePrizeLiquidity(fixture, sponsor, 600_000);
    await deposit(fixture, alice, 25);
    await time.increase(Number(await fixture.draw.MIN_DRAW_INTERVAL()));

    const closed = await closeDraw(fixture);
    expect(closed.totalScore).to.be.gt(0n);
    await expect(fixture.draw.awardDraw(closed.id, closed.totalScore, closed.proof))
      .to.emit(fixture.draw, "DrawAwarded")
      .withArgs(closed.id);

    const draw = await fixture.draw.draws(closed.id);
    expect(draw.closed).to.eq(true);
    expect(draw.awarded).to.eq(true);
    expect(await fixture.prizePool.activeDrawId()).to.eq(closed.id);
    expect(await fixture.prizePool.prizePerSlot(closed.id, 0)).to.eq(360_000n);
    expect(await fixture.prizePool.prizePerSlot(closed.id, 1)).to.eq(60_000n);
    expect(await fixture.prizePool.prizePerSlot(closed.id, 2)).to.eq(20_000n);
    expect(await fixture.prizePool.reserveLiquidity()).to.eq(60_000n);

    await expect(fixture.draw.awardDraw(closed.id, closed.totalScore, closed.proof)).to.be.revertedWithCustomError(
      fixture.draw,
      "DrawAlreadyAwarded",
    );
  });

  it("selects exactly one winner per slot across all tiers and returns encrypted zero on loss", async function () {
    const drawId = await seedAwardedDraw();

    for (const { tier, slot } of allSlots()) {
      const results: bigint[] = [];
      for (const user of [alice, bob, carol]) {
        await expect(fixture.draw.connect(user).checkPrize(drawId, tier, slot))
          .to.emit(fixture.draw, "PrizeChecked")
          .withArgs(drawId, user.address, tier, slot);
        results.push(await decryptPendingPrize(fixture, user, drawId, tier, slot));
      }

      const prize = await fixture.prizePool.prizePerSlot(drawId, tier);
      expect(results.filter((result) => result === prize)).to.have.length(1);
      expect(results.filter((result) => result === 0n)).to.have.length(2);
    }
  });

  it("covers the full single-user range and excludes a zero-weight historical range", async function () {
    await synchronizePrizeLiquidity(fixture, sponsor, 100_000);
    await deposit(fixture, alice, 10);
    await deposit(fixture, bob, 0);
    await time.increase(Number(await fixture.draw.MIN_DRAW_INTERVAL()));
    const { id } = await closeAndAward(fixture);

    await (await fixture.draw.connect(alice).checkPrize(id, 0, 0)).wait();
    await (await fixture.draw.connect(bob).checkPrize(id, 0, 0)).wait();
    expect(await decryptPendingPrize(fixture, alice, id, 0, 0)).to.eq(
      await fixture.prizePool.prizePerSlot(id, 0),
    );
    expect(await decryptPendingPrize(fixture, bob, id, 0, 0)).to.eq(0n);
  });

  it("decrypts pending prizes, pays winners from PrizePool, and guards check and claim replay", async function () {
    const drawId = await seedAwardedDraw([alice, bob]);
    const slot = { tier: 1, slot: 1 };

    await expect(fixture.draw.connect(carol).claim(drawId, slot.tier, slot.slot))
      .to.be.revertedWithCustomError(fixture.draw, "NotChecked");

    for (const user of [alice, bob]) {
      await (await fixture.draw.connect(user).checkPrize(drawId, slot.tier, slot.slot)).wait();
    }
    await expect(fixture.draw.connect(alice).checkPrize(drawId, slot.tier, slot.slot))
      .to.be.revertedWithCustomError(fixture.draw, "AlreadyChecked");

    const alicePending = await decryptPendingPrize(fixture, alice, drawId, slot.tier, slot.slot);
    const bobPending = await decryptPendingPrize(fixture, bob, drawId, slot.tier, slot.slot);
    expect([alicePending, bobPending].filter((amount) => amount > 0n)).to.have.length(1);

    const aliceBefore = await decryptTokenBalance(fixture, alice);
    const bobBefore = await decryptTokenBalance(fixture, bob);
    await (await fixture.draw.connect(alice).claim(drawId, slot.tier, slot.slot)).wait();
    await (await fixture.draw.connect(bob).claim(drawId, slot.tier, slot.slot)).wait();
    expect(await decryptTokenBalance(fixture, alice)).to.eq(aliceBefore + alicePending);
    expect(await decryptTokenBalance(fixture, bob)).to.eq(bobBefore + bobPending);

    await expect(fixture.draw.connect(alice).claim(drawId, slot.tier, slot.slot))
      .to.be.revertedWithCustomError(fixture.draw, "AlreadyClaimed");
  });

  it("keeps principal withdrawable during closed, awarded, and active-claim phases", async function () {
    await synchronizePrizeLiquidity(fixture, sponsor, 100_000);
    await deposit(fixture, alice, 90);
    await time.increase(Number(await fixture.draw.MIN_DRAW_INTERVAL()));

    const closed = await closeDraw(fixture);
    await withdraw(fixture, alice, 30);
    await awardDraw(fixture, closed);
    await withdraw(fixture, alice, 30);
    await (await fixture.draw.connect(alice).checkPrize(closed.id, 0, 0)).wait();
    await (await fixture.draw.connect(alice).claim(closed.id, 0, 0)).wait();
    await withdraw(fixture, alice, 30);

    expect(
      await decryptUserValue(await fixture.vault.connect(alice).getBalance(), fixture.vaultAddress, alice),
    ).to.eq(0n);
    expect(
      await decryptUserValue(
        await fixture.draw.connect(alice).getDrawWeight(closed.id),
        fixture.drawAddress,
        alice,
      ),
    ).to.eq(closed.totalScore);
    expect((await publicDecrypt(await fixture.vault.totalDeposits())).clear).to.eq(0n);
  });

  it("expires checks and claims, then reconciles actual balance into solvent reserve and rollover", async function () {
    const drawId = await seedAwardedDraw([alice, bob]);
    await (await fixture.draw.connect(alice).checkPrize(drawId, 0, 0)).wait();
    await (await fixture.draw.connect(alice).claim(drawId, 0, 0)).wait();

    const draw = await fixture.draw.draws(drawId);
    await time.increaseTo(draw.claimDeadline + 1n);
    await expect(fixture.draw.connect(bob).checkPrize(drawId, 0, 0)).to.be.revertedWithCustomError(
      fixture.draw,
      "DrawExpired",
    );
    await expect(fixture.draw.connect(alice).claim(drawId, 0, 0)).to.be.revertedWithCustomError(
      fixture.draw,
      "DrawExpired",
    );

    await (await fixture.draw.prepareReconciliation(drawId)).wait();
    const handle = await fixture.prizePool.reconciliationBalanceHandle();
    const actual = await publicDecrypt(handle);
    await (
      await fixture.draw.finalizeReconciliation(drawId, actual.clear, actual.proof)
    ).wait();

    expect((await fixture.draw.draws(drawId)).reconciled).to.eq(true);
    expect(await fixture.prizePool.activeDrawId()).to.eq(0n);
    expect(
      (await fixture.prizePool.reserveLiquidity()) +
        (await fixture.prizePool.availableLiquidity()),
    ).to.eq(actual.clear);
    expect(await fixture.prizePool.reserveLiquidity()).to.be.lte(actual.clear);
  });

  it("recovers an empty period with a verified cancellation", async function () {
    await time.increase(Number(await fixture.draw.MIN_DRAW_INTERVAL()));
    const closed = await closeDraw(fixture);
    expect(closed.totalScore).to.eq(0n);

    await expect(fixture.draw.cancelEmptyDraw(closed.id, closed.proof))
      .to.emit(fixture.draw, "EmptyDrawCancelled")
      .withArgs(closed.id);
    expect((await fixture.draw.draws(closed.id)).reconciled).to.eq(true);

    await deposit(fixture, alice, 10);
    await synchronizePrizeLiquidity(fixture, sponsor, 100_000);
    await expect(fixture.draw.closeDraw()).to.not.be.reverted;
  });

  it("keeps first-check gas bounded as depositor count grows", async function () {
    this.timeout(300_000);

    async function gasFor(count: number): Promise<bigint> {
      const local = await deploySystem([6_000, 2_000, 1_000], [1, 1, 1]);
      await synchronizePrizeLiquidity(local, sponsor, 100_000);
      const participants = users.slice(0, count);
      expect(participants).to.have.length(count);
      for (const participant of participants) {
        await deposit(local, participant, 10);
      }
      await time.increase(Number(await local.draw.MIN_DRAW_INTERVAL()));
      const drawId = (await closeAndAward(local)).id;
      const receipt = await (
        await local.draw.connect(participants[count - 1]).checkPrize(drawId, 0, 0)
      ).wait();
      return receipt!.gasUsed;
    }

    const four = await gasFor(4);
    const sixteen = await gasFor(16);
    expect(sixteen).to.be.lt(four * 3n);
  });
});
