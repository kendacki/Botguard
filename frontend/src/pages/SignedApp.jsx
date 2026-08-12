import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Minus, Plus } from "lucide-react";
import Alert from "../components/Alert.jsx";
import { shortAddr } from "../lib/api.js";

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

function PageIntro({ title, copy }) {
  return (
    <div className="mx-auto max-w-xl text-center">
      <h1 className="section-title">{title}</h1>
      <p className="mx-auto mt-2 text-sm leading-relaxed text-mute md:text-base">{copy}</p>
    </div>
  );
}

function FieldCard({ label, value }) {
  return (
    <div className="rounded-xl bg-[#faf9fc] px-3 py-3 text-center">
      <p className="text-[11px] text-mute">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ink">{value || "None"}</p>
    </div>
  );
}

export default function SignedApp({
  view,
  setView,
  account,
  chainLabel,
  credential,
  valid,
  tier,
  setTier,
  jurisdiction,
  setJurisdiction,
  verification,
  verificationId,
  busy,
  error,
  success,
  openFaq,
  setOpenFaq,
  faqs,
  onVerify,
  onRefresh,
  onRevoke,
}) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 md:px-6 md:py-14">
      <AnimatePresence mode="wait">
        {view === "home" ? (
          <motion.div
            key="home"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <PageIntro
              title="Your wallet is ready"
              copy="See if this wallet can pass gated transfers, then verify in one short step."
            />

            <div className="mx-auto mt-8 grid max-w-3xl gap-4 md:grid-cols-[1.1fr_0.9fr]">
              <div className="panel p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-mute">Connected wallet</p>
                    <p className="mt-1 truncate font-mono text-sm font-semibold">{shortAddr(account)}</p>
                    <p className="mt-1 text-xs text-mute">{chainLabel || "Network ready"}</p>
                  </div>
                  <StatusPill ok={valid} label={valid ? "Valid" : "Needs verify"} />
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2">
                  <FieldCard label="Tier" value={credential?.tier} />
                  <FieldCard label="Region" value={credential?.jurisdiction} />
                  <FieldCard
                    label="Expires"
                    value={
                      credential?.expiresAt
                        ? new Date(credential.expiresAt).toLocaleDateString()
                        : null
                    }
                  />
                </div>

                <button type="button" className="btn-primary mt-5 w-full" onClick={() => setView("verify")}>
                  {valid ? "Renew or update" : "Verify this wallet"}
                  <ArrowRight size={16} />
                </button>
              </div>

              <div className="panel flex flex-col justify-between p-5 sm:p-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-brand">Next step</p>
                  <h2 className="mt-2 text-xl font-bold tracking-tight">
                    {valid ? "You're cleared to transfer" : "Get a credential first"}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-mute">
                    {valid
                      ? "Apps and tokens can read this same status. No need to verify again for every asset."
                      : "Choose a tier and region, submit once, and your status becomes reusable across BOT Chain apps."}
                  </p>
                </div>
                <div className="mt-6 flex flex-col gap-2">
                  <button type="button" className="btn-ghost w-full justify-center" onClick={() => setView("status")}>
                    View full status
                  </button>
                  <button type="button" className="btn-ghost w-full justify-center" onClick={() => setView("help")}>
                    Read quick FAQs
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}

        {view === "status" ? (
          <motion.div
            key="status"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <PageIntro
              title="Credential status"
              copy="A simple read of what is on record for this wallet. No personal data shown."
            />

            <div className="mx-auto mt-8 max-w-lg">
              <div className="panel p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-mute">Wallet</p>
                    <p className="mt-0.5 truncate font-mono text-sm font-semibold">{shortAddr(account)}</p>
                  </div>
                  <StatusPill ok={valid} label={valid ? "Valid" : "No credential"} />
                </div>

                <div className="mt-5 space-y-2.5 text-sm">
                  {[
                    ["Tier", credential?.tier],
                    ["Region", credential?.jurisdiction],
                    ["Request", verification?.status || "Ready"],
                    [
                      "Expires",
                      credential?.expiresAt
                        ? new Date(credential.expiresAt).toLocaleDateString()
                        : null,
                    ],
                    ["Network", chainLabel || "None"],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between rounded-xl bg-[#faf9fc] px-3.5 py-3"
                    >
                      <span className="text-mute">{label}</span>
                      <span className="font-semibold text-ink">{value || "None"}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <button type="button" className="btn-primary flex-1" onClick={onRefresh} disabled={busy}>
                    Refresh status
                  </button>
                  <button type="button" className="btn-ghost flex-1" onClick={() => setView("verify")}>
                    Go to verify
                  </button>
                </div>
                <Alert type="error">{error}</Alert>
                <Alert type="success">{success}</Alert>
              </div>
            </div>
          </motion.div>
        ) : null}

        {view === "verify" ? (
          <motion.div
            key="verify"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <PageIntro
              title="Verify wallet"
              copy="Pick a tier and region. We will post a hash on chain. Never your personal details."
            />

            <div className="mx-auto mt-8 max-w-lg">
              <div className="panel space-y-4 p-5 sm:p-6">
                <div className="rounded-xl bg-[#faf9fc] px-3.5 py-3">
                  <p className="text-xs text-mute">Holder</p>
                  <p className="mt-0.5 font-mono text-sm font-semibold break-all">{account}</p>
                </div>

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
                    <select
                      className="field mt-1.5"
                      value={jurisdiction}
                      onChange={(e) => setJurisdiction(e.target.value)}
                    >
                      <option value="NG">NG</option>
                      <option value="US">US</option>
                      <option value="GB">GB</option>
                      <option value="EU">EU</option>
                    </select>
                  </label>
                </div>

                <div className="rounded-xl border border-line/80 px-3.5 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-mute">Live status</span>
                    <StatusPill ok={valid} label={valid ? "Valid" : verification?.status || "Idle"} />
                  </div>
                  <div className="mt-3 space-y-1.5 text-xs text-mute">
                    <div className="flex justify-between">
                      <span>Request</span>
                      <span className="text-ink">{verificationId ? shortAddr(verificationId) : "None"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Transaction</span>
                      <span className="text-ink">
                        {verification?.txHash ? shortAddr(verification.txHash) : "None"}
                      </span>
                    </div>
                  </div>
                </div>

                <Alert type="error">{error}</Alert>
                <Alert type="success">{success}</Alert>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <button type="button" className="btn-primary flex-1" disabled={busy} onClick={onVerify}>
                    {busy ? "Submitting…" : "Submit verification"}
                  </button>
                  <button type="button" className="btn-ghost flex-1" disabled={busy} onClick={onRefresh}>
                    Check status
                  </button>
                </div>
                <button
                  type="button"
                  className="btn-muted w-full"
                  disabled={busy || !valid}
                  onClick={onRevoke}
                >
                  Revoke credential
                </button>
              </div>
            </div>
          </motion.div>
        ) : null}

        {view === "help" ? (
          <motion.div
            key="help"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <PageIntro title="Help" copy="Short answers while you verify and use your credential." />

            <div className="mx-auto mt-8 max-w-2xl space-y-2.5">
              {faqs.map((item, idx) => {
                const open = openFaq === idx;
                return (
                  <div
                    key={item.q}
                    className={`overflow-hidden rounded-2xl border bg-white transition-shadow ${
                      open
                        ? "border-brand/25 shadow-[0_10px_32px_rgba(138,63,252,0.08)]"
                        : "border-neutral-200/80"
                    }`}
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
                  </div>
                );
              })}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
