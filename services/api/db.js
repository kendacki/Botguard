const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const useMemory = process.env.BOTGUARD_MEMORY_MODE === "1" || process.env.DATABASE_URL === "memory";

function demoIssuerAddress() {
  if (process.env.ISSUER_ADDRESS) return process.env.ISSUER_ADDRESS;
  try {
    const file = path.join(__dirname, "..", "..", "deployments", "botchainTestnet.json");
    if (fs.existsSync(file)) {
      const deployed = JSON.parse(fs.readFileSync(file, "utf8"));
      return deployed.issuer || deployed.deployer;
    }
  } catch {
    /* fall through */
  }
  return "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
}

function createMemoryStore() {
  const store = {
    issuers: new Map(),
    verification_requests: new Map(),
    credentials_cache: new Map(),
    fee_status: new Map(),
    monitor_flags: [],
    audit_log: [],
    indexer_state: { last_block: 0, lag_seconds: 0 },
    api_keys: new Map(),
  };

  const demoIssuer = demoIssuerAddress();
  store.issuers.set(demoIssuer.toLowerCase(), {
    address: demoIssuer,
    name: "BOTGUARD Demo Issuer",
    trustTier: 1,
    active: true,
    registeredAt: new Date().toISOString(),
  });
  store.api_keys.set("demo-issuer-key", demoIssuer.toLowerCase());
  if (process.env.DEMO_API_KEY && process.env.DEMO_API_KEY !== "demo-issuer-key") {
    store.api_keys.set(process.env.DEMO_API_KEY, demoIssuer.toLowerCase());
  }

  return { mode: "memory", store };
}

function createPgPool() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgres://botguard:botguard@localhost:5432/botguard",
  });
  return { mode: "postgres", pool };
}

const db = useMemory ? createMemoryStore() : createPgPool();

module.exports = { db, useMemory };
