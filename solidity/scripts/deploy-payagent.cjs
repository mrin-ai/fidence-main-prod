const { mkdir, writeFile } = require("node:fs/promises");
const { resolve } = require("node:path");

const { ethers, upgrades, run } = require("hardhat");

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

  const PAYAGENT = await ethers.getContractFactory("PAYAGENT");
  const proxy = await upgrades.deployProxy(PAYAGENT, [deployerAddress], {
    kind: "uups",
    initializer: "initialize",
  });
  await proxy.waitForDeployment();

  const proxyAddress = await proxy.getAddress();
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(
    proxyAddress,
  );

  console.log("\nPAYAGENT proxy deployed:", proxyAddress);
  console.log("Implementation:", implementationAddress);
  console.log("Admin:", deployerAddress);

  console.log("\nVerifying implementation on Etherscan...");
  try {
    await run("verify:verify", {
      address: implementationAddress,
      constructorArguments: [],
    });
    console.log("Implementation verified.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("already verified")) {
      console.log("Implementation already verified.");
    } else {
      throw error;
    }
  }

  const deployment = {
    network: "sepolia",
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    proxy: proxyAddress,
    implementation: implementationAddress,
    admin: deployerAddress,
    token: {
      name: "PAYAGENT",
      symbol: "PAYAGENT",
      decimals: 6,
    },
    deployedAt: new Date().toISOString(),
    explorer: {
      proxy: `https://sepolia.etherscan.io/address/${proxyAddress}`,
      implementation: `https://sepolia.etherscan.io/address/${implementationAddress}`,
    },
  };

  const outDir = resolve(process.cwd(), "deployments");
  await mkdir(outDir, { recursive: true });
  const outFile = resolve(outDir, "payagent-sepolia.json");
  await writeFile(outFile, `${JSON.stringify(deployment, null, 2)}\n`, "utf8");

  console.log("\nSaved deployment artifact:", outFile);
  console.log("Proxy explorer:", deployment.explorer.proxy);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
