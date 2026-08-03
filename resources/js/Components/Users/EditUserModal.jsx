import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { notifySuccess, notifyError } from '../../utils/toast';

export default function EditUserModal({ isOpen, onClose, onSuccess, userToEdit, sanctumToken }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'technician',
    password: '',
    password_confirmation: '',
    is_active: true,
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (userToEdit) {
      const currentRole = userToEdit.roles?.[0] || 'technician';
      setFormData({
        name: userToEdit.name || '',
        email: userToEdit.email || '',
        phone: userToEdit.phone || '',
        role: currentRole,
        password: '',
        password_confirmation: '',
        is_active: Boolean(userToEdit.is_active),
      });
      setErrors({});
    }
  }, [userToEdit]);

  if (!isOpen || !userToEdit) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    try {
      const headers = sanctumToken ? { Authorization: `Bearer ${sanctumToken}` } : {};
      const payload = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone || null,
        role: formData.role,
        is_active: formData.is_active,
      };

      if (formData.password) {
        payload.password = formData.password;
        payload.password_confirmation = formData.password_confirmation;
      }

      const res = await axios.put(`/api/v1/users/${userToEdit.id}`, payload, { headers });
      setSaving(false);
      notifySuccess(res.data?.message || 'Staff member updated successfully');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setSaving(false);
      if (err.response?.status === 422 && err.response?.data?.errors) {
        setErrors(err.response.data.errors);
      } else {
        notifyError(err.response?.data?.message || 'Failed to update staff member.');
      }
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-2xl shadow-xl border border-[#E5E5E5] w-full max-w-md overflow-hidden"
        >
          {/* Header */}
          <div className="p-4 border-b border-[#E5E5E5] flex justify-between items-center bg-[#f9f9f7]">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#005ea4] text-xl">manage_accounts</span>
              <h2 className="font-bold text-sm text-[#0B0B0B]">Edit Staff Account</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-200 rounded-lg text-[#666666] transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4 space-y-3">
            {/* Name */}
            <div>
              <label className="block text-xs font-bold uppercase text-[#666666] mb-1">
                Staff Name <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 bg-[#f4f4f2] border border-[#E5E5E5] rounded-lg text-xs outline-none focus:border-[#005ea4]"
              />
              {errors.name && <p className="text-rose-600 text-[11px] mt-0.5">{errors.name[0]}</p>}
            </div>

            {/* Email & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase text-[#666666] mb-1">
                  Email Address <span className="text-rose-600">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-[#f4f4f2] border border-[#E5E5E5] rounded-lg text-xs outline-none focus:border-[#005ea4]"
                />
                {errors.email && <p className="text-rose-600 text-[11px] mt-0.5">{errors.email[0]}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-[#666666] mb-1">
                  Mobile Number
                </label>
                <input
                  type="text"
                  maxLength="10"
                  placeholder="10 digit mobile"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-[#f4f4f2] border border-[#E5E5E5] rounded-lg text-xs outline-none focus:border-[#005ea4]"
                />
                {errors.phone && <p className="text-rose-600 text-[11px] mt-0.5">{errors.phone[0]}</p>}
              </div>
            </div>

            {/* Assigned Role */}
            <div>
              <label className="block text-xs font-bold uppercase text-[#666666] mb-1">
                Assigned System Role <span className="text-rose-600">*</span>
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-3 py-2 bg-[#f4f4f2] border border-[#E5E5E5] rounded-lg text-xs font-semibold text-[#0B0B0B] outline-none focus:border-[#005ea4]"
              >
                <option value="admin">System Admin</option>
                <option value="intake_coordinator">Intake Coordinator</option>
                <option value="tester">Tester</option>
                <option value="technician">Technician</option>
              </select>
              {errors.role && <p className="text-rose-600 text-[11px] mt-0.5">{errors.role[0]}</p>}
            </div>

            {/* Change Password (Optional) */}
            <div className="pt-2 border-t border-[#E5E5E5] space-y-2">
              <span className="block text-[11px] font-bold uppercase text-[#005ea4]">
                Change Password (Leave blank to keep current)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <input
                    type="password"
                    placeholder="New password (min 8)"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 bg-[#f4f4f2] border border-[#E5E5E5] rounded-lg text-xs outline-none focus:border-[#005ea4]"
                  />
                  {errors.password && <p className="text-rose-600 text-[11px] mt-0.5">{errors.password[0]}</p>}
                </div>
                <div>
                  <input
                    type="password"
                    placeholder="Confirm new password"
                    value={formData.password_confirmation}
                    onChange={(e) => setFormData({ ...formData, password_confirmation: e.target.value })}
                    className="w-full px-3 py-2 bg-[#f4f4f2] border border-[#E5E5E5] rounded-lg text-xs outline-none focus:border-[#005ea4]"
                  />
                </div>
              </div>
            </div>

            {/* Active Status Checkbox */}
            <div className="pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-[#005ea4] rounded border-[#E5E5E5] focus:ring-0 cursor-pointer"
                />
                <span className="font-semibold text-xs text-[#0B0B0B]">
                  {formData.is_active ? 'Active User (Can login)' : 'Deactivated User (Blocked from login)'}
                </span>
              </label>
            </div>

            {/* Footer Actions */}
            <div className="pt-4 flex justify-end gap-2 border-t border-[#E5E5E5]">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="sk-btn sk-btn-outline cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="sk-btn sk-btn-primary cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none flex items-center gap-1.5"
              >
                <span className={`material-symbols-outlined text-base ${saving ? 'animate-spin' : ''}`}>
                  {saving ? 'sync' : 'check'}
                </span>
                <span>{saving ? 'Saving User...' : 'Update Staff Account'}</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
