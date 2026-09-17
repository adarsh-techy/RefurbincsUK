import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import DashboardPage from '../features/dashboard/DashboardPage';
import ClientDashboardPage from '../features/clients/portal/ClientDashboardPage';
import TechnicianHomePage from '../features/batteries/technician/TechnicianHomePage';
import RecycleClientDashboardPage from '../features/recycle-client/RecycleClientDashboardPage';
import { hasClientPermission } from '../utils/permissions';

const CLIENT_PAGE_FALLBACKS = [
  { perm: 'client_dashboard', isDashboard: true },
  { perm: 'client_all_batteries', path: '/my/batteries/all' },
  { perm: 'client_packed', path: '/my/batteries/packed' },
  { perm: 'client_in_service', path: '/my/batteries/pending' },
  { perm: 'client_received', path: '/my/batteries/received' },
  { perm: 'client_battery_sorting', path: '/my/battery-sorting' },
  { perm: 'client_invoices', path: '/my/invoices' },
  { perm: 'client_transactions', path: '/my/transactions' },
  { perm: 'client_support', path: '/my/support' },
  { perm: 'client_notifications', path: '/my/notifications' },
];

// The "/" landing page differs by role: admins/super_admins get the full
// operations dashboard, clients get their own read-only stats, technicians
// get a minimal "scan to begin" prompt, and recycle clients get their own recycle dashboard.
function HomeRoute() {
  const user = useSelector((state) => state.auth.user);

  if (user?.role === 'client') {
    if (hasClientPermission(user, 'client_dashboard')) {
      return <ClientDashboardPage />;
    }
    for (const item of CLIENT_PAGE_FALLBACKS) {
      if (item.path && hasClientPermission(user, item.perm)) {
        return <Navigate to={item.path} replace />;
      }
    }
    return <Navigate to="/my/profile" replace />;
  }

  if (user?.role === 'recycle_client') return <RecycleClientDashboardPage />;
  if (user?.role === 'technician') return <TechnicianHomePage />;
  return <DashboardPage />;
}

export default HomeRoute;
