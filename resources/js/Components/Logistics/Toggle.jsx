import React, { useEffect, useState } from 'react';

/**
 * Optimistic switch. Flips immediately, rolls back if onToggle rejects —
 * the server has the final say on rules like "a location keeps one stop".
 */
export default function Toggle({ checked, onToggle, disabled = false, label = 'Toggle status' }) {
  const [optimistic, setOptimistic] = useState(checked);
  const [busy, setBusy] = useState(false);

  useEffect(() => setOptimistic(checked), [checked]);

  const handle = async () => {
    if (disabled || busy) return;

    const previous = optimistic;
    setOptimistic(!previous);
    setBusy(true);

    try {
      await onToggle();
    } catch {
      setOptimistic(previous);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={optimistic}
      aria-label={label}
      onClick={handle}
      disabled={disabled || busy}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#005EA4] focus-visible:ring-offset-2 ${
        optimistic ? 'bg-[#1BAF7A]' : 'bg-[#D1D5DB]'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          optimistic ? 'translate-x-[18px]' : 'translate-x-[3px]'
        }`}
      />
    </button>
  );
}
