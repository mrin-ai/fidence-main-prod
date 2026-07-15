const { mkdir, writeFile } = require("node:fs/promises");
const { resolve } = require("node:path");

const { ethers, run } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const balance = await ethers.provider.getBalance(deployerAddress);

  console.log("Deployer:", deployerAddress);
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  if (balance === 0n) {
    throw new Error(
      "Deployer wallet has 0 Sepolia ETH. Fund it from a faucet before deploying.",
    );
  }

  const PAYAGENTOracle = await ethers.getContractFactory("PAYAGENTOracle");
  const oracle = await PAYAGENTOracle.deploy(deployerAddress);
  await oracle.waitForDeployment();

  const oracleAddress = await oracle.getAddress();
  const latestPrice = await oracle.latestPrice();

  console.log("\nPAYAGENTOracle deployed:", oracleAddress);
  console.log("Owner:", deployerAddress);
  console.log("latestPrice():", latestPrice.toString(), "($1.00 with 8 decimals)");

  console.log("\nVerifying on Etherscan...");
  try {
    await run("verify:verify", {
      address: oracleAddress,
      constructorArguments: [deployerAddress],
    });
    console.log("Oracle verified.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("already verified")) {
      console.log("Oracle already verified.");
    } else {
      throw error;
    }
  }

  const deployment = {
    network: "sepolia",
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    oracle: oracleAddress,
    owner: deployerAddress,
    initialPrice: latestPrice.toString(),
    priceDecimals: 8,
    priceUsd: "1.00",
    deployedAt: new Date().toISOString(),
    explorer: `https://sepolia.etherscan.io/address/${oracleAddress}`,
  };

  const outDir = resolve(process.cwd(), "deployments");
  await mkdir(outDir, { recursive: true });
  const outFile = resolve(outDir, "payagent-oracle-sepolia.json");
  await writeFile(outFile, `${JSON.stringify(deployment, null, 2)}\n`, "utf8");

  console.log("\nSaved deployment artifact:", outFile);
  console.log("Explorer:", deployment.explorer);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
