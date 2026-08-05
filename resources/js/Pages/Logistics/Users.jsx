import React, { useEffect, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import axios from 'axios';
import AppLayout from '../../Layouts/AppLayout';
import LogisticsTabs from '../../Components/Logistics/LogisticsTabs';
import Modal from '../../Components/Logistics/Modal';
import Toggle from '../../Components/Logistics/Toggle';
import EmptyState from '../../Components/Logistics/EmptyState';
import { notifySuccess, notifyError } from '../../utils/toast';
import { initials, LOGISTICS_API } from '../../utils/logistics';

const BLANK = {
  name: '',
  mobile: '',
  password: '',
  location_id: '',
  default_stop_id: '',
  is_central: false,
};

export default function LogisticsUsers({ users, locations, stopsByLocation, filters }) {
  const [search, setSearch] = useState(filters.search || '');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(null);
  const [resetValue, setResetValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const firstRender = useRef(true);

  const rows = users?.data || [];
  const meta = users?.meta || {};

  const applyFilters = (next) => {
    router.get('/logistics/users', { ...filters, ...next }, { preserveState: true, preserveScroll: true, replace: true });
  };

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    const timer = setTimeout(() => {
      if (search !== (filters.search || '')) applyFilters({ search });
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const openCreate = () => {
    setEditing('new');
    setForm(BLANK);
    setErrors({});
  };

  const openEdit = (user) => {
    setEditing(user);
    setForm({
      name: user.name,
      mobile: user.mobile,
      password: '',
      location_id: String(user.location_id ?? ''),
      default_stop_id: user.default_stop_id ? String(user.default_stop_id) : '',
      is_central: !!user.is_central,
    });
    setErrors({});
  };

  // The default stop must belong to the chosen location, so changing the
  // location clears a stop that no longer applies.
  const onLocationChange = (locationId) => {
    setForm((f) => ({ ...f, location_id: locationId, default_stop_id: '' }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    const payload = {
      name: form.name,
      mobile: form.mobile,
      location_id: form.location_id || null,
      default_stop_id: form.default_stop_id || null,
      is_central: form.is_central,
    };

    if (editing === 'new') payload.password = form.password;

    try {
      if (editing === 'new') {
        await axios.post(`${LOGISTICS_API}/users`, payload);
        notifySuccess(`${form.name} added.`);
      } else {
        await axios.put(`${LOGISTICS_API}/users/${editing.id}`, payload);
        notifySuccess(`${form.name} updated.`);
      }

      setEditing(null);
      router.reload({ only: ['users'] });
    } catch (err) {
      if (err.response?.status === 422) {
        setErrors(err.response.data?.errors || {});
      } else {
        notifyError(err.response?.data?.message || 'Could not save the user.');
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (user) => {
    // Throws on failure so the optimistic switch rolls itself back.
    await axios
      .patch(`${LOGISTICS_API}/users/${user.id}/toggle-status`)
      .then((res) => {
        notifySuccess(res.data?.message || 'Status updated.');
        router.reload({ only: ['users'] });
      })
      .catch((err) => {
        notifyError(err.response?.data?.message || 'Could not change the status.');
        throw err;
      });
  };

  const deleteUser = async (user) => {
    setDeleting(true);

    try {
      await axios.delete(`${LOGISTICS_API}/users/${user.id}`);
      setConfirmDelete(null);
      notifySuccess(`${user.name} removed.`);
      router.reload({ only: ['users'] });
    } catch (err) {
      notifyError(err.response?.data?.message || 'Could not remove the user.');
    } finally {
      setDeleting(false);
    }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    try {
      await axios.post(`${LOGISTICS_API}/users/${confirmReset.id}/reset-password`, {
        password: resetValue,
      });

      notifySuccess(`Password reset for ${confirmReset.name}.`);
      setConfirmReset(null);
      setResetValue('');
    } catch (err) {
      if (err.response?.status === 422) {
        setErrors(err.response.data?.errors || {});
      } else {
        notifyError(err.response?.data?.message || 'Could not reset the password.');
      }
    } finally {
      setSaving(false);
    }
  };

  const selectedLocation = locations.find((l) => String(l.id) === String(form.location_id));

  // Hub staff handle traffic to and from every spoke, so they may default to
  // any stop in the network. Spoke staff work one bus stand in one town.
  const stopGroups = selectedLocation?.is_central
    ? locations
        .map((l) => ({ location: l, stops: stopsByLocation?.[l.id] || [] }))
        .filter((g) => g.stops.length > 0)
    : [{ location: selectedLocation, stops: stopsByLocation?.[form.location_id] || [] }];

  const fieldError = (name) => errors[name]?.[0];

  return (
    <AppLayout title="Logistics" description="Logistics staff accounts">
      <LogisticsTabs active="/logistics/users" />

      <div className="mx-auto max-w-[1400px] p-3 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[#E5E5E5] bg-white p-4">
          <div className="relative min-w-[200px] flex-1">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-[#717783]">
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or mobile"
              className="w-full rounded-md border border-[#E5E5E5] bg-[#f4f4f2] py-1.5 pl-9 pr-3 text-xs outline-none focus:border-[#005EA4] focus:ring-1 focus:ring-[#005EA4]"
            />
          </div>

          <select
            value={filters.location_id || ''}
            onChange={(e) => applyFilters({ location_id: e.target.value })}
            className="rounded-md border border-[#E5E5E5] bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#005EA4]"
          >
            <option value="">All locations</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>

          <select
            value={filters.role || ''}
            onChange={(e) => applyFilters({ role: e.target.value })}
            className="rounded-md border border-[#E5E5E5] bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#005EA4]"
          >
            <option value="">All roles</option>
            <option value="central">Central</option>
            <option value="spoke">Spoke</option>
          </select>

          <select
            value={filters.active ?? ''}
            onChange={(e) => applyFilters({ active: e.target.value })}
            className="rounded-md border border-[#E5E5E5] bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#005EA4]"
          >
            <option value="">Any status</option>
            <option value="1">Active</option>
            <option value="0">Inactive</option>
          </select>

          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-1 rounded-md bg-[#005EA4] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#004F8A] cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">add</span>
            Add User
          </button>
        </div>

        <div className="rounded-xl border border-[#E5E5E5] bg-white">
          {rows.length === 0 ? (
            <EmptyState
              icon="badge"
              message="No logistics users match these filters."
              action={
                <button
                  type="button"
                  onClick={openCreate}
                  className="rounded-md bg-[#005EA4] px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
                >
                  Add User
                </button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[840px] text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E5E5E5] bg-[#F9F9F7]">
                    {['Name', 'Mobile', 'Location', 'Role', 'Default Stop', 'Active', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-[#666666]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((u) => (
                    <tr key={u.id} className="border-b border-[#F0F0F0] last:border-0 hover:bg-[#F9F9F7]">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#005EA4] text-[10px] font-bold text-white">
                            {initials(u.name)}
                          </span>
                          <span className="font-medium text-[#0B0B0B]">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[#666666]">+91 {u.mobile}</td>
                      <td className="px-4 py-2.5 text-[#0B0B0B]">{u.location_name}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={
                            u.is_central
                              ? { backgroundColor: '#F0F7FF', color: '#005EA4' }
                              : { backgroundColor: '#F4F4F2', color: '#666666' }
                          }
                        >
                          {u.is_central ? 'Central' : 'Spoke'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[#666666]">{u.default_stop?.name || '-'}</td>
                      <td className="px-4 py-2.5">
                        <Toggle
                          checked={u.is_active}
                          onToggle={() => toggleStatus(u)}
                          label={`Toggle ${u.name}`}
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(u)}
                            aria-label={`Edit ${u.name}`}
                            className="rounded-md p-1 text-[#666666] transition-colors hover:bg-[#F0F7FF] hover:text-[#005EA4] cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-base">edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmReset(u);
                              setResetValue('');
                              setErrors({});
                            }}
                            aria-label={`Reset password for ${u.name}`}
                            className="rounded-md p-1 text-[#666666] transition-colors hover:bg-[#FFF8E6] hover:text-[#CC8400] cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-base">lock_reset</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(u)}
                            aria-label={`Remove ${u.name}`}
                            className="rounded-md p-1 text-[#666666] transition-colors hover:bg-[#FFE6E6] hover:text-[#D03B3B] cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {meta.total > 0 && (
            <div className="border-t border-[#E5E5E5] px-4 py-2.5 text-[11px] text-[#666666]">
              Showing {meta.from || 0}–{meta.to || 0} of {meta.total}
            </div>
          )}
        </div>
      </div>

      {/* Add / edit */}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Add logistics user' : `Edit ${editing?.name || ''}`}
        subtitle="A user belongs to exactly one location."
        footer={
          <>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded-md border border-[#E5E5E5] px-3 py-1.5 text-xs text-[#666666] transition-colors hover:bg-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="logistics-user-form"
              disabled={saving}
              className="rounded-md bg-[#005EA4] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#004F8A] disabled:opacity-60 cursor-pointer"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <form id="logistics-user-form" onSubmit={submit} className="space-y-3">
          <div>
            <label htmlFor="lu-name" className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.05em] text-[#666666]">
              Name
            </label>
            <input
              id="lu-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-md border border-[#E5E5E5] px-2.5 py-1.5 text-xs outline-none focus:border-[#005EA4] focus:ring-1 focus:ring-[#005EA4]"
            />
            {fieldError('name') && <p className="mt-1 text-[11px] text-[#D03B3B]">{fieldError('name')}</p>}
          </div>

          <div>
            <label htmlFor="lu-mobile" className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.05em] text-[#666666]">
              Mobile (login identity)
            </label>
            <div className="flex items-center gap-1.5">
              <span className="rounded-md bg-[#f4f4f2] px-2 py-1.5 font-mono text-xs text-[#666666]">+91</span>
              <input
                id="lu-mobile"
                type="text"
                inputMode="numeric"
                maxLength={10}
                value={form.mobile}
                onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, '') })}
                className="w-full rounded-md border border-[#E5E5E5] px-2.5 py-1.5 font-mono text-xs outline-none focus:border-[#005EA4] focus:ring-1 focus:ring-[#005EA4]"
              />
            </div>
            {fieldError('mobile') && <p className="mt-1 text-[11px] text-[#D03B3B]">{fieldError('mobile')}</p>}
          </div>

          {editing === 'new' && (
            <div>
              <label htmlFor="lu-password" className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.05em] text-[#666666]">
                Password
              </label>
              <input
                id="lu-password"
                type="text"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full rounded-md border border-[#E5E5E5] px-2.5 py-1.5 text-xs outline-none focus:border-[#005EA4] focus:ring-1 focus:ring-[#005EA4]"
              />
              {fieldError('password') && <p className="mt-1 text-[11px] text-[#D03B3B]">{fieldError('password')}</p>}
            </div>
          )}

          <div>
            <label htmlFor="lu-location" className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.05em] text-[#666666]">
              Location
            </label>
            <select
              id="lu-location"
              value={form.location_id}
              onChange={(e) => onLocationChange(e.target.value)}
              className="w-full rounded-md border border-[#E5E5E5] px-2.5 py-1.5 text-xs outline-none focus:border-[#005EA4]"
            >
              <option value="">Select a location</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                  {l.is_central ? ' (Central)' : ''}
                </option>
              ))}
            </select>
            {fieldError('location_id') && <p className="mt-1 text-[11px] text-[#D03B3B]">{fieldError('location_id')}</p>}
          </div>

          <div>
            <label htmlFor="lu-stop" className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.05em] text-[#666666]">
              Default stop
            </label>
            <select
              id="lu-stop"
              value={form.default_stop_id}
              onChange={(e) => setForm({ ...form, default_stop_id: e.target.value })}
              disabled={!form.location_id}
              className="w-full rounded-md border border-[#E5E5E5] px-2.5 py-1.5 text-xs outline-none focus:border-[#005EA4] disabled:bg-[#f4f4f2]"
            >
              <option value="">None</option>
              {selectedLocation?.is_central
                ? stopGroups.map((group) => (
                    <optgroup key={group.location.id} label={group.location.name}>
                      {group.stops.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </optgroup>
                  ))
                : stopGroups[0]?.stops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
            </select>
            {fieldError('default_stop_id') && (
              <p className="mt-1 text-[11px] text-[#D03B3B]">{fieldError('default_stop_id')}</p>
            )}
            {selectedLocation?.is_central && (
              <p className="mt-1 text-[10px] text-[#999999]">
                Hub staff can default to any bus stand in the network, not only {selectedLocation.name}'s.
              </p>
            )}
          </div>

          <div className="space-y-2 rounded-md bg-[#F9F9F7] p-3">
            <label className="flex items-center gap-2 text-xs text-[#0B0B0B]">
              <input
                type="checkbox"
                checked={form.is_central}
                disabled={!selectedLocation?.is_central}
                onChange={(e) => setForm({ ...form, is_central: e.target.checked })}
                className="h-3.5 w-3.5 accent-[#005EA4]"
              />
              Central user
              {!selectedLocation?.is_central && (
                <span className="text-[10px] text-[#999999]">— only available at the central location</span>
              )}
            </label>
            {fieldError('is_central') && <p className="text-[11px] text-[#D03B3B]">{fieldError('is_central')}</p>}

            <p className="text-[10px] text-[#999999]">
              These are field accounts for the mobile app. Administration happens here in the web panel, under your
              Service Management login.
            </p>
          </div>
        </form>
      </Modal>

      {/* Reset password */}
      <Modal
        open={!!confirmReset}
        onClose={() => setConfirmReset(null)}
        title={`Reset password for ${confirmReset?.name || ''}`}
        subtitle="This immediately signs the user out of the mobile app."
        footer={
          <>
            <button
              type="button"
              onClick={() => setConfirmReset(null)}
              className="rounded-md border border-[#E5E5E5] px-3 py-1.5 text-xs text-[#666666] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="reset-password-form"
              disabled={saving}
              className="rounded-md bg-[#D03B3B] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 cursor-pointer"
            >
              {saving ? 'Saving…' : 'Reset password'}
            </button>
          </>
        }
      >
        <form id="reset-password-form" onSubmit={resetPassword}>
          <label
            htmlFor="reset-password"
            className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.05em] text-[#666666]"
          >
            New password
          </label>
          <input
            id="reset-password"
            type="text"
            autoComplete="off"
            value={resetValue}
            onChange={(e) => setResetValue(e.target.value)}
            placeholder="At least 6 characters"
            className="w-full rounded-md border border-[#E5E5E5] px-2.5 py-1.5 font-mono text-xs outline-none focus:border-[#005EA4] focus:ring-1 focus:ring-[#005EA4]"
          />
          {fieldError('password') && <p className="mt-1 text-[11px] text-[#D03B3B]">{fieldError('password')}</p>}

          <p className="mt-2 text-[10px] text-[#999999]">
            Shown as you type, so you can read it out to{' '}
            <strong className="text-[#666666]">{confirmReset?.name}</strong>. It is not stored anywhere you can read it
            back — note it down before closing.
          </p>
        </form>
      </Modal>

      {/* Remove user */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title={`Remove ${confirmDelete?.name || ''}?`}
        subtitle="They will be signed out and can no longer log in."
        footer={
          <>
            <button
              type="button"
              onClick={() => setConfirmDelete(null)}
              className="rounded-md border border-[#E5E5E5] px-3 py-1.5 text-xs text-[#666666] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={() => deleteUser(confirmDelete)}
              className="rounded-md bg-[#D03B3B] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 cursor-pointer"
            >
              {deleting ? 'Removing…' : 'Remove user'}
            </button>
          </>
        }
      >
        <p className="text-xs text-[#666666]">
          <strong className="text-[#0B0B0B]">{confirmDelete?.name}</strong> ({confirmDelete?.location_name}) will be
          removed from the list and will not be able to sign in to the mobile app.
        </p>
        <p className="mt-2 text-[11px] text-[#666666]">
          Dispatches they sent or received are kept, and still show their name — the history stays intact. If you only
          want to stop them signing in for now, use the Active switch instead.
        </p>
      </Modal>

    </AppLayout>
  );
}
