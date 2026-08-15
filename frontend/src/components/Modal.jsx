import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

export default function Modal({ open, onClose, title, children, size = "md" }) {
  const maxWidth =
    size === "sm" ? "max-w-[320px]" : size === "lg" ? "max-w-[440px]" : "max-w-[400px]";
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
            className={`relative z-10 max-h-[min(88vh,760px)] w-full ${maxWidth} overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-[0_16px_48px_rgba(0,0,0,0.14)] outline-none ring-0`}
            initial={{ opacity: 0, y: 22, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
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
            <div className="max-h-[calc(min(88vh,760px)-3.25rem)] overflow-y-auto px-4 pb-4 pt-1">{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
