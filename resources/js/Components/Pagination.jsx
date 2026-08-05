import React from 'react';
import { Link } from '@inertiajs/react';

/**
 * Universal Pagination Component for Seekoji SMS
 * Supports Laravel LengthAwarePaginator and JsonResource collection paginators.
 */
export default function Pagination({ data, meta: customMeta, resourceName = 'items' }) {
  const meta = customMeta || data?.meta || data || {};
  const linksArray = Array.isArray(meta.links)
    ? meta.links
    : Array.isArray(data?.links)
    ? data.links
    : null;

  const total = meta.total ?? (Array.isArray(data?.data) ? data.data.length : 0);
  const from = meta.from ?? (total > 0 ? 1 : 0);
  const to = meta.to ?? (Array.isArray(data?.data) ? data.data.length : 0);
  const currentPage = meta.current_page || 1;
  const lastPage = meta.last_page || (meta.per_page ? Math.ceil(total / meta.per_page) : 1);
  const perPage = meta.per_page || 30;

  // Don't render footer if there are no items
  if (total === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-t border-[#E5E5E5] bg-[#FAFBFD] text-xs text-[#666666]">
      <div>
        Showing <b className="text-[#0B0B0B]">{from}</b> to <b className="text-[#0B0B0B]">{to}</b> of{' '}
        <b className="text-[#0B0B0B]">{total}</b> {resourceName} ({perPage} per page)
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        {linksArray && linksArray.length > 0 ? (
          linksArray.map((link, idx) => {
            let label = link.label;
            if (label.includes('&laquo;') || label.toLowerCase().includes('previous')) {
              label = '‹';
            } else if (label.includes('&raquo;') || label.toLowerCase().includes('next')) {
              label = '›';
            }

            if (link.active) {
              return (
                <span
                  key={idx}
                  className="min-w-[32px] h-8 px-2.5 rounded border border-[#005EA4] bg-[#005EA4] text-white font-bold flex items-center justify-center text-xs shadow-sm"
                >
                  {label}
                </span>
              );
            }

            if (link.url) {
              return (
                <Link
                  key={idx}
                  href={link.url}
                  preserveState
                  preserveScroll
                  className="min-w-[32px] h-8 px-2.5 rounded border border-[#E5E5E5] bg-white text-[#0B0B0B] hover:bg-[#F0F7FF] hover:border-[#005EA4] hover:text-[#005EA4] flex items-center justify-center font-semibold text-xs transition-colors"
                  dangerouslySetInnerHTML={{ __html: label }}
                />
              );
            }

            return (
              <span
                key={idx}
                className="min-w-[32px] h-8 px-2.5 rounded border border-[#E5E5E5] bg-white opacity-40 text-[#666666] flex items-center justify-center font-bold text-xs cursor-not-allowed"
                dangerouslySetInnerHTML={{ __html: label }}
              />
            );
          })
        ) : lastPage > 1 ? (
          // Fallback if links array is not present but lastPage > 1
          Array.from({ length: lastPage }, (_, i) => i + 1).map((page) => {
            const isActive = page === currentPage;
            const url = `${window.location.pathname}?page=${page}`;

            if (isActive) {
              return (
                <span
                  key={page}
                  className="min-w-[32px] h-8 px-2.5 rounded border border-[#005EA4] bg-[#005EA4] text-white font-bold flex items-center justify-center text-xs"
                >
                  {page}
                </span>
              );
            }

            return (
              <Link
                key={page}
                href={url}
                preserveState
                preserveScroll
                className="min-w-[32px] h-8 px-2.5 rounded border border-[#E5E5E5] bg-white text-[#0B0B0B] hover:bg-[#F0F7FF] hover:border-[#005EA4] flex items-center justify-center font-semibold text-xs"
              >
                {page}
              </Link>
            );
          })
        ) : (
          <span className="min-w-[32px] h-8 px-2.5 rounded border border-[#005EA4] bg-[#005EA4] text-white font-bold flex items-center justify-center text-xs">
            1
          </span>
        )}
      </div>
    </div>
  );
}
