import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { login } from '../services/authService.js'

const DEMO = [
  { label: 'Öğrenci', email: 'student1@itu.edu.tr', password: '123456' },
  { label: 'Şirket B', email: 'companyb@company.com', password: '123456' },
  { label: 'Fakülte', email: 'faculty@itu.edu.tr', password: '123456' },
  { label: 'Merkez', email: 'central@itu.edu.tr', password: '123456' },
]

export default function LoginPage() {
  const [loginIdentifier, setLoginIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await login(loginIdentifier, password)
      signIn(data.token, data.user)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Giriş başarısız.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-header">
          <div className="login-logo">SC</div>
          <h1 className="login-title">StajChain</h1>
          <p className="login-subtitle">Staj Anlaşma Yönetim Sistemi</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="alert alert-error">{error}</div>}

          <div className="field">
            <label htmlFor="loginIdentifier">E-posta veya Kullanıcı Adı</label>
            <input
              id="loginIdentifier"
              type="text"
              value={loginIdentifier}
              onChange={(e) => setLoginIdentifier(e.target.value)}
              placeholder="ornek@itu.edu.tr veya kullanici_adi"
              required
              autoFocus
            />
          </div>

          <div className="field">
            <label htmlFor="password">Şifre</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-primary btn-full" disabled={loading}>
            {loading ? 'Giriş yapılıyor…' : 'Giriş Yap'}
          </button>
        </form>

        <div className="demo-section">
          <p className="demo-label">Demo hesaplar</p>
          <div className="demo-chips">
            {DEMO.map((d) => (
              <button
                key={d.email}
                type="button"
                className="demo-chip"
                onClick={() => {
                  setLoginIdentifier(d.email)
                  setPassword(d.password)
                }}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
