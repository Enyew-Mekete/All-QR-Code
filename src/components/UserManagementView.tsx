import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  ShieldCheck,
  UserCheck,
  KeyRound,
  Trash2,
  Edit2,
  X,
  Check,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { AppUser, CustomThemeSetting, RoleDefinition } from '../types';
import { StorageService } from '../services/storage';
import { ApiClient } from '../services/api';
import { ConfirmModal } from './ConfirmModal';

interface UserManagementViewProps {
  currentUser: AppUser;
  roles: RoleDefinition[];
  theme: CustomThemeSetting;
  onUsersChanged: () => void;
  onToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({
  currentUser,
  roles,
  theme,
  onUsersChanged,
  onToast,
  canAdd = true,
  canEdit = true,
  canDelete = true,
}) => {
  const [users, setUsers] = useState<AppUser[]>(StorageService.getUsers());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add / Edit Modal state
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);

  // Confirm modal states
  const [pendingResetUser, setPendingResetUser] = useState<AppUser | null>(null);
  const [pendingDeleteUser, setPendingDeleteUser] = useState<AppUser | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+251');
  const [selectedRole, setSelectedRole] = useState<string>('admin');
  const [status, setStatus] = useState<'active' | 'suspended'>('active');
  const [otpEnabled, setOtpEnabled] = useState<boolean>(true);

  // Safe confirmation banner without exposing generated passwords
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const isSuperAdmin = currentUser.role === 'super_admin';
  const databaseName = StorageService.getDatabaseName();

  const syncUsersFromServer = async () => {
    try {
      const boot = await ApiClient.bootstrap();
      if (boot.success) {
        StorageService.hydrateFromBackend(boot);
      }
    } catch {
      // ignore if offline
    }
    setUsers(StorageService.getUsers());
    onUsersChanged();
  };

  const openAddModal = () => {
    setEditingUser(null);
    setName('');
    setEmail('');
    setPhone('+251');
    setSelectedRole(roles.find((r) => r.id === 'admin')?.id || roles[0]?.id || 'admin');
    setStatus('active');
    setOtpEnabled(true);
    setIsUserModalOpen(true);
  };

  const openEditModal = (user: AppUser) => {
    setEditingUser(user);
    setName(user.name);
    setEmail(user.email);
    setPhone(user.phone || '+251');
    setSelectedRole(user.role);
    setStatus(user.status || 'active');
    setOtpEnabled(Boolean(user.otpEnabled));
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      onToast('Name and email are required.', 'error');
      return;
    }

    setIsSubmitting(true);

    if (editingUser) {
      // Edit Existing User
      try {
        const res = await ApiClient.updateUser(editingUser.id, {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          role: selectedRole,
          status,
          otpEnabled,
        });
        setIsSubmitting(false);
        if (res.success) {
          await syncUsersFromServer();
          setIsUserModalOpen(false);
          setEditingUser(null);
          onToast(`User "${name.trim()}" updated successfully.`, 'success');
        } else {
          onToast(res.error || 'Failed to update user.', 'error');
        }
      } catch {
        const res = StorageService.updateUser(editingUser.id, {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          role: selectedRole,
          status,
          otpEnabled,
        });
        setIsSubmitting(false);
        if (res.success) {
          setUsers(StorageService.getUsers());
          onUsersChanged();
          setIsUserModalOpen(false);
          setEditingUser(null);
          onToast(`User "${name.trim()}" updated successfully.`, 'success');
        } else {
          onToast(res.error || 'Failed to update user.', 'error');
        }
      }
      return;
    }

    // Create New User (password is generated & sent on server; never shown to creator)
    try {
      const res = await ApiClient.createUser({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || '+251943305937',
        role: selectedRole,
        otpEnabled,
      });
      setIsSubmitting(false);
      if (res.success) {
        await syncUsersFromServer();
        setIsUserModalOpen(false);
        const msg = 'The user has Created Successfully and sent via that user email address';
        setStatusNotice(msg);
        onToast(msg, 'success');
      } else {
        onToast(res.error || 'Failed to create user.', 'error');
      }
    } catch {
      const result = StorageService.addUser({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || '+251943305937',
        role: selectedRole,
        otpEnabled,
      });
      setIsSubmitting(false);
      if (result.success) {
        setUsers(StorageService.getUsers());
        onUsersChanged();
        setIsUserModalOpen(false);
        const msg = 'The user has Created Successfully and sent via that user email address';
        setStatusNotice(msg);
        onToast(msg, 'success');
      } else {
        onToast(result.error || 'Failed to create user', 'error');
      }
    }
  };

  const handleToggleOTP = async (user: AppUser) => {
    try {
      const res = await ApiClient.toggleUserOTP(user.id);
      if (res.success && res.user) {
        await syncUsersFromServer();
        onToast(
          `OTP verification ${res.user.otpEnabled ? 'enabled' : 'disabled'} for ${user.name}.`,
          'info'
        );
      }
    } catch {
      const res = StorageService.toggleUserOTP(user.id);
      if (res.success) {
        setUsers(StorageService.getUsers());
        onUsersChanged();
        onToast(
          `OTP verification ${res.otpEnabled ? 'enabled' : 'disabled'} for ${user.name}.`,
          'info'
        );
      }
    }
  };

  const confirmResetPassword = async () => {
    if (!pendingResetUser) return;
    const target = pendingResetUser;
    setPendingResetUser(null);

    try {
      const res = await ApiClient.resetUserPassword(target.id);
      if (res.success) {
        await syncUsersFromServer();
        const msg = 'The password has Reset Successfully and sent via that user email address';
        setStatusNotice(msg);
        onToast(msg, 'success');
      } else {
        onToast(res.error || 'Failed to reset password.', 'error');
      }
    } catch {
      const res = StorageService.resetPasswordForUser(target.id);
      if (res.success) {
        setUsers(StorageService.getUsers());
        onUsersChanged();
        const msg = 'The password has Reset Successfully and sent via that user email address';
        setStatusNotice(msg);
        onToast(msg, 'success');
      } else {
        onToast(res.error || 'Failed to reset password', 'error');
      }
    }
  };

  const confirmSoftDelete = async () => {
    if (!pendingDeleteUser) return;
    const target = pendingDeleteUser;
    setPendingDeleteUser(null);

    try {
      const res = await ApiClient.softDeleteUser(target.id);
      if (res.success) {
        await syncUsersFromServer();
        onToast(`User "${target.name}" soft deleted from ${databaseName}.`, 'info');
      } else {
        onToast(res.error || 'Cannot delete user', 'error');
      }
    } catch {
      const res = StorageService.softDeleteUser(target.id);
      if (res.success) {
        setUsers(StorageService.getUsers());
        onUsersChanged();
        onToast(`User "${target.name}" soft deleted from ${databaseName}.`, 'info');
      } else {
        onToast(res.error || 'Cannot delete user', 'error');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Add Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-slate-800" />
            <span>User Management</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Database: {databaseName} · Add, edit, soft-delete users, toggle OTP verification, and reset passwords.
          </p>
        </div>

        {(isSuperAdmin || canAdd) && (
          <button
            type="button"
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2.5 text-white rounded-xl text-xs font-bold transition-opacity hover:opacity-90 shadow-sm cursor-pointer whitespace-nowrap self-start sm:self-auto"
            style={{ backgroundColor: theme.primaryColor }}
          >
            <UserPlus className="w-4 h-4" />
            <span>Add User</span>
          </button>
        )}
      </div>

      {/* Clean Success Banner (no password exposed to creator or password reseter) */}
      {statusNotice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-bold text-emerald-900">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusNotice(null)}
            className="text-slate-400 hover:text-slate-700 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">OTP 2FA</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => {
                const isCurrent = user.id === currentUser.id;
                const roleObj = roles.find((r) => r.id === user.role);
                const canResetThisUser = isSuperAdmin || isCurrent || canEdit;

                return (
                  <tr key={user.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
                          style={{
                            backgroundColor:
                              user.role === 'super_admin' ? theme.primaryColor : '#334155',
                          }}
                        >
                          {user.role === 'super_admin' ? (
                            <ShieldCheck className="w-4 h-4" />
                          ) : (
                            <UserCheck className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">
                            {user.name} {isCurrent ? '(You)' : ''}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {user.mustChangePassword
                              ? 'Temp password active'
                              : 'Permanent password set'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800 whitespace-nowrap">
                      {roleObj?.name || user.role}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                      <div>{user.email}</div>
                      <div className="text-slate-400">{user.phone || 'No phone set'}</div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold ${
                          user.status === 'suspended'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {user.status === 'suspended' ? 'Suspended' : 'Active'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {isSuperAdmin || canEdit ? (
                        <button
                          type="button"
                          onClick={() => handleToggleOTP(user)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer whitespace-nowrap ${
                            user.otpEnabled
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {user.otpEnabled ? (
                            <ToggleRight className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <ToggleLeft className="w-4 h-4 text-slate-400" />
                          )}
                          <span>{user.otpEnabled ? 'OTP ON' : 'OTP OFF'}</span>
                        </button>
                      ) : (
                        <span className="text-slate-600 font-semibold">
                          {user.otpEnabled ? 'OTP ON' : 'OTP OFF'}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {(isSuperAdmin || canEdit) && (
                          <button
                            type="button"
                            onClick={() => openEditModal(user)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition-colors cursor-pointer whitespace-nowrap"
                            title="Edit User"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                        )}

                        {canResetThisUser && (
                          <button
                            type="button"
                            onClick={() => setPendingResetUser(user)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition-colors cursor-pointer whitespace-nowrap"
                            title="Reset Password"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>Reset Password</span>
                          </button>
                        )}

                        {(isSuperAdmin || canDelete) && !isCurrent && (
                          <button
                            type="button"
                            onClick={() => setPendingDeleteUser(user)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Soft Delete User"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit User Modal */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  {editingUser ? `Edit User: ${editingUser.name}` : 'Add New User'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {editingUser
                    ? 'Update user profile details, role assignment, account status, and OTP preference.'
                    : 'Generates a temporary 7-digit mixed password and emails/SMS it directly to the user.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsUserModalOpen(false);
                  setEditingUser(null);
                }}
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Hermela Bekele"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email (Username)</label>
                  <input
                    type="email"
                    required
                    placeholder="user@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ethiopian Phone Number
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="+2519..."
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Assigned Role</label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {editingUser && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Account Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) =>
                      setStatus(e.target.value === 'suspended' ? 'suspended' : 'active')
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              )}

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-slate-900">Require OTP on Login</div>
                  <div className="text-[11px] text-slate-500">
                    Toggle ON to send a 6-digit OTP via Email &amp; SMS on sign-in.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOtpEnabled(!otpEnabled)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs cursor-pointer whitespace-nowrap ${
                    otpEnabled ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {otpEnabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                  <span>{otpEnabled ? 'OTP ON' : 'OTP OFF'}</span>
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsUserModalOpen(false);
                    setEditingUser(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: theme.primaryColor }}
                >
                  {isSubmitting
                    ? 'Saving...'
                    : editingUser
                    ? 'Save User Changes'
                    : 'Create & Send Credentials'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Confirm Modal */}
      <ConfirmModal
        isOpen={Boolean(pendingResetUser)}
        title="Reset User Password"
        message={`Generate a new default 7-digit mixed password for ${pendingResetUser?.name} and send it directly to ${pendingResetUser?.email} and ${pendingResetUser?.phone || 'their phone'}? They will be forced to change it upon next login.`}
        confirmLabel="Reset & Send to User"
        variant="warning"
        onConfirm={confirmResetPassword}
        onCancel={() => setPendingResetUser(null)}
      />

      {/* Soft Delete Confirm Modal */}
      <ConfirmModal
        isOpen={Boolean(pendingDeleteUser)}
        title="Soft Delete User"
        message={`Are you sure you want to soft delete "${pendingDeleteUser?.name}"? They will lose access immediately and can be restored from Reports.`}
        confirmLabel="Soft Delete User"
        onConfirm={confirmSoftDelete}
        onCancel={() => setPendingDeleteUser(null)}
      />
    </div>
  );
};
