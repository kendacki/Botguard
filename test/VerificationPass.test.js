const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("VerificationPass", function () {
  let pass, owner, minter, alice, bob;
  const RETAIL = 1;
  const ACCREDITED = 2;
  const ONE_YEAR = 365 * 24 * 60 * 60;

  function jurisdiction(code) {
    return ethers.hexlify(ethers.toUtf8Bytes(code.padEnd(2, "\0"))).slice(0, 6);
  }

  beforeEach(async function () {
    [owner, minter, alice, bob] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("VerificationPass");
    pass = await Factory.deploy(owner.address, minter.address);
  });

  it("mints one unique soulbound pass per wallet with verification kind", async function () {
    const expires = BigInt(Math.floor(Date.now() / 1000) + ONE_YEAR);
    const tokenId = await pass.tokenIdOf(alice.address);

    await expect(
      pass.connect(minter).issuePass(alice.address, RETAIL, jurisdiction("NG"), expires)
    )
      .to.emit(pass, "PassIssued")
      .withArgs(alice.address, tokenId, RETAIL, jurisdiction("NG"), expires);

    expect(await pass.ownerOf(tokenId)).to.equal(alice.address);
    expect(await pass.hasPass(alice.address)).to.equal(true);
    const row = await pass.passOf(alice.address);
    expect(row.tier).to.equal(RETAIL);
    expect(row.jurisdiction).to.equal(jurisdiction("NG"));
    expect(row.exists).to.equal(true);

    const uri = await pass.tokenURI(tokenId);
    expect(uri.startsWith("data:application/json;base64,")).to.equal(true);
    const json = JSON.parse(Buffer.from(uri.split(",")[1], "base64").toString("utf8"));
    expect(json.image.startsWith("data:image/svg+xml;base64,")).to.equal(true);
    const svg = Buffer.from(json.image.split(",")[1], "base64").toString("utf8");
    expect(svg).to.include("BOTGUARD");
    expect(svg).to.include("Retail");
    expect(svg).to.include("NG");
    expect(svg.toLowerCase()).to.include(alice.address.slice(2, 6).toLowerCase());
    expect(svg.toLowerCase()).to.include(alice.address.slice(-4).toLowerCase());
  });

  it("refreshes the same token on re-verification instead of minting another", async function () {
    const expires = BigInt(Math.floor(Date.now() / 1000) + ONE_YEAR);
    await pass.connect(minter).issuePass(alice.address, RETAIL, jurisdiction("NG"), expires);
    await pass.connect(minter).issuePass(alice.address, ACCREDITED, jurisdiction("US"), expires + 100n);
    expect(await pass.balanceOf(alice.address)).to.equal(1n);
    const row = await pass.passOf(alice.address);
    expect(row.tier).to.equal(ACCREDITED);
    expect(row.jurisdiction).to.equal(jurisdiction("US"));
  });

  it("blocks transfers because the pass is soulbound", async function () {
    const expires = BigInt(Math.floor(Date.now() / 1000) + ONE_YEAR);
    await pass.connect(minter).issuePass(alice.address, RETAIL, jurisdiction("NG"), expires);
    const tokenId = await pass.tokenIdOf(alice.address);
    await expect(
      pass.connect(alice).transferFrom(alice.address, bob.address, tokenId)
    ).to.be.revertedWithCustomError(pass, "Soulbound");
  });

  it("burns the pass on revoke", async function () {
    const expires = BigInt(Math.floor(Date.now() / 1000) + ONE_YEAR);
    await pass.connect(minter).issuePass(alice.address, RETAIL, jurisdiction("NG"), expires);
    await pass.connect(minter).revokePass(alice.address);
    expect(await pass.hasPass(alice.address)).to.equal(false);
  });

  it("rejects mint from a stranger", async function () {
    await expect(
      pass.connect(alice).issuePass(alice.address, RETAIL, jurisdiction("NG"), 1)
    ).to.be.revertedWithCustomError(pass, "NotMinter");
  });
});
