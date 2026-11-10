// ================================================
// Authentication Context & Provider
// ================================================

import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('fg_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  // Validate stored token on mount
  useEffect(() => {
    const token = localStorage.getItem('fg_token');
    if (!token) {
      setLoading(false);
      return;
    }

    api.get('/auth/me')
      .then(res => {
        setUser(res.data.user);
        localStorage.setItem('fg_user', JSON.stringify(res.data.user));
      })
      .catch(() => {
        logout();
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { token, user: loggedUser } = res.data;

    localStorage.setItem('fg_token', token);
    localStorage.setItem('fg_user', JSON.stringify(loggedUser));
    setUser(loggedUser);
    return loggedUser;
  };

  // Quick 1-click login for demo / judging
  const quickDemoLogin = async (role) => {
    const email = role === 'senior' ? 'eleanor@guardian.demo' : 'david@guardian.demo';
    return login(email, 'password123');
  };

  const register = async (formData) => {
    const res = await api.post('/auth/register', formData);
    const { token, user: newUser } = res.data;

    localStorage.setItem('fg_token', token);
    localStorage.setItem('fg_user', JSON.stringify(newUser));
    setUser(newUser);
    return newUser;
  };

  const logout = () => {
    localStorage.removeItem('fg_token');
    localStorage.removeItem('fg_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, quickDemoLogin, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
