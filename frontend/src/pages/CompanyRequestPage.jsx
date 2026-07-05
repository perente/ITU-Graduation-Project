import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { submitCompanyRequest } from '../services/companyService.js'

const INIT = {
  companyName: '',
  companyAddress: '',
  companyPhoneNumber: '',
  companyFaxNumber: '',
  companyEmail: '',
  isPublicInstitution: false,
  companyTitle: '',
  companyIban: '',
  companyBankName: '',
  companyBankBranchCode: '',
  companyBankBranchName: '',
  companyRegistrationNumber: '',
  companyTaxIdentificationNumber: '',
}

function Field({ label, type = 'text', required = true, value, onChange, error }) {
  return (
    <div className="field">
      <label>{label}{required && ' *'}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
      />
      {error && <span className="field-error">{error}</span>}
    </div>
  )
}

export default function CompanyRequestPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState(INIT)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  function set(key, val) {
    setForm((p) => ({ ...p, [key]: val }))
    if (fieldErrors[key]) setFieldErrors((p) => ({ ...p, [key]: '' }))
  }

  function validate() {
    const e = {}
    if (!form.companyName.trim()) e.companyName = 'Şirket adı gerekli.'
    if (!form.companyTitle.trim()) e.companyTitle = 'Unvan gerekli.'
    if (!form.companyAddress.trim()) e.companyAddress = 'Adres gerekli.'
    if (!form.companyPhoneNumber.trim()) e.companyPhoneNumber = 'Telefon gerekli.'
    if (!form.companyFaxNumber.trim()) e.companyFaxNumber = 'Faks gerekli.'
    if (!form.companyEmail.trim()) e.companyEmail = 'E-posta gerekli.'
    if (!form.companyIban.trim()) e.companyIban = 'IBAN gerekli.'
    if (!form.companyBankName.trim()) e.companyBankName = 'Banka adı gerekli.'
    if (!form.companyBankBranchCode.trim()) e.companyBankBranchCode = 'Şube kodu gerekli.'
    if (!form.companyBankBranchName.trim()) e.companyBankBranchName = 'Şube adı gerekli.'
    if (!form.companyRegistrationNumber.trim() && !form.companyTaxIdentificationNumber.trim()) {
      e.regOrTax = 'Mersis numarası veya vergi kimlik numarasından en az biri gerekli.'
    }
    return e
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const errs = validate()
    setFieldErrors(errs)
    if (Object.keys(errs).length > 0) return

    setLoading(true)
    try {
      await submitCompanyRequest({
        ...form,
        companyRegistrationNumber: form.companyRegistrationNumber.trim() || null,
        companyTaxIdentificationNumber: form.companyTaxIdentificationNumber.trim() || null,
      })
      setSuccess(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="page">
        <div className="success-box">
          <div className="success-icon">✓</div>
          <h2>Talep Gönderildi</h2>
          <p>
            Şirket talebiniz merkez ofis tarafından incelenerek onaylanacak. Onaydan sonra
            bu şirketi anlaşmalarınızda kullanabilirsiniz.
          </p>
          <div className="form-actions">
            <button className="btn-primary" onClick={() => navigate('/dashboard')}>
              Dashboard'a Dön
            </button>
            <button className="btn-ghost" onClick={() => { setSuccess(false); setForm(INIT) }}>
              Yeni Talep
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-left">
          <button className="btn-back" onClick={() => navigate(-1)}>← Geri</button>
          <h1 className="page-title">Yeni Şirket Talebi</h1>
        </div>
      </div>
      <p className="page-desc">
        Staj yapmak istediğiniz şirket sistemde kayıtlı değilse bu formu doldurun.
        Merkez onayından sonra anlaşma oluşturabilirsiniz.
      </p>

      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSubmit} className="form-card">
        <h3 className="form-section-title">Şirket Bilgileri</h3>
        <Field
          label="Şirket Adı"
          value={form.companyName}
          onChange={(e) => set('companyName', e.target.value)}
          error={fieldErrors.companyName}
        />
        <Field
          label="Şirket Unvanı"
          value={form.companyTitle}
          onChange={(e) => set('companyTitle', e.target.value)}
          error={fieldErrors.companyTitle}
        />
        <div className="field">
          <label>Adres *</label>
          <textarea
            value={form.companyAddress}
            onChange={(e) => set('companyAddress', e.target.value)}
            rows={3}
          />
          {fieldErrors.companyAddress && <span className="field-error">{fieldErrors.companyAddress}</span>}
        </div>
        <div className="fields-row">
          <Field
            label="Telefon"
            value={form.companyPhoneNumber}
            onChange={(e) => set('companyPhoneNumber', e.target.value)}
            error={fieldErrors.companyPhoneNumber}
          />
          <Field
            label="Faks"
            value={form.companyFaxNumber}
            onChange={(e) => set('companyFaxNumber', e.target.value)}
            error={fieldErrors.companyFaxNumber}
          />
        </div>
        <Field
          label="E-posta"
          type="email"
          value={form.companyEmail}
          onChange={(e) => set('companyEmail', e.target.value)}
          error={fieldErrors.companyEmail}
        />
        <div className="field">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.isPublicInstitution}
              onChange={(e) => set('isPublicInstitution', e.target.checked)}
            />
            Kamu Kurumu
          </label>
        </div>

        <h3 className="form-section-title">Banka Bilgileri</h3>
        <Field
          label="IBAN"
          value={form.companyIban}
          onChange={(e) => set('companyIban', e.target.value)}
          error={fieldErrors.companyIban}
        />
        <div className="fields-row">
          <Field
            label="Banka Adı"
            value={form.companyBankName}
            onChange={(e) => set('companyBankName', e.target.value)}
            error={fieldErrors.companyBankName}
          />
          <Field
            label="Şube Kodu"
            value={form.companyBankBranchCode}
            onChange={(e) => set('companyBankBranchCode', e.target.value)}
            error={fieldErrors.companyBankBranchCode}
          />
          <Field
            label="Şube Adı"
            value={form.companyBankBranchName}
            onChange={(e) => set('companyBankBranchName', e.target.value)}
            error={fieldErrors.companyBankBranchName}
          />
        </div>

        <h3 className="form-section-title">Kayıt Bilgileri</h3>
        <p className="field-hint">Aşağıdakilerden en az birini doldurunuz.</p>
        <div className="fields-row">
          <Field
            label="Mersis Numarası"
            required={false}
            value={form.companyRegistrationNumber}
            onChange={(e) => set('companyRegistrationNumber', e.target.value)}
            error={fieldErrors.companyRegistrationNumber}
          />
          <Field
            label="Vergi Kimlik Numarası"
            required={false}
            value={form.companyTaxIdentificationNumber}
            onChange={(e) => set('companyTaxIdentificationNumber', e.target.value)}
            error={fieldErrors.companyTaxIdentificationNumber}
          />
        </div>
        {fieldErrors.regOrTax && <div className="field-error">{fieldErrors.regOrTax}</div>}

        <div className="form-actions">
          <button type="button" className="btn-ghost" onClick={() => navigate(-1)}>İptal</button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Gönderiliyor…' : 'Talebi Gönder'}
          </button>
        </div>
      </form>
    </div>
  )
}
