import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BrowserProvider, Contract, keccak256, toUtf8Bytes, parseEther, formatEther } from "ethers";
import {
  ArrowRight,
  Copy,
  LogOut,
  Minus,
  Plus,
  Star,
  Wallet,
} from "lucide-react";
import Logo from "./components/Logo.jsx";
import Modal from "./components/Modal.jsx";
import Alert from "./components/Alert.jsx";
import SignedApp from "./pages/SignedApp.jsx";
import { api, DEMO_API_KEY, shortAddr } from "./lib/api.js";
import { BOT_CHAIN, ensureBotChain, explorerTxUrl, VERIFICATION_PASS_ADDRESS } from "./lib/chain.js";

const easeOut = [0.22, 1, 0.36, 1];
const heroContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.05 },
  },
};
const heroItem = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: easeOut } },
};

const features = [
  {
    id: "issuers",
    title: "Issuers",
    body: "Approve trusted verifiers. They decide who gets a credential.",
    image: "/illustrations/authentication.svg",
  },
  {
    id: "credentials",
    title: "Credentials",
    body: "Store a hash and status on chain. Never personal data.",
    image: "/illustrations/private-data.svg",
  },
  {
    id: "gates",
    title: "Gates",
    body: "Block transfers when a wallet is not verified.",
    image: "/illustrations/firewall.svg",
  },
  {
    id: "monitor",
    title: "Monitor",
    body: "Flag risk early. Revoke only when two strong signals agree.",
    image: "/illustrations/online-security.svg",
  },
];

const faqs = [
  {
    q: "What is BOTGUARD?",
    a: "Your shared compliance pass for BOT Chain. Verify a wallet once, then every gated app and token can trust the same answer.",
  },
  {
    q: "Is my identity stored on chain?",
    a: "No. Only a hash, tier, region, expiry, and revoke flag go on chain. Your personal details stay with the issuer — off chain.",
  },
  {
    q: "Who can revoke access?",
    a: "The issuer, governance, or a monitor that sees two matching risk signals. Revoke stops gated transfers immediately.",
  },
  {
    q: "How do tokens use my pass?",
    a: "Tokens call isValid before a transfer. Apps can also check status in the UI so users know why a move is blocked.",
  },
  {
    q: "What happens when a credential expires?",
    a: "Transfers fail until you renew. Refresh Status anytime, then submit Verify again with your tier and region.",
  },
  {
    q: "What should I do after connecting?",
    a: "Open Verify, pick your tier and region, and submit. Use Status to confirm it landed. Help has more if you get stuck.",
  },
];

function StatusPill({ ok, label }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
        ok ? "border-ok/40 bg-ok/10 text-ok" : "border-line bg-white/60 text-mute backdrop-blur-md"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-ok" : "bg-mute"}`} />
      {label}
    </span>
  );
}

export default function App() {
  const [account, setAccount] = useState("");
  const [tier, setTier] = useState("RETAIL");
  const [jurisdiction, setJurisdiction] = useState("NG");
  const [verificationId, setVerificationId] = useState("");
  const [verification, setVerification] = useState(null);
  const [credential, setCredential] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [walletError, setWalletError] = useState("");
  const [walletSuccess, setWalletSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [manualAddress, setManualAddress] = useState("");
  const [chainLabel, setChainLabel] = useState("");
  const [hasInjectedWallet, setHasInjectedWallet] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);
  const [appView, setAppView] = useState("home");
  const [feeStatus, setFeeStatus] = useState(null);
  const [feeBusy, setFeeBusy] = useState(false);
  const [refundBusy, setRefundBusy] = useState(false);
  const [verificationFee, setVerificationFee] = useState(parseEther("0.5").toString());

  const valid = Boolean(credential?.valid);
  const connected = Boolean(account && /^0x[a-fA-F0-9]{40}$/.test(account));
  const feeEscrowed = feeStatus?.feeStatus === "ESCROWED" || feeStatus?.escrowed === true;

  const REGISTRY_FEE_ABI = [
    "function payFeeAndRequestVerification() payable",
    "function verificationFee() view returns (uint256)",
    "function escrowedFee(address holder) view returns (uint256)",
  ];

  async function loadFeeStatus(address = account, { keepEscrowedOnError = true } = {}) {
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      setFeeStatus(null);
      return null;
    }
    try {
      const row = await api(`/verifications/fee-status/${address}`);
      setFeeStatus(row);
      if (row.verificationFee) setVerificationFee(row.verificationFee);
      return row;
    } catch {
      setFeeStatus((prev) => {
        if (prev?.holderAddress?.toLowerCase() !== address.toLowerCase()) return null;
        if (keepEscrowedOnError) return prev;
        if (prev.feeStatus === "ESCROWED") {
          return { ...prev, feeStatus: "REFUNDED", escrowed: false };
        }
        return prev;
      });
      return null;
    }
  }

  const feeLabel = `${formatEther(verificationFee)} BOT`;

  async function loadCredentialFor(address) {
    try {
      const cred = await api(`/credentials/${address}`);
      setCredential(cred);
      const region = String(cred?.nft?.jurisdiction || cred?.jurisdiction || "")
        .toUpperCase()
        .replace(/[^A-Z]/g, "")
        .slice(0, 2);
      if (/^[A-Z]{2}$/.test(region)) setJurisdiction(region);
      const tierKey = String(cred?.nft?.tier || cred?.tier || "").toUpperCase();
      if (["RETAIL", "ACCREDITED", "INSTITUTIONAL"].includes(tierKey)) setTier(tierKey);
    } catch {
      setCredential(null);
    }
  }

  async function applyAccount(nextAccount, opts = {}) {
    const addr = String(nextAccount || "");
    setAccount(addr);
    if (!addr) {
      setCredential(null);
      setFeeStatus(null);
      setChainLabel("");
      return;
    }
    await loadCredentialFor(addr);
    await loadFeeStatus(addr);
    setAppView("home");
    if (opts.closeModal) setWalletOpen(false);
  }

  async function refreshChainLabel() {
    if (!window.ethereum) {
      setChainLabel("");
      return;
    }
    try {
      const provider = new BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      const id = Number(network.chainId);
      const names = {
        1: "Ethereum",
        11155111: "Sepolia",
        31337: "Localhost",
        [BOT_CHAIN.chainId]: BOT_CHAIN.name,
      };
      setChainLabel(names[id] || `Chain ${id}`);
    } catch {
      setChainLabel("");
    }
  }

  useEffect(() => {
    const eth = window.ethereum;
    setHasInjectedWallet(Boolean(eth));
    if (!eth) return undefined;

    let alive = true;
    (async () => {
      try {
        const accounts = await eth.request({ method: "eth_accounts" });
        if (!alive) return;
        if (accounts?.[0]) {
          await applyAccount(accounts[0]);
          await refreshChainLabel();
        }
      } catch {
        /* ignore restore errors */
      }
    })();

    const onAccounts = (accounts) => {
      applyAccount(accounts?.[0] || "");
      if (!accounts?.length) {
        setWalletSuccess("");
        setWalletError("Wallet disconnected.");
      }
    };
    const onChain = () => {
      refreshChainLabel();
    };

    eth.on?.("accountsChanged", onAccounts);
    eth.on?.("chainChanged", onChain);
    return () => {
      alive = false;
      eth.removeListener?.("accountsChanged", onAccounts);
      eth.removeListener?.("chainChanged", onChain);
    };
  }, []);

  useEffect(() => {
    if (!verificationId || !account) return undefined;
    let alive = true;
    const tick = async () => {
      try {
        const status = await api(`/verifications/${verificationId}`);
        if (!alive) return;
        setVerification(status);
        if (status.status === "CONFIRMED" || status.status === "FAILED") {
          if (status.status === "FAILED") {
            setError(status.failureReason || "We couldn't finish minting. Try again.");
            setSuccess("");
          } else {
            setSuccess("Your pass is live.");
            setError("");
          }
          try {
            const cred = await api(`/credentials/${account}`);
            if (alive) setCredential(cred);
          } catch {
            /* wait for cache */
          }
          if (alive) await loadFeeStatus(account);
        }
      } catch {
        /* ignore poll noise */
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [verificationId, account]);

  function openWalletModal() {
    setWalletError("");
    setWalletSuccess("");
    setManualAddress(account || "");
    setWalletOpen(true);
  }

  async function connectWallet() {
    setWalletError("");
    setWalletSuccess("");
    setConnecting(true);
    try {
      if (!window.ethereum) {
        setWalletError("No browser wallet found. Install MetaMask or paste an address below.");
        return;
      }
      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      if (!accounts?.[0]) {
        setWalletError("No account returned by the wallet.");
        return;
      }
      await applyAccount(accounts[0], { closeModal: true });
      await refreshChainLabel();
      setWalletSuccess("Wallet connected.");
    } catch (err) {
      const code = err?.code;
      if (code === 4001 || String(err?.message || "").toLowerCase().includes("reject")) {
        setWalletError("Connection rejected in wallet.");
      } else {
        setWalletError(err?.shortMessage || err?.message || "Wallet connection failed.");
      }
    } finally {
      setConnecting(false);
    }
  }

  async function useManualAddress() {
    setWalletError("");
    setWalletSuccess("");
    const addr = manualAddress.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
      setWalletError("Enter a valid 0x address.");
      return;
    }
    await applyAccount(addr, { closeModal: true });
    setChainLabel("Manual");
    setWalletSuccess("Address ready.");
  }

  async function copyAddress() {
    if (!account) return;
    try {
      await navigator.clipboard.writeText(account);
      setWalletSuccess("Address copied.");
      setWalletError("");
    } catch {
      setWalletError("Could not copy address.");
    }
  }

  function disconnectWallet() {
    setAccount("");
    setManualAddress("");
    setCredential(null);
    setFeeStatus(null);
    setChainLabel("");
    setWalletSuccess("");
    setWalletError("");
    setWalletOpen(false);
    setAppView("home");
    setError("");
    setSuccess("");
  }

  async function issueCredential({ skipFeeCheck = false, selectedTier = tier, selectedRegion = jurisdiction } = {}) {
    setError("");
    setSuccess("");
    if (!account) {
      setError("Connect a wallet to continue.");
      return;
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(account)) {
      setError("Enter a valid 0x address.");
      return;
    }
    const region = String(selectedRegion || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
    if (!/^[A-Z]{2}$/.test(region)) {
      setError("Pick a region first.");
      return;
    }
    const chosenTier = selectedTier || "RETAIL";
    if (!skipFeeCheck && !feeEscrowed) {
      setError(`Pay ${feeLabel} first — it comes from this wallet.`);
      return;
    }
    setBusy(true);
    try {
      const commitmentHash = keccak256(
        toUtf8Bytes(`botguard:${account}:${chosenTier}:${region}:${Date.now()}`)
      );
      const accepted = await api("/verifications", {
        method: "POST",
        headers: { "X-BOTGUARD-Api-Key": DEMO_API_KEY },
        body: JSON.stringify({
          holderAddress: account,
          tier: chosenTier,
          jurisdiction: region,
          commitmentHash,
          validityPeriodSeconds: 31536000,
        }),
      });
      setVerificationId(accepted.requestId);
      setVerification(accepted);
      setSuccess("Minting your pass…");
      await loadFeeStatus(account);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitVerification() {
    return issueCredential();
  }

  async function payVerificationFee() {
    setError("");
    setSuccess("");
    const selectedTier = tier;
    const selectedRegion = jurisdiction;
    if (!window.ethereum) {
      setError("Connect a wallet, then approve the fee.");
      return;
    }
    if (!account) {
      setError("Connect a wallet first.");
      return;
    }
    setFeeBusy(true);
    try {
      await ensureBotChain(window.ethereum);
      await refreshChainLabel();
      const provider = new BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== BOT_CHAIN.chainId) {
        throw new Error(`Switch wallet to ${BOT_CHAIN.name} (chain ${BOT_CHAIN.chainId}).`);
      }
      const signer = await provider.getSigner();
      let registryAddress = import.meta.env.VITE_CREDENTIAL_REGISTRY_ADDRESS;
      if (!registryAddress) {
        try {
          const files = [
            "/deployments/botchainTestnet.json",
            "/deployments/localhost.json",
          ];
          for (const file of files) {
            const dep = await fetch(file).then((r) => (r.ok ? r.json() : null));
            if (dep?.contracts?.CredentialRegistry) {
              registryAddress = dep.contracts.CredentialRegistry;
              break;
            }
          }
        } catch {
          registryAddress = null;
        }
      }
      if (!registryAddress) {
        throw new Error("CredentialRegistry address not found. Deploy locally first.");
      }
      const registry = new Contract(registryAddress, REGISTRY_FEE_ABI, signer);
      let fee = verificationFee;
      try {
        fee = (await registry.verificationFee()).toString();
        setVerificationFee(fee);
      } catch {
        /* keep default */
      }
      const label = `${formatEther(fee)} BOT`;
      setSuccess(`Approve ${label} in your wallet`);
      const tx = await registry.payFeeAndRequestVerification({ value: BigInt(fee) });
      setSuccess("Waiting for the network…");
      await tx.wait();
      await api(`/verifications/fee-status/${account}`, {
        method: "POST",
        body: JSON.stringify({ feeTxHash: tx.hash, feeAmount: fee }),
      }).catch(() => null);
      setFeeStatus({
        holderAddress: account,
        feeAmount: fee,
        feeTxHash: tx.hash,
        feeStatus: "ESCROWED",
        escrowed: true,
      });
      setSuccess("Paid. Minting your pass…");
      await loadFeeStatus(account);
      await issueCredential({ skipFeeCheck: true, selectedTier, selectedRegion });
    } catch (err) {
      setError(err?.shortMessage || err.message || "Fee payment failed");
    } finally {
      setFeeBusy(false);
    }
  }

  async function rejectVerificationRequest() {
    setError("");
    setSuccess("");
    if (!account) return;
    setRefundBusy(true);
    setBusy(true);
    setSuccess("Refunding to this wallet…");
    try {
      const result = await api(`/verifications/${account}/reject`, {
        method: "POST",
        headers: { "X-BOTGUARD-Api-Key": DEMO_API_KEY },
        body: JSON.stringify({}),
      });
      setVerification(null);
      setVerificationId("");
      setFeeStatus((prev) => ({
        ...(prev || {}),
        holderAddress: account,
        feeStatus: "REFUNDED",
        escrowed: false,
        feeTxHash: result.txHash || prev?.feeTxHash || null,
      }));
      for (let i = 0; i < 6; i += 1) {
        const row = await loadFeeStatus(account, { keepEscrowedOnError: false });
        if (!row || row.feeStatus !== "ESCROWED") break;
        await new Promise((resolve) => setTimeout(resolve, 900));
      }
      setFeeStatus((prev) => ({
        ...(prev || {}),
        holderAddress: account,
        feeStatus: "REFUNDED",
        escrowed: false,
        feeTxHash: result.txHash || prev?.feeTxHash || null,
      }));
      setError("");
      setSuccess(
        result.alreadyRefunded
          ? "Fee is already back in this wallet. You can verify again."
          : "Fee refunded. You can verify again."
      );
    } catch (err) {
      const msg = String(err?.message || "");
      if (/NoFeeEscrowed/i.test(msg)) {
        setVerification(null);
        setVerificationId("");
        setFeeStatus((prev) => ({
          ...(prev || {}),
          holderAddress: account,
          feeStatus: "REFUNDED",
          escrowed: false,
        }));
        setError("");
        setSuccess("Fee is already back in this wallet. You can verify again.");
      } else {
        setSuccess("");
        setError(err.message);
      }
    } finally {
      setBusy(false);
      setRefundBusy(false);
    }
  }

  async function refreshCredential() {
    setError("");
    setSuccess("");
    if (!account) {
      setError("Connect a wallet first.");
      return;
    }
    try {
      const fee = await loadFeeStatus(account);
      try {
        const cred = await api(`/credentials/${account}`);
        setCredential(cred);
        const region = String(cred?.nft?.jurisdiction || cred?.jurisdiction || "")
          .toUpperCase()
          .replace(/[^A-Z]/g, "")
          .slice(0, 2);
        if (/^[A-Z]{2}$/.test(region)) setJurisdiction(region);
        const tierKey = String(cred?.nft?.tier || cred?.tier || "").toUpperCase();
        if (["RETAIL", "ACCREDITED", "INSTITUTIONAL"].includes(tierKey)) setTier(tierKey);
        setSuccess("You’re up to date.");
        return;
      } catch (err) {
        setCredential(null);
        const escrowedNow =
          fee?.feeStatus === "ESCROWED" || fee?.escrowed === true || feeEscrowed;
        if (escrowedNow) {
          setSuccess("Fee is in. Minting your pass…");
          await issueCredential({ skipFeeCheck: true });
          return;
        }
        if (/No credential/i.test(err.message)) {
          setSuccess("No pass yet. Get verified to mint one.");
          return;
        }
        throw err;
      }
    } catch (err) {
      setError(err.message);
      setCredential(null);
    }
  }

  async function addPassToWallet() {
    setError("");
    setSuccess("");
    if (!account) return;
    const tokenId = credential?.nft?.tokenId || BigInt(account).toString();
    let passAddress = credential?.nft?.address || VERIFICATION_PASS_ADDRESS;
    if (!passAddress) {
      try {
        const dep = await fetch("/deployments/botchainTestnet.json").then((r) => (r.ok ? r.json() : null));
        passAddress = dep?.contracts?.VerificationPass || dep?.env?.VERIFICATION_PASS_ADDRESS;
      } catch {
        passAddress = null;
      }
    }
    if (!passAddress) {
      setError("Badge contract address not found.");
      return;
    }
    if (!window.ethereum?.request) {
      setError("Open your wallet NFTs tab and import this contract.");
      return;
    }
    try {
      await ensureBotChain(window.ethereum);
      const added = await window.ethereum.request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC721",
          options: {
            address: passAddress,
            tokenId: String(tokenId),
          },
        },
      });
      setSuccess(added === false ? "If it didn’t appear, import it from the explorer link." : "Badge added. Check NFTs in your wallet.");
    } catch (err) {
      if (err?.code === 4001) {
        setError("Wallet declined the badge import.");
        return;
      }
      setError(err?.shortMessage || err?.message || "Could not add the badge. Use the explorer link.");
    }
  }

  async function revokeCredential() {
    setError("");
    setSuccess("");
    if (!account) return;
    setBusy(true);
    try {
      await api(`/credentials/${account}/revoke`, {
        method: "POST",
        headers: { "X-BOTGUARD-Api-Key": DEMO_API_KEY },
        body: JSON.stringify({ reason: "USER_REQUEST" }),
      });
      await refreshCredential();
      setSuccess("Pass removed.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-page text-ink">
      <header
        className={`sticky top-0 z-40 border-b border-white/40 bg-white/45 shadow-[0_8px_32px_rgba(138,63,252,0.06)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/35 ${
          connected ? "font-poppins" : ""
        }`}
      >
        <div
          className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 md:px-6"
        >
          <button
            type="button"
            className="inline-flex items-center gap-2.5 justify-self-start"
            onClick={() => (connected ? setAppView("home") : window.scrollTo({ top: 0, behavior: "smooth" }))}
          >
            <Logo className="h-8 w-8" />
            {connected ? null : <span className="text-[15px] font-bold tracking-tight">BOTGUARD</span>}
          </button>
          <button type="button" className="btn-primary justify-self-end" onClick={openWalletModal}>
            <Wallet size={16} />
            {connected ? shortAddr(account) : "Connect"}
          </button>
        </div>
      </header>

      {connected ? (
        <SignedApp
          view={appView}
          setView={setAppView}
          account={account}
          chainLabel={chainLabel}
          credential={credential}
          valid={valid}
          tier={tier}
          setTier={setTier}
          jurisdiction={jurisdiction}
          setJurisdiction={setJurisdiction}
          verification={verification}
          verificationId={verificationId}
          busy={busy}
          error={error}
          success={success}
          openFaq={openFaq}
          setOpenFaq={setOpenFaq}
          faqs={faqs}
          onVerify={submitVerification}
          onPayFee={payVerificationFee}
          onReject={rejectVerificationRequest}
          feeStatus={feeStatus}
          feeBusy={feeBusy}
          refundBusy={refundBusy}
          feeEscrowed={feeEscrowed}
          verificationFeeLabel={feeLabel}
          explorerTxUrl={explorerTxUrl}
          onRefresh={refreshCredential}
          onRevoke={revokeCredential}
          onAddWallet={addPassToWallet}
        />
      ) : (
      <>
      <main id="top">
        <section className="relative min-h-[min(92vh,860px)] overflow-hidden">
          <div className="absolute inset-0">
            <video
              className="h-full w-full object-cover"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              poster="/videos/hero-poster.jpg"
            >
              <source src="/videos/hero.mp4" type="video/mp4" />
            </video>
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, rgba(247,246,243,0.72) 0%, rgba(247,246,243,0.55) 45%, rgba(247,246,243,0.88) 100%)",
              }}
              aria-hidden="true"
            />
          </div>

          <div className="relative mx-auto flex min-h-[min(92vh,860px)] w-full max-w-5xl flex-col px-4 pt-20 md:px-6 md:pt-24">
            <motion.div
              className="flex flex-1 flex-col items-center justify-center pb-6 text-center md:pb-10"
              variants={heroContainer}
              initial="hidden"
              animate="show"
            >
              <motion.h1
                variants={heroItem}
                className="max-w-3xl text-[2.35rem] font-extrabold leading-[1.12] tracking-tight text-ink sm:text-5xl md:text-[3.5rem] md:leading-[1.08]"
              >
                The clean way to{" "}
                <span className="hero-mark">verify</span>{" "}
                RWA wallets
              </motion.h1>

              <motion.p
                variants={heroItem}
                className="mt-5 max-w-xl text-base font-bold leading-relaxed text-ink md:text-lg"
              >
                Check a wallet once on BOT Chain. Gate every transfer after that,
                without putting personal data on chain.
              </motion.p>
            </motion.div>

            <motion.div
              className="grid grid-cols-1 items-end gap-2 sm:grid-cols-3 sm:gap-3"
              initial="hidden"
              animate="show"
              variants={heroContainer}
            >
              {/* Left proof */}
              <motion.div
                variants={heroItem}
                className="relative flex flex-col items-center"
              >
                <img
                  src="/illustrations/hero/hero-person-left.png"
                  alt=""
                  className="pointer-events-none relative z-10 mb-[-2.75rem] w-[8.75rem] select-none drop-shadow-sm sm:mb-[-3.25rem] sm:w-[9.75rem]"
                  loading="eager"
                />
                <div className="w-full rounded-t-[1.35rem] bg-[#E8DEFF] px-4 pb-7 pt-12 text-center sm:px-5 sm:pt-14">
                  <div className="flex items-center justify-center gap-2">
                    <p className="text-[2.2rem] font-extrabold leading-none tracking-tight text-[#5B21B6] sm:text-[2.5rem]">
                      1K+
                    </p>
                    <div className="flex items-center">
                      <img
                        src="/illustrations/hero/avatar-1.png"
                        alt=""
                        className="h-7 w-7 rounded-full border-2 border-white object-cover"
                      />
                      <img
                        src="/illustrations/hero/avatar-2.png"
                        alt=""
                        className="-ml-2 h-7 w-7 rounded-full border-2 border-white object-cover"
                      />
                      <span className="-ml-2 flex h-7 w-7 items-center justify-center rounded-full bg-brand text-white">
                        <Plus size={12} strokeWidth={2.75} aria-hidden="true" />
                      </span>
                    </div>
                  </div>
                  <p className="mx-auto mt-2.5 max-w-[12rem] text-[11px] font-medium leading-snug text-[#5B21B6]/60">
                    Verified wallets and teams shipping gated RWAs.
                  </p>
                </div>
              </motion.div>

              {/* Center CTA */}
              <motion.div
                variants={heroItem}
                className="relative z-[1] flex flex-col items-center"
              >
                <img
                  src="/illustrations/hero/hero-person-center.png"
                  alt=""
                  className="pointer-events-none relative z-10 mb-[-3rem] w-[10rem] select-none sm:mb-[-3.5rem] sm:w-[11.5rem]"
                  loading="eager"
                />
                <div className="w-full rounded-t-[1.35rem] bg-brand px-4 pb-9 pt-14 text-center sm:px-5 sm:pt-16">
                  <p className="mx-auto max-w-[12rem] text-lg font-bold leading-snug text-white sm:text-xl">
                    Ready to verify your first wallet.
                  </p>
                  <motion.button
                    type="button"
                    className="btn-hero-pill mx-auto mt-4"
                    onClick={openWalletModal}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span>Connect to start</span>
                    <span className="btn-hero-pill-icon" aria-hidden="true">
                      <ArrowRight size={16} strokeWidth={2.5} />
                    </span>
                  </motion.button>
                </div>
              </motion.div>

              {/* Right rating */}
              <motion.div
                variants={heroItem}
                className="relative flex flex-col items-center"
              >
                <img
                  src="/illustrations/hero/hero-person-right.png"
                  alt=""
                  className="pointer-events-none relative z-10 mb-[-2.75rem] w-[8.75rem] select-none drop-shadow-sm sm:mb-[-3.25rem] sm:w-[9.75rem]"
                  loading="eager"
                />
                <div className="w-full rounded-t-[1.35rem] bg-[#E8DEFF] px-4 pb-7 pt-12 text-center sm:px-5 sm:pt-14">
                  <p className="flex items-center justify-center gap-1 text-[2.2rem] font-extrabold leading-none tracking-tight text-[#5B21B6] sm:text-[2.5rem]">
                    4.9
                    <Star
                      size={26}
                      className="fill-brand text-brand"
                      aria-hidden="true"
                    />
                  </p>
                  <p className="mx-auto mt-2.5 max-w-[12rem] text-[11px] font-medium leading-snug text-[#5B21B6]/60">
                    Based on builder feedback across BOT Chain pilots.
                  </p>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Product */}
        <section id="product" className="border-y border-line bg-white/40 py-12 md:py-16">
          <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
            <h2 className="section-title">How it works</h2>
            <p className="section-copy">
              Four pieces. One shared status your apps can trust.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((item, i) => (
                <motion.div
                  key={item.id}
                  className="panel flex flex-col p-5"
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <img
                    src={item.image}
                    alt=""
                    className="mb-4 h-24 w-full object-contain"
                    loading="lazy"
                  />
                  <h3 className="text-base font-semibold">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-mute">{item.body}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Catalog */}
        <section id="catalog" className="mx-auto w-full max-w-6xl px-4 py-12 md:px-6 md:py-16">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="section-title">Try it live</h2>
            <p className="mx-auto mt-2 text-sm text-mute md:text-base">
              Check a wallet’s credential status, then run a quick verification.
            </p>
          </div>

          <div className="mx-auto mt-8 max-w-lg">
            <div className="panel p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-mute">Wallet</p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-ink">
                    Not connected
                  </p>
                </div>
                <StatusPill ok={false} label="No credential" />
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-[#faf9fc] px-2 py-3">
                  <p className="text-[11px] text-mute">Tier</p>
                  <p className="mt-1 text-sm font-semibold text-ink">{credential?.tier || "None"}</p>
                </div>
                <div className="rounded-xl bg-[#faf9fc] px-2 py-3">
                  <p className="text-[11px] text-mute">Region</p>
                  <p className="mt-1 text-sm font-semibold text-ink">{credential?.jurisdiction || "None"}</p>
                </div>
                <div className="rounded-xl bg-[#faf9fc] px-2 py-3">
                  <p className="text-[11px] text-mute">Status</p>
                  <p className="mt-1 text-sm font-semibold text-ink">{verification?.status || "Ready"}</p>
                </div>
              </div>

              <button
                type="button"
                className="btn-primary mt-5 w-full"
                onClick={openWalletModal}
              >
                Connect wallet
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </section>

        {/* Audience */}
        <section className="border-y border-line bg-white/40 py-10 md:py-12">
          <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
            <div className="panel overflow-hidden">
              <div className="grid sm:grid-cols-2">
                {[
                  {
                    role: "Issuers",
                    title: "Attest wallets",
                    body: "Hash once. Set tier and region. Renew or revoke when risk changes.",
                  },
                  {
                    role: "Builders",
                    title: "Gate transfers",
                    body: "Hook ComplianceGate. Check status in your app. Fail closed on chain.",
                  },
                ].map((item, i) => (
                  <div
                    key={item.role}
                    className={`p-5 sm:p-6 ${i === 0 ? "border-b border-line sm:border-b-0 sm:border-r" : ""}`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wider text-brand">{item.role}</p>
                    <h3 className="mt-2 text-lg font-bold tracking-tight md:text-xl">{item.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-mute">{item.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Steps */}
        <section id="flow" className="mx-auto w-full max-w-6xl px-4 py-12 md:px-6 md:py-16">
          <h2 className="section-title">Four steps</h2>
          <p className="section-copy">From connect to gated transfer.</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { t: "Connect", d: "Link a wallet or paste an address.", icon: "/illustrations/wallet.svg" },
              { t: "Verify", d: "An issuer posts a hashed proof.", icon: "/illustrations/fingerprint.svg" },
              { t: "Confirm", d: "The credential lands on chain.", icon: "/illustrations/file-check.svg" },
              { t: "Gate", d: "Transfers check status first.", icon: "/illustrations/gate.svg" },
            ].map((step, i) => (
              <motion.div
                key={step.t}
                className="panel p-4 sm:p-5"
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{ delay: i * 0.04 }}
              >
                <img src={step.icon} alt="" className="mb-3 h-9 w-9" loading="lazy" />
                <h3 className="font-semibold">{step.t}</h3>
                <p className="mt-1 text-sm leading-relaxed text-mute">{step.d}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Architecture */}
        <section className="border-y border-line bg-white/40 py-10 md:py-14">
          <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="section-title">One status everywhere</h2>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-mute md:text-base">
                Verify a wallet once. Every app and token can trust the same answer. No repeat KYC for each asset.
              </p>
            </div>

            <div className="panel mt-8 overflow-hidden p-4 sm:p-5">
              <div className="grid gap-3 sm:grid-cols-3 sm:gap-0">
                {[
                  {
                    step: "1",
                    title: "Check once",
                    body: "An issuer confirms the wallet and posts a hash on chain.",
                  },
                  {
                    step: "2",
                    title: "Reuse status",
                    body: "Apps and APIs read the same valid or invalid result instantly.",
                  },
                  {
                    step: "3",
                    title: "Gate transfers",
                    body: "Tokens block unsafe moves before they settle.",
                  },
                ].map((item, i) => (
                  <div
                    key={item.title}
                    className={`relative flex gap-3 rounded-2xl bg-[#faf9fc] p-4 sm:rounded-none sm:bg-transparent sm:px-5 sm:py-2 ${
                      i < 2 ? "sm:border-r sm:border-line" : ""
                    }`}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                      {item.step}
                    </span>
                    <div className="min-w-0 text-left">
                      <p className="text-sm font-semibold text-ink">{item.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-mute">{item.body}</p>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="relative overflow-hidden bg-[#f7f7f7] py-12 md:py-16">
          <div className="relative mx-auto w-full max-w-3xl px-4 md:px-6">
            <div className="text-center">
              <h2 className="section-title">FAQ</h2>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-mute md:text-base">
                Short answers to common questions.
              </p>
            </div>

            <div className="mt-8 space-y-2.5">
              {faqs.map((item, idx) => {
                const open = openFaq === idx;
                return (
                  <motion.div
                    key={item.q}
                    className={`overflow-hidden rounded-2xl border bg-white transition-shadow ${
                      open
                        ? "border-brand/25 shadow-[0_10px_32px_rgba(138,63,252,0.08)]"
                        : "border-neutral-200/80"
                    }`}
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.25 }}
                    transition={{ delay: idx * 0.03 }}
                  >
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-4 py-4 text-left sm:gap-4 sm:px-5"
                      onClick={() => setOpenFaq(open ? -1 : idx)}
                      aria-expanded={open}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition ${
                          open ? "bg-brand text-white" : "bg-[#f3f0fa] text-brand"
                        }`}
                      >
                        {open ? <Minus size={15} strokeWidth={2.4} /> : <Plus size={15} strokeWidth={2.4} />}
                      </span>
                      <span className="flex-1 text-sm font-semibold leading-snug text-ink sm:text-[15px]">
                        {item.q}
                      </span>
                    </button>
                    <AnimatePresence initial={false}>
                      {open ? (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                          className="overflow-hidden"
                        >
                          <p className="border-t border-neutral-100 px-4 pb-4 pt-3 text-sm leading-relaxed text-mute sm:px-5 sm:pl-[3.75rem]">
                            {item.a}
                          </p>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-line bg-[#f7f7f7] py-12 md:py-16">
          <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
            <div className="panel flex flex-col items-start justify-between gap-5 p-6 sm:p-8 md:flex-row md:items-center">
              <div>
                <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Ready to try it?</h2>
                <p className="mt-1.5 max-w-md text-sm text-mute md:text-base">
                  Connect your wallet and issue a credential in a few clicks.
                </p>
              </div>
              <button type="button" className="btn-primary shrink-0" onClick={openWalletModal}>
                Connect wallet
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative overflow-hidden bg-[#f7f7f7]">
        <div className="relative z-10 mx-auto max-w-6xl px-4 pb-4 pt-20 sm:px-6 lg:px-8">
          <div className="rounded-[2rem] border border-neutral-200/70 bg-white px-8 py-12 shadow-[0_2px_8px_rgba(0,0,0,0.04),0_20px_64px_rgba(0,0,0,0.07)] sm:px-12 sm:py-14">
            <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.55fr)_1fr_1fr] lg:gap-14">
              <div className="sm:col-span-2 lg:col-span-1">
                <a href="#top" className="inline-flex items-center gap-3" aria-label="BOTGUARD home">
                  <Logo className="h-7 w-7" />
                  <span className="text-base font-bold tracking-tight text-ink">BOTGUARD</span>
                </a>
                <p className="mt-5 max-w-xs text-sm leading-relaxed text-neutral-500">
                  Verify wallets once. Gate transfers. Keep identity off chain.
                </p>
              </div>

              <div>
                <p className="text-sm font-semibold text-ink">Product</p>
                <ul className="mt-4 space-y-3">
                  <li>
                    <a href="#product" className="text-sm text-neutral-500 transition-colors hover:text-ink">
                      Registry
                    </a>
                  </li>
                  <li>
                    <a href="#catalog" className="text-sm text-neutral-500 transition-colors hover:text-ink">
                      Catalog
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <p className="text-sm font-semibold text-ink">Platform</p>
                <ul className="mt-4 space-y-3">
                  <li>
                    <a href="#flow" className="text-sm text-neutral-500 transition-colors hover:text-ink">
                      Flow
                    </a>
                  </li>
                  <li>
                    <a href="#faq" className="text-sm text-neutral-500 transition-colors hover:text-ink">
                      FAQs
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://github.com/kendacki/Botguard"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-neutral-500 transition-colors hover:text-ink"
                    >
                      GitHub
                    </a>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-12 border-t border-neutral-200 pt-8">
              <p className="text-sm text-neutral-500">© 2026 BOTGUARD. Built for BOT Chain.</p>
            </div>
          </div>
        </div>

        <div
          className="pointer-events-none relative -mt-6 flex justify-center overflow-hidden pb-2 pt-4 sm:-mt-10"
          aria-hidden="true"
        >
          <span className="translate-y-[32%] select-none whitespace-nowrap text-[clamp(4.5rem,20vw,12.5rem)] font-bold leading-[0.85] tracking-[-0.045em] text-neutral-200/95">
            BOTGUARD
          </span>
        </div>
      </footer>
      </>
      )}

      {/* Wallet modal */}
      <Modal
        open={walletOpen}
        onClose={() => {
          setWalletOpen(false);
          setWalletError("");
          setWalletSuccess("");
        }}
        title={undefined}
        size={connected ? "sm" : "md"}
      >
        {connected ? (
          <div className="space-y-3 pt-0.5">
            <div className="flex items-center gap-2.5 rounded-xl bg-neutral-50 px-3 py-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-brand ring-1 ring-neutral-200/80">
                <Wallet size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-sm font-semibold tracking-tight text-ink">
                  {shortAddr(account)}
                </p>
                {chainLabel ? (
                  <p className="mt-0.5 text-[11px] text-mute">{chainLabel}</p>
                ) : null}
              </div>
              <button
                type="button"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-mute transition hover:bg-white hover:text-ink"
                onClick={copyAddress}
                aria-label="Copy address"
                title="Copy address"
              >
                <Copy size={14} />
              </button>
            </div>

            <button
              type="button"
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 text-sm font-semibold text-white transition hover:bg-neutral-800"
              onClick={disconnectWallet}
            >
              <LogOut size={15} />
              Disconnect
            </button>

            <Alert type="error">{walletError}</Alert>
            <Alert type="success">{walletSuccess}</Alert>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs leading-relaxed text-mute">
              {hasInjectedWallet
                ? "Use the wallet in this browser to continue."
                : "No browser wallet found. Paste an address for read-only access, or install MetaMask."}
            </p>
            <button
              type="button"
              className="btn-primary h-10 w-full justify-center text-sm"
              onClick={connectWallet}
              disabled={connecting || !hasInjectedWallet}
            >
              <Wallet size={15} />
              {connecting
                ? "Connecting…"
                : hasInjectedWallet
                  ? "Connect wallet"
                  : "Wallet not available"}
            </button>
            {!hasInjectedWallet ? (
              <a
                className="btn-ghost h-9 w-full justify-center text-xs"
                href="https://metamask.io/download/"
                target="_blank"
                rel="noreferrer"
              >
                Install MetaMask
              </a>
            ) : null}
            <div className="rounded-xl border border-neutral-100 bg-neutral-50/80 p-2.5">
              <label className="block text-[10px] font-medium uppercase tracking-wide text-mute">
                Or paste address
                <input
                  className="field mt-1.5 h-9 rounded-lg px-3 py-1.5 text-xs"
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  placeholder="0x…"
                  spellCheck={false}
                />
              </label>
              <button
                type="button"
                className="btn-ghost mt-2 h-9 w-full justify-center text-xs"
                onClick={useManualAddress}
              >
                Use address
              </button>
            </div>
            <Alert type="error">{walletError}</Alert>
            <Alert type="success">{walletSuccess}</Alert>
          </div>
        )}
      </Modal>
    </div>
  );
}
