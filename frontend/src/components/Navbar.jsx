import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Upload, LayoutDashboard, Shield, LogOut, Menu, X, User } from 'lucide-react';

const navItems = [
  { to: '/upload',  label: 'Upload',  Icon: Upload },
  { to: '/',        label: 'Review',  Icon: LayoutDashboard, end: true },
  { to: '/audit',   label: 'Audit',   Icon: Shield },
];

export default function Navbar() {
  const { logout, username } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const displayUser = username || 'Guest';

  return (
    <header className="sticky top-0 z-50 backdrop-blur-[12px] bg-white/92 border-b border-[#E2E8F4] shadow-[0_1px_0_#E2E8F4,0_4px_16px_rgba(37,99,235,0.06)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Logo left */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center">
            <svg className="h-8 w-auto filter drop-shadow-[0_2px_4px_rgba(37,99,235,0.15)]" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Left arc */}
              <path d="M32 8C16 20 16 44 32 56" fill="#2563EB" fillOpacity="0.15" stroke="#2563EB" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
              {/* Right arc */}
              <path d="M32 8C48 20 48 44 32 56" fill="#0EA5E9" fillOpacity="0.15" stroke="#0EA5E9" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
              {/* Stem and arrow in the middle */}
              <path d="M32 56V26M32 26L26 32M32 26L38 32" stroke="#2563EB" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-xl font-extrabold tracking-tight select-none">
            <span className="text-[#0F172A]">Breathe</span>
            <span className="text-[#2563EB]">ESG</span>
          </span>
        </div>

        {/* Nav links center (Desktop) */}
        <nav className="hidden md:flex items-center gap-1.5">
          {navItems.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              id={`nav-${label.toLowerCase()}`}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-medium transition-all duration-200 border-b-2 border-transparent ${
                  isActive
                    ? 'bg-[#EFF6FF] text-[#2563EB] border-b-[#2563EB]'
                    : 'text-[#475569] hover:text-[#2563EB] hover:bg-[#F8FAFF]'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User Info + Logout (Desktop) */}
        <div className="hidden md:flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#F8FAFF] border border-[#E2E8F4] rounded-full text-[#475569] text-sm font-medium">
            <User className="w-4 h-4 text-[#2563EB]" />
            <span className="max-w-[120px] truncate">{displayUser}</span>
          </div>
          
          <button
            id="nav-logout"
            onClick={logout}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] text-sm font-semibold text-[#475569] hover:text-[#EF4444] hover:bg-[#FEF2F2] border border-transparent hover:border-[#FEE2E2] transition-all duration-200"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>

        {/* Mobile menu toggle */}
        <div className="flex items-center md:hidden">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-[#475569] hover:bg-[#F8FAFF] hover:text-[#2563EB] transition"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer (Custom CSS) */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#E2E8F4] bg-white px-4 py-4 space-y-3 shadow-lg fade-in-up">
          <div className="flex items-center gap-2 px-3 py-2 bg-[#F8FAFF] border border-[#E2E8F4] rounded-xl text-[#475569] text-sm font-medium">
            <User className="w-4 h-4 text-[#2563EB]" />
            <span className="truncate">{displayUser}</span>
          </div>
          <div className="h-px bg-[#E2E8F4] my-2" />
          <nav className="flex flex-col gap-1">
            {navItems.map(({ to, label, Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                id={`nav-mobile-${label.toLowerCase()}`}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3.5 px-4 py-3 rounded-[10px] text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-[#EFF6FF] text-[#2563EB] border-l-4 border-l-[#2563EB]'
                      : 'text-[#475569] hover:text-[#2563EB] hover:bg-[#F8FAFF]'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="h-px bg-[#E2E8F4] my-2" />
          <button
            id="nav-mobile-logout"
            onClick={() => {
              setMobileMenuOpen(false);
              logout();
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-[10px] text-sm font-semibold text-[#EF4444] bg-[#FEF2F2] border border-[#FEE2E2] hover:bg-[#FEE2E2] transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      )}
    </header>
  );
}
