import React, { useState } from 'react';
import { Link, usePage, router } from '@inertiajs/react';
import AppLayout from '../../Layouts/AppLayout';
import CreateJobModal from '../../Components/Jobs/CreateJobModal';
import ShowCustomerDrawer from '../../Components/Customers/ShowCustomerDrawer';
import { formatCurrency } from '../../utils/formatters';

export default function Dashboard({ stats, dashboardCustomers = [], recentJobs = [], sanctumToken }) {
  const { auth } = usePage().props;
  const user = auth?.user;

  // Selected customer for detailed view panel
  const [selectedCustomerId, setSelectedCustomerId] = useState(dashboardCustomers[0]?.id || null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedCustomerDrawer, setSelectedCustomerDrawer] = useState(null);

  const selectedCustomer = dashboardCustomers.find((c) => c.id === selectedCustomerId) || dashboardCustomers[0] || null;

  const { tiles } = stats || {};

  const topTiles = [
    { label: 'NEW JOBS', val: tiles?.new_jobs ?? stats?.new_jobs ?? stats?.stages?.new ?? 0, color: '#005ea4', bg: '#E6F0FF', icon: 'fiber_new' },
    { label: 'Total Revenue', val: formatCurrency(tiles?.total_revenue || 0), color: '#1BAF7A', bg: '#ecfdf5', icon: 'account_balance_wallet' },
    { label: 'Dues Amount', val: formatCurrency(tiles?.dues_amount || 0), color: '#FFA500', bg: '#fff7ed', icon: 'schedule' },
    { label: 'Cancelled Jobs', val: tiles?.cancelled_jobs || 0, color: '#D03B3B', bg: '#fef2f2', icon: 'cancel' },
  ];

  // Overview Cards Config
  const overviewCards = [
    { key: 'total_received', label: 'TOTAL RECEIVED', val: stats?.total_received || 0, color: '#005ea4', bg: '#E6F0FF', icon: 'move_to_inbox' },
    { key: 'today_received', label: 'TODAY RECEIVED', val: stats?.today_received || 0, color: '#005ea4', bg: '#E6F0FF', icon: 'inbox' },
    { key: 'new', label: 'NEW JOBS', val: stats?.new_jobs ?? stats?.stages?.new ?? 0, color: '#2563eb', bg: '#eff6ff', icon: 'fiber_new' },
    { key: 'testing', label: 'TESTING', val: stats?.testing || 0, color: '#8b5cf6', bg: '#faf5ff', icon: 'electrical_services' },
    { key: 'under_testing', label: 'UNDER TESTING', val: stats?.under_testing || 0, color: '#8b5cf6', bg: '#faf5ff', icon: 'electric_bolt' },
    { key: 'todays_task', label: "TODAY'S TASK", val: stats?.todays_task || 0, color: '#005ea4', bg: '#E6F0FF', icon: 'assignment' },
    { key: 'approval', label: 'APPROVAL', val: stats?.approval || 0, color: '#f59e0b', bg: '#fff7ed', icon: 'pending_actions' },
    { key: 'delivered', label: 'DELIVERED', val: stats?.delivered || 0, color: '#10b981', bg: '#ecfdf5', icon: 'local_shipping' },
    { key: 'ready', label: 'READY FOR DELIVERY', val: stats?.ready || 0, color: '#06b6d4', bg: '#ecfeff', icon: 'schedule_send' },
    { key: 'pending', label: 'PENDING', val: stats?.pending || 0, color: '#f59e0b', bg: '#fff7ed', icon: 'schedule' },
    { key: 'not_repairable', label: 'NOT REPAIRABLE', val: stats?.not_repairable || 0, color: '#ef4444', bg: '#fef2f2', icon: 'report_problem' },
    { key: 'cancelled', label: 'CANCEL', val: stats?.cancelled || 0, color: '#ec4899', bg: '#fdf2f8', icon: 'cancel' },
    { key: 'completed', label: 'COMPLETED', val: stats?.completed || 0, color: '#10b981', bg: '#ecfdf5', icon: 'check_circle' },
    { key: 'high_priority', label: 'HIGH PRIORITY', val: stats?.high_priority || 0, color: '#ef4444', bg: '#fef2f2', icon: 'priority_high' },
  ];

  // Helper for customer-specific metric card config
  const getCustomerMetrics = (cStats) => [
    { label: 'TOTAL RECEIVED', val: cStats?.total_received || 0, color: '#005ea4', bg: '#E6F0FF', icon: 'move_to_inbox' },
    { label: 'TODAY RECEIVED', val: cStats?.today_received || 0, color: '#005ea4', bg: '#E6F0FF', icon: 'inbox' },
    { label: 'TESTING', val: cStats?.testing || 0, color: '#8b5cf6', bg: '#faf5ff', icon: 'science' },
    { label: 'UNDER TESTING', val: cStats?.under_testing || 0, color: '#8b5cf6', bg: '#faf5ff', icon: 'biotech' },
    { label: 'TODAY\'S TASK', val: cStats?.todays_task || 0, color: '#005ea4', bg: '#E6F0FF', icon: 'assignment' },
    { label: 'APPROVAL', val: cStats?.approval || 0, color: '#f59e0b', bg: '#fff7ed', icon: 'pending_actions' },
    { label: 'DELIVERED', val: cStats?.delivered || 0, color: '#10b981', bg: '#ecfdf5', icon: 'local_shipping' },
    { label: 'READY FOR DELIVERY', val: cStats?.ready || 0, color: '#06b6d4', bg: '#ecfeff', icon: 'schedule_send' },
    { label: 'PENDING', val: cStats?.pending || 0, color: '#f59e0b', bg: '#fff7ed', icon: 'schedule' },
    { label: 'NOT REPAIRABLE', val: cStats?.not_repairable || 0, color: '#ef4444', bg: '#fef2f2', icon: 'report_problem' },
    { label: 'CANCEL', val: cStats?.cancelled || 0, color: '#ec4899', bg: '#fdf2f8', icon: 'cancel' },
    { label: 'COMPLETED', val: cStats?.completed || 0, color: '#10b981', bg: '#ecfdf5', icon: 'check_circle' },
    { label: 'HIGH PRIORITY', val: cStats?.high_priority || 0, color: '#ef4444', bg: '#fef2f2', icon: 'priority_high' },
  ];

  return (
    <AppLayout title="Dashboard">
      <div className="p-4 space-y-6 w-full max-w-full">

        {/* PAGE HEAD */}
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#0B0B0B]">Welcome Back, {user?.name || 'Admin'}!</h1>
            <p className="text-[#666666] text-xs mt-0.5">Here is a snapshot of your service center performance today.</p>
          </div>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2.5 bg-[#005ea4] hover:bg-[#00487e] text-white rounded-xl font-bold text-xs shadow-sm hover:shadow transition-all flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">add</span>
            <span>New Job Intake</span>
          </button>
        </div>

        {/* 4 TOP TILES (Admin Only) */}
        {user?.roles?.includes('admin') && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {topTiles.map((t, idx) => (
              <div
                key={idx}
                className="sk-tile"
                style={{ background: t.bg, border: `1px solid ${t.color}22` }}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white shrink-0"
                  style={{ background: t.color }}
                >
                  <span className="material-symbols-outlined text-2xl">{t.icon}</span>
                </div>
                <div>
                  <div className="text-[11px] font-bold tracking-wider uppercase" style={{ color: t.color }}>
                    {t.label}
                  </div>
                  <div className="text-2xl font-bold text-[#0B0B0B] leading-tight">
                    {t.val}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* OVERVIEW SECTION */}
        <div className="space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <h2 className="text-xl font-bold text-[#0f172a] tracking-tight">Overview</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-3.5">
            {overviewCards.map((card, idx) => (
              <div
                key={idx}
                className="bg-white p-4 rounded-2xl border border-[#e2e8f0] shadow-sm flex flex-col justify-between items-center text-center hover:shadow-md transition-all group"
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-transform group-hover:scale-110"
                  style={{ backgroundColor: card.bg }}
                >
                  <span className="material-symbols-outlined text-xl" style={{ color: card.color }}>
                    {card.icon}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-[#64748b] tracking-wider uppercase">
                  {card.label}
                </span>
                <span className="text-2xl font-black text-[#0f172a] leading-none mt-2">
                  {String(card.val).padStart(2, '0')}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* HORIZONTAL SEPARATOR */}
        <hr className="border-t border-[#E5E5E5] my-10" />

        {/* CUSTOMER LIST & DETAIL BREAKDOWN SECTION */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-[#0f172a] tracking-tight">Customer List</h2>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

            {/* LEFT COLUMN: CUSTOMER SELECTOR LIST (SCROLLABLE) */}
            <div className="lg:col-span-5 max-h-[620px] overflow-y-auto space-y-3.5 pr-2 thin-sb">
              {dashboardCustomers.length > 0 ? (
                dashboardCustomers.map((cust) => {
                  const isSelected = selectedCustomer?.id === cust.id;
                  const initials = cust.name
                    ? cust.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
                    : 'CU';

                  return (
                    <div
                      key={cust.id}
                      onClick={() => setSelectedCustomerId(cust.id)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer bg-white flex items-start gap-4 shadow-sm hover:shadow ${isSelected
                        ? 'border-2 border-[#2563eb] ring-2 ring-[#2563eb]/10'
                        : 'border-[#e2e8f0] hover:border-[#cbd5e1]'
                        }`}
                    >
                      <div className="w-11 h-11 rounded-full bg-[#f1f5f9] text-[#2563eb] font-extrabold flex items-center justify-center text-sm border border-[#e2e8f0] shrink-0">
                        {initials}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-bold text-sm text-[#0f172a] truncate">{cust.name}</h3>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#dcfce7] text-[#15803d] uppercase tracking-wider">
                            ACTIVE
                          </span>
                        </div>

                        <p className="text-[11px] font-semibold text-[#64748b] mt-0.5">
                          ID: #{cust.customer_code}
                        </p>

                        <div className="mt-2 space-y-1 text-xs text-[#64748b]">
                          <div className="flex items-center gap-2 truncate">
                            <span className="material-symbols-outlined text-sm text-[#94a3b8]">mail</span>
                            <span className="truncate">{cust.email}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm text-[#94a3b8]">call</span>
                            <span className="font-mono text-[#334155]">{cust.mobile}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center bg-white rounded-2xl border border-[#e2e8f0] text-xs text-[#64748b]">
                  No active dashboard customers found.
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: SELECTED CUSTOMER BREAKDOWN CARD */}
            <div className="lg:col-span-7">
              {selectedCustomer ? (
                <div className="bg-white rounded-3xl border border-[#e2e8f0] shadow-sm overflow-hidden space-y-6">

                  {/* HEADER BANNER */}
                  <div className="bg-gradient-to-r from-[#263e74] to-[#1d4ed8] p-6 text-white flex justify-between items-center flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md border-2 border-white/40 flex items-center justify-center font-black text-xl text-white shadow-inner shrink-0">
                        {selectedCustomer.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h2 className="text-2xl font-black tracking-tight">{selectedCustomer.name}</h2>
                        <div className="flex items-center gap-4 text-xs text-blue-100 font-medium mt-1">
                          <span>Customer ID: #{selectedCustomer.customer_code}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">calendar_today</span>
                            Joined: {selectedCustomer.registered_on}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedCustomerDrawer(selectedCustomer)}
                        className="px-3.5 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold backdrop-blur-md transition-all flex items-center gap-1.5 shadow-sm border border-white/20 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">visibility</span>
                        <span>View</span>
                      </button>

                      {user?.roles?.includes('admin') && (
                        <Link
                          href={`/jcc?customer_id=${selectedCustomer.id}`}
                          className="px-3.5 py-2 bg-white text-[#1d4ed8] hover:bg-blue-50 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-sm">bolt</span>
                          <span>Job Control</span>
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* 13 CUSTOMER METRICS GRID */}
                  <div className="px-6 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748b]">
                      Customer Service Breakdown
                    </h4>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {getCustomerMetrics(selectedCustomer.stats).map((m, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] flex flex-col items-start justify-between hover:bg-white hover:shadow-sm transition-all"
                        >
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center mb-2"
                            style={{ backgroundColor: m.bg }}
                          >
                            <span className="material-symbols-outlined text-base" style={{ color: m.color }}>
                              {m.icon}
                            </span>
                          </div>
                          <span className="text-[9px] font-bold text-[#64748b] tracking-wider uppercase leading-tight">
                            {m.label}
                          </span>
                          <span className="text-xl font-black text-[#0f172a] leading-none mt-2">
                            {String(m.val).padStart(2, '0')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* CONTACT INFORMATION FOOTER */}
                  <div className="px-6 pb-6 pt-4 border-t border-[#e2e8f0] space-y-4 bg-[#f8fafc]/50">
                    <div className="space-y-1">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">Phone Number</p>
                      <p className="text-xs font-mono font-bold text-[#0f172a] flex items-center gap-2">
                        <span className="material-symbols-outlined text-base text-[#2563eb]">call</span>
                        +91 {selectedCustomer.mobile}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">Address</p>
                      <p className="text-xs font-medium text-[#334155] flex items-center gap-2">
                        <span className="material-symbols-outlined text-base text-[#2563eb] shrink-0">location_on</span>
                        <span>{selectedCustomer.address || 'Address not registered'}</span>
                      </p>
                    </div>
                  </div>

                </div>
              ) : (
                <div className="p-12 text-center bg-white rounded-3xl border border-[#e2e8f0] text-xs text-[#64748b]">
                  Select a customer from the list to view detailed service metrics.
                </div>
              )}
            </div>

          </div>
        </div>

      </div>

      {/* CREATE JOB / INTAKE MODAL */}
      <CreateJobModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          setIsCreateModalOpen(false);
          router.reload();
        }}
        sanctumToken={sanctumToken}
      />

      {/* SHOW / EDIT CUSTOMER DRAWER */}
      <ShowCustomerDrawer
        customer={selectedCustomerDrawer}
        isOpen={!!selectedCustomerDrawer}
        onClose={() => setSelectedCustomerDrawer(null)}
        sanctumToken={sanctumToken}
        hideMetrics={true}
      />
    </AppLayout>
  );
}
