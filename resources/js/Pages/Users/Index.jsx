import React, { useState } from 'react';
import { Link, router } from '@inertiajs/react';
import AppLayout from '../../Layouts/AppLayout';
import EditUserModal from '../../Components/Users/EditUserModal';
import TableLoadingOverlay from '../../Components/Common/TableLoadingOverlay';
import ConfirmActionModal from '../../Components/Common/ConfirmActionModal';
import axios from 'axios';
import { formatDate } from '../../utils/formatters';
import { notifySuccess, notifyError } from '../../utils/toast';

export default function Users({ users, roles = [], sanctumToken, auth }) {
  const currentUser = auth?.user;

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deleteModalData, setDeleteModalData] = useState(null);
  const [deletingUser, setDeletingUser] = useState(false);
  const [safetyAlert, setSafetyAlert] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'technician',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [isNavigating, setIsNavigating] = useState(false);

  React.useEffect(() => {
    const unbindStart = router.on('start', () => setIsNavigating(true));
    const unbindFinish = router.on('finish', () => setIsNavigating(false));
    return () => {
      unbindStart();
      unbindFinish();
    };
  }, []);

  const userList = users?.data || [];

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      const headers = sanctumToken ? { Authorization: `Bearer ${sanctumToken}` } : {};
      await axios.post('/api/v1/users', formData, { headers });
      setLoading(false);
      setIsCreateOpen(false);
      setFormData({ name: '', email: '', phone: '', password: '', role: 'technician' });
      notifySuccess(`User account created successfully!`);
      router.reload();
    } catch (err) {
      setLoading(false);
      const errMsg = err.response?.data?.message || 'Failed to create user account.';
      notifyError(errMsg);
      if (err.response?.status === 422) {
        setErrors(err.response.data?.errors || {});
      } else {
        setErrors({ general: errMsg });
      }
    }
  };

  const handleToggleStatus = async (userObj) => {
    if (userObj.id === currentUser?.id) {
      setSafetyAlert({
        title: 'Action Blocked by Safety Guard',
        message: 'You cannot deactivate your own active user session.',
      });
      return;
    }

    try {
      const headers = sanctumToken ? { Authorization: `Bearer ${sanctumToken}` } : {};
      await axios.patch(`/api/v1/users/${userObj.id}/toggle-status`, {}, { headers });
      notifySuccess(`User ${userObj.name} status updated!`);
      router.reload();
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to update user status.';
      notifyError(errMsg);
      if (err.response?.data?.message) {
        setSafetyAlert({
          title: 'Safety Guard Protection',
          message: err.response.data.message,
        });
      }
    }
  };

  const handleDeleteUser = (userObj) => {
    if (userObj.id === currentUser?.id) {
      setSafetyAlert({
        title: 'Action Blocked by Safety Guard',
        message: 'You cannot delete your own account.',
      });
      return;
    }
    setDeleteModalData(userObj);
  };

  const handleConfirmDeleteUser = async () => {
    if (!deleteModalData) return;
    setDeletingUser(true);
    try {
      const headers = sanctumToken ? { Authorization: `Bearer ${sanctumToken}` } : {};
      const res = await axios.delete(`/api/v1/users/${deleteModalData.id}`, { headers });
      setDeletingUser(false);
      setDeleteModalData(null);
      notifySuccess(res.data?.message || 'Staff member deleted successfully');
      router.reload();
    } catch (err) {
      setDeletingUser(false);
      setDeleteModalData(null);
      if (err.response?.data?.message) {
        setSafetyAlert({
          title: 'Safety Guard Protection',
          message: err.response.data.message,
        });
      } else {
        notifyError('Failed to delete staff member.');
      }
    }
  };

  return (
    <AppLayout title="User Management" description="Manage admin, coordinator, tester, and technician accounts, role assignments, access permissions, and activity statuses.">
      <div className="p-4 space-y-4 w-full max-w-full">
        
        {/* HEADER */}
        <div className="flex justify-between items-start flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#0B0B0B]">User & Role Management</h1>
            <p className="text-[#666666] text-xs mt-0.5">
              Manage system staff accounts, user permissions, and assigned operational roles (<span className="text-[#005ea4] font-semibold">Admin</span>, <span className="text-purple-600 font-semibold">Tester</span>, <span className="text-[#1BAF7A] font-semibold">Technician</span>).
            </p>
          </div>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="sk-btn sk-btn-primary"
          >
            <span className="material-symbols-outlined text-base">person_add</span>
            Add Staff Member
          </button>
        </div>

        {/* CARD CONTAINER */}
        <div className="sk-card relative">
          <TableLoadingOverlay loading={isNavigating} text="Updating staff accounts..." />
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#f4f4f2] text-[#666666] uppercase text-[10px] font-bold tracking-wider border-b border-[#E5E5E5]">
                <tr>
                  <th className="py-3.5 px-4">STAFF MEMBER</th>
                  <th className="py-3.5 px-4">CONTACT EMAIL & PHONE</th>
                  <th className="py-3.5 px-4">ASSIGNED ROLE</th>
                  <th className="py-3.5 px-4">STATUS</th>
                  <th className="py-3.5 px-4">LAST LOGIN</th>
                  <th className="py-3.5 px-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5]">
                {userList.map((u) => {
                  const roleName = u.roles?.[0] || 'staff';
                  return (
                    <tr key={u.id} className="hover:bg-[#f9f9f7] transition-colors">
                      
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#0B0B0B] flex items-center gap-2">
                          {u.name}
                          {u.id === currentUser?.id && (
                            <span className="sk-pill bg-blue-100 text-blue-800">You</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-mono text-[#0B0B0B]">{u.email}</div>
                        <div className="text-[11px] text-[#666666]">{u.phone || '-'}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`sk-pill ${
                          roleName === 'admin'
                            ? 'bg-amber-100 text-amber-800'
                            : roleName === 'intake_coordinator'
                            ? 'bg-blue-100 text-blue-800'
                            : roleName === 'tester'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {roleName.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        {u.is_active ? (
                          <span className="sk-pill bg-emerald-50 text-emerald-700">Active</span>
                        ) : (
                          <span className="sk-pill bg-rose-50 text-rose-700">Deactivated</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-[#666666]">
                        {u.last_login_at ? formatDate(u.last_login_at) : 'Never'}
                      </td>

                      <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => setEditingUser(u)}
                          className="p-1 text-slate-600 hover:text-[#005ea4] transition-colors cursor-pointer"
                          title="Edit Staff Member Details & Role"
                        >
                          <span className="material-symbols-outlined text-lg">edit</span>
                        </button>
                        <button
                          onClick={() => handleToggleStatus(u)}
                          className="p-1 hover:text-[#005ea4] transition-colors cursor-pointer"
                          title="Toggle Active Status"
                        >
                          <span className="material-symbols-outlined text-lg">power_settings_new</span>
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u)}
                          className="p-1 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Delete User"
                        >
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* FOOTER PAGINATION */}
          <div className="flex justify-between items-center p-4 border-t border-[#E5E5E5] flex-wrap gap-3 text-xs text-[#666666]">
            <span>Showing <b>{userList.length}</b> of <b>{users?.meta?.total || userList.length}</b> staff members (30 per page)</span>
            <div className="flex gap-1">
              {users?.links?.prev ? (
                <Link href={users.links.prev} className="w-8 h-8 rounded border border-[#E5E5E5] bg-white flex items-center justify-center font-bold text-[#0B0B0B]">
                  &lsaquo;
                </Link>
              ) : (
                <button disabled className="w-8 h-8 rounded border border-[#E5E5E5] bg-white opacity-40 cursor-not-allowed font-bold">
                  &lsaquo;
                </button>
              )}
              <button className="w-8 h-8 rounded border border-[#005ea4] bg-[#005ea4] text-white font-bold">
                {users?.meta?.current_page || 1}
              </button>
              {users?.links?.next ? (
                <Link href={users.links.next} className="w-8 h-8 rounded border border-[#E5E5E5] bg-white flex items-center justify-center font-bold text-[#0B0B0B]">
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

        {/* CREATE USER MODAL */}
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-white border border-[#E5E5E5] p-6 shadow-2xl space-y-4 text-[#0B0B0B]">
              <div className="flex items-center justify-between pb-3 border-b border-[#E5E5E5]">
                <h3 className="font-bold text-base">Add New Staff Member</h3>
                <button onClick={() => setIsCreateOpen(false)} className="text-[#666666] hover:text-[#0B0B0B]">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold uppercase text-[#666666] mb-1">Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#f4f4f2] border border-[#E5E5E5] text-[#0B0B0B]"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-[#666666] mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#f4f4f2] border border-[#E5E5E5] text-[#0B0B0B]"
                  />
                  {errors.email && <p className="text-rose-600 mt-1">{errors.email[0]}</p>}
                </div>
                <div>
                  <label className="block font-bold uppercase text-[#666666] mb-1">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#f4f4f2] border border-[#E5E5E5] text-[#0B0B0B]"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-[#666666] mb-1">Password *</label>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#f4f4f2] border border-[#E5E5E5] text-[#0B0B0B]"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-[#666666] mb-1">Role *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#f4f4f2] border border-[#E5E5E5] text-[#0B0B0B]"
                  >
                    <option value="admin">System Admin</option>
                    <option value="intake_coordinator">Intake Coordinator</option>
                    <option value="tester">Tester</option>
                    <option value="technician">Technician</option>
                  </select>
                </div>

                <div className="pt-4 flex justify-end gap-2 border-t border-[#E5E5E5]">
                  <button type="button" onClick={() => setIsCreateOpen(false)} className="sk-btn sk-btn-outline">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="sk-btn sk-btn-primary flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none"
                  >
                    <span className={`material-symbols-outlined text-base ${loading ? 'animate-spin' : ''}`}>
                      {loading ? 'sync' : 'person_add'}
                    </span>
                    <span>{loading ? 'Creating Staff User...' : 'Create Staff User'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* EDIT USER MODAL */}
        {editingUser && (
          <EditUserModal
            isOpen={Boolean(editingUser)}
            onClose={() => setEditingUser(null)}
            onSuccess={() => router.reload()}
            userToEdit={editingUser}
            sanctumToken={sanctumToken}
          />
        )}

        {/* DELETE USER CONFIRMATION MODAL */}
        {deleteModalData && (
          <ConfirmActionModal
            isOpen={Boolean(deleteModalData)}
            title="Delete Staff Account"
            description={`Are you sure you want to permanently delete staff account for ${deleteModalData.name} (${deleteModalData.email})? This action cannot be undone.`}
            tokenNo={deleteModalData.roles?.[0]?.replace('_', ' ')?.toUpperCase() || 'STAFF'}
            customerName={deleteModalData.name}
            customerMobile={deleteModalData.phone || deleteModalData.email}
            submitting={deletingUser}
            onClose={() => setDeleteModalData(null)}
            onConfirm={handleConfirmDeleteUser}
          />
        )}

      </div>
    </AppLayout>
  );
}
