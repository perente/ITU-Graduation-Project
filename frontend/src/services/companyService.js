import { apiRequest } from './api.js'

export const searchCompanies = (q = '') =>
  apiRequest(`/companies?q=${encodeURIComponent(q)}`)

export const submitCompanyRequest = (payload) =>
  apiRequest('/companies/requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const getPendingCompanyRequests = () => apiRequest('/companies/requests')

export const getCompanyRequestById = (id) =>
  apiRequest(`/companies/requests/${encodeURIComponent(id)}`)

export const approveCompanyRequest = (id) =>
  apiRequest(`/companies/requests/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
  })

export const rejectCompanyRequest = (id, rejectionReason) =>
  apiRequest(`/companies/requests/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    body: JSON.stringify({ rejectionReason }),
  })
