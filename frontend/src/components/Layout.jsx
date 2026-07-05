import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

const NAV = {
  student: [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/agreements', label: 'Anlaşmalar' },
    { path: '/agreements/new', label: 'Yeni Anlaşma' },
    { path: '/company-request', label: 'Şirket Talebi' },
  ],
  company: [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/agreements', label: 'Anlaşmalar' },
  ],
  faculty: [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/agreements', label: 'Anlaşmalar' },
  ],
  central: [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/agreements', label: 'Anlaşmalar' },
    { path: '/company-requests', label: 'Şirket Talepleri' },
  ],
}

const ROLE_LABELS = {
  student: 'Öğrenci',
  company: 'Şirket',
  faculty: 'Fakülte',
  central: 'Merkez Ofis',
}

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const navItems = NAV[user?.role] || []

  function handleLogout() {
    logout()
    navigate('/login')
  }

  function isActive(path) {
    if (path === '/agreements/new') return location.pathname === path
    if (path === '/agreements') return location.pathname.startsWith('/agreements') && location.pathname !== '/agreements/new'
    return location.pathname === path
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <span className="brand-logo">SC</span>
          <span className="brand-name">StajChain</span>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-link ${isActive(item.path) ? 'active' : ''}`}
              onClick={() => setMobileOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-block">
            <div className="user-name">{user?.name} {user?.surname}</div>
            <div className="user-role">{ROLE_LABELS[user?.role] || user?.role}</div>
            <div className="user-email">{user?.email}</div>
          </div>
          <button className="btn-logout" onClick={handleLogout}>
            Çıkış Yap
          </button>
        </div>
      </aside>

      <div className="mobile-bar">
        <span className="brand-name">StajChain</span>
        <button
          className="burger-btn"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Menü"
        >
          {mobileOpen ? '✕' : '☰'}
        </button>
      </div>

      {mobileOpen && (
        <div className="mobile-overlay" onClick={() => setMobileOpen(false)} />
      )}

      <main className="main-content">{children}</main>
    </div>
  )
}
