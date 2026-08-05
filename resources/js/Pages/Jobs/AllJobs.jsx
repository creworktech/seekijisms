import React, { useState } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import AppLayout from '../../Layouts/AppLayout';
import JobTimelineDrawer from '../../Components/Jobs/JobTimelineDrawer';
import JobTransitionModal from '../../Components/Jobs/JobTransitionModal';
import CreateJobModal from '../../Components/Jobs/CreateJobModal';
import EditJobModal from '../../Components/Jobs/EditJobModal';
import ShowCustomerDrawer from '../../Components/Customers/ShowCustomerDrawer';
import EditCustomerModal from '../../Components/Customers/EditCustomerModal';
import TestReportModal from '../../Components/Jobs/TestReportModal';
import TableLoadingOverlay from '../../Components/Common/TableLoadingOverlay';
import SearchableCustomerSelect from '../../Components/Common/SearchableCustomerSelect';
import ConfirmActionModal from '../../Components/Common/ConfirmActionModal';
import Pagination from '../../Components/Pagination';
import axios from 'axios';
import { notifySuccess, notifyError } from '../../utils/toast';
import { formatDate, STAGES, PRIORITIES, hasPermission } from '../../utils/formatters';
import { exportToCSV, exportToPDF } from '../../utils/exportHelper';

export default function AllJobs({ jobs, customers = [], totalJobsCount, outcomeGroupCounts, testers = [], technicians = [], tokenPreview, filters, sanctumToken }) {
  const { auth } = usePage().props;
  const user = auth?.user;
  const isAdmin = user?.roles?.includes('admin');
  const canCreateJob = hasPermission(user, 'jobs.create');

  const [search, setSearch] = useState(filters?.search || '');
  const [selectedJob, setSelectedJob] = useState(null);
  const [timelineJob, setTimelineJob] = useState(null);
  const [printReportJob, setPrintReportJob] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editJob, setEditJob] = useState(null);
  const [deleteModalData, setDeleteModalData] = useState(null);
  const [deletingJob, setDeletingJob] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);

  const handleConfirmDeleteJob = async () => {
    if (!deleteModalData) return;
    setDeletingJob(true);
    try {
      const headers = sanctumToken ? { Authorization: `Bearer ${sanctumToken}` } : {};
      const res = await axios.delete(`/api/v1/jobs/${deleteModalData.id}`, { headers });
      setDeletingJob(false);
      setDeleteModalData(null);
      notifySuccess(res.data?.message || 'Work Order deleted successfully');
      router.reload();
    } catch (err) {
      setDeletingJob(false);
      notifyError(err.response?.data?.message || 'Failed to delete work order.');
    }
  };

  React.useEffect(() => {
    const unbindStart = router.on('start', () => setIsNavigating(true));
    const unbindFinish = router.on('finish', () => setIsNavigating(false));
    return () => {
      unbindStart();
      unbindFinish();
    };
  }, []);

  const currentOutcomeGroup = filters?.outcome_group || '';
  const selectedCustomerId = filters?.customer_id || '';

  const handleSearchChange = (val) => {
    setSearch(val);
    router.get('/jobs', { ...filters, search: val }, { preserveState: true });
  };

  const handleCustomerFilter = (custId) => {
    router.get('/jobs', { ...filters, customer_id: custId }, { preserveState: true, preserveScroll: true });
  };

  const handleOutcomeGroupFilter = (group) => {
    router.get('/jobs', { ...filters, outcome_group: group }, { preserveState: true });
  };

  const jobList = jobs?.data || [];
  const pagination = jobs?.meta || {};
  const total = totalJobsCount || pagination.total || jobList.length;

  return (
    <AppLayout title="All Jobs" description="Search, filter, and track all solar controller service jobs across stages and repair outcomes.">
      <div className="p-4 space-y-4 w-full max-w-full">

        {/* PAGE HEADER */}
        <div className="flex justify-between items-start flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#0B0B0B]">All Jobs Repository</h1>
            <p className="text-[#666666] text-xs mt-0.5">Search, filter, and manage all {total} service intake records across stages and repair categories.</p>
          </div>

          <div className="flex items-center gap-3">
            {canCreateJob && (
              <button
                onClick={() => setIsCreateOpen(true)}
                className="sk-btn sk-btn-primary"
              >
                <span className="material-symbols-outlined text-base">add</span>
                New Job Intake
              </button>
            )}
            {isAdmin && (
              <Link
                href="/jcc"
                className="sk-btn sk-btn-outline"
              >
                <span className="material-symbols-outlined text-base">bolt</span>
                Open Control Center
              </Link>
            )}
          </div>
        </div>

        {/* FUNDAMENTAL OUTCOME CATEGORY FILTER BAR */}
        <div className="flex items-center flex-wrap gap-2 pt-1">
          <button
            onClick={() => handleOutcomeGroupFilter('')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${!currentOutcomeGroup
              ? 'bg-[#005ea4] text-white shadow-sm'
              : 'bg-white text-[#64748b] border border-[#E5E5E5] hover:bg-[#f8fafc]'
              }`}
          >
            <span className="material-symbols-outlined text-sm">grid_view</span>
            <span>All Jobs</span>
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${!currentOutcomeGroup ? 'bg-white/20 text-white' : 'bg-slate-100 text-[#475569]'}`}>
              {total}
            </span>
          </button>

          <button
            onClick={() => handleOutcomeGroupFilter('new_jobs')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${currentOutcomeGroup === 'new_jobs'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'bg-white text-[#64748b] border border-[#E5E5E5] hover:bg-sky-50 hover:text-sky-700'
              }`}
          >
            <span className="material-symbols-outlined text-sm text-sky-500">fiber_new</span>
            <span>New Jobs</span>
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${currentOutcomeGroup === 'new_jobs' ? 'bg-white/20 text-white' : 'bg-sky-100 text-sky-800'}`}>
              {outcomeGroupCounts?.new_jobs || 0}
            </span>
          </button>

          <button
            onClick={() => handleOutcomeGroupFilter('in_progress')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${currentOutcomeGroup === 'in_progress'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-white text-[#64748b] border border-[#E5E5E5] hover:bg-purple-50 hover:text-purple-700'
              }`}
          >
            <span className="material-symbols-outlined text-sm text-purple-500">handyman</span>
            <span>In Progress</span>
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${currentOutcomeGroup === 'in_progress' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-800'}`}>
              {outcomeGroupCounts?.in_progress || 0}
            </span>
          </button>

          <button
            onClick={() => handleOutcomeGroupFilter('pending')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${currentOutcomeGroup === 'pending'
              ? 'bg-pink-600 text-white shadow-sm'
              : 'bg-white text-[#64748b] border border-[#E5E5E5] hover:bg-pink-50 hover:text-pink-700'
              }`}
          >
            <span className="material-symbols-outlined text-sm text-pink-500">schedule</span>
            <span>Pending</span>
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${currentOutcomeGroup === 'pending' ? 'bg-white/20 text-white' : 'bg-pink-100 text-pink-800'}`}>
              {outcomeGroupCounts?.pending || 0}
            </span>
          </button>

          <button
            onClick={() => handleOutcomeGroupFilter('repaired')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${currentOutcomeGroup === 'repaired'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-[#64748b] border border-[#E5E5E5] hover:bg-emerald-50 hover:text-emerald-700'
              }`}
          >
            <span className="material-symbols-outlined text-sm text-emerald-500">check_circle</span>
            <span>Repaired / OK</span>
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${currentOutcomeGroup === 'repaired' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
              {outcomeGroupCounts?.repaired || 0}
            </span>
          </button>

          <button
            onClick={() => handleOutcomeGroupFilter('not_approved')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${currentOutcomeGroup === 'not_approved'
              ? 'bg-orange-600 text-white shadow-sm'
              : 'bg-white text-[#64748b] border border-[#E5E5E5] hover:bg-orange-50 hover:text-orange-700'
              }`}
          >
            <span className="material-symbols-outlined text-sm text-orange-500">do_not_disturb_on</span>
            <span>Not Approved</span>
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${currentOutcomeGroup === 'not_approved' ? 'bg-white/20 text-white' : 'bg-orange-100 text-orange-800'}`}>
              {outcomeGroupCounts?.not_approved || 0}
            </span>
          </button>

          <button
            onClick={() => handleOutcomeGroupFilter('not_repairable')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${currentOutcomeGroup === 'not_repairable'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-white text-[#64748b] border border-[#E5E5E5] hover:bg-amber-50 hover:text-amber-700'
              }`}
          >
            <span className="material-symbols-outlined text-sm text-amber-500">report_problem</span>
            <span>Not Repairable</span>
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${currentOutcomeGroup === 'not_repairable' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'}`}>
              {outcomeGroupCounts?.not_repairable || 0}
            </span>
          </button>

          <button
            onClick={() => handleOutcomeGroupFilter('cancelled')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${currentOutcomeGroup === 'cancelled'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'bg-white text-[#64748b] border border-[#E5E5E5] hover:bg-rose-50 hover:text-rose-700'
              }`}
          >
            <span className="material-symbols-outlined text-sm text-rose-500">cancel</span>
            <span>Cancelled</span>
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${currentOutcomeGroup === 'cancelled' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-800'}`}>
              {outcomeGroupCounts?.cancelled || 0}
            </span>
          </button>

          <button
            onClick={() => handleOutcomeGroupFilter('ready')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${currentOutcomeGroup === 'ready'
              ? 'bg-teal-600 text-white shadow-sm'
              : 'bg-white text-[#64748b] border border-[#E5E5E5] hover:bg-teal-50 hover:text-teal-700'
              }`}
          >
            <span className="material-symbols-outlined text-sm text-teal-500">verified</span>
            <span>Ready for Delivery</span>
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${currentOutcomeGroup === 'ready' ? 'bg-white/20 text-white' : 'bg-teal-100 text-teal-800'}`}>
              {outcomeGroupCounts?.ready || 0}
            </span>
          </button>

          <button
            onClick={() => handleOutcomeGroupFilter('delivered')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${currentOutcomeGroup === 'delivered'
              ? 'bg-cyan-700 text-white shadow-sm'
              : 'bg-white text-[#64748b] border border-[#E5E5E5] hover:bg-cyan-50 hover:text-cyan-700'
              }`}
          >
            <span className="material-symbols-outlined text-sm text-cyan-600">local_shipping</span>
            <span>Delivered</span>
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${currentOutcomeGroup === 'delivered' ? 'bg-white/20 text-white' : 'bg-cyan-100 text-cyan-800'}`}>
              {outcomeGroupCounts?.delivered || 0}
            </span>
          </button>
        </div>

        {/* MAIN CARD */}
        <div className="sk-card relative">
          <TableLoadingOverlay loading={isNavigating} text="Fetching service jobs records..." />

          {/* TOOLBAR */}
          <div className="flex justify-between items-center p-4 border-b border-[#E5E5E5] flex-wrap gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-[280px] max-w-[720px]">
              <div className="relative flex-1 min-w-[200px]">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#717783] text-base pointer-events-none">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Search jobs by token, product, fault..."
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full pl-11 pr-3 py-2 bg-[#f4f4f2] border border-[#E5E5E5] rounded-lg text-xs outline-none focus:border-[#005ea4]"
                />
              </div>

              <div className="w-64 shrink-0">
                <SearchableCustomerSelect
                  customers={customers}
                  selectedCustomerId={selectedCustomerId}
                  onSelectCustomer={handleCustomerFilter}
                  placeholder="All Customers (Filter)"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => exportToCSV(jobList, `seekoji_jobs_${new Date().toISOString().split('T')[0]}.csv`)}
                className="sk-btn sk-btn-outline cursor-pointer"
                title="Export CSV File"
              >
                <span className="material-symbols-outlined text-base">file_download</span>
                Export CSV
              </button>
              <button
                onClick={() => exportToPDF(jobList, 'Seekoji Service Management - All Jobs Report')}
                className="sk-btn sk-btn-outline cursor-pointer"
                title="Export PDF Report"
              >
                <span className="material-symbols-outlined text-base">picture_as_pdf</span>
                Export PDF
              </button>
            </div>
          </div>

          {/* TABLE (HORIZONTAL SCROLLABLE) */}
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#f4f4f2] text-[#666666] uppercase text-[10px] font-bold tracking-wider border-b border-[#E5E5E5]">
                <tr>
                  <th className="py-2.5 px-3">TOKEN NO</th>
                  <th className="py-2.5 px-3">CUSTOMER</th>
                  <th className="py-2.5 px-3">PRODUCT DETAILS</th>
                  <th className="py-2.5 px-3">PRIORITY</th>
                  <th className="py-2.5 px-3">DATE</th>
                  <th className="py-2.5 px-3">STATUS</th>
                  <th className="py-2.5 px-3">TECHNICIAN</th>
                  <th className="py-2.5 px-3 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5]">
                {jobList.length > 0 ? (
                  jobList.map((j) => {
                    const stageConfig = STAGES[j.stage] || STAGES.new;
                    const priConfig = PRIORITIES[j.priority] || PRIORITIES.medium;
                    const customerInitials = j.customer?.name
                      ? j.customer.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
                      : 'CU';

                    return (
                      <tr key={j.id} className="hover:bg-[#f9f9f7] transition-colors">

                        {/* Token No */}
                        <td className="py-2.5 px-3 font-mono font-bold text-[#005ea4]">
                          #{j.token_no}
                        </td>

                        {/* Customer */}
                        <td className="py-2.5 px-3">
                          {j.customer ? (
                            <div
                              onClick={() => setSelectedCustomer(j.customer)}
                              className="flex items-center gap-2 cursor-pointer group/cust max-w-fit"
                              title="Click to open customer details & job history drawer"
                            >
                              <div className="w-7 h-7 rounded-full bg-[#005ea4] text-white flex items-center justify-center font-bold text-[10px] shrink-0 group-hover/cust:scale-105 transition-transform shadow-sm">
                                {customerInitials}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-[#0B0B0B] group-hover/cust:text-[#005ea4] group-hover/cust:underline truncate text-xs transition-colors flex items-center gap-1">
                                  <span>{j.customer.name}</span>
                                  <span className="material-symbols-outlined text-xs text-[#005ea4] opacity-0 group-hover/cust:opacity-100 transition-opacity">open_in_new</span>
                                </div>
                                <div className="text-[10px] text-[#666666] font-mono">{j.customer.mobile || '-'}</div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-[#94a3b8] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                                CU
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-[#0B0B0B] truncate text-xs">Walk-in</div>
                                <div className="text-[10px] text-[#666666] font-mono">-</div>
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Product Details */}
                        <td className="py-2.5 px-3 max-w-[200px]">
                          <div className="font-bold text-[#0B0B0B] truncate text-xs">{j.product_name}</div>
                          <div className="text-[10px] text-[#666666] truncate">{j.fault_description || j.brand || '-'}</div>
                        </td>

                        {/* Priority */}
                        <td className="py-2.5 px-3 font-semibold text-[11px] whitespace-nowrap">
                          <span className="inline-block w-1.5 h-1.5 rounded-full mr-1" style={{ background: priConfig.color }} />
                          <span style={{ color: priConfig.color }}>{priConfig.label}</span>
                        </td>

                        {/* Date */}
                        <td className="py-2.5 px-3 text-[#666666] text-[11px] whitespace-nowrap">
                          {formatDate(j.in_date || j.created_at)}
                        </td>

                        {/* Status */}
                        <td className="py-2.5 px-3 max-w-[220px]">
                          <span className="sk-pill text-[10px]" style={{ background: stageConfig.pbg, color: stageConfig.ptx }}>
                            {stageConfig.label}
                          </span>

                          {j.outcome === 'cancelled' && (
                            <div className="text-[10px] text-rose-700 font-medium mt-1 truncate" title={j.tester_findings || j.pend_reason || 'Cancelled'}>
                              <span className="font-bold text-rose-800">Cancelled:</span> {j.tester_findings || j.pend_reason || 'No remarks'}
                            </div>
                          )}

                          {j.outcome === 'not_approved' && (
                            <div className="text-[10px] text-orange-700 font-medium mt-1 truncate" title={j.tester_findings || 'Estimate rejected by customer'}>
                              <span className="font-bold text-orange-800">Not Approved:</span> {j.tester_findings || 'Estimate rejected'}
                            </div>
                          )}

                          {j.outcome === 'not_repairable' && (
                            <div className="text-[10px] text-amber-700 font-medium mt-1 truncate" title={j.tester_findings || j.pend_reason || 'Not Repairable'}>
                              <span className="font-bold text-amber-800">Not Repairable:</span> {j.tester_findings || j.pend_reason || 'Unfixable'}
                            </div>
                          )}

                          {j.stage === 'pending' && j.pend_reason && (
                            <div className="text-[10px] text-amber-700 font-medium mt-1 truncate" title={j.pend_reason}>
                              <span className="font-bold text-amber-800">Paused:</span> {j.pend_reason}
                            </div>
                          )}
                        </td>

                        {/* Technician */}
                        <td className="py-2.5 px-3 text-xs">
                          {j.technician?.name ? (
                            <div className="flex items-center gap-1.5">

                              <span className="font-medium text-[#0B0B0B] truncate max-w-[130px]">{j.technician.name}</span>
                            </div>
                          ) : (
                            <span className="text-[#666666] text-[11px] italic">Unassigned</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setTimelineJob(j)}
                              className="p-1 hover:text-[#005ea4] transition-colors cursor-pointer"
                              title="View Timeline"
                            >
                              <span className="material-symbols-outlined text-base">schedule</span>
                            </button>
                            {isAdmin && (
                              <>
                                <button
                                  onClick={() => setEditJob(j)}
                                  className="p-1 hover:text-[#005ea4] transition-colors cursor-pointer"
                                  title="Edit Product & Job Details"
                                >
                                  <span className="material-symbols-outlined text-base">edit</span>
                                </button>
                                <button
                                  onClick={() => setDeleteModalData(j)}
                                  className="p-1 text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
                                  title="Delete Work Order"
                                >
                                  <span className="material-symbols-outlined text-base">delete</span>
                                </button>
                              </>
                            )}

                          </div>
                        </td>

                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="8" className="py-8 text-center text-[#666666]">
                      No jobs match that search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* FOOTER PAGINATION */}
          <Pagination data={jobs} resourceName="jobs" />

        </div>

        {/* TIMELINE DRAWER */}
        <JobTimelineDrawer
          job={timelineJob}
          isOpen={!!timelineJob}
          onClose={() => setTimelineJob(null)}
          sanctumToken={sanctumToken}
        />

        {/* CREATE JOB INTAKE MODAL */}
        <CreateJobModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onSuccess={() => router.reload()}
          tokenPreview={tokenPreview}
          sanctumToken={sanctumToken}
        />

        {/* EDIT JOB INTAKE MODAL */}
        <EditJobModal
          job={editJob}
          isOpen={!!editJob}
          onClose={() => setEditJob(null)}
          onSuccess={() => router.reload()}
          sanctumToken={sanctumToken}
        />

        {/* EDIT CUSTOMER MODAL */}
        <EditCustomerModal
          customer={editingCustomer}
          isOpen={!!editingCustomer}
          onClose={() => setEditingCustomer(null)}
          onSuccess={() => router.reload()}
          sanctumToken={sanctumToken}
        />

        {/* SHOW CUSTOMER DETAILS DRAWER */}
        <ShowCustomerDrawer
          customer={selectedCustomer}
          isOpen={!!selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          sanctumToken={sanctumToken}
          onEdit={(cust) => {
            setSelectedCustomer(null);
            setEditingCustomer(cust);
          }}
        />

        {/* PRINTABLE TEST REPORT SHEET MODAL */}
        <TestReportModal
          job={printReportJob}
          isOpen={!!printReportJob}
          onClose={() => setPrintReportJob(null)}
        />

        {/* DELETE JOB CONFIRMATION MODAL */}
        {deleteModalData && (
          <ConfirmActionModal
            isOpen={Boolean(deleteModalData)}
            title="Delete Work Order"
            description={`Are you sure you want to permanently delete Work Order #${deleteModalData.token_no} (${deleteModalData.product_name})? This action cannot be undone.`}
            tokenNo={deleteModalData.token_no}
            customerName={deleteModalData.customer?.name}
            customerMobile={deleteModalData.customer?.mobile}
            submitting={deletingJob}
            onClose={() => setDeleteModalData(null)}
            onConfirm={handleConfirmDeleteJob}
          />
        )}

      </div>
    </AppLayout>
  );
}
