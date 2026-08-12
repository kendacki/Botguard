const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const signers = await hre.ethers.getSigners();
  const [deployer, issuer, monitor, holder] = signers;
  const treasurySigner = signers[4];
  console.log("Deploying BOTGUARD with:", deployer.address);

  const treasuryAddress =
    process.env.TREASURY_ADDRESS && process.env.TREASURY_ADDRESS !== deployer.address
      ? process.env.TREASURY_ADDRESS
      : treasurySigner.address;

  if (treasuryAddress.toLowerCase() === deployer.address.toLowerCase()) {
    throw new Error("TREASURY_ADDRESS must be distinct from governance/deployer");
  }

  // BOT uses 18 decimals (same as ether units); 0.5 BOT = 5e17 wei
  const verificationFee = process.env.VERIFICATION_FEE
    ? BigInt(process.env.VERIFICATION_FEE)
    : hre.ethers.parseEther("0.5");

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

  // Seed a demo credential for holder so gated-transfer demos work immediately.
  const commitment = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("demo-verification-record"));
  const jurisdiction = hre.ethers.hexlify(hre.ethers.toUtf8Bytes("NG"));
  await (
    await credentialRegistry
      .connect(issuer)
      .issueCredential(holder.address, commitment, 1, jurisdiction, 365 * 24 * 60 * 60)
  ).wait();
  await (await rwaToken.mint(holder.address, hre.ethers.parseEther("1000"))).wait();

  const deployment = {
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
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
    },
    env: {
      ISSUER_REGISTRY_ADDRESS: issuerRegistryAddress,
      CREDENTIAL_REGISTRY_ADDRESS: credentialRegistryAddress,
      EXAMPLE_RWA_TOKEN_ADDRESS: rwaTokenAddress,
      TREASURY_ADDRESS: treasuryAddress,
      VERIFICATION_FEE: verificationFee.toString(),
    },
    deployedAt: new Date().toISOString(),
  };

  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${hre.network.name}.json`);
  fs.writeFileSync(outPath, JSON.stringify(deployment, null, 2));

  const envPath = path.join(__dirname, "..", "deployments", `${hre.network.name}.env`);
  fs.writeFileSync(
    envPath,
    [
      `ISSUER_REGISTRY_ADDRESS=${issuerRegistryAddress}`,
      `CREDENTIAL_REGISTRY_ADDRESS=${credentialRegistryAddress}`,
      `EXAMPLE_RWA_TOKEN_ADDRESS=${rwaTokenAddress}`,
      `TREASURY_ADDRESS=${treasuryAddress}`,
      `VERIFICATION_FEE=${verificationFee.toString()}`,
      `CHAIN_RPC_URL=http://127.0.0.1:8545`,
      `BOTCHAIN_TESTNET_RPC=http://127.0.0.1:8545`,
    ].join("\n") + "\n"
  );

  console.log("Wrote", outPath);
  console.log("Wrote", envPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
