const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

function loadDeployment() {
  const file = path.join(__dirname, "..", "..", "deployments", "localhost.json");
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function getRegistryAddress() {
  return (
    process.env.CREDENTIAL_REGISTRY_ADDRESS ||
    loadDeployment()?.contracts?.CredentialRegistry ||
    null
  );
}

/**
 * Submit issueCredential on-chain using the Hardhat demo issuer key.
 * Returns { txHash, commitmentHash } or null if chain is unavailable.
 */
async function issueOnChain({ holderAddress, tier, jurisdiction, commitmentHash, validityPeriodSeconds }) {
  const rpc = process.env.CHAIN_RPC_URL || process.env.BOTCHAIN_TESTNET_RPC;
  const registryAddress = getRegistryAddress();
  if (!rpc || !registryAddress) return null;

  try {
    const provider = new ethers.JsonRpcProvider(rpc);
    // Hardhat #1 — registered as demo issuer in scripts/deploy.js
    const issuerKey =
      process.env.ISSUER_PRIVATE_KEY ||
      "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
    const wallet = new ethers.Wallet(issuerKey, provider);
    const abi = [
      "function issueCredential(address holder, bytes32 commitmentHash, uint8 tier, bytes2 jurisdiction, uint64 validityPeriodSeconds)",
    ];
    const registry = new ethers.Contract(registryAddress, abi, wallet);
    const j = ethers.hexlify(ethers.toUtf8Bytes(String(jurisdiction || "XX").padEnd(2, "\0"))).slice(0, 6);
    const tx = await registry.issueCredential(
      holderAddress,
      commitmentHash,
      Number(tier),
      j,
      Number(validityPeriodSeconds || 31536000)
    );
    const receipt = await tx.wait();
    return { txHash: receipt.hash, commitmentHash };
  } catch (err) {
    console.warn("[chain] issueOnChain failed:", err.message);
    return null;
  }
}

module.exports = { issueOnChain, getRegistryAddress, loadDeployment };
