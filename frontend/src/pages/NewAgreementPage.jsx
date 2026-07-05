import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { createAgreement } from '../services/agreementService.js'
import { searchCompanies } from '../services/companyService.js'

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const DAY_TR = { MON: 'Pzt', TUE: 'Sal', WED: 'Çar', THU: 'Per', FRI: 'Cum', SAT: 'Cmt', SUN: 'Paz' }

const INTERNSHIP_FIELDS = [
  { value: 'BILGI_ISLEM', label: 'Bilgi İşlem' },
  { value: 'BILGI_TEKNOLOJILERI', label: 'Bilgi Teknolojileri' },
  { value: 'YAZILIM', label: 'Yazılım' },
  { value: 'DONANIM', label: 'Donanım' },
  { value: 'BILISIM', label: 'Bilişim' },
]

const DEFAULT_WORKING_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI']

function formatLocalIsoDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function todayStr() {
  return formatLocalIsoDate(new Date())
}

function addDays(dateStr, n) {
  const [year, month, day] = String(dateStr).split('-').map(Number)
  const d = new Date(year, month - 1, day)
  d.setDate(d.getDate() + n)
  return formatLocalIsoDate(d)
}

function formatDateDMY(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${d}.${m}.${y}`
}

function computeWeeks(startDate, endDate) {
  if (!startDate || !endDate) return []
  const [startYear, startMonth, startDay] = String(startDate).split('-').map(Number)
  const [endYear, endMonth, endDay] = String(endDate).split('-').map(Number)
  const start = new Date(startYear, startMonth - 1, startDay)
  const end = new Date(endYear, endMonth - 1, endDay)
  if (start > end) return []

  const weeks = []
  let weekStart = new Date(start)
  while (weekStart <= end) {
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    if (weekEnd > end) weekEnd.setTime(end.getTime())
    weeks.push({
      start: formatLocalIsoDate(weekStart),
      end: formatLocalIsoDate(weekEnd),
    })
    weekStart.setDate(weekStart.getDate() + 7)
  }
  return weeks
}

export default function NewAgreementPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const registeredFacultyId = (user?.facultyId || '').trim()
  const registeredFacultyName = (user?.facultyName || '').trim()

  const [query, setQuery] = useState('')
  const [companies, setCompanies] = useState([])
  const [compLoading, setCompLoading] = useState(false)
  const [dropOpen, setDropOpen] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState(null)
  const dropRef = useRef(null)
  const errorRef = useRef(null)
  const formRef = useRef(null)
  const hasSubmitted = useRef(false)

  const minStart = addDays(todayStr(), 15)
  const [startDate, setStartDate] = useState(minStart)
  const [endDate, setEndDate] = useState(addDays(minStart, 20))
  const [internshipType, setInternshipType] = useState('MANDATORY')
  const [internshipField, setInternshipField] = useState('')

  const [scheduleMode, setScheduleMode] = useState('fixed')
  const [workingDays, setWorkingDays] = useState([...DEFAULT_WORKING_DAYS])
  const [weeklySchedule, setWeeklySchedule] = useState([])

  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [loading, setLoading] = useState(false)

  const weeks = computeWeeks(startDate, endDate)

  useEffect(() => {
    if (!hasSubmitted.current) return
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    if (Object.keys(fieldErrors).length > 0) {
      const firstErr = formRef.current?.querySelector('.field-error')
      if (firstErr) {
        firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' })
        const input = firstErr.closest('.field')?.querySelector('input:not([readonly]), select')
        input?.focus({ preventScroll: true })
      }
    }
  }, [error, fieldErrors])

  // When flexible mode is active, rebuild weeklySchedule whenever dates change
  useEffect(() => {
    if (scheduleMode === 'flexible') {
      const newWeeks = computeWeeks(startDate, endDate)
      setWeeklySchedule((prev) =>
        newWeeks.map((_, i) => (prev[i] ? [...prev[i]] : [...DEFAULT_WORKING_DAYS]))
      )
    }
  }, [scheduleMode, startDate, endDate])

  useEffect(() => {
    if (!query.trim()) {
      setCompanies([])
      setDropOpen(false)
      return
    }
    const t = setTimeout(async () => {
      setCompLoading(true)
      try {
        const res = await searchCompanies(query)
        setCompanies(res.data || [])
        setDropOpen(true)
      } catch {
        setCompanies([])
      } finally {
        setCompLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    function handleClick(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setDropOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function toggleFixedDay(day) {
    setWorkingDays((prev) => {
      if (prev.includes(day)) return prev.filter((d) => d !== day)
      if (prev.length >= 6) return prev
      return [...prev, day]
    })
  }

  function toggleWeekDay(weekIdx, day) {
    setWeeklySchedule((prev) => {
      const next = prev.map((wk) => [...wk])
      const wk = next[weekIdx] || []
      if (wk.includes(day)) {
        next[weekIdx] = wk.filter((d) => d !== day)
      } else if (wk.length < 6) {
        next[weekIdx] = [...wk, day]
      }
      return next
    })
  }

  function validate() {
    const errs = {}
    if (!selectedCompany) errs.company = 'Şirket seçiniz.'
    if (!registeredFacultyId) errs.facultyId = 'Öğrenci için kayıtlı fakülte bilgisi bulunamadı.'
    if (!startDate) {
      errs.startDate = 'Başlangıç tarihi gerekli.'
    } else if (startDate < minStart) {
      errs.startDate = `Başlangıç tarihi en erken ${minStart} olabilir.`
    }
    const minEnd = startDate ? addDays(startDate, 20) : addDays(minStart, 20)
    if (!endDate) {
      errs.endDate = 'Bitiş tarihi gerekli.'
    } else if (endDate < minEnd) {
      errs.endDate = `Bitiş tarihi başlangıçtan en az 20 gün sonra olmalı (min: ${minEnd}).`
    }
    if (!internshipType) errs.internshipType = 'Staj türü seçiniz.'
    if (!internshipField) errs.internshipField = 'Staj alanı seçiniz.'

    if (scheduleMode === 'fixed') {
      if (workingDays.length < 3 || workingDays.length > 6) {
        errs.workingDays = '3 ile 6 arasında gün seçiniz.'
      }
    } else {
      const currentWeeks = computeWeeks(startDate, endDate)
      if (currentWeeks.length === 0) {
        errs.weeklySchedule = 'Geçerli bir tarih aralığı giriniz.'
      } else {
        const invalidIdx = weeklySchedule.findIndex(
          (wk) => !wk || wk.length < 3 || wk.length > 6
        )
        if (invalidIdx !== -1) {
          errs.weeklySchedule = `${invalidIdx + 1}. hafta için 3 ile 6 arasında gün seçiniz.`
        }
      }
    }
    return errs
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    hasSubmitted.current = true
    const errs = validate()
    setFieldErrors(errs)
    if (Object.keys(errs).length > 0) return

    setLoading(true)
    try {
      const payload = {
        companyId: selectedCompany.companyId || selectedCompany.id,
        facultyId: registeredFacultyId,
        startDate,
        endDate,
        internshipType,
        internshipField,
      }
      if (scheduleMode === 'fixed') {
        payload.workingDays = workingDays
      } else {
        payload.weeklySchedule = weeklySchedule
      }
      const res = await createAgreement(payload)
      const newId = res.data?.agreementId || res.data?.id
      navigate(newId ? `/agreements/${newId}` : '/agreements')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const minEndDate = startDate ? addDays(startDate, 20) : addDays(minStart, 20)

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-left">
          <button className="btn-back" onClick={() => navigate(-1)}>← Geri</button>
          <h1 className="page-title">Yeni Staj Anlaşması</h1>
        </div>
      </div>

      {error && <div className="alert alert-error" ref={errorRef}>{error}</div>}

      <form onSubmit={handleSubmit} className="form-card" ref={formRef}>

        {/* Company search */}
        <div className={`field${fieldErrors.company ? ' has-error' : ''}`}>
          <label>Şirket *</label>
          {selectedCompany ? (
            <div className="selected-item">
              <span className="selected-name">{selectedCompany.companyName || selectedCompany.name}</span>
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => { setSelectedCompany(null); setQuery('') }}
              >
                Değiştir
              </button>
            </div>
          ) : (
            <div className="search-wrap" ref={dropRef}>
              <input
                type="text"
                placeholder="Şirket adı ile arayın…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => companies.length > 0 && setDropOpen(true)}
                autoComplete="off"
              />
              {compLoading && <div className="search-hint">Aranıyor…</div>}
              {dropOpen && (
                <div className="dropdown">
                  {companies.length > 0 ? (
                    companies.map((c) => (
                      <button
                        key={c.companyId || c.id}
                        type="button"
                        className="dropdown-item"
                        onClick={() => {
                          setSelectedCompany(c)
                          setDropOpen(false)
                          setQuery(c.companyName || c.name)
                        }}
                      >
                        {c.companyName || c.name}
                      </button>
                    ))
                  ) : (
                    <div className="dropdown-empty">
                      Şirket bulunamadı.{' '}
                      <button
                        type="button"
                        className="link"
                        onClick={() => navigate('/company-request')}
                      >
                        Şirket talebi oluştur →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {fieldErrors.company && <span className="field-error">{fieldErrors.company}</span>}
          <span className="field-hint">
            Listede yoksa önce{' '}
            <button type="button" className="link" onClick={() => navigate('/company-request')}>
              şirket talebi oluşturun
            </button>
            .
          </span>
        </div>

        <div className={`field${fieldErrors.facultyId ? ' has-error' : ''}`}>
          <label>Fakülte ID *</label>
          <input type="text" value={registeredFacultyId} readOnly />
          {registeredFacultyName && (
            <span className="field-hint">Kayıtlı fakülte: {registeredFacultyName}</span>
          )}
          {fieldErrors.facultyId && <span className="field-error">{fieldErrors.facultyId}</span>}
        </div>

        <div className="fields-row">
          <div className={`field${fieldErrors.startDate ? ' has-error' : ''}`}>
            <label>Başlangıç Tarihi *</label>
            <input
              type="date"
              value={startDate}
              min={minStart}
              onChange={(e) => {
                setStartDate(e.target.value)
                if (endDate < addDays(e.target.value, 20)) {
                  setEndDate(addDays(e.target.value, 20))
                }
              }}
            />
            {fieldErrors.startDate && <span className="field-error">{fieldErrors.startDate}</span>}
          </div>
          <div className={`field${fieldErrors.endDate ? ' has-error' : ''}`}>
            <label>Bitiş Tarihi *</label>
            <input
              type="date"
              value={endDate}
              min={minEndDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            {fieldErrors.endDate && <span className="field-error">{fieldErrors.endDate}</span>}
          </div>
        </div>

        <div className="fields-row">
          <div className={`field${fieldErrors.internshipType ? ' has-error' : ''}`}>
            <label>Staj Türü *</label>
            <select value={internshipType} onChange={(e) => setInternshipType(e.target.value)}>
              <option value="MANDATORY">Zorunlu</option>
              <option value="VOLUNTARY">Gönüllü</option>
            </select>
            {fieldErrors.internshipType && <span className="field-error">{fieldErrors.internshipType}</span>}
          </div>

          <div className={`field${fieldErrors.internshipField ? ' has-error' : ''}`}>
            <label>Staj Alanı *</label>
            <select value={internshipField} onChange={(e) => setInternshipField(e.target.value)}>
              <option value="">Seçiniz…</option>
              {INTERNSHIP_FIELDS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
            {fieldErrors.internshipField && <span className="field-error">{fieldErrors.internshipField}</span>}
          </div>
        </div>

        {/* Schedule mode selector */}
        <div className="field">
          <label>Çalışma Programı Türü *</label>
          <div className="schedule-mode-toggle">
            <button
              type="button"
              className={`schedule-mode-btn${scheduleMode === 'fixed' ? ' active' : ''}`}
              onClick={() => setScheduleMode('fixed')}
            >
              Sabit Haftalık Program
            </button>
            <button
              type="button"
              className={`schedule-mode-btn${scheduleMode === 'flexible' ? ' active' : ''}`}
              onClick={() => setScheduleMode('flexible')}
            >
              Esnek Haftalık Program
            </button>
          </div>
          <span className="field-hint">
            {scheduleMode === 'fixed'
              ? 'Her hafta aynı günler uygulanır.'
              : 'Her hafta için farklı günler seçebilirsiniz.'}
          </span>
        </div>

        {/* Fixed schedule */}
        {scheduleMode === 'fixed' && (
          <div className={`field${fieldErrors.workingDays ? ' has-error' : ''}`}>
            <label>
              Çalışma Günleri *{' '}
              <span className="field-hint-inline">
                {workingDays.length} gün seçili (3–6)
                {workingDays.length >= 6 && ' — maksimum 6 güne ulaşıldı'}
              </span>
            </label>
            <div className="day-picker">
              {DAYS.map((day) => {
                const selected = workingDays.includes(day)
                const disabled = !selected && workingDays.length >= 6
                return (
                  <button
                    key={day}
                    type="button"
                    className={`day-btn${selected ? ' selected' : ''}${disabled ? ' day-btn-disabled' : ''}`}
                    onClick={() => !disabled && toggleFixedDay(day)}
                    aria-pressed={selected}
                  >
                    {DAY_TR[day]}
                  </button>
                )
              })}
            </div>
            {fieldErrors.workingDays && <span className="field-error">{fieldErrors.workingDays}</span>}
          </div>
        )}

        {/* Flexible schedule */}
        {scheduleMode === 'flexible' && (
          <div className={`field${fieldErrors.weeklySchedule ? ' has-error' : ''}`}>
            <label>Haftalık Çalışma Programı *</label>
            {weeks.length > 0 ? (
              <>
                <span className="field-hint" style={{ display: 'block', marginBottom: 12 }}>
                  Seçilen tarih aralığı {weeks.length} haftaya bölündü. Her hafta için 3–6 gün seçiniz.
                </span>
                <div className="week-schedule">
                  {weeks.map((week, idx) => {
                    const wkDays = weeklySchedule[idx] || []
                    const atMax = wkDays.length >= 6
                    const tooFew = wkDays.length < 3
                    return (
                      <div key={idx} className={`week-block${tooFew ? ' week-block-warn' : ''}`}>
                        <div className="week-block-header">
                          <span className="week-label">Hafta {idx + 1}</span>
                          <span className="week-date-range">
                            {formatDateDMY(week.start)} – {formatDateDMY(week.end)}
                          </span>
                          <span className={`week-count${tooFew ? ' week-count-warn' : atMax ? ' week-count-max' : ''}`}>
                            {wkDays.length} / 6 gün
                          </span>
                        </div>
                        <div className="day-picker">
                          {DAYS.map((day) => {
                            const selected = wkDays.includes(day)
                            const disabled = !selected && atMax
                            return (
                              <button
                                key={day}
                                type="button"
                                className={`day-btn${selected ? ' selected' : ''}${disabled ? ' day-btn-disabled' : ''}`}
                                onClick={() => !disabled && toggleWeekDay(idx, day)}
                                aria-pressed={selected}
                              >
                                {DAY_TR[day]}
                              </button>
                            )
                          })}
                        </div>
                        {tooFew && (
                          <span className="week-hint-warn">En az 3 gün seçiniz.</span>
                        )}
                        {atMax && (
                          <span className="field-hint">Bu hafta için maksimum 6 güne ulaşıldı.</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <span className="field-hint">Tarih aralığı girilince haftalar görünecek.</span>
            )}
            {fieldErrors.weeklySchedule && (
              <span className="field-error">{fieldErrors.weeklySchedule}</span>
            )}
          </div>
        )}

        <div className="form-actions">
          <button type="button" className="btn-ghost" onClick={() => navigate(-1)}>İptal</button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Gönderiliyor…' : 'Anlaşma Oluştur'}
          </button>
        </div>
      </form>
    </div>
  )
}
