import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

export default function Modal({ open, onClose, title, children }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Close overlay"
            className="absolute inset-0 bg-[#17141F]/35 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className="panel relative z-10 w-full max-w-lg shadow-soft"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h3 className="text-base font-semibold text-ink">{title}</h3>
              <button
                type="button"
                onClick={onClose}
                className="rounded-btn p-2 text-mute hover:bg-white/70 hover:text-ink"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-5 py-5">{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
