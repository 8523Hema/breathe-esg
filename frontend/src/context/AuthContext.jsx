import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

const getBaseURL = () => {
  if (import.meta.env.VITE_API_URL) {
    return `${import.meta.env.VITE_API_URL}/api`;
  }
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return '/api';
  }
  return 'https://breathe-esg-backend-fj8t.onrender.com/api';
};

export const api = axios.create({
  baseURL: getBaseURL(),
});

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('access_token'));
  const [username, setUsername] = useState(localStorage.getItem('username') || '');
  
  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      localStorage.setItem('access_token', token);
    } else {
      delete api.defaults.headers.common['Authorization'];
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('username');
      setUsername('');
    }
  }, [token]);

  // Silent automatic login for frictionless prototype review
  useEffect(() => {
    const performSilentLogin = async () => {
      if (!token) {
        try {
          const res = await api.post('/auth/login/', { username: 'analyst', password: 'analyst123' });
          localStorage.setItem('access_token', res.data.access);
          localStorage.setItem('refresh_token', res.data.refresh);
          localStorage.setItem('username', 'analyst');
          setUsername('analyst');
          setToken(res.data.access);
        } catch (err) {
          console.error("Silent auto-login failed:", err);
        }
      }
    };
    performSilentLogin();
  }, [token]);

  const login = async (usernameInput, password) => {
    const res = await api.post('/auth/login/', { username: usernameInput, password });
    localStorage.setItem('access_token', res.data.access);
    localStorage.setItem('refresh_token', res.data.refresh);
    localStorage.setItem('username', usernameInput);
    setUsername(usernameInput);
    setToken(res.data.access);
  };

  const logout = () => {
    // For prototype bypass, we can just clear the storage
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('username');
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ token, username, login, logout, isAuthenticated: true }}>
      {children}
    </AuthContext.Provider>
  );
};
