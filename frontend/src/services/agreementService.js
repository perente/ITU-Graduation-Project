import { apiRequest } from './api.js'

function normalizeMyAgreements(data) {
  if (Array.isArray(data)) {
    return data
  }

  if (data && typeof data === 'object') {
    return [...(data.pendingActivation || []), ...(data.active || [])]
  }

  return []
}

export const getMyAgreements = async () => {
  const response = await apiRequest('/agreements/my')

  return {
    ...response,
    data: normalizeMyAgreements(response.data),
  }
}

export const getPendingAgreements = () => apiRequest('/agreements/pending')

export const getAgreementById = (id) =>
  apiRequest(`/agreements/${encodeURIComponent(id)}`)

export const getAgreementHistory = (id) =>
  apiRequest(`/agreements/${encodeURIComponent(id)}/history`)

export const createAgreement = (payload) =>
  apiRequest('/agreements', { method: 'POST', body: JSON.stringify(payload) })

export const approveAgreement = (id) =>
  apiRequest(`/agreements/${encodeURIComponent(id)}/approve`, { method: 'POST' })

export const rejectAgreement = (id, reason) =>
  apiRequest(`/agreements/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })

export const activateAgreement = (id) =>
  apiRequest(`/agreements/${encodeURIComponent(id)}/activate`, { method: 'POST' })

export const completeAgreement = (id) =>
  apiRequest(`/agreements/${encodeURIComponent(id)}/complete`, { method: 'POST' })
