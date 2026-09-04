import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const net = await ethers.provider.getNetwork();
  console.log(JSON.stringify({
    chainId: Number(net.chainId),
    deployer: deployer.address,
  }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
