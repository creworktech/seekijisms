import React from 'react';
import LoadingSpinner from './LoadingSpinner';

export default function TableLoadingOverlay({ loading = false, text = 'Loading records...' }) {
  if (!loading) return null;

  return (
    <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] z-30 flex items-center justify-center transition-all duration-200 rounded-xl">
      <div className="bg-white border border-[#E5E5E5] px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-3 animate-in fade-in zoom-in-95 duration-150">
        <LoadingSpinner size="md" color="#005ea4" />
        <span className="text-xs font-bold text-[#0B0B0B]">{text}</span>
      </div>
    </div>
  );
}
