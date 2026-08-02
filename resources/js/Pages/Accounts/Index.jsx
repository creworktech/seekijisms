import React, { useState } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import AppLayout from '../../Layouts/AppLayout';
import { formatCurrency, formatDate, formatDateTime, STAGES, OUTCOMES } from '../../utils/formatters';
import { exportToCSV, exportToPDF } from '../../utils/exportHelper';
import { openWhatsApp } from '../../utils/WhatsAppHelper';
import { motion, AnimatePresence } from 'framer-motion';

export default function AccountsIndex({
  transactions = { data: [], meta: {} },
  customers = [],
  duesBreakdown = [],
  summary = { total_revenue: 0, total_dues: 0, period_revenue: 0, paid_jobs_count: 0, unpaid_jobs_count: 0 },
  filters = {},
  sanctumToken,
}) {
  const { auth } = usePage().props;
  const user = auth?.user;

  const [customerId, setCustomerId] = useState(filters?.customer_id || '');
  const [fromDate, setFromDate] = useState(filters?.from_date || '');
  const [toDate, setToDate] = useState(filters?.to_date || '');
  const [unpaidOnly, setUnpaidOnly] = useState(Boolean(filters?.unpaid_only));
  const [isDuesModalOpen, setIsDuesModalOpen] = useState(false);

  const jobsData = transactions?.data || [];
  const meta = transactions?.meta || transactions;

  // Handle Global Customer Selection
  const handleGlobalCustomerChange = (val) => {
    setCustomerId(val);
    router.get(
      '/accounts',
      {
        customer_id: val,
        from_date: fromDate,
        to_date: toDate,
        unpaid_only: unpaidOnly ? 1 : 0,
      },
      { preserveState: true, preserveScroll: true }
    );
  };

  // Handle Date Filter Submission
  const handleApplyFilter = (e) => {
    if (e) e.preventDefault();
    router.get(
      '/accounts',
      {
        customer_id: customerId,
        from_date: fromDate,
        to_date: toDate,
        unpaid_only: unpaidOnly ? 1 : 0,
      },
      { preserveState: true, preserveScroll: true }
    );
  };

  const handleToggleUnpaidOnly = () => {
    const nextUnpaid = !unpaidOnly;
    setUnpaidOnly(nextUnpaid);
    router.get(
      '/accounts',
      {
        customer_id: customerId,
        from_date: fromDate,
        to_date: toDate,
        unpaid_only: nextUnpaid ? 1 : 0,
      },
      { preserveState: true, preserveScroll: true }
    );
  };

  const handleResetFilter = () => {
    setCustomerId('');
    setFromDate('');
    setToDate('');
    setUnpaidOnly(false);
    router.get('/accounts', {}, { preserveState: true, preserveScroll: true });
  };

  // Quick Date Range Presets
  const handlePreset30Days = () => {
    const end = new Date().toISOString().split('T')[0];
    const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setFromDate(start);
    setToDate(end);
    router.get('/accounts', { customer_id: customerId, from_date: start, to_date: end, unpaid_only: unpaidOnly ? 1 : 0 }, { preserveState: true, preserveScroll: true });
  };

  const handlePresetThisMonth = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const end = now.toISOString().split('T')[0];
    setFromDate(start);
    setToDate(end);
    router.get('/accounts', { customer_id: customerId, from_date: start, to_date: end, unpaid_only: unpaidOnly ? 1 : 0 }, { preserveState: true, preserveScroll: true });
  };

  // WhatsApp Reminder Sender
  const sendDuesWhatsAppReminder = (cItem) => {
    const jobListStr = cItem.jobs.map(j => `• ${j.product_name} (#${j.token_no}): ₹${j.payable_amount}`).join('\n');
    const msg = `Dear ${cItem.name},\n\nThis is a friendly reminder from Seekoji Electric regarding your pending repair payment balance of *₹${cItem.total_due.toLocaleString('en-IN')}*.\n\nWork Orders with Outstanding Dues:\n${jobListStr}\n\nKindly clear the dues at your earliest convenience. Thank you!`;
    openWhatsApp({ mobile: cItem.mobile, message: msg });
  };

  return (
    <AppLayout title="Accounts & Payments">
      <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
        
        {/* GLOBAL TOP HEADER & CUSTOMER FILTER (ABOVE CARDS) */}
        <div className="bg-white border border-[#E5E5E5] rounded-2xl p-4 shadow-2xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#005ea4]/10 text-[#005ea4] flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-xl">account_balance_wallet</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-[#0B0B0B]">Accounts & Financial Management</h2>
              <p className="text-xs text-[#666666]">Overview of revenues, outstanding dues, and customer financial records</p>
            </div>
          </div>

          {/* GLOBAL CUSTOMER SELECTOR */}
          <div className="flex items-center gap-2 min-w-[320px] sm:min-w-[400px]">
            <label className="text-xs font-bold uppercase tracking-wider text-[#666666] shrink-0 flex items-center gap-1">
              <span className="material-symbols-outlined text-base text-[#005ea4]">person</span>
              Customer Filter:
            </label>
            <select
              value={customerId}
              onChange={(e) => handleGlobalCustomerChange(e.target.value)}
              className="w-full py-2 px-3 bg-[#f9f9f7] border border-[#E5E5E5] rounded-xl text-xs font-semibold text-[#0B0B0B] outline-none focus:border-[#005ea4] cursor-pointer shadow-2xs"
            >
              <option value="">All Customers (All Work Orders)</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.customer_code} • {c.mobile})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* TOP SUMMARY CARDS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Total Revenue */}
          <div className="bg-gradient-to-br from-[#005ea4] to-[#004278] rounded-2xl p-5 text-white shadow-md space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-100">
                Total Revenue (All Time)
              </span>
              <div className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-xl">payments</span>
              </div>
            </div>
            <div className="text-3xl font-black tracking-tight">
              {formatCurrency(summary.total_revenue || 0)}
            </div>
            <p className="text-xs text-blue-100/80 font-medium">
              Settled payments across all work orders
            </p>
          </div>

          {/* Card 2: Dues Amount (INTERACTIVE: Opens Customer Dues Breakdown Modal) */}
          <div
            onClick={() => setIsDuesModalOpen(true)}
            className="bg-gradient-to-br from-[#d97706] to-[#b45309] rounded-2xl p-5 text-white shadow-md space-y-3 relative overflow-hidden cursor-pointer hover:scale-[1.01] hover:shadow-lg transition-all group"
            title="Click to view product-wise dues breakdown per customer"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-100 flex items-center gap-1">
                Total Outstanding Dues
                <span className="material-symbols-outlined text-xs group-hover:translate-x-0.5 transition-transform">open_in_new</span>
              </span>
              <div className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-xl">pending_actions</span>
              </div>
            </div>
            <div className="text-3xl font-black tracking-tight">
              {formatCurrency(summary.total_dues || 0)}
            </div>
            <div className="flex items-center justify-between gap-2 pt-1">
              <p className="text-xs text-amber-100/90 font-medium truncate">
                Click to view dues ({duesBreakdown.length} Customers)
              </p>
              <span className="text-[10px] font-bold bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-full text-white whitespace-nowrap inline-flex items-center gap-1 shrink-0 transition-colors">
                <span>View Dues</span>
                <span className="material-symbols-outlined text-xs">arrow_forward</span>
              </span>
            </div>
          </div>

          {/* Card 3: Date Range Revenue (Last 30 Days) */}
          <div className="bg-gradient-to-br from-[#7c3aed] to-[#5b21b6] rounded-2xl p-5 text-white shadow-md space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-100">
                Filtered Period Revenue
              </span>
              <div className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-xl">insights</span>
              </div>
            </div>
            <div className="text-3xl font-black tracking-tight">
              {formatCurrency(summary.period_revenue || 0)}
            </div>
            <p className="text-xs text-purple-100/80 font-medium">
              Range: {formatDate(filters.from_date)} - {formatDate(filters.to_date)}
            </p>
          </div>

          {/* Card 4: Paid vs Unpaid Jobs Count */}
          <div className="bg-white border border-[#E5E5E5] rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#666666]">
                Payment Status Overview
              </span>
              <div className="w-9 h-9 rounded-xl bg-[#f4f4f2] flex items-center justify-center text-[#005ea4]">
                <span className="material-symbols-outlined text-xl">fact_check</span>
              </div>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-black text-[#10b981]">
                {summary.paid_jobs_count || 0} <span className="text-xs font-semibold text-[#666666]">PAID</span>
              </span>
              <span className="text-gray-300">/</span>
              <span className="text-2xl font-black text-[#f59e0b]">
                {summary.unpaid_jobs_count || 0} <span className="text-xs font-semibold text-[#666666]">DUE</span>
              </span>
            </div>
            <p className="text-xs text-[#666666] font-medium">
              {((summary.paid_jobs_count || 0) + (summary.unpaid_jobs_count || 0))} work order financial records
            </p>
          </div>

        </div>

        {/* DATE RANGE FILTER BAR & EXPORT ACTIONS */}
        <div className="bg-white border border-[#E5E5E5] rounded-2xl p-5 shadow-2xs space-y-4">
          
          <form onSubmit={handleApplyFilter} className="flex flex-wrap items-end gap-4">
            
            {/* From Date */}
            <div className="w-44 space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#666666] flex items-center gap-1">
                <span className="material-symbols-outlined text-sm text-[#005ea4]">calendar_today</span>
                From Date
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full py-2 px-3 bg-[#f9f9f7] border border-[#E5E5E5] rounded-xl text-xs font-semibold text-[#0B0B0B] outline-none focus:border-[#005ea4]"
              />
            </div>

            {/* To Date */}
            <div className="w-44 space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#666666] flex items-center gap-1">
                <span className="material-symbols-outlined text-sm text-[#005ea4]">event</span>
                To Date
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full py-2 px-3 bg-[#f9f9f7] border border-[#E5E5E5] rounded-xl text-xs font-semibold text-[#0B0B0B] outline-none focus:border-[#005ea4]"
              />
            </div>

            {/* Unpaid Dues Toggle Filter */}
            <button
              type="button"
              onClick={handleToggleUnpaidOnly}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                unpaidOnly
                  ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                  : 'bg-[#f4f4f2] text-[#666666] border-[#E5E5E5] hover:bg-gray-200'
              }`}
            >
              <span className="material-symbols-outlined text-sm">pending</span>
              <span>{unpaidOnly ? 'Showing Unpaid Only' : 'Show Unpaid Dues Only'}</span>
            </button>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-[#005ea4] hover:bg-[#004278] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">filter_alt</span>
                <span>Apply Date Filter</span>
              </button>

              <button
                type="button"
                onClick={handleResetFilter}
                className="px-3.5 py-2 bg-[#f4f4f2] hover:bg-gray-200 text-[#0B0B0B] rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">restart_alt</span>
                <span>Reset</span>
              </button>
            </div>

            {/* Export Actions Right */}
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => exportToCSV(jobsData, 'accounts_payments_export.csv')}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">csv</span>
                <span>Export CSV</span>
              </button>

              <button
                type="button"
                onClick={() => exportToPDF(jobsData, 'Accounts & Financial Statement', 'accounts_financial_report.pdf')}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
                <span>Export PDF</span>
              </button>
            </div>

          </form>

          {/* Quick Date Presets */}
          <div className="flex items-center gap-2 pt-2 border-t border-[#E5E5E5] text-xs">
            <span className="text-[11px] font-bold text-[#666666] uppercase">Quick Presets:</span>
            <button
              onClick={handlePreset30Days}
              className="px-2.5 py-1 bg-[#f4f4f2] hover:bg-[#005ea4] hover:text-white rounded-lg text-[11px] font-semibold text-[#666666] transition-colors cursor-pointer"
            >
              Last 30 Days
            </button>
            <button
              onClick={handlePresetThisMonth}
              className="px-2.5 py-1 bg-[#f4f4f2] hover:bg-[#005ea4] hover:text-white rounded-lg text-[11px] font-semibold text-[#666666] transition-colors cursor-pointer"
            >
              This Month
            </button>
          </div>

        </div>

        {/* FINANCIAL TRANSACTIONS TABLE */}
        <div className="bg-white border border-[#E5E5E5] rounded-2xl shadow-2xs overflow-hidden">
          
          <div className="p-4 border-b border-[#E5E5E5] bg-[#f9f9f7] flex justify-between items-center">
            <h3 className="font-bold text-xs uppercase tracking-wider text-[#0B0B0B] flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-[#005ea4]">receipt_long</span>
              Financial Records & Payment Transactions ({meta?.total || jobsData.length})
            </h3>
            <span className="text-xs font-bold text-[#666666] bg-[#f4f4f2] px-3 py-1 rounded-full border border-[#E5E5E5]">
              30 Records / Page
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs divide-y divide-[#E5E5E5]">
              <thead className="bg-[#f4f4f2] text-[#666666] font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Token No</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Product / Item</th>
                  <th className="py-3 px-4">Stage</th>
                  <th className="py-3 px-4 text-right">Payable Amount</th>
                  <th className="py-3 px-4 text-center">Payment Status</th>
                  <th className="py-3 px-4 text-center">Payment Mode</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5] bg-white font-medium text-[#0B0B0B]">
                {jobsData.length > 0 ? (
                  jobsData.map((job) => {
                    const stageConfig = STAGES[job.stage] || STAGES.new;
                    const isPaid = Boolean(job.is_paid);

                    return (
                      <tr key={job.id} className="hover:bg-[#f9f9f7] transition-colors">
                        
                        {/* Token No */}
                        <td className="py-3 px-4 font-mono font-bold text-[#005ea4]">
                          #{job.token_no}
                        </td>

                        {/* Customer */}
                        <td className="py-3 px-4">
                          <div className="font-bold">{job.customer?.name || 'Walk-in Customer'}</div>
                          <div className="text-[11px] text-[#666666] font-mono">{job.customer?.mobile || '-'}</div>
                        </td>

                        {/* Product */}
                        <td className="py-3 px-4">
                          <div className="font-bold">{job.product_name}</div>
                          <div className="text-[10px] text-[#666666]">{job.brand || '-'} ({job.serial_no || 'No S/N'})</div>
                        </td>

                        {/* Stage */}
                        <td className="py-3 px-4">
                          <span
                            className="sk-pill uppercase text-[10px] font-bold"
                            style={{ background: stageConfig.pbg, color: stageConfig.ptx }}
                          >
                            {stageConfig.label}
                          </span>
                        </td>

                        {/* Payable Amount */}
                        <td className="py-3 px-4 text-right font-black text-sm font-mono text-[#0B0B0B]">
                          {formatCurrency(job.payable_amount || 0)}
                        </td>

                        {/* Payment Status */}
                        <td className="py-3 px-4 text-center">
                          {isPaid ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <span className="material-symbols-outlined text-xs text-emerald-600">sentiment_very_satisfied</span>
                              PAID
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              <span className="material-symbols-outlined text-xs text-amber-600">pending</span>
                              DUE
                            </span>
                          )}
                        </td>

                        {/* Payment Mode */}
                        <td className="py-3 px-4 text-center uppercase font-bold text-[10px] text-[#666666]">
                          {job.payment_mode || '-'}
                        </td>

                        {/* Date */}
                        <td className="py-3 px-4 text-[11px] text-[#666666]">
                          {formatDate(job.paid_at || job.updated_at || job.created_at)}
                        </td>

                        {/* Action: Round Arrow Redirect to Job Control Panel */}
                        <td className="py-3 px-4 text-center">
                          <Link
                            href={`/jcc?stage=${job.stage || 'completed'}&customer_id=${job.customer_id || job.customer?.id || ''}&search=${job.token_no}`}
                            title="View in Job Control Center"
                            className="w-8 h-8 rounded-full bg-[#005ea4] hover:bg-[#004278] text-white inline-flex items-center justify-center shadow-xs transition-all hover:scale-110 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-sm font-bold">arrow_forward</span>
                          </Link>
                        </td>

                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="9" className="py-8 text-center text-xs text-[#666666]">
                      No financial transaction records found for the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* TABLE FOOTER WITH 30 ROWS PAGINATION */}
          {meta && meta.links && (
            <div className="p-4 border-t border-[#E5E5E5] bg-[#f9f9f7] flex flex-col sm:flex-row justify-between items-center gap-4 text-xs">
              <div className="text-[#666666] font-medium">
                Showing <span className="font-bold text-[#0B0B0B]">{meta.from || 0}</span> to{' '}
                <span className="font-bold text-[#0B0B0B]">{meta.to || 0}</span> of{' '}
                <span className="font-bold text-[#0B0B0B]">{meta.total || 0}</span> entries
              </div>

              <div className="flex items-center gap-1 flex-wrap">
                {meta.links.map((link, idx) => (
                  <button
                    key={idx}
                    disabled={!link.url}
                    onClick={() => link.url && router.get(link.url, {}, { preserveState: true, preserveScroll: true })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      link.active
                        ? 'bg-[#005ea4] text-white font-bold'
                        : link.url
                        ? 'bg-white border border-[#E5E5E5] text-[#0B0B0B] hover:bg-[#f4f4f2]'
                        : 'bg-[#f4f4f2] text-gray-400 cursor-not-allowed'
                    }`}
                    dangerouslySetInnerHTML={{ __html: link.label }}
                  />
                ))}
              </div>
            </div>
          )}

        </div>

      </div>

      {/* CUSTOMER OUTSTANDING DUES BREAKDOWN MODAL */}
      <AnimatePresence>
        {isDuesModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-[#E5E5E5] w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Modal Header */}
              <div className="p-6 bg-gradient-to-r from-[#d97706] to-[#b45309] text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-xl">pending_actions</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-black tracking-tight">Customer Outstanding Dues Breakdown</h3>
                    <p className="text-xs text-amber-100">
                      Product-wise pending balances for {duesBreakdown.length} customers • Total Dues: {formatCurrency(summary.total_dues || 0)}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsDuesModalOpen(false)}
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              {/* Modal Body: Customer-wise Product Dues List */}
              <div className="flex-1 p-6 overflow-y-auto space-y-6 thin-sb bg-[#f9f9f7]">
                {duesBreakdown.length > 0 ? (
                  duesBreakdown.map((cItem) => (
                    <div key={cItem.id} className="bg-white rounded-2xl border border-[#E5E5E5] p-5 shadow-2xs space-y-4">
                      
                      {/* Customer Header Bar */}
                      <div className="flex justify-between items-center flex-wrap gap-2 pb-3 border-b border-[#E5E5E5]">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#005ea4] text-white font-bold flex items-center justify-center text-xs">
                            {cItem.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-[#0B0B0B]">{cItem.name}</h4>
                            <div className="flex items-center gap-2 text-xs text-[#666666]">
                              <span>ID: #{cItem.customer_code}</span>
                              <span>•</span>
                              <span>Mobile: {cItem.mobile}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black">
                            Total Due: {formatCurrency(cItem.total_due)}
                          </span>

                          <button
                            onClick={() => sendDuesWhatsAppReminder(cItem)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-sm">chat</span>
                            <span>Remind via WhatsApp</span>
                          </button>
                        </div>
                      </div>

                      {/* Products List under Dues */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#666666]">
                          Products with Pending Payment ({cItem.jobs.length}):
                        </span>

                        <div className="divide-y divide-[#E5E5E5] border border-[#E5E5E5] rounded-xl overflow-hidden bg-[#fbfbf9]">
                          {cItem.jobs.map((job) => {
                            const stageConfig = STAGES[job.stage] || STAGES.new;

                            return (
                              <div key={job.id} className="p-3 flex items-center justify-between gap-4 text-xs hover:bg-white transition-colors">
                                <div className="flex items-center gap-3">
                                  <span className="font-mono font-bold text-[#005ea4] text-xs">
                                    #{job.token_no}
                                  </span>
                                  <div>
                                    <span className="font-bold text-[#0B0B0B] block">{job.product_name}</span>
                                    <span className="text-[10px] text-[#666666]">
                                      Brand: {job.brand || '-'} {job.serial_no ? `(S/N: ${job.serial_no})` : ''}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-4">
                                  <span
                                    className="sk-pill uppercase text-[9px] font-bold"
                                    style={{ background: stageConfig.pbg, color: stageConfig.ptx }}
                                  >
                                    {stageConfig.label}
                                  </span>

                                  <span className="font-black text-sm text-[#d97706] font-mono">
                                    {formatCurrency(job.payable_amount)}
                                  </span>

                                  <Link
                                    href={`/jcc?stage=${job.stage || 'completed'}&customer_id=${cItem.id || job.customer_id || ''}&search=${job.token_no}`}
                                    onClick={() => setIsDuesModalOpen(false)}
                                    title="Open in Control Center"
                                    className="w-7 h-7 rounded-full bg-[#005ea4] hover:bg-[#004278] text-white flex items-center justify-center shadow-2xs transition-all hover:scale-110 cursor-pointer"
                                  >
                                    <span className="material-symbols-outlined text-xs font-bold">arrow_forward</span>
                                  </Link>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-xs text-[#666666] bg-white rounded-2xl border border-[#E5E5E5]">
                    No customer outstanding dues found for the selected filters.
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-white border-t border-[#E5E5E5] flex justify-between items-center text-xs text-[#666666]">
                <span>Showing product-level unpaid balances</span>
                <button
                  onClick={() => setIsDuesModalOpen(false)}
                  className="px-4 py-2 bg-[#005ea4] hover:bg-[#004278] text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </AppLayout>
  );
}
