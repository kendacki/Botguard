import { useEffect, useRef } from "react";
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
import Modal from "../components/Modal.jsx";
import { shortAddr } from "../lib/api.js";

const pageArt = {
  home: "/illustrations/dash/home.svg",
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

function passLabel({ valid, verification, feeEscrowed }) {
  if (valid) return "Valid pass";
  if (verification?.status === "FAILED") return "Issue failed";
  if (["PENDING", "IN_REVIEW", "SIGNED", "SUBMITTED"].includes(verification?.status)) {
    return "Issuing";
  }
  if (feeEscrowed) return "Fee paid";
  return "Needs verify";
}

function FlowStep({ n, title, done, current }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
          done
            ? "bg-emerald-500 text-white"
            : current
              ? "bg-brand text-white"
              : "bg-neutral-100 text-mute"
        }`}
      >
        {done ? <CheckCircle2 size={13} /> : n}
      </span>
      <span className={`truncate text-[11px] font-medium ${current || done ? "text-ink" : "text-mute"}`}>
        {title}
      </span>
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
  const openedVerifyOnce = useRef(false);
  const issuing = ["PENDING", "IN_REVIEW", "SIGNED", "SUBMITTED"].includes(verification?.status);
  const closeSheet = () => setView("home");

  useEffect(() => {
    if (openedVerifyOnce.current || valid || credential) return undefined;
    openedVerifyOnce.current = true;
    const timer = setTimeout(() => setView("verify"), 420);
    return () => clearTimeout(timer);
  }, [valid, credential, setView]);

  const label = passLabel({ valid, verification, feeEscrowed });

  return (
    <div className="dash-shell min-h-[calc(100vh-4rem)]">
      <main className="font-poppins mx-auto w-full max-w-5xl px-4 py-8 md:px-6 md:py-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
          className="space-y-5"
        >
          <div className="glass-card relative overflow-hidden px-5 py-6 sm:px-8 sm:py-7">
            <div
              className="pointer-events-none absolute -right-6 -top-10 h-44 w-44 rounded-full bg-brand/10 blur-3xl"
              aria-hidden="true"
            />
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">Dashboard</p>
                <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                  {valid ? "You're cleared to move." : "Let's get this wallet verified."}
                </h1>
                <p className="mt-2 text-sm font-normal leading-relaxed text-mute sm:text-[15px]">
                  {valid
                    ? "Your credential is live. Gated apps and tokens can trust this wallet without another KYC run."
                    : "Stay here. Pay once in the popup, and we issue the hashed pass on BOT Chain."}
                </p>
              </div>
              <motion.img
                src={pageArt.home}
                alt=""
                className="mx-auto h-[88px] w-[88px] shrink-0 drop-shadow-sm sm:mx-0 sm:h-[104px] sm:w-[104px]"
                whileHover={{ y: -4, rotate: -2 }}
                transition={{ type: "spring", stiffness: 280, damping: 16 }}
                draggable={false}
              />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="glass-card p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="glass-icon h-11 w-11 shrink-0">
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
                <StatusPill ok={valid} label={label} />
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2.5">
                <Metric icon={Layers3} label="Tier" value={credential?.tier} />
                <Metric icon={Globe2} label="Region" value={credential?.jurisdiction} />
                <Metric
                  icon={ShieldCheck}
                  label="Expires"
                  value={credential?.expiresAt ? new Date(credential.expiresAt).toLocaleDateString() : null}
                />
              </div>

              <motion.button
                type="button"
                className="btn-primary mt-5 h-11 w-full"
                onClick={() => setView("verify")}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.99 }}
              >
                {valid ? "Manage pass" : "Verify this wallet"}
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
                    : "Opens here — pay the fee, then we issue automatically."
                }
                onClick={() => setView("verify")}
              />
              <ActionTile
                icon={FileSearch}
                title="Check status"
                copy="Tier, region, expiry, and live request state."
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
      </main>

      <Modal
        open={view === "verify"}
        onClose={closeSheet}
        title={valid ? "Your pass" : "Verify this wallet"}
        size="lg"
      >
        <div className="space-y-3.5">
          <div className="flex gap-2 rounded-xl bg-[#faf9fc] px-3 py-2.5">
            <FlowStep n={1} title="Choose" done={feeEscrowed || valid} current={!feeEscrowed && !valid} />
            <FlowStep n={2} title="Pay" done={feeEscrowed || valid} current={feeBusy} />
            <FlowStep n={3} title="Live" done={valid} current={issuing || feeEscrowed} />
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-neutral-100 bg-[#faf9fc] px-3.5 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-brand ring-1 ring-neutral-200/80">
              <Wallet size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-mute">Holder</p>
              <p className="mt-0.5 break-all font-mono text-xs font-semibold leading-relaxed text-ink">
                {account}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[11px] font-medium text-mute">
              <span className="mb-1.5 inline-flex items-center gap-1.5">
                <Layers3 size={12} /> Tier
              </span>
              <select
                className="field mt-1.5 h-11"
                value={tier}
                onChange={(e) => setTier(e.target.value)}
                disabled={valid || feeBusy || busy}
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
                className="field mt-1.5 h-11"
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value)}
                disabled={valid || feeBusy || busy}
              >
                <option value="NG">NG</option>
                <option value="US">US</option>
                <option value="GB">GB</option>
                <option value="EU">EU</option>
              </select>
            </label>
          </div>

          <div className="rounded-xl border border-neutral-100 px-3.5 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-ink">
                {valid ? "Pass issued" : `Pay ${verificationFeeLabel || "0.5 BOT"}`}
              </p>
              <StatusPill
                ok={valid || feeEscrowed || feeStatus?.feeStatus === "SETTLED"}
                label={
                  feeBusy ? "Confirming…" : feeStatus?.feeStatus || (feeEscrowed ? "ESCROWED" : valid ? "SETTLED" : "Unpaid")
                }
              />
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-mute">
              {valid
                ? "This wallet can now be gated across BOT Chain apps."
                : "Confirm in your wallet. We issue the hashed pass as soon as the fee lands."}
            </p>
          </div>

          {(verification?.txHash || feeStatus?.feeTxHash || verificationId) && (
            <div className="space-y-1.5 text-xs">
              {verificationId ? (
                <div className="flex justify-between gap-3">
                  <span className="text-mute">Request</span>
                  <span className="font-mono font-medium text-ink">{shortAddr(verificationId)}</span>
                </div>
              ) : null}
              {verification?.txHash ? (
                <div className="flex justify-between gap-3">
                  <span className="text-mute">Issue tx</span>
                  {explorerTxUrl?.(verification.txHash) ? (
                    <a
                      className="font-mono font-medium text-brand underline-offset-2 hover:underline"
                      href={explorerTxUrl(verification.txHash)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {shortAddr(verification.txHash)}
                    </a>
                  ) : (
                    <span className="font-mono font-medium text-ink">{shortAddr(verification.txHash)}</span>
                  )}
                </div>
              ) : null}
              {feeStatus?.feeTxHash ? (
                <div className="flex justify-between gap-3">
                  <span className="text-mute">Fee tx</span>
                  {explorerTxUrl?.(feeStatus.feeTxHash) ? (
                    <a
                      className="font-mono font-medium text-brand underline-offset-2 hover:underline"
                      href={explorerTxUrl(feeStatus.feeTxHash)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {shortAddr(feeStatus.feeTxHash)}
                    </a>
                  ) : (
                    <span className="font-mono font-medium text-ink">{shortAddr(feeStatus.feeTxHash)}</span>
                  )}
                </div>
              ) : null}
            </div>
          )}

          <Alert type="error">{error}</Alert>
          <Alert type="success">{success}</Alert>

          {valid ? (
            <div className="flex flex-col gap-2">
              <button type="button" className="btn-primary h-11 w-full" onClick={closeSheet}>
                Done
              </button>
              <button
                type="button"
                className="btn-muted h-10 w-full text-xs"
                disabled={busy}
                onClick={onRevoke}
              >
                Revoke credential
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <motion.button
                type="button"
                className="btn-primary h-11 w-full"
                disabled={busy || feeBusy || feeEscrowed || feeStatus?.feeStatus === "SETTLED"}
                onClick={onPayFee}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.99 }}
              >
                {feeBusy
                  ? "Confirm in wallet…"
                  : issuing
                    ? "Issuing pass…"
                    : feeEscrowed
                      ? "Fee paid — issuing…"
                      : `Pay ${verificationFeeLabel || "0.5 BOT"}`}
              </motion.button>
              {feeEscrowed ? (
                <button
                  type="button"
                  className="btn-ghost h-10 w-full text-xs"
                  disabled={busy || feeBusy}
                  onClick={onVerify}
                >
                  Retry issue
                </button>
              ) : null}
              {feeEscrowed && !valid ? (
                <button
                  type="button"
                  className="btn-muted h-10 w-full text-xs"
                  disabled={busy || feeBusy}
                  onClick={onReject}
                >
                  Cancel & refund
                </button>
              ) : null}
            </div>
          )}
        </div>
      </Modal>

      <Modal open={view === "status"} onClose={closeSheet} title="Wallet status" size="lg">
        <div className="space-y-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-mute">Wallet</p>
              <p className="truncate font-mono text-sm font-semibold">{shortAddr(account)}</p>
            </div>
            <StatusPill ok={valid} label={label} />
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            <StatusRow icon={Layers3} label="Tier" value={credential?.tier} />
            <StatusRow icon={Globe2} label="Region" value={credential?.jurisdiction} />
            <StatusRow icon={RefreshCw} label="Request" value={verification?.status || "Ready"} />
            <StatusRow
              icon={ShieldCheck}
              label="Expires"
              value={credential?.expiresAt ? new Date(credential.expiresAt).toLocaleDateString() : null}
            />
            <div className="sm:col-span-2">
              <StatusRow icon={Sparkles} label="Network" value={chainLabel || null} />
            </div>
          </div>

          {!valid && !credential ? (
            <p className="text-sm leading-relaxed text-mute">
              {verification?.status === "FAILED"
                ? verification.failureReason || "Issue failed. Open verify to retry."
                : feeEscrowed
                  ? "Fee is paid. The pass should appear after the issue transaction confirms."
                  : "No on-chain pass yet. Verify from the popup — we issue automatically after payment."}
            </p>
          ) : null}

          <Alert type="error">{error}</Alert>
          <Alert type="success">{success}</Alert>

          <div className="flex flex-col gap-2 sm:flex-row">
            <motion.button
              type="button"
              className="btn-primary h-11 flex-1"
              onClick={onRefresh}
              disabled={busy}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.99 }}
            >
              <RefreshCw size={15} className={busy ? "animate-spin" : ""} />
              {busy ? "Refreshing…" : "Refresh"}
            </motion.button>
            <button type="button" className="btn-ghost h-11 flex-1" onClick={() => setView("verify")}>
              {valid ? "Manage pass" : "Verify"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={view === "help"} onClose={closeSheet} title="Help" size="lg">
        <div className="space-y-2">
          {faqs.map((item, idx) => {
            const open = openFaq === idx;
            return (
              <div key={item.q} className="overflow-hidden rounded-xl border border-neutral-100">
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
                  onClick={() => setOpenFaq(open ? -1 : idx)}
                  aria-expanded={open}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition ${
                      open ? "bg-brand text-white" : "bg-[#f3f0fa] text-brand"
                    }`}
                  >
                    {open ? <Minus size={13} strokeWidth={2.4} /> : <Plus size={13} strokeWidth={2.4} />}
                  </span>
                  <span className="flex-1 text-sm font-semibold leading-snug text-ink">{item.q}</span>
                </button>
                <AnimatePresence initial={false}>
                  {open ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <p className="border-t border-neutral-100 px-3.5 pb-3.5 pt-2.5 text-sm leading-relaxed text-mute">
                        {item.a}
                      </p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
