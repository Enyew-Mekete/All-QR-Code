import React, { useState } from 'react';
import { ShieldCheck, Plus, Edit2, Trash2, X } from 'lucide-react';
import { RoleDefinition, SystemSection, RolePrivilege, CustomThemeSetting } from '../types';
import { StorageService } from '../services/storage';
import { ConfirmModal } from './ConfirmModal';

interface RoleManagementViewProps {
  onToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  onRolesChanged?: () => void;
  theme: CustomThemeSetting;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

const ALL_SECTIONS: SystemSection[] = [
  'Dashboard',
  'QR Codes',
  'Category Management',
  'Analytics',
  'Theme Settings',
  'Role Management',
  'User Management',
  'Reports',
];

export const RoleManagementView: React.FC<RoleManagementViewProps> = ({
  onToast,
  onRolesChanged,
  theme,
  canAdd = true,
  canEdit = true,
  canDelete = true,
}) => {
  const [roles, setRoles] = useState<RoleDefinition[]>(StorageService.getRoles());
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleDefinition | null>(null);
  const [pendingDeleteRole, setPendingDeleteRole] = useState<RoleDefinition | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [privileges, setPrivileges] = useState<Record<SystemSection, RolePrivilege>>(() => {
    const init: Record<string, RolePrivilege> = {};
    ALL_SECTIONS.forEach((sec) => {
      init[sec] = { view: true, add: false, edit: false, delete: false };
    });
    return init as Record<SystemSection, RolePrivilege>;
  });

  const handleOpenCreate = () => {
    setEditingRole(null);
    setName('');
    setDescription('');
    const init: Record<string, RolePrivilege> = {};
    ALL_SECTIONS.forEach((sec) => {
      init[sec] = { view: true, add: false, edit: false, delete: false };
    });
    setPrivileges(init as Record<SystemSection, RolePrivilege>);
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (role: RoleDefinition) => {
    setEditingRole(role);
    setName(role.name);
    setDescription(role.description);
    const cloned: Record<string, RolePrivilege> = {};
    ALL_SECTIONS.forEach((sec) => {
      cloned[sec] = role.privileges?.[sec]
        ? { ...role.privileges[sec] }
        : { view: false, add: false, edit: false, delete: false };
    });
    setPrivileges(cloned as Record<SystemSection, RolePrivilege>);
    setIsEditorOpen(true);
  };

  const handleTogglePrivilege = (section: SystemSection, action: 'view' | 'add' | 'edit' | 'delete') => {
    setPrivileges((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [action]: !prev[section][action],
      },
    }));
  };

  const handleToggleAllForSection = (section: SystemSection) => {
    setPrivileges((prev) => {
      const current = prev[section];
      const allSelected = current.view && current.add && current.edit && current.delete;
      return {
        ...prev,
        [section]: {
          view: !allSelected,
          add: !allSelected,
          edit: !allSelected,
          delete: !allSelected,
        },
      };
    });
  };

  const handleSelectAllPrivileges = () => {
    const allTrue: Record<string, RolePrivilege> = {};
    ALL_SECTIONS.forEach((sec) => {
      allTrue[sec] = { view: true, add: true, edit: true, delete: true };
    });
    setPrivileges(allTrue as Record<SystemSection, RolePrivilege>);
  };

  const handleSaveRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      onToast('Role name is required.', 'error');
      return;
    }

    if (editingRole) {
      const updated: RoleDefinition = {
        ...editingRole,
        name: name.trim(),
        description: description.trim(),
        privileges,
      };
      const res = StorageService.updateRole(updated);
      if (res.success) {
        setRoles(StorageService.getRoles());
        setIsEditorOpen(false);
        onRolesChanged?.();
        onToast(`Role "${updated.name}" updated successfully.`, 'success');
      } else {
        onToast(res.error || 'Failed to update role', 'error');
      }
    } else {
      const res = StorageService.createRole({
        name: name.trim(),
        description: description.trim() || 'Custom system role',
        privileges,
      });
      if (res.success && res.role) {
        setRoles(StorageService.getRoles());
        setIsEditorOpen(false);
        onRolesChanged?.();
        onToast(`Role "${res.role.name}" created successfully.`, 'success');
      } else {
        onToast(res.error || 'Failed to create role', 'error');
      }
    }
  };

  const confirmSoftDelete = () => {
    if (!pendingDeleteRole) return;
    const res = StorageService.softDeleteRole(pendingDeleteRole.id);
    if (res.success) {
      setRoles(StorageService.getRoles());
      onRolesChanged?.();
      onToast(`Role "${pendingDeleteRole.name}" soft deleted from database.`, 'info');
    } else {
      onToast(res.error || 'Cannot delete role', 'error');
    }
    setPendingDeleteRole(null);
  };

  const countPrivileges = (role: RoleDefinition) => {
    let total = 0;
    Object.values(role.privileges || {}).forEach((p) => {
      if (p.view) total++;
      if (p.add) total++;
      if (p.edit) total++;
      if (p.delete) total++;
    });
    return total;
  };

  const filteredRoles = roles.filter((r) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-slate-800" />
            <span>Role Management</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Define reusable roles and choose which system modules each role can view, add, edit, or delete.
          </p>
        </div>

        {canAdd && (
          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2.5 text-white rounded-xl text-xs font-bold transition-opacity hover:opacity-90 shadow-sm cursor-pointer whitespace-nowrap self-start sm:self-auto"
            style={{ backgroundColor: theme.primaryColor }}
          >
            <Plus className="w-4 h-4" />
            <span>Define New Role</span>
          </button>
        )}
      </div>

      {/* Search */}
      <div className="max-w-md">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search roles or descriptions..."
          className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
      </div>

      {/* Role Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredRoles.map((role) => {
          const privCount = countPrivileges(role);

          return (
            <div
              key={role.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 flex flex-col justify-between hover:border-slate-300 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-9 h-9 rounded-xl text-white flex items-center justify-center shrink-0"
                      style={{ backgroundColor: theme.primaryColor }}
                    >
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-base font-extrabold text-slate-900 truncate">{role.name}</h2>
                      <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                        {privCount} privileges enabled
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">{role.description}</p>

                {/* Clean structured privilege summary */}
                <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 max-h-48 overflow-y-auto">
                  {ALL_SECTIONS.map((sec) => {
                    const p = role.privileges?.[sec];
                    if (!p) return null;
                    const enabled = [
                      p.view && 'view',
                      p.add && 'add',
                      p.edit && 'edit',
                      p.delete && 'delete',
                    ].filter(Boolean);
                    if (enabled.length === 0) return null;
                    return (
                      <div key={sec} className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-semibold text-slate-700 truncate">{sec}</span>
                        <span className="font-mono text-slate-500 shrink-0">
                          {enabled.join(' · ')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(role)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                )}

                {canDelete && !role.isSystem && role.id !== 'super_admin' && (
                  <button
                    type="button"
                    onClick={() => setPendingDeleteRole(role)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Role Editor Modal */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {editingRole ? `Edit Role: ${editingRole.name}` : 'Create New System Role'}
                </h3>
                <p className="text-xs text-slate-500">
                  Turn each permission on or off for this role across system modules.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRole} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Role Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Branch Supervisor"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                    <input
                      type="text"
                      placeholder="Brief explanation of access responsibilities"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                    />
                  </div>
                </div>

                {/* Privileges Matrix */}
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-3 gap-2">
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900">Privileges</h4>
                      <p className="text-[11px] text-slate-500">
                        Turn each permission on or off for this role.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleSelectAllPrivileges}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold rounded-xl border border-slate-300 cursor-pointer whitespace-nowrap"
                    >
                      Select all privileges
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-2xl overflow-x-auto bg-white">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                          <th className="py-2.5 px-4 font-extrabold text-slate-900">Section</th>
                          <th className="py-2.5 px-3 text-center">View</th>
                          <th className="py-2.5 px-3 text-center">Add</th>
                          <th className="py-2.5 px-3 text-center">Edit</th>
                          <th className="py-2.5 px-3 text-center">Delete</th>
                          <th className="py-2.5 px-3 text-center">All</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {ALL_SECTIONS.map((sec) => {
                          const p = privileges[sec];
                          const isAll = p.view && p.add && p.edit && p.delete;

                          return (
                            <tr key={sec} className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-2.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                                {sec}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={p.view}
                                  onChange={() => handleTogglePrivilege(sec, 'view')}
                                  className="w-4 h-4 rounded cursor-pointer"
                                />
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={p.add}
                                  onChange={() => handleTogglePrivilege(sec, 'add')}
                                  className="w-4 h-4 rounded cursor-pointer"
                                />
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={p.edit}
                                  onChange={() => handleTogglePrivilege(sec, 'edit')}
                                  className="w-4 h-4 rounded cursor-pointer"
                                />
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={p.delete}
                                  onChange={() => handleTogglePrivilege(sec, 'delete')}
                                  className="w-4 h-4 rounded cursor-pointer"
                                />
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={isAll}
                                  onChange={() => handleToggleAllForSection(sec)}
                                  className="w-4 h-4 rounded cursor-pointer"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
                  style={{ backgroundColor: theme.primaryColor }}
                >
                  {editingRole ? 'Update Role' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Soft Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(pendingDeleteRole)}
        title="Soft Delete Role"
        message={`Are you sure you want to soft delete the role "${pendingDeleteRole?.name}"? It can be restored later from Reports.`}
        confirmLabel="Soft Delete Role"
        onConfirm={confirmSoftDelete}
        onCancel={() => setPendingDeleteRole(null)}
      />
    </div>
  );
};
