import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { getMyAgreements, getPendingAgreements } from '../services/agreementService.js'
import StatusBadge from '../components/StatusBadge.jsx'

const ROLE_LABELS = {
  student: 'Öğrenci',
  company: 'Şirket',
  faculty: 'Fakülte',
  central: 'Merkez Ofis',
}

function shortId(id) {
  if (!id) return '—'
  return id.length > 20 ? id.slice(0, 20) + '…' : id
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [myList, setMyList] = useState([])
  const [pendingList, setPendingList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const [myRes, pendRes] = await Promise.all([
          getMyAgreements(),
          getPendingAgreements(),
        ])
        setMyList(myRes.data || [])
        setPendingList(pendRes.data || [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <div className="page-loading"><div className="spinner" /></div>

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">
            {user.name} {user.surname} &mdash; {ROLE_LABELS[user.role] || user.role}
          </p>
        </div>
        <div className="header-actions">
          {user.role === 'student' && (
            <>
              <Link to="/agreements/new" className="btn-primary">Yeni Anlaşma</Link>
              <Link to="/company-request" className="btn-secondary">Şirket Talebi</Link>
            </>
          )}
          {user.role === 'central' && (
            <Link to="/company-requests" className="btn-secondary">Şirket Talepleri</Link>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="stat-row">
        <div className="stat-card">
          <div className="stat-num">{myList.length}</div>
          <div className="stat-label">Toplam Anlaşma</div>
        </div>
        <div className="stat-card stat-accent">
          <div className="stat-num">{pendingList.length}</div>
          <div className="stat-label">Bekleyen Aksiyon</div>
        </div>
        {user.role === 'student' && (
          <div className="stat-card">
            <div className="stat-num">{user.completedCredits ?? '—'}</div>
            <div className="stat-label">Tamamlanan Kredi</div>
          </div>
        )}
      </div>

      {pendingList.length > 0 && (
        <section className="section">
          <h2 className="section-title">Bekleyen Aksiyonlar</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Anlaşma ID</th>
                  <th>Durum</th>
                  <th>Öğrenci</th>
                  <th>Şirket</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pendingList.map((a) => {
                  const aid = a.agreementId || a.id
                  return (
                    <tr key={aid}>
                      <td className="mono-sm">{shortId(aid)}</td>
                      <td><StatusBadge status={a.status} /></td>
                      <td>{a.studentId || '—'}</td>
                      <td>{a.companyId || '—'}</td>
                      <td>
                        <Link to={`/agreements/${aid}`} className="table-link">Detay →</Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {myList.length > 0 && (
        <section className="section">
          <div className="section-header">
            <h2 className="section-title">Son Anlaşmalar</h2>
            <Link to="/agreements" className="link-muted">Tümünü gör →</Link>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Anlaşma ID</th>
                  <th>Durum</th>
                  <th>Şirket</th>
                  <th>Başlangıç</th>
                  <th>Bitiş</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {myList.slice(0, 5).map((a) => {
                  const aid = a.agreementId || a.id
                  return (
                    <tr key={aid}>
                      <td className="mono-sm">{shortId(aid)}</td>
                      <td><StatusBadge status={a.status} /></td>
                      <td>{a.companyId || '—'}</td>
                      <td>{a.startDate ? a.startDate.split('T')[0] : '—'}</td>
                      <td>{a.endDate ? a.endDate.split('T')[0] : '—'}</td>
                      <td>
                        <Link to={`/agreements/${aid}`} className="table-link">Detay →</Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {myList.length === 0 && !loading && (
        <div className="empty-state">
          <p>Henüz anlaşma bulunmuyor.</p>
          {user.role === 'student' && (
            <Link to="/agreements/new" className="btn-primary">İlk Anlaşmayı Oluştur</Link>
          )}
        </div>
      )}
    </div>
  )
}
