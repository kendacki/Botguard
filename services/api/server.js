require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const {
  findIssuerByApiKey,
  listIssuers,
  createVerification,
  getVerification,
  getCredential,
  queueDepth,
  writeAudit,
  addMonitorFlag,
  recentHighFlags,
  indexerLag,
  upsertCredentialCache,
  updateVerification,
  normalizeTier,
  normalizeJurisdiction,
  tierLabel,
  commitmentHashFallback,
  getFeeStatus,
  upsertFeeStatus,
  TIER_TO_NUM,
} = require("./store");
const { initCache, getCachedCredential, setCachedCredential, invalidateCredential } = require("./cache");
const { decideActionFromFlags } = require("../monitor/rules");
const { useMemory } = require("./db");
const {
  issueOnChain,
  rejectOnChain,
  revokeOnChain,
  renewOnChain,
  readEscrowedFee,
  readCredentialOnChain,
  readPassOnChain,
  mintPassOnChain,
  readVerificationFee,
  getPassAddress,
  getRegistryAddress,
  assertIssuerReady,
} = require("./chain");

function passToNft(pass, fallbackTier, fallbackRegion) {
  if (!pass) return null;
  return {
    address: pass.address,
    tokenId: pass.tokenId,
    tier: tierLabel(pass.tier) || fallbackTier,
    jurisdiction: normalizeJurisdiction(pass.jurisdiction) || fallbackRegion,
    tokenURI: pass.tokenURI,
  };
}

async function mintMissingPass(address, row) {
  const existing = await readPassOnChain(address);
  if (existing) return existing;
  const expiresAtUnix = Math.floor(new Date(row.expiresAt).getTime() / 1000);
  if (!Number.isFinite(expiresAtUnix) || expiresAtUnix <= 0) {
    const err = new Error("Pass expiry is missing.");
    err.statusCode = 400;
    throw err;
  }
  const minted = await mintPassOnChain({
    holderAddress: address,
    tier: normalizeTier(row.tier),
    jurisdiction: normalizeJurisdiction(row.jurisdiction) || "US",
    expiresAtUnix,
  });
  if (!minted?.txHash) {
    const err = new Error(minted?.error || "Could not mint the badge on BOT Chain.");
    err.statusCode = 502;
    throw err;
  }
  await invalidateCredential(address);
  return readPassOnChain(address);
}

const PORT = Number(process.env.PORT || process.env.API_PORT || 8080);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const QUEUE_DEPTH_THRESHOLD = Number(process.env.QUEUE_DEPTH_THRESHOLD || 50);
const INDEXER_LAG_THRESHOLD = Number(process.env.INDEXER_LAG_THRESHOLD || 30);
const IS_PROD = process.env.NODE_ENV === "production";
const MONITOR_TOKEN = process.env.MONITOR_TOKEN || (IS_PROD ? null : "demo-monitor-token");

const app = express();
app.set("trust proxy", 1);
app.use(
  cors({
    origin: CORS_ORIGIN === "*" ? true : CORS_ORIGIN.split(",").map((s) => s.trim()),
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: Number(process.env.RATE_LIMIT_PER_MIN || 120),
    standardHeaders: true,
    legacyHeaders: false,
  })
);

async function requireIssuer(req, res, next) {
  const apiKey = req.header("X-BOTGUARD-Api-Key") || req.header("X-API-Key");
  if (!apiKey) return res.status(401).json({ error: "Missing X-BOTGUARD-Api-Key" });
  const issuer = await findIssuerByApiKey(apiKey);
  if (!issuer) return res.status(401).json({ error: "Invalid or revoked API key" });
  if (!issuer.active) return res.status(403).json({ error: "Issuer not active on IssuerRegistry" });
  req.issuer = issuer;
  next();
}

function requireMonitor(req, res, next) {
  if (!MONITOR_TOKEN) {
    return res.status(503).json({ error: "MONITOR_TOKEN not configured" });
  }
  const token = req.header("X-Monitor-Token") || req.header("X-BOTGUARD-Api-Key");
  const demoOk = !IS_PROD && token === "demo-monitor-token";
  if (token !== MONITOR_TOKEN && !demoOk) {
    return res.status(401).json({ error: "Unauthorized monitor" });
  }
  next();
}

app.get("/healthz", (_req, res) => res.json({ status: "ok", service: "botguard-api" }));

app.get("/readyz", async (_req, res) => {
  const depth = await queueDepth();
  const lag = await indexerLag();
  if (depth > QUEUE_DEPTH_THRESHOLD || lag > INDEXER_LAG_THRESHOLD) {
    return res.status(503).json({ ready: false, queueDepth: depth, indexerLagSeconds: lag });
  }
  res.json({ ready: true, queueDepth: depth, indexerLagSeconds: lag });
});

app.get("/issuers", async (_req, res) => {
  res.json(await listIssuers());
});

/** Public check for other apps: is this wallet verified, and what kind of check was it? */
app.get("/status/:holderAddress", async (req, res) => {
  const address = req.params.holderAddress;
  if (!/^0x[a-fA-F0-9]{40}$/i.test(address)) {
    return res.status(400).json({ error: "Invalid holder address" });
  }

  let minTier = TIER_TO_NUM.RETAIL;
  if (req.query.minTier != null && req.query.minTier !== "") {
    try {
      minTier = normalizeTier(req.query.minTier);
    } catch {
      return res.status(400).json({ error: "minTier must be RETAIL, ACCREDITED, or INSTITUTIONAL" });
    }
  }
  const requiredRegion = normalizeJurisdiction(req.query.jurisdiction);

  const [cached, onchain, pass] = await Promise.all([
    getCachedCredential(address),
    readCredentialOnChain(address),
    readPassOnChain(address),
  ]);
  const row = onchain || (await getCredential(address)) || cached;
  const chainId = Number(process.env.BOTCHAIN_CHAIN_ID || 968);
  const registry = getRegistryAddress();
  const passAddress = getPassAddress();

  const empty = {
    holderAddress: address,
    verified: false,
    kind: null,
    meetsRequirement: false,
    requirement: {
      minTier: tierLabel(minTier),
      jurisdiction: requiredRegion,
    },
    expiresAt: null,
    revoked: false,
    badge: passAddress ? { contract: passAddress, tokenId: null, owned: false } : null,
    registry,
    chainId,
    personalData: "off-chain",
  };

  if (!row) return res.json(empty);

  const region =
    normalizeJurisdiction(pass?.jurisdiction) ||
    normalizeJurisdiction(onchain?.jurisdiction) ||
    normalizeJurisdiction(row.jurisdiction);
  let tierValue = 0;
  try {
    tierValue = normalizeTier(pass?.tier || onchain?.tier || row.tier);
  } catch {
    tierValue = 0;
  }
  const revoked = Boolean(row.revoked);
  const expired = new Date(row.expiresAt) <= new Date();
  const verified = !revoked && !expired && tierValue >= TIER_TO_NUM.RETAIL;
  const meetsMinTier = verified && tierValue >= minTier;
  const matchesRegion = !requiredRegion || region === requiredRegion;
  const kind = {
    tier: tierLabel(tierValue) || String(row.tier || ""),
    tierRank: tierValue,
    jurisdiction: region,
    label: [tierLabel(tierValue) || row.tier, region].filter(Boolean).join(" · "),
  };

  res.json({
    holderAddress: address,
    verified,
    kind: verified || row.issuedAt ? kind : null,
    meetsRequirement: Boolean(meetsMinTier && matchesRegion),
    requirement: {
      minTier: tierLabel(minTier),
      jurisdiction: requiredRegion,
    },
    expiresAt: row.expiresAt || null,
    revoked,
    badge: passAddress
      ? {
          contract: pass.address || passAddress,
          tokenId: pass?.tokenId || null,
          owned: Boolean(pass),
        }
      : null,
    registry,
    chainId,
    personalData: "off-chain",
  });
});

app.get("/verifications/fee", async (_req, res) => {
  const fee = await readVerificationFee();
  res.json({
    verificationFee: fee,
    verificationFeeEth: Number(fee) / 1e18,
    currency: "BOT",
    decimals: 18,
  });
});

app.get("/verifications/fee-status/:holderAddress", async (req, res) => {
  const address = req.params.holderAddress;
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return res.status(400).json({ error: "Invalid holder address" });
  }

  let row = await getFeeStatus(address);
  const onchain = await readEscrowedFee(address);
  const credential = await getCredential(address);

  if (onchain && onchain.feeStatus === "ESCROWED" && (!row || row.feeStatus !== "ESCROWED")) {
    row = await upsertFeeStatus({
      holderAddress: address,
      feeAmount: onchain.escrowedFee,
      feeStatus: "ESCROWED",
    });
  }

  // Escrow cleared on-chain: reconcile SETTLED (issued) vs REFUNDED / cleared unpaid.
  const escrowZero =
    onchain && onchain.escrowedFee != null && BigInt(onchain.escrowedFee) === 0n;
  if (escrowZero && row?.feeStatus === "ESCROWED") {
    const nextStatus = credential && !credential.revoked ? "SETTLED" : "REFUNDED";
    row = await upsertFeeStatus({
      holderAddress: address,
      feeAmount: row.feeAmount || "0",
      feeTxHash: row.feeTxHash,
      feeStatus: nextStatus,
    });
  } else if (escrowZero && !row && credential && !credential.revoked) {
    row = await upsertFeeStatus({
      holderAddress: address,
      feeAmount: onchain.verificationFee || "0",
      feeStatus: "SETTLED",
    });
  }

  if (!row && !onchain) {
    return res.status(404).json({ error: "No fee status on record" });
  }

  const feeAmount = row?.feeAmount || onchain?.escrowedFee || "0";
  const feeStatus =
    row?.feeStatus ||
    (onchain?.escrowedFee && BigInt(onchain.escrowedFee) > 0n ? "ESCROWED" : null) ||
    null;

  res.json({
    holderAddress: address,
    feeAmount,
    feeTxHash: row?.feeTxHash || null,
    feeStatus,
    verificationFee: onchain?.verificationFee || (await readVerificationFee()),
    escrowed: feeStatus === "ESCROWED",
    source: row ? (useMemory ? "memory" : "postgres") : "chain",
  });
});

/** Record a fee payment tx so memory mode survives without the indexer. */
app.post("/verifications/fee-status/:holderAddress", async (req, res) => {
  const address = req.params.holderAddress;
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return res.status(400).json({ error: "Invalid holder address" });
  }
  const { feeTxHash, feeAmount } = req.body || {};
  if (!feeTxHash || !/^0x[a-fA-F0-9]{64}$/.test(feeTxHash)) {
    return res.status(400).json({ error: "feeTxHash (0x…64) required" });
  }

  const onchain = await readEscrowedFee(address);
  const amount =
    feeAmount ||
    onchain?.escrowedFee ||
    (await readVerificationFee());

  const row = await upsertFeeStatus({
    holderAddress: address,
    feeAmount: amount,
    feeTxHash,
    feeStatus: "ESCROWED",
  });

  await writeAudit({
    actorType: "HOLDER",
    actorAddress: address,
    action: "FEE_PAID",
    holderAddress: address,
    txHash: feeTxHash,
    detail: { feeAmount: amount },
  });

  res.status(201).json({
    holderAddress: address,
    feeAmount: row.feeAmount,
    feeTxHash: row.feeTxHash,
    feeStatus: row.feeStatus,
    escrowed: true,
  });
});

app.post("/verifications/:holderAddress/reject", requireIssuer, async (req, res) => {
  const holder = req.params.holderAddress;
  if (!/^0x[a-fA-F0-9]{40}$/.test(holder)) {
    return res.status(400).json({ error: "Invalid holder address" });
  }

  try {
    if (process.env.BOTGUARD_MEMORY_MODE === "1" && !process.env.CHAIN_RPC_URL) {
      await upsertFeeStatus({
        holderAddress: holder,
        feeStatus: "REFUNDED",
        feeAmount: "0",
      });
      await writeAudit({
        actorType: "ISSUER",
        actorAddress: req.issuer.address,
        action: "FEE_REFUNDED",
        holderAddress: holder,
        detail: { mode: "memory" },
      });
      return res.json({ status: "REFUNDED", holderAddress: holder, mode: "memory" });
    }

    const result = await rejectOnChain(holder);
    if (!result) return res.status(503).json({ error: "Chain unavailable for reject" });

    await upsertFeeStatus({
      holderAddress: holder,
      feeStatus: "REFUNDED",
      feeTxHash: result.txHash,
    });
    await writeAudit({
      actorType: "ISSUER",
      actorAddress: req.issuer.address,
      action: "FEE_REFUNDED",
      holderAddress: holder,
      txHash: result.txHash,
    });
    res.json({ status: "REFUNDED", holderAddress: holder, txHash: result.txHash, escrowed: false });
  } catch (err) {
    const msg = String(err?.shortMessage || err?.message || "");
    if (/NoFeeEscrowed/i.test(msg)) {
      await upsertFeeStatus({
        holderAddress: holder,
        feeStatus: "REFUNDED",
      });
      return res.json({ status: "REFUNDED", holderAddress: holder, alreadyRefunded: true, escrowed: false });
    }
    res.status(400).json({ error: err.message || "Refund failed" });
  }
});

app.post("/verifications", requireIssuer, async (req, res) => {
  try {
    const {
      holderAddress,
      tier,
      jurisdiction,
      commitmentHash,
      validityPeriodSeconds = 31536000,
    } = req.body || {};

    if (!holderAddress || !/^0x[a-fA-F0-9]{40}$/i.test(holderAddress)) {
      return res.status(400).json({ error: "holderAddress is required" });
    }

    const requestedTier = tier === undefined || tier === null || tier === "" ? "RETAIL" : tier;
    const region = normalizeJurisdiction(jurisdiction);
    if (!region) {
      return res.status(400).json({ error: "jurisdiction is required (NG, US, GB, or EU)" });
    }
    const hash =
      commitmentHash ||
      commitmentHashFallback([holderAddress, String(requestedTier), Date.now()]);
    const validity = Number(validityPeriodSeconds || 31536000);

    const tierNum = normalizeTier(requestedTier);
    const depth = await queueDepth();
    const estimatedSeconds = depth > QUEUE_DEPTH_THRESHOLD ? 180 : 45;

    const row = await createVerification({
      holderAddress,
      issuerAddress: req.issuer.address,
      tier: tierNum,
      jurisdiction: region,
      commitmentHash: hash,
      validityPeriodSeconds: validity,
      estimatedSeconds,
    });

    await writeAudit({
      actorType: "ISSUER",
      actorAddress: req.issuer.address,
      action: "VERIFICATION_SUBMITTED",
      holderAddress,
      detail: { requestId: row.requestId },
    });

    if (process.env.BOTGUARD_MEMORY_MODE === "1" || process.env.INLINE_WORKER === "1") {
      setImmediate(() => processVerificationInline(row.requestId));
    }

    res.status(202).json({
      requestId: row.requestId,
      status: "PENDING",
      txHash: null,
      failureReason: null,
      estimatedSeconds,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/verifications/:requestId", async (req, res) => {
  const row = await getVerification(req.params.requestId);
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json({
    requestId: row.requestId,
    status: row.status,
    txHash: row.txHash,
    failureReason: row.failureReason,
    holderAddress: row.holderAddress,
  });
});

app.get("/credentials/:holderAddress", async (req, res) => {
  const address = req.params.holderAddress;
  if (!/^0x[a-fA-F0-9]{40}$/i.test(address)) {
    return res.status(400).json({ error: "Invalid holder address" });
  }

  let [cached, onchain, pass] = await Promise.all([
    getCachedCredential(address),
    readCredentialOnChain(address),
    readPassOnChain(address),
  ]);

  let row = onchain || (await getCredential(address)) || cached;
  if (!row) return res.status(404).json({ error: "No credential on record" });

  const valid = !row.revoked && new Date(row.expiresAt) > new Date();
  const mintRequested = req.query.mint === "1" || req.query.mint === "true";
  if (!pass && valid && mintRequested) {
    try {
      pass = await mintMissingPass(address, {
        tier: onchain?.tier || row.tier,
        jurisdiction: onchain?.jurisdiction || row.jurisdiction,
        expiresAt: row.expiresAt,
      });
    } catch (err) {
      return res.status(err.statusCode || 502).json({ error: err.message });
    }
  }

  const region =
    normalizeJurisdiction(pass?.jurisdiction) ||
    normalizeJurisdiction(onchain?.jurisdiction) ||
    normalizeJurisdiction(row.jurisdiction);
  const tierValue = pass?.tier || onchain?.tier || row.tier;
  const payload = {
    holderAddress: address,
    tier: tierLabel(tierValue) || row.tier,
    jurisdiction: region,
    issuer: row.issuerAddress,
    issuedAt: row.issuedAt,
    expiresAt: row.expiresAt,
    revoked: Boolean(row.revoked),
    valid,
    source: onchain ? "chain" : useMemory ? "memory" : "postgres",
  };
  const nft = passToNft(pass, payload.tier, region);
  if (nft) payload.nft = nft;
  await setCachedCredential(address, payload, Number(process.env.CRED_CACHE_TTL || 3));
  res.json(payload);
});

app.post("/credentials/:holderAddress/nft", requireIssuer, async (req, res) => {
  const address = req.params.holderAddress;
  if (!address || !/^0x[a-fA-F0-9]{40}$/i.test(address)) {
    return res.status(400).json({ error: "Invalid holder address" });
  }

  const [onchain, pass, stored] = await Promise.all([
    readCredentialOnChain(address),
    readPassOnChain(address),
    getCredential(address),
  ]);
  const row = onchain || stored;
  if (!row || row.revoked) {
    return res.status(404).json({ error: "No live pass to mint a badge for." });
  }
  if (new Date(row.expiresAt) <= new Date()) {
    return res.status(400).json({ error: "This pass has expired." });
  }
  if (pass) {
    return res.json({ nft: passToNft(pass), minted: false });
  }

  try {
    const fresh = await mintMissingPass(address, {
      tier: onchain?.tier || row.tier,
      jurisdiction: onchain?.jurisdiction || row.jurisdiction,
      expiresAt: row.expiresAt,
    });
    res.json({ nft: passToNft(fresh), minted: true });
  } catch (err) {
    res.status(err.statusCode || 502).json({ error: err.message });
  }
});

app.post("/credentials/:holderAddress/renew", requireIssuer, async (req, res) => {
  const additionalSeconds = Number(req.body?.additionalSeconds || 0);
  if (!additionalSeconds) return res.status(400).json({ error: "additionalSeconds required" });
  const holder = req.params.holderAddress;
  const existing = await getCredential(holder);
  if (!existing) return res.status(404).json({ error: "No credential on record" });
  if (existing.issuerAddress.toLowerCase() !== req.issuer.address.toLowerCase()) {
    return res.status(403).json({ error: "Caller is not the original issuer" });
  }

  let txHash = null;
  const chainReady = assertIssuerReady();
  if (chainReady.mode === "onchain") {
    try {
      const onchain = await renewOnChain(holder, additionalSeconds);
      if (!onchain) return res.status(503).json({ error: "Chain unavailable for renew" });
      txHash = onchain.txHash;
    } catch (err) {
      return res.status(400).json({ error: err.message || "Renew failed on chain" });
    }
  }

  const expiresAt = new Date(Date.now() + additionalSeconds * 1000).toISOString();
  await upsertCredentialCache({ ...existing, expiresAt, revoked: false });
  await invalidateCredential(holder);
  await writeAudit({
    actorType: "ISSUER",
    actorAddress: req.issuer.address,
    action: "RENEW",
    holderAddress: holder,
    txHash,
    detail: { additionalSeconds, onchain: Boolean(txHash) },
  });
  res.json({ status: "RENEWED", holderAddress: holder, expiresAt, txHash });
});

app.post("/credentials/:holderAddress/revoke", requireIssuer, async (req, res) => {
  const reason = req.body?.reason || "ISSUER_ERROR";
  const holder = req.params.holderAddress;
  const existing = await getCredential(holder);
  if (!existing) return res.status(404).json({ error: "No credential on record" });

  let txHash = null;
  const chainReady = assertIssuerReady();
  if (chainReady.mode === "onchain") {
    try {
      const onchain = await revokeOnChain(holder, reason);
      if (!onchain) return res.status(503).json({ error: "Chain unavailable for revoke" });
      txHash = onchain.txHash;
    } catch (err) {
      return res.status(400).json({ error: err.message || "Revoke failed on chain" });
    }
  }

  await upsertCredentialCache({
    ...existing,
    revoked: true,
    revocationReason: reason,
  });
  await invalidateCredential(holder);
  await writeAudit({
    actorType: "ISSUER",
    actorAddress: req.issuer.address,
    action: "REVOKE",
    holderAddress: holder,
    txHash,
    detail: { reason, onchain: Boolean(txHash) },
  });
  res.json({ status: "REVOKED", holderAddress: holder, reason, txHash });
});

app.post("/monitor/flags", requireMonitor, async (req, res) => {
  const { holderAddress, flagType, severity, detail } = req.body || {};
  if (!holderAddress || !flagType || severity == null) {
    return res.status(400).json({ error: "holderAddress, flagType, severity required" });
  }

  const recent = await recentHighFlags(holderAddress, 60);
  const provisional = [
    ...recent.map((f) => ({
      flagType: f.flagType,
      severity: Number(f.severity),
      recommendedAction: Number(f.severity) >= 5 ? "ESCALATE" : Number(f.severity) >= 4 ? "HOLD" : "NONE",
    })),
    {
      flagType,
      severity: Number(severity),
      recommendedAction: Number(severity) >= 5 ? "ESCALATE" : Number(severity) >= 4 ? "HOLD" : "NONE",
    },
  ];
  const action = decideActionFromFlags(provisional);

  const flag = await addMonitorFlag({
    holderAddress,
    flagType,
    severity,
    detail,
    autoActionTaken: action === "AUTO_REVOKE" ? "REVOKED" : action === "HOLD" ? "HELD" : action === "ESCALATE" ? "ESCALATED" : null,
  });

  if (action === "AUTO_REVOKE") {
    const existing = await getCredential(holderAddress);
    if (existing && !existing.revoked) {
      if (assertIssuerReady().mode === "onchain") {
        try {
          await revokeOnChain(holderAddress, "MONITOR_FLAG");
        } catch (err) {
          console.warn("[monitor] on-chain revoke failed:", err.message);
        }
      }
      await upsertCredentialCache({
        ...existing,
        revoked: true,
        revocationReason: "MONITOR_FLAG",
      });
      await invalidateCredential(holderAddress);
    }
  }

  await writeAudit({
    actorType: "MONITOR",
    actorAddress: null,
    action: "FLAG",
    holderAddress,
    detail: { flagId: flag.flagId, flagType, action },
  });

  res.status(201).json({ flag, action });
});

async function processVerificationInline(requestId) {
  const row = await getVerification(requestId);
  if (!row) return;
  try {
    await updateVerification(requestId, { status: "IN_REVIEW" });
    await sleep(300);
    const commitmentHash =
      row.commitmentHash || commitmentHashFallback([row.holderAddress, String(row.tier), requestId]);
    await updateVerification(requestId, { status: "SIGNED", commitmentHash });
    await sleep(150);
    await updateVerification(requestId, { status: "SUBMITTED" });

    const chainReady = assertIssuerReady();
    let onchain = null;
    if (chainReady.mode === "onchain") {
      onchain = await issueOnChain({
        holderAddress: row.holderAddress,
        tier: row.tier,
        jurisdiction: row.jurisdiction,
        commitmentHash,
        validityPeriodSeconds: row.validityPeriodSeconds,
      });
      if (!onchain?.txHash) {
        await updateVerification(requestId, {
          status: "FAILED",
          failureReason: onchain?.error || "On-chain issueCredential failed",
        });
        await writeAudit({
          actorType: "SYSTEM",
          actorAddress: null,
          action: "ISSUE_FAILED",
          holderAddress: row.holderAddress,
          detail: { requestId, error: onchain?.error || null },
        });
        return;
      }
    }

    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(
      Date.now() + (row.validityPeriodSeconds || 31536000) * 1000
    ).toISOString();
    const txHash =
      onchain?.txHash || `0xdemo${commitmentHash.replace(/^0x/, "").slice(0, 60)}`;

    await upsertCredentialCache({
      holderAddress: row.holderAddress,
      commitmentHash,
      tier: row.tier,
      jurisdiction: row.jurisdiction,
      issuerAddress: row.issuerAddress,
      issuedAt,
      expiresAt,
      revoked: false,
      revocationReason: null,
      lastSyncedBlock: 1,
    });
    await invalidateCredential(row.holderAddress);
    await upsertFeeStatus({
      holderAddress: row.holderAddress,
      feeStatus: "SETTLED",
    });
    await updateVerification(requestId, { status: "CONFIRMED", txHash });
    await writeAudit({
      actorType: "SYSTEM",
      actorAddress: null,
      action: "ISSUE",
      holderAddress: row.holderAddress,
      txHash,
      detail: { requestId, onchain: Boolean(onchain) },
    });
  } catch (err) {
    console.error("[inline-worker] failed", requestId, err.message);
    await updateVerification(requestId, {
      status: "FAILED",
      failureReason: err.message || "Inline worker failed",
    });
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

app.use((req, res) => {
  res.status(404).json({ error: `${req.method} ${req.path} not found` });
});

app.use((err, _req, res, _next) => {
  console.error("[api]", err);
  res.status(err.statusCode || 500).json({ error: err.message || "Internal error" });
});

async function start() {
  const chainReady = assertIssuerReady();
  if (!chainReady.ok) {
    console.error(`[api] ${chainReady.error}`);
    process.exit(1);
  }
  if (IS_PROD && CORS_ORIGIN === "*") {
    console.warn("[api] CORS_ORIGIN=* in production — set an explicit frontend origin");
  }
  if (IS_PROD && !MONITOR_TOKEN) {
    console.warn("[api] MONITOR_TOKEN unset — monitor endpoints disabled");
  }

  await initCache();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(
      `BOTGUARD API listening on :${PORT} (memory=${useMemory}, chain=${chainReady.mode})`
    );
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
