require("dotenv").config();
const {
  listPendingVerifications,
  updateVerification,
  upsertCredentialCache,
  writeAudit,
  commitmentHashFallback,
} = require("../api/store");
const { invalidateCredential } = require("../api/cache");

const POLL_MS = Number(process.env.WORKER_POLL_MS || 1000);
const WORKER_ID = process.env.WORKER_ID || `worker-${process.pid}`;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function processOne(row) {
  const id = row.requestId || row.id;
  await updateVerification(id, { status: "IN_REVIEW" });
  await sleep(250);
  const commitmentHash =
    row.commitmentHash || commitmentHashFallback([row.holderAddress, String(row.tier), id]);
  await updateVerification(id, { status: "SIGNED", commitmentHash });
  await sleep(150);
  await updateVerification(id, { status: "SUBMITTED" });

  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const txHash = `0x${require("crypto").randomBytes(32).toString("hex")}`;

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
    lastSyncedBlock: 0,
  });
  await invalidateCredential(row.holderAddress);
  await updateVerification(id, { status: "CONFIRMED", txHash });
  await writeAudit({
    actorType: "SYSTEM",
    actorAddress: null,
    action: "ISSUE",
    holderAddress: row.holderAddress,
    txHash,
    detail: { worker: WORKER_ID, requestId: id },
  });
  console.log(`[${WORKER_ID}] confirmed ${id}`);
}

async function loop() {
  console.log(`[${WORKER_ID}] starting`);
  while (true) {
    try {
      const pending = await listPendingVerifications(5);
      for (const row of pending) {
        try {
          await processOne(row);
        } catch (err) {
          const id = row.requestId || row.id;
          console.error(`[${WORKER_ID}] failed ${id}`, err.message);
          await updateVerification(id, { status: "FAILED", failureReason: err.message });
        }
      }
    } catch (err) {
      console.error(`[${WORKER_ID}] poll error`, err.message);
    }
    await sleep(POLL_MS);
  }
}

loop();
