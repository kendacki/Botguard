const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "deployments", "localhost.json");
const destDir = path.join(__dirname, "..", "frontend", "public", "deployments");
const dest = path.join(destDir, "localhost.json");

if (!fs.existsSync(src)) {
  console.log("No deployments/localhost.json yet");
  process.exit(0);
}
fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log("Copied deployment addresses to frontend/public/deployments/localhost.json");
