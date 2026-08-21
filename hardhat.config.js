require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    botchainTestnet: {
      url: process.env.BOTCHAIN_TESTNET_RPC || process.env.BOTCHAIN_RPC_URL || "https://rpc.bohr.life",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: Number(process.env.BOTCHAIN_CHAIN_ID || 968),
    },
    botchainMainnet: {
      url: process.env.BOTCHAIN_MAINNET_RPC || process.env.BOTCHAIN_RPC_URL || "",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: Number(process.env.BOTCHAIN_MAINNET_CHAIN_ID || process.env.BOTCHAIN_CHAIN_ID || 0),
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
