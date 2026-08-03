import React, { useState, useEffect } from 'react';
import { Link, router } from '@inertiajs/react';
import AppLayout from '../../Layouts/AppLayout';
import CreateJobModal from '../../Components/Jobs/CreateJobModal';
import EditJobModal from '../../Components/Jobs/EditJobModal';
import ConfirmActionModal from '../../Components/Common/ConfirmActionModal';
import { generateWhatsAppMessage, openWhatsApp } from '../../utils/WhatsAppHelper';
import { notifySuccess, notifyError } from '../../utils/toast';
import axios from 'axios';
import { formatCurrency, formatDate, formatDateTime, STAGES, PRIORITIES, OUTCOMES, hasPermission } from '../../utils/formatters';

import TableLoadingOverlay from '../../Components/Common/TableLoadingOverlay';
import SearchableCustomerSelect from '../../Components/Common/SearchableCustomerSelect';
import TestReportModal from '../../Components/Jobs/TestReportModal';

export default function ControlCenter({ jobs = [], customers = [], stageCounts = {}, testers = [], technicians = [], tokenPreview, filters, sanctumToken, auth }) {
  const user = auth?.user;
  const [activeStageKey, setActiveStageKey] = useState(filters?.stage || 'new');
  const [selectedCustomerId, setSelectedCustomerId] = useState(filters?.customer_id || '');
  const [selectedJob, setSelectedJob] = useState(jobs[0] || null);
  const [search, setSearch] = useState(filters?.search || '');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editJob, setEditJob] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    const unbindStart = router.on('start', () => setIsNavigating(true));
    const unbindFinish = router.on('finish', () => setIsNavigating(false));
    return () => {
      unbindStart();
      unbindFinish();
    };
  }, []);

  // Print Test Report Modal State
  const [printReportJob, setPrintReportJob] = useState(null);

  // Workflow Action Form State
  const [actionInput, setActionInput] = useState({});
  const [submittingAction, setSubmittingAction] = useState(false);
  const [confirmModalData, setConfirmModalData] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    if (jobs.length > 0) {
      const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const targetJobId = urlParams?.get('job_id') || filters?.job_id;

      if (targetJobId) {
        const matched = jobs.find((j) => String(j.id) === String(targetJobId));
        if (matched) {
          setSelectedJob(matched);
          return;
        }
      }

      if (!selectedJob || !jobs.find((j) => j.id === selectedJob.id)) {
        setSelectedJob(jobs[0]);
      } else {
        const updated = jobs.find((j) => j.id === selectedJob.id);
        if (updated) setSelectedJob(updated);
      }
    } else {
      setSelectedJob(null);
    }
  }, [jobs]);

  // Sort dropdowns so Admin / System Admin appears at the last position
  const sortedTesters = React.useMemo(() => {
    return [...testers].sort((a, b) => {
      const aIsAdmin = a.name.toLowerCase().includes('admin');
      const bIsAdmin = b.name.toLowerCase().includes('admin');
      if (aIsAdmin && !bIsAdmin) return 1;
      if (!aIsAdmin && bIsAdmin) return -1;
      return a.name.localeCompare(b.name);
    });
  }, [testers]);

  const sortedTechnicians = React.useMemo(() => {
    return [...technicians].sort((a, b) => {
      const aIsAdmin = a.name.toLowerCase().includes('admin');
      const bIsAdmin = b.name.toLowerCase().includes('admin');
      if (aIsAdmin && !bIsAdmin) return 1;
      if (!aIsAdmin && bIsAdmin) return -1;
      return a.name.localeCompare(b.name);
    });
  }, [technicians]);

  // Reset action inputs when selected job or stage changes
  useEffect(() => {
    setFormErrors({});
    if (selectedJob) {
      setActionInput({
        tester_id: (sortedTesters.find(t => !t.name.toLowerCase().includes('admin')) || sortedTesters[0])?.id || '',
        technician_id: (sortedTechnicians.find(t => !t.name.toLowerCase().includes('admin')) || sortedTechnicians[0])?.id || '',
        estimated_budget: selectedJob.estimated_budget || '',
        approved_amount: selectedJob.approved_amount || selectedJob.estimated_budget || '',
        final_amount: selectedJob.final_amount || selectedJob.approved_amount || '',
        paid_amount: selectedJob.payable_amount !== null && selectedJob.payable_amount !== undefined && selectedJob.payable_amount !== '' ? selectedJob.payable_amount : (selectedJob.final_amount || ''),
        payment_mode: 'cash',
        delivery_mode: 'self',
        delivery_receiver: selectedJob.customer?.name || '',
        delivery_ref: '',
        out_date: new Date().toISOString().split('T')[0],
        tester_findings: selectedJob.tester_findings || '',
        pend_reason: '',
      });
    }
  }, [selectedJob]);

  const handleStageSelect = (stageKey) => {
    setActiveStageKey(stageKey);
    setActionInput({});
    setFormErrors({});
    router.get('/jcc', { stage: stageKey, search, customer_id: selectedCustomerId }, { preserveState: true, preserveScroll: true });
  };

  const handleCustomerSelect = (custId) => {
    setSelectedCustomerId(custId);
    setActionInput({});
    setFormErrors({});
    router.get('/jcc', { stage: activeStageKey, search, customer_id: custId }, { preserveState: true, preserveScroll: true });
  };

  const handleSearchChange = (val) => {
    setSearch(val);
    router.get('/jcc', { stage: activeStageKey, search: val, customer_id: selectedCustomerId }, { preserveState: true });
  };

  const requestTransition = (actionName, payload = {}, title = '') => {
    if (!selectedJob) return;
    setFormErrors({});

    // Client-side field validations before confirmation modal
    if (actionName === 'assign_tester' && !payload.tester_id) {
      setFormErrors({ tester_id: 'Please select a tester from the dropdown.' });
      return;
    }
    if (actionName === 'cancel') {
      const reason = payload.cancel_reason || payload.pend_reason || payload.remarks;
      if (!reason?.trim()) {
        if (selectedJob?.stage === 'new') {
          setFormErrors({ cancel_reason: 'Please enter a cancellation reason / remark before cancelling.' });
        } else if (selectedJob?.stage === 'pending') {
          setFormErrors({ remarks: 'Please enter a cancellation reason / remark before cancelling.' });
        } else {
          setFormErrors({ pend_reason: 'Please enter a cancellation reason / remark before cancelling.' });
        }
        return;
      }
    }
    if (actionName === 'fault_found' && (!payload.estimated_budget || parseFloat(payload.estimated_budget) <= 0)) {
      setFormErrors({ estimated_budget: 'Please enter Estimated Repair Budget (₹) before submitting.' });
      return;
    }
    if (actionName === 'approve' && !payload.technician_id) {
      setFormErrors({ technician_id: 'Please select a technician to assign.' });
      return;
    }
    if (actionName === 'mark_pending' && !payload.pend_reason?.trim()) {
      setFormErrors({ pend_reason: 'Please enter a pending reason / remark before pausing the job.' });
      return;
    }
    if (actionName === 'deliver' && !payload.delivery_receiver?.trim()) {
      setFormErrors({ delivery_receiver: 'Please enter Receiver Name before confirming delivery.' });
      return;
    }

    setConfirmModalData({
      actionName,
      payload,
      title: title || `Confirm Action: ${actionName.replace('_', ' ').toUpperCase()}`,
    });
  };

  const executeTransition = async (actionName, payload = {}, withWhatsApp = false) => {
    if (!selectedJob) return;
    setSubmittingAction(true);
    setConfirmModalData(null);
    try {
      const headers = sanctumToken ? { Authorization: `Bearer ${sanctumToken}` } : {};
      let res;
      const fullPayload = { ...payload, send_whatsapp: withWhatsApp };
      if (actionName === 'deliver') {
        res = await axios.post(`/api/v1/jobs/${selectedJob.id}/deliver`, fullPayload, { headers });
      } else {
        res = await axios.post(`/api/v1/jobs/${selectedJob.id}/transition`, { action: actionName, ...fullPayload }, { headers });
      }
      setSubmittingAction(false);

      if (withWhatsApp && selectedJob.customer?.mobile) {
        const msg = generateWhatsAppMessage({
          type: actionName,
          customerName: selectedJob.customer?.name,
          mobile: selectedJob.customer?.mobile,
          tokenNo: selectedJob.token_no,
          extra: {
            productName: selectedJob.product_name,
            estimatedBudget: payload.estimated_budget,
            finalAmount: payload.final_amount,
            fee: selectedJob.inspection_fee || 250,
          },
        });
        openWhatsApp({ mobile: selectedJob.customer?.mobile, message: msg });
      }

      notifySuccess(res.data?.message || `Job #${selectedJob.token_no} updated successfully!`);

      const updatedJob = res.data?.data || selectedJob;
      const nextStage = updatedJob?.stage || activeStageKey;

      if (actionName === 'assign_tester') {
        setPrintReportJob(updatedJob);
      }

      if (nextStage) {
        setActiveStageKey(nextStage);
        router.get(
          '/jcc',
          { stage: nextStage, search, customer_id: selectedCustomerId, job_id: updatedJob?.id },
          { preserveState: false, preserveScroll: true }
        );
      } else {
        router.reload();
      }
    } catch (err) {
      setSubmittingAction(false);
      const errMsg = err.response?.data?.message || 'Failed to execute transition action.';
      notifyError(errMsg);
    }
  };

  const selectedStageConfig = STAGES[activeStageKey] || STAGES.new;

  // Filter jobs by current stage
  const currentStageJobs = jobs.filter((j) => !activeStageKey || j.stage === activeStageKey);

  return (
    <AppLayout title="Job Control Center" description="Interactive workflow stage manager to assign technicians, approve repair budgets, and update job progress.">
      <div className="flex flex-col h-[calc(100vh-57px)] w-full overflow-hidden bg-[#f9f9f7]">

        {/* TOP PIPELINE STATUS CONTROL - SCROLLABLE ON MOBILE */}
        <div className="pipeline border-b border-[#E5E5E5] bg-[#f9f9f7] pt-3 pb-4 px-4 shrink-0 w-full overflow-x-auto thin-sb">
          <div className="pipe-inner flex items-center justify-between gap-1.5 min-w-[700px] lg:min-w-0">
            {Object.keys(STAGES).map((key, idx) => {
              const st = STAGES[key];
              const isSelected = activeStageKey === key;
              const stageJobsCount = stageCounts[key] !== undefined ? stageCounts[key] : jobs.filter((j) => j.stage === key).length;

              return (
                <React.Fragment key={key}>
                  <div
                    onClick={() => handleStageSelect(key)}
                    style={
                      isSelected
                        ? {
                          background: `linear-gradient(135deg, ${st.ic || '#005ea4'} 0%, ${st.bar || '#004278'} 100%)`,
                          boxShadow: `0 8px 20px -4px ${st.ic}50, 0 0 0 2px ${st.ic}60`,
                        }
                        : {}
                    }
                    className={`stage cursor-pointer rounded-xl overflow-hidden border transition-all duration-200 flex-1 min-w-0 relative ${isSelected
                      ? 'scale-[1.02] border-transparent text-white z-10 font-bold'
                      : 'bg-white border-[#E5E5E5] hover:bg-[#f4f4f2] hover:border-[#005ea4]/40 text-[#0B0B0B]'
                      }`}
                  >
                    <div className="p-2 sm:p-2.5">
                      <div className="flex justify-between items-start gap-1 mb-1 min-h-[22px]">
                        <span
                          className={`text-[9px] sm:text-[10px] leading-tight uppercase tracking-wider block ${isSelected ? 'text-white font-bold' : 'text-[#555555] font-semibold'
                            }`}
                        >
                          {st.label}
                        </span>
                        {!isSelected ? (
                          <span className="material-symbols-outlined text-xs shrink-0 opacity-70" style={{ color: st.ic }}>
                            {st.icon}
                          </span>
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse shrink-0 mt-0.5" title="Active Stage" />
                        )}
                      </div>

                      <div className="flex items-baseline justify-between pt-0.5">
                        <div className={`text-lg sm:text-2xl font-black ${isSelected ? 'text-white tracking-tight' : 'text-[#0B0B0B]'}`}>
                          {stageJobsCount}
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-md bg-white/20 backdrop-blur-md flex items-center justify-center text-white shrink-0">
                            <span className="material-symbols-outlined text-[10px]">{st.icon}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="h-1 w-full" style={{ background: isSelected ? '#ffffff' : st.bar }} />
                  </div>

                  {idx < Object.keys(STAGES).length - 1 && (
                    <span className="material-symbols-outlined text-[#c0c7d3] shrink-0 text-xs hidden xl:inline-block">
                      chevron_right
                    </span>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* SPLIT 2-PANE AREA (NO PAGE HORIZONTAL SCROLL) */}
        <div className="flex-1 flex min-h-0 w-full overflow-hidden relative">
          <TableLoadingOverlay loading={isNavigating || submittingAction} text={submittingAction ? "Processing job transition..." : "Updating control center workflow..."} />

          {/* LEFT PANE: JOB LIST */}
          <div className="w-[380px] shrink-0 border-r border-[#E5E5E5] bg-white flex flex-col min-h-0">
            <div
              className="p-3.5 border-b border-[#E5E5E5] space-y-2 shrink-0 transition-colors shadow-2xs"
              style={{ background: selectedStageConfig.pbg || '#f9f9f7', borderLeft: `4px solid ${selectedStageConfig.ic || '#005ea4'}` }}
            >
              <div className="flex justify-between items-center">
                <span
                  className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
                  style={{ color: selectedStageConfig.ptx || '#0B0B0B' }}
                >
                  <span className="material-symbols-outlined text-base" style={{ color: selectedStageConfig.ic || '#005ea4' }}>
                    {selectedStageConfig.icon}
                  </span>
                  {selectedStageConfig.label} ({currentStageJobs.length})
                </span>
                <span
                  className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-white/80 border"
                  style={{ color: selectedStageConfig.ptx || '#005ea4', borderColor: (selectedStageConfig.ic || '#005ea4') + '40' }}
                >
                  Active Stage
                </span>
              </div>

              {/* Customer Filter Dropdown */}
              <div>
                <SearchableCustomerSelect
                  customers={customers}
                  selectedCustomerId={selectedCustomerId}
                  onSelectCustomer={handleCustomerSelect}
                  placeholder="All Customers (All Works)"
                />
              </div>
            </div>

            {/* Job List Items */}
            <div className="flex-1 overflow-y-auto thin-sb divide-y divide-[#E5E5E5]">
              {currentStageJobs.length > 0 ? (
                currentStageJobs.map((job) => {
                  const isSelected = selectedJob?.id === job.id;
                  const priConfig = PRIORITIES[job.priority] || PRIORITIES.medium;

                  return (
                    <div
                      key={job.id}
                      onClick={() => setSelectedJob(job)}
                      className={`p-4 cursor-pointer transition-colors ${isSelected
                        ? 'bg-[#F0F7FF] border-l-[3px] border-[#005ea4] pl-3.5'
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
                          <span className="text-[11px] font-bold flex items-center gap-1" style={{ color: priConfig.color }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: priConfig.color }} />
                            {job.priority}
                          </span>
                        </div>
                      </div>
                      <h4 className="font-bold text-xs text-[#0B0B0B] truncate mt-0.5">
                        {job.product_name}
                      </h4>
                      <div className="flex justify-between items-center text-[11px] text-[#666666] mt-2 gap-2">
                        <span className="truncate max-w-[170px]" title={job.customer?.name}>
                          {job.customer?.name || 'Walk-in Customer'}
                          {job.customer?.customer_code ? ` (${job.customer.customer_code})` : ''}
                        </span>
                        <span className="shrink-0">{formatDate(job.in_date || job.created_at)}</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-[#666666] text-xs">
                  No jobs currently in this stage.
                </div>
              )}
            </div>
          </div>

          {/* RIGHT WORKSPACE DETAILS */}
          <div className="flex-1 bg-white border border-[#E5E5E5] rounded-2xl flex flex-col min-w-0 shadow-2xs overflow-hidden">
            {selectedJob ? (
              <div className="flex-1 overflow-y-auto thin-sb flex flex-col">

                {/* Workspace Header */}
                <div className="p-4 border-b border-[#E5E5E5] bg-[#f9f9f7] space-y-3">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-xl font-black font-mono text-[#005ea4] tracking-tight shrink-0">
                        #{selectedJob.token_no}
                      </span>
                      <h3 className=" font-normal text-[#0B0B0B] flex items-center gap-2 flex-wrap leading-none">
                        {selectedJob.brand && (
                          <span className="text-base">
                            {selectedJob.brand}
                          </span>
                        )}
                        {selectedJob.brand && <span className="text-gray-400 font-normal">-</span>}
                        <span>{selectedJob.product_name}</span>
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      {user?.roles?.includes('admin') && (
                        <button
                          onClick={() => setEditJob(selectedJob)}
                          className="sk-btn sk-btn-outline cursor-pointer"
                          title="Edit Product & Job Details"
                        >
                          <span className="material-symbols-outlined text-base">edit</span>
                          Edit Job
                        </button>
                      )}
                      {selectedJob.outcome && OUTCOMES[selectedJob.outcome] && (
                        <span
                          className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1 shadow-2xs"
                          style={{ background: OUTCOMES[selectedJob.outcome].pbg, color: OUTCOMES[selectedJob.outcome].ptx }}
                        >
                          <span className="material-symbols-outlined text-sm">{OUTCOMES[selectedJob.outcome].icon}</span>
                          {OUTCOMES[selectedJob.outcome].label}
                        </span>
                      )}
                      <span className="sk-pill" style={{ background: selectedStageConfig.pbg, color: selectedStageConfig.ptx }}>
                        {selectedStageConfig.label}
                      </span>
                    </div>
                  </div>

                  {/* Fields Grid */}
                  <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 text-xs border-b border-[#E5E5E5]">
                    {/* Customer Row */}
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#666666]">CUSTOMER</p>
                      <p className="font-bold text-[#0B0B0B] mt-0.5">{selectedJob.customer?.name || selectedJob.customer_name || '-'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#666666]">CUSTOMER ID</p>
                      <p className="font-mono font-bold mt-0.5">{selectedJob.customer?.customer_code || '-'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#666666]">MOBILE</p>
                      <p className="font-mono text-[#0B0B0B] mt-0.5">{selectedJob.customer?.mobile || selectedJob.customer_mobile || '-'}</p>
                    </div>

                    {/* Horizontal Line Divider */}
                    <div className="col-span-full border-t border-[#E5E5E5] my-1" />

                    {/* Product Row */}
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#666666]">PRODUCT NAME</p>
                      <p className="font-bold text-[#0B0B0B] mt-0.5">{selectedJob.product_name || '-'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#666666]">BRAND / MAKE</p>
                      <p className="font-bold mt-0.5">{selectedJob.brand || '-'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#666666]">SERIAL NUMBER</p>
                      <p className="font-mono text-[#0B0B0B] mt-0.5">{selectedJob.serial_no || '-'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#666666]">POWER RATING</p>
                      <p className="font-semibold text-[#0B0B0B] mt-0.5">{selectedJob.power_rating || '-'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#666666]">RECEIVED VIA</p>
                      <p className="font-bold uppercase text-[#0B0B0B] mt-0.5">{selectedJob.received_from || 'Self'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#666666]">IN DATE</p>
                      <p className="font-semibold text-[#0B0B0B] mt-0.5">{formatDate(selectedJob.in_date || selectedJob.created_at)}</p>
                    </div>
                    {selectedJob.stage === 'approval' && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#666666]">ESTIMATED BUDGET</p>
                        <p className="font-bold text-[#005ea4] font-mono mt-0.5">
                          {formatCurrency(selectedJob.estimated_budget || 0)}
                        </p>
                      </div>
                    )}
                    {['repair', 'pending'].includes(selectedJob.stage) && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#666666]">APPROVED BUDGET</p>
                        <p className="font-bold text-[#005ea4] font-mono mt-0.5">
                          {formatCurrency(selectedJob.approved_amount || selectedJob.estimated_budget || 0)}
                        </p>
                      </div>
                    )}
                    {['completed', 'ready', 'delivered'].includes(selectedJob.stage) && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#666666]">PAYMENT STATUS</p>
                        {Number(selectedJob.payable_amount ?? selectedJob.final_amount ?? 0) === 0 ? (
                          <span className="font-bold text-[#64748b] mt-0.5 flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">do_not_disturb_on</span>
                            NO AMOUNT DUE (₹0)
                          </span>
                        ) : selectedJob.is_paid ? (
                          <span className="font-bold text-[#10b981] mt-0.5 flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">verified</span>
                            {formatCurrency(selectedJob.payable_amount || 0)} (PAID)
                          </span>
                        ) : (
                          <span className="font-bold text-[#d97706] mt-0.5 flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">warning</span>
                            UNPAID ({formatCurrency(selectedJob.payable_amount ?? selectedJob.final_amount ?? 0)})
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Customer Reported Fault Box */}
                  {selectedJob.fault_description && (
                    <div className="p-4 pt-0">
                      <div className="p-3.5 rounded-lg bg-[#f4f4f2] border border-[#E5E5E5] text-xs">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#666666] mb-1 flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">warning</span>
                          CUSTOMER REPORTED FAULT
                        </p>
                        <p className="text-[#0B0B0B] italic">"{selectedJob.fault_description}"</p>
                      </div>
                    </div>
                  )}

                  {selectedJob.tester_findings && (
                    <div className="p-4 pt-0">
                      <div className="p-3.5 rounded-lg bg-[#faf5ff] border border-[#e9d5ff] text-xs">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#7e22ce] mb-1 flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">biotech</span>
                          TESTER TECHNICAL FINDINGS
                        </p>
                        <p className="text-[#0B0B0B] italic">"{selectedJob.tester_findings}"</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* CARD 2: ACTION CARD */}
                <div className="p-6 rounded-2xl bg-white border-2 border-[#005ea4] shadow-sm space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xs font-bold text-[#005ea4] uppercase tracking-wider flex items-center gap-1">
                        <span className="material-symbols-outlined text-base">bolt</span>
                        ADMIN ACTION REQUIRED
                      </h3>
                      <p className="text-xs text-[#666666] mt-1">{selectedStageConfig.d}</p>
                    </div>
                    <span className="text-[10px] font-bold bg-[#F0F7FF] text-[#005ea4] px-2.5 py-1 rounded-full uppercase tracking-wider">
                      PRIORITY ACTION
                    </span>
                  </div>

                  {/* ACTION DYNAMIC CONTROLS */}
                  {selectedJob.stage === 'new' && (
                    <div className="space-y-3 pt-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-[#0B0B0B] mb-1">Assign to Tester *</label>
                          <select
                            value={actionInput.tester_id}
                            onChange={(e) => {
                              setActionInput({ ...actionInput, tester_id: e.target.value });
                              if (formErrors.tester_id) setFormErrors({ ...formErrors, tester_id: null });
                            }}
                            className={`w-full px-3 py-2 bg-white border ${formErrors.tester_id ? 'border-rose-500 bg-rose-50' : 'border-[#E5E5E5]'} rounded-lg text-xs outline-none focus:border-[#005ea4]`}
                          >
                            <option value="">Select a tester</option>
                            {sortedTesters.map((t) => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                          {formErrors.tester_id && (
                            <p className="text-xs text-rose-600 font-semibold mt-1">{formErrors.tester_id}</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-[#0B0B0B] mb-1">Cancellation / Action Remarks *</label>
                          <input
                            type="text"
                            placeholder="Reason required to cancel service job..."
                            value={actionInput.cancel_reason || ''}
                            onChange={(e) => {
                              setActionInput({ ...actionInput, cancel_reason: e.target.value });
                              if (formErrors.cancel_reason) setFormErrors({ ...formErrors, cancel_reason: null });
                            }}
                            className={`w-full px-3 py-2 bg-white border ${formErrors.cancel_reason ? 'border-rose-500 bg-rose-50' : 'border-[#E5E5E5]'} rounded-lg text-xs outline-none focus:border-[#005ea4]`}
                          />
                          {formErrors.cancel_reason && (
                            <p className="text-xs text-rose-600 font-semibold mt-1 flex items-center gap-1">
                              <span className="material-symbols-outlined text-sm">error</span>
                              {formErrors.cancel_reason}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 flex-wrap pt-2">
                        <button
                          disabled={submittingAction}
                          onClick={() => requestTransition('assign_tester', { tester_id: actionInput.tester_id }, 'Assign for Inspection & Testing')}
                          className="sk-btn sk-btn-primary cursor-pointer disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-base">bolt</span>
                          Assign for Testing
                        </button>
                        <button
                          type="button"
                          onClick={() => setPrintReportJob(selectedJob)}
                          className="sk-btn bg-slate-100 text-slate-800 border border-slate-300 hover:bg-slate-200 cursor-pointer flex items-center gap-1 font-semibold"
                          title="Print or view official Test Report Sheet"
                        >
                          <span className="material-symbols-outlined text-base">print</span>
                          Print Test Sheet
                        </button>
                        <button
                          disabled={submittingAction}
                          onClick={() => requestTransition('cancel', { cancel_reason: actionInput.cancel_reason }, 'Cancel Service Job')}
                          className="sk-btn bg-[#D03B3B] text-white hover:bg-rose-700 cursor-pointer"
                        >
                          Cancel Job
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedJob.stage === 'testing' && (
                    <div className="space-y-3 pt-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-[#0B0B0B] mb-1">Estimated Repair Budget (₹) *</label>
                          <input
                            type="number"
                            placeholder="e.g. 3200"
                            value={actionInput.estimated_budget}
                            onChange={(e) => {
                              setActionInput({ ...actionInput, estimated_budget: e.target.value });
                              if (formErrors.estimated_budget) setFormErrors({ ...formErrors, estimated_budget: null });
                            }}
                            className={`w-full px-3 py-2 bg-white border ${formErrors.estimated_budget ? 'border-rose-500 bg-rose-50' : 'border-[#E5E5E5]'} rounded-lg text-xs font-mono outline-none`}
                          />
                          {formErrors.estimated_budget && (
                            <p className="text-xs text-rose-600 font-semibold mt-1.5 flex items-center gap-1">
                              <span className="material-symbols-outlined text-sm">error</span>
                              {formErrors.estimated_budget}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-[#0B0B0B] mb-1">Technical Findings Note/Remarks</label>
                          <input
                            type="text"
                            placeholder="Describe fault found..."
                            value={actionInput.tester_findings}
                            onChange={(e) => setActionInput({ ...actionInput, tester_findings: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-xs outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap pt-2">
                        <button
                          disabled={submittingAction}
                          onClick={() => requestTransition('fault_found', { estimated_budget: actionInput.estimated_budget, tester_findings: actionInput.tester_findings }, 'Submit Fault Findings & Budget')}
                          className="sk-btn sk-btn-primary cursor-pointer"
                        >
                          Confirm Fault & Submit Budget
                        </button>
                        <button
                          type="button"
                          onClick={() => setPrintReportJob(selectedJob)}
                          className="sk-btn bg-slate-100 text-slate-800 border border-slate-300 hover:bg-slate-200 cursor-pointer flex items-center gap-1 font-semibold"
                          title="Print or view official Test Report Sheet"
                        >
                          <span className="material-symbols-outlined text-base">print</span>
                          Print Test Sheet
                        </button>
                        <button
                          disabled={submittingAction}
                          onClick={() => requestTransition('ok_no_fault', { tester_findings: actionInput.tester_findings }, 'Mark OK / No Fault Found')}
                          className="sk-btn sk-btn-outline cursor-pointer"
                        >
                          Mark OK / No Fault
                        </button>
                        <button
                          disabled={submittingAction}
                          onClick={() => requestTransition('not_repairable', { tester_findings: actionInput.tester_findings }, 'Mark Not Repairable')}
                          className="sk-btn bg-[#D03B3B] text-white cursor-pointer"
                        >
                          Not Repairable
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedJob.stage === 'approval' && (
                    <div className="space-y-3 pt-2">
                      {/* RECORDED ESTIMATED REPAIR BUDGET BANNER */}
                      <div className="p-3.5 rounded-xl bg-[#f0f9ff] border border-[#bae6fd] flex items-center justify-between text-xs">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[#0369a1] flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">price_change</span>
                            Recorded Estimated Repair Budget
                          </p>
                          <p className="text-[#0c4a6e] font-medium text-xs mt-0.5">
                            Budget submitted during testing. Confirm or update customer approved amount below.
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-xl font-bold font-mono text-[#0284c7]">
                            {formatCurrency(selectedJob.estimated_budget || 0)}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-[#0B0B0B] mb-1">Customer Approved Amount (₹)</label>
                          <input
                            type="number"
                            value={actionInput.approved_amount}
                            onChange={(e) => setActionInput({ ...actionInput, approved_amount: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-xs font-mono outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-[#0B0B0B] mb-1">Assign Technician *</label>
                          <select
                            value={actionInput.technician_id}
                            onChange={(e) => {
                              setActionInput({ ...actionInput, technician_id: e.target.value });
                              if (formErrors.technician_id) setFormErrors({ ...formErrors, technician_id: null });
                            }}
                            className={`w-full px-3 py-2 bg-white border ${formErrors.technician_id ? 'border-rose-500 bg-rose-50' : 'border-[#E5E5E5]'} rounded-lg text-xs outline-none`}
                          >
                            <option value="">Select Technician</option>
                            {sortedTechnicians.map((tech) => (
                              <option key={tech.id} value={tech.id}>{tech.name}</option>
                            ))}
                          </select>
                          {formErrors.technician_id && (
                            <p className="text-xs text-rose-600 font-semibold mt-1 flex items-center gap-1">
                              <span className="material-symbols-outlined text-sm">error</span>
                              {formErrors.technician_id}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap pt-2">
                        <button
                          disabled={submittingAction}
                          onClick={() => requestTransition('approve', { approved_amount: actionInput.approved_amount, technician_id: actionInput.technician_id }, 'Approve Budget & Start Repair')}
                          className="sk-btn sk-btn-primary cursor-pointer"
                        >
                          Approve & Start Repair
                        </button>
                        <button
                          disabled={submittingAction}
                          onClick={() => requestTransition('not_approved', {}, 'Mark Budget Not Approved')}
                          className="sk-btn bg-[#FFA500] text-white cursor-pointer"
                        >
                          Not Approved
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedJob.stage === 'repair' && (
                    <div className="space-y-3 pt-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-[#0B0B0B] mb-1">Final Bill Amount (₹)</label>
                          <input
                            type="number"
                            value={actionInput.final_amount}
                            onChange={(e) => setActionInput({ ...actionInput, final_amount: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-xs font-mono outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-[#0B0B0B] mb-1">Remarks / Reason</label>
                          <input
                            type="text"
                            placeholder="Completion notes or pending reason (e.g. Replaced IC / Waiting for part)"
                            value={actionInput.pend_reason}
                            onChange={(e) => {
                              setActionInput({ ...actionInput, pend_reason: e.target.value });
                              if (formErrors.pend_reason) setFormErrors({ ...formErrors, pend_reason: null });
                            }}
                            className={`w-full px-3 py-2 bg-white border ${formErrors.pend_reason ? 'border-rose-500 bg-rose-50' : 'border-[#E5E5E5]'} rounded-lg text-xs outline-none`}
                          />
                          {formErrors.pend_reason && (
                            <p className="text-xs text-rose-600 font-semibold mt-1.5 flex items-center gap-1">
                              <span className="material-symbols-outlined text-sm">error</span>
                              {formErrors.pend_reason}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap pt-2">
                        <button
                          disabled={submittingAction}
                          onClick={() => requestTransition('work_done', { final_amount: actionInput.final_amount, pend_reason: actionInput.pend_reason }, 'Mark Repair Completed')}
                          className="sk-btn sk-btn-primary cursor-pointer"
                        >
                          Mark Repair Completed
                        </button>
                        <button
                          disabled={submittingAction}
                          onClick={() => requestTransition('mark_pending', { pend_reason: actionInput.pend_reason }, 'Pause Job / Mark Pending')}
                          className="sk-btn bg-[#ec4899] text-white cursor-pointer"
                        >
                          Mark Pending / Pause
                        </button>
                        <button
                          disabled={submittingAction}
                          onClick={() => requestTransition('cancel', { cancel_reason: actionInput.pend_reason }, 'Cancel Service Job')}
                          className="sk-btn bg-[#D03B3B] text-white hover:bg-rose-700 cursor-pointer"
                        >
                          Cancel Job
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedJob.stage === 'pending' && (
                    <div className="space-y-3 pt-2">
                      {selectedJob.pend_reason && (
                        <div className="p-3.5 rounded-xl bg-[#fff7ed] border border-[#fed7aa] text-xs">
                          <p className="font-bold text-[#c2410c] uppercase tracking-wider text-[10px]">PAUSE REASON / REMARKS</p>
                          <p className="text-[#9a3412] mt-0.5 font-medium">{selectedJob.pend_reason}</p>
                        </div>
                      )}
                      <div>
                        <label className="block text-xs font-bold text-[#0B0B0B] mb-1">
                          Action Remarks <span className="text-[#64748b] font-normal">(Optional to Resume, Required to Cancel)</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Spare part received, resuming repair... OR Cancelled by customer due to delay"
                          value={actionInput.remarks || ''}
                          onChange={(e) => {
                            setActionInput({ ...actionInput, remarks: e.target.value });
                            if (formErrors.remarks) setFormErrors({ ...formErrors, remarks: null });
                          }}
                          className={`w-full px-3 py-2 bg-white border ${formErrors.remarks ? 'border-rose-500 bg-rose-50' : 'border-[#E5E5E5]'} rounded-lg text-xs outline-none focus:border-[#005ea4]`}
                        />
                        {formErrors.remarks && (
                          <p className="text-xs text-rose-600 font-semibold mt-1 flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">error</span>
                            {formErrors.remarks}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 flex-wrap pt-2">
                        <button
                          disabled={submittingAction}
                          onClick={() => requestTransition('move_to_work', { remarks: actionInput.remarks }, 'Resume Repair Work')}
                          className="sk-btn sk-btn-primary cursor-pointer disabled:opacity-50 flex items-center gap-1"
                        >

                          Resume Repair Work
                        </button>
                        <button
                          disabled={submittingAction}
                          onClick={() => requestTransition('cancel', { remarks: actionInput.remarks }, 'Cancel Job & Move to Completed')}
                          className="sk-btn bg-[#D03B3B] hover:bg-rose-700 text-white cursor-pointer disabled:opacity-50 flex items-center gap-1"
                        >

                          Cancel Job
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedJob.stage === 'completed' && (
                    <div className="space-y-3 pt-2">
                      {selectedJob.outcome && OUTCOMES[selectedJob.outcome] && (
                        <div
                          className="p-3 rounded-xl flex items-center justify-between border shadow-2xs"
                          style={{ backgroundColor: OUTCOMES[selectedJob.outcome].pbg, borderColor: `${OUTCOMES[selectedJob.outcome].ptx}35` }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-base" style={{ color: OUTCOMES[selectedJob.outcome].ptx }}>
                              {OUTCOMES[selectedJob.outcome].icon}
                            </span>
                            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: OUTCOMES[selectedJob.outcome].ptx }}>
                              Job Status: {OUTCOMES[selectedJob.outcome].label}
                            </span>
                          </div>
                          {selectedJob.tester_findings && (
                            <span className="text-xs italic text-[#475569]">
                              Note: "{selectedJob.tester_findings}"
                            </span>
                          )}
                        </div>
                      )}

                      {/* PROMINENT RECORDED UNPAID FINAL BILL BANNER */}
                      <div className="p-3.5 rounded-xl bg-[#f0f9ff] border border-[#bae6fd] flex items-center justify-between text-xs">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[#0369a1] flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">payments</span>
                            Final Bill Amount (Unpaid Dues)
                          </p>
                          <p className="text-[#0c4a6e] font-medium text-xs mt-0.5">
                            Amount to collect based on completed repair work or applicable inspection fee.
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-xl font-bold font-mono text-[#0284c7]">
                            {formatCurrency(selectedJob.payable_amount ?? selectedJob.final_amount ?? 0)}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-[#0B0B0B] mb-1">Payment Mode</label>
                          <select
                            value={actionInput.payment_mode}
                            onChange={(e) => setActionInput({ ...actionInput, payment_mode: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-xs outline-none"
                          >
                            <option value="cash">Cash Counter</option>
                            <option value="upi">UPI / QR Code</option>
                            <option value="bank">Bank Transfer</option>
                            <option value="waived">Waived Off</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-[#0B0B0B] mb-1">Collected Amount (₹)</label>
                          <input
                            type="number"
                            value={actionInput.paid_amount}
                            onChange={(e) => setActionInput({ ...actionInput, paid_amount: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-xs font-mono outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-[#0B0B0B] mb-1">Payment Remarks (Optional)</label>
                          <input
                            type="text"
                            placeholder="e.g. Transaction Ref / Note"
                            value={actionInput.remarks || ''}
                            onChange={(e) => setActionInput({ ...actionInput, remarks: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-xs outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap pt-2">
                        <button
                          disabled={submittingAction}
                          onClick={() => requestTransition('collect_payment', { payment_mode: actionInput.payment_mode, paid_amount: actionInput.paid_amount, remarks: actionInput.remarks }, 'Collect Payment & Settle Dues')}
                          className="sk-btn sk-btn-primary cursor-pointer"
                        >
                          Collect Payment & Release
                        </button>
                        <button
                          disabled={submittingAction}
                          onClick={() => requestTransition('release_unpaid', { remarks: actionInput.remarks }, 'Release Unpaid Job')}
                          className="sk-btn sk-btn-outline cursor-pointer"
                        >
                          Release Unpaid
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedJob.stage === 'ready' && (
                    <div className="space-y-3 pt-2">
                      {/* PROMINENT PAYMENT HIGHLIGHT & UNPAID BANNER */}
                      <div
                        className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs ${selectedJob.is_paid
                          ? 'bg-[#ecfdf5] border-[#a7f3d0] text-[#065f46]'
                          : 'bg-[#fff7ed] border-[#fed7aa] text-[#9a3412]'
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${selectedJob.is_paid ? 'bg-[#10b981] text-white' : 'bg-[#f59e0b] text-white'
                            }`}>
                            <span className="material-symbols-outlined text-lg">
                              {selectedJob.is_paid ? 'verified' : 'warning'}
                            </span>
                          </div>
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider">
                              {selectedJob.is_paid ? 'PAYMENT SETTLED & PAID' : '⚠️ RELEASED UNPAID (DUES PENDING)'}
                            </p>
                            <p className="text-[11px] opacity-90 mt-0.5">
                              {selectedJob.is_paid
                                ? `Payment of ${formatCurrency(selectedJob.payable_amount)} settled via ${selectedJob.payment_mode?.toUpperCase() || 'Cash/UPI'} on ${formatDate(selectedJob.paid_at || selectedJob.updated_at)}.`
                                : `Item was released for delivery without upfront payment collection. Customer owes ${formatCurrency(selectedJob.payable_amount || 0)}.`}
                            </p>
                          </div>
                        </div>

                        <div className="text-left sm:text-right shrink-0">
                          <span className="text-[10px] uppercase font-bold tracking-wider opacity-75">Payable Amount</span>
                          <p className="text-xl font-black font-mono leading-tight">
                            {formatCurrency(selectedJob.payable_amount || 0)}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-[#0B0B0B] mb-1">Delivery Mode</label>
                          <select
                            value={actionInput.delivery_mode}
                            onChange={(e) => setActionInput({ ...actionInput, delivery_mode: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-xs outline-none"
                          >
                            <option value="self">Deliver by Self</option>
                            <option value="bus">Deliver by Bus</option>
                            <option value="courier">Deliver by Courier</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-[#0B0B0B] mb-1">Receiver Name *</label>
                          <input
                            type="text"
                            value={actionInput.delivery_receiver}
                            onChange={(e) => {
                              setActionInput({ ...actionInput, delivery_receiver: e.target.value });
                              if (formErrors.delivery_receiver) setFormErrors({ ...formErrors, delivery_receiver: null });
                            }}
                            className={`w-full px-3 py-2 bg-white border ${formErrors.delivery_receiver ? 'border-rose-500 bg-rose-50' : 'border-[#E5E5E5]'} rounded-lg text-xs outline-none`}
                          />
                          {formErrors.delivery_receiver && (
                            <p className="text-xs text-rose-600 font-semibold mt-1.5 flex items-center gap-1">
                              <span className="material-symbols-outlined text-sm">error</span>
                              {formErrors.delivery_receiver}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-[#0B0B0B] mb-1">Delivery Date</label>
                          <input
                            type="date"
                            max={new Date().toISOString().split('T')[0]}
                            value={actionInput.out_date || new Date().toISOString().split('T')[0]}
                            onChange={(e) => setActionInput({ ...actionInput, out_date: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-xs font-mono outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-[#0B0B0B] mb-1">Docket / Ref Number</label>
                          <input
                            type="text"
                            placeholder="e.g. DTDC-1092"
                            value={actionInput.delivery_ref}
                            onChange={(e) => setActionInput({ ...actionInput, delivery_ref: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-xs font-mono outline-none"
                          />
                        </div>
                        <div className="lg:col-span-4">
                          <label className="block text-xs font-bold text-[#0B0B0B] mb-1">Delivery Remarks (Optional)</label>
                          <input
                            type="text"
                            placeholder="Handover notes..."
                            value={actionInput.remarks || ''}
                            onChange={(e) => setActionInput({ ...actionInput, remarks: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-xs outline-none"
                          />
                        </div>
                      </div>
                      <div className="pt-2">
                        <button
                          disabled={submittingAction}
                          onClick={() => requestTransition('deliver', { delivery_mode: actionInput.delivery_mode, delivery_receiver: actionInput.delivery_receiver, delivery_ref: actionInput.delivery_ref, out_date: actionInput.out_date, remarks: actionInput.remarks }, 'Confirm Dispatch & Handover')}
                          className="sk-btn sk-btn-primary cursor-pointer"
                        >
                          Confirm Dispatch & Handover
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* CARD 3: JOB TIMELINE CARD */}
                {(() => {
                  const transitionEvents = (selectedJob.events || []).filter(
                    (ev) => ev.action !== 'job_created' && ev.action !== 'created'
                  );
                  const totalLogs = transitionEvents.length + 1;

                  return (
                    <div className="tl-card bg-white border border-[#E5E5E5] rounded-2xl p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#666666] flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm text-[#005ea4]">history</span>
                          Job Audit & Stage History Timeline
                        </h3>
                        <span className="text-[10px] font-bold text-[#666666] bg-[#f4f4f2] px-2 py-0.5 rounded-full">
                          {totalLogs} Log Entry{totalLogs > 1 ? 's' : ''}
                        </span>
                      </div>

                      <div className="relative pl-6 border-l-2 border-[#E5E5E5] space-y-4 text-xs">
                        {/* BASELINE: JOB CREATION / INTAKE */}
                        <div className="relative">
                          <div className="absolute -left-[31px] top-0.5 w-3.5 h-3.5 rounded-full bg-[#005ea4] border-2 border-white ring-2 ring-[#005ea4]/20" />
                          <div className="bg-[#f9f9f7] border border-[#E5E5E5] rounded-xl p-3">
                            <div className="flex justify-between items-start flex-wrap gap-1">
                              <p className="font-bold text-[#0B0B0B] text-xs">
                                Job Intake Registered #{selectedJob.token_no}
                              </p>
                              <span className="text-[10px] font-mono text-[#666666]">
                                {formatDateTime(selectedJob.created_at)}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#666666] mt-1">
                              Received via <span className="font-bold uppercase text-[#0B0B0B]">{selectedJob.received_from || 'Self'}</span> • Created by <span className="font-semibold text-[#0B0B0B]">{selectedJob.creator?.name || 'System'}</span>
                            </p>
                          </div>
                        </div>

                        {/* EVENT HISTORY TRANSITIONS */}
                        {transitionEvents.map((ev) => (
                          <div key={ev.id} className="relative">
                            <div className="absolute -left-[31px] top-0.5 w-3.5 h-3.5 rounded-full bg-[#10b981] border-2 border-white ring-2 ring-[#10b981]/20" />
                            <div className="bg-white border border-[#E5E5E5] rounded-xl p-3 shadow-2xs">
                              <div className="flex justify-between items-start flex-wrap gap-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-[#0B0B0B] text-xs">
                                    {ev.note || ev.action?.replace('_', ' ').toUpperCase()}
                                  </span>
                                  {ev.from_stage && ev.to_stage && (
                                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#f4f4f2] text-[#666666]">
                                      {ev.from_stage} → {ev.to_stage}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] font-mono text-[#666666]">
                                  {formatDateTime(ev.created_at)}
                                </span>
                              </div>
                              <p className="text-[11px] text-[#666666] mt-1">
                                Action performed by <span className="font-semibold text-[#0B0B0B]">{ev.user?.name || 'System'}</span>
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-[#666666] space-y-2">
                <span className="material-symbols-outlined text-4xl text-[#94a3b8]">inbox</span>
                <p className="font-bold text-sm text-[#0B0B0B]">No Work Order Selected</p>
                <p className="text-xs max-w-sm text-[#666666]">
                  {jobs.length === 0
                    ? `There are currently no work orders in the ${selectedStageConfig?.label?.toLowerCase() || 'selected'} stage.`
                    : 'Select a work order from the left list to view operational details and perform actions.'}
                </p>
              </div>
            )}
          </div>

        </div>

        {/* MODAL FOR NEW INTAKE */}
        <CreateJobModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onSuccess={() => router.reload()}
          tokenPreview={tokenPreview}
          sanctumToken={sanctumToken}
        />

        {/* MODAL FOR EDITING INTAKE */}
        <EditJobModal
          job={editJob}
          isOpen={!!editJob}
          onClose={() => setEditJob(null)}
          onSuccess={() => router.reload()}
          sanctumToken={sanctumToken}
        />

        {/* CONFIRMATION ACTION MODAL */}
        <ConfirmActionModal
          isOpen={!!confirmModalData}
          title={confirmModalData?.title || 'Confirm Action'}
          description={
            ['assign_tester', 'mark_pending', 'move_to_work', 'resume_repair', 'resume', 'approve'].includes(confirmModalData?.actionName)
              ? `Are you sure you want to proceed with '${confirmModalData?.title || confirmModalData?.actionName}' for this job?`
              : `Are you sure you want to execute '${confirmModalData?.actionName}' for this job? Choose whether to send a WhatsApp notification.`
          }
          customerName={selectedJob?.customer?.name || ''}
          customerMobile={selectedJob?.customer?.mobile || ''}
          tokenNo={selectedJob?.token_no || ''}
          submitting={submittingAction}
          showWhatsApp={confirmModalData && !['assign_tester', 'mark_pending', 'move_to_work', 'resume_repair', 'resume', 'approve'].includes(confirmModalData.actionName)}
          onClose={() => setConfirmModalData(null)}
          onConfirm={() => executeTransition(confirmModalData.actionName, confirmModalData.payload, false)}
          onConfirmWhatsApp={() => executeTransition(confirmModalData.actionName, confirmModalData.payload, true)}
        />

        {/* PRINTABLE TEST REPORT SHEET MODAL */}
        <TestReportModal
          job={printReportJob}
          isOpen={!!printReportJob}
          onClose={() => setPrintReportJob(null)}
        />

      </div>
    </AppLayout>
  );
}
