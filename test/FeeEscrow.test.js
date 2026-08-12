const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CredentialRegistry fee escrow", function () {
  let issuerRegistry, credentialRegistry;
  let governance, issuer, treasury, alice, bob, stranger;
  const FEE = ethers.parseEther("0.5");
  const ONE_YEAR = 365 * 24 * 60 * 60;
  const RETAIL = 1;

  function jurisdiction(code) {
    return ethers.hexlify(ethers.toUtf8Bytes(code.padEnd(2, "\0"))).slice(0, 6);
  }

  beforeEach(async function () {
    [governance, issuer, treasury, alice, bob, stranger] = await ethers.getSigners();

    const IssuerRegistry = await ethers.getContractFactory("IssuerRegistry");
    issuerRegistry = await IssuerRegistry.deploy(governance.address);

    const CredentialRegistry = await ethers.getContractFactory("CredentialRegistry");
    credentialRegistry = await CredentialRegistry.deploy(
      await issuerRegistry.getAddress(),
      governance.address,
      treasury.address,
      FEE
    );

    await issuerRegistry.registerIssuer(issuer.address, "Escrow Issuer", 2);
  });

  it("pays the exact fee and emits VerificationFeePaid without tier or jurisdiction", async function () {
    const tx = await credentialRegistry.connect(alice).payFeeAndRequestVerification({ value: FEE });
    const receipt = await tx.wait();
    const paid = receipt.logs
      .map((log) => {
        try {
          return credentialRegistry.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((parsed) => parsed && parsed.name === "VerificationFeePaid");

    expect(paid).to.not.equal(undefined);
    expect(paid.args.holder).to.equal(alice.address);
    expect(paid.args.amount).to.equal(FEE);
    expect(paid.fragment.inputs.map((i) => i.name)).to.deep.equal([
      "holder",
      "amount",
      "timestamp",
    ]);
    expect(await credentialRegistry.escrowedFee(alice.address)).to.equal(FEE);
  });

  it("reverts IncorrectFee when the wrong amount is sent", async function () {
    await expect(
      credentialRegistry.connect(alice).payFeeAndRequestVerification({ value: ethers.parseEther("0.1") })
    )
      .to.be.revertedWithCustomError(credentialRegistry, "IncorrectFee")
      .withArgs(ethers.parseEther("0.1"), FEE);
  });

  it("reverts FeeAlreadyEscrowed when paying twice before settlement", async function () {
    await credentialRegistry.connect(alice).payFeeAndRequestVerification({ value: FEE });
    await expect(
      credentialRegistry.connect(alice).payFeeAndRequestVerification({ value: FEE })
    ).to.be.revertedWithCustomError(credentialRegistry, "FeeAlreadyEscrowed");
  });

  it("issueCredential zeroes escrow and forwards fee to treasury", async function () {
    await credentialRegistry.connect(alice).payFeeAndRequestVerification({ value: FEE });
    const before = await ethers.provider.getBalance(treasury.address);
    const hash = ethers.keccak256(ethers.toUtf8Bytes("escrow-issue-1"));

    await expect(
      credentialRegistry
        .connect(issuer)
        .issueCredential(alice.address, hash, RETAIL, jurisdiction("NG"), ONE_YEAR)
    )
      .to.emit(credentialRegistry, "FeeSettled")
      .withArgs(alice.address, FEE, true);

    expect(await credentialRegistry.escrowedFee(alice.address)).to.equal(0n);
    const after = await ethers.provider.getBalance(treasury.address);
    expect(after - before).to.equal(FEE);
  });

  it("issueCredential still succeeds with no escrowed fee", async function () {
    const hash = ethers.keccak256(ethers.toUtf8Bytes("no-escrow-issue"));
    await expect(
      credentialRegistry
        .connect(issuer)
        .issueCredential(bob.address, hash, RETAIL, jurisdiction("US"), ONE_YEAR)
    ).to.emit(credentialRegistry, "CredentialIssued");

    expect(await credentialRegistry.isValid(bob.address, RETAIL)).to.equal(true);
    expect(await credentialRegistry.escrowedFee(bob.address)).to.equal(0n);
  });

  it("rejectVerification refunds the holder and zeroes escrow", async function () {
    await credentialRegistry.connect(alice).payFeeAndRequestVerification({ value: FEE });
    const before = await ethers.provider.getBalance(alice.address);

    const tx = await credentialRegistry.connect(issuer).rejectVerification(alice.address);
    await expect(tx).to.emit(credentialRegistry, "FeeSettled").withArgs(alice.address, FEE, false);

    expect(await credentialRegistry.escrowedFee(alice.address)).to.equal(0n);
    const after = await ethers.provider.getBalance(alice.address);
    expect(after).to.be.greaterThan(before);
  });

  it("rejectVerification reverts NoFeeEscrowed when nothing is escrowed", async function () {
    await expect(
      credentialRegistry.connect(issuer).rejectVerification(alice.address)
    ).to.be.revertedWithCustomError(credentialRegistry, "NoFeeEscrowed");
  });

  it("rejectVerification reverts when caller is neither governance nor an active issuer", async function () {
    await credentialRegistry.connect(alice).payFeeAndRequestVerification({ value: FEE });
    await expect(
      credentialRegistry.connect(stranger).rejectVerification(alice.address)
    ).to.be.revertedWithCustomError(credentialRegistry, "NotActiveIssuer");
  });
});
