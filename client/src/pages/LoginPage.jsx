// ================================================
// Login Page with 1-Click Persona Pre-fills
// ================================================

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, quickDemoLogin } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await login(email, password);
      navigate(user.role === 'senior' ? '/senior' : '/guardian');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to sign in. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async (role) => {
    setError('');
    setLoading(true);
    try {
      const user = await quickDemoLogin(role);
      navigate(user.role === 'senior' ? '/senior' : '/guardian');
    } catch (err) {
      setError(err.response?.data?.error || 'Demo sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <span className="auth-icon">🛡️</span>
          <h2>Sign in to Family Guardian</h2>
          <p>Protecting vulnerable finances with intelligent oversight.</p>
        </div>

        {/* 1-Click Demo Buttons for Hackathon Judges */}
        <div className="demo-login-box">
          <p className="demo-box-label">⚡ <strong>Instant Evaluator Access:</strong></p>
          <div className="demo-btn-group">
            <button
              type="button"
              onClick={() => handleQuickDemo('senior')}
              className="btn-demo-pill btn-demo-senior"
            >
              👵 Senior: Eleanor Vance
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemo('guardian')}
              className="btn-demo-pill btn-demo-guardian"
            >
              🛡️ Guardian: David Vance
            </button>
          </div>
        </div>

        <div className="auth-divider">
          <span>or sign in with credentials</span>
        </div>

        {error && <div className="alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" disabled={loading} className="btn-auth-submit">
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div className="auth-footer">
          Don't have an account? <Link to="/register">Create one here</Link>
        </div>
      </div>
    </div>
  );
}
