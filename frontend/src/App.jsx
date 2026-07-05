import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import Layout from './components/Layout.jsx'
import LoginPage from './pages/LoginPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import AgreementsPage from './pages/AgreementsPage.jsx'
import AgreementDetailPage from './pages/AgreementDetailPage.jsx'
import NewAgreementPage from './pages/NewAgreementPage.jsx'
import CompanyRequestPage from './pages/CompanyRequestPage.jsx'
import CentralCompanyRequestsPage from './pages/CentralCompanyRequestsPage.jsx'

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    )
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/agreements" element={<AgreementsPage />} />
        <Route
          path="/agreements/new"
          element={user.role === 'student' ? <NewAgreementPage /> : <Navigate to="/agreements" replace />}
        />
        <Route path="/agreements/:id" element={<AgreementDetailPage />} />
        <Route
          path="/company-request"
          element={user.role === 'student' ? <CompanyRequestPage /> : <Navigate to="/dashboard" replace />}
        />
        <Route
          path="/company-requests"
          element={user.role === 'central' ? <CentralCompanyRequestsPage /> : <Navigate to="/dashboard" replace />}
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
