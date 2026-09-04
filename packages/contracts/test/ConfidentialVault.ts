import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";

import { ConfidentialVault__factory } from "../types";
import {
  decryptTokenBalance,
  decryptUserValue,
  deploySystem,
  deposit,
  encryptAmount,
  publicDecrypt,
  SystemFixture,
  withdraw,
} from "./helpers";

describe("ConfidentialVault", function () {
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

  async function userBalance(user: HardhatEthersSigner): Promise<bigint> {
    return decryptUserValue(await fixture.vault.connect(user).getBalance(), fixture.vaultAddress, user);
  }

  async function userTwab(user: HardhatEthersSigner): Promise<bigint> {
    return decryptUserValue(await fixture.vault.connect(user).getTwab(), fixture.vaultAddress, user);
  }

  async function totalDeposits(): Promise<bigint> {
    return (await publicDecrypt(await fixture.vault.totalDeposits())).clear;
  }

  it("rejects zero-address dependencies and protects TicketEngine configuration", async function () {
    const factory = (await ethers.getContractFactory("ConfidentialVault")) as ConfidentialVault__factory;
    await expect(factory.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(factory, "InvalidAsset");
    await expect(fixture.vault.setTicketEngine(ethers.ZeroAddress)).to.be.revertedWithCustomError(
      fixture.vault,
      "InvalidTicketEngine",
    );
    expect(await fixture.vault.ticketEngine()).to.eq(fixture.ticketsAddress);
    expect(await fixture.vault.owner()).to.eq(deployer.address);
  });

  it("deposits encrypted principal and exposes only wallet-authorized balances", async function () {
    const amount = 1_000_000;

    await (await fixture.token.mint(alice.address, amount)).wait();
    const encrypted = await encryptAmount(fixture.vaultAddress, alice.address, amount);
    await (await fixture.token.connect(alice).setOperator(fixture.vaultAddress, 2n ** 48n - 1n)).wait();
    await expect(fixture.vault.connect(alice).deposit(encrypted.handles[0], encrypted.inputProof))
      .to.emit(fixture.vault, "Deposited")
      .withArgs(alice.address);

    expect(await userBalance(alice)).to.eq(BigInt(amount));
    expect(await userTwab(alice)).to.eq(BigInt(amount));
    expect(await decryptTokenBalance(fixture, alice)).to.eq(0n);

    const aliceHandle = await fixture.vault.getBalanceOf(alice.address);
    let denied = false;
    try {
      await decryptUserValue(aliceHandle, fixture.vaultAddress, bob);
    } catch {
      denied = true;
    }
    expect(denied).to.eq(true);
  });

  it("withdraws encrypted principal immediately and keeps TVL exact", async function () {
    const aliceDeposit = 2_000_000;
    const bobDeposit = 400_000;
    const withdrawn = 750_000;
    await deposit(fixture, alice, aliceDeposit);
    await deposit(fixture, bob, bobDeposit);

    expect(await totalDeposits()).to.eq(BigInt(aliceDeposit + bobDeposit));
    await time.increase(1);

    const encrypted = await encryptAmount(fixture.vaultAddress, alice.address, withdrawn);
    await expect(fixture.vault.connect(alice).withdraw(encrypted.handles[0], encrypted.inputProof))
      .to.emit(fixture.vault, "Withdrawn")
      .withArgs(alice.address);

    expect(await userBalance(alice)).to.eq(BigInt(aliceDeposit - withdrawn));
    expect(await decryptTokenBalance(fixture, alice)).to.eq(BigInt(withdrawn));
    expect(await totalDeposits()).to.eq(BigInt(aliceDeposit + bobDeposit - withdrawn));
  });

  it("turns an oversized encrypted withdrawal into a zero-value no-op", async function () {
    const amount = 100_000;
    await deposit(fixture, alice, amount);

    await withdraw(fixture, alice, amount + 1);
    expect(await userBalance(alice)).to.eq(BigInt(amount));
    expect(await decryptTokenBalance(fixture, alice)).to.eq(0n);
    expect(await totalDeposits()).to.eq(BigInt(amount));
  });

  it("updates cumulative-balance observations without mixing depositor state", async function () {
    await deposit(fixture, alice, 1_000_000);
    const firstCheckpoint = await fixture.vault.lastUpdateOf(alice.address);
    await time.increaseTo(firstCheckpoint + 100n);
    await deposit(fixture, alice, 1_000_000);
    await deposit(fixture, bob, 250_000);

    expect(await userTwab(alice)).to.eq(1_000_000n);
    expect(await userBalance(alice)).to.eq(2_000_000n);
    expect(await userBalance(bob)).to.eq(250_000n);
    expect(await fixture.tickets.indexOf(alice.address)).to.eq(1n);
    expect(await fixture.tickets.indexOf(bob.address)).to.eq(2n);
  });

  it("emits no plaintext amount fields for vault actions", async function () {
    for (const name of ["Deposited", "Withdrawn"] as const) {
      const event = fixture.vault.interface.getEvent(name);
      expect(event.inputs.map((input) => input.name)).to.deep.eq(["account"]);
    }
  });
});
