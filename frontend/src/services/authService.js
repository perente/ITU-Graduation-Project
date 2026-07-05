import { apiRequest } from './api.js'

export function login(loginIdentifier, password) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ loginIdentifier, password }),
  })
}

export function me() {
  return apiRequest('/auth/me')
}
