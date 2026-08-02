import React, { useState } from 'react';
import { router } from '@inertiajs/react';
import AppLayout from '../../Layouts/AppLayout';
import axios from 'axios';
import { notifySuccess, notifyError } from '../../utils/toast';

export default function SettingsPage({ settings, sanctumToken }) {
  const [formData, setFormData] = useState({
    inspection_fee: settings?.inspection_fee ?? 250,
    token_prefix: settings?.token_prefix ?? 'SES',
    customer_code_prefix: settings?.customer_code_prefix ?? 'ID',
    business_name: settings?.business_name ?? 'Seekoji Electric',
    whatsapp_enabled: settings?.whatsapp_enabled ?? '0',
  });

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);

    try {
      const headers = sanctumToken ? { Authorization: `Bearer ${sanctumToken}` } : {};
      await axios.put('/api/v1/settings', formData, { headers });
      setSaving(false);
      notifySuccess('System settings updated successfully!');
      setSuccessMsg('Settings updated successfully!');
      setTimeout(() => setSuccessMsg(null), 4000);
      router.reload();
    } catch (err) {
      setSaving(false);
      const errMsg = err.response?.data?.message || 'Failed to update system settings.';
      notifyError(errMsg);
    }
  };

  return (
    <AppLayout title="System Settings">
      <div className="p-4 space-y-4 w-full max-w-full">
        
        {/* HEADER */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#0B0B0B]">System Settings & Rules</h1>
            <p className="text-[#666666] text-xs mt-0.5">
              Configure default inspection fees, token prefixes, business identity & defaults.
            </p>
          </div>
        </div>

        {/* SUCCESS ALERT */}
        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-600">check_circle</span>
            <span>{successMsg}</span>
          </div>
        )}

        {/* SETTINGS CARD */}
        <div className="sk-card p-6 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Inspection Fee */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center pb-6 border-b border-[#E5E5E5]">
              <div>
                <label className="block text-sm font-bold text-[#0B0B0B]">
                  Inspection Fee (₹)
                </label>
                <p className="text-xs text-[#666666] mt-0.5">
                  Default payable fee applied when job outcome is marked OK / No Fault or Not Repairable.
                </p>
              </div>
              <div className="md:col-span-2">
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.inspection_fee}
                  onChange={(e) => setFormData({ ...formData, inspection_fee: e.target.value })}
                  className="w-full max-w-md px-3 py-2 rounded-lg bg-[#f4f4f2] border border-[#E5E5E5] text-sm font-mono text-[#0B0B0B] outline-none focus:border-[#005ea4]"
                />
              </div>
            </div>

            {/* Token Prefix */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center pb-6 border-b border-[#E5E5E5]">
              <div>
                <label className="block text-sm font-bold text-[#0B0B0B]">
                  Job Token Prefix
                </label>
                <p className="text-xs text-[#666666] mt-0.5">
                  Prefix used for auto-generating job tokens (e.g., <span className="sk-tok">SES3107001</span>).
                </p>
              </div>
              <div className="md:col-span-2">
                <input
                  type="text"
                  required
                  value={formData.token_prefix}
                  onChange={(e) => setFormData({ ...formData, token_prefix: e.target.value })}
                  className="w-full max-w-md px-3 py-2 rounded-lg bg-[#f4f4f2] border border-[#E5E5E5] text-sm font-mono text-[#0B0B0B] outline-none focus:border-[#005ea4]"
                />
              </div>
            </div>

            {/* Customer Code Prefix */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center pb-6 border-b border-[#E5E5E5]">
              <div>
                <label className="block text-sm font-bold text-[#0B0B0B]">
                  Customer Code Prefix
                </label>
                <p className="text-xs text-[#666666] mt-0.5">
                  Prefix used for customer code generation (e.g., <span className="sk-tok">ID001</span>).
                </p>
              </div>
              <div className="md:col-span-2">
                <input
                  type="text"
                  required
                  value={formData.customer_code_prefix}
                  onChange={(e) => setFormData({ ...formData, customer_code_prefix: e.target.value })}
                  className="w-full max-w-md px-3 py-2 rounded-lg bg-[#f4f4f2] border border-[#E5E5E5] text-sm font-mono text-[#0B0B0B] outline-none focus:border-[#005ea4]"
                />
              </div>
            </div>

            {/* Business Name */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center pb-6 border-b border-[#E5E5E5]">
              <div>
                <label className="block text-sm font-bold text-[#0B0B0B]">
                  Business Name
                </label>
                <p className="text-xs text-[#666666] mt-0.5">
                  Displayed on receipts, headers, and reports.
                </p>
              </div>
              <div className="md:col-span-2">
                <input
                  type="text"
                  required
                  value={formData.business_name}
                  onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                  className="w-full max-w-md px-3 py-2 rounded-lg bg-[#f4f4f2] border border-[#E5E5E5] text-sm text-[#0B0B0B] outline-none focus:border-[#005ea4]"
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="sk-btn sk-btn-primary disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">save</span>
                {saving ? 'Saving Changes...' : 'Save Settings'}
              </button>
            </div>

          </form>
        </div>

      </div>
    </AppLayout>
  );
}
