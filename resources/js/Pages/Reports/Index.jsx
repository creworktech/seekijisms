import React, { useState } from 'react';
import { Link, router } from '@inertiajs/react';
import AppLayout from '../../Layouts/AppLayout';
import TableLoadingOverlay from '../../Components/Common/TableLoadingOverlay';
import Pagination from '../../Components/Pagination';
import axios from 'axios';
import { formatCurrency, formatDate, STAGES, OUTCOMES } from '../../utils/formatters';
import { exportToCSV, exportToPDF } from '../../utils/exportHelper';

export default function Reports({ jobs, analytics = {}, filters, sanctumToken }) {
  const [fromDate, setFromDate] = useState(filters?.from || '');
  const [toDate, setToDate] = useState(filters?.to || '');
  const [stage, setStage] = useState(filters?.stage || '');
  const [outcome, setOutcome] = useState(filters?.outcome || '');
  const [unpaid, setUnpaid] = useState(filters?.unpaid === '1' || filters?.unpaid === true);

  const [exporting, setExporting] = useState(false);
  const [exportDownloadUrl, setExportDownloadUrl] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);

  React.useEffect(() => {
    const unbindStart = router.on('start', () => setIsNavigating(true));
    const unbindFinish = router.on('finish', () => setIsNavigating(false));
    return () => {
      unbindStart();
      unbindFinish();
    };
  }, []);

  const applyFilters = () => {
    router.get(
      '/reports',
      {
        from: fromDate,
        to: toDate,
        stage,
        outcome,
        unpaid: unpaid ? '1' : undefined,
      },
      { preserveState: true }
    );
  };

  const handleExport = async (format = 'csv') => {
    setExporting(true);
    setExportDownloadUrl(null);

    try {
      const headers = sanctumToken ? { Authorization: `Bearer ${sanctumToken}` } : {};
      const params = new URLSearchParams({
        format,
        from: fromDate,
        to: toDate,
        stage,
        outcome,
        unpaid: unpaid ? '1' : '',
      }).toString();

      const res = await axios.get(`/api/v1/reports/jobs/export?${params}`, { headers });
      setExporting(false);

      if (res.data?.data?.download_url) {
        setExportDownloadUrl(res.data.data.download_url);
      }
    } catch (err) {
      setExporting(false);
      alert('Failed to trigger export.');
    }
  };

  const jobList = jobs?.data || [];
  const pagination = jobs?.meta || {};

  return (
    <AppLayout title="Reports & Analytics" description="Detailed service analytics reports, revenue breakdown, repair outcomes, and exportable audit logs.">
      <div className="p-4 space-y-4 w-full max-w-full">
        
        {/* HEADER */}
        <div className="flex justify-between items-start flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#0B0B0B]">Reports & Analytics</h1>
            <p className="text-[#666666] text-xs mt-0.5">
              Comprehensive operational performance, repair outcome distribution, and financial revenue audit logs.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => exportToCSV(jobList, `service_reports_${new Date().toISOString().split('T')[0]}.csv`)}
              className="sk-btn sk-btn-primary cursor-pointer"
              title="Export CSV Report"
            >
              <span className="material-symbols-outlined text-base">file_download</span>
              Export CSV Report
            </button>
            <button
              onClick={() => exportToPDF(jobList, 'Seekoji Service Management - Master Job Audit Report')}
              className="sk-btn sk-btn-outline cursor-pointer"
              title="Export PDF Report"
            >
              <span className="material-symbols-outlined text-base">picture_as_pdf</span>
              Export PDF Report
            </button>
          </div>
        </div>

        {/* ANALYTICAL KPI METRIC TILES */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="bg-white p-3.5 rounded-2xl border border-[#E5E5E5] shadow-2xs space-y-1">
            <div className="text-[10px] font-bold text-[#666666] uppercase tracking-wider flex items-center justify-between">
              <span>Total Work Orders</span>
              <span className="material-symbols-outlined text-base text-[#005ea4]">format_list_bulleted</span>
            </div>
            <div className="text-xl font-extrabold text-[#0B0B0B]">{analytics.total_jobs || 0}</div>
            <div className="text-[10px] text-[#666666]">Matching active filter</div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-[#E5E5E5] shadow-2xs space-y-1">
            <div className="text-[10px] font-bold text-[#666666] uppercase tracking-wider flex items-center justify-between">
              <span>Total Billed</span>
              <span className="material-symbols-outlined text-base text-emerald-600">payments</span>
            </div>
            <div className="text-xl font-extrabold text-[#0B0B0B]">{formatCurrency(analytics.total_payable || 0)}</div>
            <div className="text-[10px] text-[#666666]">Calculated revenue</div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-[#E5E5E5] shadow-2xs space-y-1">
            <div className="text-[10px] font-bold text-[#666666] uppercase tracking-wider flex items-center justify-between">
              <span>Collected Revenue</span>
              <span className="material-symbols-outlined text-base text-blue-600">check_circle</span>
            </div>
            <div className="text-xl font-extrabold text-blue-600">{formatCurrency(analytics.total_paid || 0)}</div>
            <div className="text-[10px] text-emerald-700 font-semibold">Settled payments</div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-[#E5E5E5] shadow-2xs space-y-1">
            <div className="text-[10px] font-bold text-[#666666] uppercase tracking-wider flex items-center justify-between">
              <span>Outstanding Dues</span>
              <span className="material-symbols-outlined text-base text-amber-600">pending</span>
            </div>
            <div className="text-xl font-extrabold text-amber-600">{formatCurrency(analytics.total_unpaid || 0)}</div>
            <div className="text-[10px] text-amber-700 font-semibold">Uncollected balance</div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-[#E5E5E5] shadow-2xs space-y-1 col-span-2 sm:col-span-1">
            <div className="text-[10px] font-bold text-[#666666] uppercase tracking-wider flex items-center justify-between">
              <span>Completion Rate</span>
              <span className="material-symbols-outlined text-base text-teal-600">trending_up</span>
            </div>
            <div className="text-xl font-extrabold text-teal-700">{analytics.completion_rate || 0}%</div>
            <div className="text-[10px] text-[#666666]">{analytics.completed_count || 0} jobs fulfilled</div>
          </div>
        </div>

        {/* OUTCOME DISTRIBUTION SUMMARY BAR */}
        {analytics.outcomes && (
          <div className="bg-white p-4 rounded-2xl border border-[#E5E5E5] shadow-2xs space-y-2.5">
            <div className="flex justify-between items-center text-xs font-bold text-[#0B0B0B] uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-[#005ea4]">pie_chart</span>
                Repair Outcome Distribution Analytics
              </span>
              <span className="text-[#666666] font-normal lowercase">({analytics.total_jobs || 0} total logs)</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="text-[10px] font-bold text-emerald-800 uppercase">Work Done</div>
                <div className="text-base font-extrabold text-emerald-900">{analytics.outcomes.work_done || 0}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-teal-50 border border-teal-200">
                <div className="text-[10px] font-bold text-teal-800 uppercase">OK / No Fault</div>
                <div className="text-base font-extrabold text-teal-900">{analytics.outcomes.ok_no_fault || 0}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-orange-50 border border-orange-200">
                <div className="text-[10px] font-bold text-orange-800 uppercase">Not Approved</div>
                <div className="text-base font-extrabold text-orange-900">{analytics.outcomes.not_approved || 0}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                <div className="text-[10px] font-bold text-amber-800 uppercase">Not Repairable</div>
                <div className="text-base font-extrabold text-amber-900">{analytics.outcomes.not_repairable || 0}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 col-span-2 sm:col-span-1">
                <div className="text-[10px] font-bold text-rose-800 uppercase">Cancelled</div>
                <div className="text-base font-extrabold text-rose-900">{analytics.outcomes.cancelled || 0}</div>
              </div>
            </div>
          </div>
        )}

        {/* EXPORT READY ALERT BANNER */}
        {exportDownloadUrl && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="material-symbols-outlined text-emerald-600 text-lg">check_circle</span>
              <span>Report export generated successfully!</span>
            </div>
            <a
              href={exportDownloadUrl}
              target="_blank"
              rel="noreferrer"
              className="sk-btn sk-btn-primary"
            >
              <span className="material-symbols-outlined text-base">download</span>
              Download CSV File
            </a>
          </div>
        )}

        {/* CARD CONTAINER */}
        <div className="sk-card relative">
          <TableLoadingOverlay loading={isNavigating} text="Generating custom analytics report..." />
          
          {/* FILTER CONTROLS */}
          <div className="p-4 border-b border-[#E5E5E5] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-center">
            <div>
              <label className="block text-[10px] uppercase font-bold text-[#666666] mb-1">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-[#f4f4f2] border border-[#E5E5E5] text-[#0B0B0B] outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-[#666666] mb-1">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-[#f4f4f2] border border-[#E5E5E5] text-[#0B0B0B] outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-[#666666] mb-1">Stage</label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-[#f4f4f2] border border-[#E5E5E5] text-[#0B0B0B] outline-none"
              >
                <option value="">All Stages</option>
                {Object.keys(STAGES).map((key) => (
                  <option key={key} value={key}>{STAGES[key].label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-[#666666] mb-1">Outcome</label>
              <select
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-[#f4f4f2] border border-[#E5E5E5] text-[#0B0B0B] outline-none"
              >
                <option value="">All Outcomes</option>
                {Object.keys(OUTCOMES).map((key) => (
                  <option key={key} value={key}>{OUTCOMES[key].label}</option>
                ))}
              </select>
            </div>

            <div className="pt-4 sm:pt-0">
              <button
                onClick={applyFilters}
                disabled={isNavigating}
                className="w-full sk-btn sk-btn-primary disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none"
              >
                <span className={`material-symbols-outlined text-base ${isNavigating ? 'animate-spin' : ''}`}>
                  {isNavigating ? 'sync' : 'filter_alt'}
                </span>
                <span>{isNavigating ? 'Applying...' : 'Apply Filters'}</span>
              </button>
            </div>
          </div>

          {/* TABLE */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#f4f4f2] text-[#666666] uppercase text-[10px] font-bold tracking-wider border-b border-[#E5E5E5]">
                <tr>
                  <th className="py-3.5 px-4">ID SEQ</th>
                  <th className="py-3.5 px-4">TOKEN & PRODUCT</th>
                  <th className="py-3.5 px-4">CUSTOMER NAME</th>
                  <th className="py-3.5 px-4">STAGE & OUTCOME</th>
                  <th className="py-3.5 px-4">PAYABLE (₹)</th>
                  <th className="py-3.5 px-4">IN DATE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5]">
                {jobList.length > 0 ? (
                  jobList.map((job) => {
                    const stageConfig = STAGES[job.stage] || STAGES.new;
                    const outcomeConfig = job.outcome ? OUTCOMES[job.outcome] : null;

                    return (
                      <tr key={job.id} className="hover:bg-[#f9f9f7] transition-colors">
                        
                        <td className="py-3.5 px-4">
                          <span className="sk-tok">#{job.id}</span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="sk-tok font-bold">#{job.token_no}</span>
                          <div className="font-bold text-[#0B0B0B]">{job.product_name}</div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-bold text-[#0B0B0B]">{job.customer?.name || '-'}</div>
                          <div className="text-[11px] text-[#666666] font-mono">{job.customer?.mobile || '-'}</div>
                        </td>

                        <td className="py-3.5 px-4 space-y-1">
                          <span className="sk-pill" style={{ background: stageConfig.pbg, color: stageConfig.ptx }}>
                            {stageConfig.label}
                          </span>
                          {outcomeConfig && (
                            <div>
                              <span className="sk-pill bg-slate-100 text-slate-800">
                                {outcomeConfig.label}
                              </span>
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 font-mono font-bold text-[#005ea4]">
                          {formatCurrency(job.payable_amount || 0)}
                        </td>

                        <td className="py-3.5 px-4 text-[#666666]">
                          {formatDate(job.in_date || job.created_at)}
                        </td>

                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-[#666666]">
                      No service records match the selected report criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* FOOTER PAGINATION */}
          <Pagination data={jobs} resourceName="report records" />
        </div>

      </div>
    </AppLayout>
  );
}
