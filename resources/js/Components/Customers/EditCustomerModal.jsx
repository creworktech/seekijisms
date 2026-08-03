import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { notifySuccess, notifyError } from '../../utils/toast';

export default function EditCustomerModal({ customer, isOpen, onClose, onSuccess, sanctumToken }) {
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    address: '',
    registered_on: '',
    is_active: false,
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (customer) {
      setFormData({
        name: customer.name || '',
        mobile: customer.mobile || '',
        address: customer.address || '',
        registered_on: customer.registered_on || (customer.created_at ? customer.created_at.split('T')[0] : ''),
        is_active: customer.is_active ?? false,
      });
      setErrors({});
    }
  }, [customer]);

  if (!isOpen || !customer) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      const headers = sanctumToken ? { Authorization: `Bearer ${sanctumToken}` } : {};
      const res = await axios.put(`/api/v1/customers/${customer.id}`, formData, { headers });
      setLoading(false);

      notifySuccess(res.data?.message || `Customer #${customer.customer_code} updated successfully!`);
      if (onSuccess) {
        onSuccess(res.data?.message || 'Customer details updated successfully', res.data?.data);
      }
      onClose();
    } catch (err) {
      setLoading(false);
      const errMsg = err.response?.data?.message || 'Failed to update customer details. Please check input fields.';
      notifyError(errMsg);
      if (err.response?.status === 422) {
        setErrors(err.response.data?.errors || {});
      } else {
        setErrors({ general: errMsg });
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
          {/* Modal Header */}
          <div className="px-6 py-4 border-b border-[#E5E5E5] flex items-center justify-between bg-[#f9f9f7]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#005ea4] text-white flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-xl">edit_square</span>
              </div>
              <div>
                <h3 className="font-bold text-base text-[#0B0B0B]">
                  Edit Customer Details
                </h3>
                <p className="text-xs text-[#666666]">
                  Code: <span className="sk-tok font-bold">#{customer.customer_code}</span>
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-[#666666] hover:text-[#0B0B0B] p-1 rounded-lg">
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
            {errors.general && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {errors.general}
              </div>
            )}

            {/* Customer Name */}
            <div>
              <label className="block text-xs font-bold uppercase text-[#666666] mb-1">
                Full Name *
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#717783] text-base pointer-events-none">
                  person
                </span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rajesh Kumar"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full pl-11 pr-4 py-2 bg-[#f4f4f2] border border-[#E5E5E5] rounded-lg text-xs outline-none focus:border-[#005ea4]"
                />
              </div>
              {errors.name && <p className="text-rose-600 text-xs mt-1">{errors.name[0]}</p>}
            </div>

            {/* Mobile (10 Digits - WhatsApp) */}
            <div>
              <label className="block text-xs font-bold uppercase text-[#666666] mb-1">
                WhatsApp Mobile Number (10 digits) *
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#717783] text-base pointer-events-none">
                  call
                </span>
                <input
                  type="text"
                  required
                  maxLength={10}
                  placeholder="e.g. 9876543210"
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  className="w-full pl-11 pr-4 py-2 bg-[#f4f4f2] border border-[#E5E5E5] rounded-lg text-xs font-mono outline-none focus:border-[#005ea4]"
                />
              </div>
              {errors.mobile && <p className="text-rose-600 text-xs mt-1">{errors.mobile[0]}</p>}
            </div>

            {/* Address */}
            <div>
              <label className="block text-xs font-bold uppercase text-[#666666] mb-1">
                Full Address *
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-3 text-[#717783] text-base pointer-events-none">
                  location_on
                </span>
                <textarea
                  required
                  rows={3}
                  placeholder="Complete location address..."
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full pl-11 pr-4 py-2 bg-[#f4f4f2] border border-[#E5E5E5] rounded-lg text-xs outline-none focus:border-[#005ea4]"
                />
              </div>
              {errors.address && <p className="text-rose-600 text-xs mt-1">{errors.address[0]}</p>}
            </div>

            {/* Registration Date & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-[#666666] mb-1">
                  Registration Date
                </label>
                <input
                  type="date"
                  value={formData.registered_on}
                  onChange={(e) => setFormData({ ...formData, registered_on: e.target.value })}
                  className="w-full px-3 py-2 bg-[#f4f4f2] border border-[#E5E5E5] rounded-lg text-xs outline-none focus:border-[#005ea4]"
                />
                {errors.registered_on && <p className="text-rose-600 text-xs mt-1">{errors.registered_on[0]}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-[#666666] mb-1">
                  Dashboard Status
                </label>
                <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 text-[#005ea4] rounded border-[#E5E5E5] focus:ring-0 cursor-pointer"
                  />
                  <span className="font-semibold text-xs text-[#0B0B0B]">
                    {formData.is_active ? 'Active (Show on Dashboard)' : 'Inactive (Hide from Dashboard)'}
                  </span>
                </label>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-[#E5E5E5] flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="sk-btn sk-btn-outline"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="sk-btn sk-btn-primary flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none"
              >
                <span className={`material-symbols-outlined text-base ${loading ? 'animate-spin' : ''}`}>
                  {loading ? 'sync' : 'check'}
                </span>
                <span>{loading ? 'Saving Changes...' : 'Update Customer'}</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
