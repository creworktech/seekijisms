import React, { useState } from 'react';
import { Link } from '@inertiajs/react';
import { motion, AnimatePresence } from 'framer-motion';
import AppLayout from '../../Layouts/AppLayout';
import LogisticsTabs from '../../Components/Logistics/LogisticsTabs';
import StatusPill from '../../Components/Logistics/StatusPill';
import { formatDate, formatDateTime } from '../../utils/formatters';
import { formatTime } from '../../utils/logistics';

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

export default function DispatchDetail({ dispatch }) {
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
                <Field label="Bus Number" value={dispatch.bus_number} mono />
                <Field label="From Stop" value={dispatch.from_stop?.name} />
                <Field label="To Stop" value={dispatch.to_stop?.name} />
                <Field label="Quantity" value={dispatch.quantity} />
                {/* Both times describe the bus at the pickup stand. */}
                <Field
                  label="Bus In Time"
                  value={`${formatTime(dispatch.bus_reach_time)}${
                    dispatch.from_stop?.name ? ` at ${dispatch.from_stop.name}` : ''
                  }`}
                />
                <Field
                  label="Bus Out Time"
                  value={`${formatTime(dispatch.bus_leave_time)}${
                    dispatch.from_stop?.name ? ` from ${dispatch.from_stop.name}` : ''
                  }`}
                />
                <Field label="Driver Mobile" value={dispatch.driver_mobile} mono />
                <Field label="Receiver Mobile" value={dispatch.receiver_mobile} mono />
                <div className="col-span-2 sm:col-span-3">
                  <Field label="Item Description" value={dispatch.item_description} />
                </div>
                {dispatch.remarks && (
                  <div className="col-span-2 sm:col-span-3">
                    <Field label="Remarks" value={dispatch.remarks} />
                  </div>
                )}
              </dl>
            </div>

            <div className="space-y-4 rounded-xl border border-[#E5E5E5] bg-white p-4">
              <h3 className="text-[13px] font-semibold text-[#0B0B0B]">Photographic evidence</h3>
              <PhotoGroup title="Bus Photos" photos={photos.bus || []} onOpen={setLightbox} />
              <PhotoGroup title="Package Photos" photos={photos.package || []} onOpen={setLightbox} />
              <PhotoGroup title="Receipt Photo" photos={photos.receipt || []} onOpen={setLightbox} />
            </div>
          </div>

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
              Read-only. Admins observe dispatches; only the receiving side can change a status.
            </p>
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
