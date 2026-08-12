#!/usr/bin/env node
/**
 * One-command local demo: API in memory mode + optional Hardhat node note.
 */
const { spawn } = require("child_process");
const path = require("path");

process.env.BOTGUARD_MEMORY_MODE = process.env.BOTGUARD_MEMORY_MODE || "1";
process.env.INLINE_WORKER = process.env.INLINE_WORKER || "1";
process.env.API_PORT = process.env.API_PORT || "8080";

const api = spawn("node", ["services/api/server.js"], {
  cwd: path.join(__dirname, ".."),
  stdio: "inherit",
  env: process.env,
  shell: true,
});

console.log("BOTGUARD API starting in memory mode on :8080");
console.log("Demo issuer API key: demo-issuer-key");
console.log("Frontend: cd frontend && npm run dev (or npm run frontend)");

function shutdown() {
  api.kill("SIGTERM");
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

api.on("exit", (code) => process.exit(code ?? 0));
