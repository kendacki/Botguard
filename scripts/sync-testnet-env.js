const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dep = JSON.parse(
  fs.readFileSync(path.join(root, "deployments", "botchainTestnet.json"), "utf8")
);
const envPath = path.join(root, ".env");
const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
const updates = {
  ISSUER_REGISTRY_ADDRESS: dep.contracts.IssuerRegistry,
  CREDENTIAL_REGISTRY_ADDRESS: dep.contracts.CredentialRegistry,
  EXAMPLE_RWA_TOKEN_ADDRESS: dep.contracts.ExampleRWAToken,
  TREASURY_ADDRESS: dep.treasury,
  VERIFICATION_FEE: dep.verificationFee,
  BOTCHAIN_TESTNET_RPC: "https://rpc.bohr.life",
  BOTCHAIN_CHAIN_ID: "968",
  CHAIN_RPC_URL: "https://rpc.bohr.life",
};
const seen = new Set();
const out = [];
for (const line of lines) {
  if (!line.trim() || line.trim().startsWith("#") || !line.includes("=")) {
    out.push(line);
    continue;
  }
  const k = line.split("=")[0];
  if (updates[k] != null) {
    out.push(`${k}=${updates[k]}`);
    seen.add(k);
  } else {
    out.push(line);
  }
}
for (const [k, v] of Object.entries(updates)) {
  if (!seen.has(k)) out.push(`${k}=${v}`);
}
fs.writeFileSync(envPath, out.join("\n").replace(/\n+$/, "\n"));

const fe = path.join(root, "frontend", ".env.example");
let feTxt = fs.existsSync(fe) ? fs.readFileSync(fe, "utf8") : "";
if (!feTxt.includes("VITE_CREDENTIAL_REGISTRY_ADDRESS")) {
  feTxt =
    (feTxt.trimEnd() ? feTxt.trimEnd() + "\n" : "") +
    "VITE_API_URL=\n" +
    `VITE_CREDENTIAL_REGISTRY_ADDRESS=${dep.contracts.CredentialRegistry}\n`;
  fs.writeFileSync(fe, feTxt);
}

console.log("Synced .env with botchainTestnet deployment addresses");
console.log("IssuerRegistry", dep.contracts.IssuerRegistry);
console.log("CredentialRegistry", dep.contracts.CredentialRegistry);
console.log("ExampleRWAToken", dep.contracts.ExampleRWAToken);
