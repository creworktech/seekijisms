import React, { useState } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import AppLayout from '../../Layouts/AppLayout';
import CreateCustomerModal from '../../Components/Customers/CreateCustomerModal';
import EditCustomerModal from '../../Components/Customers/EditCustomerModal';
import ShowCustomerDrawer from '../../Components/Customers/ShowCustomerDrawer';
import TableLoadingOverlay from '../../Components/Common/TableLoadingOverlay';
import axios from 'axios';
import { formatDate } from '../../utils/formatters';
import { exportCustomersToCSV, exportCustomersToPDF } from '../../utils/exportHelper';

export default function Customers({ customers, filters, sanctumToken }) {
  const { auth } = usePage().props;
  const isAdmin = auth?.user?.roles?.includes('admin');

  const [search, setSearch] = useState(filters?.search || '');
  const [status, setStatus] = useState(filters?.status || '');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);

  React.useEffect(() => {
    const unbindStart = router.on('start', () => setIsNavigating(true));
    const unbindFinish = router.on('finish', () => setIsNavigating(false));
    return () => {
      unbindStart();
      unbindFinish();
    };
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    router.get('/customers', { search, status }, { preserveState: true });
  };

  const handleStatusFilter = (newStatus) => {
    setStatus(newStatus);
    router.get('/customers', { search, status: newStatus }, { preserveState: true });
  };

  const handleToggleStatus = async (cust) => {
    try {
      const headers = sanctumToken ? { Authorization: `Bearer ${sanctumToken}` } : {};
      await axios.patch(`/api/v1/customers/${cust.id}/toggle-status`, {}, { headers });
      router.reload();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update customer status.');
    }
  };

  const customerList = customers?.data || [];
  const pagination = customers?.meta || {};

  return (
    <AppLayout title="Customer Management" description="Directory of B2B and retail customers, customer codes, contact details, active repair history, and ledger accounts.">
      <div className="p-4 space-y-4 w-full max-w-full">

        {/* HEADER */}
        <div className="flex justify-between items-start flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#0B0B0B]">Customer Management</h1>
            <p className="text-[#666666] text-xs mt-0.5">
              Manage client records, contact numbers, customer codes, and service job history.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => exportCustomersToCSV(customerList, `customers_directory_${new Date().toISOString().split('T')[0]}.csv`)}
              className="sk-btn sk-btn-outline cursor-pointer"
              title="Export CSV File"
            >
              <span className="material-symbols-outlined text-base">file_download</span>
              Export CSV
            </button>
            <button
              onClick={() => exportCustomersToPDF(customerList, 'Seekoji Electric - Customer Directory Report')}
              className="sk-btn sk-btn-outline cursor-pointer"
              title="Export PDF Report"
            >
              <span className="material-symbols-outlined text-base">picture_as_pdf</span>
              Export PDF
            </button>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="sk-btn sk-btn-primary cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">person_add</span>
              Register New Customer
            </button>
          </div>
        </div>

        {/* CARD CONTAINER */}
        <div className="sk-card relative">
          <TableLoadingOverlay loading={isNavigating} text="Loading customer records..." />

          {/* FILTER BAR */}
          <div className="flex justify-between items-center p-4 border-b border-[#E5E5E5] flex-wrap gap-3">
            <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[240px] max-w-[420px]">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#717783] text-base pointer-events-none">
                search
              </span>
              <input
                type="text"
                placeholder="Search by name, phone, code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[#f4f4f2] border border-[#E5E5E5] rounded-lg text-xs outline-none focus:border-[#005ea4]"
              />
            </form>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-[#666666] uppercase">Filter Status:</span>
              <button
                onClick={() => handleStatusFilter('')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${status === '' ? 'bg-[#005ea4] text-white' : 'bg-[#f4f4f2] text-[#666666] hover:bg-[#e5e5e0]'
                  }`}
              >
                All
              </button>
              <button
                onClick={() => handleStatusFilter('active')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${status === 'active' ? 'bg-[#1BAF7A] text-white' : 'bg-[#f4f4f2] text-[#666666] hover:bg-[#e5e5e0]'
                  }`}
              >
                Active
              </button>
              <button
                onClick={() => handleStatusFilter('inactive')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${status === 'inactive' ? 'bg-[#717783] text-white' : 'bg-[#f4f4f2] text-[#666666] hover:bg-[#e5e5e0]'
                  }`}
              >
                Inactive
              </button>
            </div>
          </div>

          {/* TABLE CONTAINER */}
          <div className="overflow-x-auto thin-sb">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#f9f9f7] border-b border-[#E5E5E5] text-[#666666] font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Customer Name & Code</th>
                  <th className="py-3.5 px-4">Mobile</th>
                  <th className="py-3.5 px-4">Address</th>
                  <th className="py-3.5 px-4">Dashboard Status</th>
                  <th className="py-3.5 px-4">Registered On</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5]">
                {customerList.length > 0 ? (
                  customerList.map((cust) => {
                    const initials = cust.name
                      ? cust.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
                      : 'CU';
                    return (
                      <tr key={cust.id} className="hover:bg-[#F9F9F9] transition-colors">

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#005ea4] text-white flex items-center justify-center font-bold text-xs shrink-0">
                              {initials}
                            </div>
                            <div>
                              <div className="font-bold text-[#0B0B0B]">{cust.name}</div>
                              <div className="sk-tok text-[11px]">{cust.customer_code}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-mono text-[#0B0B0B]">
                          {cust.mobile}
                        </td>

                        <td className="py-3.5 px-4 text-[#666666] max-w-xs truncate">
                          {cust.address || '-'}
                        </td>

                        <td className="py-3.5 px-4">
                          {cust.is_active ? (
                            <span className="sk-pill bg-emerald-50 text-emerald-700">Active</span>
                          ) : (
                            <span className="sk-pill bg-slate-100 text-slate-600">Inactive</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-[#666666]">
                          {formatDate(cust.registered_on || cust.created_at)}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Eye icon button to view details */}
                            <button
                              onClick={() => setSelectedCustomer(cust)}
                              className="p-1.5 rounded-lg hover:bg-[#F0F7FF] text-[#005ea4] transition-colors cursor-pointer"
                              title="View Details & Job History"
                            >
                              <span className="material-symbols-outlined text-xl">visibility</span>
                            </button>

                            {/* Edit Customer button for Admin */}
                            {isAdmin && (
                              <button
                                onClick={() => setEditingCustomer(cust)}
                                className="p-1.5 rounded-lg hover:bg-[#F0F7FF] text-[#005ea4] transition-colors cursor-pointer"
                                title="Edit Customer Details"
                              >
                                <span className="material-symbols-outlined text-xl">edit</span>
                              </button>
                            )}

                            {/* Active/Inactive status toggle button for Admin only */}
                            {isAdmin && (
                              <button
                                onClick={() => handleToggleStatus(cust)}
                                className={`p-1 rounded-lg transition-colors flex items-center cursor-pointer ${cust.is_active ? 'text-[#1BAF7A] hover:bg-emerald-50' : 'text-[#717783] hover:bg-slate-100'
                                  }`}
                                title={cust.is_active ? 'Dashboard Active - Click to Hide' : 'Hidden - Click to Show on Dashboard'}
                              >
                                <span className="material-symbols-outlined text-2xl">
                                  {cust.is_active ? 'toggle_on' : 'toggle_off'}
                                </span>
                              </button>
                            )}
                          </div>
                        </td>

                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-[#666666]">
                      No customers found matching search criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* FOOTER PAGINATION */}
          <div className="flex justify-between items-center p-4 border-t border-[#E5E5E5] flex-wrap gap-3 text-xs text-[#666666]">
            <span>Showing <b>{customerList.length}</b> of <b>{pagination?.total || customerList.length}</b> customers (30 per page)</span>
            <div className="flex gap-1">
              {pagination?.prev ? (
                <Link href={pagination.prev} className="w-8 h-8 rounded border border-[#E5E5E5] bg-[#fff] flex items-center justify-center font-bold text-[#0B0B0B]">
                  &lsaquo;
                </Link>
              ) : (
                <button disabled className="w-8 h-8 rounded border border-[#E5E5E5] bg-white opacity-40 cursor-not-allowed font-bold">
                  &lsaquo;
                </button>
              )}
              <button className="w-8 h-8 rounded border border-[#005ea4] bg-[#005ea4] text-white font-bold">
                {pagination?.current_page || 1}
              </button>
              {pagination?.next ? (
                <Link href={pagination.next} className="w-8 h-8 rounded border border-[#E5E5E5] bg-white flex items-center justify-center font-bold text-[#0B0B0B]">
                  &rsaquo;
                </Link>
              ) : (
                <button disabled className="w-8 h-8 rounded border border-[#E5E5E5] bg-white opacity-40 cursor-not-allowed font-bold">
                  &rsaquo;
                </button>
              )}
            </div>
          </div>
        </div>

        {/* MODALS */}
        <CreateCustomerModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onSuccess={() => router.reload()}
          sanctumToken={sanctumToken}
        />

        <EditCustomerModal
          customer={editingCustomer}
          isOpen={!!editingCustomer}
          onClose={() => setEditingCustomer(null)}
          onSuccess={() => router.reload()}
          sanctumToken={sanctumToken}
        />

        <ShowCustomerDrawer
          customer={selectedCustomer}
          isOpen={!!selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          sanctumToken={sanctumToken}
          onEdit={(cust) => {
            setSelectedCustomer(null);
            setEditingCustomer(cust);
          }}
        />

      </div>
    </AppLayout>
  );
}
