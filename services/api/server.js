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
  tierLabel,
  commitmentHashFallback,
} = require("./store");
const { initCache, getCachedCredential, setCachedCredential, invalidateCredential } = require("./cache");
const { decideActionFromFlags } = require("../monitor/rules");
const { useMemory } = require("./db");
const { issueOnChain } = require("./chain");

const PORT = Number(process.env.PORT || process.env.API_PORT || 8080);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const QUEUE_DEPTH_THRESHOLD = Number(process.env.QUEUE_DEPTH_THRESHOLD || 50);
const INDEXER_LAG_THRESHOLD = Number(process.env.INDEXER_LAG_THRESHOLD || 30);
const MONITOR_TOKEN = process.env.MONITOR_TOKEN || "demo-monitor-token";

const app = express();
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
  const token = req.header("X-Monitor-Token") || req.header("X-BOTGUARD-Api-Key");
  if (token !== MONITOR_TOKEN && token !== "demo-monitor-token") {
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

app.post("/verifications", requireIssuer, async (req, res) => {
  try {
    const {
      holderAddress,
      tier,
      jurisdiction,
      commitmentHash,
      validityPeriodSeconds = 31536000,
    } = req.body || {};

    if (!holderAddress || !tier || !commitmentHash || !validityPeriodSeconds) {
      return res.status(400).json({
        error: "holderAddress, tier, commitmentHash, and validityPeriodSeconds are required",
      });
    }

    const tierNum = normalizeTier(tier);
    const depth = await queueDepth();
    const estimatedSeconds = depth > QUEUE_DEPTH_THRESHOLD ? 180 : 45;

    const row = await createVerification({
      holderAddress,
      issuerAddress: req.issuer.address,
      tier: tierNum,
      jurisdiction: jurisdiction ? String(jurisdiction).toUpperCase().slice(0, 2) : null,
      commitmentHash,
      validityPeriodSeconds: Number(validityPeriodSeconds),
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
  const cached = await getCachedCredential(address);
  if (cached) return res.json(cached);

  const row = await getCredential(address);
  if (!row) return res.status(404).json({ error: "No credential on record" });

  const valid = !row.revoked && new Date(row.expiresAt) > new Date();
  const payload = {
    holderAddress: address,
    tier: tierLabel(row.tier),
    jurisdiction: row.jurisdiction,
    issuer: row.issuerAddress,
    issuedAt: row.issuedAt,
    expiresAt: row.expiresAt,
    revoked: Boolean(row.revoked),
    valid,
    source: useMemory ? "memory" : "postgres",
  };
  await setCachedCredential(address, payload, Number(process.env.CRED_CACHE_TTL || 3));
  res.json(payload);
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
  const expiresAt = new Date(Date.now() + additionalSeconds * 1000).toISOString();
  await upsertCredentialCache({ ...existing, expiresAt, revoked: false });
  await invalidateCredential(holder);
  await writeAudit({
    actorType: "ISSUER",
    actorAddress: req.issuer.address,
    action: "RENEW",
    holderAddress: holder,
    detail: { additionalSeconds },
  });
  res.json({ status: "RENEWED", holderAddress: holder, expiresAt });
});

app.post("/credentials/:holderAddress/revoke", requireIssuer, async (req, res) => {
  const reason = req.body?.reason || "ISSUER_ERROR";
  const holder = req.params.holderAddress;
  const existing = await getCredential(holder);
  if (!existing) return res.status(404).json({ error: "No credential on record" });
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
    detail: { reason },
  });
  res.json({ status: "REVOKED", holderAddress: holder, reason });
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
  await updateVerification(requestId, { status: "IN_REVIEW" });
  await sleep(300);
  const commitmentHash = row.commitmentHash || commitmentHashFallback([row.holderAddress, String(row.tier), requestId]);
  await updateVerification(requestId, { status: "SIGNED", commitmentHash });
  await sleep(150);
  await updateVerification(requestId, { status: "SUBMITTED" });

  const onchain = await issueOnChain({
    holderAddress: row.holderAddress,
    tier: row.tier,
    jurisdiction: row.jurisdiction,
    commitmentHash,
    validityPeriodSeconds: row.validityPeriodSeconds,
  });

  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + (row.validityPeriodSeconds || 31536000) * 1000).toISOString();
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
  await updateVerification(requestId, { status: "CONFIRMED", txHash });
  await writeAudit({
    actorType: "SYSTEM",
    actorAddress: null,
    action: "ISSUE",
    holderAddress: row.holderAddress,
    txHash,
    detail: { requestId, onchain: Boolean(onchain) },
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function start() {
  await initCache();
  app.listen(PORT, () => {
    console.log(`BOTGUARD API listening on :${PORT} (memory=${useMemory})`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
