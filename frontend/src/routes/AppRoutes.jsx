import { lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useSelector } from 'react-redux';
import ProtectedRoute from './ProtectedRoute';
import HomeRoute from './HomeRoute';
import DashboardLayout from '../components/layout/shell/DashboardLayout';
import LoginPage from '../features/auth/LoginPage';
import RegisterPage from '../features/auth/RegisterPage';
import SetPasswordPage from '../features/auth/SetPasswordPage';
import NotFoundPage from '../pages/NotFoundPage';

// Every other route is loaded on demand
const TruckIntakePage = lazy(() => import('../features/truck-intake/TruckIntakePage'));
const TruckIntakeDetailPage = lazy(() => import('../features/truck-intake/TruckIntakeDetailPage'));
const BatteriesPage = lazy(() => import('../features/batteries/pages/BatteriesPage'));
const UnserviceableBatteriesPage = lazy(() => import('../features/batteries/pages/UnserviceableBatteriesPage'));
const BatteryDetailPage = lazy(() => import('../features/batteries/pages/BatteryDetailPage'));
const GenerateQrPage = lazy(() => import('../features/batteries/pages/GenerateQrPage'));
const RepairsPage = lazy(() => import('../features/repairs/RepairsPage'));
const StaffPage = lazy(() => import('../features/staff/StaffPage'));
const StaffDetailPage = lazy(() => import('../features/staff/StaffDetailPage'));
const PartsPage = lazy(() => import('../features/parts/PartsPage'));
const PartDetailPage = lazy(() => import('../features/parts/PartDetailPage'));
const ClientsPage = lazy(() => import('../features/clients/admin/ClientsPage'));
const IssueReasonsPage = lazy(() => import('../features/issue-reasons/IssueReasonsPage'));
const ServicesPage = lazy(() => import('../features/services/ServicesPage'));
const ClientDetailPage = lazy(() => import('../features/clients/admin/ClientDetailPage'));
const ClientBatteriesPage = lazy(() => import('../features/clients/portal/ClientBatteriesPage'));
const ClientHistoryPage = lazy(() => import('../features/clients/portal/ClientHistoryPage'));
const ClientHistoryDetailPage = lazy(() => import('../features/clients/portal/ClientHistoryDetailPage'));
const ClientBatterySortPage = lazy(() => import('../features/clients/portal/ClientBatterySortPage'));
const ClientTransactionsPage = lazy(() => import('../features/clients/portal/ClientTransactionsPage'));
const ClientNotificationsPage = lazy(() => import('../features/clients/portal/ClientNotificationsPage'));
const ClientProfilePage = lazy(() => import('../features/clients/portal/ClientProfilePage'));
const ClientSupportPage = lazy(() => import('../features/support/ClientSupportPage'));
const AdminMessagesPage = lazy(() => import('../features/support/AdminMessagesPage'));
const AdminNotificationsPage = lazy(() => import('../features/notifications/AdminNotificationsPage'));
const TechnicianDashboardPage = lazy(() => import('../features/batteries/technician/TechnicianDashboardPage'));
const TechnicianHistoryPage = lazy(() => import('../features/batteries/technician/TechnicianHistoryPage'));
const ReturnsPage = lazy(() => import('../features/returns/ReturnsPage'));
const ReturnDetailPage = lazy(() => import('../features/returns/ReturnDetailPage'));
const RecyclePage = lazy(() => import('../features/recycle/RecyclePage'));
const RecycleDetailPage = lazy(() => import('../features/recycle/RecycleDetailPage'));
const AuditLogPage = lazy(() => import('../features/audit-log/AuditLogPage'));
const FinancePage = lazy(() => import('../features/finance/FinancePage'));
const FinanceDetailPage = lazy(() => import('../features/finance/FinanceDetailPage'));
const UsersPage = lazy(() => import('../features/users/UsersPage'));
const InvoicesPage = lazy(() => import('../features/invoices/InvoicesPage'));
const ClientInvoicesPage = lazy(() => import('../features/clients/portal/ClientInvoicesPage'));
const RecycleClientShipmentsPage = lazy(() => import('../features/recycle-client/RecycleClientShipmentsPage'));
const RecycleClientsAdminPage = lazy(() => import('../features/recycle-client/RecycleClientsAdminPage'));
const RecycleClientDetailPage = lazy(() => import('../features/recycle-client/RecycleClientDetailPage'));
const RatingsPage = lazy(() => import('../features/ratings/RatingsPage'));
const RatingDetailPage = lazy(() => import('../features/ratings/RatingDetailPage'));
const CertificatesPage = lazy(() => import('../features/certificates/CertificatesPage'));
const ClientMilestoneDetailPage = lazy(() => import('../features/certificates/ClientMilestoneDetailPage'));
const ClientCertificatesPage = lazy(() => import('../features/clients/portal/ClientCertificatesPage'));
const TrashPage = lazy(() => import('../features/trash/TrashPage'));
const TrashDetailPage = lazy(() => import('../features/trash/TrashDetailPage'));

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

          {/* Admin & Operations Notifications & Messages */}
          <Route element={<ProtectedRoute roles={['super_admin', 'admin', 'staff']} />}>
            <Route path="/notifications" element={<AdminNotificationsPage />} />
            <Route path="/messages" element={<AdminMessagesPage />} />
            <Route path="/ratings" element={<RatingsPage />} />
            <Route path="/ratings/:id" element={<RatingDetailPage />} />
            <Route path="/certificates" element={<CertificatesPage />} />
            <Route path="/certificates/client/:id" element={<ClientMilestoneDetailPage />} />
            <Route path="/certificates/clients/:id" element={<ClientMilestoneDetailPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={['super_admin', 'admin']} />}>
            <Route path="/batteries" element={<BatteriesPage />} />
            <Route path="/batteries/unserviceable" element={<UnserviceableBatteriesPage />} />
            <Route path="/batteries-qr-code" element={<GenerateQrPage />} />
            <Route path="/invoices" element={<InvoicesPage />} />
            <Route path="/trash" element={<TrashPage />} />
            <Route path="/trash/:id" element={<TrashDetailPage />} />
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
            <Route path="/recycle-clients/:id" element={<RecycleClientDetailPage />} />
          </Route>
          <Route element={<ProtectedRoute permission="issue_reasons" />}>
            <Route path="/issue-reasons" element={<IssueReasonsPage />} />
          </Route>
          <Route element={<ProtectedRoute permission="services" />}>
            <Route path="/services" element={<ServicesPage />} />
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
            <Route path="/my/certificates" element={<ClientCertificatesPage />} />
            <Route path="/my/batteries" element={<ClientBatteriesPage />} />
            <Route path="/my/batteries/:bucket" element={<ClientBatteriesPage />} />
            <Route path="/my/history/:eventId" element={<ClientHistoryDetailPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={['client']} clientPermission="client_battery_sorting" />}>
            <Route path="/my/battery-sorting" element={<ClientBatterySortPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={['client', 'technician', 'recycle_client']} />}>
            <Route path="/my/profile" element={<ClientProfilePage />} />
          </Route>
          <Route element={<ProtectedRoute roles={['recycle_client']} />}>
            <Route path="/my/recycle-shipments" element={<RecycleClientShipmentsPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={['super_admin', 'admin', 'staff', 'recycle_client']} />}>
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
          </Route>
          <Route element={<ProtectedRoute permission="audit_logs" />}>
            <Route path="/audit-logs" element={<AuditLogPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={['super_admin']} />}>
            <Route path="/users" element={<UsersPage />} />
            <Route path="/finance" element={<FinancePage />} />
            <Route path="/finance/detail" element={<FinanceDetailPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default AppRoutes;
