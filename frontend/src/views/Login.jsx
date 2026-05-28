import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, Lock, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.username, form.password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-hero-gradient flex items-center justify-center relative overflow-hidden px-4">
      {/* Drifting background blurred circles */}
      <div className="absolute top-[-10%] left-[-10%] w-[45vw] h-[45vw] rounded-full bg-gradient-to-br from-[#2563EB] to-[#0EA5E9] opacity-15 blur-[80px] pointer-events-none drift-c1" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-gradient-to-tr from-[#10B981] to-[#0EA5E9] opacity-15 blur-[80px] pointer-events-none drift-c2" />
      <div className="absolute top-[30%] right-[10%] w-[35vw] h-[35vw] rounded-full bg-gradient-to-br from-[#2563EB] to-[#EFF6FF] opacity-10 blur-[90px] pointer-events-none drift-c3" />

      {/* Centered card with 3D lift & FadeInUp on load */}
      <div className="relative w-full max-w-[400px] bg-white border border-[#E2E8F4] rounded-[20px] p-8 shadow-[0_20px_60px_rgba(37,99,235,0.15),0_8px_24px_rgba(0,0,0,0.08)] card-3d fade-in-up">
        
        {/* Logo centered */}
        <div className="flex flex-col items-center mb-6">
          <div className="inline-flex items-center justify-center p-2 bg-[#EFF6FF] rounded-2xl border border-[#BFDBFE] mb-3 filter drop-shadow-[0_2px_4px_rgba(37,99,235,0.15)]">
            <svg className="h-12 w-auto" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M32 8C16 20 16 44 32 56" fill="#2563EB" fillOpacity="0.15" stroke="#2563EB" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M32 8C48 20 48 44 32 56" fill="#0EA5E9" fillOpacity="0.15" stroke="#0EA5E9" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M32 56V26M32 26L26 32M32 26L38 32" stroke="#2563EB" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight select-none">
            <span className="text-[#0F172A]">Breathe</span>
            <span className="text-[#2563EB]">ESG</span>
          </h1>
          <p className="mt-1 text-xs text-[#94A3B8] font-medium uppercase tracking-wider">Sign in to Breathe ESG</p>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-[#EF4444] text-sm font-medium fade-in-up">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#475569] uppercase tracking-wider mb-1.5">
              Username
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94A3B8]">
                <User className="w-4 h-4" />
              </span>
              <input
                id="login-username"
                type="text"
                autoComplete="username"
                required
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="admin"
                className="w-full pl-10 pr-4 py-2.5 bg-[#F8FAFF] border border-[#E2E8F4] rounded-[10px] text-[#0F172A] placeholder-[#94A3B8] text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] transition-all duration-200"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-[#475569] uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94A3B8]">
                <Lock className="w-4 h-4" />
              </span>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-2.5 bg-[#F8FAFF] border border-[#E2E8F4] rounded-[10px] text-[#0F172A] placeholder-[#94A3B8] text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] transition-all duration-200"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#94A3B8] hover:text-[#475569]"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            id="login-submit"
            type="submit"
            disabled={loading}
            className="w-full mt-6 py-3 bg-primary-btn text-white rounded-[10px] text-sm font-semibold transition-all duration-200 shadow-[0_2px_8px_rgba(37,99,235,0.3)] hover:shadow-[0_8px_32px_rgba(37,99,235,0.16)] hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Signing in…</span>
              </>
            ) : (
              <span>Sign In</span>
            )}
          </button>
        </form>
        
        <p className="mt-8 text-center text-xs text-[#94A3B8]">
          © 2026 Breathe-ESG Platform. All rights reserved.
        </p>
      </div>
    </div>
  );
}
