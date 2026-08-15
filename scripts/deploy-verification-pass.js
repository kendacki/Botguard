require("dotenv").config();
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const signers = await hre.ethers.getSigners();
  if (!signers.length) {
    throw new Error("No deployer account. Set DEPLOYER_PRIVATE_KEY.");
  }
  const deployer = signers[0];
  const file = path.join(__dirname, "..", "deployments", `${hre.network.name}.json`);
  const deployment = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : { contracts: {}, env: {} };
  const minter = process.env.ISSUER_ADDRESS || deployment.issuer || deployer.address;

  console.log("Network:", hre.network.name);
  console.log("Deployer:", deployer.address);
  console.log("Pass minter:", minter);

  const Factory = await hre.ethers.getContractFactory("VerificationPass");
  const pass = await Factory.deploy(deployer.address, minter);
  await pass.waitForDeployment();
  const address = await pass.getAddress();
  console.log("VerificationPass:", address);

  deployment.contracts = deployment.contracts || {};
  deployment.env = deployment.env || {};
  deployment.contracts.VerificationPass = address;
  deployment.env.VERIFICATION_PASS_ADDRESS = address;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(deployment, null, 2));

  const frontendDir = path.join(__dirname, "..", "frontend", "public", "deployments");
  fs.mkdirSync(frontendDir, { recursive: true });
  fs.writeFileSync(path.join(frontendDir, `${hre.network.name}.json`), JSON.stringify(deployment, null, 2));
  console.log("Wrote", file);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
