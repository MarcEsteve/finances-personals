import { NavLink } from 'react-router-dom'
import styles from './Header.module.css'

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/ingressos', label: 'Ingressos' },
  { to: '/despeses', label: 'Despeses' },
  { to: '/impostos', label: 'Impostos' },
  { to: '/estalvis', label: 'Estalvis' },
  { to: '/informes', label: 'Informes' },
  { to: '/clients', label: 'Clients' },
]

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <img src="/finpers26-icon.png" alt="Finances Personals" className={styles.logo} />
        <h1 className={styles.title}>Finances Personals 2026</h1>
      </div>
      <nav className={styles.nav}>
        {navItems.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
