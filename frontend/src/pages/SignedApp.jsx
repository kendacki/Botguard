import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
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

const pageArt = {
  home: "/illustrations/dash/home.svg",
  status: "/illustrations/dash/status.svg",
  verify: "/illustrations/dash/verify.svg",
  help: "/illustrations/dash/help.svg",
};

function StatusPill({ ok, label }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium backdrop-blur-md ${
        ok
          ? "bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-400/30"
          : "bg-white/50 text-mute ring-1 ring-white/70"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-neutral-400"}`} />
      {label}
    </span>
  );
}

function PageHero({ eyebrow, title, copy, art }) {
  return (
    <div className="glass-card relative overflow-hidden px-5 py-6 sm:px-8 sm:py-7">
      <div
        className="pointer-events-none absolute -right-6 -top-10 h-44 w-44 rounded-full bg-brand/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-16 left-10 h-36 w-36 rounded-full bg-white/70 blur-2xl"
        aria-hidden="true"
      />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xl">
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">{eyebrow}</p>
          ) : null}
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{title}</h1>
          <p className="mt-2 text-sm font-normal leading-relaxed text-mute sm:text-[15px]">{copy}</p>
        </div>
        {art ? (
          <motion.img
            src={art}
            alt=""
            className="mx-auto h-[88px] w-[88px] shrink-0 drop-shadow-sm sm:mx-0 sm:h-[104px] sm:w-[104px]"
            whileHover={{ y: -4, rotate: -2 }}
            transition={{ type: "spring", stiffness: 280, damping: 16 }}
            draggable={false}
          />
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
      className={`group flex w-full items-start gap-3 rounded-2xl border p-4 text-left backdrop-blur-xl transition ${
        accent
          ? "border-brand/25 bg-brand/90 text-white shadow-[0_14px_36px_rgba(138,63,252,0.28)]"
          : "border-white/70 bg-white/45 hover:bg-white/70 hover:shadow-[0_12px_28px_rgba(0,0,0,0.06)]"
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
          accent
            ? "bg-white/15 text-white"
            : "border border-white/80 bg-white/60 text-brand group-hover:bg-brand group-hover:text-white"
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
    <div className="glass-soft px-3.5 py-3">
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
    <div className="glass-soft flex items-center gap-3 px-3.5 py-3">
      <span className="glass-icon h-9 w-9 shrink-0">
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
  onPayFee,
  onReject,
  feeStatus,
  feeBusy,
  feeEscrowed,
  verificationFeeLabel,
  explorerTxUrl,
  onRefresh,
  onRevoke,
}) {
  return (
    <div className="dash-shell min-h-[calc(100vh-4rem)]">
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
                art={pageArt.home}
              />

              <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="glass-card p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="glass-icon h-11 w-11 shrink-0">
                        <Wallet size={20} strokeWidth={1.8} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-mute">
                          Connected wallet
                        </p>
                        <p className="mt-1 truncate font-mono text-sm font-semibold tracking-tight text-ink">
                          {shortAddr(account)}
                        </p>
                        <p className="mt-1 text-xs text-mute">{chainLabel || "Network ready"}</p>
                      </div>
                    </div>
                    <StatusPill
                      ok={valid}
                      label={
                        valid
                          ? "Valid pass"
                          : verification?.status === "FAILED"
                            ? "Issue failed"
                            : feeEscrowed
                              ? "Fee paid"
                              : "Needs verify"
                      }
                    />
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
                        : feeEscrowed
                          ? "Your fee is escrowed. We are issuing the on-chain pass."
                          : "Pay 0.5 BOT once. We issue the pass automatically."
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
                art={pageArt.status}
              />

              <div className="glass-card mx-auto max-w-xl p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="glass-icon h-10 w-10 shrink-0">
                      <Wallet size={18} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-mute">Wallet</p>
                      <p className="truncate font-mono text-sm font-semibold">{shortAddr(account)}</p>
                    </div>
                  </div>
                  <StatusPill
                    ok={valid}
                    label={
                      valid
                        ? "Valid"
                        : verification?.status === "FAILED"
                          ? "Issue failed"
                          : ["PENDING", "IN_REVIEW", "SIGNED", "SUBMITTED"].includes(
                              verification?.status
                            )
                            ? "Issuing"
                            : feeEscrowed
                              ? "Fee paid"
                              : "No credential"
                    }
                  />
                </div>

                <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                  <StatusRow icon={Layers3} label="Tier" value={credential?.tier} />
                  <StatusRow icon={Globe2} label="Region" value={credential?.jurisdiction} />
                  <StatusRow icon={RefreshCw} label="Request" value={verification?.status || "Ready"} />
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

                {!valid && !credential ? (
                  <p className="mt-4 text-sm leading-relaxed text-mute">
                    {verification?.status === "FAILED"
                      ? verification.failureReason || "Issue failed. Open Verify to retry."
                      : feeEscrowed
                        ? "Fee is paid. Your pass should appear here after the issue transaction confirms."
                        : "No on-chain pass yet. Open Verify, pay the fee, and we issue the credential automatically."}
                  </p>
                ) : null}

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
                copy="Pay the verification fee from this wallet. We issue the hashed pass on BOT Chain right after confirmation."
                art={pageArt.verify}
              />

              <div className="glass-card mx-auto max-w-xl p-5 sm:p-6">
                <div className="glass-soft flex items-start gap-3 px-3.5 py-3">
                  <span className="glass-icon mt-0.5 h-9 w-9 shrink-0">
                    <Wallet size={16} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-mute">Holder address</p>
                    <p className="mt-0.5 break-all font-mono text-xs font-semibold leading-relaxed text-ink">
                      {account}
                    </p>
                  </div>
                </div>

                <div className="glass-soft mt-4 px-3.5 py-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-ink">Step 1 · Pay verification fee</p>
                      <p className="mt-0.5 text-[11px] text-mute">
                        Escrow {verificationFeeLabel || "0.5 BOT"} from this wallet. After it
                        confirms, we issue your credential automatically.
                      </p>
                    </div>
                    <StatusPill
                      ok={feeEscrowed || feeStatus?.feeStatus === "SETTLED"}
                      label={
                        feeBusy
                          ? "Confirming…"
                          : feeStatus?.feeStatus || (feeEscrowed ? "ESCROWED" : "Unpaid")
                      }
                    />
                  </div>
                  <motion.button
                    type="button"
                    className="btn-primary mt-3 h-10 w-full text-sm"
                    disabled={busy || feeBusy || feeEscrowed || feeStatus?.feeStatus === "SETTLED"}
                    onClick={onPayFee}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    {feeBusy
                      ? "Confirming payment…"
                      : feeEscrowed
                        ? "Fee escrowed"
                        : feeStatus?.feeStatus === "SETTLED"
                          ? "Fee settled"
                          : `Pay ${verificationFeeLabel || "0.5 BOT"}`}
                  </motion.button>
                  {feeEscrowed ? (
                    <p className="mt-2 text-[11px] leading-relaxed text-mute">
                      Payment received. Issuing your pass on chain — this usually takes a few
                      seconds.
                    </p>
                  ) : null}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <label className="block text-[11px] font-medium text-mute">
                    <span className="mb-1.5 inline-flex items-center gap-1.5">
                      <Layers3 size={12} /> Tier
                    </span>
                    <select
                      className="field mt-1.5 h-11 border-white/70 bg-white/55 text-sm font-medium backdrop-blur-md"
                      value={tier}
                      onChange={(e) => setTier(e.target.value)}
                    >
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
                      className="field mt-1.5 h-11 border-white/70 bg-white/55 text-sm font-medium backdrop-blur-md"
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

                <div className="glass-soft mt-4 px-3.5 py-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-ink">Step 2 · Issuer actions</p>
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
                      <span className="text-mute">Issue tx</span>
                      {verification?.txHash && explorerTxUrl?.(verification.txHash) ? (
                        <a
                          className="font-mono font-medium text-brand underline-offset-2 hover:underline"
                          href={explorerTxUrl(verification.txHash)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {shortAddr(verification.txHash)}
                        </a>
                      ) : (
                        <span className="font-mono font-medium text-ink">
                          {verification?.txHash ? shortAddr(verification.txHash) : "—"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-mute">Fee tx</span>
                      {feeStatus?.feeTxHash && explorerTxUrl?.(feeStatus.feeTxHash) ? (
                        <a
                          className="font-mono font-medium text-brand underline-offset-2 hover:underline"
                          href={explorerTxUrl(feeStatus.feeTxHash)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {shortAddr(feeStatus.feeTxHash)}
                        </a>
                      ) : (
                        <span className="font-mono font-medium text-ink">
                          {feeStatus?.feeTxHash ? shortAddr(feeStatus.feeTxHash) : "—"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-mute">Fee status</span>
                      <span className="font-medium text-ink">{feeStatus?.feeStatus || "—"}</span>
                    </div>
                  </div>
                </div>

                <Alert type="error">{error}</Alert>
                <Alert type="success">{success}</Alert>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <motion.button
                    type="button"
                    className="btn-primary h-11 flex-1"
                    disabled={busy || feeBusy || !feeEscrowed}
                    onClick={onVerify}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <ShieldCheck size={15} />
                    {busy ? "Issuing…" : "Issue credential"}
                  </motion.button>
                  <button
                    type="button"
                    className="btn-ghost h-11 flex-1"
                    disabled={busy || feeBusy || !feeEscrowed}
                    onClick={onReject}
                  >
                    Reject & refund
                  </button>
                </div>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <button type="button" className="btn-ghost h-10 flex-1 text-xs" disabled={busy} onClick={onRefresh}>
                    <RefreshCw size={14} />
                    Check status
                  </button>
                  <button
                    type="button"
                    className="btn-muted h-10 flex-1 text-xs"
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
                art={pageArt.help}
              />

              <div className="mx-auto max-w-2xl space-y-2.5">
                {faqs.map((item, idx) => {
                  const open = openFaq === idx;
                  return (
                    <motion.div
                      key={item.q}
                      layout
                      className={`glass-card overflow-hidden transition ${
                        open ? "shadow-[0_14px_36px_rgba(0,0,0,0.07)]" : ""
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
                            open
                              ? "bg-brand text-white"
                              : "border border-white/80 bg-white/55 text-brand backdrop-blur-md"
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
                            <p className="border-t border-white/50 px-4 pb-4 pt-3 text-sm font-normal leading-relaxed text-mute sm:px-5 sm:pl-[3.75rem]">
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
    </div>
  );
}
