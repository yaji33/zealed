import { ethers, run } from "hardhat";
import * as fs from "node:fs";
import * as path from "node:path";

/** Resume a partial Sepolia deploy after vault/tickets/prize pool already landed. */
async function main() {
  const [deployer] = await ethers.getSigners();
  const asset = (process.env.CUSDC_ADDRESS ?? "0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639") as `0x${string}`;
  const vaultAddress = process.env.RESUME_VAULT ?? "0x4C485B921aDaC7662916868154d070f9C20cf8C5";
  const ticketsAddress = process.env.RESUME_TICKETS ?? "0xbf8b12f8c562bB24b0e62B070d91B49c7dA9BF3B";
  const prizePoolAddress = process.env.RESUME_PRIZE_POOL ?? "0x773B31a927FB8B91ebEF341f754d5Fe53491B2E8";

  console.log("Resuming DrawManager deploy", { deployer: deployer.address, vaultAddress, ticketsAddress, prizePoolAddress });

  const Draw = await ethers.getContractFactory("DrawManager");
  const draw = await Draw.deploy(ticketsAddress, vaultAddress, prizePoolAddress);
  await draw.waitForDeployment();
  const drawAddress = await draw.getAddress();
  console.log("DrawManager:", drawAddress);

  const vault = await ethers.getContractAt("ConfidentialVault", vaultAddress, deployer);
  const tickets = await ethers.getContractAt("TicketEngine", ticketsAddress, deployer);
  const prizePool = await ethers.getContractAt("PrizePool", prizePoolAddress, deployer);

  if ((await vault.ticketEngine()) === ethers.ZeroAddress) {
    await (await vault.setTicketEngine(ticketsAddress)).wait();
  }
  if ((await tickets.drawManager()) === ethers.ZeroAddress) {
    await (await tickets.setDrawManager(drawAddress)).wait();
  }
  if ((await prizePool.drawManager()) === ethers.ZeroAddress) {
    await (await prizePool.setDrawManager(drawAddress)).wait();
  }
  if ((await tickets.vault()).toLowerCase() !== vaultAddress.toLowerCase()) {
    await (await tickets.setVault(vaultAddress)).wait();
  }

  try {
    await (await vault.renounceOwnership()).wait();
  } catch {
    console.log("vault ownership already renounced or unavailable");
  }
  try {
    await (await tickets.renounceOwnership()).wait();
  } catch {
    console.log("ticket ownership already renounced or unavailable");
  }
  try {
    await (await prizePool.renounceOwnership()).wait();
  } catch {
    console.log("prize pool ownership already renounced or unavailable");
  }

  const deployment = {
    network: "sepolia",
    chainId: 11155111,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    asset,
    contracts: {
      ConfidentialVault: vaultAddress,
      TicketEngine: ticketsAddress,
      PrizePool: prizePoolAddress,
      DrawManager: drawAddress,
    },
  };
  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "sepolia.json"), JSON.stringify(deployment, null, 2) + "\n");
  console.log(JSON.stringify(deployment, null, 2));

  if (process.env.VERIFY_CONTRACTS !== "0") {
    const targets = [
      { address: vaultAddress, constructorArguments: [asset] },
      { address: ticketsAddress, constructorArguments: [vaultAddress] },
      {
        address: prizePoolAddress,
        constructorArguments: [asset, [5_000, 3_000, 1_500], [1, 2, 4], 500],
      },
      {
        address: drawAddress,
        constructorArguments: [ticketsAddress, vaultAddress, prizePoolAddress],
      },
    ];
    for (const target of targets) {
      try {
        await run("verify:verify", target);
        console.log("verified", target.address);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.toLowerCase().includes("already verified")) throw error;
        console.log("already verified", target.address);
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
