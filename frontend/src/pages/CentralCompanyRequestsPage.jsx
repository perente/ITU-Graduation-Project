import React, { useEffect, useState } from 'react'
import {
  getPendingCompanyRequests,
  getCompanyRequestById,
  approveCompanyRequest,
  rejectCompanyRequest,
} from '../services/companyService.js'

const STATUS_LABEL = { PENDING: 'Bekliyor', APPROVED: 'Onaylandı', REJECTED: 'Reddedildi' }
const STATUS_CLS = { PENDING: 'badge-warning', APPROVED: 'badge-success', REJECTED: 'badge-danger' }

function fmtDT(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('tr-TR')
}

function Row({ label, value }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value ?? '—'}</dd>
    </>
  )
}

export default function CentralCompanyRequestsPage() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [selected, setSelected] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionMsg, setActionMsg] = useState({ type: '', text: '' })
  const [credentials, setCredentials] = useState(null)

  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  async function loadList() {
    try {
      const res = await getPendingCompanyRequests()
      setRequests(res.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadList() }, [])

  async function openDetail(req) {
    setDetailLoading(true)
    setActionMsg({ type: '', text: '' })
    setCredentials(null)
    try {
      const res = await getCompanyRequestById(req.id)
      setSelected(res.data)
    } catch (err) {
      setActionMsg({ type: 'error', text: err.message })
    } finally {
      setDetailLoading(false)
    }
  }

  async function handleApprove() {
    if (!selected) return
    setActionLoading(true)
    setActionMsg({ type: '', text: '' })
    setCredentials(null)
    try {
      const res = await approveCompanyRequest(selected.id)
      setCredentials(res.data?.credentials || null)
      setSelected((p) => ({ ...p, requestStatus: 'APPROVED' }))
      setActionMsg({ type: 'success', text: 'Şirket talebi onaylandı.' })
      loadList()
    } catch (err) {
      setActionMsg({ type: 'error', text: err.message })
    } finally {
      setActionLoading(false)
    }
  }

  async function handleReject() {
    if (!selected || !rejectReason.trim()) return
    setActionLoading(true)
    setActionMsg({ type: '', text: '' })
    try {
      await rejectCompanyRequest(selected.id, rejectReason.trim())
      setShowRejectModal(false)
      setRejectReason('')
      setSelected((p) => ({ ...p, requestStatus: 'REJECTED' }))
      setActionMsg({ type: 'success', text: 'Talep reddedildi.' })
      loadList()
    } catch (err) {
      setActionMsg({ type: 'error', text: err.message })
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) return <div className="page-loading"><div className="spinner" /></div>

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Şirket Talepleri</h1>
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="split-layout">
        {/* List panel */}
        <div className="split-list">
          {requests.length === 0 ? (
            <div className="empty-state"><p>Bekleyen talep yok.</p></div>
          ) : (
            requests.map((req) => {
              const st = req.requestStatus || 'PENDING'
              return (
                <button
                  key={req.id}
                  className={`req-item ${selected?.id === req.id ? 'active' : ''}`}
                  onClick={() => openDetail(req)}
                >
                  <span className="req-name">{req.companyName}</span>
                  <span className={`status-badge ${STATUS_CLS[st] || 'badge-neutral'}`}>
                    {STATUS_LABEL[st] || st}
                  </span>
                  <span className="req-date">{fmtDT(req.createdAt)}</span>
                </button>
              )
            })
          )}
        </div>

        {/* Detail panel */}
        <div className="split-detail">
          {detailLoading && <div className="page-loading"><div className="spinner" /></div>}

          {!detailLoading && !selected && (
            <div className="empty-state"><p>Bir talep seçin.</p></div>
          )}

          {!detailLoading && selected && (
            <>
              <h2 className="card-title">{selected.companyName}</h2>

              {actionMsg.text && (
                <div className={`alert ${actionMsg.type === 'success' ? 'alert-success' : 'alert-error'}`}>
                  {actionMsg.text}
                </div>
              )}

              {credentials && (
                <div className="credentials-box">
                  <h4 className="cred-title">Şirket Hesap Bilgileri</h4>
                  <p className="cred-desc">
                    Bu bilgileri şirkete iletin. Geçici şifre yalnızca şimdi görüntülenebilir.
                  </p>
                  <dl className="detail-dl">
                    <dt>Kullanıcı Adı</dt>
                    <dd><span className="mono-sm">{credentials.username}</span></dd>
                    <dt>Geçici Şifre</dt>
                    <dd><span className="mono-sm cred-password">{credentials.temporaryPassword}</span></dd>
                  </dl>
                </div>
              )}

              <dl className="detail-dl">
                <Row label="Talep ID" value={<span className="mono-sm">#{selected.id}</span>} />
                <Row label="Şirket Adı" value={selected.companyName} />
                <Row label="Unvan" value={selected.companyTitle} />
                <Row label="Adres" value={selected.companyAddress} />
                <Row label="Telefon" value={selected.companyPhoneNumber} />
                <Row label="Faks" value={selected.companyFaxNumber} />
                <Row label="E-posta" value={selected.companyEmail} />
                <Row label="Kamu Kurumu" value={selected.isPublicInstitution ? 'Evet' : 'Hayır'} />
                <Row label="IBAN" value={<span className="mono-sm">{selected.companyIban}</span>} />
                <Row label="Banka" value={selected.companyBankName} />
                <Row label="Şube Kodu" value={selected.companyBankBranchCode} />
                <Row label="Şube Adı" value={selected.companyBankBranchName} />
                <Row label="Mersis Numarası" value={selected.companyRegistrationNumber || '—'} />
                <Row label="Vergi Kimlik Numarası" value={selected.companyTaxIdentificationNumber || '—'} />
                <Row label="Talep Tarihi" value={fmtDT(selected.createdAt)} />
                <dt>Durum</dt>
                <dd>
                  <span className={`status-badge ${STATUS_CLS[selected.requestStatus] || 'badge-neutral'}`}>
                    {STATUS_LABEL[selected.requestStatus] || selected.requestStatus}
                  </span>
                </dd>
              </dl>

              {selected.requestStatus === 'PENDING' && (
                <div className="action-bar">
                  <button
                    className="btn-primary"
                    disabled={actionLoading}
                    onClick={handleApprove}
                  >
                    {actionLoading ? 'İşleniyor…' : 'Onayla'}
                  </button>
                  <button
                    className="btn-danger"
                    disabled={actionLoading}
                    onClick={() => setShowRejectModal(true)}
                  >
                    Reddet
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showRejectModal && (
        <div className="modal-backdrop" onClick={() => setShowRejectModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Red Sebebi</h3>
            <div className="field">
              <label>Açıklama *</label>
              <textarea
                rows={4}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Red sebebini belirtin…"
              />
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowRejectModal(false)}>İptal</button>
              <button
                className="btn-danger"
                disabled={actionLoading || !rejectReason.trim()}
                onClick={handleReject}
              >
                {actionLoading ? 'İşleniyor…' : 'Reddet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
