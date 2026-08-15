import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileSearch,
  Globe2,
  HelpCircle,
  Layers3,
  Lock,
  Minus,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import Alert from "../components/Alert.jsx";
import Modal from "../components/Modal.jsx";
import { ArtIdle, ArtLive } from "../components/DashArt.jsx";
import { shortAddr } from "../lib/api.js";
import { explorerAddressUrl } from "../lib/chain.js";

const helpItems = [
  {
    q: "What am I verifying?",
    a: "This wallet — not you as a person. Apps only need to know the wallet is cleared, at which tier, and for which region.",
  },
  {
    q: "Does anything personal go on chain?",
    a: "No. We store a hash, your tier, region, and expiry. ID documents never leave the issuer.",
  },
  {
    q: "Why is there a fee?",
    a: "The 0.5 BOT fee is escrowed from this wallet so the request is real. If review is declined, it comes back.",
  },
  {
    q: "What is the NFT for?",
    a: "A unique, non-transferable badge on this address. It shows the kind of check you completed — Retail, Accredited, or Institutional.",
  },
  {
    q: "When do I need to come back?",
    a: "If the pass expires, or if you want a different tier or region. Refresh anytime to see what's live.",
  },
];

function prettyTier(value) {
  const key = String(value || "").toUpperCase();
  return { RETAIL: "Retail", ACCREDITED: "Accredited", INSTITUTIONAL: "Institutional" }[key] || value || null;
}

function decodePassMeta(tokenURI) {
  if (!tokenURI || !tokenURI.startsWith("data:application/json;base64,")) return null;
  try {
    return JSON.parse(atob(tokenURI.slice("data:application/json;base64,".length)));
  } catch {
    return null;
  }
}

function formatExpiry(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  const days = Math.round((date.getTime() - Date.now()) / 86400000);
  if (Number.isNaN(days)) return "—";
  if (days < 0) return "Expired";
  if (days < 2) return "Today";
  if (days < 45) return `${days} days left`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function passLabel({ valid, verification, feeEscrowed }) {
  if (valid) return "Ready";
  if (verification?.status === "FAILED") return "Try again";
  if (["PENDING", "IN_REVIEW", "SIGNED", "SUBMITTED"].includes(verification?.status)) {
    return "Minting";
  }
  if (feeEscrowed) return "Paid";
  return "Get started";
}

function StatusPill({ ok, label, live = false }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium backdrop-blur-md ${
        ok
          ? "bg-emerald-500/12 text-emerald-700 ring-1 ring-emerald-400/30"
          : live
            ? "bg-brand/10 text-brand ring-1 ring-brand/20"
            : "bg-white/55 text-mute ring-1 ring-white/70"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          ok ? "bg-emerald-500" : live ? "animate-pulse bg-brand" : "bg-neutral-400"
        }`}
      />
      {label}
    </span>
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

function FlowStep({ n, title, done, current }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
          done ? "bg-emerald-500 text-white" : current ? "bg-brand text-white" : "bg-neutral-100 text-mute"
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

function NftPassCard({ nft }) {
  if (!nft) return null;
  const meta = decodePassMeta(nft.tokenURI);
  const href = explorerAddressUrl(nft.address);
  return (
    <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/50 bg-white/35 px-3.5 py-3">
      {meta?.image ? (
        <img src={meta.image} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover ring-1 ring-white/80" />
      ) : (
        <span className="glass-icon h-14 w-14 shrink-0 text-sm font-bold">BGV</span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-white/70">Your badge</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-white">
          {prettyTier(nft.tier) || "Pass"}
          {nft.jurisdiction ? ` · ${nft.jurisdiction}` : ""}
        </p>
      </div>
      {href ? (
        <a
          className="inline-flex items-center gap-1 text-xs font-medium text-white/90 underline-offset-2 hover:underline"
          href={href}
          target="_blank"
          rel="noreferrer"
        >
          View <ExternalLink size={11} />
        </a>
      ) : null}
    </div>
  );
}

function QuickAction({ icon: Icon, label, onClick }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      className="dash-chip group flex-1 flex-col items-center justify-center gap-2 py-4 text-center sm:min-w-0"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-brand transition group-hover:bg-brand group-hover:text-white">
        <Icon size={18} strokeWidth={1.9} />
      </span>
      <span className="text-xs font-semibold text-ink">{label}</span>
    </motion.button>
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
  const [copied, setCopied] = useState(false);
  const issuing = ["PENDING", "IN_REVIEW", "SIGNED", "SUBMITTED"].includes(verification?.status);
  const closeSheet = () => setView("home");
  const label = passLabel({ valid, verification, feeEscrowed });
  const nftMeta = decodePassMeta(credential?.nft?.tokenURI);

  useEffect(() => {
    if (openedVerifyOnce.current || valid || credential) return undefined;
    openedVerifyOnce.current = true;
    const timer = setTimeout(() => setView("verify"), 520);
    return () => clearTimeout(timer);
  }, [valid, credential, setView]);

  async function copyWallet() {
    if (!account) return;
    try {
      await navigator.clipboard.writeText(account);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="dash-shell min-h-[calc(100vh-4rem)]">
      <main className="font-poppins mx-auto w-full max-w-3xl px-4 py-8 md:px-6 md:py-10">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">
                {valid ? "Ready" : "Your pass"}
              </p>
              <h1 className="mt-1.5 text-[1.65rem] font-semibold tracking-tight text-ink sm:text-3xl">
                {valid ? "You're cleared." : "Verify once. Use it everywhere."}
              </h1>
              <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-mute">
                {valid
                  ? "Apps can reuse this answer. Nothing personal is on chain."
                  : "One wallet tap. Your pass and badge land on BOT Chain."}
              </p>
            </div>
            <StatusPill ok={valid} live={issuing || feeBusy} label={label} />
          </div>

          <motion.section
            layout
            className={`dash-pass ${
              valid
                ? "border-brand/20 bg-gradient-to-br from-brand via-[#9b5cff] to-[#5b21b6] text-white"
                : "bg-white/60"
            }`}
          >
            <div
              className={`pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full blur-3xl ${
                valid ? "bg-white/20" : "bg-brand/15"
              }`}
              aria-hidden="true"
            />
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-stretch">
              <div
                className={`flex h-[132px] w-full shrink-0 items-center justify-center overflow-hidden rounded-2xl sm:h-auto sm:w-[148px] ${
                  valid ? "bg-white/15 ring-1 ring-white/25" : "bg-brand/8 ring-1 ring-brand/10"
                }`}
              >
                {valid && nftMeta?.image ? (
                  <img src={nftMeta.image} alt="" className="h-full w-full object-cover" />
                ) : valid ? (
                  <ArtLive className="h-[88px] w-[88px]" />
                ) : (
                  <ArtIdle className="h-[108px] w-[108px]" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={`text-[11px] font-medium uppercase tracking-wide ${valid ? "text-white/70" : "text-mute"}`}>
                      {valid ? "Shared across BOT Chain" : "This wallet"}
                    </p>
                    <p className={`mt-1 text-xl font-semibold tracking-tight ${valid ? "text-white" : "text-ink"}`}>
                      {valid
                        ? `${prettyTier(credential?.tier) || "Retail"}${credential?.jurisdiction ? ` · ${credential.jurisdiction}` : ""}`
                        : "Not verified yet"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={copyWallet}
                  className={`mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    valid ? "bg-white/15 text-white hover:bg-white/25" : "bg-white/70 text-ink hover:bg-white"
                  }`}
                >
                  <Wallet size={13} />
                  {copied ? "Copied" : shortAddr(account)}
                  <Copy size={12} />
                </button>

                <div className={`mt-4 grid grid-cols-3 gap-2 text-[11px] ${valid ? "text-white/80" : "text-mute"}`}>
                  <div>
                    <p className="font-medium opacity-80">Network</p>
                    <p className={`mt-0.5 truncate text-sm font-semibold ${valid ? "text-white" : "text-ink"}`}>
                      {chainLabel || "BOT Chain"}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium opacity-80">Valid until</p>
                    <p className={`mt-0.5 truncate text-sm font-semibold ${valid ? "text-white" : "text-ink"}`}>
                      {formatExpiry(credential?.expiresAt)}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium opacity-80">Identity</p>
                    <p className={`mt-0.5 truncate text-sm font-semibold ${valid ? "text-white" : "text-ink"}`}>
                      Stays off-chain
                    </p>
                  </div>
                </div>

                {valid ? <NftPassCard nft={credential.nft} /> : null}

                <motion.button
                  type="button"
                  className={`mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition ${
                    valid
                      ? "bg-white text-brand hover:bg-white/90"
                      : "bg-brand text-white hover:bg-brandHover"
                  }`}
                  onClick={() => setView("verify")}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.99 }}
                >
                  {valid ? "See your pass" : "Get verified"}
                  <ArrowRight size={16} />
                </motion.button>
                {!valid ? (
                  <p className="mt-2 text-center text-[11px] text-mute">
                    Fee is {verificationFeeLabel || "0.5 BOT"} · paid from this wallet
                  </p>
                ) : null}
              </div>
            </div>
          </motion.section>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="dash-chip">
              <span className="glass-icon h-8 w-8 shrink-0">
                <Layers3 size={14} />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-wide text-mute">Tier</p>
                <p className="truncate text-sm font-semibold text-ink">{prettyTier(credential?.tier) || "—"}</p>
              </div>
            </div>
            <div className="dash-chip">
              <span className="glass-icon h-8 w-8 shrink-0">
                <Globe2 size={14} />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-wide text-mute">Region</p>
                <p className="truncate text-sm font-semibold text-ink">{credential?.jurisdiction || "—"}</p>
              </div>
            </div>
            <div className="dash-chip">
              <span className="glass-icon h-8 w-8 shrink-0">
                <Lock size={14} />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-wide text-mute">Personal data</p>
                <p className="truncate text-sm font-semibold text-ink">Off-chain</p>
              </div>
            </div>
            <div className="dash-chip">
              <span className="glass-icon h-8 w-8 shrink-0">
                <Sparkles size={14} />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-wide text-mute">Badge</p>
                <p className="truncate text-sm font-semibold text-ink">{credential?.nft ? "Minted" : "Not yet"}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-2.5">
            <QuickAction icon={valid ? CheckCircle2 : ShieldCheck} label={valid ? "Pass" : "Get pass"} onClick={() => setView("verify")} />
            <QuickAction icon={FileSearch} label="Details" onClick={() => setView("status")} />
            <QuickAction icon={RefreshCw} label="Sync" onClick={onRefresh} />
            <QuickAction icon={HelpCircle} label="Help" onClick={() => setView("help")} />
          </div>
        </motion.div>
      </main>

      <Modal
        open={view === "verify"}
        onClose={closeSheet}
        title={valid ? "Your pass" : "Get verified"}
        size="lg"
      >
        <div className="space-y-3.5">
          <div className="flex gap-2 rounded-xl bg-[#faf9fc] px-3 py-2.5">
            <FlowStep n={1} title="Type" done={feeEscrowed || valid} current={!feeEscrowed && !valid} />
            <FlowStep n={2} title="Pay" done={feeEscrowed || valid} current={feeBusy} />
            <FlowStep n={3} title="Done" done={valid} current={issuing || feeEscrowed} />
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-neutral-100 bg-[#faf9fc] px-3.5 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-brand ring-1 ring-neutral-200/80">
              <Wallet size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-mute">This wallet</p>
              <p className="mt-0.5 break-all font-mono text-xs font-semibold leading-relaxed text-ink">{account}</p>
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
                {valid ? "Pass is live" : `${verificationFeeLabel || "0.5 BOT"} to start`}
              </p>
              <StatusPill
                ok={valid || feeEscrowed || feeStatus?.feeStatus === "SETTLED"}
                live={feeBusy}
                label={
                  feeBusy
                    ? "Confirming…"
                    : feeEscrowed
                      ? "Paid"
                      : valid
                        ? "Complete"
                        : "Unpaid"
                }
              />
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-mute">
              {valid
                ? "Gated apps can use this wallet now. Your badge is unique to this address and cannot be transferred."
                : "Approve the fee in your wallet. We mint the pass and badge as soon as it confirms — no ID documents posted."}
            </p>
          </div>

          {valid && credential?.nft ? (
            <div className="rounded-2xl bg-brand p-3">
              <NftPassCard nft={credential.nft} />
            </div>
          ) : null}

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
              <button type="button" className="btn-muted h-10 w-full text-xs" disabled={busy} onClick={onRevoke}>
                Remove this pass
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
                    ? "Waiting on wallet…"
                    : issuing
                      ? "Minting your pass…"
                      : feeEscrowed
                        ? "Paid — finishing up…"
                        : `Approve ${verificationFeeLabel || "0.5 BOT"}`}
              </motion.button>
              {feeEscrowed ? (
                <button type="button" className="btn-ghost h-10 w-full text-xs" disabled={busy || feeBusy} onClick={onVerify}>
                  Try again
                </button>
              ) : null}
              {feeEscrowed && !valid ? (
                <button type="button" className="btn-muted h-10 w-full text-xs" disabled={busy || feeBusy} onClick={onReject}>
                  Get a refund
                </button>
              ) : null}
            </div>
          )}
        </div>
      </Modal>

      <Modal open={view === "status"} onClose={closeSheet} title="What's on record" size="lg">
        <div className="space-y-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-mute">Wallet</p>
              <p className="truncate font-mono text-sm font-semibold">{shortAddr(account)}</p>
            </div>
            <StatusPill ok={valid} live={issuing} label={label} />
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            <StatusRow icon={Layers3} label="Tier" value={prettyTier(credential?.tier)} />
            <StatusRow icon={Globe2} label="Region" value={credential?.jurisdiction} />
            <StatusRow icon={RefreshCw} label="Request" value={verification?.status || "Ready"} />
            <StatusRow icon={ShieldCheck} label="Expires" value={formatExpiry(credential?.expiresAt)} />
            <div className="sm:col-span-2">
              <StatusRow icon={Sparkles} label="Network" value={chainLabel || null} />
            </div>
          </div>

          {!valid && !credential ? (
            <p className="text-sm leading-relaxed text-mute">
              {verification?.status === "FAILED"
                ? verification.failureReason || "That didn't go through. Get verified again to retry."
                : feeEscrowed
                  ? "Fee is in. Your pass appears as soon as minting confirms."
                  : "Nothing on this wallet yet. Get verified — it takes one approval."}
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
              {busy ? "Checking…" : "Check again"}
            </motion.button>
            <button type="button" className="btn-ghost h-11 flex-1" onClick={() => setView("verify")}>
              {valid ? "See your pass" : "Get verified"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={view === "help"} onClose={closeSheet} title="Quick answers" size="lg">
        <div className="space-y-2">
          {helpItems.map((item, idx) => {
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
