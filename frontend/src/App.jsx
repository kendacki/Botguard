import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BrowserProvider, keccak256, toUtf8Bytes } from "ethers";
import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  Check,
  ChevronDown,
  Github,
  Lock,
  Shield,
  Sparkles,
  Wallet,
} from "lucide-react";
import Logo from "./components/Logo.jsx";
import Modal from "./components/Modal.jsx";
import Alert from "./components/Alert.jsx";
import { api, DEMO_API_KEY, shortAddr } from "./lib/api.js";

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45 } },
};

const tabs = [
  {
    id: "issuers",
    label: "Issuers",
    title: "Issuers",
    body: "Register trusted verifiers with clear trust tiers. Governance stays in control.",
  },
  {
    id: "credentials",
    label: "Credentials",
    title: "Credentials",
    body: "Store hashed commitments only. Tier, region, expiry, and revoke state live on chain.",
  },
  {
    id: "gates",
    label: "Gates",
    title: "Gates",
    body: "Any RWA token can inherit ComplianceGate and block unsafe transfers before they settle.",
  },
  {
    id: "monitor",
    label: "Monitor",
    title: "Monitor",
    body: "Rule based flags. Auto revoke needs two strong signals. One noisy rule never cuts access alone.",
  },
];

const faqs = [
  {
    q: "What is BOTGUARD?",
    a: "A shared compliance registry for BOT Chain RWA apps. Verify a wallet once. Reuse that status across gated assets.",
  },
  {
    q: "Does identity go on chain?",
    a: "No. Only a hash commitment, investor tier, region code, expiry, and revoke state are written.",
  },
  {
    q: "Who can revoke a credential?",
    a: "The issuer, governance, or an authorized monitor relay. The monitor path uses a two signal rule.",
  },
  {
    q: "How do RWA tokens integrate?",
    a: "Point ComplianceGate at CredentialRegistry and call isValid in transfer hooks. Frontends can precheck first.",
  },
];

function StatusPill({ ok, label }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
        ok ? "border-ok/40 bg-ok/10 text-ok" : "border-line bg-ink text-mute"
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
  const [deployment, setDeployment] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("issuers");
  const [openFaq, setOpenFaq] = useState(0);
  const [apiOk, setApiOk] = useState(false);

  const active = useMemo(() => tabs.find((t) => t.id === activeTab) || tabs[0], [activeTab]);
  const valid = Boolean(credential?.valid);

  useEffect(() => {
    api("/healthz")
      .then(() => setApiOk(true))
      .catch(() => setApiOk(false));
    api("/issuers")
      .then((d) => setIssuers(Array.isArray(d) ? d : d.issuers || []))
      .catch(() => setIssuers([]));
    fetch("/deployments/localhost.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setDeployment(d))
      .catch(() => setDeployment(null));
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

  async function connectWallet() {
    setError("");
    setSuccess("");
    try {
      if (!window.ethereum) {
        setError("No wallet found. Paste an address instead.");
        return;
      }
      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      setAccount(accounts[0]);
      setSuccess("Wallet connected.");
      setWalletOpen(false);
      try {
        setCredential(await api(`/credentials/${accounts[0]}`));
      } catch {
        setCredential(null);
      }
    } catch (err) {
      setError(err.message || "Wallet connection failed.");
    }
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
    <div className="min-h-screen bg-ink text-white">
      <header className="sticky top-0 z-40 border-b border-line bg-ink/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 md:px-6">
          <a href="#top" className="flex items-center gap-2.5">
            <Logo className="h-8 w-8" />
            <span className="text-sm font-semibold tracking-wide">BOTGUARD</span>
          </a>
          <nav className="hidden items-center gap-6 text-sm text-mute md:flex">
            <a href="#product" className="hover:text-white">Product</a>
            <a href="#catalog" className="hover:text-white">Catalog</a>
            <a href="#flow" className="hover:text-white">Flow</a>
            <a href="#faq" className="hover:text-white">FAQs</a>
          </nav>
          <div className="flex items-center gap-2">
            <a
              className="btn-ghost hidden sm:inline-flex"
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
            >
              <Github size={16} />
              GitHub
            </a>
            <button type="button" className="btn-primary" onClick={() => setDemoOpen(true)}>
              Open demo
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        {/* Hero */}
        <section className="mx-auto grid w-full max-w-6xl gap-10 px-4 pb-16 pt-14 md:grid-cols-2 md:px-6 md:pb-24 md:pt-20">
          <motion.div variants={fadeUp} initial="hidden" animate="show">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1 text-xs font-medium text-soft">
              <Sparkles size={14} />
              BOT Chain compliance registry
            </div>
            <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
              Verify. Gate.
              <br />
              Trust.
            </h1>
            <p className="section-copy">
              One registry for RWA wallets on BOT Chain. Issue a credential once. Gate every transfer
              that follows. No personal data on chain.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button type="button" className="btn-primary" onClick={() => setDemoOpen(true)}>
                Launch demo
                <ArrowRight size={16} />
              </button>
              <button type="button" className="btn-ghost" onClick={() => setWalletOpen(true)}>
                <Wallet size={16} />
                Connect wallet
              </button>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-mute">
              <StatusPill ok={apiOk} label={apiOk ? "API online" : "API offline"} />
              {account ? <StatusPill ok label={shortAddr(account)} /> : null}
              {deployment?.contracts?.CredentialRegistry ? (
                <StatusPill ok={false} label={`Registry ${shortAddr(deployment.contracts.CredentialRegistry)}`} />
              ) : null}
            </div>
          </motion.div>

          <motion.div
            className="panel overflow-hidden shadow-soft"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3 text-xs text-mute">
              <span>~/botguard — registry</span>
              <span className="text-soft">Open source</span>
            </div>
            <div className="space-y-2 px-4 py-5 font-mono text-[13px] leading-6 text-soft">
              <p>
                <span className="text-mute">$</span> botguard issue --tier RETAIL --region NG
              </p>
              <p className="text-mute">→ hashing commitment</p>
              <p className="text-mute">→ submitting CredentialRegistry</p>
              <p className="text-ok">✓ credential confirmed</p>
              <p>
                <span className="text-mute">$</span> botguard gate check 0x90F7…b906
                <span className="cursor-blink">▌</span>
              </p>
            </div>
            <div className="border-t border-line p-4">
              <img
                src="https://images.unsplash.com/photo-1639763482123-ff4626c1d4d2?auto=format&fit=crop&w=1200&q=80"
                alt="Abstract ledger visual"
                className="h-40 w-full rounded-btn object-cover opacity-90"
              />
            </div>
          </motion.div>
        </section>

        {/* Product tabs */}
        <section id="product" className="border-y border-line bg-panel/40 py-16 md:py-20">
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
                      : "border border-line bg-ink text-mute hover:text-white"
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
                  <ul className="mt-5 space-y-2 text-sm text-white/90">
                    <li className="flex items-center gap-2"><Check size={16} className="text-ok" /> Hashed commitments only</li>
                    <li className="flex items-center gap-2"><Check size={16} className="text-ok" /> Tier and region aware gates</li>
                    <li className="flex items-center gap-2"><Check size={16} className="text-ok" /> Fast status reads from cache</li>
                  </ul>
                </div>
                <div className="rounded-btn border border-line bg-ink p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium text-soft">
                    <Shield size={16} /> Live surface
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between border-b border-line pb-2">
                      <span className="text-mute">Active issuers</span>
                      <span>{issuers.length || 1}</span>
                    </div>
                    <div className="flex justify-between border-b border-line pb-2">
                      <span className="text-mute">Demo status</span>
                      <span>{valid ? "Valid" : "Idle"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-mute">Auth header</span>
                      <span className="text-soft">X BOTGUARD Api Key</span>
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

          <div className="panel mt-8 overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-3 text-sm">
              <span className="text-mute">localhost:8080 / catalog</span>
              <div className="flex gap-2">
                <span className="rounded-btn bg-brand px-3 py-1 text-xs font-semibold">Catalog</span>
                <span className="rounded-btn border border-line px-3 py-1 text-xs text-mute">Deployed</span>
              </div>
            </div>
            <div className="grid md:grid-cols-2">
              <div className="border-b border-line p-5 md:border-b-0 md:border-r">
                <h3 className="mb-3 text-sm font-semibold text-soft">Issuers</h3>
                <div className="space-y-3">
                  {(issuers.length ? issuers : [{ name: "BOTGUARD Demo Issuer", address: "0x7099…79C8", trustTier: 1, active: true }]).map((issuer) => (
                    <div key={issuer.address} className="rounded-btn border border-line bg-ink p-3">
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
                <div className="rounded-btn border border-line bg-ink p-4 text-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-mute">Validity</span>
                    <StatusPill ok={valid} label={valid ? "Valid" : "None"} />
                  </div>
                  <div className="space-y-2 text-mute">
                    <div className="flex justify-between"><span>Tier</span><span className="text-white">{credential?.tier || "—"}</span></div>
                    <div className="flex justify-between"><span>Region</span><span className="text-white">{credential?.jurisdiction || "—"}</span></div>
                    <div className="flex justify-between"><span>Request</span><span className="text-white">{verification?.status || "—"}</span></div>
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
        <section className="border-y border-line bg-panel/40 py-16 md:py-20">
          <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 md:grid-cols-2 md:px-6">
            <div className="panel p-6">
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
              { n: "1", t: "Connect", d: "Link a wallet or paste an address." },
              { n: "2", t: "Verify", d: "Issuer posts a hashed commitment." },
              { n: "3", t: "Confirm", d: "Credential lands in the registry." },
              { n: "4", t: "Gate", d: "RWA transfers check isValid." },
            ].map((step, i) => (
              <motion.div
                key={step.n}
                className="panel p-5"
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ delay: i * 0.05 }}
              >
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-btn bg-brand text-sm font-bold">
                  {step.n}
                </div>
                <h3 className="font-semibold">{step.t}</h3>
                <p className="mt-1 text-sm text-mute">{step.d}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Architecture strip */}
        <section className="border-y border-line bg-panel/40 py-16">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 md:grid-cols-2 md:px-6">
            <div>
              <h2 className="section-title">One check for every gated asset.</h2>
              <p className="section-copy">
                Frontends, workers, and tokens all read the same CredentialRegistry. Cache keeps status fast.
                Chain stays the source of truth.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {["Wallets", "RWA apps", "Issuers", "Monitor", "Indexers"].map((item) => (
                  <span key={item} className="rounded-btn border border-line bg-ink px-3 py-2 text-xs font-medium text-mute">
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <div className="panel p-6">
              <div className="mb-4 flex items-center gap-2 text-soft">
                <Lock size={18} />
                <span className="text-sm font-semibold">Secure compliance endpoint</span>
              </div>
              <div className="space-y-3 text-sm">
                <div className="rounded-btn border border-line bg-ink px-3 py-3">
                  <p className="font-medium">BOTGUARD API</p>
                  <p className="text-mute">Verify · renew · revoke · status</p>
                </div>
                <div className="rounded-btn border border-line bg-ink px-3 py-3">
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
        <section id="faq" className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6 md:py-20">
          <h2 className="section-title">FAQs</h2>
          <div className="mt-8 divide-y divide-line rounded-panel border border-line bg-panel">
            {faqs.map((item, idx) => {
              const open = openFaq === idx;
              return (
                <div key={item.q}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                    onClick={() => setOpenFaq(open ? -1 : idx)}
                  >
                    <span className="text-sm font-semibold md:text-base">{item.q}</span>
                    <ChevronDown size={18} className={`shrink-0 text-mute transition ${open ? "rotate-180" : ""}`} />
                  </button>
                  <AnimatePresence initial={false}>
                    {open ? (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <p className="px-5 pb-4 text-sm text-mute">{item.a}</p>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              );
            })}
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

      <footer className="border-t border-line py-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="flex items-center gap-2.5">
            <Logo className="h-7 w-7" />
            <div>
              <p className="text-sm font-semibold">BOTGUARD</p>
              <p className="text-xs text-mute">Compliance registry for BOT Chain RWA</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-mute">
            <a href="#product" className="hover:text-white">Product</a>
            <a href="#catalog" className="hover:text-white">Catalog</a>
            <a href="#faq" className="hover:text-white">FAQs</a>
            <a href="#flow" className="hover:text-white">Flow</a>
          </div>
        </div>
      </footer>

      {/* Wallet modal */}
      <Modal open={walletOpen} onClose={() => setWalletOpen(false)} title="Connect wallet">
        <p className="text-sm text-mute">Use MetaMask or any injected wallet. You can also paste an address in the demo.</p>
        <Alert type="error">{error}</Alert>
        <Alert type="success">{success}</Alert>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" className="btn-primary" onClick={connectWallet}>
            <Wallet size={16} />
            Connect
          </button>
          <button type="button" className="btn-ghost" onClick={() => setWalletOpen(false)}>
            Cancel
          </button>
        </div>
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

          <div className="rounded-btn border border-line bg-ink p-3 text-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-mute">Status</span>
              <StatusPill ok={valid} label={valid ? "Valid" : verification?.status || "Idle"} />
            </div>
            <div className="space-y-1 text-xs text-mute">
              <div className="flex justify-between"><span>Request</span><span className="text-white">{verificationId ? shortAddr(verificationId) : "—"}</span></div>
              <div className="flex justify-between"><span>Tx</span><span className="text-white">{verification?.txHash ? shortAddr(verification.txHash) : "—"}</span></div>
              <div className="flex justify-between"><span>Tier</span><span className="text-white">{credential?.tier || "—"}</span></div>
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
            <button type="button" className="btn-ghost" onClick={() => setWalletOpen(true)}>
              <Wallet size={16} />
              Wallet
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
