// ================================================
// Navbar Component with Demo Account Switcher
// ================================================

import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout, quickDemoLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSwitchAccount = async (targetRole) => {
    try {
      const switchedUser = await quickDemoLogin(targetRole);
      if (switchedUser.role === 'senior') {
        navigate('/senior');
      } else {
        navigate('/guardian');
      }
    } catch (err) {
      console.error('Demo switch error:', err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand">
          <span className="brand-icon">🛡️</span>
          <span className="brand-name">Family Guardian</span>
          <span className="brand-badge">AI Safety Net</span>
        </Link>

        <div className="navbar-links">
          {user ? (
            <>
              {user.role === 'senior' ? (
                <Link
                  to="/senior"
                  className={`nav-link ${location.pathname === '/senior' ? 'active' : ''}`}
                >
                  👵 My Payments
                </Link>
              ) : (
                <Link
                  to="/guardian"
                  className={`nav-link ${location.pathname === '/guardian' ? 'active' : ''}`}
                >
                  🛡️ Security Console
                </Link>
              )}

              {/* Demo Persona Quick-Switcher */}
              <div className="demo-switcher">
                {user.role === 'senior' ? (
                  <button
                    onClick={() => handleSwitchAccount('guardian')}
                    className="btn-switch btn-switch-guardian"
                    title="Switch to Guardian David for reviewing scams"
                  >
                    Switch to Guardian David 🛡️
                  </button>
                ) : (
                  <button
                    onClick={() => handleSwitchAccount('senior')}
                    className="btn-switch btn-switch-senior"
                    title="Switch to Senior Eleanor for making payments"
                  >
                    Switch to Senior Eleanor 👵
                  </button>
                )}
              </div>

              <div className="user-profile">
                <div className="user-avatar">
                  {user.role === 'senior' ? '👵' : '🛡️'}
                </div>
                <div className="user-info">
                  <span className="user-name">{user.name}</span>
                  <span className={`role-pill role-${user.role}`}>
                    {user.role === 'senior' ? 'Protected Senior' : 'Family Guardian'}
                  </span>
                </div>
                <button onClick={handleLogout} className="btn-logout" title="Log Out">
                  Sign Out
                </button>
              </div>
            </>
          ) : (
            <div className="guest-links">
              <Link to="/login" className="nav-btn btn-secondary">
                Sign In
              </Link>
              <Link to="/register" className="nav-btn btn-primary">
                Get Protected
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
