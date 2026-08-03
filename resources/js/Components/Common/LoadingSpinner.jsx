import React from 'react';

export default function LoadingSpinner({ size = 'md', className = '', color = 'currentColor', text = '' }) {
  const sizeClasses = {
    xs: 'w-3 h-3 text-xs',
    sm: 'w-4 h-4 text-sm',
    md: 'w-5 h-5 text-base',
    lg: 'w-6 h-6 text-lg',
    xl: 'w-8 h-8 text-2xl',
  };

  const iconSize = sizeClasses[size] || sizeClasses.md;

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className={`material-symbols-outlined animate-spin shrink-0 ${iconSize}`}
        style={{ color }}
      >
        sync
      </span>
      {text && <span className="text-xs font-semibold">{text}</span>}
    </span>
  );
}
