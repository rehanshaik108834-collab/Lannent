import { useEffect, useRef, useState } from 'react';
import { Store } from '../lib/store';
import { Auth } from '../lib/auth';
import { go } from '../lib/nav';
import Icon from './Icon';
import A from './A';

/**
 * LANNENT — Dashboard Layout
 * React port of initDashboard() from front-end/js/dashboard.js: the same
 * sidebar, top navigation, notification and user menus, with the same markup.
 *
 *   <DashboardLayout role="worker" activePath="worker-dashboard.html"
 *                    pageTitle="Dashboard" pageSubtitle="...">
 *     ...page content...
 *   </DashboardLayout>
 */

const clientItems = [
  { icon: 'layout-dashboard', label: 'Dashboard', path: 'client-dashboard.html' },
  { icon: 'folder-kanban', label: 'My Projects', path: 'client-my-projects.html' },
  { icon: 'plus-circle', label: 'Post Task', path: 'post-task.html' },
  { icon: 'user-plus', label: 'Hire Workers', path: 'hire-gig-workers.html' },
  { icon: 'users', label: 'Worker Applications', path: 'worker-applications.html' },
  { icon: 'shield-check', label: 'Audit Offers', path: 'client-audit-offers.html' },
  { icon: 'wallet', label: 'Wallet', path: 'client-wallet.html' },
  { icon: 'message-square', label: 'Messages', path: 'messages.html' },
  { icon: 'file-text', label: 'Reports', path: 'milestone-reports.html' },
  { icon: 'settings', label: 'Settings', path: 'profile-settings.html' },
];
const workerItems = [
  { icon: 'layout-dashboard', label: 'Dashboard', path: 'worker-dashboard.html' },
  { icon: 'search', label: 'Browse Tasks', path: 'browse-tasks.html' },
  { icon: 'folder-kanban', label: 'My Projects', path: 'worker-my-projects.html' },
  { icon: 'mail', label: 'Invitations', path: 'worker-invitations.html' },
  { icon: 'file-text', label: 'My Proposals', path: 'my-proposals.html' },
  { icon: 'wallet', label: 'Wallet', path: 'worker-wallet.html' },
  { icon: 'message-square', label: 'Messages', path: 'messages.html' },
  { icon: 'file-text', label: 'Reports', path: 'milestone-reports.html' },
  { icon: 'settings', label: 'Settings', path: 'worker-settings.html' },
];
const expertItems = [
  { icon: 'layout-dashboard', label: 'Dashboard', path: 'expert-dashboard.html' },
  { icon: 'clipboard-check', label: 'Audit Requests', path: 'expert-audit-requests.html' },
  { icon: 'scale', label: 'Dispute Cases', path: 'expert-dispute-cases.html' },
  { icon: 'file-text', label: 'Reports', path: 'expert-reports.html' },
  { icon: 'message-square', label: 'Messages', path: 'messages.html' },
  { icon: 'settings', label: 'Settings', path: 'expert-settings.html' },
];
const superItems = [
  { icon: 'layout-dashboard', label: 'Dashboard', path: 'superuser-dashboard.html' },
  { icon: 'users', label: 'Manage Users', path: 'superuser-users.html' },
  { icon: 'folder-kanban', label: 'Manage Tasks', path: 'superuser-tasks.html' },
  { icon: 'wallet', label: 'Escrow & Finance', path: 'superuser-escrow.html' },
];

// The single admin desk is now three, and each sees only its own work.
const STAFF_ROLES = ['superuser', 'revenue-admin', 'intake-admin', 'compliance-admin'];
const revenueAdminItems = [
  { icon: 'trending-up', label: 'Revenue', path: 'admin-revenue.html' },
  { icon: 'percent', label: 'Fee Configuration', path: 'admin-fee-config.html' },
];
const intakeAdminItems = [
  { icon: 'shield-check', label: 'Expert Applications', path: 'admin-expert-applications.html' },
];
// Everything compliance reaches is read-only.
const complianceAdminItems = [
  { icon: 'clipboard-list', label: 'Audit Log', path: 'compliance-dashboard.html' },
  { icon: 'trending-up', label: 'Revenue', path: 'admin-revenue.html' },
  { icon: 'shield-check', label: 'Applications', path: 'admin-expert-applications.html' },
];

function menuFor(role) {
  return role === 'worker' ? workerItems
    : role === 'expert' ? expertItems
    : role === 'superuser' ? superItems
    : role === 'revenue-admin' ? revenueAdminItems
    : role === 'intake-admin' ? intakeAdminItems
    : role === 'compliance-admin' ? complianceAdminItems
    : clientItems;
}

function notifIcon(type) {
  switch (type) {
    case 'milestone-approved': return { icon: 'check-circle', color: '#10b981', bg: '#d1fae5' };
    case 'payment': return { icon: 'wallet', color: '#6366f1', bg: '#e0e7ff' };
    case 'message': return { icon: 'message-square', color: '#3b82f6', bg: '#dbeafe' };
    case 'dispute': return { icon: 'alert-triangle', color: '#f59e0b', bg: '#fef3c7' };
    case 'proposal': return { icon: 'file-text', color: '#8b5cf6', bg: '#ede9fe' };
    case 'hire': return { icon: 'user-check', color: '#10b981', bg: '#d1fae5' };
    default: return { icon: 'bell', color: '#64748b', bg: '#f1f5f9' };
  }
}

export default function DashboardLayout({ role = 'client', activePath = '', pageTitle = 'Dashboard', pageSubtitle = '', children }) {
  // Read real user from session, with the original per-role defaults.
  const session = Auth.getCurrentUser();
  let userName =
    role === 'worker' ? 'Alex W.'
    : role === 'expert' ? 'Dr. Jane S.'
    : role === 'superuser' ? 'Super Admin'
    : role === 'revenue-admin' ? 'Revenue Admin'
    : role === 'intake-admin' ? 'Intake Admin'
    : role === 'compliance-admin' ? 'Compliance'
    : 'James Client';
  let userInitials = role === 'worker' ? 'AW' : role === 'expert' ? 'JS' : role === 'superuser' ? 'SA' : 'JC';
  let userEmail = userName.toLowerCase().replace(/\s+/g, '') + '@lannent.com';
  let avatarColor = '';
  let currentUserId = '';
  if (session) {
    userName = session.name || userName;
    userInitials = session.avatar || userInitials;
    userEmail = session.email || userEmail;
    avatarColor = session.avatarColor || '';
    currentUserId = session.userId || '';
  }

  const [notifications, setNotifications] = useState(() => (currentUserId ? Store.getNotifications(currentUserId) || [] : []));
  const [allRead, setAllRead] = useState(false);
  const unreadCount = allRead ? 0 : notifications.filter((n) => !n.read).length;

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const userMenuBtnRef = useRef(null);
  const userMenuRef = useRef(null);
  const notifBtnRef = useRef(null);
  const notifRef = useRef(null);

  // Outside clicks close both menus.
  useEffect(() => {
    const onDocClick = (event) => {
      if (!userMenuRef.current?.contains(event.target) && event.target !== userMenuBtnRef.current) setUserMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(event.target) && !notifBtnRef.current?.contains(event.target)) setNotifOpen(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const settingsPage = role === 'worker' ? 'worker-settings.html'
    : role === 'expert' ? 'expert-settings.html'
    : STAFF_ROLES.includes(role) ? 'staff-settings.html'
    : 'profile-settings.html';

  const onUserMenuClick = (e) => {
    const action = e.target.closest('[data-action]')?.dataset?.action;
    if (!action) return;
    switch (action) {
      case 'profile':
      case 'settings':
        go(settingsPage);
        break;
      case 'signout':
        Auth.logout();
        break;
      default:
    }
    setUserMenuOpen(false);
  };

  const markAllRead = (e) => {
    e.stopPropagation();
    if (currentUserId) Store.markNotificationsRead(currentUserId);
    setNotifications((list) => list.map((n) => ({ ...n, read: true })));
    setAllRead(true);
  };

  const menuItems = menuFor(role);
  const offline = Store.isOnline && !Store.isOnline();

  return (
    <div className="dashboard-layout">
      {/* SIDEBAR */}
      <aside className={'sidebar ' + (collapsed ? 'collapsed' : 'expanded')} id="sidebar">
        <div className="sidebar-logo">
          <A href="../index.html" className="sidebar-logo-link">
            <div className="sidebar-logo-icon">L</div>
            <span className="sidebar-logo-text">Lannent<span>.</span></span>
          </A>
        </div>
        <nav className="sidebar-nav">
          {menuItems.map((item) => {
            const isActive = activePath && (activePath === item.path || window.location.pathname.endsWith(item.path));
            return (
              <A key={item.path + item.label} href={item.path} className={'sidebar-item' + (isActive ? ' active' : '')}>
                <span className="sidebar-item-icon">
                  <Icon name={item.icon} style={{ width: 20, height: 20 }} />
                  {item.iconBadge ? <span className="icon-badge">{item.iconBadge}</span> : null}
                </span>
                <span className="sidebar-item-label">{item.label}</span>
                {item.badge ? <span className="sidebar-badge">{item.badge}</span> : null}
              </A>
            );
          })}
        </nav>
        <div className="sidebar-footer" style={{ padding: 24 }}>
          <button className="sidebar-toggle" id="sidebarToggle" title="Collapse sidebar" style={{ borderRadius: 16 }} onClick={() => setCollapsed((c) => !c)}>
            {/* The original meant to flip this to chevron-right, but every page
                re-ran lucide.createIcons() after initDashboard, detaching the
                element it updated, so the chevron always stayed pointing left. */}
            <Icon name="chevron-left" style={{ width: 20, height: 20 }} id="sidebarChevron" />
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className={'main-content ' + (collapsed ? 'sidebar-collapsed' : 'sidebar-expanded')} id="mainContent">
        {/* TOP NAV */}
        <header className="topnav">
          <div className="topnav-text" title="Lannent Platform" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 500, color: 'var(--muted-foreground)' }}>
            <Icon name="sparkles" style={{ width: 16, height: 16, color: '#8b5cf6' }} />
            <span>Empowering World-Class Builders</span>
          </div>
          <div className="topnav-actions">
            <button
              className="topnav-btn"
              id="notifBellBtn"
              title="Notifications"
              style={{ position: 'relative' }}
              ref={notifBtnRef}
              onClick={(e) => { e.stopPropagation(); setUserMenuOpen(false); setNotifOpen((o) => !o); }}
            >
              <Icon name="bell" style={{ width: 18, height: 18 }} />
              {unreadCount > 0 ? <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span> : null}
            </button>
            <div className={'notif-dropdown' + (notifOpen ? ' active' : '')} id="notifDropdown" aria-hidden={String(!notifOpen)} ref={notifRef}>
              <div className="notif-dropdown-header">
                <span className="notif-dropdown-title">Notifications</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {unreadCount > 0 ? <span className="notif-count-badge">{unreadCount} new</span> : null}
                  {unreadCount > 0 ? (
                    <button className="notif-mark-read-btn" id="markAllReadBtn" title="Mark all as read" onClick={markAllRead}>
                      <Icon name="check-check" style={{ width: 14, height: 14 }} />
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="notif-dropdown-list">
                {notifications.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>
                    <Icon name="bell-off" style={{ width: 32, height: 32, margin: '0 auto 8px', display: 'block', opacity: 0.4 }} />
                    No notifications yet
                  </div>
                ) : (
                  notifications.slice(0, 8).map((n) => {
                    const ni = notifIcon(n.type);
                    return (
                      <div key={n.id} className={'notif-item' + (n.read ? '' : ' unread')} data-notif-id={n.id}>
                        <div className="notif-icon" style={{ background: ni.bg, color: ni.color }}>
                          <Icon name={ni.icon} style={{ width: 16, height: 16 }} />
                        </div>
                        <div className="notif-body">
                          <p className="notif-text">{n.text}</p>
                          <p className="notif-sub">{n.subtext || ''}</p>
                        </div>
                        {!n.read ? <div className="notif-unread-dot" /> : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            <div
              className="topnav-avatar"
              id="userMenuBtn"
              title={userName}
              style={avatarColor ? { background: avatarColor } : undefined}
              ref={userMenuBtnRef}
              onClick={(e) => { e.stopPropagation(); setUserMenuOpen((o) => !o); }}
            >
              {userInitials}
            </div>
            <div className={'topnav-user-menu' + (userMenuOpen ? ' active' : '')} id="userMenuDropdown" aria-hidden={String(!userMenuOpen)} ref={userMenuRef} onClick={onUserMenuClick}>
              <div className="user-menu-head">
                <div className="user-menu-name">{userName}</div>
                <div className="user-menu-email">{userEmail}</div>
              </div>
              <div className="user-menu-actions">
                <button className="user-menu-item" data-action="profile"><Icon name="user" /> Profile</button>
                <button className="user-menu-item" data-action="settings"><Icon name="settings" /> Settings</button>
              </div>
              <button className="user-menu-signout" data-action="signout"><Icon name="log-out" /> Sign Out</button>
            </div>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main className="page-content" id="pageContent">
          <div className="page-header">
            <h1 className="page-title">{pageTitle}</h1>
            {pageSubtitle ? <p className="page-sub">{pageSubtitle}</p> : null}
          </div>
          {offline ? (
            <div className="offline-banner" role="alert">
              <Icon name="plug-zap" style={{ width: 18, height: 18, flex: 'none' }} />
              <div>
                <strong>Backend unavailable.</strong>
                {' '}This page has no data to show. Start the API with
                {' '}<code>npm run start:dev</code> in <code>back-end/</code>, then reload.
              </div>
            </div>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * renderEmptyState() from dashboard.js: an empty/error state inside the normal
 * dashboard shell.
 */
export function EmptyState({ role = 'client', activePath = '', pageTitle = 'Nothing to show', message = 'There is nothing to display here yet.', linkHref = '', linkLabel = '' }) {
  return (
    <DashboardLayout role={role} activePath={activePath} pageTitle={pageTitle} pageSubtitle="">
      <div style={{ padding: '56px 24px', textAlign: 'center', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16 }}>
        <div style={{ fontSize: 15, color: 'var(--muted-foreground)', marginBottom: linkHref ? '18px' : '0' }}>{message}</div>
        {linkHref ? <A href={linkHref} className="btn-primary" style={{ textDecoration: 'none' }}>{linkLabel || 'Go back'}</A> : null}
      </div>
    </DashboardLayout>
  );
}
