import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Modal({ open, onClose, title, subtitle, children, footer, width = 'max-w-lg' }) {
  // Escape closes the modal, per the accessibility requirement.
  useEffect(() => {
    if (!open) return;

    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className={`relative w-full ${width} max-h-[90vh] overflow-hidden rounded-xl border border-[#E5E5E5] bg-white shadow-2xl flex flex-col`}
          >
            <div className="flex items-start justify-between border-b border-[#E5E5E5] px-5 py-3.5">
              <div>
                <h3 className="text-[15px] font-semibold text-[#0B0B0B]">{title}</h3>
                {subtitle && <p className="mt-0.5 text-[11px] text-[#666666]">{subtitle}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="ml-4 rounded-md p-1 text-[#666666] transition-colors hover:bg-[#f4f4f2] hover:text-[#0B0B0B] cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 thin-sb">{children}</div>

            {footer && (
              <div className="flex items-center justify-end gap-2 border-t border-[#E5E5E5] bg-[#F9F9F7] px-5 py-3">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
