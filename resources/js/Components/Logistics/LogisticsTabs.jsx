import React from 'react';
import { Link } from '@inertiajs/react';

const TABS = [
  { label: 'Dashboard', href: '/logistics', icon: 'dashboard' },
  { label: 'Dispatches', href: '/logistics/dispatches', icon: 'inventory_2' },
  { label: 'Users', href: '/logistics/users', icon: 'badge' },
  { label: 'Settings', href: '/logistics/settings', icon: 'tune' },
];

export default function LogisticsTabs({ active }) {
  return (
    <div className="border-b border-[#E5E5E5] bg-white px-3 sm:px-6">
      <nav className="flex gap-1 overflow-x-auto hide-sb" aria-label="Logistics sections">
        {TABS.map((tab) => {
          const isActive = active === tab.href;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? 'page' : undefined}
              className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-xs transition-colors ${
                isActive
                  ? 'border-[#005EA4] font-semibold text-[#005EA4]'
                  : 'border-transparent text-[#666666] hover:text-[#0B0B0B]'
              }`}
            >
              <span className="material-symbols-outlined text-base">{tab.icon}</span>
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
