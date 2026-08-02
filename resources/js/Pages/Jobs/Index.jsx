import React, { useState, useEffect } from 'react';
import { Link, router } from '@inertiajs/react';
import AppLayout from '../../Layouts/AppLayout';
import { motion, AnimatePresence } from 'framer-motion';
import CreateJobModal from '../../Components/Jobs/CreateJobModal';
import JobTransitionModal from '../../Components/Jobs/JobTransitionModal';
import JobTimelineDrawer from '../../Components/Jobs/JobTimelineDrawer';
import { formatCurrency, formatDate, formatDateTime, STAGES, PRIORITIES, OUTCOMES, hasPermission } from '../../utils/formatters';

export default function JobsIndex({ jobs, testers = [], technicians = [], tokenPreview, filters, sanctumToken, auth }) {
  const user = auth?.user;
  const jobList = jobs?.data || [];

  // Stage selection state
  const [activeStageKey, setActiveStageKey] = useState(filters?.stage || 'new');
  const [selectedJob, setSelectedJob] = useState(jobList[0] || null);
  const [search, setSearch] = useState(filters?.search || '');
  const [viewMode, setViewMode] = useState('jcc'); // 'jcc' (Job Control Center) or 'table'

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [transitionJob, setTransitionJob] = useState(null);
  const [transitionAction, setTransitionAction] = useState(null);

  // Keep selected job updated
  useEffect(() => {
    if (jobList.length > 0) {
      if (!selectedJob || !jobList.find((j) => j.id === selectedJob.id)) {
        setSelectedJob(jobList[0]);
      } else {
        const updated = jobList.find((j) => j.id === selectedJob.id);
        if (updated) setSelectedJob(updated);
      }
    } else {
      setSelectedJob(null);
    }
  }, [jobs]);

  const handleStageSelect = (stageKey) => {
    setActiveStageKey(stageKey);
    router.get('/jobs', { stage: stageKey, search }, { preserveState: true });
  };

  const handleSearchChange = (val) => {
    setSearch(val);
    router.get('/jobs', { stage: activeStageKey, search: val }, { preserveState: true });
  };

  // Allowable actions for selected job
  const getJobActions = (job) => {
    if (!job) return [];
    const actions = [];
    switch (job.stage) {
      case 'new':
        if (hasPermission(user, 'jobs.transition')) {
          actions.push({ action: 'assign_tester', label: 'Assign Tester', color: 'sk-btn-primary' });
          actions.push({ action: 'cancel', label: 'Cancel Job', color: 'sk-btn-outline' });
        }
        break;
      case 'testing':
        if (hasPermission(user, 'jobs.transition')) {
          actions.push({ action: 'fault_found', label: 'Fault Found & Budget', color: 'sk-btn-primary' });
          actions.push({ action: 'ok_no_fault', label: 'OK / No Fault', color: 'sk-btn-outline' });
          actions.push({ action: 'not_repairable', label: 'Not Repairable', color: 'sk-btn-outline' });
        }
        break;
      case 'approval':
        if (hasPermission(user, 'jobs.transition')) {
          actions.push({ action: 'approve', label: 'Approve & Assign Tech', color: 'sk-btn-primary' });
          actions.push({ action: 'not_approved', label: 'Not Approved', color: 'sk-btn-outline' });
        }
        break;
      case 'repair':
        if (hasPermission(user, 'jobs.transition')) {
          actions.push({ action: 'work_done', label: 'Mark Work Done', color: 'sk-btn-primary' });
          actions.push({ action: 'mark_pending', label: 'Mark Pending', color: 'sk-btn-outline' });
          actions.push({ action: 'reassign_technician', label: 'Reassign Tech', color: 'sk-btn-outline' });
        }
        break;
      case 'pending':
        if (hasPermission(user, 'jobs.transition')) {
          actions.push({ action: 'move_to_work', label: 'Resume Repair', color: 'sk-btn-primary' });
        }
        break;
      case 'completed':
        if (hasPermission(user, 'jobs.transition')) {
          actions.push({ action: 'collect_payment', label: 'Collect Payment', color: 'sk-btn-primary' });
          actions.push({ action: 'release_unpaid', label: 'Release Unpaid', color: 'sk-btn-outline' });
        }
        break;
      case 'ready':
        if (hasPermission(user, 'jobs.deliver')) {
          actions.push({ action: 'deliver', label: 'Dispatch & Deliver', color: 'sk-btn-primary' });
        }
        break;
      default:
        break;
    }
    return actions;
  };

  const selectedStageConfig = STAGES[activeStageKey] || STAGES.new;

  return (
    <AppLayout title="Job Control Center">
      <div className="flex flex-col h-[calc(100vh-57px)]">

        {/* PIPELINE STAGE CARDS AT TOP */}
        <div className="px-6 py-3 bg-[#f9f9f7] border-b border-[#E5E5E5] overflow-x-auto shrink-0">
          <div className="flex items-center gap-3 min-w-max">
            {Object.keys(STAGES).map((key) => {
              const st = STAGES[key];
              const isSelected = activeStageKey === key;
              return (
                <div
                  key={key}
                  onClick={() => handleStageSelect(key)}
                  className={`sk-stage ${isSelected ? 'on' : ''}`}
                >
                  <div className="p-3">
                    <div className="flex justify-between items-center gap-1 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#666666] truncate">
                        {st.label}
                      </span>
                      <span className="material-symbols-outlined text-base" style={{ color: st.ic }}>
                        {st.icon}
                      </span>
                    </div>
                  </div>
                  <div className="h-1 w-full" style={{ background: st.bar }} />
                </div>
              );
            })}
          </div>
        </div>

        {/* TOOLBAR & CONTROLS */}
        <div className="px-6 py-3 bg-white border-b border-[#E5E5E5] flex justify-between items-center gap-4 shrink-0 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-[#0B0B0B]">{selectedStageConfig.label}</span>
            <span className="text-xs text-[#666666]">({jobList.length} items)</span>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex bg-[#f4f4f2] p-1 rounded-lg border border-[#E5E5E5]">
              <button
                onClick={() => setViewMode('jcc')}
                className={`px-3 py-1 text-xs font-bold rounded-md flex items-center gap-1 transition-all ${
                  viewMode === 'jcc' ? 'bg-white text-[#005ea4] shadow' : 'text-[#666666]'
                }`}
              >
                <span className="material-symbols-outlined text-base">bolt</span>
                Split JCC
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1 text-xs font-bold rounded-md flex items-center gap-1 transition-all ${
                  viewMode === 'table' ? 'bg-white text-[#005ea4] shadow' : 'text-[#666666]'
                }`}
              >
                <span className="material-symbols-outlined text-base">format_list_bulleted</span>
                Table View
              </button>
            </div>

            {/* New Job Button */}
            <button
              onClick={() => setIsCreateOpen(true)}
              className="sk-btn sk-btn-primary"
            >
              <span className="material-symbols-outlined text-base">add</span>
              New Job Intake
            </button>
          </div>
        </div>

        {/* SPLIT PANE VIEW OR TABLE VIEW */}
        {viewMode === 'jcc' ? (
          <div className="flex-1 flex overflow-hidden">

            {/* LEFT PANE: JOB LIST */}
            <div className="w-[360px] shrink-0 border-r border-[#E5E5E5] bg-white flex flex-col">
              
              {/* Search Bar */}
              <div className="p-3 border-b border-[#E5E5E5] bg-[#f4f4f2] relative">
                <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-[#717783] text-base pointer-events-none">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Filter this stage..."
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full pl-10 pr-3 py-1.5 bg-white border border-[#E5E5E5] rounded-lg text-xs outline-none focus:border-[#005ea4]"
                />
              </div>

              {/* Job Item List */}
              <div className="flex-1 overflow-y-auto thin-sb divide-y divide-[#E5E5E5]">
                {jobList.length > 0 ? (
                  jobList.map((job) => {
                    const isSelected = selectedJob?.id === job.id;
                    const priConfig = PRIORITIES[job.priority] || PRIORITIES.medium;
                    return (
                      <div
                        key={job.id}
                        onClick={() => setSelectedJob(job)}
                        className={`p-4 cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[#F0F7FF] border-l-4 border-[#005ea4] pl-3'
                            : 'bg-white hover:bg-[#f4f4f2]'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="sk-tok text-xs">#{job.token_no}</span>
                          <div className="flex items-center gap-1.5">
                            {job.outcome && OUTCOMES[job.outcome] && (
                              <span
                                className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
                                style={{ background: OUTCOMES[job.outcome].pbg, color: OUTCOMES[job.outcome].ptx }}
                              >
                                {OUTCOMES[job.outcome].label}
                              </span>
                            )}
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{ background: `${priConfig.color}15`, color: priConfig.color }}
                            >
                              {priConfig.label}
                            </span>
                          </div>
                        </div>
                        <h4 className="font-bold text-xs text-[#0B0B0B] truncate">
                          {job.product_name}
                        </h4>
                        <div className="flex justify-between text-[11px] text-[#666666] mt-1">
                          <span>{job.customer?.name || 'Walk-in'}</span>
                          <span>{formatDate(job.in_date || job.created_at)}</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center text-[#666666] text-xs">
                    No jobs in this stage.
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT PANE: JOB DETAIL CARD */}
            <div className="flex-1 bg-[#f9f9f7] overflow-y-auto p-6 space-y-6 thin-sb">
              {selectedJob ? (
                <>
                  {/* MAIN JOB CARD */}
                  <div className="sk-card">
                    <div className="p-4 border-b border-[#E5E5E5] flex justify-between items-center flex-wrap gap-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-bold sk-tok">#{selectedJob.token_no}</span>
                        <h3 className="text-lg font-bold text-[#0B0B0B]">
                          {selectedJob.product_name} {selectedJob.brand ? `(${selectedJob.brand})` : ''}
                        </h3>
                      </div>

                      <div className="flex items-center gap-2">
                        {selectedJob.outcome && OUTCOMES[selectedJob.outcome] && (
                          <span
                            className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1 shadow-2xs"
                            style={{ background: OUTCOMES[selectedJob.outcome].pbg, color: OUTCOMES[selectedJob.outcome].ptx }}
                          >
                            <span className="material-symbols-outlined text-sm">{OUTCOMES[selectedJob.outcome].icon}</span>
                            {OUTCOMES[selectedJob.outcome].label}
                          </span>
                        )}
                        <span
                          className="sk-pill"
                          style={{ background: selectedStageConfig.pbg, color: selectedStageConfig.ptx }}
                        >
                          {selectedStageConfig.label}
                        </span>
                      </div>
                    </div>

                    {/* FIELDS GRID */}
                    <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-xs">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#666666]">Customer Name</p>
                        <p className="font-bold text-[#0B0B0B] text-sm mt-0.5">{selectedJob.customer?.name || selectedJob.customer_name || '-'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#666666]">Mobile Phone</p>
                        <p className="font-mono text-[#0B0B0B] mt-0.5">{selectedJob.customer?.mobile || selectedJob.customer_mobile || '-'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#666666]">Customer ID</p>
                        <p className="font-mono text-[#005ea4] mt-0.5">{selectedJob.customer?.customer_code || '-'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#666666]">Receiving Mode</p>
                        <p className="font-bold uppercase text-[#0B0B0B] mt-0.5">{selectedJob.received_from || 'Self'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#666666]">Serial No</p>
                        <p className="font-mono text-[#0B0B0B] mt-0.5">{selectedJob.serial_no || '-'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#666666]">Power Rating</p>
                        <p className="font-semibold text-[#0B0B0B] mt-0.5">{selectedJob.power_rating || '-'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#666666]">Assigned Tester</p>
                        <p className="font-semibold text-[#0B0B0B] mt-0.5">{selectedJob.tester?.name || 'Unassigned'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#666666]">Assigned Technician</p>
                        <p className="font-semibold text-[#0B0B0B] mt-0.5">{selectedJob.technician?.name || 'Unassigned'}</p>
                      </div>
                    </div>

                    {/* FAULT & TEST NOTES BOXES */}
                    <div className="p-4 pt-0 space-y-3">
                      {selectedJob.fault_description && (
                        <div className="p-3 rounded-lg bg-[#f4f4f2] border border-[#E5E5E5] text-xs">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[#666666] mb-1">Fault Description</p>
                          <p className="text-[#0B0B0B] italic">"{selectedJob.fault_description}"</p>
                        </div>
                      )}

                      {selectedJob.tester_findings && (
                        <div className="p-3 rounded-lg bg-[#faf5ff] border border-[#e9d5ff] text-xs">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[#7e22ce] mb-1">Tester Technical Findings</p>
                          <p className="text-[#0B0B0B] italic">"{selectedJob.tester_findings}"</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ACTION BOX */}
                  <div className="p-6 rounded-2xl bg-white border-2 border-[#005ea4] shadow-sm space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-xs font-bold text-[#005ea4] uppercase tracking-wider flex items-center gap-1">
                          <span className="material-symbols-outlined text-base">bolt</span>
                          Workflow Action ({selectedStageConfig.label})
                        </h3>
                        <p className="text-xs text-[#666666] mt-1">{selectedStageConfig.d}</p>
                      </div>
                    </div>

                    <div className="flex gap-3 flex-wrap">
                      {getJobActions(selectedJob).map((act) => (
                        <button
                          key={act.action}
                          onClick={() => {
                            setTransitionJob(selectedJob);
                            setTransitionAction(act.action);
                          }}
                          className={`sk-btn ${act.color}`}
                        >
                          {act.label}
                        </button>
                      ))}
                      {getJobActions(selectedJob).length === 0 && (
                        <p className="text-xs text-[#666666] italic">No actions pending for this stage.</p>
                      )}
                    </div>
                  </div>

                  {/* FINANCIAL SUMMARY */}
                  <div className="p-4 rounded-xl bg-white border border-[#E5E5E5] space-y-2 text-xs">
                    <b className="block text-xs uppercase text-[#666666]">Financial Breakdown</b>
                    <div className="flex justify-between text-[#666666]">
                      <span>Estimated Budget</span>
                      <span className="font-mono">{formatCurrency(selectedJob.estimated_budget)}</span>
                    </div>
                    <div className="flex justify-between text-[#666666]">
                      <span>Approved Amount</span>
                      <span className="font-mono">{formatCurrency(selectedJob.approved_amount)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-[#0B0B0B] pt-2 border-t border-[#E5E5E5]">
                      <span>Total Payable Amount</span>
                      <span className="text-base text-[#005ea4] font-mono">{formatCurrency(selectedJob.payable_amount || 0)}</span>
                    </div>
                    <div className="pt-1">
                      {selectedJob.is_paid ? (
                        <span className="text-xs text-[#1BAF7A] font-bold">✓ Settled & Paid ({selectedJob.payment_mode || 'Cash'})</span>
                      ) : (
                        <span className="text-xs text-[#D03B3B] font-bold">⚠ Unpaid Balance Dues</span>
                      )}
                    </div>
                  </div>

                  {/* TIMELINE LOG */}
                  <div className="p-6 rounded-2xl bg-white border border-[#E5E5E5] space-y-4">
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#666666]">Job Audit History</h3>
                    <ul className="space-y-3 pl-4 border-l-2 border-[#E5E5E5] text-xs">
                      {selectedJob.events && selectedJob.events.length > 0 ? (
                        selectedJob.events.map((ev) => (
                          <li key={ev.id} className="relative pl-4">
                            <b className="text-[#0B0B0B] font-semibold">{ev.action?.replace('_', ' ')}</b>
                            <small className="block text-[#666666] text-[11px] mt-0.5">
                              By {ev.user?.name || 'System'} • {formatDateTime(ev.created_at)}
                            </small>
                            {ev.note && <p className="text-[#666666] italic mt-1">"{ev.note}"</p>}
                          </li>
                        ))
                      ) : (
                        <li className="text-[#666666]">Created on {formatDate(selectedJob.created_at)}</li>
                      )}
                    </ul>
                  </div>
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-[#666666] text-xs">
                  Select a job from the left list to view details.
                </div>
              )}
            </div>

          </div>
        ) : (
          /* TABLE VIEW MODE */
          <div className="flex-1 p-6 overflow-y-auto thin-sb">
            <div className="sk-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#f4f4f2] text-[#666666] uppercase text-[10px] font-bold tracking-wider border-b border-[#E5E5E5]">
                    <tr>
                      <th className="py-3 px-4">Token No</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4">Product Details</th>
                      <th className="py-3 px-4">Priority</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Payable (₹)</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E5E5]">
                    {jobList.map((j) => {
                      const st = STAGES[j.stage] || STAGES.new;
                      return (
                        <tr key={j.id} className="hover:bg-[#f9f9f7]">
                          <td className="py-3 px-4"><span className="sk-tok">#{j.token_no}</span></td>
                          <td className="py-3 px-4 font-bold text-[#0B0B0B]">{j.customer?.name}</td>
                          <td className="py-3 px-4">{j.product_name}</td>
                          <td className="py-3 px-4 font-semibold uppercase">{j.priority}</td>
                          <td className="py-3 px-4">
                            <span className="sk-pill" style={{ background: st.pbg, color: st.ptx }}>{st.label}</span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold">{formatCurrency(j.payable_amount || 0)}</td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => {
                                setSelectedJob(j);
                                setViewMode('jcc');
                              }}
                              className="sk-btn sk-btn-outline"
                            >
                              Open JCC
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* MODALS */}
        <CreateJobModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onSuccess={() => router.reload()}
          tokenPreview={tokenPreview}
          sanctumToken={sanctumToken}
        />

        <JobTransitionModal
          job={transitionJob}
          action={transitionAction}
          isOpen={!!transitionJob && !!transitionAction}
          onClose={() => {
            setTransitionJob(null);
            setTransitionAction(null);
          }}
          onSuccess={() => router.reload()}
          testers={testers}
          technicians={technicians}
          sanctumToken={sanctumToken}
        />

      </div>
    </AppLayout>
  );
}
