import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";

import {
  awardDraw,
  closeDraw,
  decryptUserValue,
  deploySystem,
  deposit,
  SystemFixture,
  synchronizePrizeLiquidity,
  withdraw,
} from "./helpers";

describe("TicketEngine", function () {
  let fixture: SystemFixture;
  let deployer: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;

  before(async function () {
    [deployer, alice, bob] = await ethers.getSigners();
  });

  beforeEach(async function () {
    if (!fhevm.isMock) this.skip();
    fixture = await deploySystem();
  });

  it("uses immutable owner-only wiring and permanent one-based indexes", async function () {
    expect(await fixture.tickets.owner()).to.eq(deployer.address);
    await expect(fixture.tickets.connect(alice).setDrawManager(alice.address))
      .to.be.revertedWithCustomError(fixture.tickets, "OwnableUnauthorizedAccount")
      .withArgs(alice.address);
    await expect(fixture.tickets.setVault(fixture.vaultAddress)).to.be.revertedWithCustomError(
      fixture.tickets,
      "AlreadyConfigured",
    );

    await deposit(fixture, alice, 100);
    await deposit(fixture, bob, 50);
    await withdraw(fixture, alice, 100);
    await deposit(fixture, alice, 25);

    expect(await fixture.tickets.indexOf(alice.address)).to.eq(1n);
    expect(await fixture.tickets.indexOf(bob.address)).to.eq(2n);
    expect(await fixture.tickets.nextIndex()).to.eq(3n);
    expect(await fixture.tickets.currentVersion()).to.eq(4n);
  });

  it("tracks current encrypted balances without cross-account leakage", async function () {
    await deposit(fixture, alice, 120);
    await deposit(fixture, bob, 80);
    await withdraw(fixture, alice, 20);

    const aliceWeight = await decryptUserValue(
      await fixture.tickets.getWeight(1),
      fixture.ticketsAddress,
      alice,
    );
    const bobWeight = await decryptUserValue(
      await fixture.tickets.getWeight(2),
      fixture.ticketsAddress,
      bob,
    );
    expect(aliceWeight).to.eq(100n);
    expect(bobWeight).to.eq(80n);

    let denied = false;
    try {
      await decryptUserValue(await fixture.tickets.getWeight(1), fixture.ticketsAddress, bob);
    } catch {
      denied = true;
    }
    expect(denied).to.eq(true);
  });

  it("computes exact balance-time weights and cumulative boundaries", async function () {
    await synchronizePrizeLiquidity(fixture, deployer, 100_000);
    const start = await fixture.draw.periodStartTime();

    const aliceAt = await deposit(fixture, alice, 10);
    await time.increase(199);
    const bobAt = await deposit(fixture, bob, 30);
    await time.increaseTo(start + 1_200n);

    const closed = await closeDraw(fixture);
    const draw = await fixture.draw.draws(closed.id);
    const aliceExpected = 10n * (draw.endTime - BigInt(aliceAt));
    const bobExpected = 30n * (draw.endTime - BigInt(bobAt));
    expect(closed.totalScore).to.eq(aliceExpected + bobExpected);

    await awardDraw(fixture, closed);
    await (await fixture.draw.connect(alice).checkPrize(closed.id, 0, 0)).wait();
    await (await fixture.draw.connect(bob).checkPrize(closed.id, 0, 0)).wait();

    expect(
      await decryptUserValue(
        await fixture.draw.connect(alice).getDrawWeight(closed.id),
        fixture.drawAddress,
        alice,
      ),
    ).to.eq(aliceExpected);
    expect(
      await decryptUserValue(
        await fixture.draw.connect(bob).getDrawWeight(closed.id),
        fixture.drawAddress,
        bob,
      ),
    ).to.eq(bobExpected);
  });

  it("keeps a closed snapshot immutable across later withdrawal checkpoints", async function () {
    await synchronizePrizeLiquidity(fixture, deployer, 100_000);
    await deposit(fixture, alice, 20);
    await deposit(fixture, bob, 20);
    await time.increase(Number(await fixture.draw.MIN_DRAW_INTERVAL()));

    const closed = await closeDraw(fixture);
    const sealed = await fixture.draw.draws(closed.id);
    await withdraw(fixture, alice, 20);
    await withdraw(fixture, bob, 20);
    expect(await fixture.tickets.currentVersion()).to.eq(sealed.endVersion + 2n);

    await awardDraw(fixture, closed);
    await (await fixture.draw.connect(alice).checkPrize(closed.id, 0, 0)).wait();
    await (await fixture.draw.connect(bob).checkPrize(closed.id, 0, 0)).wait();

    const aliceHistorical = await decryptUserValue(
      await fixture.draw.connect(alice).getDrawWeight(closed.id),
      fixture.drawAddress,
      alice,
    );
    const bobHistorical = await decryptUserValue(
      await fixture.draw.connect(bob).getDrawWeight(closed.id),
      fixture.drawAddress,
      bob,
    );
    expect(aliceHistorical + bobHistorical).to.eq(closed.totalScore);
    expect(aliceHistorical).to.be.gt(0n);
    expect(bobHistorical).to.be.gt(0n);
  });
});
