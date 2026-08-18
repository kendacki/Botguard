const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const { db, useMemory } = require("./db");

const TIER_TO_NUM = { RETAIL: 1, ACCREDITED: 2, INSTITUTIONAL: 3 };
const NUM_TO_TIER = { 1: "RETAIL", 2: "ACCREDITED", 3: "INSTITUTIONAL" };

function nowIso() {
  return new Date().toISOString();
}

function normalizeTier(tier) {
  if (typeof tier === "number") return tier;
  const key = String(tier || "").toUpperCase();
  if (!TIER_TO_NUM[key]) throw new Error("Invalid tier");
  return TIER_TO_NUM[key];
}

function normalizeJurisdiction(value) {
  const code = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 2);
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

function tierLabel(tier) {
  return NUM_TO_TIER[Number(tier)] || null;
}

async function findIssuerByApiKey(apiKey) {
  if (useMemory) {
    const addr = db.store.api_keys.get(apiKey);
    if (!addr) return null;
    const issuer = db.store.issuers.get(addr);
    return issuer && issuer.active ? issuer : null;
  }
  // Optional mapping table may not exist in reference schema; memory mode is primary for demo.
  const result = await db.pool.query(
    `SELECT issuer_address AS address, name, trust_tier AS "trustTier", active
     FROM issuers WHERE active = TRUE LIMIT 100`
  );
  // Fallback demo key when DB has no key column
  if (apiKey === process.env.DEMO_API_KEY || apiKey === "demo-issuer-key") {
    return result.rows[0] || null;
  }
  return null;
}

async function listIssuers() {
  if (useMemory) {
    return [...db.store.issuers.values()].map((i) => ({
      address: i.address,
      name: i.name,
      trustTier: i.trustTier,
      active: i.active,
    }));
  }
  const result = await db.pool.query(
    `SELECT issuer_address AS address, name, trust_tier AS "trustTier", active
     FROM issuers ORDER BY registered_at`
  );
  return result.rows;
}

async function createVerification({
  holderAddress,
  issuerAddress,
  tier,
  jurisdiction,
  commitmentHash,
  validityPeriodSeconds,
  estimatedSeconds,
}) {
  const requestId = uuidv4();
  const createdAt = nowIso();
  const tierNum = normalizeTier(tier);

  if (useMemory) {
    const row = {
      requestId,
      holderAddress,
      issuerAddress,
      status: "PENDING",
      tier: tierNum,
      tierLabel: tierLabel(tierNum),
      jurisdiction: normalizeJurisdiction(jurisdiction),
      commitmentHash: commitmentHash || null,
      validityPeriodSeconds: validityPeriodSeconds || 31536000,
      txHash: null,
      failureReason: null,
      estimatedSeconds,
      createdAt,
      updatedAt: createdAt,
    };
    db.store.verification_requests.set(requestId, row);
    return row;
  }

  await db.pool.query(
    `INSERT INTO verification_requests
      (request_id, holder_address, issuer_address, status, requested_tier, jurisdiction, commitment_hash)
     VALUES ($1,$2,$3,'PENDING',$4,$5,$6)`,
    [requestId, holderAddress, issuerAddress, tierNum, normalizeJurisdiction(jurisdiction), commitmentHash || null]
  );
  return {
    requestId,
    holderAddress,
    issuerAddress,
    status: "PENDING",
    tier: tierNum,
    tierLabel: tierLabel(tierNum),
    jurisdiction: normalizeJurisdiction(jurisdiction),
    commitmentHash,
    validityPeriodSeconds,
    estimatedSeconds,
    txHash: null,
    failureReason: null,
    createdAt,
    updatedAt: createdAt,
  };
}

async function getVerification(requestId) {
  if (useMemory) return db.store.verification_requests.get(requestId) || null;
  const result = await db.pool.query(
    `SELECT request_id AS "requestId", holder_address AS "holderAddress",
            issuer_address AS "issuerAddress", status, requested_tier AS tier,
            jurisdiction, commitment_hash AS "commitmentHash",
            tx_hash AS "txHash", failure_reason AS "failureReason",
            updated_at AS "updatedAt"
     FROM verification_requests WHERE request_id = $1`,
    [requestId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return { ...row, tierLabel: tierLabel(row.tier) };
}

async function updateVerification(requestId, patch) {
  if (useMemory) {
    const row = db.store.verification_requests.get(requestId);
    if (!row) return null;
    Object.assign(row, patch, { updatedAt: nowIso() });
    return row;
  }
  const map = {
    status: "status",
    txHash: "tx_hash",
    failureReason: "failure_reason",
    commitmentHash: "commitment_hash",
    feeAmount: "fee_amount",
    feeTxHash: "fee_tx_hash",
    feeStatus: "fee_status",
  };
  const fields = [];
  const values = [];
  let i = 1;
  for (const [key, value] of Object.entries(patch)) {
    if (!map[key]) continue;
    fields.push(`${map[key]} = $${i++}`);
    values.push(value);
  }
  fields.push("updated_at = NOW()");
  values.push(requestId);
  await db.pool.query(
    `UPDATE verification_requests SET ${fields.join(", ")} WHERE request_id = $${i}`,
    values
  );
  return getVerification(requestId);
}

async function upsertFeeStatus({
  holderAddress,
  feeAmount,
  feeTxHash,
  feeStatus,
  blockNumber,
}) {
  const key = holderAddress.toLowerCase();
  const prev = useMemory ? db.store.fee_status.get(key) : null;
  const row = {
    holderAddress,
    feeAmount:
      feeAmount != null
        ? String(feeAmount)
        : prev?.feeAmount != null
          ? String(prev.feeAmount)
          : null,
    feeTxHash: feeTxHash || prev?.feeTxHash || null,
    feeStatus: feeStatus || prev?.feeStatus || null,
    blockNumber: blockNumber || prev?.blockNumber || 0,
    updatedAt: nowIso(),
  };

  if (useMemory) {
    db.store.fee_status.set(key, row);
    // Mirror onto latest verification request for this holder when present.
    for (const req of db.store.verification_requests.values()) {
      if (req.holderAddress.toLowerCase() === key) {
        req.feeAmount = row.feeAmount;
        req.feeTxHash = row.feeTxHash;
        req.feeStatus = row.feeStatus;
        req.updatedAt = row.updatedAt;
      }
    }
    return row;
  }

  await db.pool.query(
    `INSERT INTO verification_requests
      (request_id, holder_address, issuer_address, status, requested_tier, fee_amount, fee_tx_hash, fee_status)
     SELECT gen_random_uuid(), $1,
            COALESCE((SELECT issuer_address FROM issuers WHERE active = TRUE LIMIT 1), $1),
            'PENDING', 1, $2, $3, $4
     WHERE NOT EXISTS (
       SELECT 1 FROM verification_requests WHERE lower(holder_address) = lower($1) AND fee_status = 'ESCROWED'
     )`,
    [holderAddress, row.feeAmount, row.feeTxHash, row.feeStatus === "ESCROWED" ? "ESCROWED" : null]
  );

  await db.pool.query(
    `UPDATE verification_requests
     SET fee_amount = COALESCE($2, fee_amount),
         fee_tx_hash = COALESCE($3, fee_tx_hash),
         fee_status = $4,
         updated_at = NOW()
     WHERE lower(holder_address) = lower($1)
       AND created_at = (
         SELECT MAX(created_at) FROM verification_requests WHERE lower(holder_address) = lower($1)
       )`,
    [holderAddress, row.feeAmount, row.feeTxHash, row.feeStatus]
  );

  return row;
}

async function getFeeStatus(holderAddress) {
  const key = holderAddress.toLowerCase();
  if (useMemory) {
    return db.store.fee_status.get(key) || null;
  }
  const result = await db.pool.query(
    `SELECT holder_address AS "holderAddress",
            fee_amount AS "feeAmount",
            fee_tx_hash AS "feeTxHash",
            fee_status AS "feeStatus",
            updated_at AS "updatedAt"
     FROM verification_requests
     WHERE lower(holder_address) = $1
       AND fee_status IS NOT NULL
     ORDER BY updated_at DESC
     LIMIT 1`,
    [key]
  );
  return result.rows[0] || null;
}

async function listPendingVerifications(limit = 10) {
  if (useMemory) {
    return [...db.store.verification_requests.values()]
      .filter((r) => r.status === "PENDING")
      .slice(0, limit);
  }
  const result = await db.pool.query(
    `SELECT request_id AS "requestId", holder_address AS "holderAddress",
            issuer_address AS "issuerAddress", status, requested_tier AS tier,
            jurisdiction, commitment_hash AS "commitmentHash"
     FROM verification_requests
     WHERE status = 'PENDING'
     ORDER BY created_at
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

async function upsertCredentialCache(cred) {
  const row = { ...cred };
  if (useMemory) {
    db.store.credentials_cache.set(cred.holderAddress.toLowerCase(), row);
    return row;
  }
  await db.pool.query(
    `INSERT INTO credentials_cache
      (holder_address, tier, jurisdiction, issuer_address, issued_at, expires_at,
       revoked, revocation_reason, last_synced_block, last_synced_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
     ON CONFLICT (holder_address) DO UPDATE SET
       tier = EXCLUDED.tier,
       jurisdiction = EXCLUDED.jurisdiction,
       issuer_address = EXCLUDED.issuer_address,
       issued_at = EXCLUDED.issued_at,
       expires_at = EXCLUDED.expires_at,
       revoked = EXCLUDED.revoked,
       revocation_reason = EXCLUDED.revocation_reason,
       last_synced_block = EXCLUDED.last_synced_block,
       last_synced_at = NOW()`,
    [
      cred.holderAddress,
      cred.tier,
      cred.jurisdiction,
      cred.issuerAddress,
      cred.issuedAt,
      cred.expiresAt,
      Boolean(cred.revoked),
      cred.revocationReason || null,
      cred.lastSyncedBlock || 0,
    ]
  );
  return row;
}

async function getCredential(address) {
  const key = address.toLowerCase();
  if (useMemory) return db.store.credentials_cache.get(key) || null;
  const result = await db.pool.query(
    `SELECT holder_address AS "holderAddress", tier, jurisdiction,
            issuer_address AS "issuerAddress", issued_at AS "issuedAt",
            expires_at AS "expiresAt", revoked,
            revocation_reason AS "revocationReason"
     FROM credentials_cache WHERE lower(holder_address) = $1`,
    [key]
  );
  return result.rows[0] || null;
}

async function queueDepth() {
  if (useMemory) {
    return [...db.store.verification_requests.values()].filter((r) =>
      ["PENDING", "IN_REVIEW", "SIGNED", "SUBMITTED"].includes(r.status)
    ).length;
  }
  const result = await db.pool.query(
    `SELECT COUNT(*)::int AS count FROM verification_requests
     WHERE status IN ('PENDING','IN_REVIEW','SIGNED','SUBMITTED')`
  );
  return result.rows[0].count;
}

async function writeAudit({ actorType, actorAddress, action, holderAddress, txHash, detail }) {
  if (useMemory) {
    db.store.audit_log.push({
      actorType,
      actorAddress,
      action,
      holderAddress,
      txHash,
      detail,
      createdAt: nowIso(),
    });
    return;
  }
  await db.pool.query(
    `INSERT INTO audit_log (actor_address, actor_type, action, holder_address, tx_hash, detail_json)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [actorAddress || null, actorType, action, holderAddress || null, txHash || null, detail || {}]
  );
}

async function addMonitorFlag({ holderAddress, flagType, severity, detail, autoActionTaken }) {
  const row = {
    flagId: uuidv4(),
    holderAddress,
    flagType,
    severity: Number(severity),
    detail: detail || {},
    autoActionTaken: autoActionTaken || null,
    createdAt: nowIso(),
  };
  if (useMemory) {
    db.store.monitor_flags.push(row);
    return row;
  }
  const result = await db.pool.query(
    `INSERT INTO monitor_flags
      (flag_id, holder_address, flag_type, severity, detail_json, auto_action_taken)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING flag_id AS "flagId", holder_address AS "holderAddress",
               flag_type AS "flagType", severity, detail_json AS detail,
               auto_action_taken AS "autoActionTaken", created_at AS "createdAt"`,
    [row.flagId, holderAddress, flagType, row.severity, row.detail, row.autoActionTaken]
  );
  return result.rows[0];
}

async function recentHighFlags(holderAddress, withinMinutes = 60) {
  if (useMemory) {
    const cutoff = Date.now() - withinMinutes * 60 * 1000;
    return db.store.monitor_flags.filter(
      (f) =>
        f.holderAddress.toLowerCase() === holderAddress.toLowerCase() &&
        Number(f.severity) >= 4 &&
        new Date(f.createdAt).getTime() >= cutoff
    );
  }
  const result = await db.pool.query(
    `SELECT flag_type AS "flagType", severity, detail_json AS detail, created_at AS "createdAt"
     FROM monitor_flags
     WHERE lower(holder_address) = lower($1)
       AND severity >= 4
       AND created_at >= NOW() - ($2 || ' minutes')::interval`,
    [holderAddress, String(withinMinutes)]
  );
  return result.rows;
}

async function indexerLag() {
  if (useMemory) return db.store.indexer_state.lag_seconds;
  return 0;
}

async function setIndexerState({ lastBlock, lagSeconds }) {
  if (useMemory) {
    db.store.indexer_state = { last_block: lastBlock, lag_seconds: lagSeconds };
  }
}

function commitmentHashFallback(parts) {
  return "0x" + crypto.createHash("sha256").update(parts.join(":")).digest("hex");
}

module.exports = {
  findIssuerByApiKey,
  listIssuers,
  createVerification,
  getVerification,
  updateVerification,
  listPendingVerifications,
  upsertCredentialCache,
  getCredential,
  queueDepth,
  writeAudit,
  addMonitorFlag,
  recentHighFlags,
  indexerLag,
  setIndexerState,
  upsertFeeStatus,
  getFeeStatus,
  normalizeTier,
  normalizeJurisdiction,
  tierLabel,
  commitmentHashFallback,
  TIER_TO_NUM,
  NUM_TO_TIER,
};
