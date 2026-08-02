// Currency formatter (INR ₹)
export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

// Date & time formatters
export const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

export const formatDateTime = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
};

// Stage configuration matching Seekoji design system
export const STAGES = {
  new: {
    k: 'new',
    label: 'New Jobs',
    icon: 'fiber_new',
    bar: '#005ea4',
    ic: '#005ea4',
    pbg: '#E6F0FF',
    ptx: '#3266AD',
    d: 'Added by Intake Coordinator. Assign a tester or cancel.',
  },
  testing: {
    k: 'testing',
    label: 'Under Testing',
    icon: 'electrical_services',
    bar: '#a855f7',
    ic: '#a855f7',
    pbg: '#faf5ff',
    ptx: '#7e22ce',
    d: 'With the tester. Record the test outcome.',
  },
  approval: {
    k: 'approval',
    label: 'Awaiting Approval',
    icon: 'pending_actions',
    bar: '#FFA500',
    ic: '#FFA500',
    pbg: '#FFE6D9',
    ptx: '#B84A1F',
    d: 'Fault found. Discuss the budget with the customer by phone, then mark the outcome.',
  },
  repair: {
    k: 'repair',
    label: 'Under Repair',
    icon: 'handyman',
    bar: '#facc15',
    ic: '#eab308',
    pbg: '#fefce8',
    ptx: '#a16207',
    d: 'Approved and with a technician. Record the repair result.',
  },
  pending: {
    k: 'pending',
    label: 'Pending',
    icon: 'schedule',
    bar: '#ec4899',
    ic: '#ec4899',
    pbg: '#fdf2f8',
    ptx: '#be185d',
    d: 'Work paused, usually a part is unavailable. Move back to work or cancel.',
  },
  completed: {
    k: 'completed',
    label: 'Completed / Payment',
    icon: 'paid',
    bar: '#006947',
    ic: '#006947',
    pbg: '#ecfdf5',
    ptx: '#065f46',
    d: 'Work finished. Collect payment, then release to delivery.',
  },
  ready: {
    k: 'ready',
    label: 'Ready for Delivery',
    icon: 'task_alt',
    bar: '#006876',
    ic: '#006876',
    pbg: '#ecfeff',
    ptx: '#155e75',
    d: 'Payment settled. Record how the item goes back to the customer.',
  },
  delivered: {
    k: 'delivered',
    label: 'Delivered',
    icon: 'local_shipping',
    bar: '#1BAF7A',
    ic: '#1BAF7A',
    pbg: '#f0fdf4',
    ptx: '#166534',
    d: 'Handed back to the customer. Job closed.',
  },
};

export const PRIORITIES = {
  high: { label: 'High', color: '#D03B3B' },
  medium: { label: 'Medium', color: '#FFA500' },
  low: { label: 'Low', color: '#1BAF7A' },
};

export const OUTCOMES = {
  ok_no_fault: { label: 'OK / No Fault', pbg: '#ecfeff', ptx: '#155e75', icon: 'check_circle' },
  work_done: { label: 'Work Done', pbg: '#ecfdf5', ptx: '#065f46', icon: 'build_circle' },
  not_repairable: { label: 'Not Repairable', pbg: '#fef2f2', ptx: '#991b1b', icon: 'report_problem' },
  not_approved: { label: 'Estimate Rejected', pbg: '#fff7ed', ptx: '#9a3412', icon: 'cancel' },
  cancelled: { label: 'Cancelled', pbg: '#fdf2f8', ptx: '#be185d', icon: 'block' },
};

export const hasPermission = (user, permissionName) => {
  if (!user) return false;
  if (user.roles && user.roles.includes('admin')) return true;
  return user.permissions && user.permissions.includes(permissionName);
};
