const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const IS_PROD = process.env.NODE_ENV === "production";

function loadDeployment() {
  const root = path.join(__dirname, "..", "..", "deployments");
  const candidates = [
    process.env.DEPLOYMENT_FILE,
    "botchainTestnet.json",
    "localhost.json",
  ].filter(Boolean);

  for (const name of candidates) {
    const file = path.isAbsolute(name) ? name : path.join(root, name);
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    }
  }
  return null;
}

function getRegistryAddress() {
  return (
    process.env.CREDENTIAL_REGISTRY_ADDRESS ||
    loadDeployment()?.contracts?.CredentialRegistry ||
    null
  );
}

const REGISTRY_ABI = [
  "function issueCredential(address holder, bytes32 commitmentHash, uint8 tier, bytes2 jurisdiction, uint64 validityPeriodSeconds)",
  "function renewCredential(address holder, uint64 additionalSeconds)",
  "function revokeCredential(address holder, bytes32 reason)",
  "function payFeeAndRequestVerification() payable",
  "function rejectVerification(address holder)",
  "function escrowedFee(address holder) view returns (uint256)",
  "function verificationFee() view returns (uint256)",
  "function treasury() view returns (address)",
  "event VerificationFeePaid(address indexed holder, uint256 amount, uint64 timestamp)",
  "event FeeSettled(address indexed holder, uint256 amount, bool approved)",
  "event VerificationFeeUpdated(uint256 oldFee, uint256 newFee)",
  "event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury)",
  "event CredentialIssued(address indexed holder, address indexed issuer, uint8 tier, bytes2 jurisdiction, uint64 expiresAt)",
  "event CredentialRevoked(address indexed holder, bytes32 reason, address indexed revokedBy)",
  "event CredentialRenewed(address indexed holder, uint64 newExpiresAt)",
  "function credentials(address holder) view returns (bytes32 commitmentHash, uint8 tier, bytes2 jurisdiction, address issuer, uint64 issuedAt, uint64 expiresAt, bool revoked, bytes32 revocationReason)",
];

function getProvider() {
  const rpc = process.env.CHAIN_RPC_URL || process.env.BOTCHAIN_TESTNET_RPC;
  if (!rpc) return null;
  return new ethers.JsonRpcProvider(rpc);
}

function getRegistryRead() {
  const provider = getProvider();
  const registryAddress = getRegistryAddress();
  if (!provider || !registryAddress) return null;
  return new ethers.Contract(registryAddress, REGISTRY_ABI, provider);
}

function getIssuerPrivateKey() {
  if (process.env.ISSUER_PRIVATE_KEY) return process.env.ISSUER_PRIVATE_KEY;
  // Local Hardhat account #1 — never use against a real RPC in production.
  if (!IS_PROD && !process.env.CHAIN_RPC_URL && !process.env.BOTCHAIN_TESTNET_RPC) {
    return "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
  }
  return null;
}

function getIssuerWallet() {
  const provider = getProvider();
  const issuerKey = getIssuerPrivateKey();
  if (!provider || !issuerKey) return null;
  return new ethers.Wallet(issuerKey, provider);
}

function assertIssuerReady() {
  const rpc = process.env.CHAIN_RPC_URL || process.env.BOTCHAIN_TESTNET_RPC;
  if (!rpc) return { ok: true, mode: "offchain" };
  if (!getRegistryAddress()) {
    return { ok: false, error: "CREDENTIAL_REGISTRY_ADDRESS (or deployment file) required when CHAIN_RPC_URL is set" };
  }
  if (!getIssuerPrivateKey()) {
    return { ok: false, error: "ISSUER_PRIVATE_KEY required when CHAIN_RPC_URL is set" };
  }
  return { ok: true, mode: "onchain" };
}

/**
 * Submit issueCredential on-chain.
 * Returns { txHash, commitmentHash } or null if chain/wallet is unavailable.
 */
async function issueOnChain({ holderAddress, tier, jurisdiction, commitmentHash, validityPeriodSeconds }) {
  const registryAddress = getRegistryAddress();
  const wallet = getIssuerWallet();
  if (!wallet || !registryAddress) return null;

  try {
    const registry = new ethers.Contract(registryAddress, REGISTRY_ABI, wallet);
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
    const reason = err.shortMessage || err.reason || err.message;
    console.warn("[chain] issueOnChain failed:", reason);
    return { error: reason };
  }
}

async function revokeOnChain(holderAddress, reason = "ISSUER_ERROR") {
  const registryAddress = getRegistryAddress();
  const wallet = getIssuerWallet();
  if (!wallet || !registryAddress) return null;
  try {
    const registry = new ethers.Contract(registryAddress, REGISTRY_ABI, wallet);
    const reasonBytes = ethers.id(String(reason || "ISSUER_ERROR"));
    const tx = await registry.revokeCredential(holderAddress, reasonBytes);
    const receipt = await tx.wait();
    return { txHash: receipt.hash };
  } catch (err) {
    console.warn("[chain] revokeOnChain failed:", err.message);
    throw err;
  }
}

async function renewOnChain(holderAddress, additionalSeconds) {
  const registryAddress = getRegistryAddress();
  const wallet = getIssuerWallet();
  if (!wallet || !registryAddress) return null;
  try {
    const registry = new ethers.Contract(registryAddress, REGISTRY_ABI, wallet);
    const tx = await registry.renewCredential(holderAddress, Number(additionalSeconds));
    const receipt = await tx.wait();
    return { txHash: receipt.hash };
  } catch (err) {
    console.warn("[chain] renewOnChain failed:", err.message);
    throw err;
  }
}

async function rejectOnChain(holderAddress) {
  const registryAddress = getRegistryAddress();
  const wallet = getIssuerWallet();
  if (!wallet || !registryAddress) return null;
  try {
    const registry = new ethers.Contract(registryAddress, REGISTRY_ABI, wallet);
    const tx = await registry.rejectVerification(holderAddress);
    const receipt = await tx.wait();
    return { txHash: receipt.hash };
  } catch (err) {
    console.warn("[chain] rejectOnChain failed:", err.message);
    throw err;
  }
}

async function readEscrowedFee(holderAddress) {
  const registry = getRegistryRead();
  if (!registry) return null;
  try {
    const [escrowed, fee] = await Promise.all([
      registry.escrowedFee(holderAddress),
      registry.verificationFee(),
    ]);
    return {
      escrowedFee: escrowed.toString(),
      verificationFee: fee.toString(),
      feeStatus: escrowed > 0n ? "ESCROWED" : null,
    };
  } catch (err) {
    console.warn("[chain] readEscrowedFee failed:", err.message);
    return null;
  }
}

async function readCredentialOnChain(holderAddress) {
  const registry = getRegistryRead();
  if (!registry) return null;
  try {
    const cred = await registry.credentials(holderAddress);
    const issuedAt = Number(cred.issuedAt || 0n);
    if (!issuedAt) return null;
    let jurisdiction = "";
    try {
      jurisdiction = ethers.toUtf8String(cred.jurisdiction).replace(/\0/g, "").trim();
    } catch {
      jurisdiction = null;
    }
    return {
      holderAddress,
      commitmentHash: cred.commitmentHash,
      tier: Number(cred.tier),
      jurisdiction: jurisdiction || null,
      issuerAddress: cred.issuer,
      issuedAt: new Date(issuedAt * 1000).toISOString(),
      expiresAt: new Date(Number(cred.expiresAt) * 1000).toISOString(),
      revoked: Boolean(cred.revoked),
      revocationReason: cred.revocationReason,
      lastSyncedBlock: 0,
    };
  } catch (err) {
    console.warn("[chain] readCredentialOnChain failed:", err.message);
    return null;
  }
}

async function readVerificationFee() {
  const registry = getRegistryRead();
  if (!registry) {
    return process.env.VERIFICATION_FEE || ethers.parseEther("0.5").toString();
  }
  try {
    return (await registry.verificationFee()).toString();
  } catch {
    return ethers.parseEther("0.5").toString();
  }
}

module.exports = {
  issueOnChain,
  revokeOnChain,
  renewOnChain,
  rejectOnChain,
  readEscrowedFee,
  readCredentialOnChain,
  readVerificationFee,
  getRegistryAddress,
  loadDeployment,
  REGISTRY_ABI,
  getProvider,
  getRegistryRead,
  assertIssuerReady,
  getIssuerPrivateKey,
};
