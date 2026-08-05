// Dispatch status configuration — the single source of truth for how a
// status looks anywhere in the logistics panel.
export const DISPATCH_STATUSES = {
  pending: {
    key: 'pending',
    label: 'Pending',
    bg: '#FFF8E6',
    text: '#CC8400',
    icon: 'schedule',
  },
  received: {
    key: 'received',
    label: 'Received',
    bg: '#E6F7F0',
    text: '#0D7C59',
    icon: 'check_circle',
  },
  not_received: {
    key: 'not_received',
    label: 'Not Received',
    bg: '#FFE6E6',
    text: '#A01F1F',
    icon: 'report_problem',
  },
};

export const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'received', label: 'Received' },
  { value: 'not_received', label: 'Not Received' },
];

export const statusConfig = (status) => DISPATCH_STATUSES[status] ?? DISPATCH_STATUSES.pending;

// Times arrive as H:i. Staff read 12-hour time, so render it that way.
export const formatTime = (time) => {
  if (!time) return '-';
  const [h, m] = String(time).split(':');
  const hour = parseInt(h, 10);
  if (Number.isNaN(hour)) return time;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${m ?? '00'} ${suffix}`;
};

export const initials = (name) =>
  (name || '')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '--';

export const LOGISTICS_API = '/api/v1/logistics/admin';
