import { lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useSelector } from 'react-redux';
import ProtectedRoute from './ProtectedRoute';
import HomeRoute from './HomeRoute';
import DashboardLayout from '../components/layout/DashboardLayout';
import LoginPage from '../features/auth/LoginPage';
import RegisterPage from '../features/auth/RegisterPage';
import SetPasswordPage from '../features/auth/SetPasswordPage';
import NotFoundPage from '../pages/NotFoundPage';

// Every other route is loaded on demand
const TruckIntakePage = lazy(() => import('../features/truck-intake/TruckIntakePage'));
const TruckIntakeDetailPage = lazy(() => import('../features/truck-intake/TruckIntakeDetailPage'));
const BatteriesPage = lazy(() => import('../features/batteries/BatteriesPage'));
const UnserviceableBatteriesPage = lazy(() => import('../features/batteries/UnserviceableBatteriesPage'));
const BatteryDetailPage = lazy(() => import('../features/batteries/BatteryDetailPage'));
const GenerateQrPage = lazy(() => import('../features/batteries/GenerateQrPage'));
const RepairsPage = lazy(() => import('../features/repairs/RepairsPage'));
const StaffPage = lazy(() => import('../features/staff/StaffPage'));
const StaffDetailPage = lazy(() => import('../features/staff/StaffDetailPage'));
const PartsPage = lazy(() => import('../features/parts/PartsPage'));
const PartDetailPage = lazy(() => import('../features/parts/PartDetailPage'));
const ClientsPage = lazy(() => import('../features/clients/ClientsPage'));
const IssueReasonsPage = lazy(() => import('../features/issue-reasons/IssueReasonsPage'));
const ClientDetailPage = lazy(() => import('../features/clients/ClientDetailPage'));
const ClientBatteriesPage = lazy(() => import('../features/clients/ClientBatteriesPage'));
const ClientHistoryPage = lazy(() => import('../features/clients/ClientHistoryPage'));
const ClientBatterySortPage = lazy(() => import('../features/clients/ClientBatterySortPage'));
const ClientTransactionsPage = lazy(() => import('../features/clients/ClientTransactionsPage'));
const ClientNotificationsPage = lazy(() => import('../features/clients/ClientNotificationsPage'));
const ClientProfilePage = lazy(() => import('../features/clients/ClientProfilePage'));
const ClientSupportPage = lazy(() => import('../features/support/ClientSupportPage'));
const AdminMessagesPage = lazy(() => import('../features/support/AdminMessagesPage'));
const TechnicianDashboardPage = lazy(() => import('../features/batteries/TechnicianDashboardPage'));
const TechnicianHistoryPage = lazy(() => import('../features/batteries/TechnicianHistoryPage'));
const ReturnsPage = lazy(() => import('../features/returns/ReturnsPage'));
const ReturnDetailPage = lazy(() => import('../features/returns/ReturnDetailPage'));
const RecyclePage = lazy(() => import('../features/recycle/RecyclePage'));
const RecycleDetailPage = lazy(() => import('../features/recycle/RecycleDetailPage'));
const AuditLogPage = lazy(() => import('../features/audit-log/AuditLogPage'));
const FinancePage = lazy(() => import('../features/finance/FinancePage'));
const UsersPage = lazy(() => import('../features/users/UsersPage'));
const InvoicesPage = lazy(() => import('../features/invoices/InvoicesPage'));
const ClientInvoicesPage = lazy(() => import('../features/clients/ClientInvoicesPage'));
const RecycleClientShipmentsPage = lazy(() => import('../features/recycle-client/RecycleClientShipmentsPage'));
const RecycleClientsAdminPage = lazy(() => import('../features/recycle-client/RecycleClientsAdminPage'));

function HistoryRouter() {
  const user = useSelector((state) => state.auth.user);
  if (user?.role === 'technician') return <TechnicianHistoryPage />;
  return <ClientHistoryPage />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      {/* TEMPORARY: remove this route once real admin management is in use. */}
      <Route path="/register" element={<RegisterPage />} />

      {/* Battery Detail & Full History: Accessible both publicly via QR scan and when logged in */}
      <Route element={<DashboardLayout />}>
        <Route path="/batteries/:code" element={<BatteryDetailPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/set-password" element={<SetPasswordPage />} />

        <Route element={<DashboardLayout />}>
          <Route path="/" element={<HomeRoute />} />

          {/* Admin & Operations Messages */}
          <Route element={<ProtectedRoute roles={['super_admin', 'admin', 'staff']} />}>
            <Route path="/messages" element={<AdminMessagesPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={['super_admin', 'admin']} />}>
            <Route path="/batteries" element={<BatteriesPage />} />
            <Route path="/batteries/unserviceable" element={<UnserviceableBatteriesPage />} />
            <Route path="/batteries-qr-code" element={<GenerateQrPage />} />
            <Route path="/invoices" element={<InvoicesPage />} />
          </Route>

          <Route element={<ProtectedRoute permission="truck_intakes" />}>
            <Route path="/truck-intakes" element={<TruckIntakePage />} />
            <Route path="/truck-intakes/:id" element={<TruckIntakeDetailPage />} />
          </Route>
          <Route element={<ProtectedRoute permission="repairs" />}>
            <Route path="/repairs" element={<RepairsPage />} />
          </Route>
          <Route element={<ProtectedRoute permission="staff" />}>
            <Route path="/staff" element={<StaffPage />} />
            <Route path="/staff/:id" element={<StaffDetailPage />} />
          </Route>
          <Route element={<ProtectedRoute permission="parts" />}>
            <Route path="/parts" element={<PartsPage />} />
            <Route path="/parts/:id" element={<PartDetailPage />} />
          </Route>
          <Route element={<ProtectedRoute permission="clients" />}>
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/clients/:id" element={<ClientDetailPage />} />
            <Route path="/recycle-clients" element={<RecycleClientsAdminPage />} />
          </Route>
          <Route element={<ProtectedRoute permission="issue_reasons" />}>
            <Route path="/issue-reasons" element={<IssueReasonsPage />} />
          </Route>

          {/* Client Portal Routes */}
          <Route element={<ProtectedRoute roles={['client', 'recycle_client']} clientPermission="client_support" />}>
            <Route path="/my/support" element={<ClientSupportPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={['client']} clientPermission="client_invoices" />}>
            <Route path="/my/invoices" element={<ClientInvoicesPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={['client']} clientPermission="client_notifications" />}>
            <Route path="/my/notifications" element={<ClientNotificationsPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={['client']} clientPermission="client_transactions" />}>
            <Route path="/my/transactions" element={<ClientTransactionsPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={['client']} />}>
            <Route path="/my/batteries" element={<ClientBatteriesPage />} />
            <Route path="/my/batteries/:bucket" element={<ClientBatteriesPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={['client']} clientPermission="client_battery_sorting" />}>
            <Route path="/my/battery-sorting" element={<ClientBatterySortPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={['client', 'technician', 'recycle_client']} />}>
            <Route path="/my/profile" element={<ClientProfilePage />} />
          </Route>
          <Route element={<ProtectedRoute roles={['recycle_client']} />}>
            <Route path="/my/recycle-shipments" element={<RecycleClientShipmentsPage />} />
            <Route path="/recycle/:id" element={<RecycleDetailPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={['client', 'technician']} />}>
            <Route path="/my/history" element={<HistoryRouter />} />
          </Route>
          <Route element={<ProtectedRoute roles={['technician']} />}>
            <Route path="/my/dashboard" element={<TechnicianDashboardPage />} />
          </Route>
          <Route element={<ProtectedRoute permission="returns" />}>
            <Route path="/returns" element={<ReturnsPage />} />
            <Route path="/returns/:id" element={<ReturnDetailPage />} />
          </Route>
          <Route element={<ProtectedRoute permission="recycle" />}>
            <Route path="/recycle" element={<RecyclePage />} />
            <Route path="/recycle/:id" element={<RecycleDetailPage />} />
          </Route>
          <Route element={<ProtectedRoute permission="audit_logs" />}>
            <Route path="/audit-logs" element={<AuditLogPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={['super_admin']} />}>
            <Route path="/users" element={<UsersPage />} />
            <Route path="/finance" element={<FinancePage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default AppRoutes;
