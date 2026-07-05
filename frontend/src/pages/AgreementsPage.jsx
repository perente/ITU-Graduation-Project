import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { getMyAgreements, getPendingAgreements } from '../services/agreementService.js'
import StatusBadge from '../components/StatusBadge.jsx'

function fmtDate(d) {
  if (!d) return '—'
  return d.split('T')[0]
}

function shortId(id) {
  if (!id) return '—'
  return id.length > 22 ? id.slice(0, 22) + '…' : id
}

export default function AgreementsPage() {
  const { user } = useAuth()
  const [myList, setMyList] = useState([])
  const [pendingList, setPendingList] = useState([])
  const [tab, setTab] = useState('all')
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

  const shown = tab === 'pending' ? pendingList : myList

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Staj Anlaşmaları</h1>
        {user.role === 'student' && (
          <Link to="/agreements/new" className="btn-primary">+ Yeni Anlaşma</Link>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="tab-bar">
        <button
          className={`tab-btn ${tab === 'all' ? 'active' : ''}`}
          onClick={() => setTab('all')}
        >
          Tüm Anlaşmalar
          <span className="tab-count">{myList.length}</span>
        </button>
        <button
          className={`tab-btn ${tab === 'pending' ? 'active' : ''}`}
          onClick={() => setTab('pending')}
        >
          Bekleyenler
          <span className="tab-count">{pendingList.length}</span>
        </button>
      </div>

      {shown.length === 0 ? (
        <div className="empty-state">
          <p>{tab === 'pending' ? 'Bekleyen anlaşma yok.' : 'Henüz anlaşma bulunmuyor.'}</p>
          {user.role === 'student' && tab === 'all' && (
            <Link to="/agreements/new" className="btn-primary">İlk Anlaşmayı Oluştur</Link>
          )}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Anlaşma ID</th>
                <th>Durum</th>
                <th>Öğrenci</th>
                <th>Şirket</th>
                <th>Fakülte</th>
                <th>Başlangıç</th>
                <th>Bitiş</th>
                <th>Tür</th>
                <th>Alan</th>
                <th>İş Günü</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((a) => {
                const aid = a.agreementId || a.id
                return (
                  <tr key={aid}>
                    <td className="mono-sm" title={aid}>{shortId(aid)}</td>
                    <td><StatusBadge status={a.status} /></td>
                    <td>{a.studentId || '—'}</td>
                    <td>{a.companyId || '—'}</td>
                    <td>{a.facultyId || '—'}</td>
                    <td>{fmtDate(a.startDate)}</td>
                    <td>{fmtDate(a.endDate)}</td>
                    <td>{a.internshipType === 'MANDATORY' ? 'Zorunlu' : a.internshipType === 'VOLUNTARY' ? 'Gönüllü' : '—'}</td>
                    <td>{a.internshipField || '—'}</td>
                    <td>{a.totalWorkingDays ?? '—'}</td>
                    <td>
                      <Link to={`/agreements/${aid}`} className="table-link">Detay →</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
