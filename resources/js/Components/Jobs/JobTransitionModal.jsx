import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { formatCurrency } from '../../utils/formatters';
import ConfirmActionModal from '../Common/ConfirmActionModal';
import { generateWhatsAppMessage, openWhatsApp } from '../../utils/WhatsAppHelper';

export default function JobTransitionModal({ job, action, isOpen, onClose, onSuccess, testers = [], technicians = [], sanctumToken }) {
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showConfirm, setShowConfirm] = useState(false);

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

  useEffect(() => {
    if (action === 'assign_tester') {
      setFormData({ tester_id: (sortedTesters.find(t => !t.name.toLowerCase().includes('admin')) || sortedTesters[0])?.id || '' });
    } else if (action === 'fault_found') {
      setFormData({ estimated_budget: '', tester_findings: '' });
    } else if (action === 'approve') {
      setFormData({ approved_amount: job?.estimated_budget || '', technician_id: (sortedTechnicians.find(t => !t.name.toLowerCase().includes('admin')) || sortedTechnicians[0])?.id || '' });
    } else if (action === 'work_done') {
      setFormData({ final_amount: job?.approved_amount || '' });
    } else if (action === 'mark_pending') {
      setFormData({ pend_reason: '' });
    } else if (action === 'collect_payment') {
      setFormData({ payment_mode: 'cash', paid_amount: job?.payable_amount || '' });
    } else if (action === 'deliver') {
      setFormData({ delivery_mode: 'self', delivery_receiver: job?.customer?.name || '', delivery_ref: '' });
    } else if (action === 'ok_no_fault' || action === 'not_repairable' || action === 'cancel') {
      setFormData({ tester_findings: '' });
    } else if (action === 'reassign_technician') {
      setFormData({ technician_id: (sortedTechnicians.find(t => !t.name.toLowerCase().includes('admin')) || sortedTechnicians[0])?.id || '' });
    } else {
      setFormData({});
    }
  }, [action, job]);

  if (!isOpen || !job || !action) return null;

  const getActionTitle = () => {
    switch (action) {
      case 'assign_tester': return 'Assign Tester for Inspection';
      case 'ok_no_fault': return 'Mark OK / No Fault Found';
      case 'fault_found': return 'Submit Fault Findings & Budget';
      case 'approve': return 'Approve Budget & Assign Technician';
      case 'not_approved': return 'Mark Not Approved by Customer';
      case 'work_done': return 'Mark Repair Work Done';
      case 'mark_pending': return 'Pause Job / Mark Pending';
      case 'move_to_work': return 'Resume Repair Work';
      case 'collect_payment': return 'Collect Payment & Settle Dues';
      case 'release_unpaid': return 'Release Unpaid to Ready';
      case 'deliver': return 'Dispatch & Deliver Job';
      case 'cancel': return 'Cancel Repair Job';
      case 'not_repairable': return 'Mark Not Repairable';
      case 'reassign_technician': return 'Reassign Technician';
      default: return `Transition Job: ${action}`;
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    setShowConfirm(true);
  };

  const executeTransition = async (withWhatsApp = false) => {
    setLoading(true);
    setErrors({});
    setShowConfirm(false);

    try {
      const headers = sanctumToken ? { Authorization: `Bearer ${sanctumToken}` } : {};
      
      let res;
      const payload = { action, ...formData, send_whatsapp: withWhatsApp };
      if (action === 'deliver') {
        res = await axios.post(`/api/v1/jobs/${job.id}/deliver`, payload, { headers });
      } else {
        res = await axios.post(`/api/v1/jobs/${job.id}/transition`, payload, { headers });
      }

      setLoading(false);

      if (withWhatsApp && job?.customer?.mobile) {
        const msg = generateWhatsAppMessage({
          type: action,
          customerName: job.customer?.name,
          mobile: job.customer?.mobile,
          tokenNo: job.token_no,
          extra: {
            productName: job.product_name,
            estimatedBudget: formData.estimated_budget,
            finalAmount: formData.final_amount,
            fee: job.inspection_fee || 250,
          },
        });
        openWhatsApp({ mobile: job.customer?.mobile, message: msg });
      }

      onSuccess(res.data?.message || 'Workflow transition successful');
      onClose();
    } catch (err) {
      setLoading(false);
      if (err.response?.status === 422 || err.response?.status === 409) {
        setErrors(err.response.data?.errors || { general: [err.response.data?.message] });
      } else {
        setErrors({ general: ['Failed to execute transition. Check state rules.'] });
      }
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-lg rounded-2xl bg-white border border-[#E5E5E5] shadow-2xl overflow-hidden text-[#0B0B0B]"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-[#E5E5E5] flex items-center justify-between bg-[#f9f9f7]">
            <div>
              <h3 className="font-bold text-base text-[#0B0B0B]">
                {getActionTitle()}
              </h3>
              <p className="text-xs sk-tok mt-0.5">
                Token: #{job.token_no} ({job.product_name})
              </p>
            </div>
            <button onClick={onClose} className="text-[#666666] hover:text-[#0B0B0B] p-1 rounded-lg">
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleFormSubmit} className="p-6 space-y-4 text-xs">
            
            {/* Error Banner */}
            {errors.general && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold">
                {errors.general[0]}
              </div>
            )}

            {/* Dynamic Fields */}
            {action === 'assign_tester' && (
              <div>
                <label className="block font-bold uppercase text-[#666666] mb-1">
                  Assign Tester *
                </label>
                <select
                  required
                  value={formData.tester_id}
                  onChange={(e) => setFormData({ ...formData, tester_id: e.target.value })}
                  className="w-full px-3 py-2 bg-[#f4f4f2] border border-[#E5E5E5] rounded-lg text-xs outline-none focus:border-[#005ea4]"
                >
                  <option value="">Select Tester</option>
                  {sortedTesters.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.email})</option>
                  ))}
                </select>
                {errors.tester_id && <p className="text-rose-600 mt-1">{errors.tester_id[0]}</p>}
              </div>
            )}

            {action === 'fault_found' && (
              <>
                <div>
                  <label className="block font-bold uppercase text-[#666666] mb-1">
                    Estimated Budget Amount (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 3500"
                    value={formData.estimated_budget}
                    onChange={(e) => setFormData({ ...formData, estimated_budget: e.target.value })}
                    className="w-full px-3 py-2 bg-[#f4f4f2] border border-[#E5E5E5] rounded-lg text-xs font-mono outline-none focus:border-[#005ea4]"
                  />
                  {errors.estimated_budget && <p className="text-rose-600 mt-1">{errors.estimated_budget[0]}</p>}
                </div>
                <div>
                  <label className="block font-bold uppercase text-[#666666] mb-1">
                    Tester Findings Details
                  </label>
                  <textarea
                    rows="2"
                    placeholder="e.g. Relay board coil shorted, capacitor degraded..."
                    value={formData.tester_findings}
                    onChange={(e) => setFormData({ ...formData, tester_findings: e.target.value })}
                    className="w-full px-3 py-2 bg-[#f4f4f2] border border-[#E5E5E5] rounded-lg text-xs outline-none focus:border-[#005ea4]"
                  />
                </div>
              </>
            )}

            {action === 'approve' && (
              <>
                <div>
                  <label className="block font-bold uppercase text-[#666666] mb-1">
                    Approved Amount (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.approved_amount}
                    onChange={(e) => setFormData({ ...formData, approved_amount: e.target.value })}
                    className="w-full px-3 py-2 bg-[#f4f4f2] border border-[#E5E5E5] rounded-lg text-xs font-mono outline-none focus:border-[#005ea4]"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-[#666666] mb-1">
                    Assign Technician *
                  </label>
                  <select
                    required
                    value={formData.technician_id}
                    onChange={(e) => setFormData({ ...formData, technician_id: e.target.value })}
                    className="w-full px-3 py-2 bg-[#f4f4f2] border border-[#E5E5E5] rounded-lg text-xs outline-none focus:border-[#005ea4]"
                  >
                    <option value="">Select Technician</option>
                    {sortedTechnicians.map((tech) => (
                      <option key={tech.id} value={tech.id}>{tech.name} ({tech.email})</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {action === 'work_done' && (
              <div>
                <label className="block font-bold uppercase text-[#666666] mb-1">
                  Final Bill Amount (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.final_amount}
                  onChange={(e) => setFormData({ ...formData, final_amount: e.target.value })}
                  className="w-full px-3 py-2 bg-[#f4f4f2] border border-[#E5E5E5] rounded-lg text-xs font-mono outline-none focus:border-[#005ea4]"
                />
              </div>
            )}

            {action === 'mark_pending' && (
              <div>
                <label className="block font-bold uppercase text-[#666666] mb-1">
                  Pend Reason *
                </label>
                <textarea
                  rows="3"
                  required
                  placeholder="e.g. Awaiting spare transformer part from vendor..."
                  value={formData.pend_reason}
                  onChange={(e) => setFormData({ ...formData, pend_reason: e.target.value })}
                  className="w-full px-3 py-2 bg-[#f4f4f2] border border-[#E5E5E5] rounded-lg text-xs outline-none focus:border-[#005ea4]"
                />
              </div>
            )}

            {action === 'collect_payment' && (
              <>
                <div>
                  <label className="block font-bold uppercase text-[#666666] mb-1">
                    Payment Mode *
                  </label>
                  <select
                    value={formData.payment_mode}
                    onChange={(e) => setFormData({ ...formData, payment_mode: e.target.value })}
                    className="w-full px-3 py-2 bg-[#f4f4f2] border border-[#E5E5E5] rounded-lg text-xs outline-none focus:border-[#005ea4]"
                  >
                    <option value="cash">Cash Counter</option>
                    <option value="upi">UPI / QR Code</option>
                    <option value="bank">Bank Transfer / NEFT</option>
                    <option value="waived">Waived Off</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold uppercase text-[#666666] mb-1">
                    Paid Amount (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.paid_amount}
                    onChange={(e) => setFormData({ ...formData, paid_amount: e.target.value })}
                    className="w-full px-3 py-2 bg-[#f4f4f2] border border-[#E5E5E5] rounded-lg text-xs font-mono outline-none focus:border-[#005ea4]"
                  />
                </div>
              </>
            )}

            {action === 'deliver' && (
              <>
                <div>
                  <label className="block font-bold uppercase text-[#666666] mb-1">
                    Delivery Handover Mode *
                  </label>
                  <select
                    value={formData.delivery_mode}
                    onChange={(e) => setFormData({ ...formData, delivery_mode: e.target.value })}
                    className="w-full px-3 py-2 bg-[#f4f4f2] border border-[#E5E5E5] rounded-lg text-xs outline-none focus:border-[#005ea4]"
                  >
                    <option value="self">Self Pick Up</option>
                    <option value="bus">Bus Dispatch</option>
                    <option value="courier">Courier Parcel</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold uppercase text-[#666666] mb-1">
                    Receiver Person Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rajesh Kumar"
                    value={formData.delivery_receiver}
                    onChange={(e) => setFormData({ ...formData, delivery_receiver: e.target.value })}
                    className="w-full px-3 py-2 bg-[#f4f4f2] border border-[#E5E5E5] rounded-lg text-xs outline-none focus:border-[#005ea4]"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-[#666666] mb-1">
                    Docket / Reference Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. DOCKET-1029"
                    value={formData.delivery_ref}
                    onChange={(e) => setFormData({ ...formData, delivery_ref: e.target.value })}
                    className="w-full px-3 py-2 bg-[#f4f4f2] border border-[#E5E5E5] rounded-lg text-xs font-mono outline-none focus:border-[#005ea4]"
                  />
                </div>
              </>
            )}

            {(action === 'ok_no_fault' || action === 'not_repairable' || action === 'cancel') && (
              <div>
                <label className="block font-bold uppercase text-[#666666] mb-1">
                  Notes / Findings
                </label>
                <textarea
                  rows="2"
                  placeholder="Reason / Findings..."
                  value={formData.tester_findings || ''}
                  onChange={(e) => setFormData({ ...formData, tester_findings: e.target.value })}
                  className="w-full px-3 py-2 bg-[#f4f4f2] border border-[#E5E5E5] rounded-lg text-xs outline-none focus:border-[#005ea4]"
                />
              </div>
            )}

            {action === 'reassign_technician' && (
              <div>
                <label className="block font-bold uppercase text-[#666666] mb-1">
                  Reassign Technician *
                </label>
                <select
                  required
                  value={formData.technician_id}
                  onChange={(e) => setFormData({ ...formData, technician_id: e.target.value })}
                  className="w-full px-3 py-2 bg-[#f4f4f2] border border-[#E5E5E5] rounded-lg text-xs outline-none focus:border-[#005ea4]"
                >
                  <option value="">Select Technician</option>
                  {technicians.map((tech) => (
                    <option key={tech.id} value={tech.id}>{tech.name} ({tech.email})</option>
                  ))}
                </select>
              </div>
            )}

            {action === 'deliver' && (
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-900 leading-relaxed font-medium flex items-start gap-2">
                <span className="material-symbols-outlined text-base text-blue-600 shrink-0">info</span>
                <span>Are you sure you want to mark this item as delivered? This will update the status and notify the customer.</span>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="pt-4 flex items-center justify-end gap-3 border-t border-[#E5E5E5]">
              <button
                type="button"
                onClick={onClose}
                className="sk-btn sk-btn-outline"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="sk-btn sk-btn-primary cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {loading ? (
                  'Processing...'
                ) : action === 'deliver' ? (
                  <>
                    <span className="material-symbols-outlined text-base">chat</span>
                    <span>Confirm & WhatsApp</span>
                  </>
                ) : (
                  'Confirm Action'
                )}
              </button>
            </div>

          </form>
        </motion.div>

        {/* 3-Button Confirmation Modal */}
        <ConfirmActionModal
          isOpen={showConfirm}
          title={getActionTitle()}
          description={`Are you sure you want to execute '${action}' for this job? Choose whether to send a WhatsApp notification.`}
          customerName={job?.customer?.name || ''}
          customerMobile={job?.customer?.mobile || ''}
          tokenNo={job?.token_no || ''}
          submitting={loading}
          onClose={() => setShowConfirm(false)}
          onConfirm={() => executeTransition(false)}
          onConfirmWhatsApp={() => executeTransition(true)}
        />

      </div>
    </AnimatePresence>
  );
}
