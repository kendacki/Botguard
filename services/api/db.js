const { Pool } = require("pg");

const useMemory = process.env.BOTGUARD_MEMORY_MODE === "1" || process.env.DATABASE_URL === "memory";

function createMemoryStore() {
  const store = {
    issuers: new Map(),
    verification_requests: new Map(),
    credentials_cache: new Map(),
    monitor_flags: [],
    audit_log: [],
    indexer_state: { last_block: 0, lag_seconds: 0 },
    api_keys: new Map(),
  };

  // Hardhat account #1 — demo issuer
  const demoIssuer = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  store.issuers.set(demoIssuer.toLowerCase(), {
    address: demoIssuer,
    name: "BOTGUARD Demo Issuer",
    trustTier: 1,
    active: true,
    registeredAt: new Date().toISOString(),
  });
  store.api_keys.set("demo-issuer-key", demoIssuer.toLowerCase());

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
