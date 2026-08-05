import React from 'react';
import { Link } from '@inertiajs/react';
import AppLayout from '../../Layouts/AppLayout';
import LogisticsTabs from '../../Components/Logistics/LogisticsTabs';
import StatusPill from '../../Components/Logistics/StatusPill';
import EmptyState from '../../Components/Logistics/EmptyState';
import { formatDate } from '../../utils/formatters';

function StatTile({ label, value, icon, accent = '#005EA4', href, danger = false }) {
  const body = (
    <div
      className={`rounded-xl border bg-white p-4 transition-colors ${
        danger && value > 0 ? 'border-[#F0C4C4]' : 'border-[#E5E5E5]'
      } ${href ? 'hover:border-[#005EA4] cursor-pointer' : ''}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#666666]">{label}</span>
        <span className="material-symbols-outlined text-lg" style={{ color: accent }}>
          {icon}
        </span>
      </div>
      <p className="text-2xl font-semibold" style={{ color: danger && value > 0 ? '#D03B3B' : '#0B0B0B' }}>
        {value}
      </p>
    </div>
  );

  return href ? <Link href={href}>{body}</Link> : body;
}

export default function LogisticsDashboard({ stats, perLocation, recentDispatches }) {
  return (
    <AppLayout title="Logistics" description="Bus parcel tracking between Ranchi and the spoke locations">
      <LogisticsTabs active="/logistics" />

      <div className="mx-auto max-w-[1400px] p-3 sm:p-6">
        <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Total Dispatches" value={stats.total} icon="inventory_2" />
          <StatTile label="Pending" value={stats.pending} icon="schedule" accent="#CC8400" href="/logistics/dispatches?status=pending" />
          <StatTile label="Received Today" value={stats.received_today} icon="check_circle" accent="#0D7C59" />
          <StatTile
            label="Not Received"
            value={stats.not_received}
            icon="report_problem"
            accent="#D03B3B"
            danger
            href="/logistics/dispatches?status=not_received"
          />
        </div>

        <div className="mb-3 rounded-xl border border-[#E5E5E5] bg-white">
          <div className="border-b border-[#E5E5E5] px-4 py-3">
            <h3 className="text-[13px] font-semibold text-[#0B0B0B]">Per-location breakdown</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-xs">
              <thead>
                <tr className="border-b border-[#E5E5E5] bg-[#F9F9F7]">
                  {['Location', 'Sent', 'Pending', 'Received', 'Not Received'].map((h) => (
                    <th key={h} className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-[#666666]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {perLocation.map((row) => (
                  <tr key={row.location_id} className="border-b border-[#F0F0F0] last:border-0">
                    <td className="px-4 py-2.5 font-medium text-[#0B0B0B]">
                      {row.location}
                      {row.is_central && (
                        <span className="ml-2 rounded-full bg-[#F0F7FF] px-2 py-0.5 text-[10px] font-semibold text-[#005EA4]">
                          Central
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-[#666666]">{row.sent}</td>
                    <td className="px-4 py-2.5 text-[#CC8400]">{row.pending}</td>
                    <td className="px-4 py-2.5 text-[#0D7C59]">{row.received}</td>
                    <td className={`px-4 py-2.5 ${row.not_received > 0 ? 'font-semibold text-[#A01F1F]' : 'text-[#666666]'}`}>
                      {row.not_received}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-[#E5E5E5] bg-white">
          <div className="flex items-center justify-between border-b border-[#E5E5E5] px-4 py-3">
            <h3 className="text-[13px] font-semibold text-[#0B0B0B]">Recent dispatches</h3>
            <Link href="/logistics/dispatches" className="text-[11px] font-semibold text-[#005EA4] hover:underline">
              View all
            </Link>
          </div>

          {recentDispatches.length === 0 ? (
            <EmptyState icon="inventory_2" message="No dispatches recorded yet." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E5E5E5] bg-[#F9F9F7]">
                    {['Reference', 'Sender', 'Receiver', 'Route', 'Date', 'Status'].map((h) => (
                      <th key={h} className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-[#666666]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentDispatches.map((d) => (
                    <tr key={d.id} className="border-b border-[#F0F0F0] last:border-0 hover:bg-[#F9F9F7]">
                      <td className="px-4 py-2.5">
                        <Link href={`/logistics/dispatches/${d.id}`} className="font-mono font-semibold text-[#005EA4] hover:underline">
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
                      <td className="px-4 py-2.5 text-[#666666]">{formatDate(d.dispatch_date)}</td>
                      <td className="px-4 py-2.5">
                        <StatusPill status={d.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
