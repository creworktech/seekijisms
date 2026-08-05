import React from 'react';

export default function EmptyState({ icon = 'inbox', message, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="material-symbols-outlined mb-2 text-4xl text-[#C9C9C9]">{icon}</span>
      <p className="mb-3 text-xs text-[#666666]">{message}</p>
      {action}
    </div>
  );
}
