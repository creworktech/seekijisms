import React, { useEffect, useRef, useState } from 'react';
import { Link, router } from '@inertiajs/react';
import axios from 'axios';
import AppLayout from '../../Layouts/AppLayout';
import LogisticsTabs from '../../Components/Logistics/LogisticsTabs';
import StatusPill from '../../Components/Logistics/StatusPill';
import EmptyState from '../../Components/Logistics/EmptyState';
import Modal from '../../Components/Logistics/Modal';
import Pagination from '../../Components/Pagination';
import CreateDispatchModal from '../../Components/Logistics/CreateDispatchModal';
import { notifySuccess, notifyError } from '../../utils/toast';
import { formatDate } from '../../utils/formatters';
import { STATUS_FILTERS, formatTime, LOGISTICS_API } from '../../utils/logistics';

export default function Dispatches({ dispatches, locations, filters, logisticsUsers = [], stopsByLocation = {} }) {
  const [search, setSearch] = useState(filters.search || '');
  const firstRender = useRef(true);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const deleteDispatch = async () => {
    setDeleting(true);

    try {
      await axios.delete(`${LOGISTICS_API}/dispatches/${confirmDelete.id}`);
      notifySuccess(`${confirmDelete.reference_no} deleted.`);
      setConfirmDelete(null);
      router.reload({ only: ['dispatches'] });
    } catch (err) {
      notifyError(err.response?.data?.message || 'Could not delete the dispatch.');
    } finally {
      setDeleting(false);
    }
  };

  // Every filter round-trips to the server so pagination stays correct.
  const applyFilters = (next) => {
    router.get(
      '/logistics/dispatches',
      { ...filters, ...next },
      { preserveState: true, preserveScroll: true, replace: true },
    );
  };

  // Debounce the search box by 300ms.
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

  const rows = dispatches?.data || [];
  const meta = dispatches?.meta || {};
  const links = dispatches?.links || {};

  const hasActiveFilter =
    filters.search || filters.status || filters.from || filters.to || filters.location_id;

  return (
    <AppLayout title="Logistics" description="All dispatches across every location">
      <LogisticsTabs active="/logistics/dispatches" />

      <div className="mx-auto max-w-[1400px] p-3 sm:p-6">
        <div className="mb-3 flex items-center justify-end">
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-1.5 rounded-md bg-[#005EA4] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#004a85] cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">add</span>
            New Dispatch
          </button>
        </div>

        <div className="mb-3 rounded-xl border border-[#E5E5E5] bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-[#717783]">
                search
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search reference, sender or receiver"
                className="w-full rounded-md border border-[#E5E5E5] bg-[#f4f4f2] py-1.5 pl-9 pr-3 text-xs outline-none transition-all focus:border-[#005EA4] focus:ring-1 focus:ring-[#005EA4]"
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

            <input
              type="date"
              value={filters.from || ''}
              onChange={(e) => applyFilters({ from: e.target.value })}
              className="rounded-md border border-[#E5E5E5] bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#005EA4]"
              aria-label="From date"
            />
            <input
              type="date"
              value={filters.to || ''}
              onChange={(e) => applyFilters({ to: e.target.value })}
              className="rounded-md border border-[#E5E5E5] bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#005EA4]"
              aria-label="To date"
            />

            {hasActiveFilter && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  router.get('/logistics/dispatches', {}, { preserveScroll: true, replace: true });
                }}
                className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-[#666666] transition-colors hover:bg-[#f4f4f2] hover:text-[#0B0B0B] cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">close</span>
                Clear
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((s) => {
              const isActive = (filters.status || '') === s.value;

              return (
                <button
                  key={s.value || 'all'}
                  type="button"
                  onClick={() => applyFilters({ status: s.value })}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${isActive
                      ? 'bg-[#005EA4] text-white'
                      : 'bg-[#f4f4f2] text-[#666666] hover:bg-[#E9E9E7]'
                    }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-[#E5E5E5] bg-white">
          {rows.length === 0 ? (
            <EmptyState
              icon="inventory_2"
              message={hasActiveFilter ? 'No dispatches match these filters.' : 'No dispatches recorded yet.'}
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1120px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E5E5E5] bg-[#F9F9F7]">
                      {['Reference No', 'Sender', 'Receiver', 'Route', 'Qty', 'Bus In', 'Date', 'Status', 'Action'].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-[#666666]"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((d) => (
                      <tr
                        key={d.id}
                        className={`border-b border-[#F0F0F0] last:border-0 hover:bg-[#F9F9F7] ${d.status === 'not_received' ? 'border-l-[3px] border-l-[#D03B3B]' : ''
                          }`}
                      >
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/logistics/dispatches/${d.id}`}
                            className="font-mono font-semibold text-[#005EA4] hover:underline"
                          >
                            {d.reference_no}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-[#0B0B0B]">
                          {d.sender?.name}
                          <span className="block text-[10px] text-[#666666]">{d.sender?.location_name}</span>
                        </td>
                        <td className="px-4 py-2.5 text-[#0B0B0B]">
                          {d.receiver?.name}
                          <span className="block text-[10px] text-[#666666]">{d.receiver?.location_name}</span>
                        </td>
                        <td className="px-4 py-2.5 text-[#666666]">
                          {d.from_stop?.name} → {d.to_stop?.name}
                        </td>
                        <td className="px-4 py-2.5 text-[#0B0B0B]">×{d.quantity}</td>
                        {/* Bus arrival at the pickup stand. */}
                        <td className="px-4 py-2.5 whitespace-nowrap text-[#666666]">
                          {formatTime(d.bus_reach_time)}
                        </td>
                        <td className="px-4 py-2.5 text-[#666666]">{formatDate(d.dispatch_date)}</td>
                        <td className="px-4 py-2.5">
                          <StatusPill status={d.status} />
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1">
                            <Link
                              href={`/logistics/dispatches/${d.id}`}
                              aria-label={`View ${d.reference_no}`}
                              className="inline-flex rounded-md p-1 text-[#666666] transition-colors hover:bg-[#F0F7FF] hover:text-[#005EA4]"
                            >
                              <span className="material-symbols-outlined text-lg">visibility</span>
                            </Link>
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(d)}
                              aria-label={`Delete ${d.reference_no}`}
                              className="inline-flex rounded-md p-1 text-[#666666] transition-colors hover:bg-[#FFE6E6] hover:text-[#D03B3B] cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-lg">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Pagination data={dispatches} resourceName="dispatches" />
            </>
          )}
        </div>
      </div>

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title={`Delete ${confirmDelete?.reference_no || ''}?`}
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
              onClick={deleteDispatch}
              className="rounded-md bg-[#D03B3B] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 cursor-pointer"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </>
        }
      >
        <p className="text-xs text-[#666666]">
          <strong className="text-[#0B0B0B]">{confirmDelete?.reference_no}</strong> will be removed from the list,
          and its bus and package photos will be permanently deleted from storage.
        </p>
        <p className="mt-2 text-[11px] text-[#666666]">
          The reference number and its event history are kept for the audit trail — only the record's visibility and
          its photos are removed. This cannot be undone.
        </p>
      </Modal>

      <CreateDispatchModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => router.reload({ only: ['dispatches'] })}
        logisticsUsers={logisticsUsers}
        stopsByLocation={stopsByLocation}
      />
    </AppLayout>
  );
}
