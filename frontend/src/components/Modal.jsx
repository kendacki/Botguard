import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

export default function Modal({ open, onClose, title, children }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Close overlay"
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? "modal-title" : undefined}
            aria-label={title ? undefined : "Dialog"}
            className="relative z-10 w-full max-w-[400px] overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-[0_16px_48px_rgba(0,0,0,0.14)] outline-none ring-0"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 360, damping: 30 }}
          >
            <div
              className={`flex items-center gap-3 px-4 ${
                title ? "justify-between border-b border-neutral-100 py-3" : "justify-end pb-0 pt-2.5"
              }`}
            >
              {title ? (
                <h3 id="modal-title" className="text-sm font-semibold tracking-tight text-ink">
                  {title}
                </h3>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-mute transition hover:bg-neutral-100 hover:text-ink"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-4 py-3.5">{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
