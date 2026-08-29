import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";

import {
  ConfidentialVault,
  ConfidentialVault__factory,
  DrawManager,
  DrawManager__factory,
  MockERC7984,
  MockERC7984__factory,
  TicketEngine,
  TicketEngine__factory,
} from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

const OPERATOR_UNTIL = 2n ** 48n - 1n;
/** Vault TVL used for demo yield: 100 cUSDC → first-commit prize = 1 cUSDC. */
const TVL = 100_000_000;
const EXPECTED_FIRST_PRIZE = 1_000_000n;

type Fixture = {
  token: MockERC7984;
  tokenAddress: string;
  vault: ConfidentialVault;
  vaultAddress: string;
  tickets: TicketEngine;
  ticketsAddress: string;
  draw: DrawManager;
  drawAddress: string;
};

async function deployFixture(): Promise<Fixture> {
  const tokenFactory = (await ethers.getContractFactory("MockERC7984")) as MockERC7984__factory;
  const token = (await tokenFactory.deploy()) as MockERC7984;
  const tokenAddress = await token.getAddress();

  const vaultFactory = (await ethers.getContractFactory("ConfidentialVault")) as ConfidentialVault__factory;
  const vault = (await vaultFactory.deploy(tokenAddress)) as ConfidentialVault;
  const vaultAddress = await vault.getAddress();

  const ticketFactory = (await ethers.getContractFactory("TicketEngine")) as TicketEngine__factory;
  const tickets = (await ticketFactory.deploy(vaultAddress)) as TicketEngine;
  const ticketsAddress = await tickets.getAddress();

  const drawFactory = (await ethers.getContractFactory("DrawManager")) as DrawManager__factory;
  const draw = (await drawFactory.deploy(ticketsAddress, vaultAddress)) as DrawManager;
  const drawAddress = await draw.getAddress();

  await (await vault.setTicketEngine(ticketsAddress)).wait();
  await (await tickets.setDrawManager(drawAddress)).wait();

  return { token, tokenAddress, vault, vaultAddress, tickets, ticketsAddress, draw, drawAddress };
}

async function encryptWeight(ticketsAddress: string, user: string, weight: number) {
  return fhevm.createEncryptedInput(ticketsAddress, user).add64(weight).encrypt();
}

async function encryptAmount(contractAddress: string, user: string, amount: number) {
  return fhevm.createEncryptedInput(contractAddress, user).add64(amount).encrypt();
}

describe("DrawManager", function () {
  let signers: Signers;
  let token: MockERC7984;
  let tokenAddress: string;
  let vault: ConfidentialVault;
  let vaultAddress: string;
  let tickets: TicketEngine;
  let ticketsAddress: string;
  let draw: DrawManager;
  let drawAddress: string;
  let extraSigners: HardhatEthersSigner[];

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
    ({ token, tokenAddress, vault, vaultAddress, tickets, ticketsAddress, draw, drawAddress } =
      await deployFixture());
    await seedVaultAndKeeper(signers.deployer, TVL);
  });

  async function seedVaultAndKeeper(keeper: HardhatEthersSigner, tvl: number, fixture?: Fixture) {
    const t = fixture?.token ?? token;
    const tAddr = fixture?.tokenAddress ?? tokenAddress;
    const v = fixture?.vault ?? vault;
    const vAddr = fixture?.vaultAddress ?? vaultAddress;
    const dAddr = fixture?.drawAddress ?? drawAddress;

    // Alice holds the vault principal (TVL); keeper holds enough to fund the pot.
    await (await t.mint(signers.alice.address, tvl)).wait();
    await (await t.connect(signers.alice).setOperator(vAddr, OPERATOR_UNTIL)).wait();
    const enc = await encryptAmount(vAddr, signers.alice.address, tvl);
    await (await v.connect(signers.alice).deposit(enc.handles[0], enc.inputProof)).wait();

    await (await t.mint(keeper.address, tvl)).wait();
    await (await t.connect(keeper).setOperator(dAddr, OPERATOR_UNTIL)).wait();
  }

  async function syncWeight(
    engine: TicketEngine,
    engineAddress: string,
    user: HardhatEthersSigner,
    weight: number,
  ) {
    const enc = await encryptWeight(engineAddress, user.address, weight);
    await (await engine.connect(user).syncWeight(user.address, enc.handles[0], enc.inputProof)).wait();
  }

  async function decryptTokenBalance(user: HardhatEthersSigner, tAddr = tokenAddress): Promise<bigint> {
    const handle = await token.confidentialBalanceOf(user.address);
    return fhevm.userDecryptEuint(FhevmType.euint64, handle, tAddr, user);
  }

  async function tvlProof(v: ConfidentialVault = vault): Promise<{ clear: bigint; proof: string }> {
    const handle = await v.totalDeposits();
    const result = await fhevm.publicDecrypt([handle]);
    return {
      clear: result.clearValues[handle] as bigint,
      proof: result.decryptionProof,
    };
  }

  async function commitDraw(
    manager: DrawManager = draw,
    v: ConfidentialVault = vault,
    revealExtra = 1,
  ): Promise<{ target: number; prize: bigint }> {
    const delay = Number(await manager.MIN_REVEAL_DELAY());
    const target = (await ethers.provider.getBlockNumber()) + delay + revealExtra;
    const { clear, proof } = await tvlProof(v);
    await (await manager.commitDraw(target, clear, proof)).wait();
    return { target, prize: await manager.prizeAmountPlain() };
  }

  async function commitAndReveal(
    engine: TicketEngine = tickets,
    manager: DrawManager = draw,
    v: ConfidentialVault = vault,
  ): Promise<{ drawId: bigint; r: bigint; total: bigint; prize: bigint }> {
    const { target, prize } = await commitDraw(manager, v);

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
      prize,
    };
  }

  it("computes first-commit prize as ~1% of TVL over MIN_DRAW_INTERVAL", async function () {
    await syncWeight(tickets, ticketsAddress, signers.alice, 100);
    const { prize } = await commitDraw();
    expect(prize).to.eq(EXPECTED_FIRST_PRIZE);
    expect(await draw.prizeOfDraw(1n)).to.eq(EXPECTED_FIRST_PRIZE);
  });

  it("scales prize with TVL and elapsed time between commits", async function () {
    await syncWeight(tickets, ticketsAddress, signers.alice, 100);
    await commitAndReveal();

    const last = await draw.lastCommitTimestamp();
    const interval = Number(await draw.MIN_DRAW_INTERVAL());
    await ethers.provider.send("evm_increaseTime", [interval * 2]);
    await ethers.provider.send("evm_mine", []);

    // Refill keeper pot for the next commit.
    await (await token.mint(signers.deployer.address, Number(EXPECTED_FIRST_PRIZE * 3n))).wait();

    const { prize } = await commitDraw();
    const committedAt = await draw.lastCommitTimestamp();
    const expected = (BigInt(TVL) * (committedAt - last)) / 120_000n;
    expect(prize).to.eq(expected);
    expect(prize).to.be.gt(EXPECTED_FIRST_PRIZE);
  });

  it("a user outside the drawn range receives a zero prize, not a revert", async function () {
    await syncWeight(tickets, ticketsAddress, signers.alice, 100);
    await syncWeight(tickets, ticketsAddress, signers.bob, 100);

    const { drawId, r, prize } = await commitAndReveal();

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
      expect(alicePrize).to.eq(prize);
      expect(bobPrize).to.eq(0n);
    } else {
      expect(alicePrize).to.eq(0n);
      expect(bobPrize).to.eq(prize);
    }
  });

  it("claim pays winner cUSDC; loser claim succeeds with zero; no double claim", async function () {
    await syncWeight(tickets, ticketsAddress, signers.alice, 100);
    await syncWeight(tickets, ticketsAddress, signers.bob, 100);

    const { drawId, r, prize } = await commitAndReveal();
    await (await draw.connect(signers.alice).checkIfWon(drawId)).wait();
    await (await draw.connect(signers.bob).checkIfWon(drawId)).wait();

    const winner = r < 100n ? signers.alice : signers.bob;
    const loser = r < 100n ? signers.bob : signers.alice;

    // Seed token balances so confidentialBalanceOf handles are initialized.
    await (await token.mint(winner.address, 1)).wait();
    await (await token.mint(loser.address, 1)).wait();
    const winnerBefore = await decryptTokenBalance(winner);
    const loserBefore = await decryptTokenBalance(loser);
    expect(winnerBefore).to.eq(1n);
    expect(loserBefore).to.eq(1n);

    await expect(draw.connect(winner).claim(drawId)).to.emit(draw, "PrizeClaimed").withArgs(drawId, winner.address);
    await expect(draw.connect(loser).claim(drawId)).to.emit(draw, "PrizeClaimed").withArgs(drawId, loser.address);

    expect(await decryptTokenBalance(winner)).to.eq(winnerBefore + prize);
    expect(await decryptTokenBalance(loser)).to.eq(loserBefore);

    await expect(draw.connect(winner).claim(drawId)).to.be.revertedWithCustomError(draw, "AlreadyClaimed");

    // Vault principal unchanged (Alice deposited TVL; claim pays from DrawManager pot).
    const vaultBal = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      await vault.connect(signers.alice).getBalance(),
      vaultAddress,
      signers.alice,
    );
    expect(vaultBal).to.eq(BigInt(TVL));
  });

  it("checkIfWon gas scales O(log n) with depositor count, not linearly", async function () {
    this.timeout(300_000);

    async function gasForLastChecker(n: number): Promise<bigint> {
      const local = await deployFixture();
      await seedVaultAndKeeper(signers.deployer, TVL, local);
      const users: HardhatEthersSigner[] = [signers.alice, signers.bob, ...extraSigners].slice(0, n);
      expect(users.length).to.eq(n);

      for (let i = 0; i < n; i++) {
        await syncWeight(local.tickets, local.ticketsAddress, users[i], 10);
      }

      const { drawId } = await commitAndReveal(local.tickets, local.draw, local.vault);
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
    const minDelay = Number(await draw.MIN_REVEAL_DELAY());
    const { clear, proof } = await tvlProof();

    await expect(draw.commitDraw(now, clear, proof)).to.be.revertedWithCustomError(draw, "InvalidRevealBlock");
    await expect(draw.commitDraw(now + 1, clear, proof)).to.be.revertedWithCustomError(draw, "InvalidRevealBlock");
    await expect(draw.commitDraw(now + minDelay - 1, clear, proof)).to.be.revertedWithCustomError(
      draw,
      "InvalidRevealBlock",
    );

    const target = (await ethers.provider.getBlockNumber()) + minDelay + 1;
    const tvl = await tvlProof();
    await (await draw.commitDraw(target, tvl.clear, tvl.proof)).wait();

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
    await seedVaultAndKeeper(signers.deployer, TVL, late);
    await syncWeight(late.tickets, late.ticketsAddress, signers.alice, 100);
    const lateDelay = Number(await late.draw.MIN_REVEAL_DELAY());
    const lateTarget = (await ethers.provider.getBlockNumber()) + lateDelay + 1;
    const lateTvl = await tvlProof(late.vault);
    await (await late.draw.commitDraw(lateTarget, lateTvl.clear, lateTvl.proof)).wait();
    // Exhaust the 256-block hash window past revealBlock (not just past commit).
    for (let i = 0; i < lateDelay + 260; i++) {
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

  it("enforces MIN_DRAW_INTERVAL between successive commits", async function () {
    await syncWeight(tickets, ticketsAddress, signers.alice, 100);
    await commitAndReveal();

    const delay = Number(await draw.MIN_REVEAL_DELAY());
    const tooSoon = (await ethers.provider.getBlockNumber()) + delay + 1;
    const tvlSoon = await tvlProof();
    await expect(draw.commitDraw(tooSoon, tvlSoon.clear, tvlSoon.proof)).to.be.revertedWithCustomError(
      draw,
      "DrawIntervalNotElapsed",
    );

    const interval = Number(await draw.MIN_DRAW_INTERVAL());
    await ethers.provider.send("evm_increaseTime", [interval]);
    await ethers.provider.send("evm_mine", []);

    await (await token.mint(signers.deployer.address, Number(EXPECTED_FIRST_PRIZE * 2n))).wait();

    const nextTarget = (await ethers.provider.getBlockNumber()) + delay + 1;
    const tvlNext = await tvlProof();
    await expect(draw.commitDraw(nextTarget, tvlNext.clear, tvlNext.proof)).to.not.be.reverted;
  });

  it("keeps weights frozen after reveal until unfreezeWeights", async function () {
    await syncWeight(tickets, ticketsAddress, signers.alice, 100);
    await commitAndReveal();
    expect(await tickets.frozen()).to.eq(true);

    await (await draw.unfreezeWeights()).wait();
    expect(await tickets.frozen()).to.eq(false);
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

  it("revealWin publishes tier without amount; losers and unchecked users cannot claim", async function () {
    await syncWeight(tickets, ticketsAddress, signers.alice, 100);
    await syncWeight(tickets, ticketsAddress, signers.bob, 100);

    const { drawId, r } = await commitAndReveal();
    await (await draw.connect(signers.alice).checkIfWon(drawId)).wait();
    await (await draw.connect(signers.bob).checkIfWon(drawId)).wait();

    const winner = r < 100n ? signers.alice : signers.bob;
    const loser = r < 100n ? signers.bob : signers.alice;

    // Unchecked third party cannot reveal.
    await expect(draw.connect(signers.deployer).revealWin(drawId, true, "0x")).to.be.revertedWithCustomError(
      draw,
      "NotChecked",
    );

    // Loser: valid public decrypt of false flag still cannot claim a win.
    const loserHandle = await draw.getWonFlag(drawId, loser.address);
    const loserDecrypt = await fhevm.publicDecrypt([loserHandle]);
    const loserClear = loserDecrypt.clearValues[loserHandle] as boolean;
    expect(loserClear).to.eq(false);
    await expect(
      draw.connect(loser).revealWin(drawId, false, loserDecrypt.decryptionProof),
    ).to.be.revertedWithCustomError(draw, "NotAWinner");
    await expect(draw.connect(loser).revealWin(drawId, true, "0x")).to.be.reverted;

    // Winner: opt-in reveal emits tier only (no amount).
    const winnerHandle = await draw.getWonFlag(drawId, winner.address);
    const winnerDecrypt = await fhevm.publicDecrypt([winnerHandle]);
    const winnerClear = winnerDecrypt.clearValues[winnerHandle] as boolean;
    expect(winnerClear).to.eq(true);

    await expect(draw.connect(winner).revealWin(drawId, true, winnerDecrypt.decryptionProof))
      .to.emit(draw, "WinRevealed")
      .withArgs(drawId, winner.address, 1);

    expect(await draw.winRevealed(drawId, winner.address)).to.eq(true);
    await expect(
      draw.connect(winner).revealWin(drawId, true, winnerDecrypt.decryptionProof),
    ).to.be.revertedWithCustomError(draw, "AlreadyWinRevealed");
  });

  it("reverts ZeroPrize when TVL decrypt is zero", async function () {
    const empty = await deployFixture();
    // Keeper approved but vault empty → tvlCleartext 0 → prize 0.
    await (await empty.token.mint(signers.deployer.address, 1_000_000)).wait();
    await (await empty.token.connect(signers.deployer).setOperator(empty.drawAddress, OPERATOR_UNTIL)).wait();

    // totalDeposits starts as publicly decryptable zero from vault constructor.
    const handle = await empty.vault.totalDeposits();
    const result = await fhevm.publicDecrypt([handle]);
    const clear = result.clearValues[handle] as bigint;
    expect(clear).to.eq(0n);

    const delay = Number(await empty.draw.MIN_REVEAL_DELAY());
    const target = (await ethers.provider.getBlockNumber()) + delay + 1;
    await expect(empty.draw.commitDraw(target, clear, result.decryptionProof)).to.be.revertedWithCustomError(
      empty.draw,
      "ZeroPrize",
    );
  });
});
