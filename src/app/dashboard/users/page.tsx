'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import {
  Users, Lock, Plus, Edit2, Trash2, Shield, Save, Check, X
} from 'lucide-react';

interface Role {
  id: string;
  name: string;
  permissions: Record<string, boolean>;
}

interface Profile {
  id: string;
  full_name: string;
  role: string | null;
  role_id: string | null;
  avatar_url: string | null;
  roles?: Role;
}

const AVAILABLE_MODULES = [
  { key: 'analytics', label: 'Dashboard Analytics' },
  { key: 'shareholders', label: 'Shareholders' },
  { key: 'investments', label: 'Share Collection / Investments' },
  { key: 'dividends', label: 'Dividends' },
  { key: 'certificates', label: 'Share Certificates' },
  { key: 'loans', label: 'Loans' },
  { key: 'directors', label: 'Directors (BOD)' },
  { key: 'company-investments', label: 'Company Investments' },
  { key: 'banks', label: 'Banking' },
  { key: 'petty-cash', label: 'Petty Cash' },
  { key: 'returns', label: 'Returns (ROI)' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'meetings', label: 'Board Meetings' },
  { key: 'chalani', label: 'Letter Handlers (Chalani)' },
  { key: 'documents', label: 'Documents Vault' },
  { key: 'reports', label: 'Reports View' },
  { key: 'notifications', label: 'Notifications Hub' },
  { key: 'recycle-bin', label: 'Recycle Bin Settings' },
  { key: 'settings', label: 'System Settings' },
  { key: 'users', label: 'User & Role Management' },
];

export default function UserManagementPage() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editor states
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleForm, setRoleForm] = useState<{ name: string; permissions: Record<string, boolean> }>({ name: '', permissions: {} });

  // Delete states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [profilesRes, rolesRes] = await Promise.all([
      supabase.from('profiles').select('*, roles:role_id(*)').order('full_name'),
      supabase.from('roles').select('*').order('name'),
    ]);

    if (profilesRes.data) setProfiles(profilesRes.data as Profile[]);
    if (rolesRes.data) setRoles(rolesRes.data as Role[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleUpdateUserRole = async (userId: string, roleId: string) => {
    setSaving(true);
    const selectedRole = roles.find(r => r.id === roleId);

    // Update user’s role status backward compatibility
    let legacyRole = 'editor';
    if (selectedRole?.name === 'Super Admin') legacyRole = 'super_admin';
    else if (selectedRole?.name === 'Admin') legacyRole = 'admin';

    const { error } = await supabase
      .from('profiles')
      .update({ role_id: roleId || null, role: legacyRole })
      .eq('id', userId);

    if (error) {
      toast.error('Failed to update user role');
    } else {
      toast.success('User updated successfully');
      fetchAll();
    }
    setSaving(false);
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleForm.name.trim()) return toast.error('Role name required');

    setSaving(true);
    const payload = {
      name: roleForm.name,
      permissions: roleForm.permissions
    };

    let error;
    if (editingRole) {
      const { error: err } = await supabase.from('roles').update(payload).eq('id', editingRole.id);
      error = err;
    } else {
      const { error: err } = await supabase.from('roles').insert(payload);
      error = err;
    }

    if (error) {
      toast.error('Failed to save role');
    } else {
      toast.success('Role saved successfully');
      setEditingRole(null);
      setRoleForm({ name: '', permissions: {} });
      fetchAll();
    }
    setSaving(false);
  };

  const togglePermission = (key: string) => {
    setRoleForm((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [key]: !prev.permissions[key]
      }
    }));
  };

  const handleDeleteRole = (role: Role) => {
    if (role.name === 'Super Admin' || role.name === 'Admin') {
      return toast.error('This is a protected system role and cannot be deleted.');
    }

    const assignedCount = profiles.filter(p => p.role_id === role.id).length;
    if (assignedCount > 0) {
      return toast.error(`Cannot delete role. It is currently assigned to ${assignedCount} user(s).`);
    }

    setRoleToDelete(role);
    setShowDeleteModal(true);
  };

  const confirmDeleteRole = async () => {
    if (!roleToDelete) return;

    setSaving(true);
    const { error } = await supabase.from('roles').delete().eq('id', roleToDelete.id);

    if (error) {
      toast.error('Failed to delete role');
    } else {
      toast.success('Role deleted successfully');
      if (editingRole?.id === roleToDelete.id) {
        setEditingRole(null);
        setRoleForm({ name: '', permissions: {} });
      }
      fetchAll();
      setShowDeleteModal(false);
    }
    setSaving(false);
  };

  if (loading) return <div className="loading">Loading Management Access...</div>;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="page-subtitle">Assign roles and dynamic access privileges</p>
        </div>
      </div>

      <div className="page-body">
        <div className="tabs mb-6">
          <button className={`tab ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
            <Users size={16} className="inline mr-2" /> Users
          </button>
          <button className={`tab ${activeTab === 'roles' ? 'active' : ''}`} onClick={() => setActiveTab('roles')}>
            <Shield size={16} className="inline mr-2" /> Roles &amp; Permissions
          </button>
        </div>

        {activeTab === 'users' ? (
          <div className="card">
            <div className="card-header">
              <div className="card-title">User Directory</div>
            </div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Legacy Role</th>
                    <th>Assigned Role</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="sidebar-user-avatar">
                            {(user.full_name || '?')[0].toUpperCase()}
                          </div>
                          <div className="font-bold">{user.full_name}</div>
                        </div>
                      </td>
                      <td className="capitalize text-muted text-xs">{user.role}</td>
                      <td>
                        <select
                          className="select"
                          value={user.role_id || ''}
                          onChange={(e) => handleUpdateUserRole(user.id, e.target.value)}
                          disabled={saving}
                          style={{ fontSize: 13, height: 36 }}
                        >
                          <option value="">No Role Assigned</option>
                          {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                      </td>
                      <td>
                        <div className="badge badge-neutral text-xs">{Object.keys(user.roles?.permissions || {}).filter(k => user.roles?.permissions[k]).length || 0} Modules</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid-2">
            <div className="card">
              <div className="card-header">
                <div className="card-title">Roles List</div>
                <button className="btn btn-primary btn-sm" onClick={() => { setEditingRole(null); setRoleForm({ name: '', permissions: {} }); }}>
                  <Plus size={14} /> Add Role
                </button>
              </div>
              <div className="flex flex-col gap-3">
                {roles.map((r) => (
                  <div key={r.id} className={`p-4 border rounded-xl flex items-center justify-between hover:bg-secondary/5 cursor-pointer ${editingRole?.id === r.id ? 'border-primary' : ''}`} onClick={() => { setEditingRole(r); setRoleForm({ name: r.name, permissions: r.permissions || {} }); }}>
                    <div>
                      <div className="font-bold">{r.name}</div>
                      <div className="text-xs text-muted">
                        {r.permissions?.all ? 'Full Admin Access' : `${Object.keys(r.permissions || {}).filter(k => r.permissions[k]).length} Allowed Module Access`}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="btn btn-ghost btn-icon btn-sm" title="Edit Role">
                        <Edit2 size={14} />
                      </button>
                      <button
                        className="btn btn-ghost btn-icon btn-sm"
                        title="Delete Role"
                        style={{ color: 'var(--danger)' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRole(r);
                        }}
                        disabled={r.name === 'Super Admin' || r.name === 'Admin'}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-title">{editingRole ? 'Edit Role' : 'Create Role'}</div>
              </div>
              <form onSubmit={handleSaveRole} className="flex flex-col gap-6">
                <div className="input-group">
                  <label>Role Name</label>
                  <input className="input" placeholder="e.g. Accounts Manager" value={roleForm.name} onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })} disabled={saving || editingRole?.name === 'Super Admin'} required />
                </div>

                <div>
                  <label className="font-bold block mb-4">Module Access Permissions</label>
                  {editingRole?.name === 'Super Admin' ? (
                    <div className="p-4 bg-success/10 border border-success/30 rounded-xl text-success font-bold text-sm text-center">
                      <Save size={16} className="inline mr-2" />
                      Full Application Administrator Access (ALL unlocked)
                    </div>
                  ) : (
                    <div className="grid-2" style={{ gap: 8 }}>
                      {AVAILABLE_MODULES.map((mod) => (
                        <div key={mod.key} className="p-3 border rounded-lg flex items-center justify-between hover:bg-secondary/5">
                          <span className="text-sm">{mod.label}</span>
                          <label className="switch">
                            <input type="checkbox" checked={!!roleForm.permissions[mod.key]} onChange={() => togglePermission(mod.key)} />
                            <span className="slider round"></span>
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ alignSelf: 'flex-start' }}>
                  <button className="btn btn-primary" type="submit" disabled={saving || editingRole?.name === 'Super Admin'}>
                    <Save size={16} /> Save Role Rules
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteModal && roleToDelete && (
        <div className="modal-overlay" onClick={() => !saving && setShowDeleteModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ color: 'var(--danger)' }}>Confirm Deletion</h2>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => !saving && setShowDeleteModal(false)}
                disabled={saving}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
                Are you sure you want to delete the <strong>{roleToDelete.name}</strong> role? This action cannot be undone.
              </p>
              <div style={{ background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: 8, fontSize: 13, border: '1px solid var(--border)' }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Note: You can only delete roles that are not assigned to any users.</div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowDeleteModal(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}
                onClick={confirmDeleteRole}
                disabled={saving}
              >
                {saving ? 'Deleting...' : 'Yes, Delete Role'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
