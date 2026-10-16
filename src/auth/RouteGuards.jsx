import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';
import '../pages/auth/AuthPages.css';

function CheckingSession() {
  return <div className="auth-loading">Restoring your session…</div>;
}

export function ProtectedRoute() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <CheckingSession />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

export function PublicOnlyRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <CheckingSession />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
