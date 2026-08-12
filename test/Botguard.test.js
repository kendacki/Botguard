const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("BOTGUARD", function () {
  let issuerRegistry, credentialRegistry, rwaToken;
  let governance, issuer, monitor, alice, bob;

  const ONE_YEAR = 365 * 24 * 60 * 60;
  const RETAIL = 1;
  const ACCREDITED = 2;

  function jurisdiction(code) {
    return ethers.hexlify(ethers.toUtf8Bytes(code.padEnd(2, "\0"))).slice(0, 6);
  }

  beforeEach(async function () {
    [governance, issuer, monitor, alice, bob] = await ethers.getSigners();
    const treasury = (await ethers.getSigners())[6];

    const IssuerRegistry = await ethers.getContractFactory("IssuerRegistry");
    issuerRegistry = await IssuerRegistry.deploy(governance.address);

    const CredentialRegistry = await ethers.getContractFactory("CredentialRegistry");
    credentialRegistry = await CredentialRegistry.deploy(
      await issuerRegistry.getAddress(),
      governance.address,
      treasury.address,
      ethers.parseEther("0.5")
    );

    await issuerRegistry.registerIssuer(issuer.address, "Test Issuer", 2);
    await credentialRegistry.authorizeMonitor(monitor.address);

    const ExampleRWAToken = await ethers.getContractFactory("ExampleRWAToken");
    rwaToken = await ExampleRWAToken.deploy(
      "BOTGUARD RWA",
      "bRWA",
      await credentialRegistry.getAddress()
    );
  });

  it("registers issuers with trust tiers", async function () {
    expect(await issuerRegistry.isActiveIssuer(issuer.address)).to.equal(true);
    expect(await issuerRegistry.trustTierOf(issuer.address)).to.equal(2);
    expect(await issuerRegistry.issuerCount()).to.equal(1n);
  });

  it("issues and validates a credential", async function () {
    const hash = ethers.keccak256(ethers.toUtf8Bytes("verification-record-1"));
    await credentialRegistry
      .connect(issuer)
      .issueCredential(alice.address, hash, RETAIL, jurisdiction("NG"), ONE_YEAR);

    expect(await credentialRegistry.isValid(alice.address, RETAIL)).to.equal(true);
    expect(await credentialRegistry.isValid(alice.address, ACCREDITED)).to.equal(false);
    expect(
      await credentialRegistry.isValidForJurisdiction(alice.address, RETAIL, jurisdiction("NG"))
    ).to.equal(true);
  });

  it("stops honoring credentials after issuer revocation", async function () {
    const hash = ethers.keccak256(ethers.toUtf8Bytes("verification-record-2"));
    await credentialRegistry
      .connect(issuer)
      .issueCredential(alice.address, hash, RETAIL, jurisdiction("US"), ONE_YEAR);

    await issuerRegistry.revokeIssuer(issuer.address);
    expect(await credentialRegistry.isValid(alice.address, RETAIL)).to.equal(false);
  });

  it("allows monitor relay to revoke", async function () {
    const hash = ethers.keccak256(ethers.toUtf8Bytes("verification-record-3"));
    await credentialRegistry
      .connect(issuer)
      .issueCredential(alice.address, hash, RETAIL, jurisdiction("NG"), ONE_YEAR);

    const reason = ethers.encodeBytes32String("MONITOR_FLAG");
    await credentialRegistry.connect(monitor).revokeCredential(alice.address, reason);
    expect(await credentialRegistry.isValid(alice.address, RETAIL)).to.equal(false);
  });

  it("expires credentials after validity window", async function () {
    const hash = ethers.keccak256(ethers.toUtf8Bytes("verification-record-4"));
    await credentialRegistry
      .connect(issuer)
      .issueCredential(alice.address, hash, RETAIL, jurisdiction("NG"), 100);

    await time.increase(101);
    expect(await credentialRegistry.isValid(alice.address, RETAIL)).to.equal(false);
  });

  it("gates RWA transfers on compliance", async function () {
    const hash = ethers.keccak256(ethers.toUtf8Bytes("verification-record-5"));
    await credentialRegistry
      .connect(issuer)
      .issueCredential(alice.address, hash, RETAIL, jurisdiction("NG"), ONE_YEAR);
    await credentialRegistry
      .connect(issuer)
      .issueCredential(bob.address, hash, RETAIL, jurisdiction("NG"), ONE_YEAR);

    await rwaToken.mint(alice.address, ethers.parseEther("100"));
    expect(await rwaToken.checkCompliance(alice.address)).to.equal(true);

    await expect(rwaToken.connect(alice).transfer(bob.address, ethers.parseEther("10"))).to.not.be
      .reverted;

    const stranger = (await ethers.getSigners())[5];
    await expect(
      rwaToken.connect(alice).transfer(stranger.address, ethers.parseEther("1"))
    ).to.be.reverted;
  });

  it("supports two-step governance transfer", async function () {
    await issuerRegistry.transferGovernance(alice.address);
    await issuerRegistry.connect(alice).acceptGovernance();
    expect(await issuerRegistry.governance()).to.equal(alice.address);
  });
});
