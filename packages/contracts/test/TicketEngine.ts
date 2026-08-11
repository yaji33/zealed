import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";

import {
  TicketEngine,
  TicketEngine__factory,
} from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployTickets() {
  const ticketFactory = (await ethers.getContractFactory("TicketEngine")) as TicketEngine__factory;
  const tickets = (await ticketFactory.deploy(ethers.ZeroAddress)) as TicketEngine;
  const ticketsAddress = await tickets.getAddress();
  return { tickets, ticketsAddress };
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

describe("TicketEngine", function () {
  let signers: Signers;
  let tickets: TicketEngine;
  let ticketsAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("TicketEngine unit tests require the FHEVM mock environment");
      this.skip();
    }
    ({ tickets, ticketsAddress } = await deployTickets());
  });

  it("assigns permanent 1-based indices that are never reused", async function () {
    await syncWeight(tickets, ticketsAddress, signers.alice, 100);
    await syncWeight(tickets, ticketsAddress, signers.bob, 50);

    expect(await tickets.indexOf(signers.alice.address)).to.eq(1n);
    expect(await tickets.indexOf(signers.bob.address)).to.eq(2n);
    expect(await tickets.nextIndex()).to.eq(3n);

    await syncWeight(tickets, ticketsAddress, signers.alice, 120);
    expect(await tickets.indexOf(signers.alice.address)).to.eq(1n);
    expect(await tickets.nextIndex()).to.eq(3n);
  });

  it("stores per-slot weights and leaves other users' slots unchanged on update", async function () {
    await syncWeight(tickets, ticketsAddress, signers.alice, 100);
    await syncWeight(tickets, ticketsAddress, signers.bob, 50);
    await syncWeight(tickets, ticketsAddress, signers.alice, 80);

    const aliceW = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      await tickets.getWeight(1),
      ticketsAddress,
      signers.alice,
    );
    const bobW = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      await tickets.getWeight(2),
      ticketsAddress,
      signers.bob,
    );

    expect(aliceW).to.eq(80n);
    expect(bobW).to.eq(50n);
    expect(await tickets.indexOf(signers.bob.address)).to.eq(2n);
  });

  it("rejects self-service syncWeight while frozen", async function () {
    await (await tickets.setDrawManager(signers.deployer.address)).wait();

    await syncWeight(tickets, ticketsAddress, signers.alice, 100);
    await (await tickets.connect(signers.deployer).setFrozen(true)).wait();

    await expect(syncWeight(tickets, ticketsAddress, signers.alice, 120)).to.be.revertedWithCustomError(
      tickets,
      "WeightsFrozen",
    );
  });
});
