import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ConfirmActionModal({
  isOpen,
  title = 'Confirm Action',
  description = 'Are you sure you want to proceed with this action?',
  customerName = '',
  customerMobile = '',
  tokenNo = '',
  submitting = false,
  showWhatsApp = true,
  onClose,
  onConfirm,
  onConfirmWhatsApp,
}) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl relative border border-[#E5E5E5] space-y-4 text-[#0B0B0B]"
        >
          {/* HEADER */}
          <div className="flex justify-between items-center border-b border-[#E5E5E5] pb-3">
            <h3 className="text-base font-bold text-[#0B0B0B]">{title}</h3>
            <button
              onClick={onClose}
              disabled={submitting}
              className="text-[#717783] hover:text-[#0B0B0B] transition-colors p-1"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>

          {/* SUMMARY INFO BADGE */}
          {(customerName || tokenNo || customerMobile) && (
            <div className="p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-xs space-y-1">
              {customerName && (
                <div className="flex justify-between">
                  <span className="text-[#64748b] font-medium">Customer:</span>
                  <span className="font-bold text-[#0f172a]">{customerName}</span>
                </div>
              )}
              {customerMobile && (
                <div className="flex justify-between">
                  <span className="text-[#64748b] font-medium">Mobile:</span>
                  <span className="font-mono text-[#0f172a]">+91 {customerMobile}</span>
                </div>
              )}
              {tokenNo && (
                <div className="flex justify-between">
                  <span className="text-[#64748b] font-medium">Token No:</span>
                  <span className="font-mono font-bold text-[#2563eb]">#{tokenNo}</span>
                </div>
              )}
            </div>
          )}

          {/* BODY DESCRIPTION */}
          <p className="text-xs text-[#666666] leading-relaxed">
            {description}
          </p>

          {/* 3 ACTION BUTTONS FOOTER */}
          <div className="flex items-center justify-end flex-wrap gap-2 pt-2 border-t border-[#E5E5E5]">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl border border-[#E5E5E5] bg-[#f4f4f2] text-[#0B0B0B] font-bold text-xs hover:bg-[#e5e5e5] transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={onConfirm}
              className="px-4 py-2 bg-[#0f172a] hover:bg-[#1e293b] text-white font-bold text-xs rounded-xl shadow transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none flex items-center gap-1.5 cursor-pointer"
            >
              <span className={`material-symbols-outlined text-base ${submitting ? 'animate-spin' : ''}`}>
                {submitting ? 'sync' : 'check'}
              </span>
              <span>{submitting ? 'Processing...' : 'Confirm'}</span>
            </button>

            {showWhatsApp && onConfirmWhatsApp && (
              <button
                type="button"
                disabled={submitting}
                onClick={onConfirmWhatsApp}
                className="px-4 py-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-xs rounded-xl shadow-md hover:shadow transition-all flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none cursor-pointer"
              >
                <span className={`material-symbols-outlined text-base ${submitting ? 'animate-spin' : ''}`}>
                  {submitting ? 'sync' : 'chat'}
                </span>
                <span>{submitting ? 'Processing...' : 'Confirm & WhatsApp'}</span>
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
