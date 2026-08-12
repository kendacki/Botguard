import { motion } from "framer-motion";
import { Check, Shield } from "lucide-react";

const ease = [0.22, 1, 0.36, 1];

const steps = [
  { label: "Hash commitment", delay: 0.45 },
  { label: "Issuer signed", delay: 0.9 },
  { label: "On chain confirm", delay: 1.35 },
];

export default function HeroScene() {
  return (
    <motion.div
      className="relative overflow-hidden rounded-[22px] bg-[#faf9fb] p-5 sm:p-7"
      initial={{ opacity: 0, y: 28, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, ease }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 85% 10%, rgba(138,63,252,0.08), transparent 55%), radial-gradient(ellipse 50% 40% at 10% 90%, rgba(23,20,31,0.04), transparent 50%)",
        }}
      />

      <div className="relative mb-6 flex items-center justify-between">
        <motion.p
          className="text-xs font-semibold uppercase tracking-[0.14em] text-mute"
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.45, ease }}
        >
          Live issue loop
        </motion.p>
        <motion.span
          className="inline-flex items-center gap-1.5 rounded-full bg-ok/10 px-2.5 py-1 text-[11px] font-semibold text-ok"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.9, duration: 0.4, ease }}
        >
          <motion.span
            className="h-1.5 w-1.5 rounded-full bg-ok"
            animate={{ scale: [1, 1.35, 1], opacity: [1, 0.55, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          />
          Valid
        </motion.span>
      </div>

      <div className="relative grid gap-5 sm:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-2.5">
          {steps.map((step, index) => (
            <motion.div
              key={step.label}
              className="flex items-center gap-3 rounded-2xl bg-white/80 px-3.5 py-3"
              initial={{ opacity: 0, x: -18 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: step.delay, duration: 0.45, ease }}
            >
              <motion.span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: step.delay + 0.12, type: "spring", stiffness: 320, damping: 18 }}
              >
                <Check size={15} strokeWidth={2.6} />
              </motion.span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">{step.label}</p>
                <p className="truncate text-xs text-mute">Step {index + 1} of 3</p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="relative flex min-h-[210px] flex-col items-center justify-center rounded-2xl bg-white/80 px-4 py-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.55, ease }}
        >
          <motion.div
            className="relative flex h-28 w-28 items-center justify-center"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <motion.div
              className="absolute inset-0 rounded-[28px] bg-brand/10"
              animate={{ scale: [1, 1.08, 1], opacity: [0.55, 0.25, 0.55] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="relative flex h-20 w-20 items-center justify-center rounded-[22px] bg-brand text-white shadow-soft"
              initial={{ scale: 0.7, rotate: -8, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ delay: 0.45, type: "spring", stiffness: 240, damping: 16 }}
            >
              <Shield size={34} strokeWidth={2.2} />
            </motion.div>
          </motion.div>

          <motion.p
            className="mt-4 text-sm font-semibold text-ink"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.6, duration: 0.4, ease }}
          >
            Credential ready
          </motion.p>
          <motion.p
            className="mt-1 text-center text-xs text-mute"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.8, duration: 0.4 }}
          >
            Tier RETAIL · Region NG
          </motion.p>

          <motion.div
            className="mt-4 h-1.5 w-full max-w-[180px] overflow-hidden rounded-full bg-neutral-200/80"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <motion.div
              className="h-full rounded-full bg-brand"
              initial={{ width: "8%" }}
              animate={{ width: "100%" }}
              transition={{ delay: 0.7, duration: 1.4, ease }}
            />
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}
