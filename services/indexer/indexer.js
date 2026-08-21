require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const { setIndexerState, writeAudit, upsertFeeStatus } = require("../api/store");
const { invalidateCredential } = require("../api/cache");
const { REGISTRY_ABI, getRegistryAddress, getProvider } = require("../api/chain");

const POLL_MS = Number(process.env.INDEXER_POLL_MS || 2000);

function loadDeployment() {
  const candidates = [
    process.env.DEPLOYMENT_FILE,
    path.join(__dirname, "..", "..", "deployments", "botchainMainnet.json"),
    path.join(__dirname, "..", "..", "deployments", "botchainTestnet.json"),
    path.join(__dirname, "..", "..", "deployments", "localhost.json"),
    path.join(__dirname, "..", "..", "deployments", "hardhat.json"),
  ].filter(Boolean);
  for (const file of candidates) {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  }
  return null;
}

let lastProcessed = 0;

async function handleFeeEvents(registry, fromBlock, toBlock) {
  const paidFilter = registry.filters.VerificationFeePaid();
  const settledFilter = registry.filters.FeeSettled();
  const feeUpdatedFilter = registry.filters.VerificationFeeUpdated();
  const treasuryUpdatedFilter = registry.filters.TreasuryUpdated();

  const [paidLogs, settledLogs, feeUpdatedLogs, treasuryUpdatedLogs] = await Promise.all([
    registry.queryFilter(paidFilter, fromBlock, toBlock),
    registry.queryFilter(settledFilter, fromBlock, toBlock),
    registry.queryFilter(feeUpdatedFilter, fromBlock, toBlock),
    registry.queryFilter(treasuryUpdatedFilter, fromBlock, toBlock),
  ]);

  for (const log of paidLogs) {
    const holder = log.args.holder;
    const amount = log.args.amount.toString();
    await upsertFeeStatus({
      holderAddress: holder,
      feeAmount: amount,
      feeTxHash: log.transactionHash,
      feeStatus: "ESCROWED",
      blockNumber: log.blockNumber,
    });
    await writeAudit({
      actorType: "SYSTEM",
      actorAddress: holder,
      action: "FEE_ESCROWED",
      holderAddress: holder,
      txHash: log.transactionHash,
      detail: { amount },
    });
  }

  for (const log of settledLogs) {
    const holder = log.args.holder;
    const amount = log.args.amount.toString();
    const approved = Boolean(log.args.approved);
    await upsertFeeStatus({
      holderAddress: holder,
      feeAmount: amount,
      feeTxHash: log.transactionHash,
      feeStatus: approved ? "SETTLED" : "REFUNDED",
      blockNumber: log.blockNumber,
    });
    await writeAudit({
      actorType: "SYSTEM",
      actorAddress: holder,
      action: approved ? "FEE_SETTLED" : "FEE_REFUNDED",
      holderAddress: holder,
      txHash: log.transactionHash,
      detail: { amount, approved },
    });
  }

  for (const log of feeUpdatedLogs) {
    await writeAudit({
      actorType: "GOVERNANCE",
      action: "VERIFICATION_FEE_UPDATED",
      detail: {
        oldFee: log.args.oldFee.toString(),
        newFee: log.args.newFee.toString(),
        txHash: log.transactionHash,
      },
      txHash: log.transactionHash,
    });
  }

  for (const log of treasuryUpdatedLogs) {
    await writeAudit({
      actorType: "GOVERNANCE",
      action: "TREASURY_UPDATED",
      detail: {
        oldTreasury: log.args.oldTreasury,
        newTreasury: log.args.newTreasury,
      },
      txHash: log.transactionHash,
    });
  }
}

async function tick() {
  const deployment = loadDeployment();
  const provider = getProvider();
  const registryAddress = getRegistryAddress() || deployment?.contracts?.CredentialRegistry;

  if (!provider || !registryAddress) {
    lastProcessed += 1;
    await setIndexerState({ lastBlock: lastProcessed, lagSeconds: 5 });
    if (lastProcessed % 10 === 0) {
      await writeAudit({
        actorType: "SYSTEM",
        actorAddress: "chain-indexer",
        action: "heartbeat",
        detail: { block: lastProcessed, hasDeployment: Boolean(deployment) },
      });
    }
    return;
  }

  const tip = await provider.getBlockNumber();
  if (!lastProcessed) lastProcessed = Math.max(0, tip - 5);
  if (tip <= lastProcessed) {
    await setIndexerState({ lastBlock: tip, lagSeconds: 0 });
    return;
  }

  const fromBlock = lastProcessed + 1;
  const toBlock = tip;
  const registry = new ethers.Contract(registryAddress, REGISTRY_ABI, provider);
  await handleFeeEvents(registry, fromBlock, toBlock);

  lastProcessed = toBlock;
  await setIndexerState({ lastBlock: tip, lagSeconds: 0 });
}

async function loop() {
  console.log("[indexer] starting chain indexer (fee escrow events enabled)");
  while (true) {
    try {
      await tick();
    } catch (err) {
      console.error("[indexer] error", err.message);
      await setIndexerState({ lastBlock: lastProcessed, lagSeconds: 60 });
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

async function onCredentialEvent(holderAddress) {
  await invalidateCredential(holderAddress);
}

if (require.main === module) {
  loop();
}

module.exports = { onCredentialEvent, handleFeeEvents };
