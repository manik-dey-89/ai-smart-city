import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { LocationProvider } from './contexts/LocationContext'
import { useRBAC } from './hooks/useRBAC'
import Layout from './components/Layout'
import RoleSelectLanding from './pages/RoleSelectLanding'
import Features from './pages/Features'
import Services from './pages/Services'
import AboutUs from './pages/AboutUs'
import Contact from './pages/Contact'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import CityMap from './pages/CityMap'
import Traffic from './pages/Traffic'
import AirQuality from './pages/AirQuality'
import Water from './pages/Water'
import WaterFlood from './pages/WaterFlood'
import Electricity from './pages/Electricity'
import Waste from './pages/Waste'
import Complaints from './pages/Complaints'
import Emergency from './pages/Emergency'
import Weather from './pages/Weather'
import Admin from './pages/Admin'
import AdminComplaints from './pages/AdminComplaints'
import AdminEmergency from './pages/AdminEmergency'
import AdminAlerts from './pages/AdminAlerts'
import Profile from './pages/Profile'
import UserManagement from './pages/UserManagement'
import RoleManagement from './pages/RoleManagement'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Unauthorized from './pages/Unauthorized'
import OfficerComplaints from './pages/OfficerComplaints'
import CaseDetailPage from './pages/CaseDetailPage'

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/" replace />
  return <>{children}</>
}

const RoleProtectedRoute = ({ children, requiredKey }: { children: React.ReactNode; requiredKey: string }) => {
  const { hasPermission } = useRBAC()
  if (!hasPermission(requiredKey)) return <Unauthorized />
  return <>{children}</>
}

// Role-aware dashboard: admin roles see Admin, everyone else sees citizen Dashboard
const SmartDashboard = () => {
  const { isAdmin } = useRBAC()
  return isAdmin ? <Admin /> : <Dashboard />
}

// Wrap a page in ProtectedRoute + Layout + RoleProtectedRoute
const Page = ({ element, requiredKey }: { element: React.ReactNode; requiredKey: string }) => (
  <ProtectedRoute>
    <Layout>
      <RoleProtectedRoute requiredKey={requiredKey}>
        {element}
      </RoleProtectedRoute>
    </Layout>
  </ProtectedRoute>
)

const AppContent = () => {
  const { isAuthenticated } = useAuth()

  return (
    <Routes>
      {/* ── Public routes — always accessible ── */}
      <Route path="/features"  element={<Features />} />
      <Route path="/services"  element={<Services />} />
      <Route path="/about"     element={<AboutUs />} />
      <Route path="/contact"   element={<Contact />} />

      {!isAuthenticated ? (
        <>
          <Route path="/"                element={<RoleSelectLanding />} />
          <Route path="/login"           element={<Login />} />
          <Route path="/register"        element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password"  element={<ResetPassword />} />
          {/* /app → redirect to login when not authenticated */}
          <Route path="/app"             element={<Navigate to="/login" replace />} />
        </>
      ) : (
        /* All authenticated routes share the LocationProvider */
        <Route path="/*" element={
          <LocationProvider>
            <Routes>
              <Route path="/dashboard"   element={<Page element={<SmartDashboard />} requiredKey="dashboard"   />} />
              <Route path="/app"         element={<Navigate to="/dashboard" replace />} />
              <Route path="/map"         element={<Page element={<CityMap />}        requiredKey="map"         />} />
              <Route path="/air-quality" element={<Page element={<AirQuality />}     requiredKey="air-quality" />} />
              <Route path="/traffic"     element={<Page element={<Traffic />}        requiredKey="traffic"     />} />
              <Route path="/weather"     element={<Page element={<Weather />}        requiredKey="weather"     />} />
              <Route path="/water-flood" element={<Page element={<WaterFlood />}     requiredKey="water-flood" />} />
              <Route path="/water"       element={<Page element={<Water />}          requiredKey="water"       />} />
              <Route path="/electricity" element={<Page element={<Electricity />}    requiredKey="electricity"  />} />
              <Route path="/waste"       element={<Page element={<Waste />}          requiredKey="waste"       />} />
              <Route path="/complaints"  element={<Page element={<Complaints />}     requiredKey="complaints"  />} />
              <Route path="/emergency"   element={<Page element={<Emergency />}      requiredKey="emergency"   />} />
              <Route path="/admin"             element={<Page element={<Admin />}             requiredKey="admin"             />} />
              <Route path="/admin-complaints" element={<Page element={<AdminComplaints />}  requiredKey="admin-complaints"  />} />
              <Route path="/admin-emergency"  element={<Page element={<AdminEmergency />}   requiredKey="admin-emergency"   />} />
              <Route path="/admin-alerts"     element={<Page element={<AdminAlerts />}      requiredKey="admin-alerts"      />} />
              <Route path="/profile"     element={<Page element={<Profile />}        requiredKey="profile"     />} />
              <Route path="/users"       element={<Page element={<UserManagement />} requiredKey="users"       />} />
              <Route path="/roles"       element={<Page element={<RoleManagement />} requiredKey="roles"       />} />
              <Route path="/officer-complaints" element={<Page element={<OfficerComplaints />} requiredKey="officer-complaints" />} />
              <Route path="/case/:id"          element={<Page element={<CaseDetailPage />}    requiredKey="case-detail"         />} />
              <Route path="*"            element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </LocationProvider>
        } />
      )}
      <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/"} replace />} />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  )
}

export default App
