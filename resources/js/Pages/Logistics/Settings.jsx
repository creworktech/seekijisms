import React, { useState } from 'react';
import { router } from '@inertiajs/react';
import axios from 'axios';
import AppLayout from '../../Layouts/AppLayout';
import LogisticsTabs from '../../Components/Logistics/LogisticsTabs';
import Modal from '../../Components/Logistics/Modal';
import Toggle from '../../Components/Logistics/Toggle';
import EmptyState from '../../Components/Logistics/EmptyState';
import { notifySuccess, notifyError } from '../../utils/toast';
import { LOGISTICS_API } from '../../utils/logistics';

export default function LogisticsSettings({ locations, selectedLocationId, stops }) {
  const [locationModal, setLocationModal] = useState(null);
  const [stopModal, setStopModal] = useState(null);
  const [form, setForm] = useState({ name: '', is_central: false });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const selected = locations.find((l) => l.id === selectedLocationId);

  const selectLocation = (id) => {
    router.get('/logistics/settings', { location_id: id }, { preserveState: true, preserveScroll: true, replace: true });
  };

  const openLocation = (location) => {
    setLocationModal(location || 'new');
    setForm({ name: location?.name || '', is_central: !!location?.is_central });
    setErrors({});
  };

  const openStop = (stop) => {
    setStopModal(stop || 'new');
    setForm({ name: stop?.name || '', is_central: false });
    setErrors({});
  };

  const saveLocation = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    try {
      const payload = { name: form.name, is_central: form.is_central };

      if (locationModal === 'new') {
        await axios.post(`${LOGISTICS_API}/locations`, payload);
        notifySuccess(`${form.name} added.`);
      } else {
        await axios.put(`${LOGISTICS_API}/locations/${locationModal.id}`, payload);
        notifySuccess(`${form.name} updated.`);
      }

      setLocationModal(null);
      router.reload();
    } catch (err) {
      if (err.response?.status === 422) setErrors(err.response.data?.errors || {});
      else notifyError(err.response?.data?.message || 'Could not save the location.');
    } finally {
      setSaving(false);
    }
  };

  const saveStop = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    try {
      const payload = { name: form.name, location_id: selectedLocationId };

      if (stopModal === 'new') {
        await axios.post(`${LOGISTICS_API}/stops`, payload);
        notifySuccess(`${form.name} added.`);
      } else {
        await axios.put(`${LOGISTICS_API}/stops/${stopModal.id}`, payload);
        notifySuccess(`${form.name} updated.`);
      }

      setStopModal(null);
      router.reload();
    } catch (err) {
      if (err.response?.status === 422) setErrors(err.response.data?.errors || {});
      else notifyError(err.response?.data?.message || 'Could not save the stop.');
    } finally {
      setSaving(false);
    }
  };

  // Both toggles rethrow so the optimistic switch reverts when the server
  // refuses — a location with active users, or the last active stop.
  const toggleLocation = async (location) =>
    axios
      .patch(`${LOGISTICS_API}/locations/${location.id}/toggle-status`)
      .then((res) => {
        notifySuccess(res.data?.message || 'Location updated.');
        router.reload();
      })
      .catch((err) => {
        notifyError(err.response?.data?.message || 'Could not change the location.');
        throw err;
      });

  const toggleStop = async (stop) =>
    axios
      .patch(`${LOGISTICS_API}/stops/${stop.id}/toggle-status`)
      .then((res) => {
        notifySuccess(res.data?.message || 'Stop updated.');
        router.reload();
      })
      .catch((err) => {
        notifyError(err.response?.data?.message || 'Could not change the stop.');
        throw err;
      });

  const remove = async () => {
    const { kind, item } = confirmDelete;
    setDeleting(true);

    try {
      await axios.delete(`${LOGISTICS_API}/${kind === 'location' ? 'locations' : 'stops'}/${item.id}`);
      notifySuccess(`${item.name} deleted.`);
      setConfirmDelete(null);

      // A deleted location can no longer be the selected one.
      if (kind === 'location' && item.id === selectedLocationId) {
        router.get('/logistics/settings', {}, { replace: true });
      } else {
        router.reload();
      }
    } catch (err) {
      notifyError(err.response?.data?.message || 'Could not delete.');
    } finally {
      setDeleting(false);
    }
  };

  const fieldError = (name) => errors[name]?.[0];

  return (
    <AppLayout title="Logistics" description="Locations and bus stands">
      <LogisticsTabs active="/logistics/settings" />

      <div className="mx-auto max-w-[1400px] p-3 sm:p-6">
        <div className="mb-3 rounded-lg border border-[#E5E5E5] bg-[#F9F9F7] px-4 py-2.5">
          <p className="text-[11px] text-[#666666]">
            <span className="material-symbols-outlined mr-1 align-middle text-sm text-[#005EA4]">info</span>
            Deactivate to take something out of use while keeping it selectable in history. Delete only once nothing
            depends on it: a location needs no stops and no users, and a stop cannot be the last one at a location that
            still has active users. A location must keep at least one active stop, cannot be switched off while it has
            active users, and exactly one location may be central.
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {/* Locations */}
          <div className="rounded-xl border border-[#E5E5E5] bg-white">
            <div className="flex items-center justify-between border-b border-[#E5E5E5] px-4 py-3">
              <h3 className="text-[13px] font-semibold text-[#0B0B0B]">Locations</h3>
              <button
                type="button"
                onClick={() => openLocation(null)}
                className="flex items-center gap-1 rounded-md bg-[#005EA4] px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-[#004F8A] cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                Add Location
              </button>
            </div>

            <ul>
              {locations.map((l) => {
                const isSelected = l.id === selectedLocationId;

                return (
                  <li
                    key={l.id}
                    className={`flex items-center gap-2 border-b border-[#F0F0F0] px-4 py-2.5 last:border-0 ${
                      isSelected ? 'bg-[#F0F7FF]' : 'hover:bg-[#F9F9F7]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => selectLocation(l.id)}
                      className="flex flex-1 items-center gap-2 text-left cursor-pointer"
                    >
                      <span className={`text-xs ${isSelected ? 'font-semibold text-[#005EA4]' : 'text-[#0B0B0B]'}`}>
                        {l.name}
                      </span>
                      {l.is_central && (
                        <span className="rounded-full bg-[#F0F7FF] px-2 py-0.5 text-[10px] font-semibold text-[#005EA4]">
                          Central
                        </span>
                      )}
                      <span className="text-[10px] text-[#666666]">
                        {l.stops_count} stop{l.stops_count === 1 ? '' : 's'}
                      </span>
                      {l.active_users_count > 0 && (
                        <span className="text-[10px] text-[#666666]">· {l.active_users_count} active user(s)</span>
                      )}
                    </button>

                    <Toggle checked={l.is_active} onToggle={() => toggleLocation(l)} label={`Toggle ${l.name}`} />

                    <button
                      type="button"
                      onClick={() => openLocation(l)}
                      aria-label={`Edit ${l.name}`}
                      className="rounded-md p-1 text-[#666666] transition-colors hover:bg-white hover:text-[#005EA4] cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-base">edit</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setConfirmDelete({ kind: 'location', item: l })}
                      aria-label={`Delete ${l.name}`}
                      className="rounded-md p-1 text-[#666666] transition-colors hover:bg-[#FFE6E6] hover:text-[#D03B3B] cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Stops for the selected location */}
          <div className="rounded-xl border border-[#E5E5E5] bg-white">
            <div className="flex items-center justify-between border-b border-[#E5E5E5] px-4 py-3">
              <h3 className="text-[13px] font-semibold text-[#0B0B0B]">
                Stops {selected ? <span className="text-[#666666]">· {selected.name}</span> : ''}
              </h3>
              <button
                type="button"
                onClick={() => openStop(null)}
                disabled={!selectedLocationId}
                className="flex items-center gap-1 rounded-md bg-[#005EA4] px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-[#004F8A] disabled:opacity-40 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                Add Stop
              </button>
            </div>

            {stops.length === 0 ? (
              <EmptyState icon="signpost" message="This location has no stops yet." />
            ) : (
              <ul>
                {stops.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-2 border-b border-[#F0F0F0] px-4 py-2.5 last:border-0 hover:bg-[#F9F9F7]"
                  >
                    <span className="flex-1 text-xs text-[#0B0B0B]">{s.name}</span>

                    <Toggle checked={s.is_active} onToggle={() => toggleStop(s)} label={`Toggle ${s.name}`} />

                    <button
                      type="button"
                      onClick={() => openStop(s)}
                      aria-label={`Edit ${s.name}`}
                      className="rounded-md p-1 text-[#666666] transition-colors hover:bg-white hover:text-[#005EA4] cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-base">edit</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setConfirmDelete({ kind: 'stop', item: s })}
                      aria-label={`Delete ${s.name}`}
                      className="rounded-md p-1 text-[#666666] transition-colors hover:bg-[#FFE6E6] hover:text-[#D03B3B] cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title={`Delete ${confirmDelete?.item?.name || ''}?`}
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
              onClick={remove}
              className="rounded-md bg-[#D03B3B] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 cursor-pointer"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </>
        }
      >
        <p className="text-xs text-[#666666]">
          <strong className="text-[#0B0B0B]">{confirmDelete?.item?.name}</strong> will be removed from the{' '}
          {confirmDelete?.kind === 'location' ? 'locations list' : 'stops list'}.
        </p>
        <p className="mt-2 text-[11px] text-[#666666]">
          {confirmDelete?.kind === 'location'
            ? 'A location can only be deleted once it has no stops and no users. Past dispatches keep showing its name.'
            : 'Past dispatches keep showing this stop, so the history stays intact. Anyone using it as their default stop will simply have no default.'}
        </p>
      </Modal>

      <Modal
        open={locationModal !== null}
        onClose={() => setLocationModal(null)}
        title={locationModal === 'new' ? 'Add location' : `Edit ${locationModal?.name || ''}`}
        footer={
          <>
            <button
              type="button"
              onClick={() => setLocationModal(null)}
              className="rounded-md border border-[#E5E5E5] px-3 py-1.5 text-xs text-[#666666] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="location-form"
              disabled={saving}
              className="rounded-md bg-[#005EA4] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 cursor-pointer"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <form id="location-form" onSubmit={saveLocation} className="space-y-3">
          <div>
            <label htmlFor="loc-name" className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.05em] text-[#666666]">
              Location name
            </label>
            <input
              id="loc-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-md border border-[#E5E5E5] px-2.5 py-1.5 text-xs outline-none focus:border-[#005EA4] focus:ring-1 focus:ring-[#005EA4]"
            />
            {fieldError('name') && <p className="mt-1 text-[11px] text-[#D03B3B]">{fieldError('name')}</p>}
          </div>

          <label className="flex items-center gap-2 text-xs text-[#0B0B0B]">
            <input
              type="checkbox"
              checked={form.is_central}
              onChange={(e) => setForm({ ...form, is_central: e.target.checked })}
              className="h-3.5 w-3.5 accent-[#005EA4]"
            />
            Central hub
          </label>
          {fieldError('is_central') && <p className="text-[11px] text-[#D03B3B]">{fieldError('is_central')}</p>}
        </form>
      </Modal>

      <Modal
        open={stopModal !== null}
        onClose={() => setStopModal(null)}
        title={stopModal === 'new' ? `Add stop to ${selected?.name || ''}` : `Edit ${stopModal?.name || ''}`}
        footer={
          <>
            <button
              type="button"
              onClick={() => setStopModal(null)}
              className="rounded-md border border-[#E5E5E5] px-3 py-1.5 text-xs text-[#666666] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="stop-form"
              disabled={saving}
              className="rounded-md bg-[#005EA4] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 cursor-pointer"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <form id="stop-form" onSubmit={saveStop}>
          <label htmlFor="stop-name" className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.05em] text-[#666666]">
            Stop name
          </label>
          <input
            id="stop-name"
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-md border border-[#E5E5E5] px-2.5 py-1.5 text-xs outline-none focus:border-[#005EA4] focus:ring-1 focus:ring-[#005EA4]"
          />
          {fieldError('name') && <p className="mt-1 text-[11px] text-[#D03B3B]">{fieldError('name')}</p>}
        </form>
      </Modal>
    </AppLayout>
  );
}
