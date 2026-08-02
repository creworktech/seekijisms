import React, { useState } from 'react';
import { Link, router } from '@inertiajs/react';
import AppLayout from '../../Layouts/AppLayout';
import axios from 'axios';
import { formatCurrency, formatDate, STAGES } from '../../utils/formatters';
import ConfirmActionModal from '../../Components/Common/ConfirmActionModal';
import { generateWhatsAppMessage, openWhatsApp } from '../../utils/WhatsAppHelper';
import { notifySuccess, notifyError } from '../../utils/toast';

export default function Delivery({ jobs, filters, sanctumToken }) {
  const [search, setSearch] = useState(filters?.search || '');
  const [status, setStatus] = useState(filters?.status || '');

  // Inline open row tracking state
  const [expandedJobId, setExpandedJobId] = useState(null);

  const todayStr = new Date().toISOString().split('T')[0];

  // Form input state for expanded row
  const [deliveryMode, setDeliveryMode] = useState('self');
  const [receiverName, setReceiverName] = useState('');
  const [docketNo, setDocketNo] = useState('');
  const [outDate, setOutDate] = useState(todayStr);
  const [submitting, setSubmitting] = useState(false);
  const [confirmModalJob, setConfirmModalJob] = useState(null);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    router.get('/delivery', { search, status }, { preserveState: true });
  };

  const handleStatusFilter = (newStatus) => {
    setStatus(newStatus);
    router.get('/delivery', { search, status: newStatus }, { preserveState: true });
  };

  const toggleExpand = (job) => {
    if (expandedJobId === job.id) {
      setExpandedJobId(null);
    } else {
      setExpandedJobId(job.id);
      setDeliveryMode('self');
      setReceiverName(job.customer?.name || '');
      setDocketNo('');
      setOutDate(todayStr);
    }
  };

  const handleConfirmDelivery = async (job, withWhatsApp = false) => {
    setSubmitting(true);
    try {
      const headers = sanctumToken ? { Authorization: `Bearer ${sanctumToken}` } : {};
      const res = await axios.post(
        `/api/v1/jobs/${job.id}/deliver`,
        {
          delivery_mode: deliveryMode,
          delivery_receiver: receiverName,
          delivery_ref: docketNo,
          out_date: outDate,
          send_whatsapp: withWhatsApp,
        },
        { headers }
      );
      setSubmitting(false);
      setConfirmModalJob(null);
      setExpandedJobId(null);

      if (withWhatsApp && job?.customer?.mobile) {
        const msg = generateWhatsAppMessage({
          type: 'deliver',
          customerName: job.customer?.name,
          mobile: job.customer?.mobile,
          tokenNo: job.token_no,
        });
        openWhatsApp({ mobile: job.customer?.mobile, message: msg });
      }

      notifySuccess(res.data?.message || `Job #${job.token_no} delivered successfully!`);
      router.reload();
    } catch (err) {
      setSubmitting(false);
      const errMsg = err.response?.data?.message || 'Failed to record delivery.';
      notifyError(errMsg);
    }
  };

  const jobList = jobs?.data || [];
  const pagination = jobs?.meta || {};

  return (
    <AppLayout title="Delivery">
      <div className="p-4 space-y-4 w-full max-w-full">

        {/* HEADER */}
        <div className="flex justify-between items-start flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#0B0B0B]">Delivery</h1>
            <p className="text-[#666666] text-xs mt-0.5">
              Record item handover and dispatch details to customers.
            </p>
          </div>
        </div>

        {/* CARD CONTAINER */}
        <div className="sk-card">

          {/* TWO MAIN SEPARATE TABS */}
          <div className="flex border-b border-[#E5E5E5] bg-[#f9f9f7] px-4 pt-2 gap-2">
            <button
              onClick={() => handleStatusFilter('ready')}
              className={`px-5 py-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${status !== 'delivered'
                  ? 'border-[#005ea4] text-[#005ea4] bg-white rounded-t-xl shadow-sm'
                  : 'border-transparent text-[#666666] hover:text-[#0B0B0B]'
                }`}
            >
              <span className="material-symbols-outlined text-base">schedule_send</span>
              <span>Delivery (Undelivered)</span>
            </button>
            <button
              onClick={() => handleStatusFilter('delivered')}
              className={`px-5 py-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${status === 'delivered'
                  ? 'border-[#1BAF7A] text-[#1BAF7A] bg-white rounded-t-xl shadow-sm'
                  : 'border-transparent text-[#666666] hover:text-[#0B0B0B]'
                }`}
            >
              <span className="material-symbols-outlined text-base">local_shipping</span>
              <span>Delivered</span>
            </button>
          </div>

          {/* SEARCH TOOLBAR */}
          <div className="flex justify-between items-center p-4 border-b border-[#E5E5E5] flex-wrap gap-3">
            <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[240px] max-w-[420px]">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#717783] text-base pointer-events-none">
                search
              </span>
              <input
                type="text"
                placeholder="Search by token, customer name or product..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-11 pr-3 py-2 bg-[#f4f4f2] border border-[#E5E5E5] rounded-lg text-xs outline-none focus:border-[#005ea4]"
              />
            </form>
          </div>

          {/* TABLE */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#f4f4f2] text-[#666666] uppercase text-[10px] font-bold tracking-wider border-b border-[#E5E5E5]">
                <tr>
                  <th className="py-3.5 px-4">TOKEN NO</th>
                  <th className="py-3.5 px-4">CUSTOMER</th>
                  <th className="py-3.5 px-4">PRODUCT</th>
                  <th className="py-3.5 px-4">COMPLETED ON</th>
                  <th className="py-3.5 px-4">DELIVERY MODE</th>
                  <th className="py-3.5 px-4">DELIVERED ON</th>
                  <th className="py-3.5 px-4">STATUS</th>
                  <th className="py-3.5 px-4 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5]">
                {jobList.length > 0 ? (
                  jobList.map((job) => {
                    const isExpanded = expandedJobId === job.id;
                    const isDelivered = job.stage === 'delivered';
                    const hasDues = !job.is_paid && job.payable_amount > 0;

                    return (
                      <React.Fragment key={job.id}>
                        {/* MAIN ROW */}
                        <tr className={`transition-colors ${isExpanded ? 'bg-[#F0F7FF]' : 'hover:bg-[#f9f9f7]'}`}>

                          {/* Token No */}
                          <td className="py-3.5 px-4">
                            <span className="sk-tok">#{job.token_no}</span>
                          </td>

                          {/* Customer */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-[#0B0B0B]">{job.customer?.name || 'Walk-in'}</div>
                            <div className="text-[11px] font-mono text-[#666666]">{job.customer?.mobile || '-'}</div>
                          </td>

                          {/* Product */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-[#0B0B0B]">{job.product_name}</div>
                            <div className="text-[11px] text-[#666666]">{job.brand || '-'}</div>
                          </td>

                          {/* Completed On */}
                          <td className="py-3.5 px-4 text-[#666666]">
                            {formatDate(job.updated_at || job.created_at)}
                          </td>

                          {/* Delivery Mode */}
                          <td className="py-3.5 px-4 uppercase font-bold text-[#0B0B0B]">
                            {job.delivery_mode || '—'}
                          </td>

                          {/* Delivered On */}
                          <td className="py-3.5 px-4 text-[#666666]">
                            {isDelivered ? formatDate(job.updated_at) : '—'}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4">
                            {isDelivered ? (
                              <span className="sk-pill bg-emerald-50 text-emerald-700">DELIVERED</span>
                            ) : hasDues ? (
                              <span className="sk-pill bg-rose-50 text-rose-700">
                                READY {formatCurrency(job.payable_amount)} DUES
                              </span>
                            ) : (
                              <span className="sk-pill bg-teal-50 text-teal-700">READY</span>
                            )}
                          </td>

                          {/* Action */}
                          <td className="py-3.5 px-4 text-right">
                            {isDelivered ? (
                              <span className="text-xs text-[#666666] italic">Delivered</span>
                            ) : (
                              <button
                                onClick={() => toggleExpand(job)}
                                className={`sk-btn ${isExpanded ? 'bg-[#003e6d] text-white' : 'sk-btn-primary'}`}
                              >
                                <span className="material-symbols-outlined text-base">
                                  {isExpanded ? 'expand_less' : 'local_shipping'}
                                </span>
                                {isExpanded ? 'Close' : 'Mark Delivered'}
                              </button>
                            )}
                          </td>

                        </tr>

                        {/* EXPANDED FORM ROW */}
                        {isExpanded && (
                          <tr className="bg-[#F0F7FF]">
                            <td colSpan="8" className="p-4 border-t border-[#005ea4]/20 border-b-2 border-[#005ea4]">
                              <div className="pl-4 border-l-4 border-[#005ea4] space-y-4">
                                {/* 5-COLUMN FORM */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">

                                  {/* Delivery Mode */}
                                  <div>
                                    <label className="block text-[11px] font-bold text-[#0B0B0B] mb-1">
                                      Delivery Mode
                                    </label>
                                    <select
                                      value={deliveryMode}
                                      onChange={(e) => setDeliveryMode(e.target.value)}
                                      className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-xs outline-none focus:border-[#005ea4]"
                                    >
                                      <option value="self">Select how it goes back</option>
                                      <option value="self">Handed Over directly (Self)</option>
                                      <option value="bus">Sent by Bus Transport</option>
                                      <option value="courier">Sent by Courier</option>
                                    </select>
                                  </div>

                                  {/* Receiver Name */}
                                  <div>
                                    <label className="block text-[11px] font-bold text-[#0B0B0B] mb-1">
                                      Receiver Name *
                                    </label>
                                    <input
                                      type="text"
                                      placeholder="Who is collecting?"
                                      value={receiverName}
                                      onChange={(e) => setReceiverName(e.target.value)}
                                      className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-xs outline-none focus:border-[#005ea4]"
                                    />
                                  </div>

                                  {/* Delivery Date (Back Date) */}
                                  <div>
                                    <label className="block text-[11px] font-bold text-[#0B0B0B] mb-1">
                                      Delivery Date
                                    </label>
                                    <input
                                      type="date"
                                      max={todayStr}
                                      value={outDate}
                                      onChange={(e) => setOutDate(e.target.value)}
                                      className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-xs font-mono outline-none focus:border-[#005ea4]"
                                    />
                                  </div>

                                  {/* Docket / Vehicle No */}
                                  <div>
                                    <label className="block text-[11px] font-bold text-[#0B0B0B] mb-1">
                                      Docket / Vehicle No.
                                    </label>
                                    <input
                                      type="text"
                                      placeholder="Optional"
                                      value={docketNo}
                                      onChange={(e) => setDocketNo(e.target.value)}
                                      className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-xs outline-none focus:border-[#005ea4]"
                                    />
                                  </div>

                                  {/* Confirm Delivery Button */}
                                  <div>
                                    <button
                                      disabled={submitting}
                                      onClick={() => setConfirmModalJob(job)}
                                      className="w-full sk-btn sk-btn-primary py-2 cursor-pointer disabled:opacity-50"
                                    >
                                      <span className="material-symbols-outlined text-base">check</span>
                                      {submitting ? 'Processing...' : 'Confirm Delivery'}
                                    </button>
                                  </div>

                                </div>

                                {/* AMBER DUES WARNING ALERT */}
                                {hasDues && (
                                  <div className="p-3 rounded-lg bg-[#FFF8F0] border-l-4 border-[#FFA500] text-xs text-[#9a3412]">
                                    This item is going out with <b>{formatCurrency(job.payable_amount)}</b> unpaid. It stays in the dues report until collected.
                                  </div>
                                )}

                              </div>
                            </td>
                          </tr>
                        )}

                      </React.Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="8" className="py-8 text-center text-[#666666]">
                      No delivery jobs match your filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* FOOTER PAGINATION */}
          <div className="flex justify-between items-center p-4 border-t border-[#E5E5E5] flex-wrap gap-3 text-xs text-[#666666]">
            <span>Showing <b>{jobList.length}</b> of <b>{jobs?.meta?.total || jobList.length}</b> delivery items (30 per page)</span>
            <div className="flex gap-1">
              {jobs?.links?.prev ? (
                <Link href={jobs.links.prev} className="w-8 h-8 rounded border border-[#E5E5E5] bg-white flex items-center justify-center font-bold text-[#0B0B0B]">
                  &lsaquo;
                </Link>
              ) : (
                <button disabled className="w-8 h-8 rounded border border-[#E5E5E5] bg-white opacity-40 cursor-not-allowed font-bold">
                  &lsaquo;
                </button>
              )}
              <button className="w-8 h-8 rounded border border-[#005ea4] bg-[#005ea4] text-white font-bold">
                {jobs?.meta?.current_page || 1}
              </button>
              {jobs?.links?.next ? (
                <Link href={jobs.links.next} className="w-8 h-8 rounded border border-[#E5E5E5] bg-white flex items-center justify-center font-bold text-[#0B0B0B]">
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

      {/* 3-BUTTON CONFIRMATION MODAL */}
      <ConfirmActionModal
        isOpen={!!confirmModalJob}
        title="Confirm Delivery Handover"
        description="Are you sure you want to mark this item as delivered? Choose whether to send a delivery WhatsApp notification."
        customerName={confirmModalJob?.customer?.name || ''}
        customerMobile={confirmModalJob?.customer?.mobile || ''}
        tokenNo={confirmModalJob?.token_no || ''}
        submitting={submitting}
        onClose={() => setConfirmModalJob(null)}
        onConfirm={() => handleConfirmDelivery(confirmModalJob, false)}
        onConfirmWhatsApp={() => handleConfirmDelivery(confirmModalJob, true)}
      />
    </AppLayout>
  );
}
