import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";

import { ConfidentialVault, ConfidentialVault__factory, MockERC7984, MockERC7984__factory, TicketEngine, TicketEngine__factory } from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const tokenFactory = (await ethers.getContractFactory("MockERC7984")) as MockERC7984__factory;
  const token = (await tokenFactory.deploy()) as MockERC7984;
  const tokenAddress = await token.getAddress();

  const vaultFactory = (await ethers.getContractFactory("ConfidentialVault")) as ConfidentialVault__factory;
  const vault = (await vaultFactory.deploy(tokenAddress)) as ConfidentialVault;
  const vaultAddress = await vault.getAddress();

  return { token, tokenAddress, vault, vaultAddress };
}

async function encryptAmount(contractAddress: string, user: string, amount: number) {
  return fhevm.createEncryptedInput(contractAddress, user).add64(amount).encrypt();
}

describe("ConfidentialVault", function () {
  let signers: Signers;
  let token: MockERC7984;
  let tokenAddress: string;
  let vault: ConfidentialVault;
  let vaultAddress: string;

  const OPERATOR_UNTIL = 2n ** 48n - 1n;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("ConfidentialVault unit tests require the FHEVM mock environment");
      this.skip();
    }

    ({ token, tokenAddress, vault, vaultAddress } = await deployFixture());
  });

  async function mintAndApprove(user: HardhatEthersSigner, amount: number) {
    await (await token.mint(user.address, amount)).wait();
    await (await token.connect(user).setOperator(vaultAddress, OPERATOR_UNTIL)).wait();
  }

  async function decryptUserBalance(user: HardhatEthersSigner): Promise<bigint> {
    const handle = await vault.connect(user).getBalance();
    return fhevm.userDecryptEuint(FhevmType.euint64, handle, vaultAddress, user);
  }

  async function decryptUserTwab(user: HardhatEthersSigner): Promise<bigint> {
    const handle = await vault.connect(user).getTwab();
    return fhevm.userDecryptEuint(FhevmType.euint64, handle, vaultAddress, user);
  }

  async function decryptTokenBalance(user: HardhatEthersSigner): Promise<bigint> {
    const handle = await token.confidentialBalanceOf(user.address);
    return fhevm.userDecryptEuint(FhevmType.euint64, handle, tokenAddress, user);
  }

  it("reverts when constructed with the zero asset address", async function () {
    const vaultFactory = (await ethers.getContractFactory("ConfidentialVault")) as ConfidentialVault__factory;
    await expect(vaultFactory.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(
      vaultFactory,
      "InvalidAsset",
    );
  });

  it("deposits encrypted amount and updates balance + TWAB without emitting plaintext amounts", async function () {
    const depositAmount = 1_000_000;
    await mintAndApprove(signers.alice, depositAmount);

    const encrypted = await encryptAmount(vaultAddress, signers.alice.address, depositAmount);

    await expect(vault.connect(signers.alice).deposit(encrypted.handles[0], encrypted.inputProof))
      .to.emit(vault, "Deposited")
      .withArgs(signers.alice.address);

    expect(await decryptUserBalance(signers.alice)).to.eq(BigInt(depositAmount));
    // Immediate deposit: TWAB equals current balance.
    expect(await decryptUserTwab(signers.alice)).to.eq(BigInt(depositAmount));
    expect(await decryptTokenBalance(signers.alice)).to.eq(0n);
  });

  it("withdraws principal at any time with no lockup", async function () {
    const depositAmount = 2_000_000;
    const withdrawAmount = 750_000;
    await mintAndApprove(signers.alice, depositAmount);

    const depositEnc = await encryptAmount(vaultAddress, signers.alice.address, depositAmount);
    await (await vault.connect(signers.alice).deposit(depositEnc.handles[0], depositEnc.inputProof)).wait();

    // Advance time to prove withdraw is not gated by any draw / period boundary.
    await time.increase(7 * 24 * 60 * 60);

    const withdrawEnc = await encryptAmount(vaultAddress, signers.alice.address, withdrawAmount);
    await expect(vault.connect(signers.alice).withdraw(withdrawEnc.handles[0], withdrawEnc.inputProof))
      .to.emit(vault, "Withdrawn")
      .withArgs(signers.alice.address);

    expect(await decryptUserBalance(signers.alice)).to.eq(BigInt(depositAmount - withdrawAmount));
    expect(await decryptTokenBalance(signers.alice)).to.eq(BigInt(withdrawAmount));
  });

  it("transfers zero and keeps balance when withdraw exceeds encrypted balance", async function () {
    const depositAmount = 100_000;
    await mintAndApprove(signers.alice, depositAmount);

    const depositEnc = await encryptAmount(vaultAddress, signers.alice.address, depositAmount);
    await (await vault.connect(signers.alice).deposit(depositEnc.handles[0], depositEnc.inputProof)).wait();

    const oversized = await encryptAmount(vaultAddress, signers.alice.address, depositAmount * 2);
    await expect(vault.connect(signers.alice).withdraw(oversized.handles[0], oversized.inputProof)).to.not.be
      .reverted;

    expect(await decryptUserBalance(signers.alice)).to.eq(BigInt(depositAmount));
    expect(await decryptTokenBalance(signers.alice)).to.eq(0n);
  });

  it("accrues TWAB over time as a time-weighted average of balance", async function () {
    const firstDeposit = 1_000_000;
    await mintAndApprove(signers.alice, firstDeposit * 2);

    const firstEnc = await encryptAmount(vaultAddress, signers.alice.address, firstDeposit);
    await (await vault.connect(signers.alice).deposit(firstEnc.handles[0], firstEnc.inputProof)).wait();

    const firstTs = await vault.lastUpdateOf(signers.alice.address);
    await time.increaseTo(firstTs + 100n);

    const secondEnc = await encryptAmount(vaultAddress, signers.alice.address, firstDeposit);
    await (await vault.connect(signers.alice).deposit(secondEnc.handles[0], secondEnc.inputProof)).wait();

    // After 100s at 1_000_000 then an instantaneous bump to 2_000_000,
    // TWAB should still equal 1_000_000 (weighted entirely by the prior window).
    expect(await decryptUserTwab(signers.alice)).to.eq(BigInt(firstDeposit));
    expect(await decryptUserBalance(signers.alice)).to.eq(BigInt(firstDeposit * 2));
  });

  it("isolates balances across depositors", async function () {
    const aliceAmount = 500_000;
    const bobAmount = 250_000;
    await mintAndApprove(signers.alice, aliceAmount);
    await mintAndApprove(signers.bob, bobAmount);

    const aliceEnc = await encryptAmount(vaultAddress, signers.alice.address, aliceAmount);
    const bobEnc = await encryptAmount(vaultAddress, signers.bob.address, bobAmount);

    await (await vault.connect(signers.alice).deposit(aliceEnc.handles[0], aliceEnc.inputProof)).wait();
    await (await vault.connect(signers.bob).deposit(bobEnc.handles[0], bobEnc.inputProof)).wait();

    expect(await decryptUserBalance(signers.alice)).to.eq(BigInt(aliceAmount));
    expect(await decryptUserBalance(signers.bob)).to.eq(BigInt(bobAmount));
  });

  it("reverts when setTicketEngine is called with the zero address", async function () {
    await expect(vault.setTicketEngine(ethers.ZeroAddress)).to.be.revertedWithCustomError(
      vault,
      "InvalidTicketEngine",
    );
  });

  it("withdraws successfully while TicketEngine is frozen; weight sync lags until unfreeze", async function () {
    const ticketFactory = (await ethers.getContractFactory("TicketEngine")) as TicketEngine__factory;
    const tickets = (await ticketFactory.deploy(vaultAddress)) as TicketEngine;
    const ticketsAddress = await tickets.getAddress();

    await (await vault.setTicketEngine(ticketsAddress)).wait();
    await (await tickets.setDrawManager(signers.deployer.address)).wait();

    const depositAmount = 1_000_000;
    const withdrawAmount = 250_000;
    await mintAndApprove(signers.alice, depositAmount);

    const depositEnc = await encryptAmount(vaultAddress, signers.alice.address, depositAmount);
    await (await vault.connect(signers.alice).deposit(depositEnc.handles[0], depositEnc.inputProof)).wait();

    const index = await tickets.indexOf(signers.alice.address);
    expect(index).to.eq(1n);

    const weightAfterDeposit = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      await tickets.getWeight(index),
      ticketsAddress,
      signers.alice,
    );
    expect(weightAfterDeposit).to.eq(BigInt(depositAmount));

    // Freeze ticket weights for an active draw — vault withdraw must still succeed.
    await (await tickets.connect(signers.deployer).setFrozen(true)).wait();

    const withdrawEnc = await encryptAmount(vaultAddress, signers.alice.address, withdrawAmount);
    await expect(vault.connect(signers.alice).withdraw(withdrawEnc.handles[0], withdrawEnc.inputProof)).to.not.be
      .reverted;

    expect(await decryptUserBalance(signers.alice)).to.eq(BigInt(depositAmount - withdrawAmount));
    expect(await decryptTokenBalance(signers.alice)).to.eq(BigInt(withdrawAmount));

    // Ticket weight lagged: still the pre-withdraw TWAB while frozen.
    const weightWhileFrozen = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      await tickets.getWeight(index),
      ticketsAddress,
      signers.alice,
    );
    expect(weightWhileFrozen).to.eq(BigInt(depositAmount));

    // After freeze lifts, the next vault action syncs the lagged TWAB (not raw balance).
    await (await tickets.connect(signers.deployer).setFrozen(false)).wait();
    const catchUpEnc = await encryptAmount(vaultAddress, signers.alice.address, 0);
    await (await vault.connect(signers.alice).withdraw(catchUpEnc.handles[0], catchUpEnc.inputProof)).wait();

    const twabAfterUnfreeze = await decryptUserTwab(signers.alice);
    const weightAfterUnfreeze = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      await tickets.getWeight(index),
      ticketsAddress,
      signers.alice,
    );
    expect(weightAfterUnfreeze).to.eq(twabAfterUnfreeze);
    expect(weightAfterUnfreeze).to.not.eq(BigInt(depositAmount));
  });
});
