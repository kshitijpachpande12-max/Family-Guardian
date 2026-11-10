// ================================================
// Family Guardian - Main Application Router
// ================================================

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import SeniorPortal from './pages/SeniorPortal';
import GuardianConsole from './pages/GuardianConsole';
import './App.css';

// Guard for protected routes
function ProtectedRoute({ children, allowedRole }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="app-loading-screen">
        <div className="spinner"></div>
        <p>Verifying Family Guardian security session...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRole && user.role !== allowedRole) {
    return <Navigate to={user.role === 'senior' ? '/senior' : '/guardian'} replace />;
  }

  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="app-wrapper">
          <Navbar />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Protected Senior Route */}
              <Route
                path="/senior"
                element={
                  <ProtectedRoute allowedRole="senior">
                    <SeniorPortal />
                  </ProtectedRoute>
                }
              />

              {/* Protected Guardian Route */}
              <Route
                path="/guardian"
                element={
                  <ProtectedRoute allowedRole="guardian">
                    <GuardianConsole />
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
