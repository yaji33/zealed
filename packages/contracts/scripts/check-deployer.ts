import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const bal = await ethers.provider.getBalance(deployer.address);
  const net = await ethers.provider.getNetwork();
  console.log(JSON.stringify({
    chainId: Number(net.chainId),
    deployer: deployer.address,
    eth: ethers.formatEther(bal),
  }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
