import { Notifications } from '../../features/notifications/Notifications';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../features/auth/auth-context';
import { portalRoutes } from '../routes/registry';
import styles from './PortalLayout.module.css';

export function PortalLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  if (!user) return null;
  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <Link className="brand" to="/">
          Lannent.
        </Link>
        <button
          aria-expanded={open}
          aria-controls="portal-navigation"
          onClick={() => setOpen(!open)}
        >
          Menu
        </button>
        <span>{user.name}</span>
        <Notifications />
        <button onClick={logout}>Sign out</button>
      </header>
      <aside className={`${styles.sidebar} ${open ? styles.open : ''}`}>
        <nav id="portal-navigation" aria-label="Portal navigation">
          {portalRoutes
            .filter((route) => route.nav && route.roles.includes(user.role))
            .map((route) => (
              <NavLink
                key={route.path}
                to={route.path}
                onClick={() => setOpen(false)}
                className={({ isActive }) => (isActive ? styles.active : '')}
              >
                {route.label}
              </NavLink>
            ))}
        </nav>
      </aside>
      <main id="main" className={styles.content}>
        {children}
      </main>
    </div>
  );
}
