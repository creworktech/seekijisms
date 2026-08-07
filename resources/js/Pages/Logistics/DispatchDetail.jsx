import React, { useMemo, useState } from 'react';
import { Link, router } from '@inertiajs/react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import AppLayout from '../../Layouts/AppLayout';
import LogisticsTabs from '../../Components/Logistics/LogisticsTabs';
import StatusPill from '../../Components/Logistics/StatusPill';
import { notifySuccess, notifyError } from '../../utils/toast';
import { formatDate, formatDateTime } from '../../utils/formatters';
import { formatTime, LOGISTICS_API } from '../../utils/logistics';

function Field({ label, value, mono = false }) {
  return (
    <div>
      <dt className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-[#666666]">{label}</dt>
      <dd className={`text-xs text-[#0B0B0B] ${mono ? 'font-mono' : ''}`}>{value || '-'}</dd>
    </div>
  );
}

function PhotoGroup({ title, photos, onOpen }) {
  return (
    <div>
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-[#666666]">
        {title} <span className="text-[#999999]">({photos.length})</span>
      </h4>
      {photos.length === 0 ? (
        <p className="text-[11px] text-[#999999]">None</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {photos.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onOpen(p)}
              aria-label={`Open ${title} photo`}
              className="h-20 w-20 overflow-hidden rounded-lg border border-[#E5E5E5] transition-colors hover:border-[#005EA4] cursor-pointer"
            >
              <img src={p.thumb_url} alt={title} className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Lets an admin confirm receipt on behalf of whichever logistics user
 * physically has the package — mirrors the mobile confirm flow, since the
 * admin's own account isn't a LogisticsUser and can't act as one directly.
 */
function ReceiveActionCard({ dispatch, logisticsUsers }) {
  const [actingUserId, setActingUserId] = useState('');
  const [action, setAction] = useState('received');
  const [note, setNote] = useState('');
  const [receiptPhoto, setReceiptPhoto] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const receiptPreview = useMemo(
    () => (receiptPhoto ? URL.createObjectURL(receiptPhoto) : null),
    [receiptPhoto]
  );

  // Rule 6: the sender never confirms. Anyone else active at the receiver's
  // own location may — the first to confirm wins, and who did is logged.
  const eligibleUsers = (logisticsUsers || []).filter(
    (u) => u.location_id === dispatch.receiver?.location_id && u.id !== dispatch.sender?.id
  );

  const submit = async () => {
    const newErrors = {};
    if (!actingUserId) newErrors.acting_user_id = 'Choose who is confirming this.';
    if (action === 'not_received' && note.trim().length < 5) {
      newErrors.note = 'Give a reason of at least 5 characters.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);

    const payload = new FormData();
    payload.append('acting_user_id', actingUserId);
    payload.append('action', action);
    if (note.trim()) payload.append('note', note.trim());
    if (receiptPhoto) payload.append('receipt_photo', receiptPhoto);

    try {
      const res = await axios.post(`${LOGISTICS_API}/dispatches/${dispatch.id}/receive`, payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      notifySuccess(res.data?.message || 'Dispatch updated.');
      router.reload({ only: ['dispatch'] });
    } catch (err) {
      if (err.response?.status === 422 && err.response?.data?.errors) {
        setErrors(Object.fromEntries(Object.entries(err.response.data.errors).map(([k, v]) => [k, v[0]])));
      }
      notifyError(err.response?.data?.message || 'Could not update the dispatch.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border-2 border-[#005EA4] bg-white p-4">
      <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-[#005EA4]">
        <span className="material-symbols-outlined text-base">bolt</span>
        Confirm On Behalf Of
      </h3>

      <div>
        <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#666666]">
          Confirming User *
        </label>
        <select
          value={actingUserId}
          onChange={(e) => {
            setActingUserId(e.target.value);
            setErrors((er) => ({ ...er, acting_user_id: null }));
          }}
          className={`w-full rounded-md border bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#005EA4] ${
            errors.acting_user_id ? 'border-[#D03B3B]' : 'border-[#E5E5E5]'
          }`}
        >
          <option value="">Select who has the package</option>
          {eligibleUsers.map((u) => (
            <option key={u.id} value={u.id}>{u.name} · {u.location_name}</option>
          ))}
        </select>
        {errors.acting_user_id && <p className="mt-1 text-[11px] font-semibold text-[#D03B3B]">{errors.acting_user_id}</p>}
        {eligibleUsers.length === 0 && (
          <p className="mt-1 text-[11px] text-[#999999]">No active user at the receiving location.</p>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setAction('received')}
          className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-semibold cursor-pointer ${
            action === 'received' ? 'border-[#0D7C59] bg-[#E6F7F0] text-[#0D7C59]' : 'border-[#E5E5E5] text-[#666666]'
          }`}
        >
          Received
        </button>
        <button
          type="button"
          onClick={() => setAction('not_received')}
          className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-semibold cursor-pointer ${
            action === 'not_received' ? 'border-[#D03B3B] bg-[#FFE6E6] text-[#D03B3B]' : 'border-[#E5E5E5] text-[#666666]'
          }`}
        >
          Not Received
        </button>
      </div>

      {action === 'not_received' && (
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#666666]">Reason *</label>
          <input
            type="text"
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setErrors((er) => ({ ...er, note: null }));
            }}
            placeholder="Why wasn't it received?"
            className={`w-full rounded-md border bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#005EA4] ${
              errors.note ? 'border-[#D03B3B]' : 'border-[#E5E5E5]'
            }`}
          />
          {errors.note && <p className="mt-1 text-[11px] font-semibold text-[#D03B3B]">{errors.note}</p>}
        </div>
      )}

      <div>
        <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#666666]">
          Receipt Photo (optional)
        </label>
        {receiptPreview ? (
          <div className="relative h-20 w-20">
            <img src={receiptPreview} alt="" className="h-full w-full rounded-lg border border-[#E5E5E5] object-cover" />
            <button
              type="button"
              onClick={() => setReceiptPhoto(null)}
              className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white cursor-pointer"
              aria-label="Remove photo"
            >
              <span className="material-symbols-outlined text-xs">close</span>
            </button>
          </div>
        ) : (
          <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[#C9C9C9] text-[#999999] hover:border-[#005EA4] hover:text-[#005EA4]">
            <span className="material-symbols-outlined text-lg">add_a_photo</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setReceiptPhoto(e.target.files?.[0] || null)}
            />
          </label>
        )}
      </div>

      <button
        type="button"
        disabled={submitting || eligibleUsers.length === 0}
        onClick={submit}
        className="w-full rounded-md bg-[#005EA4] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60 cursor-pointer"
      >
        {submitting ? 'Submitting…' : action === 'received' ? 'Confirm Received' : 'Confirm Not Received'}
      </button>
    </div>
  );
}

export default function DispatchDetail({ dispatch, logisticsUsers = [] }) {
  const [lightbox, setLightbox] = useState(null);
  const photos = dispatch.photos || { bus: [], package: [], receipt: [] };
  const events = dispatch.events || [];

  return (
    <AppLayout title="Logistics" description={`Dispatch ${dispatch.reference_no}`}>
      <LogisticsTabs active="/logistics/dispatches" />

      <div className="mx-auto max-w-[1400px] p-3 sm:p-6">
        <Link
          href="/logistics/dispatches"
          className="mb-3 inline-flex items-center gap-1 text-[11px] font-semibold text-[#005EA4] hover:underline"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Back to dispatches
        </Link>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E5E5E5] bg-white p-4">
          <div className="flex items-center gap-3">
            <h2 className="font-mono text-lg font-semibold text-[#0B0B0B]">{dispatch.reference_no}</h2>
            <StatusPill status={dispatch.status} showIcon size="lg" />
          </div>
          <p className="text-xs text-[#666666]">Dispatched {formatDate(dispatch.dispatch_date)}</p>
        </div>

        {dispatch.status === 'not_received' && (
          <div className="mb-3 rounded-xl border border-[#F5D9A8] bg-[#FFF8E6] p-4">
            <div className="mb-1 flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-[#CC8400]">report_problem</span>
              <h3 className="text-[13px] font-semibold text-[#8A5A00]">Package not collected</h3>
            </div>
            <p className="text-xs text-[#8A5A00]">{dispatch.receipt_note}</p>
            <p className="mt-1 text-[11px] text-[#A67C1A]">
              Reported by {dispatch.received_by?.name || 'unknown'}
              {dispatch.received_at ? ` on ${formatDateTime(dispatch.received_at)}` : ''}
            </p>
          </div>
        )}

        <div className="grid gap-3 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
              <h3 className="mb-3 text-[13px] font-semibold text-[#0B0B0B]">Dispatch details</h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                <Field label="Sender" value={`${dispatch.sender?.name || '-'} (${dispatch.sender?.location_name || '-'})`} />
                <Field label="Receiver" value={`${dispatch.receiver?.name || '-'} (${dispatch.receiver?.location_name || '-'})`} />
                <Field label="From Stop" value={dispatch.from_stop?.name} />
                <Field label="To Stop" value={dispatch.to_stop?.name} />
                <Field label="Quantity" value={dispatch.quantity} />
                {/* Describes the bus at the pickup stand. */}
                <Field
                  label="Bus In Time"
                  value={`${formatTime(dispatch.bus_reach_time)}${
                    dispatch.from_stop?.name ? ` at ${dispatch.from_stop.name}` : ''
                  }`}
                />
                <Field label="Driver Mobile" value={dispatch.driver_mobile} mono />
              </dl>
            </div>

            <div className="space-y-4 rounded-xl border border-[#E5E5E5] bg-white p-4">
              <h3 className="text-[13px] font-semibold text-[#0B0B0B]">Photographic evidence</h3>
              <PhotoGroup title="Bus Photos" photos={photos.bus || []} onOpen={setLightbox} />
              <PhotoGroup title="Package Photos" photos={photos.package || []} onOpen={setLightbox} />
              <PhotoGroup title="Receipt Photo" photos={photos.receipt || []} onOpen={setLightbox} />
            </div>
          </div>

          <div className="space-y-3">
            {dispatch.status === 'pending' && (
              <ReceiveActionCard dispatch={dispatch} logisticsUsers={logisticsUsers} />
            )}

            <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
              <h3 className="mb-3 text-[13px] font-semibold text-[#0B0B0B]">Event timeline</h3>

              <ol className="relative space-y-4 border-l border-[#E5E5E5] pl-4">
                {events.map((e, index) => {
                  const isLast = index === events.length - 1;

                  return (
                    <li key={e.id} className="relative">
                      <span
                        className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white ${
                          isLast ? 'bg-[#005EA4]' : 'bg-[#C9C9C9]'
                        }`}
                      />
                      <p className={`text-xs ${isLast ? 'font-semibold text-[#0B0B0B]' : 'text-[#0B0B0B]'}`}>{e.note}</p>
                      <p className="mt-0.5 text-[10px] text-[#666666]">
                        {e.user?.name || 'System'} · {formatDateTime(e.created_at)}
                      </p>
                    </li>
                  );
                })}
              </ol>

              <p className="mt-4 border-t border-[#E5E5E5] pt-3 text-[10px] text-[#999999]">
                {dispatch.status === 'pending'
                  ? 'Confirming here logs the admin action and the logistics user it was done on behalf of.'
                  : 'This dispatch has already been confirmed and can no longer change status.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {lightbox && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLightbox(null)}
              className="absolute inset-0 bg-slate-900/70"
            />
            <motion.img
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              src={lightbox.url}
              alt="Dispatch evidence"
              className="relative max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setLightbox(null)}
              aria-label="Close photo"
              className="absolute right-6 top-6 rounded-full bg-white/90 p-2 text-[#0B0B0B] transition-colors hover:bg-white cursor-pointer"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
