#!/usr/bin/env node
/**
 * Push BOTGUARD API env vars to the linked Railway service.
 *
 * Prerequisites:
 *   1. railway login   OR   set RAILWAY_TOKEN / RAILWAY_API_TOKEN
 *   2. railway link    (select the botguard API service)
 *
 * Usage: node scripts/railway-set-api-env.js
 *
 * Also sets ISSUER_PRIVATE_KEY from local .env (DEPLOYER_PRIVATE_KEY or
 * ISSUER_PRIVATE_KEY) when present — never written into committed files.
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const envFile = path.join(root, "deployments", "railway.api.env");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    out[t.slice(0, i)] = t.slice(i + 1);
  }
  return out;
}

function setVar(key, value) {
  execSync(`npx railway variables --set ${JSON.stringify(`${key}=${value}`)}`, {
    stdio: "inherit",
    cwd: root,
    shell: true,
    env: process.env,
  });
  console.log("OK", key);
}

const vars = parseEnvFile(envFile);
const local = parseEnvFile(path.join(root, ".env"));

// Prefer explicit issuer key; else reuse funded deployer (registered as issuer on testnet).
if (local.ISSUER_PRIVATE_KEY) {
  vars.ISSUER_PRIVATE_KEY = local.ISSUER_PRIVATE_KEY;
} else if (local.DEPLOYER_PRIVATE_KEY) {
  vars.ISSUER_PRIVATE_KEY = local.DEPLOYER_PRIVATE_KEY;
}

if (local.MONITOR_TOKEN) {
  vars.MONITOR_TOKEN = local.MONITOR_TOKEN;
}
if (local.DEMO_API_KEY) {
  vars.DEMO_API_KEY = local.DEMO_API_KEY;
}

console.log(`Setting ${Object.keys(vars).length} variables on Railway…`);

try {
  execSync("npx railway whoami", { stdio: "pipe", cwd: root, shell: true });
} catch {
  console.error(
    "Not logged in to Railway.\n" +
      "Add RAILWAY_TOKEN to .env (Account → Tokens), or run: npx railway login\n" +
      "Then: npx railway link   and re-run this script."
  );
  process.exit(1);
}

for (const [key, value] of Object.entries(vars)) {
  try {
    setVar(key, value);
  } catch (err) {
    console.error("FAIL", key, err.message);
    process.exitCode = 1;
  }
}

console.log("Done. Trigger a redeploy if the service did not restart automatically.");
