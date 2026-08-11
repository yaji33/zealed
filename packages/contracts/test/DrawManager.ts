import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";

import {
  DrawManager,
  DrawManager__factory,
  TicketEngine,
  TicketEngine__factory,
} from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const ticketFactory = (await ethers.getContractFactory("TicketEngine")) as TicketEngine__factory;
  const tickets = (await ticketFactory.deploy(ethers.ZeroAddress)) as TicketEngine;
  const ticketsAddress = await tickets.getAddress();

  const drawFactory = (await ethers.getContractFactory("DrawManager")) as DrawManager__factory;
  const draw = (await drawFactory.deploy(ticketsAddress)) as DrawManager;
  const drawAddress = await draw.getAddress();

  await (await tickets.setDrawManager(drawAddress)).wait();

  return { tickets, ticketsAddress, draw, drawAddress };
}

async function encryptWeight(ticketsAddress: string, user: string, weight: number) {
  return fhevm.createEncryptedInput(ticketsAddress, user).add64(weight).encrypt();
}

async function syncWeight(
  tickets: TicketEngine,
  ticketsAddress: string,
  user: HardhatEthersSigner,
  weight: number,
) {
  const enc = await encryptWeight(ticketsAddress, user.address, weight);
  await (await tickets.connect(user).syncWeight(user.address, enc.handles[0], enc.inputProof)).wait();
}

describe("DrawManager", function () {
  let signers: Signers;
  let tickets: TicketEngine;
  let ticketsAddress: string;
  let draw: DrawManager;
  let drawAddress: string;
  let extraSigners: HardhatEthersSigner[];

  const PRIZE = 1_000_000;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
    extraSigners = ethSigners.slice(3);
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("DrawManager unit tests require the FHEVM mock environment");
      this.skip();
    }
    ({ tickets, ticketsAddress, draw, drawAddress } = await deployFixture());
  });

  async function commitAndReveal(
    engine: TicketEngine = tickets,
    manager: DrawManager = draw,
  ): Promise<{ drawId: bigint; r: bigint; total: bigint }> {
    const target = (await ethers.provider.getBlockNumber()) + 3;
    await (await manager.commitDraw(target, PRIZE)).wait();

    while ((await ethers.provider.getBlockNumber()) <= target) {
      await ethers.provider.send("evm_mine", []);
    }

    const handle = await engine.totalTickets();
    const result = await fhevm.publicDecrypt([handle]);
    const total = result.clearValues[handle] as bigint;
    await (await manager.revealDraw(total, result.decryptionProof)).wait();

    return {
      drawId: await manager.drawId(),
      r: await manager.drawRandomValue(),
      total,
    };
  }

  it("a user outside the drawn range receives a zero prize, not a revert", async function () {
    await syncWeight(tickets, ticketsAddress, signers.alice, 100);
    await syncWeight(tickets, ticketsAddress, signers.bob, 100);

    const { drawId, r } = await commitAndReveal();

    await expect(draw.connect(signers.alice).checkIfWon(drawId)).to.not.be.reverted;
    await expect(draw.connect(signers.bob).checkIfWon(drawId)).to.not.be.reverted;

    const alicePrize = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      await draw.connect(signers.alice).getPendingPrize(),
      drawAddress,
      signers.alice,
    );
    const bobPrize = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      await draw.connect(signers.bob).getPendingPrize(),
      drawAddress,
      signers.bob,
    );

    // Contiguous conceptual ranges: alice [0,100), bob [100,200). Exactly one winner.
    if (r < 100n) {
      expect(alicePrize).to.eq(BigInt(PRIZE));
      expect(bobPrize).to.eq(0n);
    } else {
      expect(alicePrize).to.eq(0n);
      expect(bobPrize).to.eq(BigInt(PRIZE));
    }
  });

  it("checkIfWon gas scales O(log n) with depositor count, not linearly", async function () {
    this.timeout(300_000);

    async function gasForLastChecker(n: number): Promise<bigint> {
      const local = await deployFixture();
      const users: HardhatEthersSigner[] = [signers.alice, signers.bob, ...extraSigners].slice(0, n);
      expect(users.length).to.eq(n);

      for (let i = 0; i < n; i++) {
        await syncWeight(local.tickets, local.ticketsAddress, users[i], 10);
      }

      const { drawId } = await commitAndReveal(local.tickets, local.draw);
      const checker = users[n - 1];
      const tx = await local.draw.connect(checker).checkIfWon(drawId);
      const receipt = await tx.wait();
      return receipt!.gasUsed;
    }

    const gasSmall = await gasForLastChecker(4);
    const gasLarge = await gasForLastChecker(16);

    // Linear scaling would be ~4x. Fenwick O(log n): log2(16)/log2(4) = 2, plus fixed overhead.
    expect(gasLarge).to.be.lt(gasSmall * 3n);
  });

  it("draw randomness cannot be predicted or manipulated by whoever commits the block", async function () {
    this.timeout(120_000);

    await syncWeight(tickets, ticketsAddress, signers.alice, 100);

    const now = await ethers.provider.getBlockNumber();
    await expect(draw.commitDraw(now, PRIZE)).to.be.revertedWithCustomError(draw, "InvalidRevealBlock");
    await expect(draw.commitDraw(now + 1, PRIZE)).to.be.revertedWithCustomError(draw, "InvalidRevealBlock");

    const target = now + 5;
    await (await draw.commitDraw(target, PRIZE)).wait();

    // Cannot reveal early — committer cannot grind a favorable hash immediately.
    await expect(draw.revealDraw(100, "0x")).to.be.revertedWithCustomError(draw, "RevealTooEarly");

    while ((await ethers.provider.getBlockNumber()) <= target) {
      await ethers.provider.send("evm_mine", []);
    }

    const handle = await tickets.totalTickets();
    const result = await fhevm.publicDecrypt([handle]);
    const total = result.clearValues[handle] as bigint;

    // Forged total / empty proof must not finalize r.
    await expect(draw.revealDraw(1, "0x")).to.be.reverted;

    await (await draw.revealDraw(total, result.decryptionProof)).wait();
    const r = await draw.drawRandomValue();
    expect(r).to.be.lt(total);

    const hist = await ethers.provider.getBlock(target);
    const expected = BigInt(hist!.hash!) % total;
    expect(r).to.eq(expected);

    // After the 256-block window, reveal is rejected (hash unavailable).
    const late = await deployFixture();
    await syncWeight(late.tickets, late.ticketsAddress, signers.alice, 100);
    const lateTarget = (await ethers.provider.getBlockNumber()) + 3;
    await (await late.draw.commitDraw(lateTarget, PRIZE)).wait();
    for (let i = 0; i < 260; i++) {
      await ethers.provider.send("evm_mine", []);
    }
    const lateHandle = await late.tickets.totalTickets();
    const lateResult = await fhevm.publicDecrypt([lateHandle]);
    const lateTotal = lateResult.clearValues[lateHandle] as bigint;
    await expect(late.draw.revealDraw(lateTotal, lateResult.decryptionProof)).to.be.revertedWithCustomError(
      late.draw,
      "RevealTooLate",
    );
  });

  it("hasChecked prevents a second checkIfWon for the same draw", async function () {
    await syncWeight(tickets, ticketsAddress, signers.alice, 100);
    const { drawId } = await commitAndReveal();

    await (await draw.connect(signers.alice).checkIfWon(drawId)).wait();
    await expect(draw.connect(signers.alice).checkIfWon(drawId)).to.be.revertedWithCustomError(
      draw,
      "AlreadyChecked",
    );
  });
});
