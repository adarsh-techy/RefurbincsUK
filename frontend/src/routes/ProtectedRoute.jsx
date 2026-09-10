import { useSelector } from 'react-redux';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { hasPermission, hasClientPermission } from '../utils/permissions';

function ProtectedRoute({ roles, permission, clientPermission }) {
  const user = useSelector((state) => state.auth.user);
  const location = useLocation();

  if (!user) return <Navigate to="/login" replace />;
  // Admin-issued temp passwords (technician/client logins) must be replaced
  // before anything else is reachable.
  if (user.must_change_password && location.pathname !== '/set-password') {
    return <Navigate to="/set-password" replace />;
  }
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  if (permission && !hasPermission(user, permission)) return <Navigate to="/" replace />;
  if (clientPermission && !hasClientPermission(user, clientPermission)) return <Navigate to="/" replace />;

  return <Outlet />;
}

export default ProtectedRoute;
