import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePage } from '@inertiajs/react';
import axios from 'axios';
import { formatCurrency, formatDate, formatDateTime, STAGES } from '../../utils/formatters';

export default function ShowCustomerDrawer({ customer, isOpen, onClose, sanctumToken, hideMetrics = false, onEdit, isAdmin: propIsAdmin }) {
  const { auth } = usePage().props || {};
  const isAdmin = propIsAdmin !== undefined ? propIsAdmin : (auth?.user?.roles?.includes('admin') ?? false);

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedJobIds, setExpandedJobIds] = useState({});
  const [jobEventsMap, setJobEventsMap] = useState({});
  const [loadingJobIds, setLoadingJobIds] = useState({});

  useEffect(() => {
    if (customer && isOpen) {
      fetchCustomerJobs();
      setSearch('');
      setExpandedJobIds({});
    }
  }, [customer, isOpen]);

  const fetchCustomerJobs = async () => {
    setLoading(true);
    try {
      const headers = sanctumToken ? { Authorization: `Bearer ${sanctumToken}` } : {};
      const res = await axios.get(`/api/v1/customers/${customer.id}/jobs`, { headers });
      setJobs(res.data?.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleJobTimeline = async (jobId) => {
    const isCurrentlyExpanded = !!expandedJobIds[jobId];
    setExpandedJobIds((prev) => ({ ...prev, [jobId]: !isCurrentlyExpanded }));

    if (!isCurrentlyExpanded && !jobEventsMap[jobId]) {
      setLoadingJobIds((prev) => ({ ...prev, [jobId]: true }));
      try {
        const headers = sanctumToken ? { Authorization: `Bearer ${sanctumToken}` } : {};
        const res = await axios.get(`/api/v1/jobs/${jobId}/events`, { headers });
        setJobEventsMap((prev) => ({ ...prev, [jobId]: res.data?.data || [] }));
      } catch (err) {
        console.error('Failed to load job events:', err);
      } finally {
        setLoadingJobIds((prev) => ({ ...prev, [jobId]: false }));
      }
    }
  };

  const toggleAllTimelines = () => {
    const allExpanded = filteredJobs.length > 0 && filteredJobs.every((j) => expandedJobIds[j.id]);
    const newExpandedState = {};

    filteredJobs.forEach((job) => {
      newExpandedState[job.id] = !allExpanded;
      if (!allExpanded && !jobEventsMap[job.id]) {
        toggleJobTimeline(job.id);
      }
    });

    setExpandedJobIds(newExpandedState);
  };

  if (!isOpen || !customer) return null;

  // Calculate 13 status cards matching pre-existing design system
  const cStats = {
    total_received: jobs.length,
    today_received: jobs.filter(j => {
      const d = new Date(j.created_at || j.in_date);
      const today = new Date();
      return d.toDateString() === today.toDateString();
    }).length,
    testing: jobs.filter(j => j.stage === 'testing').length,
    under_testing: jobs.filter(j => j.stage === 'testing').length,
    todays_task: jobs.filter(j => j.stage === 'repair').length,
    approval: jobs.filter(j => j.stage === 'approval').length,
    delivered: jobs.filter(j => j.stage === 'delivered').length,
    ready: jobs.filter(j => j.stage === 'ready').length,
    pending: jobs.filter(j => j.stage === 'pending').length,
    not_repairable: jobs.filter(j => j.outcome === 'not_repairable').length,
    cancelled: jobs.filter(j => j.outcome === 'cancelled' || j.stage === 'cancelled').length,
    completed: jobs.filter(j => j.stage === 'completed').length,
    high_priority: jobs.filter(j => j.priority === 'high' && j.stage !== 'delivered' && j.outcome !== 'cancelled').length,
  };

  const customerMetrics = [
    { label: 'TOTAL RECEIVED', val: cStats.total_received, color: '#005ea4', bg: '#E6F0FF', icon: 'move_to_inbox' },
    { label: 'TODAY RECEIVED', val: cStats.today_received, color: '#005ea4', bg: '#E6F0FF', icon: 'inbox' },
    { label: 'TESTING', val: cStats.testing, color: '#8b5cf6', bg: '#faf5ff', icon: 'electrical_services' },
    { label: 'UNDER TESTING', val: cStats.under_testing, color: '#8b5cf6', bg: '#faf5ff', icon: 'electric_bolt' },
    { label: "TODAY'S TASK", val: cStats.todays_task, color: '#005ea4', bg: '#E6F0FF', icon: 'assignment' },
    { label: 'APPROVAL', val: cStats.approval, color: '#f59e0b', bg: '#fff7ed', icon: 'pending_actions' },
    { label: 'DELIVERED', val: cStats.delivered, color: '#10b981', bg: '#ecfdf5', icon: 'local_shipping' },
    { label: 'READY FOR DELIVERY', val: cStats.ready, color: '#06b6d4', bg: '#ecfeff', icon: 'schedule_send' },
    { label: 'PENDING', val: cStats.pending, color: '#f59e0b', bg: '#fff7ed', icon: 'schedule' },
    { label: 'NOT REPAIRABLE', val: cStats.not_repairable, color: '#ef4444', bg: '#fef2f2', icon: 'report_problem' },
    { label: 'CANCEL', val: cStats.cancelled, color: '#ec4899', bg: '#fdf2f8', icon: 'cancel' },
    { label: 'COMPLETED', val: cStats.completed, color: '#10b981', bg: '#ecfdf5', icon: 'check_circle' },
    { label: 'HIGH PRIORITY', val: cStats.high_priority, color: '#ef4444', bg: '#fef2f2', icon: 'priority_high' },
  ];

  // Filter jobs by search
  const filteredJobs = jobs.filter((j) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      j.token_no?.toLowerCase().includes(q) ||
      j.product_name?.toLowerCase().includes(q) ||
      j.serial_no?.toLowerCase().includes(q) ||
      j.fault_description?.toLowerCase().includes(q) ||
      j.stage?.toLowerCase().includes(q)
    );
  });

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm">

        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="w-full max-w-6xl lg:max-w-6xl bg-white border-l border-[#E5E5E5] h-full flex flex-col shadow-2xl text-[#0B0B0B] overflow-hidden"
        >
          {/* TOP INTEGRATED CUSTOMER HEADER WITH CLOSE BUTTON */}
          <div className="bg-[#F0F7FF] border-b border-[#D6E6FF] p-6 relative shrink-0">
            {/* Header Actions */}
            <div className="absolute top-4 right-4 flex items-center gap-2">
              {isAdmin && onEdit && (
                <button
                  onClick={() => onEdit(customer)}
                  className="px-3 py-1 bg-white hover:bg-slate-50 text-[#005ea4] border border-[#005ea4]/20 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                  title="Edit Customer Details"
                >
                  <span className="material-symbols-outlined text-sm">edit</span>
                  Edit
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 rounded-full text-[#64748b] hover:text-[#0f172a] hover:bg-white/80 transition-all cursor-pointer"
                title="Close Drawer"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            <div className="flex flex-col md:flex-row items-start md:items-center gap-6 pr-10">
              {/* Avatar Circle */}
              <div className="w-16 h-16 rounded-full border-2 border-white bg-[#2563eb] text-white font-bold flex items-center justify-center text-xl shadow-sm shrink-0 overflow-hidden">
                {customer.name?.charAt(0)?.toUpperCase() || 'C'}
              </div>

              {/* Info Block */}
              <div className="flex-1 space-y-2">
                {/* Name & Active Pill */}
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-[#0f172a]">{customer.name}</h2>
                  {customer.is_active ? (
                    <span className="bg-[#dcfce7] text-[#166534] text-[11px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
                      ACTIVE
                    </span>
                  ) : (
                    <span className="bg-[#f1f5f9] text-[#64748b] text-[11px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
                      INACTIVE
                    </span>
                  )}
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-y-2 gap-x-6 text-xs text-[#64748b]">
                  {/* Col 1: Customer Code & Address */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-base text-[#64748b]">badge</span>
                      <span className="font-semibold text-[#475569]">#{customer.customer_code}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-base text-[#64748b] shrink-0">location_on</span>
                      <span className="truncate">{customer.address || 'No address registered'}</span>
                    </div>
                  </div>

                  {/* Col 2: Joined */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-base text-[#64748b]">calendar_today</span>
                      <span>Joined: {formatDate(customer.registered_on || customer.created_at)}</span>
                    </div>
                  </div>

                  {/* Col 3: Phone Number */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 font-mono font-medium">
                      <span className="material-symbols-outlined text-base text-[#64748b]">call</span>
                      <span>+91 {customer.mobile}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 p-6 overflow-y-auto space-y-6 thin-sb">

            {/* REPAIR OVERVIEW (13 STATUS CARDS MATCHING UPLOADED CARDS DESIGN) */}
            {!hideMetrics && (
              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-[#666666]">
                  REPAIR OVERVIEW
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {customerMetrics.map((m, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] flex flex-col items-start justify-between hover:bg-white hover:shadow-sm transition-all"
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center mb-2 shrink-0"
                        style={{ backgroundColor: m.bg }}
                      >
                        <span className="material-symbols-outlined text-base" style={{ color: m.color }}>
                          {m.icon}
                        </span>
                      </div>
                      <span className="text-[9px] font-bold text-[#64748b] tracking-wider uppercase leading-tight mb-2">
                        {m.label}
                      </span>
                      <span className="text-xl font-black text-[#0f172a] leading-none">
                        {String(m.val || 0).padStart(2, '0')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Service Job History Timeline */}
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div
                  onClick={toggleAllTimelines}
                  className="flex items-center gap-2 cursor-pointer group select-none"
                  title="Click to expand or collapse all job timelines"
                >
                  <h4 className="font-bold text-sm text-[#0B0B0B] group-hover:text-[#005ea4] transition-colors flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-[#005ea4]">build</span>
                    Service Job History ({filteredJobs.length})
                  </h4>
                  {/* <span className="text-[10px] font-bold bg-[#E6F0FF] text-[#005ea4] group-hover:bg-[#005ea4] group-hover:text-white px-2 py-0.5 rounded-full transition-colors flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">
                      {filteredJobs.length > 0 && filteredJobs.every((j) => expandedJobIds[j.id]) ? 'unfold_less' : 'timeline'}
                    </span>
                    {filteredJobs.length > 0 && filteredJobs.every((j) => expandedJobIds[j.id]) ? 'Collapse All' : 'Toggle Timelines'}
                  </span> */}
                </div>

                <div className="relative flex-1 max-w-xs">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#717783] text-base pointer-events-none">
                    search
                  </span>
                  <input
                    type="text"
                    placeholder="Search history..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-[#f4f4f2] border border-[#E5E5E5] rounded-lg text-xs outline-none focus:border-[#005ea4]"
                  />
                </div>
              </div>

              {loading ? (
                <div className="py-8 text-center text-xs text-[#666666]">
                  Loading service history...
                </div>
              ) : filteredJobs.length > 0 ? (
                <div className="space-y-3">
                  {filteredJobs.map((job) => {
                    const stageConfig = STAGES[job.stage] || STAGES.new;
                    const isExpanded = !!expandedJobIds[job.id];
                    const events = jobEventsMap[job.id] || [];
                    const isLoadingEvents = !!loadingJobIds[job.id];

                    return (
                      <div
                        key={job.id}
                        className={`p-4 rounded-xl bg-white border ${isExpanded ? 'border-[#005ea4] ring-2 ring-[#005ea4]/15 shadow-md' : 'border-[#E5E5E5] hover:border-[#005ea4] hover:shadow-sm'} transition-all text-xs overflow-hidden`}
                      >
                        {/* Header: Token No, Stage Pill & Timeline Action Button */}
                        <div className="flex items-center justify-between">
                          <span className="sk-tok font-mono font-bold text-[#005ea4]">#{job.token_no}</span>
                          <div className="flex items-center gap-2">
                            <span className="sk-pill" style={{ background: stageConfig.pbg, color: stageConfig.ptx }}>
                              {stageConfig.label}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleJobTimeline(job.id)}
                              className={`text-[10px] font-bold px-2.5 py-1 rounded-full transition-colors flex items-center gap-1 cursor-pointer ${isExpanded
                                  ? 'bg-[#005ea4] text-white shadow-sm'
                                  : 'bg-[#E6F0FF] text-[#005ea4] hover:bg-[#005ea4] hover:text-white'
                                }`}
                              title={isExpanded ? 'Hide Job Timeline' : 'View Job Timeline'}
                            >
                              <span className="material-symbols-outlined text-[13px]">
                                {isExpanded ? 'expand_less' : 'timeline'}
                              </span>
                              <span>{isExpanded ? 'Close Timeline' : 'Timeline'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Product Title & Fault Description (Clickable to toggle timeline) */}
                        <div
                          onClick={() => toggleJobTimeline(job.id)}
                          className="cursor-pointer space-y-1 my-2 group select-none"
                        >
                          <p className="font-bold text-[#0B0B0B] group-hover:text-[#005ea4] transition-colors">
                            {job.product_name} {job.brand ? `(${job.brand})` : ''}
                          </p>
                          <p className="text-[11px] text-[#666666] line-clamp-2 italic">
                            Fault: "{job.fault_description || 'None specified'}"
                          </p>
                        </div>

                        {/* Footer: Date & Payable Amount */}
                        <div className="flex items-center justify-between text-[11px] pt-2 border-t border-[#E5E5E5] text-[#666666]">
                          <span>In Date: {formatDate(job.in_date || job.created_at)}</span>
                          <span className="font-bold text-[#005ea4] font-mono">
                            {job.payable_amount ? formatCurrency(job.payable_amount) : '-'}
                          </span>
                        </div>

                        {/* INLINE EXPANDABLE TIMELINE */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="mt-3 pt-3 border-t border-slate-200 space-y-3 overflow-hidden"
                            >
                              <div className="flex items-center justify-between bg-[#f8fafc] p-2 rounded-lg border border-[#e2e8f0]">
                                <span className="text-[11px] font-bold text-[#005ea4] uppercase tracking-wider flex items-center gap-1.5">
                                  <span className="material-symbols-outlined text-xs">history</span>
                                  Job Audit History Timeline
                                </span>
                                <span className="text-[10px] font-mono text-[#64748b]">#{job.token_no}</span>
                              </div>

                              {isLoadingEvents ? (
                                <div className="py-4 text-center text-xs text-[#666666] flex items-center justify-center gap-2">
                                  <span className="material-symbols-outlined animate-spin text-sm text-[#005ea4]">sync</span>
                                  Fetching timeline audit events...
                                </div>
                              ) : events.length > 0 ? (
                                <div className="relative ml-4 pl-5 border-l-2 border-[#005ea4]/40 space-y-4 my-2">
                                  {events.map((ev) => {
                                    const fromStageConfig = STAGES[ev.from_stage] || STAGES.new;
                                    const toStageConfig = STAGES[ev.to_stage] || STAGES.delivered;
                                    return (
                                      <div key={ev.id} className="relative text-xs space-y-1">
                                        {/* Timeline Bullet */}
                                        <div className="absolute -left-[8px] top-1 w-3.5 h-3.5 rounded-full bg-[#005ea4] border-2 border-white ring-1 ring-[#005ea4]/30" />

                                        <div className="flex items-center justify-between text-[11px] text-[#64748b]">
                                          <span className="font-bold text-[#0B0B0B] flex items-center gap-1.5">
                                            <span className="w-4 h-4 rounded-full bg-[#005ea4] text-white text-[9px] flex items-center justify-center font-bold">
                                              {ev.user?.name ? ev.user.name.charAt(0) : 'U'}
                                            </span>
                                            <span>{ev.user?.name || 'System'}</span>
                                          </span>
                                          <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded">
                                            {formatDateTime(ev.created_at)}
                                          </span>
                                        </div>

                                        <p className="font-bold text-[#005ea4] text-[11px] uppercase tracking-wider pt-0.5">
                                          Action: {ev.action?.replace('_', ' ')}
                                        </p>

                                        <div className="flex items-center gap-1.5 text-[10px]">
                                          <span className="sk-pill px-1.5 py-0.5 text-[9px]" style={{ background: fromStageConfig.pbg, color: fromStageConfig.ptx }}>
                                            {fromStageConfig.label}
                                          </span>
                                          <span className="material-symbols-outlined text-[10px] text-[#717783]">arrow_forward</span>
                                          <span className="sk-pill px-1.5 py-0.5 text-[9px]" style={{ background: toStageConfig.pbg, color: toStageConfig.ptx }}>
                                            {toStageConfig.label}
                                          </span>
                                        </div>

                                        {ev.note && (
                                          <p className="text-[11px] text-[#334155] italic bg-[#f1f5f9] p-2 rounded-md border border-[#e2e8f0] mt-1">
                                            "{ev.note}"
                                          </p>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#e2e8f0] text-center text-[#64748b] text-[11px] italic">
                                  No audit timeline events logged for this job yet.
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 rounded-xl bg-[#f4f4f2] border border-[#E5E5E5] text-center text-[#666666] text-xs">
                  No service jobs recorded for this customer.
                </div>
              )}
            </div>

          </div>
        </motion.div>

      </div>
    </AnimatePresence>
  );
}
