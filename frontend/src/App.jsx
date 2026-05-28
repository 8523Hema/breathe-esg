import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login  from './views/Login';
import Upload from './views/Upload';
import Review from './views/Review';
import Audit  from './views/Audit';

function ProtectedLayout() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return (
    <div className="min-h-screen bg-[#F0F4FF] flex flex-col">
      <Navbar />
      <main className="flex-grow">
        <Routes>
          <Route path="/"       element={<Review />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/audit"  element={<Audit  />} />
          <Route path="*"       element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <footer className="border-t border-[#E2E8F4] py-4 text-center text-xs text-[#94A3B8] bg-white">
        © 2026 Breathe-ESG Platform &nbsp;·&nbsp; Django 4.2 + React 18 + Vite + Tailwind CSS
      </footer>
    </div>
  );
}

function AuthRoute() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<AuthRoute />} />
          <Route path="/*"    element={<ProtectedLayout />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
