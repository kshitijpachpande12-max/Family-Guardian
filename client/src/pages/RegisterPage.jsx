// ================================================
// Registration Page with Role & Senior Linking
// ================================================

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'senior',
    linkedSeniorEmail: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await register(formData);
      navigate(user.role === 'senior' ? '/senior' : '/guardian');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <span className="auth-icon">🛡️</span>
          <h2>Create Your Account</h2>
          <p>Join the AI-assisted family payment protection network.</p>
        </div>

        {error && <div className="alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>I am registering as:</label>
            <div className="role-selector">
              <label className={`role-option ${formData.role === 'senior' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="role"
                  value="senior"
                  checked={formData.role === 'senior'}
                  onChange={handleChange}
                />
                <span className="role-title">👵 Older Adult (Senior)</span>
                <span className="role-sub">Protected account for submitting payments</span>
              </label>

              <label className={`role-option ${formData.role === 'guardian' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="role"
                  value="guardian"
                  checked={formData.role === 'guardian'}
                  onChange={handleChange}
                />
                <span className="role-title">🛡️ Family Guardian</span>
                <span className="role-sub">Protector reviewing and approving payments</span>
              </label>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <input
              id="name"
              name="name"
              type="text"
              placeholder="e.g. Eleanor Vance"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="name@example.com"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="At least 6 characters"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>

          {formData.role === 'guardian' && (
            <div className="form-group highlight-group">
              <label htmlFor="linkedSeniorEmail">
                Email of Senior You Protect <span className="req">*</span>
              </label>
              <input
                id="linkedSeniorEmail"
                name="linkedSeniorEmail"
                type="email"
                placeholder="e.g. eleanor@guardian.demo"
                value={formData.linkedSeniorEmail}
                onChange={handleChange}
                required
              />
              <small className="field-hint">
                The senior must already be registered so you can link to their payments.
              </small>
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-auth-submit">
            {loading ? 'Creating Account...' : 'Complete Registration'}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account? <Link to="/login">Sign in here</Link>
        </div>
      </div>
    </div>
  );
}
