import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BrowserProvider, keccak256, toUtf8Bytes } from "ethers";
import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  Check,
  Copy,
  Lock,
  LogOut,
  Minus,
  Plus,
  Shield,
  Wallet,
} from "lucide-react";
import Logo from "./components/Logo.jsx";
import Modal from "./components/Modal.jsx";
import Alert from "./components/Alert.jsx";
import HeroScene from "./components/HeroScene.jsx";
import { api, DEMO_API_KEY, shortAddr } from "./lib/api.js";

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

const tabs = [
  {
    id: "issuers",
    label: "Issuers",
    title: "Issuers",
    body: "Register trusted verifiers with clear trust tiers. Governance stays in control.",
    image: "/illustrations/authentication.svg",
  },
  {
    id: "credentials",
    label: "Credentials",
    title: "Credentials",
    body: "Store hashed commitments only. Tier, region, expiry, and revoke state live on chain.",
    image: "/illustrations/private-data.svg",
  },
  {
    id: "gates",
    label: "Gates",
    title: "Gates",
    body: "Any RWA token can inherit ComplianceGate and block unsafe transfers before they settle.",
    image: "/illustrations/firewall.svg",
  },
  {
    id: "monitor",
    label: "Monitor",
    title: "Monitor",
    body: "Rule based flags. Auto revoke needs two strong signals. One noisy rule never cuts access alone.",
    image: "/illustrations/online-security.svg",
  },
];

const faqs = [
  {
    q: "What is BOTGUARD?",
    a: "A shared compliance registry for BOT Chain RWA apps. Verify a wallet once, then reuse that status across gated assets without rebuilding KYC for every token.",
  },
  {
    q: "Does identity go on chain?",
    a: "No. Only a hash commitment, investor tier, region code, expiry, and revoke state are written. Personal data stays off chain with the issuer.",
  },
  {
    q: "Who can revoke a credential?",
    a: "The issuer, governance, or an authorized monitor relay. The monitor path requires two independent signals before access is cut.",
  },
  {
    q: "How do RWA tokens integrate?",
    a: "Point ComplianceGate at CredentialRegistry and call isValid in transfer hooks. Frontends can precheck status before users submit a transaction.",
  },
  {
    q: "What happens when a credential expires?",
    a: "Gates treat it as invalid until the issuer renews. Apps can surface expiry early so holders re-verify before transfers fail.",
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
  const [issuers, setIssuers] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [walletError, setWalletError] = useState("");
  const [walletSuccess, setWalletSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [manualAddress, setManualAddress] = useState("");
  const [chainLabel, setChainLabel] = useState("");
  const [hasInjectedWallet, setHasInjectedWallet] = useState(false);
  const [activeTab, setActiveTab] = useState("issuers");
  const [openFaq, setOpenFaq] = useState(0);

  const active = useMemo(() => tabs.find((t) => t.id === activeTab) || tabs[0], [activeTab]);
  const valid = Boolean(credential?.valid);
  const connected = Boolean(account && /^0x[a-fA-F0-9]{40}$/.test(account));

  async function loadCredentialFor(address) {
    try {
      setCredential(await api(`/credentials/${address}`));
    } catch {
      setCredential(null);
    }
  }

  async function applyAccount(nextAccount, opts = {}) {
    const addr = String(nextAccount || "");
    setAccount(addr);
    if (!addr) {
      setCredential(null);
      setChainLabel("");
      return;
    }
    await loadCredentialFor(addr);
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
        8080: "BOT Chain",
      };
      setChainLabel(names[id] || `Chain ${id}`);
    } catch {
      setChainLabel("");
    }
  }

  useEffect(() => {
    api("/issuers")
      .then((d) => setIssuers(Array.isArray(d) ? d : d.issuers || []))
      .catch(() => setIssuers([]));
  }, []);

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
          try {
            const cred = await api(`/credentials/${account}`);
            if (alive) setCredential(cred);
          } catch {
            /* wait for cache */
          }
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
    setChainLabel("");
    setWalletSuccess("");
    setWalletError("");
    setWalletOpen(false);
  }

  async function submitVerification() {
    setError("");
    setSuccess("");
    if (!account) {
      setError("Add a holder address or connect a wallet.");
      return;
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(account)) {
      setError("Enter a valid 0x address.");
      return;
    }
    setBusy(true);
    try {
      const commitmentHash = keccak256(
        toUtf8Bytes(`botguard:${account}:${tier}:${jurisdiction}:${Date.now()}`)
      );
      const accepted = await api("/verifications", {
        method: "POST",
        headers: { "X-BOTGUARD-Api-Key": DEMO_API_KEY },
        body: JSON.stringify({
          holderAddress: account,
          tier,
          jurisdiction,
          commitmentHash,
          validityPeriodSeconds: 31536000,
        }),
      });
      setVerificationId(accepted.requestId);
      setVerification(accepted);
      setSuccess("Verification accepted. Waiting for confirm.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function refreshCredential() {
    setError("");
    setSuccess("");
    if (!account) {
      setError("Add a holder address first.");
      return;
    }
    try {
      setCredential(await api(`/credentials/${account}`));
      setSuccess("Status refreshed.");
    } catch (err) {
      setError(err.message);
      setCredential(null);
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
      setSuccess("Credential revoked.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-white text-ink">
      <header className="sticky top-0 z-40 border-b border-line bg-white/70 backdrop-blur-glass">
        <div className="mx-auto grid h-16 w-full max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-4 md:px-6">
          <a href="#top" className="inline-flex items-center gap-2.5 justify-self-start">
            <Logo className="h-8 w-8" />
            <span className="text-sm font-semibold tracking-wide">BOTGUARD</span>
          </a>
          <nav className="hidden items-center justify-center gap-8 text-sm font-medium text-mute md:flex">
            <a href="#product" className="transition hover:text-brand">Product</a>
            <a href="#catalog" className="transition hover:text-brand">Catalog</a>
            <a href="#flow" className="transition hover:text-brand">Flow</a>
            <a href="#faq" className="transition hover:text-brand">FAQs</a>
          </nav>
          <div className="justify-self-end">
            <button type="button" className="btn-primary" onClick={openWalletModal}>
              <Wallet size={16} />
              {connected ? shortAddr(account) : "Connect"}
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden="true"
            style={{
              background:
                "radial-gradient(ellipse 55% 45% at 0% 0%, rgba(138,63,252,0.06), transparent 60%), radial-gradient(ellipse 40% 35% at 100% 20%, rgba(23,20,31,0.03), transparent 55%)",
            }}
          />
          <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pb-16 pt-14 md:grid-cols-2 md:gap-14 md:px-6 md:pb-24 md:pt-20">
            <motion.div
              className="max-w-xl"
              variants={heroContainer}
              initial="hidden"
              animate="show"
            >
              <motion.h1
                variants={heroItem}
                className="text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl"
              >
                <span className="block">Verify. Gate.</span>
                <motion.span
                  className="mt-1 block text-brand"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35, duration: 0.55, ease: easeOut }}
                >
                  Trust.
                </motion.span>
              </motion.h1>

              <motion.p variants={heroItem} className="section-copy">
                One registry for RWA wallets on BOT Chain. Issue a credential once. Gate every transfer
                that follows. No personal data on chain.
              </motion.p>

              <motion.div variants={heroItem} className="mt-8 flex flex-wrap gap-3">
                <motion.button
                  type="button"
                  className="btn-primary"
                  onClick={() => setDemoOpen(true)}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Launch demo
                  <ArrowRight size={16} />
                </motion.button>
                <motion.button
                  type="button"
                  className="btn-ghost"
                  onClick={openWalletModal}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Wallet size={16} />
                  {connected ? shortAddr(account) : "Connect wallet"}
                </motion.button>
              </motion.div>
            </motion.div>

            <HeroScene />
          </div>
        </section>

        {/* Product tabs */}
        <section id="product" className="border-y border-line bg-white/40 py-16 md:py-20">
          <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
            <h2 className="section-title">One source for every compliance check.</h2>
            <p className="section-copy">
              Issuers, credentials, gates, and monitor rules live in one place your RWA stack can trust.
            </p>

            <div className="mt-8 flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`h-11 rounded-btn px-4 text-sm font-semibold transition ${
                    activeTab === tab.id
                      ? "bg-brand text-white"
                      : "glass text-mute hover:text-ink"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={active.id}
                className="panel mt-6 grid gap-6 p-6 md:grid-cols-[1.1fr_0.9fr]"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                <div>
                  <h3 className="text-2xl font-bold">{active.title}</h3>
                  <p className="mt-3 text-mute">{active.body}</p>
                  <ul className="mt-5 space-y-2 text-sm text-ink/90">
                    <li className="flex items-center gap-2"><Check size={16} className="text-ok" /> Hashed commitments only</li>
                    <li className="flex items-center gap-2"><Check size={16} className="text-ok" /> Tier and region aware gates</li>
                    <li className="flex items-center gap-2"><Check size={16} className="text-ok" /> Fast status reads from cache</li>
                  </ul>
                </div>
                <div className="glass flex flex-col items-center justify-center p-4">
                  <img
                    src={active.image}
                    alt={`${active.title} illustration`}
                    className="mb-4 h-40 w-full max-w-[280px] object-contain"
                    loading="lazy"
                  />
                  <div className="w-full space-y-3 text-sm">
                    <div className="flex justify-between border-b border-line pb-2">
                      <span className="text-mute">Active issuers</span>
                      <span>{issuers.length || 1}</span>
                    </div>
                    <div className="flex justify-between border-b border-line pb-2">
                      <span className="text-mute">Demo status</span>
                      <span>{valid ? "Valid" : "Idle"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-mute">Surface</span>
                      <span className="inline-flex items-center gap-1 text-soft">
                        <Shield size={14} /> Live
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </section>

        {/* Catalog style */}
        <section id="catalog" className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6 md:py-20">
          <h2 className="section-title">A catalog teams actually use.</h2>
          <p className="section-copy">
            Browse issuers, check credential state, and run the verify loop without leaving this page.
          </p>

          <div className="panel mt-8 mb-4 overflow-hidden p-6">
            <img
              src="/illustrations/gdpr.svg"
              alt="Privacy first credentials"
              className="mx-auto h-48 w-full max-w-xl object-contain"
              loading="lazy"
            />
          </div>
          <div className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-3 text-sm">
              <span className="text-mute">localhost:8080 / catalog</span>
              <div className="flex gap-2">
                <span className="rounded-btn bg-brand px-3 py-1 text-xs font-semibold text-white">Catalog</span>
                <span className="rounded-btn border border-line px-3 py-1 text-xs text-mute">Deployed</span>
              </div>
            </div>
            <div className="grid md:grid-cols-2">
              <div className="border-b border-line p-5 md:border-b-0 md:border-r">
                <h3 className="mb-3 text-sm font-semibold text-soft">Issuers</h3>
                <div className="space-y-3">
                  {(issuers.length ? issuers : [{ name: "BOTGUARD Demo Issuer", address: "0x7099…79C8", trustTier: 1, active: true }]).map((issuer) => (
                    <div key={issuer.address} className="glass p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{issuer.name}</p>
                          <p className="text-xs text-mute">{shortAddr(issuer.address)}</p>
                        </div>
                        <span className="text-xs text-soft">Tier {issuer.trustTier}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-5">
                <h3 className="mb-3 text-sm font-semibold text-soft">Credential preview</h3>
                <div className="glass p-4 text-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-mute">Validity</span>
                    <StatusPill ok={valid} label={valid ? "Valid" : "None"} />
                  </div>
                  <div className="space-y-2 text-mute">
                    <div className="flex justify-between"><span>Tier</span><span className="text-ink">{credential?.tier || "—"}</span></div>
                    <div className="flex justify-between"><span>Region</span><span className="text-ink">{credential?.jurisdiction || "—"}</span></div>
                    <div className="flex justify-between"><span>Request</span><span className="text-ink">{verification?.status || "—"}</span></div>
                  </div>
                  <button type="button" className="btn-primary mt-4 w-full" onClick={() => setDemoOpen(true)}>
                    Run verification
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Split cards */}
        <section className="border-y border-line bg-white/40 py-16 md:py-20">
          <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 md:grid-cols-2 md:px-6">
            <div className="panel p-6">
              <img
                src="/illustrations/secure-password.svg"
                alt="Issuer attestation"
                className="mb-4 h-36 w-full object-contain"
                loading="lazy"
              />
              <p className="text-xs font-semibold uppercase tracking-wider text-soft">For issuers</p>
              <h3 className="mt-2 text-2xl font-bold">Curate and attest.</h3>
              <p className="mt-3 text-sm text-mute">Submit hashed proofs. Renew or revoke when risk changes.</p>
              <ul className="mt-5 space-y-2 text-sm">
                <li className="flex gap-2"><BadgeCheck size={16} className="mt-0.5 text-ok" /> API key auth per issuer</li>
                <li className="flex gap-2"><BadgeCheck size={16} className="mt-0.5 text-ok" /> Async verification with status poll</li>
                <li className="flex gap-2"><BadgeCheck size={16} className="mt-0.5 text-ok" /> Same truth as the contracts</li>
              </ul>
            </div>
            <div className="panel p-6">
              <img
                src="/illustrations/programming.svg"
                alt="Builder integration"
                className="mb-4 h-36 w-full object-contain"
                loading="lazy"
              />
              <p className="text-xs font-semibold uppercase tracking-wider text-soft">For builders</p>
              <h3 className="mt-2 text-2xl font-bold">Ship the gate.</h3>
              <p className="mt-3 text-sm text-mute">Inherit ComplianceGate. Precheck in the UI. Fail closed on chain.</p>
              <ul className="mt-5 space-y-2 text-sm">
                <li className="flex gap-2"><BadgeCheck size={16} className="mt-0.5 text-ok" /> Drop in ExampleRWAToken pattern</li>
                <li className="flex gap-2"><BadgeCheck size={16} className="mt-0.5 text-ok" /> Hot path reads from Redis cache</li>
                <li className="flex gap-2"><BadgeCheck size={16} className="mt-0.5 text-ok" /> Monitor relay for two signal revoke</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Steps */}
        <section id="flow" className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6 md:py-20">
          <h2 className="section-title">Live in four steps.</h2>
          <p className="section-copy">From wallet connect to gated transfer without a custom compliance stack.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {[
              { t: "Connect", d: "Link a wallet or paste an address.", icon: "/illustrations/wallet.svg" },
              { t: "Verify", d: "Issuer posts a hashed commitment.", icon: "/illustrations/fingerprint.svg" },
              { t: "Confirm", d: "Credential lands in the registry.", icon: "/illustrations/file-check.svg" },
              { t: "Gate", d: "RWA transfers check isValid.", icon: "/illustrations/gate.svg" },
            ].map((step, i) => (
              <motion.div
                key={step.t}
                className="panel p-5"
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ delay: i * 0.05 }}
              >
                <img src={step.icon} alt="" className="mb-4 h-10 w-10" loading="lazy" />
                <h3 className="font-semibold">{step.t}</h3>
                <p className="mt-1 text-sm text-mute">{step.d}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Architecture strip */}
        <section className="border-y border-line bg-white/40 py-16">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-4 md:grid-cols-2 md:px-6">
            <div>
              <h2 className="section-title">One check for every gated asset.</h2>
              <p className="section-copy">
                Frontends, workers, and tokens all read the same CredentialRegistry. Cache keeps status fast.
                Chain stays the source of truth.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {["Wallets", "RWA apps", "Issuers", "Monitor", "Indexers"].map((item) => (
                  <span key={item} className="glass px-3 py-2 text-xs font-medium text-mute">
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <div className="panel p-6">
              <img
                src="/illustrations/data-transfer.svg"
                alt="Secure compliance endpoint"
                className="mb-5 h-44 w-full object-contain"
                loading="lazy"
              />
              <div className="mb-4 flex items-center gap-2 text-soft">
                <Lock size={18} />
                <span className="text-sm font-semibold">Secure compliance endpoint</span>
              </div>
              <div className="space-y-3 text-sm">
                <div className="glass px-3 py-3">
                  <p className="font-medium">BOTGUARD API</p>
                  <p className="text-mute">Verify · renew · revoke · status</p>
                </div>
                <div className="glass px-3 py-3">
                  <p className="font-medium">Contracts</p>
                  <p className="text-mute">IssuerRegistry · CredentialRegistry · ComplianceGate</p>
                </div>
                <div className="rounded-btn border border-brand/50 bg-brand/10 px-3 py-3">
                  <p className="font-medium text-soft">Result</p>
                  <p className="text-mute">Shared permission layer for BOT Chain RWA</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="relative overflow-hidden border-t border-line bg-[#faf9fc] py-16 md:py-24">
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden="true"
            style={{
              background:
                "radial-gradient(ellipse 50% 40% at 50% 0%, rgba(138,63,252,0.07), transparent 70%)",
            }}
          />
          <div className="relative mx-auto w-full max-w-3xl px-4 md:px-6">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Support</p>
              <h2 className="section-title mt-3">Questions, answered.</h2>
              <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-mute">
                Clear answers on how BOTGUARD verifies wallets, keeps identity off chain, and gates RWA transfers.
              </p>
            </div>

            <div className="mt-10 space-y-3">
              {faqs.map((item, idx) => {
                const open = openFaq === idx;
                return (
                  <motion.div
                    key={item.q}
                    className={`overflow-hidden rounded-2xl border bg-white transition-shadow ${
                      open
                        ? "border-brand/25 shadow-[0_12px_40px_rgba(138,63,252,0.1)]"
                        : "border-neutral-200/80 hover:border-neutral-300"
                    }`}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ delay: idx * 0.04 }}
                  >
                    <button
                      type="button"
                      className="flex w-full items-center gap-4 px-5 py-5 text-left md:px-6"
                      onClick={() => setOpenFaq(open ? -1 : idx)}
                      aria-expanded={open}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition ${
                          open ? "bg-brand text-white" : "bg-[#f3f0fa] text-brand"
                        }`}
                      >
                        {open ? <Minus size={16} strokeWidth={2.4} /> : <Plus size={16} strokeWidth={2.4} />}
                      </span>
                      <span className="flex-1 text-[15px] font-semibold leading-snug text-ink md:text-base">
                        {item.q}
                      </span>
                    </button>
                    <AnimatePresence initial={false}>
                      {open ? (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                          className="overflow-hidden"
                        >
                          <p className="border-t border-neutral-100 px-5 pb-5 pt-4 text-sm leading-relaxed text-mute md:px-6 md:pl-[4.25rem]">
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
        <section className="border-t border-line py-16 md:py-20">
          <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
            <div className="panel flex flex-col items-start justify-between gap-6 p-8 md:flex-row md:items-center">
              <div>
                <h2 className="text-3xl font-bold tracking-tight">Ship your first gate today.</h2>
                <p className="mt-2 max-w-xl text-mute">
                  Open the demo, issue a credential, and watch status flip to valid.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" className="btn-primary" onClick={() => setDemoOpen(true)}>
                  Open demo
                </button>
                <a className="btn-ghost" href="#product">
                  <Boxes size={16} />
                  See product
                </a>
              </div>
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
                  Compliance registry for BOT Chain RWA. Verify once, gate transfers, and keep identity off chain.
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
                  <li>
                    <button
                      type="button"
                      onClick={() => setDemoOpen(true)}
                      className="text-sm text-neutral-500 transition-colors hover:text-ink"
                    >
                      Demo
                    </button>
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

      {/* Wallet modal */}
      <Modal
        open={walletOpen}
        onClose={() => {
          setWalletOpen(false);
          setWalletError("");
          setWalletSuccess("");
        }}
        title={connected ? "Wallet" : "Connect"}
      >
        <p className="text-sm text-mute">
          {hasInjectedWallet
            ? "Connect with your browser wallet, or paste an address for read-only use."
            : "No browser wallet detected. Paste an address, or install MetaMask."}
        </p>

        {connected ? (
          <div className="mt-4 space-y-3">
            <div className="glass p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-mute">Connected</p>
                  <p className="mt-1 font-medium text-ink break-all">{account}</p>
                </div>
                <StatusPill ok label={chainLabel || "Ready"} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-ghost" onClick={copyAddress}>
                <Copy size={16} />
                Copy
              </button>
              {hasInjectedWallet ? (
                <button type="button" className="btn-ghost" onClick={connectWallet} disabled={connecting}>
                  <Wallet size={16} />
                  {connecting ? "Switching…" : "Switch account"}
                </button>
              ) : null}
              <button type="button" className="btn-ghost" onClick={disconnectWallet}>
                <LogOut size={16} />
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <button
              type="button"
              className="btn-primary w-full justify-center"
              onClick={connectWallet}
              disabled={connecting || !hasInjectedWallet}
            >
              <Wallet size={16} />
              {connecting ? "Connecting…" : hasInjectedWallet ? "Connect wallet" : "Wallet not available"}
            </button>
            {!hasInjectedWallet ? (
              <a
                className="btn-ghost w-full justify-center"
                href="https://metamask.io/download/"
                target="_blank"
                rel="noreferrer"
              >
                Install MetaMask
              </a>
            ) : null}
            <div>
              <label className="block text-xs font-medium text-mute">
                Or paste address
                <input
                  className="field mt-1.5"
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  placeholder="0x…"
                  spellCheck={false}
                />
              </label>
              <button type="button" className="btn-ghost mt-3" onClick={useManualAddress}>
                Use address
              </button>
            </div>
          </div>
        )}

        <Alert type="error">{walletError}</Alert>
        <Alert type="success">{walletSuccess}</Alert>
      </Modal>

      {/* Demo modal */}
      <Modal open={demoOpen} onClose={() => { setDemoOpen(false); setError(""); setSuccess(""); }} title="Verification demo">
        <div className="space-y-3">
          <label className="block text-xs font-medium text-mute">
            Holder address
            <input
              className="field mt-1.5"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="0x… or connect wallet"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-mute">
              Tier
              <select className="field mt-1.5" value={tier} onChange={(e) => setTier(e.target.value)}>
                <option value="RETAIL">Retail</option>
                <option value="ACCREDITED">Accredited</option>
                <option value="INSTITUTIONAL">Institutional</option>
              </select>
            </label>
            <label className="block text-xs font-medium text-mute">
              Region
              <select className="field mt-1.5" value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)}>
                <option value="NG">NG</option>
                <option value="US">US</option>
                <option value="GB">GB</option>
                <option value="EU">EU</option>
              </select>
            </label>
          </div>

          <div className="glass p-3 text-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-mute">Status</span>
              <StatusPill ok={valid} label={valid ? "Valid" : verification?.status || "Idle"} />
            </div>
            <div className="space-y-1 text-xs text-mute">
              <div className="flex justify-between"><span>Request</span><span className="text-ink">{verificationId ? shortAddr(verificationId) : "—"}</span></div>
              <div className="flex justify-between"><span>Tx</span><span className="text-ink">{verification?.txHash ? shortAddr(verification.txHash) : "—"}</span></div>
              <div className="flex justify-between"><span>Tier</span><span className="text-ink">{credential?.tier || "—"}</span></div>
            </div>
          </div>

          <Alert type="error">{error}</Alert>
          <Alert type="success">{success}</Alert>

          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" className="btn-primary" disabled={busy} onClick={submitVerification}>
              {busy ? "Working…" : "Submit verification"}
            </button>
            <button type="button" className="btn-ghost" onClick={refreshCredential}>
              Check status
            </button>
            <button type="button" className="btn-muted" disabled={busy || !valid} onClick={revokeCredential}>
              Revoke
            </button>
            <button type="button" className="btn-ghost" onClick={openWalletModal}>
              <Wallet size={16} />
              Wallet
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
