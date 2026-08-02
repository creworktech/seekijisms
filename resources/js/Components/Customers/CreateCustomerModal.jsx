import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import ConfirmActionModal from '../Common/ConfirmActionModal';
import { generateWhatsAppMessage, openWhatsApp } from '../../utils/WhatsAppHelper';
import { notifySuccess, notifyError } from '../../utils/toast';

export default function CreateCustomerModal({ isOpen, onClose, onSuccess, sanctumToken, initialName = '' }) {
  const [formData, setFormData] = useState({
    name: initialName || '',
    mobile: '',
    address: '',
    registered_on: new Date().toISOString().split('T')[0],
  });

  React.useEffect(() => {
    if (initialName) {
      setFormData((prev) => ({ ...prev, name: initialName }));
    }
  }, [initialName]);

  const [loading, setLoading] = useState(false);
  const [checkingMobile, setCheckingMobile] = useState(false);
  const [errors, setErrors] = useState({});
  const [duplicateCustomer, setDuplicateCustomer] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);

  if (!isOpen) return null;

  // Live Mobile Blur Check
  const handleMobileBlur = async () => {
    if (!formData.mobile || formData.mobile.length < 10) return;
    setCheckingMobile(true);
    try {
      const headers = sanctumToken ? { Authorization: `Bearer ${sanctumToken}` } : {};
      const res = await axios.get(`/api/v1/customers/check-mobile?mobile=${formData.mobile}`, { headers });
      if (res.data && res.data.available === false && res.data.existing_customer) {
        setDuplicateCustomer(res.data.existing_customer);
      } else {
        setDuplicateCustomer(null);
      }
    } catch (err) {
      if (err.response?.status === 422 && err.response?.data?.existing_customer) {
        setDuplicateCustomer(err.response.data.existing_customer);
      }
    } finally {
      setCheckingMobile(false);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    setShowConfirm(true);
  };

  const executeCustomerCreation = async (withWhatsApp = false) => {
    setLoading(true);
    setErrors({});
    setShowConfirm(false);

    try {
      const headers = sanctumToken ? { Authorization: `Bearer ${sanctumToken}` } : {};
      const res = await axios.post('/api/v1/customers', { ...formData, send_whatsapp: withWhatsApp }, { headers });
      const createdCustomer = res.data?.data;
      setLoading(false);

      if (withWhatsApp && createdCustomer) {
        const msg = generateWhatsAppMessage({
          type: 'customer_register',
          customerName: createdCustomer.name,
          mobile: createdCustomer.mobile,
          extra: { customerCode: createdCustomer.customer_code },
        });
        openWhatsApp({ mobile: createdCustomer.mobile, message: msg });
      }

      notifySuccess(res.data?.message || `Customer #${createdCustomer?.customer_code || ''} created successfully!`);
      onSuccess(res.data?.message || 'Customer created successfully', createdCustomer);
      onClose();
    } catch (err) {
      setLoading(false);
      const errMsg = err.response?.data?.message || 'Failed to create customer. Please check input fields.';
      notifyError(errMsg);
      if (err.response?.status === 422) {
        if (err.response.data?.existing_customer) {
          setDuplicateCustomer(err.response.data.existing_customer);
        }
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
          <div className="px-6 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#E6F0FF] text-[#005ea4] flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-lg">person_add</span>
              </div>
              <h3 className="font-bold text-base text-[#0B0B0B]">
                Register New Customer
              </h3>
            </div>
            <button onClick={onClose} className="text-[#666666] hover:text-[#0B0B0B] p-1 rounded-lg">
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleFormSubmit} className="p-6 space-y-4">

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
                  type="tel"
                  required
                  maxLength={10}
                  placeholder="9876543210"
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  onBlur={handleMobileBlur}
                  className="w-full pl-11 pr-10 py-2 bg-[#f4f4f2] border border-[#E5E5E5] rounded-lg text-xs font-mono outline-none focus:border-[#005ea4]"
                />
                {checkingMobile && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-[#005ea4] border-t-transparent rounded-full animate-spin" />
                )}
              </div>
              <p className="text-[11px] text-[#005ea4] font-medium mt-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs text-emerald-600">chat</span>
                Must be an active 10-digit WhatsApp number for status updates.
              </p>
              {errors.mobile && <p className="text-rose-600 text-xs mt-1">{errors.mobile[0]}</p>}
            </div>

            {/* Address */}
            <div>
              <label className="block text-xs font-bold uppercase text-[#666666] mb-1">
                Complete Address
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-2.5 text-[#717783] text-base pointer-events-none">
                  location_on
                </span>
                <textarea
                  rows="2"
                  placeholder="House/Street, Landmark, City..."
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full pl-11 pr-4 py-2 bg-[#f4f4f2] border border-[#E5E5E5] rounded-lg text-xs outline-none focus:border-[#005ea4]"
                />
              </div>
            </div>

            {/* Registered On Date */}
            <div>
              <label className="block text-xs font-bold uppercase text-[#666666] mb-1">
                Registered Date
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#717783] text-base pointer-events-none">
                  calendar_today
                </span>
                <input
                  type="date"
                  value={formData.registered_on}
                  onChange={(e) => setFormData({ ...formData, registered_on: e.target.value })}
                  className="w-full pl-11 pr-4 py-2 bg-[#f4f4f2] border border-[#E5E5E5] rounded-lg text-xs outline-none focus:border-[#005ea4]"
                />
              </div>
            </div>

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
                className="sk-btn sk-btn-primary cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Registering...' : 'Create Customer'}
              </button>
            </div>

          </form>
        </motion.div>

        {/* Duplicate Mobile Alert Modal Popup */}
        <AnimatePresence>
          {duplicateCustomer && (
            <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="w-full max-w-md p-6 rounded-2xl bg-white border border-[#FFA500] text-[#0B0B0B] space-y-4 shadow-2xl"
              >
                <div className="flex items-center gap-3 text-[#FFA500]">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                    <span className="material-symbols-outlined text-2xl">warning</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-base text-[#0B0B0B]">
                      Duplicate Mobile Detected
                    </h4>
                    <p className="text-xs text-[#666666]">
                      Mobile number is already registered in system.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#f4f4f2] border border-[#E5E5E5] space-y-2 text-xs">
                  <p className="text-[#666666]">Existing Customer Profile:</p>
                  <div className="flex justify-between font-bold">
                    <span className="text-[#0B0B0B]">{duplicateCustomer.name}</span>
                    <span className="sk-tok">{duplicateCustomer.customer_code}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={() => setDuplicateCustomer(null)}
                    className="sk-btn sk-btn-outline"
                  >
                    Close Alert
                  </button>
                  <a
                    href={`/customers?search=${duplicateCustomer.customer_code || duplicateCustomer.name}`}
                    className="sk-btn sk-btn-primary"
                  >
                    View Existing Customer
                  </a>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* 3-Button Confirmation Modal */}
        <ConfirmActionModal
          isOpen={showConfirm}
          title="Confirm Customer Registration"
          description="Are you sure you want to register this customer? Choose whether to send a welcome WhatsApp notification."
          customerName={formData.name}
          customerMobile={formData.mobile}
          submitting={loading}
          onClose={() => setShowConfirm(false)}
          onConfirm={() => executeCustomerCreation(false)}
          onConfirmWhatsApp={() => executeCustomerCreation(true)}
        />

      </div>
    </AnimatePresence>
  );
}
