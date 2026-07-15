require("dotenv").config({ path: require("node:path").resolve(__dirname, "../.env.local") });
require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");

const privateKey = process.env.PRIVATE_KEY;
const sepoliaRpcUrl = process.env.RPC_URL ?? process.env.SEPOLIA_RPC_URL;
const etherscanApiKey = process.env.ETHERSCAN_API_KEY;

if (!privateKey) {
  throw new Error("PRIVATE_KEY is missing from .env.local");
}

if (!sepoliaRpcUrl) {
  throw new Error("RPC_URL (Sepolia) is missing from .env.local");
}

if (!etherscanApiKey) {
  throw new Error("ETHERSCAN_API_KEY is missing from .env.local");
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      evmVersion: "cancun",
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: "./contracts",
  },
  networks: {
    sepolia: {
      url: sepoliaRpcUrl,
      accounts: [privateKey],
    },
  },
  etherscan: {
    apiKey: etherscanApiKey,
  },
};
