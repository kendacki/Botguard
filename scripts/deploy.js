const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const signers = await hre.ethers.getSigners();
  if (!signers.length) {
    throw new Error(
      "No deployer account. Set DEPLOYER_PRIVATE_KEY in .env for botchainTestnet."
    );
  }

  const isLocal = ["hardhat", "localhost"].includes(hre.network.name);
  const deployer = signers[0];
  const issuer = isLocal && signers[1] ? signers[1] : deployer;
  const monitor = isLocal && signers[2] ? signers[2] : deployer;
  const holder = isLocal && signers[3] ? signers[3] : deployer;

  console.log("Network:", hre.network.name);
  console.log("Deploying BOTGUARD with:", deployer.address);

  let treasuryAddress = process.env.TREASURY_ADDRESS;
  if (!treasuryAddress) {
    if (isLocal && signers[4]) {
      treasuryAddress = signers[4].address;
    } else {
      throw new Error(
        "TREASURY_ADDRESS is required for online deploy and must differ from the deployer."
      );
    }
  }

  if (treasuryAddress.toLowerCase() === deployer.address.toLowerCase()) {
    throw new Error("TREASURY_ADDRESS must be distinct from governance/deployer");
  }

  // BOT uses 18 decimals; accept wei integer or ether decimal string (e.g. "0.5")
  let verificationFee;
  if (process.env.VERIFICATION_FEE) {
    const raw = String(process.env.VERIFICATION_FEE).trim();
    verificationFee = raw.includes(".")
      ? hre.ethers.parseEther(raw)
      : BigInt(raw);
  } else {
    verificationFee = hre.ethers.parseEther("0.5");
  }

  const bal = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", hre.ethers.formatEther(bal), "BOT");
  if (bal === 0n) {
    throw new Error(
      "Deployer has 0 balance. Fund it from the BOT testnet faucet (https://dev-docs.botchain.ai), then retry."
    );
  }

  const IssuerRegistry = await hre.ethers.getContractFactory("IssuerRegistry");
  const issuerRegistry = await IssuerRegistry.deploy(deployer.address);
  await issuerRegistry.waitForDeployment();
  const issuerRegistryAddress = await issuerRegistry.getAddress();
  console.log("IssuerRegistry:", issuerRegistryAddress);

  const CredentialRegistry = await hre.ethers.getContractFactory("CredentialRegistry");
  const credentialRegistry = await CredentialRegistry.deploy(
    issuerRegistryAddress,
    deployer.address,
    treasuryAddress,
    verificationFee
  );
  await credentialRegistry.waitForDeployment();
  const credentialRegistryAddress = await credentialRegistry.getAddress();
  console.log("CredentialRegistry:", credentialRegistryAddress);
  console.log("Treasury:", treasuryAddress);
  console.log("VerificationFee:", verificationFee.toString());

  await (await issuerRegistry.registerIssuer(issuer.address, "BOTGUARD Demo Issuer", 1)).wait();
  await (await credentialRegistry.authorizeMonitor(monitor.address)).wait();

  const ExampleRWAToken = await hre.ethers.getContractFactory("ExampleRWAToken");
  const rwaToken = await ExampleRWAToken.deploy(
    "BOTGUARD RWA Share",
    "bRWA",
    credentialRegistryAddress
  );
  await rwaToken.waitForDeployment();
  const rwaTokenAddress = await rwaToken.getAddress();
  console.log("ExampleRWAToken:", rwaTokenAddress);

  const VerificationPass = await hre.ethers.getContractFactory("VerificationPass");
  const verificationPass = await VerificationPass.deploy(deployer.address, issuer.address);
  await verificationPass.waitForDeployment();
  const verificationPassAddress = await verificationPass.getAddress();
  console.log("VerificationPass:", verificationPassAddress);

  // Seed a demo credential so gated-transfer demos work immediately.
  const commitment = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("demo-verification-record"));
  const jurisdiction = hre.ethers.hexlify(hre.ethers.toUtf8Bytes("NG"));
  await (
    await credentialRegistry
      .connect(issuer)
      .issueCredential(holder.address, commitment, 1, jurisdiction, 365 * 24 * 60 * 60)
  ).wait();
  await (
    await verificationPass.connect(issuer).issuePass(
      holder.address,
      1,
      jurisdiction,
      BigInt(Math.floor(Date.now() / 1000)) + 365n * 24n * 60n * 60n
    )
  ).wait();
  await (await rwaToken.mint(holder.address, hre.ethers.parseEther("1000"))).wait();

  const network = await hre.ethers.provider.getNetwork();
  const rpc =
    process.env.BOTCHAIN_TESTNET_RPC ||
    (isLocal ? "http://127.0.0.1:8545" : "https://rpc.bohr.life");

  const deployment = {
    network: hre.network.name,
    chainId: network.chainId.toString(),
    explorer: isLocal ? null : "https://scan.bohr.life",
    deployer: deployer.address,
    issuer: issuer.address,
    monitor: monitor.address,
    holder: holder.address,
    treasury: treasuryAddress,
    verificationFee: verificationFee.toString(),
    contracts: {
      IssuerRegistry: issuerRegistryAddress,
      CredentialRegistry: credentialRegistryAddress,
      ExampleRWAToken: rwaTokenAddress,
      VerificationPass: verificationPassAddress,
    },
    env: {
      ISSUER_REGISTRY_ADDRESS: issuerRegistryAddress,
      CREDENTIAL_REGISTRY_ADDRESS: credentialRegistryAddress,
      EXAMPLE_RWA_TOKEN_ADDRESS: rwaTokenAddress,
      VERIFICATION_PASS_ADDRESS: verificationPassAddress,
      TREASURY_ADDRESS: treasuryAddress,
      VERIFICATION_FEE: verificationFee.toString(),
    },
    deployedAt: new Date().toISOString(),
  };

  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${hre.network.name}.json`);
  fs.writeFileSync(outPath, JSON.stringify(deployment, null, 2));

  const envPath = path.join(outDir, `${hre.network.name}.env`);
  fs.writeFileSync(
    envPath,
    [
      `ISSUER_REGISTRY_ADDRESS=${issuerRegistryAddress}`,
      `CREDENTIAL_REGISTRY_ADDRESS=${credentialRegistryAddress}`,
      `EXAMPLE_RWA_TOKEN_ADDRESS=${rwaTokenAddress}`,
      `VERIFICATION_PASS_ADDRESS=${verificationPassAddress}`,
      `TREASURY_ADDRESS=${treasuryAddress}`,
      `VERIFICATION_FEE=${verificationFee.toString()}`,
      `CHAIN_RPC_URL=${rpc}`,
      `BOTCHAIN_TESTNET_RPC=${rpc}`,
      `BOTCHAIN_CHAIN_ID=${network.chainId.toString()}`,
    ].join("\n") + "\n"
  );

  // Keep frontend in sync for local + testnet demos
  const frontendDir = path.join(__dirname, "..", "frontend", "public", "deployments");
  fs.mkdirSync(frontendDir, { recursive: true });
  fs.writeFileSync(path.join(frontendDir, `${hre.network.name}.json`), JSON.stringify(deployment, null, 2));

  console.log("Wrote", outPath);
  console.log("Wrote", envPath);
  if (!isLocal) {
    console.log("Explorer:", `https://scan.bohr.life/address/${credentialRegistryAddress}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
