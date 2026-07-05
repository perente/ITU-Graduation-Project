import React from 'react'

const STATUS_MAP = {
  CREATED: { label: 'Oluşturuldu', cls: 'badge-neutral' },
  STUDENT_APPROVED: { label: 'Öğrenci Onayı', cls: 'badge-info' },
  COMPANY_APPROVED: { label: 'Şirket Onayı', cls: 'badge-info' },
  FACULTY_APPROVED: { label: 'Fakülte Onayı', cls: 'badge-warning' },
  ACTIVE: { label: 'Aktif', cls: 'badge-success' },
  COMPLETED: { label: 'Tamamlandı', cls: 'badge-done' },
  REJECTED: { label: 'Reddedildi', cls: 'badge-danger' },
}

export default function StatusBadge({ status }) {
  const { label, cls } = STATUS_MAP[status] || { label: status || '—', cls: 'badge-neutral' }
  return <span className={`status-badge ${cls}`}>{label}</span>
}
