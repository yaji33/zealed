import { ethers, run } from "hardhat";
import * as fs from "node:fs";
import * as path from "node:path";

/** Zama protocol-apps Sepolia: Confidential USDC (Mock) / cUSDCMock */
const DEFAULT_CUSDC = "0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639";

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  if (Number(network.chainId) !== 11155111) {
    throw new Error(`Expected Sepolia (11155111), got chainId ${network.chainId}`);
  }

  const asset = (process.env.CUSDC_ADDRESS ?? DEFAULT_CUSDC) as `0x${string}`;
  console.log("Deployer:", deployer.address);
  console.log("Asset (cUSDC):", asset);

  const Vault = await ethers.getContractFactory("ConfidentialVault");
  const vault = await Vault.deploy(asset);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("ConfidentialVault:", vaultAddress);

  const Tickets = await ethers.getContractFactory("TicketEngine");
  const tickets = await Tickets.deploy(vaultAddress);
  await tickets.waitForDeployment();
  const ticketsAddress = await tickets.getAddress();
  console.log("TicketEngine:", ticketsAddress);

  const PrizePool = await ethers.getContractFactory("PrizePool");
  const prizePool = await PrizePool.deploy(asset, [5_000, 3_000, 1_500], [1, 2, 4], 500);
  await prizePool.waitForDeployment();
  const prizePoolAddress = await prizePool.getAddress();
  console.log("PrizePool:", prizePoolAddress);

  const Draw = await ethers.getContractFactory("DrawManager");
  const draw = await Draw.deploy(ticketsAddress, vaultAddress, prizePoolAddress);
  await draw.waitForDeployment();
  const drawAddress = await draw.getAddress();
  console.log("DrawManager:", drawAddress);

  const tx1 = await vault.setTicketEngine(ticketsAddress);
  await tx1.wait();
  console.log("wired vault.setTicketEngine");

  const tx2 = await tickets.setDrawManager(drawAddress);
  await tx2.wait();
  console.log("wired tickets.setDrawManager");

  const tx3 = await prizePool.setDrawManager(drawAddress);
  await tx3.wait();
  console.log("wired prizePool.setDrawManager");

  // Sanity: vault already set in TicketEngine constructor; reaffirm if ever rotated.
  const wiredVault = await tickets.vault();
  if (wiredVault.toLowerCase() !== vaultAddress.toLowerCase()) {
    const tx4 = await tickets.setVault(vaultAddress);
    await tx4.wait();
    console.log("wired tickets.setVault");
  }

  await (await vault.renounceOwnership()).wait();
  await (await tickets.renounceOwnership()).wait();
  await (await prizePool.renounceOwnership()).wait();
  console.log("renounced deployment ownership");

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
  const outFile = path.join(outDir, "sepolia.json");
  fs.writeFileSync(outFile, JSON.stringify(deployment, null, 2) + "\n");
  console.log("Wrote", outFile);
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

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
