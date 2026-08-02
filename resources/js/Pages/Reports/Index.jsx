import React, { useState } from 'react';
import { Link, router } from '@inertiajs/react';
import AppLayout from '../../Layouts/AppLayout';
import axios from 'axios';
import { formatCurrency, formatDate, STAGES, OUTCOMES } from '../../utils/formatters';
import { exportToCSV, exportToPDF } from '../../utils/exportHelper';

export default function Reports({ jobs, technicians = [], filters, sanctumToken }) {
  const [fromDate, setFromDate] = useState(filters?.from || '');
  const [toDate, setToDate] = useState(filters?.to || '');
  const [stage, setStage] = useState(filters?.stage || '');
  const [outcome, setOutcome] = useState(filters?.outcome || '');
  const [technicianId, setTechnicianId] = useState(filters?.technician_id || '');
  const [unpaid, setUnpaid] = useState(filters?.unpaid === '1' || filters?.unpaid === true);

  const [exporting, setExporting] = useState(false);
  const [exportDownloadUrl, setExportDownloadUrl] = useState(null);

  const applyFilters = () => {
    router.get(
      '/reports',
      {
        from: fromDate,
        to: toDate,
        stage,
        outcome,
        technician_id: technicianId,
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
        technician_id: technicianId,
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
    <AppLayout title="Reports & Export Analytics">
      <div className="p-4 space-y-4 w-full max-w-full">
        
        {/* HEADER */}
        <div className="flex justify-between items-start flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#0B0B0B]">Reports & Queued Exports</h1>
            <p className="text-[#666666] text-xs mt-0.5">
              Comprehensive job list strictly ordered by <span className="sk-tok">id ASC</span> (insertion sequence).
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
        <div className="sk-card">
          
          {/* FILTER CONTROLS */}
          <div className="p-4 border-b border-[#E5E5E5] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-center">
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

            <div>
              <label className="block text-[10px] uppercase font-bold text-[#666666] mb-1">Technician</label>
              <select
                value={technicianId}
                onChange={(e) => setTechnicianId(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-[#f4f4f2] border border-[#E5E5E5] text-[#0B0B0B] outline-none"
              >
                <option value="">All Technicians</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className="pt-4 lg:pt-0">
              <button
                onClick={applyFilters}
                className="w-full sk-btn sk-btn-primary"
              >
                <span className="material-symbols-outlined text-base">filter_alt</span>
                Apply Filters
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
                  <th className="py-3.5 px-4">TECHNICIAN</th>
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

                        <td className="py-3.5 px-4 font-semibold text-[#0B0B0B]">
                          {job.technician?.name || '-'}
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
                    <td colSpan="7" className="py-8 text-center text-[#666666]">
                      No jobs recorded matching report parameters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* FOOTER PAGINATION */}
          <div className="flex justify-between items-center p-4 border-t border-[#E5E5E5] flex-wrap gap-3 text-xs text-[#666666]">
            <span>Showing <b>{jobList.length}</b> of <b>{pagination?.total || jobList.length}</b> report records (30 per page)</span>
            <div className="flex gap-1">
              {pagination?.prev ? (
                <Link href={pagination.prev} className="w-8 h-8 rounded border border-[#E5E5E5] bg-white flex items-center justify-center font-bold text-[#0B0B0B]">
                  &lsaquo;
                </Link>
              ) : (
                <button disabled className="w-8 h-8 rounded border border-[#E5E5E5] bg-white opacity-40 cursor-not-allowed font-bold">
                  &lsaquo;
                </button>
              )}
              <button className="w-8 h-8 rounded border border-[#005ea4] bg-[#005ea4] text-white font-bold">
                {pagination?.current_page || 1}
              </button>
              {pagination?.next ? (
                <Link href={pagination.next} className="w-8 h-8 rounded border border-[#E5E5E5] bg-white flex items-center justify-center font-bold text-[#0B0B0B]">
                  &rsaquo;
                </Link>
              ) : (
                <button disabled className="w-8 h-8 rounded border border-[#E5E5E5] bg-white opacity-40 cursor-not-allowed font-bold">
                  &rsaquo;
                </button>
              )}
            </div>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
