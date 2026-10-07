import { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/Icon';
import { Store } from '../lib/store';
import { Auth } from '../lib/auth';
import { usePageStyle } from '../lib/hooks';
import { Validate, useFieldErrors } from '../lib/validation';
import css from './superuser-users.css?inline';

const roleColors = { client: 'badge-blue', worker: 'badge-green', expert: 'badge-purple', superuser: 'badge-red', 'revenue-admin': 'badge-orange', 'intake-admin': 'badge-blue', 'compliance-admin': 'badge-purple' };
const avatarColors = { client: 'linear-gradient(135deg,#6366f1,#4f46e5)', worker: 'linear-gradient(135deg,#10b981,#059669)', expert: 'linear-gradient(135deg,#a855f7,#7c3aed)', superuser: 'linear-gradient(135deg,#ef4444,#dc2626)', 'revenue-admin': 'linear-gradient(135deg,#f97316,#ea580c)', 'intake-admin': 'linear-gradient(135deg,#3b82f6,#2563eb)', 'compliance-admin': 'linear-gradient(135deg,#8b5cf6,#7c3aed)' };

export default function SuperuserUsers() {
  usePageStyle(css);
  const v = useFieldErrors();

  const [allUsers, setAllUsers] = useState(() => Store.getUsers());
  // The original filled the table 100ms after the layout rendered.
  const [ready, setReady] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [fadingId, setFadingId] = useState(null);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [modalTitle, setModalTitle] = useState('Add User');
  const [modalSub, setModalSub] = useState('Create a new user account.');
  const [saveLabel, setSaveLabel] = useState('Save');
  const [mName, setMName] = useState('');
  const [mEmail, setMEmail] = useState('');
  const [mPassword, setMPassword] = useState('');
  const [mRole, setMRole] = useState('');
  const [mStatus, setMStatus] = useState('active');
  const [identityEditable, setIdentityEditable] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 100);
    return () => clearTimeout(t);
  }, []);

  const refreshUsers = () => setAllUsers([...Store.getUsers()]);

  const q = search.toLowerCase();
  const filtered = allUsers.filter((u) => {
    const matchSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  function openAddModal() {
    setEditingUserId(null);
    setModalTitle('Add New User');
    setModalSub('Create a new user account on the platform.');
    setSaveLabel('Create User');
    clearModalForm();
    setIdentityEditable(true);
    setModalOpen(true);
  }

  function openEditModal(id) {
    const user = Store.getUserById(id);
    if (!user) return;
    setEditingUserId(id);
    setModalTitle('Edit User');
    setModalSub('Update details for ' + user.name);
    setSaveLabel('Save Changes');
    setMName(user.name);
    setMEmail(user.email);
    setMRole(user.role);
    setMStatus(user.status);
    setMPassword('');
    // Identity (email, role, password) is read-only after creation.
    setIdentityEditable(false);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingUserId(null);
    v.clearAllErrors();
  }

  function clearModalForm() {
    setMName('');
    setMEmail('');
    setMPassword('');
    setMRole('');
    setMStatus('active');
    v.clearAllErrors();
  }

  function saveUser() {
    const name = mName.trim();
    const email = mEmail.trim();
    const password = mPassword;
    const role = mRole;
    const status = mStatus;

    const rules = [
      { fieldId: 'mName', value: name, checks: [(val) => Validate.required(val, 'Name'), (val) => Validate.minLength(val, 2, 'Name')] },
      { fieldId: 'mEmail', value: email, checks: [Validate.email] },
      { fieldId: 'mRole', value: role, checks: [(val) => Validate.selected(val, 'role')] },
    ];

    if (!editingUserId) {
      rules.push({ fieldId: 'mPassword', value: password, checks: [Validate.password] });
    }

    const { valid } = v.form(rules);
    if (!valid) return;

    // Check email uniqueness
    const existing = Store.getUserByEmail(email);
    if (existing && existing.id !== editingUserId) {
      v.showError('mEmail', 'This email is already in use.');
      return;
    }

    if (editingUserId) {
      // Profile fields only; status has its own operations endpoint.
      const current = Store.getUserById(editingUserId);
      const initials = name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
      Store.updateUser(editingUserId, { name, avatar: initials });
      if (current && status !== current.status) {
        const result = Store.setUserStatus(editingUserId, status);
        if (!result.ok) {
          Validate.toast(result.message || 'The account status could not be changed.', 'error');
          return;
        }
      }
      Validate.toast('User updated successfully.', 'success');
    } else {
      const initials = name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
      Store.createUser({ name, email, password, role, status, avatar: initials, avatarColor: avatarColors[role] || '' });
      Validate.toast('User created successfully.', 'success');
    }

    refreshUsers();
    closeModal();
  }

  function toggleSuspend(id) {
    const user = Store.getUserById(id);
    if (!user) return;
    const newStatus = user.status === 'active' ? 'suspended' : 'active';
    Validate.confirm(
      `Are you sure you want to ${newStatus === 'suspended' ? 'suspend' : 'activate'} ${user.name}?`,
      () => {
        const result = Store.setUserStatus(id, newStatus);
        if (!result.ok) {
          Validate.toast(result.message || 'The account status could not be changed.', 'error');
          return;
        }
        refreshUsers();
        Validate.toast(`User ${newStatus === 'suspended' ? 'suspended' : 'activated'}.`, newStatus === 'suspended' ? 'warning' : 'success');
      },
    );
  }

  function deleteUser(id) {
    const user = Store.getUserById(id);
    if (!user) return;
    const session = Auth.getCurrentUser();
    if (session && session.userId === id) { Validate.toast('You cannot delete your own account.', 'error'); return; }

    Validate.confirm(
      `Permanently delete ${user.name}? This action cannot be undone.`,
      () => {
        Store.deleteUser(id);
        // The row fades out, then the table is rebuilt.
        setFadingId(id);
        setTimeout(() => { setFadingId(null); refreshUsers(); }, 300);
        Validate.toast('User deleted.', 'error');
      },
    );
  }

  const onField = (setter, id) => (e) => { setter(e.target.value); v.clearError(id); };

  return (
    <DashboardLayout role="superuser" activePath="superuser-users.html" pageTitle="Manage Users" pageSubtitle="Add, edit, suspend or delete platform users">
      <div className="su-toolbar">
        <input className="su-search" id="userSearch" placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="su-filter" id="roleFilter" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="all">All Roles</option>
          <option value="client">Client</option>
          <option value="worker">Worker</option>
          <option value="expert">Expert</option>
          <option value="superuser">Super User</option>
          <option value="revenue-admin">Revenue Admin</option>
          <option value="intake-admin">Intake Admin</option>
          <option value="compliance-admin">Compliance Admin</option>
        </select>
        <button className="btn-add" onClick={openAddModal}>
          <Icon name="plus" style={{ width: 16, height: 16 }} /> Add User
        </button>
      </div>

      <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--muted-foreground)' }}>Showing <strong id="userCount">{ready ? filtered.length + ' user' + (filtered.length !== 1 ? 's' : '') : ''}</strong></div>

      <div className="user-table-wrap">
        <table>
          <thead>
            <tr>
              <th>User</th><th>Role</th><th>Status</th><th>Joined</th><th>Wallet</th><th>Actions</th>
            </tr>
          </thead>
          <tbody id="usersTableBody">
            {!ready ? null : !filtered.length ? (
              <tr className="empty-row"><td colSpan={6}>No users found.</td></tr>
            ) : filtered.map((u) => (
              <tr key={u.id} id={`userRow_${u.id}`} style={fadingId === u.id ? { opacity: '0', transition: 'opacity 0.3s' } : undefined}>
                <td>
                  <div className="worker-cell">
                    <div className="worker-avatar" style={u.avatarColor ? { background: u.avatarColor } : undefined}>{u.avatar}</div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{u.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{u.email}</div>
                    </div>
                  </div>
                </td>
                <td><span className={`badge ${roleColors[u.role] || 'badge-blue'}`}>{u.role}</span></td>
                <td><span className={`badge ${u.status === 'active' ? 'badge-green' : 'badge-red'}`}>{u.status}</span></td>
                <td style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>{u.joinDate}</td>
                <td style={{ fontWeight: 600 }}>{`$${(u.walletBalance || 0).toLocaleString()}`}</td>
                <td>
                  <div className="action-btns">
                    <button className="btn-edit" onClick={() => openEditModal(u.id)}>Edit</button>
                    <button className="btn-suspend" onClick={() => toggleSuspend(u.id)}>{u.status === 'active' ? 'Suspend' : 'Activate'}</button>
                    <button className="btn-delete" onClick={() => deleteUser(u.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      <div className={'modal-overlay' + (modalOpen ? ' open' : '')} id="userModal" onClick={(e) => { if (e.target.id === 'userModal') closeModal(); }}>
        <div className="modal">
          <p className="modal-title" id="modalTitle">{modalTitle}</p>
          <p className="modal-sub" id="modalSub">{modalSub}</p>
          <div className="form-group">
            <label className="form-label">Full Name <span className="req">*</span></label>
            <input className="form-input" id="mName" placeholder="e.g. Jane Smith" style={v.fieldStyle('mName')} value={mName} onChange={onField(setMName, 'mName')} />
            {v.error('mName')}
          </div>
          <div className="form-group">
            <label className="form-label">Email <span className="req">*</span></label>
            <input className="form-input" id="mEmail" type="email" placeholder="user@example.com" disabled={!identityEditable} style={v.fieldStyle('mEmail')} value={mEmail} onChange={onField(setMEmail, 'mEmail')} />
            {v.error('mEmail')}
          </div>
          <div className="form-group">
            <label className="form-label">Password <span className="req" id="pwRequired">*</span></label>
            <input className="form-input" id="mPassword" type="password" placeholder="Leave blank to keep existing" disabled={!identityEditable} style={v.fieldStyle('mPassword')} value={mPassword} onChange={onField(setMPassword, 'mPassword')} />
            {v.error('mPassword')}
          </div>
          <div className="form-group">
            <label className="form-label">Role <span className="req">*</span></label>
            <select className="form-select" id="mRole" disabled={!identityEditable} style={v.fieldStyle('mRole')} value={mRole} onChange={onField(setMRole, 'mRole')}>
              <option value="">Select role</option>
              <option value="client">Client</option>
              <option value="worker">Worker</option>
              <option value="expert">Expert</option>
              <option value="superuser">Super User</option>
              <option value="revenue-admin">Revenue Admin</option>
              <option value="intake-admin">Intake Admin</option>
              <option value="compliance-admin">Compliance Admin</option>
            </select>
            {v.error('mRole')}
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" id="mStatus" value={mStatus} onChange={(e) => setMStatus(e.target.value)}>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
          <div className="modal-actions">
            <button className="btn-cancel-modal" onClick={closeModal}>Cancel</button>
            <button className="btn-save-modal" id="saveModalBtn" onClick={saveUser}>{saveLabel}</button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
