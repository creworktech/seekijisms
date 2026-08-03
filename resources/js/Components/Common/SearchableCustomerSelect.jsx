import React, { useState, useEffect, useRef } from 'react';

export default function SearchableCustomerSelect({
  customers = [],
  selectedCustomerId = '',
  onSelectCustomer,
  placeholder = 'All Customers (All Works)',
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef(null);

  const selectedCustomer = customers.find((c) => String(c.id) === String(selectedCustomerId));

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCustomers = customers.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      c.name?.toLowerCase().includes(q) ||
      c.mobile?.toLowerCase().includes(q) ||
      c.customer_code?.toLowerCase().includes(q)
    );
  });

  const handleSelect = (id) => {
    onSelectCustomer(id);
    setSearchQuery('');
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Search Input / Display Bar */}
      <div className="relative flex items-center">
        <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[#717783] text-base leading-none pointer-events-none">
          person_search
        </span>
        <input
          type="text"
          value={isOpen ? searchQuery : selectedCustomer ? `${selectedCustomer.name} (${selectedCustomer.customer_code} • ${selectedCustomer.mobile})` : ''}
          placeholder={isOpen ? 'Search by Name, Mobile No, or Customer ID...' : placeholder}
          onFocus={() => {
            setIsOpen(true);
            setSearchQuery('');
          }}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          className="w-full pl-9 pr-9 py-1.5 bg-white text-[#0B0B0B] border border-[#E5E5E5] rounded-xl text-xs font-semibold outline-none focus:border-[#005ea4] cursor-pointer shadow-2xs truncate"
        />
        {selectedCustomerId ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleSelect('');
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors cursor-pointer shrink-0 z-10"
            title="Clear Customer Filter"
          >
            <span className="material-symbols-outlined text-[13px] leading-none">close</span>
          </button>
        ) : (
          <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-[#717783] text-base leading-none pointer-events-none">
            arrow_drop_down
          </span>
        )}
      </div>

      {/* Dropdown Options List */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-10 z-40 max-h-60 overflow-y-auto rounded-xl bg-white border border-[#E5E5E5] shadow-2xl divide-y divide-[#F0F0F0] text-xs thin-sb">
          {/* All Customers Option */}
          <div
            onMouseDown={(e) => {
              e.preventDefault();
              handleSelect('');
            }}
            className={`p-2.5 hover:bg-[#F0F7FF] cursor-pointer flex items-center justify-between font-bold text-xs transition-colors ${!selectedCustomerId ? 'bg-[#F0F7FF] text-[#005ea4]' : 'text-[#666666]'
              }`}
          >
            <span>{placeholder}</span>
            {!selectedCustomerId && (
              <span className="material-symbols-outlined text-sm text-[#005ea4]">check</span>
            )}
          </div>

          {/* Customer Items */}
          {filteredCustomers.length > 0 ? (
            filteredCustomers.map((cust) => {
              const isSelected = String(cust.id) === String(selectedCustomerId);
              return (
                <div
                  key={cust.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(cust.id);
                  }}
                  className={`p-2.5 hover:bg-[#F0F7FF] cursor-pointer flex items-center justify-between transition-colors ${isSelected ? 'bg-[#F0F7FF]' : ''
                    }`}
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="font-bold text-[#0B0B0B] truncate text-xs">{cust.name}</span>
                    <span className="text-[11px] text-[#666666] font-mono flex items-center gap-1 mt-0.5">
                      <span className="material-symbols-outlined text-[11px] text-[#94a3b8] leading-none">call</span>
                      {cust.mobile}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="sk-tok font-mono text-[10px]">{cust.customer_code}</span>
                    {isSelected && (
                      <span className="material-symbols-outlined text-sm text-[#005ea4]">check</span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-4 text-center text-xs text-[#666666]">
              No customer found matching "{searchQuery}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}
