/**
 * Issue a credential on the deployed localhost CredentialRegistry
 * using the demo issuer signer (Hardhat account #1).
 *
 * Usage:
 *   node scripts/onchain-issue.js 0xHolderAddress RETAIL NG
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

async function main() {
  const holder = process.argv[2];
  const tierName = (process.argv[3] || "RETAIL").toUpperCase();
  const jurisdictionCode = (process.argv[4] || "NG").toUpperCase();
  if (!holder) {
    console.error("Usage: node scripts/onchain-issue.js <holder> [RETAIL|ACCREDITED|INSTITUTIONAL] [JJ]");
    process.exit(1);
  }

  const deployment = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "deployments", "localhost.json"), "utf8")
  );
  const rpc = process.env.CHAIN_RPC_URL || "http://127.0.0.1:8545";
  const provider = new ethers.JsonRpcProvider(rpc);

  // Hardhat account #1 — registered as demo issuer in deploy.js
  const issuerKey = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
  const issuer = new ethers.Wallet(issuerKey, provider);

  const abi = [
    "function issueCredential(address holder, bytes32 commitmentHash, uint8 tier, bytes2 jurisdiction, uint64 validityPeriodSeconds)",
    "function isValid(address holder, uint8 minimumTier) view returns (bool)",
  ];
  const registry = new ethers.Contract(deployment.contracts.CredentialRegistry, abi, issuer);

  const tierMap = { NONE: 0, RETAIL: 1, ACCREDITED: 2, INSTITUTIONAL: 3 };
  const tier = tierMap[tierName];
  if (tier == null) throw new Error("Invalid tier");

  const commitmentHash = ethers.keccak256(
    ethers.toUtf8Bytes(`botguard-onchain:${holder}:${tierName}:${Date.now()}`)
  );
  const jurisdiction = ethers.hexlify(ethers.toUtf8Bytes(jurisdictionCode.padEnd(2, "\0"))).slice(0, 6);

  const tx = await registry.issueCredential(
    holder,
    commitmentHash,
    tier,
    jurisdiction,
    365 * 24 * 60 * 60
  );
  const receipt = await tx.wait();
  const valid = await registry.isValid(holder, 1);
  console.log(JSON.stringify({ txHash: receipt.hash, valid, commitmentHash, registry: deployment.contracts.CredentialRegistry }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
