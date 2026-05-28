import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const api = axios.create({
  baseURL: (import.meta.env.DEV || !import.meta.env.VITE_API_URL) ? '/api' : `${import.meta.env.VITE_API_URL}/api`,
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

  const login = async (usernameInput, password) => {
    const res = await api.post('/auth/login/', { username: usernameInput, password });
    localStorage.setItem('access_token', res.data.access);
    localStorage.setItem('refresh_token', res.data.refresh);
    localStorage.setItem('username', usernameInput);
    setUsername(usernameInput);
    setToken(res.data.access);
  };

  const logout = () => {
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ token, username, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
};
