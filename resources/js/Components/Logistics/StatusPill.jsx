import React from 'react';
import { statusConfig } from '../../utils/logistics';

export default function StatusPill({ status, showIcon = false, size = 'sm' }) {
  const config = statusConfig(status);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold whitespace-nowrap ${
        size === 'lg' ? 'px-3 py-1 text-xs' : 'px-2.5 py-0.5 text-[11px]'
      }`}
      style={{ backgroundColor: config.bg, color: config.text }}
    >
      {showIcon && (
        <span className="material-symbols-outlined" style={{ fontSize: size === 'lg' ? 16 : 13 }}>
          {config.icon}
        </span>
      )}
      {config.label}
    </span>
  );
}
