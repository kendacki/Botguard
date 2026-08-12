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

const REGISTRY_ABI = [
  "function issueCredential(address holder, bytes32 commitmentHash, uint8 tier, bytes2 jurisdiction, uint64 validityPeriodSeconds)",
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

function getIssuerWallet() {
  const provider = getProvider();
  if (!provider) return null;
  const issuerKey =
    process.env.ISSUER_PRIVATE_KEY ||
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
  return new ethers.Wallet(issuerKey, provider);
}

/**
 * Submit issueCredential on-chain using the Hardhat demo issuer key.
 * Returns { txHash, commitmentHash } or null if chain is unavailable.
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
    console.warn("[chain] issueOnChain failed:", err.message);
    return null;
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
  rejectOnChain,
  readEscrowedFee,
  readVerificationFee,
  getRegistryAddress,
  loadDeployment,
  REGISTRY_ABI,
  getProvider,
  getRegistryRead,
};
