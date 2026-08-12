import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  FileSearch,
  Globe2,
  HelpCircle,
  Layers3,
  Minus,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import Alert from "../components/Alert.jsx";
import { shortAddr } from "../lib/api.js";

function StatusPill({ ok, label }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
        ok
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80"
          : "bg-neutral-100 text-mute ring-1 ring-neutral-200/80"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-neutral-400"}`} />
      {label}
    </span>
  );
}

function PageHero({ eyebrow, title, copy, icon: Icon }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-neutral-200/80 bg-white px-5 py-6 sm:px-8 sm:py-8">
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-brand/[0.07] blur-2xl"
        aria-hidden="true"
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-xl">
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">{eyebrow}</p>
          ) : null}
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{title}</h1>
          <p className="mt-2 text-sm font-normal leading-relaxed text-mute sm:text-[15px]">{copy}</p>
        </div>
        {Icon ? (
          <motion.div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#f4f0ff] text-brand"
            whileHover={{ scale: 1.05, rotate: -3 }}
            transition={{ type: "spring", stiffness: 320, damping: 18 }}
          >
            <Icon size={26} strokeWidth={1.75} />
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}

function ActionTile({ icon: Icon, title, copy, onClick, accent = false }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      className={`group flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition ${
        accent
          ? "border-brand/20 bg-brand text-white shadow-[0_12px_28px_rgba(138,63,252,0.22)]"
          : "border-neutral-200/90 bg-white hover:border-neutral-300 hover:shadow-[0_10px_28px_rgba(0,0,0,0.05)]"
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
          accent ? "bg-white/15 text-white" : "bg-[#f4f0ff] text-brand group-hover:bg-brand group-hover:text-white"
        }`}
      >
        <Icon size={18} strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm font-semibold ${accent ? "text-white" : "text-ink"}`}>{title}</span>
        <span className={`mt-0.5 block text-xs leading-relaxed ${accent ? "text-white/80" : "text-mute"}`}>
          {copy}
        </span>
      </span>
      <ArrowRight
        size={16}
        className={`mt-1 shrink-0 transition group-hover:translate-x-0.5 ${
          accent ? "text-white/80" : "text-mute"
        }`}
      />
    </motion.button>
  );
}

function Metric({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-neutral-100 bg-[#fafafa] px-3.5 py-3">
      <div className="flex items-center gap-1.5 text-mute">
        <Icon size={13} strokeWidth={2} />
        <p className="text-[11px] font-medium">{label}</p>
      </div>
      <p className="mt-1.5 truncate text-sm font-semibold text-ink">{value || "—"}</p>
    </div>
  );
}

function StatusRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-neutral-100 bg-[#fafafa] px-3.5 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-brand ring-1 ring-neutral-200/70">
        <Icon size={16} strokeWidth={1.9} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-mute">{label}</p>
        <p className="truncate text-sm font-semibold text-ink">{value || "—"}</p>
      </div>
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
    <main className="font-poppins mx-auto w-full max-w-5xl px-4 py-8 md:px-6 md:py-10">
      <AnimatePresence mode="wait">
        {view === "home" ? (
          <motion.div
            key="home"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28 }}
            className="space-y-5"
          >
            <PageHero
              eyebrow="Dashboard"
              title={valid ? "You're cleared to move." : "Let's get this wallet verified."}
              copy={
                valid
                  ? "Your credential is live. Gated apps and tokens can trust this wallet without another KYC run."
                  : "Verify once. Gate every transfer after that. Personal data never lands on chain."
              }
              icon={valid ? BadgeCheck : Sparkles}
            />

            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-3xl border border-neutral-200/80 bg-white p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#f4f0ff] text-brand">
                      <Wallet size={20} strokeWidth={1.8} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-mute">Connected wallet</p>
                      <p className="mt-1 truncate font-mono text-sm font-semibold tracking-tight text-ink">
                        {shortAddr(account)}
                      </p>
                      <p className="mt-1 text-xs text-mute">{chainLabel || "Network ready"}</p>
                    </div>
                  </div>
                  <StatusPill ok={valid} label={valid ? "Valid pass" : "Needs verify"} />
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2.5">
                  <Metric icon={Layers3} label="Tier" value={credential?.tier} />
                  <Metric icon={Globe2} label="Region" value={credential?.jurisdiction} />
                  <Metric
                    icon={ShieldCheck}
                    label="Expires"
                    value={
                      credential?.expiresAt
                        ? new Date(credential.expiresAt).toLocaleDateString()
                        : null
                    }
                  />
                </div>

                <motion.button
                  type="button"
                  className="btn-primary mt-5 h-11 w-full"
                  onClick={() => setView("verify")}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.99 }}
                >
                  {valid ? "Renew or update pass" : "Verify this wallet"}
                  <ArrowRight size={16} />
                </motion.button>
              </div>

              <div className="space-y-2.5">
                <ActionTile
                  accent
                  icon={valid ? CheckCircle2 : ShieldCheck}
                  title={valid ? "Pass is active" : "Issue your pass"}
                  copy={
                    valid
                      ? "Reuse this status across BOT Chain apps and tokens."
                      : "Pick a tier and region, then submit in one step."
                  }
                  onClick={() => setView("verify")}
                />
                <ActionTile
                  icon={FileSearch}
                  title="Check full status"
                  copy="See tier, region, expiry, and live request state."
                  onClick={() => setView("status")}
                />
                <ActionTile
                  icon={HelpCircle}
                  title="Quick answers"
                  copy="How hashing, revoke, and gating work — in plain words."
                  onClick={() => setView("help")}
                />
              </div>
            </div>
          </motion.div>
        ) : null}

        {view === "status" ? (
          <motion.div
            key="status"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28 }}
            className="space-y-5"
          >
            <PageHero
              eyebrow="Status"
              title="What's on record for this wallet"
              copy="A clean read of your credential — hash, tier, region, and expiry. Never your identity."
              icon={FileSearch}
            />

            <div className="mx-auto max-w-xl rounded-3xl border border-neutral-200/80 bg-white p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#f4f0ff] text-brand">
                    <Wallet size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-mute">Wallet</p>
                    <p className="truncate font-mono text-sm font-semibold">{shortAddr(account)}</p>
                  </div>
                </div>
                <StatusPill ok={valid} label={valid ? "Valid" : "No credential"} />
              </div>

              <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                <StatusRow icon={Layers3} label="Tier" value={credential?.tier} />
                <StatusRow icon={Globe2} label="Region" value={credential?.jurisdiction} />
                <StatusRow
                  icon={RefreshCw}
                  label="Request"
                  value={verification?.status || "Ready"}
                />
                <StatusRow
                  icon={ShieldCheck}
                  label="Expires"
                  value={
                    credential?.expiresAt
                      ? new Date(credential.expiresAt).toLocaleDateString()
                      : null
                  }
                />
                <div className="sm:col-span-2">
                  <StatusRow icon={Sparkles} label="Network" value={chainLabel || null} />
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <motion.button
                  type="button"
                  className="btn-primary h-11 flex-1"
                  onClick={onRefresh}
                  disabled={busy}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <RefreshCw size={15} className={busy ? "animate-spin" : ""} />
                  {busy ? "Refreshing…" : "Refresh status"}
                </motion.button>
                <button type="button" className="btn-ghost h-11 flex-1" onClick={() => setView("verify")}>
                  Go to verify
                </button>
              </div>
              <Alert type="error">{error}</Alert>
              <Alert type="success">{success}</Alert>
            </div>
          </motion.div>
        ) : null}

        {view === "verify" ? (
          <motion.div
            key="verify"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28 }}
            className="space-y-5"
          >
            <PageHero
              eyebrow="Verify"
              title="Issue your on-chain pass"
              copy="Choose a tier and region. We post a hash — never your documents or personal details."
              icon={ShieldCheck}
            />

            <div className="mx-auto max-w-xl rounded-3xl border border-neutral-200/80 bg-white p-5 sm:p-6">
              <div className="flex items-start gap-3 rounded-2xl bg-[#fafafa] px-3.5 py-3 ring-1 ring-neutral-100">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-brand ring-1 ring-neutral-200/70">
                  <Wallet size={16} />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-mute">Holder address</p>
                  <p className="mt-0.5 break-all font-mono text-xs font-semibold leading-relaxed text-ink">
                    {account}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="block text-[11px] font-medium text-mute">
                  <span className="mb-1.5 inline-flex items-center gap-1.5">
                    <Layers3 size={12} /> Tier
                  </span>
                  <select className="field mt-1.5 h-11 text-sm font-medium" value={tier} onChange={(e) => setTier(e.target.value)}>
                    <option value="RETAIL">Retail</option>
                    <option value="ACCREDITED">Accredited</option>
                    <option value="INSTITUTIONAL">Institutional</option>
                  </select>
                </label>
                <label className="block text-[11px] font-medium text-mute">
                  <span className="mb-1.5 inline-flex items-center gap-1.5">
                    <Globe2 size={12} /> Region
                  </span>
                  <select
                    className="field mt-1.5 h-11 text-sm font-medium"
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

              <div className="mt-4 rounded-2xl border border-neutral-200/80 px-3.5 py-3.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-ink">Live pipeline</p>
                  <StatusPill ok={valid} label={valid ? "Valid" : verification?.status || "Idle"} />
                </div>
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-mute">Request ID</span>
                    <span className="font-mono font-medium text-ink">
                      {verificationId ? shortAddr(verificationId) : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-mute">Transaction</span>
                    <span className="font-mono font-medium text-ink">
                      {verification?.txHash ? shortAddr(verification.txHash) : "—"}
                    </span>
                  </div>
                </div>
              </div>

              <Alert type="error">{error}</Alert>
              <Alert type="success">{success}</Alert>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <motion.button
                  type="button"
                  className="btn-primary h-11 flex-1"
                  disabled={busy}
                  onClick={onVerify}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <ShieldCheck size={15} />
                  {busy ? "Submitting…" : "Submit verification"}
                </motion.button>
                <button type="button" className="btn-ghost h-11 flex-1" disabled={busy} onClick={onRefresh}>
                  <RefreshCw size={15} />
                  Check status
                </button>
              </div>
              <button
                type="button"
                className="btn-muted mt-2 h-10 w-full text-xs"
                disabled={busy || !valid}
                onClick={onRevoke}
              >
                Revoke credential
              </button>
            </div>
          </motion.div>
        ) : null}

        {view === "help" ? (
          <motion.div
            key="help"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28 }}
            className="space-y-5"
          >
            <PageHero
              eyebrow="Help"
              title="Answers in plain language"
              copy="Everything you need while you verify, renew, or troubleshoot a gated transfer."
              icon={HelpCircle}
            />

            <div className="mx-auto max-w-2xl space-y-2.5">
              {faqs.map((item, idx) => {
                const open = openFaq === idx;
                return (
                  <motion.div
                    key={item.q}
                    layout
                    className={`overflow-hidden rounded-2xl border bg-white transition ${
                      open ? "border-neutral-300 shadow-[0_10px_28px_rgba(0,0,0,0.05)]" : "border-neutral-200/80"
                    }`}
                  >
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-4 py-3.5 text-left sm:px-5"
                      onClick={() => setOpenFaq(open ? -1 : idx)}
                      aria-expanded={open}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition ${
                          open ? "bg-brand text-white" : "bg-[#f4f0ff] text-brand"
                        }`}
                      >
                        {open ? <Minus size={14} strokeWidth={2.4} /> : <Plus size={14} strokeWidth={2.4} />}
                      </span>
                      <span className="flex-1 text-sm font-semibold leading-snug text-ink">{item.q}</span>
                    </button>
                    <AnimatePresence initial={false}>
                      {open ? (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                          className="overflow-hidden"
                        >
                          <p className="border-t border-neutral-100 px-4 pb-4 pt-3 text-sm font-normal leading-relaxed text-mute sm:px-5 sm:pl-[3.75rem]">
                            {item.a}
                          </p>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
