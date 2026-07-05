import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import {
  getAgreementById,
  getAgreementHistory,
  approveAgreement,
  rejectAgreement,
  activateAgreement,
  completeAgreement,
} from '../services/agreementService.js'
import StatusBadge from '../components/StatusBadge.jsx'

const REJECTION_REASONS = [
  { value: 'MISSING_DOCUMENT', label: 'Eksik Belge' },
  { value: 'INVALID_INFORMATION', label: 'Geçersiz Bilgi' },
  { value: 'STUDENT_WITHDREW', label: 'Öğrenci Geri Çekti' },
  { value: 'OTHER', label: 'Diğer' },
]

const TYPE_LABEL = { MANDATORY: 'Zorunlu', VOLUNTARY: 'Gönüllü' }
const ROLE_LABEL = { student: 'Öğrenci', company: 'Şirket', faculty: 'Fakülte', central: 'Merkez' }
const REJ_LABEL = {
  MISSING_DOCUMENT: 'Eksik Belge',
  INVALID_INFORMATION: 'Geçersiz Bilgi',
  STUDENT_WITHDREW: 'Öğrenci Geri Çekti',
  OTHER: 'Diğer',
}

function fmtDate(d) {
  if (!d) return '—'
  return d.split('T')[0]
}
function fmtDT(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('tr-TR')
}

function getActions(role, status) {
  const acts = []
  if (role === 'student') {
    if (status === 'CREATED') acts.push('approve', 'reject')
    if (status === 'STUDENT_APPROVED' || status === 'COMPANY_APPROVED') acts.push('reject')
  }
  if (role === 'company' && status === 'STUDENT_APPROVED') acts.push('approve', 'reject')
  if (role === 'faculty' && status === 'COMPANY_APPROVED') acts.push('approve', 'reject')
  if (role === 'central' && status === 'FACULTY_APPROVED') acts.push('activate')
  if (role === 'central' && status === 'ACTIVE') acts.push('complete')
  return acts
}

function DetailRow({ label, value }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value ?? '—'}</dd>
    </>
  )
}

export default function AgreementDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [ag, setAg] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionMsg, setActionMsg] = useState({ type: '', text: '' })
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('MISSING_DOCUMENT')

  async function loadData() {
    try {
      const [agRes, histRes] = await Promise.all([
        getAgreementById(id),
        getAgreementHistory(id),
      ])
      setAg(agRes.data)
      setHistory(histRes.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [id])

  async function doAction(action) {
    setActionMsg({ type: '', text: '' })
    setActionLoading(true)
    try {
      if (action === 'approve') await approveAgreement(id)
      else if (action === 'activate') await activateAgreement(id)
      else if (action === 'complete') await completeAgreement(id)
      setActionMsg({ type: 'success', text: 'İşlem başarıyla tamamlandı.' })
      const res = await getAgreementById(id)
      setAg(res.data)
    } catch (err) {
      setActionMsg({ type: 'error', text: err.message })
    } finally {
      setActionLoading(false)
    }
  }

  async function doReject() {
    setActionMsg({ type: '', text: '' })
    setActionLoading(true)
    try {
      await rejectAgreement(id, rejectReason)
      setShowRejectModal(false)
      setActionMsg({ type: 'success', text: 'Anlaşma reddedildi.' })
      const res = await getAgreementById(id)
      setAg(res.data)
    } catch (err) {
      setActionMsg({ type: 'error', text: err.message })
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) return <div className="page-loading"><div className="spinner" /></div>
  if (error) return <div className="page"><div className="alert alert-error">{error}</div></div>
  if (!ag) return <div className="page"><div className="empty-state"><p>Anlaşma bulunamadı.</p></div></div>

  const actions = getActions(user.role, ag.status)

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-left">
          <button className="btn-back" onClick={() => navigate(-1)}>← Geri</button>
          <h1 className="page-title">Anlaşma Detayı</h1>
        </div>
        <StatusBadge status={ag.status} />
      </div>

      {actionMsg.text && (
        <div className={`alert ${actionMsg.type === 'success' ? 'alert-success' : 'alert-error'}`}>
          {actionMsg.text}
        </div>
      )}

      <div className="detail-sections">
        <section className="detail-card">
          <h2 className="card-title">Genel Bilgiler</h2>
          <dl className="detail-dl">
            <DetailRow label="Anlaşma ID" value={<span className="mono-sm">{ag.agreementId || ag.id}</span>} />
            <DetailRow label="Durum" value={<StatusBadge status={ag.status} />} />
            <DetailRow label="Öğrenci" value={ag.studentId} />
            <DetailRow label="Şirket" value={ag.companyId} />
            <DetailRow label="Fakülte" value={ag.facultyId} />
            <DetailRow label="Oluşturma" value={fmtDT(ag.createdAt)} />
            <DetailRow label="Son Güncelleme" value={fmtDT(ag.updatedAt)} />
          </dl>
        </section>

        <section className="detail-card">
          <h2 className="card-title">Staj Bilgileri</h2>
          <dl className="detail-dl">
            <DetailRow label="Başlangıç" value={fmtDate(ag.startDate)} />
            <DetailRow label="Bitiş" value={fmtDate(ag.endDate)} />
            <DetailRow label="Tür" value={TYPE_LABEL[ag.internshipType] || ag.internshipType} />
            <DetailRow label="Alan" value={ag.internshipField} />
            <DetailRow label="Toplam İş Günü" value={ag.totalWorkingDays} />
            <DetailRow label="Haftalık Gün" value={ag.weeklyWorkingDayCount} />
            <DetailRow
              label="Çalışma Günleri"
              value={ag.workingDays?.join(', ') || '—'}
            />
          </dl>
        </section>

        {ag.status === 'REJECTED' && (
          <section className="detail-card detail-card-danger">
            <h2 className="card-title">Red Bilgisi</h2>
            <dl className="detail-dl">
              <DetailRow label="Reddeden" value={ROLE_LABEL[ag.rejectedByRole] || ag.rejectedByRole} />
              <DetailRow label="Sebep" value={REJ_LABEL[ag.rejectionReason] || ag.rejectionReason} />
              <DetailRow label="Red Tarihi" value={fmtDT(ag.rejectedAt)} />
            </dl>
          </section>
        )}
      </div>

      {actions.length > 0 && (
        <div className="action-bar">
          {actions.includes('approve') && (
            <button
              className="btn-primary"
              disabled={actionLoading}
              onClick={() => doAction('approve')}
            >
              Onayla
            </button>
          )}
          {actions.includes('activate') && (
            <button
              className="btn-primary"
              disabled={actionLoading}
              onClick={() => doAction('activate')}
            >
              Aktifleştir
            </button>
          )}
          {actions.includes('complete') && (
            <button
              className="btn-primary"
              disabled={actionLoading}
              onClick={() => doAction('complete')}
            >
              Tamamla
            </button>
          )}
          {actions.includes('reject') && (
            <button
              className="btn-danger"
              disabled={actionLoading}
              onClick={() => setShowRejectModal(true)}
            >
              Reddet
            </button>
          )}
        </div>
      )}

      {history.length > 0 && (
        <section className="section">
          <h2 className="section-title">Geçmiş</h2>
          <div className="timeline">
            {history.map((ev, i) => (
              <div key={i} className="timeline-item">
                <div className="timeline-dot" />
                <div className="timeline-body">
                  <div className="timeline-top">
                    <span className="timeline-action">{ev.action || ev.txId || 'Değişiklik'}</span>
                    <span className="timeline-time">{fmtDT(ev.timestamp)}</span>
                  </div>
                  {ev.value?.status && (
                    <div className="timeline-status">
                      <StatusBadge status={ev.value.status} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {showRejectModal && (
        <div className="modal-backdrop" onClick={() => setShowRejectModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Red Sebebi Seçin</h3>
            <div className="field">
              <label>Sebep</label>
              <select
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              >
                {REJECTION_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowRejectModal(false)}>İptal</button>
              <button
                className="btn-danger"
                disabled={actionLoading}
                onClick={doReject}
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
