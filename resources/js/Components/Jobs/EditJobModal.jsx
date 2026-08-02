import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { notifySuccess, notifyError } from '../../utils/toast';

export default function EditJobModal({ job, isOpen, onClose, onSuccess, sanctumToken }) {
  const [formData, setFormData] = useState({
    product_name: '',
    brand: '',
    serial_no: '',
    power_rating: '',
    fault_description: '',
    customer_remark: '',
    received_from: 'self',
    priority: 'medium',
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (job) {
      setFormData({
        product_name: job.product_name || '',
        brand: job.brand || '',
        serial_no: job.serial_no || '',
        power_rating: job.power_rating || '',
        fault_description: job.fault_description || '',
        customer_remark: job.customer_remark || '',
        received_from: job.received_from || 'self',
        priority: job.priority || 'medium',
      });
      setErrors({});
    }
  }, [job]);

  if (!isOpen || !job) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    let res = null;

    try {
      const headers = sanctumToken ? { Authorization: `Bearer ${sanctumToken}` } : {};
      res = await axios.put(`/api/v1/jobs/${job.id}`, formData, { headers });
    } catch (apiErr) {
      try {
        res = await axios.put(`/jobs/${job.id}`, formData);
      } catch (webErr) {
        setLoading(false);
        const activeErr = webErr.response ? webErr : apiErr;
        let errMsg = activeErr.response?.data?.message || activeErr.message;

        if (activeErr.response?.status === 422 && activeErr.response?.data?.errors) {
          const errorList = Object.values(activeErr.response.data.errors).flat();
          if (errorList.length > 0) {
            errMsg = errorList.join(' ');
          }
          setErrors(activeErr.response.data.errors);
        } else {
          setErrors({ general: errMsg || 'Failed to update job details.' });
        }

        notifyError(errMsg || 'Failed to update job details.');
        return;
      }
    }

    setLoading(false);

    if (res && res.data) {
      notifySuccess(res.data?.message || `Job #${job.token_no} updated successfully!`);
      onSuccess(res.data?.message || 'Job details updated successfully');
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-2xl rounded-2xl bg-white border border-[#E5E5E5] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col text-[#0B0B0B]"
        >
          {/* Modal Header */}
          <div className="px-6 py-4 border-b border-[#E5E5E5] flex items-center justify-between bg-[#f9f9f7]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#005ea4] text-white flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-xl">edit_note</span>
              </div>
              <div>
                <h3 className="font-bold text-lg text-[#0B0B0B]">
                  Edit Service Job Intake
                </h3>
                <p className="text-xs text-[#666666]">
                  Token:{' '}
                  <span className="sk-tok font-bold">
                    #{job.token_no}
                  </span>
                  {' '}• Customer:{' '}
                  <span className="font-bold text-[#0B0B0B]">
                    {job.customer?.name}
                  </span>
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-[#666666] hover:text-[#0B0B0B] p-1 rounded-lg">
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1 thin-sb text-xs">
            
            {errors.general && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {errors.general}
              </div>
            )}

            {/* Product Name & Brand */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold uppercase text-[#666666] mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Voltage Stabilizer 5KVA"
                  value={formData.product_name}
                  onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                  className="w-full px-3 py-2 bg-[#f4f4f2] border border-[#E5E5E5] rounded-lg text-xs outline-none focus:border-[#005ea4]"
                />
                {errors.product_name && <p className="text-rose-600 text-xs mt-1">{errors.product_name[0]}</p>}
              </div>

              <div>
                <label className="block font-bold uppercase text-[#666666] mb-1">
                  Brand / Make
                </label>
                <input
                  type="text"
                  placeholder="e.g. V-Guard, Microtek"
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  className="w-full px-3 py-2 bg-[#f4f4f2] border border-[#E5E5E5] rounded-lg text-xs outline-none focus:border-[#005ea4]"
                />
              </div>
            </div>

            {/* Serial No & Power Rating */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold uppercase text-[#666666] mb-1">
                  Serial Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. SN82931"
                  value={formData.serial_no}
                  onChange={(e) => setFormData({ ...formData, serial_no: e.target.value })}
                  className="w-full px-3 py-2 bg-[#f4f4f2] border border-[#E5E5E5] rounded-lg text-xs font-mono outline-none focus:border-[#005ea4]"
                />
              </div>

              <div>
                <label className="block font-bold uppercase text-[#666666] mb-1">
                  Power Rating
                </label>
                <input
                  type="text"
                  placeholder="e.g. 5KVA, 2HP, 1000W"
                  value={formData.power_rating}
                  onChange={(e) => setFormData({ ...formData, power_rating: e.target.value })}
                  className="w-full px-3 py-2 bg-[#f4f4f2] border border-[#E5E5E5] rounded-lg text-xs outline-none focus:border-[#005ea4]"
                />
              </div>
            </div>

            {/* Receiving Mode & Priority */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold uppercase text-[#666666] mb-1">
                  Receiving Mode
                </label>
                <select
                  value={formData.received_from}
                  onChange={(e) => setFormData({ ...formData, received_from: e.target.value })}
                  className="w-full px-3 py-2 bg-[#f4f4f2] border border-[#E5E5E5] rounded-lg text-xs outline-none focus:border-[#005ea4]"
                >
                  <option value="self">Self Counter Handover</option>
                  <option value="bus">Bus Transport</option>
                  <option value="courier">Courier Parcel</option>
                </select>
              </div>

              <div>
                <label className="block font-bold uppercase text-[#666666] mb-1">
                  Priority
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full px-3 py-2 bg-[#f4f4f2] border border-[#E5E5E5] rounded-lg text-xs outline-none focus:border-[#005ea4]"
                >
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                  <option value="low">Low Priority</option>
                </select>
              </div>
            </div>

            {/* Fault Description */}
            <div>
              <label className="block font-bold uppercase text-[#666666] mb-1">
                Fault Description
              </label>
              <textarea
                rows="2"
                placeholder="Describe symptoms: output fluctuating, clicking sound, no power..."
                value={formData.fault_description}
                onChange={(e) => setFormData({ ...formData, fault_description: e.target.value })}
                className="w-full px-3 py-2 bg-[#f4f4f2] border border-[#E5E5E5] rounded-lg text-xs outline-none focus:border-[#005ea4]"
              />
              {errors.fault_description && <p className="text-rose-600 text-xs mt-1">{errors.fault_description[0]}</p>}
            </div>

            {/* Customer Remark */}
            <div>
              <label className="block font-bold uppercase text-[#666666] mb-1">
                Customer Remark
              </label>
              <input
                type="text"
                placeholder="e.g. Urgent, needed before festival"
                value={formData.customer_remark}
                onChange={(e) => setFormData({ ...formData, customer_remark: e.target.value })}
                className="w-full px-3 py-2 bg-[#f4f4f2] border border-[#E5E5E5] rounded-lg text-xs outline-none focus:border-[#005ea4]"
              />
            </div>

            {/* Footer */}
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
                className="sk-btn sk-btn-primary cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Saving Changes...' : 'Save Job Changes'}
              </button>
            </div>

          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
