import { FhevmType } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";

import {
  ConfidentialVault,
  ConfidentialVault__factory,
  DrawManager,
  DrawManager__factory,
  MockERC7984,
  MockERC7984__factory,
  PrizePool,
  PrizePool__factory,
  TicketEngine,
  TicketEngine__factory,
} from "../types";

export const OPERATOR_UNTIL = 2n ** 48n - 1n;

export type SystemFixture = {
  token: MockERC7984;
  tokenAddress: string;
  vault: ConfidentialVault;
  vaultAddress: string;
  tickets: TicketEngine;
  ticketsAddress: string;
  prizePool: PrizePool;
  prizePoolAddress: string;
  draw: DrawManager;
  drawAddress: string;
};

export async function deploySystem(
  shares: [number, number, number] = [6_000, 2_000, 1_000],
  slots: [number, number, number] = [1, 2, 3],
  reserveShares = 1_000,
): Promise<SystemFixture> {
  const tokenFactory = (await ethers.getContractFactory("MockERC7984")) as MockERC7984__factory;
  const token = (await tokenFactory.deploy()) as MockERC7984;
  const tokenAddress = await token.getAddress();

  const ticketFactory = (await ethers.getContractFactory("TicketEngine")) as TicketEngine__factory;
  const tickets = (await ticketFactory.deploy(ethers.ZeroAddress)) as TicketEngine;
  const ticketsAddress = await tickets.getAddress();

  const vaultFactory = (await ethers.getContractFactory("ConfidentialVault")) as ConfidentialVault__factory;
  const vault = (await vaultFactory.deploy(tokenAddress)) as ConfidentialVault;
  const vaultAddress = await vault.getAddress();

  // DrawManager validates this immutable relationship in its constructor.
  await (await tickets.setVault(vaultAddress)).wait();

  const poolFactory = (await ethers.getContractFactory("PrizePool")) as PrizePool__factory;
  const prizePool = (await poolFactory.deploy(tokenAddress, shares, slots, reserveShares)) as PrizePool;
  const prizePoolAddress = await prizePool.getAddress();

  const drawFactory = (await ethers.getContractFactory("DrawManager")) as DrawManager__factory;
  const draw = (await drawFactory.deploy(ticketsAddress, vaultAddress, prizePoolAddress)) as DrawManager;
  const drawAddress = await draw.getAddress();

  await (await vault.setTicketEngine(ticketsAddress)).wait();
  await (await tickets.setDrawManager(drawAddress)).wait();
  await (await prizePool.setDrawManager(drawAddress)).wait();

  return {
    token,
    tokenAddress,
    vault,
    vaultAddress,
    tickets,
    ticketsAddress,
    prizePool,
    prizePoolAddress,
    draw,
    drawAddress,
  };
}

export async function encryptAmount(contractAddress: string, user: string, amount: bigint | number) {
  return fhevm.createEncryptedInput(contractAddress, user).add64(amount).encrypt();
}

export async function deposit(fixture: SystemFixture, user: HardhatEthersSigner, amount: number): Promise<number> {
  await (await fixture.token.mint(user.address, amount)).wait();
  await (await fixture.token.connect(user).setOperator(fixture.vaultAddress, OPERATOR_UNTIL)).wait();
  const encrypted = await encryptAmount(fixture.vaultAddress, user.address, amount);
  const receipt = await (await fixture.vault.connect(user).deposit(encrypted.handles[0], encrypted.inputProof)).wait();
  const block = await ethers.provider.getBlock(receipt!.blockNumber);
  return block!.timestamp;
}

export async function withdraw(fixture: SystemFixture, user: HardhatEthersSigner, amount: number): Promise<void> {
  const encrypted = await encryptAmount(fixture.vaultAddress, user.address, amount);
  await (await fixture.vault.connect(user).withdraw(encrypted.handles[0], encrypted.inputProof)).wait();
}

export async function decryptUserValue(
  handle: string,
  contractAddress: string,
  user: HardhatEthersSigner,
): Promise<bigint> {
  return fhevm.userDecryptEuint(FhevmType.euint64, handle, contractAddress, user);
}

export async function decryptTokenBalance(fixture: SystemFixture, user: HardhatEthersSigner): Promise<bigint> {
  const handle = await fixture.token.confidentialBalanceOf(user.address);
  return decryptUserValue(handle, fixture.tokenAddress, user);
}

export async function publicDecrypt(handle: string): Promise<{ clear: bigint; proof: string }> {
  const typedHandle = handle as `0x${string}`;
  const result = await fhevm.publicDecrypt([typedHandle]);
  return {
    clear: result.clearValues[typedHandle] as bigint,
    proof: result.decryptionProof,
  };
}

export async function synchronizePrizeLiquidity(
  fixture: SystemFixture,
  sponsor: HardhatEthersSigner,
  contribution: number,
): Promise<void> {
  await (await fixture.token.mint(sponsor.address, contribution)).wait();
  await (await fixture.token.connect(sponsor).setOperator(fixture.prizePoolAddress, OPERATOR_UNTIL)).wait();
  await (await fixture.prizePool.connect(sponsor).contribute(contribution)).wait();

  await (await fixture.prizePool.prepareLiquidity()).wait();
  const handle = await fixture.prizePool.liquidityBalanceHandle();
  const liquidity = await publicDecrypt(handle);
  await (await fixture.prizePool.finalizeLiquidity(liquidity.clear, liquidity.proof)).wait();
}

export async function closeDraw(fixture: SystemFixture): Promise<{ id: bigint; totalScore: bigint; proof: string }> {
  await (await fixture.draw.closeDraw()).wait();
  const handle = await fixture.tickets.preparedTotal();
  const decrypted = await publicDecrypt(handle);
  return { id: await fixture.draw.drawId(), totalScore: decrypted.clear, proof: decrypted.proof };
}

export async function awardDraw(
  fixture: SystemFixture,
  closed: { id: bigint; totalScore: bigint; proof: string },
): Promise<void> {
  await (await fixture.draw.awardDraw(closed.id, closed.totalScore, closed.proof)).wait();
}

export async function closeAndAward(fixture: SystemFixture): Promise<{ id: bigint; totalScore: bigint }> {
  const closed = await closeDraw(fixture);
  await awardDraw(fixture, closed);
  return { id: closed.id, totalScore: closed.totalScore };
}

export async function decryptPendingPrize(
  fixture: SystemFixture,
  user: HardhatEthersSigner,
  drawId: bigint,
  tier: number,
  slot: number,
): Promise<bigint> {
  const handle = await fixture.draw.connect(user).getPendingPrize(drawId, tier, slot);
  return decryptUserValue(handle, fixture.drawAddress, user);
}
