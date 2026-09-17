import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FiAlertTriangle,
  FiClock,
  FiFileText,
  FiDownload,
  FiEye,
  FiArrowRight,
  FiX,
  FiCheckCircle,
  FiCalendar,
  FiAward,
  FiStar,
  FiGlobe,
  FiShield,
  FiTruck,
  FiPlus,
  FiCheck,
} from 'react-icons/fi';
import apiClient from '../../../services/api-client';
import Modal from '../../../components/ui/overlays/Modal';
import QrScanner from '../../../components/ui/primitives/QrScanner';
import extractBatteryCode from '../../../utils/extract-battery-code';
import { ClientStatusBadge } from '../../../components/ui/primitives/Badge';
import { useTheme } from '../../../context/ThemeContext';
import logoUrl from '../../../utils/logo-url';
import RatingModal from '../../../components/feedback/RatingModal';
import MilestoneCertificateModal from '../../../components/certificates/MilestoneCertificateModal';
import CertificateView from '../../../components/certificates/CertificateView';

// A battery is registered with status 'returned' from day one — it means
// "currently with the client", not "came back from a service visit" — so a
// battery that has never actually been through truck intake, repair, or a
// return dispatch shouldn't show a "Returned" badge; it's simply never been
// serviced yet.
function hasBeenServiced(row) {
  return Boolean(row.truck_intake_id || row.intake_id || row.last_repaired_at || row.return_id);
}

function formatCurrency(val) {
  const num = Number(val || 0);
  return '£' + num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function isImageFile(fileName = '', filePath = '') {
  return /\.(png|jpe?g|webp|gif|svg)$/i.test(fileName || filePath || '');
}

function isOverdue(inv) {
  if (inv.status === 'paid' || !inv.due_date) return false;
  const due = new Date(inv.due_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

function getDueDaysStatus(dueDateStr) {
  if (!dueDateStr) return { text: 'No Due Date Set', isOverdue: false, days: null };
  const due = new Date(dueDateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diffTime = due.getTime() - today.getTime();
  const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (days < 0) {
    return { text: `Overdue by ${Math.abs(days)} day${Math.abs(days) > 1 ? 's' : ''}`, isOverdue: true, days };
  }
  if (days === 0) {
    return { text: 'Due Today', isOverdue: false, isDueToday: true, days: 0 };
  }
  return { text: `Due in ${days} day${days > 1 ? 's' : ''}`, isOverdue: false, days };
}

function ClientDashboardPage() {
  const navigate = useNavigate();
  const { customTheme } = useTheme();
  const accent = customTheme?.accentColor || '#10b981';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Invoices & Pending Due Modal State
  const [invoices, setInvoices] = useState([]);
  const [showDuePaymentModal, setShowDuePaymentModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  // Recent batteries & tickets
  const [recentBatteries, setRecentBatteries] = useState([]);
  const [recentTickets, setRecentTickets] = useState([]);

  // Quick inline lookup & modal state
  const [inlineSearch, setInlineSearch] = useState('');
  const [showScanModal, setShowScanModal] = useState(false);
  const [modalCode, setModalCode] = useState('');
  const [useCamera, setUseCamera] = useState(false);

  // Truck Intake Modal & Success Popup State
  const [showAddTruckModal, setShowAddTruckModal] = useState(false);
  const [truckForm, setTruckForm] = useState({
    truckNumber: '',
    driverName: '',
    batteryCount: 1,
    batteryCodes: '',
    issueDescription: '',
  });
  const [submittingTruck, setSubmittingTruck] = useState(false);
  const [truckError, setTruckError] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [intakeSuccessResult, setIntakeSuccessResult] = useState(null);

  // Milestone Certificates & Rating Modals
  const [milestoneData, setMilestoneData] = useState(null);
  const [activeMilestoneCert, setActiveMilestoneCert] = useState(null);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [selectedPreviewCert, setSelectedPreviewCert] = useState(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingTargetBatteryCode, setRatingTargetBatteryCode] = useState('');

  const fetchDashboardData = useCallback(async (showFullSpinner = false) => {
    if (showFullSpinner) setLoading(true);
    try {
      const [dashRes, battRes, tickRes, invRes, certRes] = await Promise.all([
        apiClient.get('/clients/me/dashboard'),
        apiClient.get('/clients/me/batteries'),
        apiClient.get('/tickets?limit=3').catch(() => ({ data: { data: [] } })),
        apiClient.get('/clients/me/invoices').catch(() => ({ data: { data: [] } })),
        apiClient.get('/certificates/my-milestones').catch(() => ({ data: null })),
      ]);

      setData(dashRes.data);
      setRecentBatteries((battRes.data?.data || []).slice(0, 6));
      setRecentTickets(tickRes.data?.data || []);

      const invList = invRes.data?.data || [];
      setInvoices(invList);

      const unpaidInvoices = invList.filter((inv) => inv.status !== 'paid');
      const alreadyDismissed = sessionStorage.getItem('dismissed_due_payment_modal') === 'true';

      if (unpaidInvoices.length > 0 && !alreadyDismissed) {
        setShowDuePaymentModal(true);
      }

      if (certRes?.data) {
        setMilestoneData(certRes.data);
        const unacked = certRes.data.unacknowledged || [];
        if (unacked.length > 0) {
          setActiveMilestoneCert(unacked[0]);
          setShowMilestoneModal(true);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData(true);
  }, [fetchDashboardData]);

  async function handleRecordTruckIntake(e) {
    e?.preventDefault();
    if (!truckForm.truckNumber.trim()) {
      setTruckError('Truck Number is required.');
      return;
    }
    setSubmittingTruck(true);
    setTruckError(null);
    try {
      const codesArray = truckForm.batteryCodes
        .split(/[\n,]+/)
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean);

      const payload = {
        truckNumber: truckForm.truckNumber.trim(),
        driverName: truckForm.driverName.trim(),
        batteryCount: Number(truckForm.batteryCount) || (codesArray.length > 0 ? codesArray.length : 1),
        batteryCodes: codesArray,
        issueDescription: truckForm.issueDescription.trim(),
      };

      const res = await apiClient.post('/clients/me/truck-intakes', payload);

      // Close the intake form popup
      setShowAddTruckModal(false);

      // Reset form
      setTruckForm({
        truckNumber: '',
        driverName: '',
        batteryCount: 1,
        batteryCodes: '',
        issueDescription: '',
      });

      // Show success modal popup
      setIntakeSuccessResult(res.data?.data || res.data);
      setShowSuccessModal(true);

      // Refresh dashboard data
      fetchDashboardData(false);
    } catch (err) {
      setTruckError(err.response?.data?.message || err.message || 'Failed to record truck intake.');
    } finally {
      setSubmittingTruck(false);
    }
  }

  function handleScan(raw) {
    const code = extractBatteryCode(raw);
    if (code) {
      setShowScanModal(false);
      navigate(`/batteries/${encodeURIComponent(code)}`);
    }
  }

  function handleInlineSubmit(e) {
    e.preventDefault();
    const code = extractBatteryCode(inlineSearch);
    if (code) {
      navigate(`/batteries/${encodeURIComponent(code)}`);
    }
  }

  function handleModalSubmit(e) {
    e.preventDefault();
    const code = extractBatteryCode(modalCode);
    if (code) {
      setShowScanModal(false);
      navigate(`/batteries/${encodeURIComponent(code)}`);
    }
  }

  async function handleViewInvoice(invoice) {
    if (!invoice.file_path) return;
    setActionLoading(invoice.id);
    try {
      const response = await apiClient.get(`/invoices/${invoice.id}/download`, {
        responseType: 'blob',
      });
      const ext = (invoice.file_name || invoice.file_path || '').toLowerCase();
      const isImg = isImageFile(invoice.file_name, invoice.file_path);
      const mimeType = isImg
        ? (ext.endsWith('.png') ? 'image/png' : ext.endsWith('.webp') ? 'image/webp' : 'image/jpeg')
        : 'application/pdf';
      const blob = new Blob([response.data], { type: response.headers['content-type'] || mimeType });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to open invoice.');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDownloadInvoice(invoice) {
    if (!invoice.file_path) return;
    setActionLoading(invoice.id);
    try {
      const response = await apiClient.get(`/invoices/${invoice.id}/download?download=true`, {
        responseType: 'blob',
      });
      const blobUrl = URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', invoice.file_name || `Invoice-${invoice.invoice_number}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to download invoice.');
    } finally {
      setActionLoading(null);
    }
  }

  function handleDismissDueModal() {
    sessionStorage.setItem('dismissed_due_payment_modal', 'true');
    setShowDuePaymentModal(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-3 border-emerald-500 border-t-transparent" />
        <p className="text-sm font-medium text-slate-500 dark:text-neutral-400">Loading your client portal…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50/50 p-8 text-center dark:border-red-900/40 dark:bg-red-950/20">
        <p className="text-base font-semibold text-red-700 dark:text-red-400">{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-500"
        >
          Try Again
        </button>
      </div>
    );
  }

  const { client, stats } = data || {};
  const totalBatteries = Number(stats?.battery_count || 0);
  const inRepair = Number(stats?.in_repair_count || 0);
  const inProgress = Number(stats?.in_progress_count || 0);
  const inTesting = Number(stats?.in_testing_count || 0);
  const returned = Number(stats?.returned_count || 0);
  const balanceOwed = Number(stats?.balance || 0);

  const activeInService = inProgress + inTesting + inRepair;

  const unpaidInvoices = invoices.filter((inv) => inv.status !== 'paid');
  const overdueInvoices = unpaidInvoices.filter(isOverdue);
  const hasOverdue = overdueInvoices.length > 0;

  return (
    <div className="space-y-7 pb-12">
      {/* ── Top Pending / Overdue Payment Alert Banner ─────────────── */}
      {unpaidInvoices.length > 0 && (
        <div
          className={`rounded-3xl border p-4.5 transition-all shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            hasOverdue
              ? 'bg-gradient-to-r from-rose-50 via-rose-50/70 to-rose-100/40 border-rose-300 dark:from-rose-950/40 dark:via-rose-950/30 dark:to-rose-900/20 dark:border-rose-800/60'
              : 'bg-gradient-to-r from-amber-50 via-amber-50/70 to-amber-100/40 border-amber-300 dark:from-amber-950/40 dark:via-amber-950/30 dark:to-amber-900/20 dark:border-amber-800/60'
          }`}
        >
          <div className="flex items-start sm:items-center gap-3.5">
            <div
              className={`p-2.5 rounded-2xl shrink-0 ${
                hasOverdue
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/70 dark:text-rose-300 shadow-2xs'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-900/70 dark:text-amber-300 shadow-2xs'
              }`}
            >
              <FiAlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4
                  className={`text-sm font-black ${
                    hasOverdue ? 'text-rose-900 dark:text-rose-200' : 'text-amber-950 dark:text-amber-200'
                  }`}
                >
                  {hasOverdue ? 'Action Required: Overdue Payment Notice' : 'Pending Due Payment Reminder'}
                </h4>
                <span
                  className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                    hasOverdue
                      ? 'bg-rose-200/80 text-rose-800 dark:bg-rose-900 dark:text-rose-200'
                      : 'bg-amber-200/80 text-amber-900 dark:bg-amber-900 dark:text-amber-200'
                  }`}
                >
                  {hasOverdue
                    ? `${overdueInvoices.length} Overdue`
                    : `${unpaidInvoices.length} Pending`}
                </span>
              </div>
              <p
                className={`text-xs mt-0.5 ${
                  hasOverdue ? 'text-rose-700 dark:text-rose-300' : 'text-amber-800 dark:text-amber-300'
                }`}
              >
                You have <span className="font-bold">{unpaidInvoices.length} unpaid billing statement{unpaidInvoices.length > 1 ? 's' : ''}</span> awaiting settlement.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setShowDuePaymentModal(true)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black shadow-xs hover:opacity-95 transition-all cursor-pointer ${
                hasOverdue
                  ? 'bg-rose-600 text-white hover:bg-rose-700'
                  : 'bg-amber-600 text-white hover:bg-amber-700'
              }`}
            >
              <span>View Due Invoices</span>
              <FiArrowRight className="w-3.5 h-3.5" />
            </button>
            <Link
              to="/my/invoices"
              className="text-xs font-bold px-3 py-2 rounded-xl text-slate-700 bg-white/80 hover:bg-white dark:text-neutral-200 dark:bg-white/10 dark:hover:bg-white/20 border border-slate-200/60 dark:border-white/10 transition-all"
            >
              Invoices Page
            </Link>
          </div>
        </div>
      )}
      {/* ── Top Header Section (Clean & Professional) ────────────────────── */}
      <div className="flex flex-col gap-2 border-b border-slate-200/80 pb-5 dark:border-white/10">
        <div className="flex items-center gap-3.5">
          {client?.logo_path && (
            <img
              src={logoUrl(client.logo_path)}
              alt={`${client.name} logo`}
              className="h-10 w-10 shrink-0 rounded-xl border border-slate-200/80 bg-white object-contain p-1 shadow-2xs dark:border-white/10 dark:bg-surface-850"
            />
          )}
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Fleet Dashboard
            </h1>
            <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
              Live battery tracking, workshop repair progress, and fleet analytics.
            </p>
          </div>
        </div>
      </div>

      {/* ── Key Metrics Cards (Financial & Volume) ────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Batteries */}
        <Link
          to="/my/batteries"
          className="group relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-500/80 hover:shadow-md dark:border-white/10 dark:bg-surface-900 dark:hover:border-emerald-400/60"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wider text-slate-400 uppercase dark:text-neutral-500">
              Total Fleet
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 transition-colors group-hover:bg-emerald-50 group-hover:text-emerald-600 dark:bg-white/10 dark:text-neutral-300 dark:group-hover:bg-emerald-950/60 dark:group-hover:text-emerald-400">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M7 2a1 1 0 0 0-1 1v1H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1V3a1 1 0 1 0-2 0v1H8V3a1 1 0 0 0-1-1Zm10 10h-2v3h-2v-3h-2v-2h2V7h2v3h2v2Z" />
              </svg>
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-slate-900 group-hover:text-emerald-600 transition-colors dark:text-white dark:group-hover:text-emerald-400">
              {totalBatteries.toLocaleString()}
            </span>
            <div className="mt-1 flex items-center justify-between text-xs text-slate-500 dark:text-neutral-400">
              <span>Total registered units</span>
              <span className="font-bold text-emerald-600 group-hover:translate-x-0.5 transition-transform dark:text-emerald-400">View All →</span>
            </div>
          </div>
        </Link>

        {/* Active In-Service */}
        <Link
          to="/my/batteries/pending"
          className="group relative overflow-hidden rounded-3xl border border-blue-200/80 bg-gradient-to-br from-blue-50/50 via-white to-blue-50/20 p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md dark:border-blue-900/40 dark:from-blue-950/20 dark:to-surface-900"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wider text-blue-700 uppercase dark:text-blue-400">
              In Service & Testing
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-blue-600" />
              </span>
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-blue-700 group-hover:text-blue-800 transition-colors dark:text-blue-300 dark:group-hover:text-blue-200">
              {activeInService.toLocaleString()}
            </span>
            <div className="mt-1 flex items-center justify-between text-xs text-blue-600/80 dark:text-blue-400/80">
              <span>Active in workshop</span>
              <span className="font-bold text-blue-700 group-hover:translate-x-0.5 transition-transform dark:text-blue-400">View Queue →</span>
            </div>
          </div>
        </Link>

        {/* Repaired & Returned */}
        <Link
          to="/my/batteries/received"
          className="group relative overflow-hidden rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/50 via-white to-emerald-50/20 p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md dark:border-emerald-900/40 dark:from-emerald-950/20 dark:to-surface-900"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wider text-emerald-700 uppercase dark:text-emerald-400">
              Returned & Ready
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-emerald-700 group-hover:text-emerald-800 transition-colors dark:text-emerald-300 dark:group-hover:text-emerald-200">
              {returned.toLocaleString()}
            </span>
            <div className="mt-1 flex items-center justify-between text-xs text-emerald-600/80 dark:text-emerald-400/80">
              <span>Returned to your depot</span>
              <span className="font-bold text-emerald-700 group-hover:translate-x-0.5 transition-transform dark:text-emerald-400">View Fleet →</span>
            </div>
          </div>
        </Link>

        {/* Balance Owed */}
        <Link
          to="/my/transactions"
          className="group relative overflow-hidden rounded-3xl border border-amber-200/80 bg-gradient-to-br from-amber-50/60 via-white to-amber-50/20 p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-md dark:border-amber-900/40 dark:from-amber-950/20 dark:to-surface-900"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wider text-amber-800 uppercase dark:text-amber-400">
              Outstanding Balance
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
              <span className="text-base font-bold">£</span>
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-amber-900 group-hover:text-amber-950 transition-colors dark:text-amber-300">
              {formatCurrency(balanceOwed)}
            </span>
            <div className="mt-1 flex items-center justify-between text-xs text-amber-800/80 dark:text-amber-400/80">
              <span>Invoiced balance</span>
              <span className="font-bold text-amber-700 group-hover:translate-x-0.5 transition-transform dark:text-amber-400">
                Invoices →
              </span>
            </div>
          </div>
        </Link>
      </div>

      {/* ── Interactive Visual Service Pipeline ─────────────────────────── */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-surface-900">
        <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              Live Fleet Service Pipeline
            </h2>
            <p className="text-xs text-slate-500 dark:text-neutral-400">
              Track the exact lifecycle journey of your battery units across 3 dedicated stages.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Stage 1: Packed to Repair */}
          <Link
            to="/my/batteries/packed"
            className="group relative flex flex-col justify-between rounded-2xl border border-amber-200/70 bg-gradient-to-b from-amber-50/40 to-white p-5 shadow-2xs transition-all hover:border-amber-400 hover:shadow-md dark:border-amber-900/30 dark:from-amber-950/20 dark:to-surface-850"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700 shadow-2xs dark:bg-amber-900/50 dark:text-amber-300">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                      <path d="m7.5 4.27 9 5.15" />
                      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                      <path d="m3.3 7 8.7 5 8.7-5" />
                      <path d="M12 22V12" />
                    </svg>
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                    Stage 1
                  </span>
                </div>
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-extrabold text-amber-900 dark:bg-amber-950/70 dark:text-amber-200">
                  {inRepair} Units
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 group-hover:text-amber-800 dark:text-white dark:group-hover:text-amber-300">
                Battery Packed to Repair
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
                Logged by your team and scheduled for workshop truck intake.
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-bold text-amber-700 dark:border-white/5 dark:text-amber-400">
              <span>Inspect Packed List</span>
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </div>
          </Link>

          {/* Stage 2: Serviced / Received Batteries — search + date filter
              table (this used to link to a live "in service & testing"
              queue; clients care about what's been serviced and returned,
              which the Received bucket's table already covers). */}
          <Link
            to="/my/batteries/received"
            className="group relative flex flex-col justify-between rounded-2xl border border-emerald-200/70 bg-gradient-to-b from-emerald-50/40 to-white p-5 shadow-2xs transition-all hover:border-emerald-400 hover:shadow-md dark:border-emerald-900/30 dark:from-emerald-950/20 dark:to-surface-850"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 shadow-2xs dark:bg-emerald-900/50 dark:text-emerald-300">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
                      <path d="M15 18H9" />
                      <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
                      <circle cx="17" cy="18" r="2" />
                      <circle cx="7" cy="18" r="2" />
                    </svg>
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    Stage 2
                  </span>
                </div>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-extrabold text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-200">
                  {returned} Units
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-800 dark:text-white dark:group-hover:text-emerald-300">
                Serviced &amp; Received Batteries
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
                Search and filter by date across every battery restored and returned to your fleet.
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-bold text-emerald-700 dark:border-white/5 dark:text-emerald-400">
              <span>View Serviced &amp; Received</span>
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </div>
          </Link>
        </div>
      </div>

      {/* ── Two Column Hub: Recent Batteries & Help Center ─────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Recent Batteries Table */}
        <div className="lg:col-span-8 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-surface-900">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Recent Fleet Batteries
              </h3>
              <p className="text-xs text-slate-500 dark:text-neutral-400">
                Quickly inspect your latest battery updates and physical serial numbers.
              </p>
            </div>
            <Link
              to="/my/batteries/received"
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
            >
              View All ({totalBatteries}) →
            </Link>
          </div>

          {recentBatteries.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 dark:text-neutral-500">
              No batteries registered yet under your account.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:border-white/5 dark:text-neutral-500">
                  <tr>
                    <th className="pb-3 pr-4">Battery ID</th>
                    <th className="pb-3 pr-4">Physical Serial</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 pr-4">Registered</th>
                    <th className="pb-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                  {recentBatteries.map((item) => (
                    <tr key={item.id} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-white/5">
                      <td className="py-3.5 pr-4">
                        <Link
                          to={`/batteries/${encodeURIComponent(item.battery_code)}`}
                          className="font-mono font-bold text-emerald-700 hover:underline dark:text-emerald-400"
                        >
                          {item.battery_code}
                        </Link>
                      </td>
                      <td className="py-3.5 pr-4">
                        {item.serial_number ? (
                          <span className="font-semibold text-slate-800 dark:text-neutral-100">
                            {item.serial_number}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-neutral-500 font-normal">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3.5 pr-4">
                        {hasBeenServiced(item) ? (
                          <ClientStatusBadge status={item.status} />
                        ) : (
                          <span className="text-slate-400 dark:text-neutral-500">—</span>
                        )}
                      </td>
                      <td className="py-3.5 pr-4 text-slate-500 dark:text-neutral-400">
                        {item.created_at ? new Date(item.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}
                      </td>
                      <td className="py-3.5 text-right">
                        <Link
                          to={`/batteries/${encodeURIComponent(item.battery_code)}`}
                          className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:bg-emerald-600 hover:text-white dark:bg-white/10 dark:text-neutral-200 dark:hover:bg-emerald-600"
                        >
                          Details →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Column: Direct Help & Support Hub */}
        <div className="lg:col-span-4 flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-surface-900">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/5">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
                  </svg>
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Help & Support</h3>
                  <p className="text-[11px] text-slate-400 dark:text-neutral-400">Direct line to operations team</p>
                </div>
              </div>

              <Link
                to="/my/support"
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
              >
                Inbox →
              </Link>
            </div>

            <div className="mt-4 space-y-2.5">
              {recentTickets.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center dark:border-white/10 dark:bg-surface-850">
                  <p className="text-xs font-semibold text-slate-700 dark:text-neutral-300">No open inquiries</p>
                  <p className="mt-1 text-[11px] text-slate-400 dark:text-neutral-500">Need help with a battery or delivery?</p>
                </div>
              ) : (
                recentTickets.map((t) => (
                  <Link
                    key={t.id}
                    to={`/my/support?ticket=${t.id}`}
                    className="block rounded-2xl border border-slate-200/70 p-3 transition-colors hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {t.ticket_number}
                      </span>
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.2 text-[10px] font-bold capitalize text-slate-700 dark:bg-white/10 dark:text-neutral-300">
                        {t.status}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs font-medium text-slate-700 dark:text-neutral-200">
                      {t.subject}
                    </p>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="mt-5 border-t border-slate-100 pt-4 dark:border-white/5">
            <Link
              to="/my/support"
              style={{ backgroundColor: accent }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:opacity-90 active:scale-98"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
              </svg>
              New Support Request
            </Link>
          </div>
        </div>
      </div>

      {/* ── Scan QR Code Modal ────────────────────────────────────────────── */}
      {showScanModal && (
        <Modal title="Scan Battery QR Code" onClose={() => setShowScanModal(false)}>
          <div className="flex flex-col gap-5">
            <p className="text-xs sm:text-sm text-slate-600 dark:text-neutral-300">
              Point your camera at the battery QR code or type the Battery ID below to open its complete lifecycle, repairs, testing, and return logs.
            </p>

            {useCamera ? (
              <div className="flex flex-col items-center">
                <QrScanner onScan={handleScan} onClose={() => setUseCamera(false)} />
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <button
                  type="button"
                  onClick={() => setUseCamera(true)}
                  className="flex items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/70 p-6 text-sm sm:text-base font-bold text-emerald-800 transition-all hover:border-emerald-500 hover:bg-emerald-100/70 dark:border-emerald-800/60 dark:bg-emerald-950/20 dark:text-emerald-300"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
                    <path d="M12 9a3.75 3.75 0 1 0 0 7.5A3.75 3.75 0 0 0 12 9Z" />
                    <path fillRule="evenodd" d="M9.344 3.071a49.52 49.52 0 0 1 5.312 0c.967.052 1.83.585 2.332 1.39l.821 1.317c.24.383.645.643 1.11.71.386.054.77.113 1.152.177 1.432.239 2.429 1.493 2.429 2.909V18a3 3 0 0 1-3 3H4.5a3 3 0 0 1-3-3V9.574c0-1.416.997-2.67 2.429-2.909.382-.064.766-.123 1.151-.178a1.56 1.56 0 0 0 1.11-.71l.822-1.315a2.75 2.75 0 0 1 2.332-1.39ZM6.75 12.75a5.25 5.25 0 1 1 10.5 0 5.25 5.25 0 0 1-10.5 0Zm12-1.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
                  </svg>
                  Open Camera Scanner
                </button>

                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-200 dark:bg-surface-700" />
                  <span className="text-[11px] font-bold text-slate-400 uppercase dark:text-neutral-500">or enter code manually</span>
                  <div className="h-px flex-1 bg-slate-200 dark:bg-surface-700" />
                </div>

                <form onSubmit={handleModalSubmit} className="flex flex-col gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-neutral-200">
                      Battery Code / URL
                    </label>
                    <input
                      type="text"
                      value={modalCode}
                      onChange={(e) => setModalCode(e.target.value)}
                      placeholder="e.g. UBE-0001 or scan URL"
                      autoCapitalize="characters"
                      autoFocus
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 dark:border-surface-700 dark:bg-surface-800 dark:text-neutral-100"
                    />
                  </div>
                  <div className="flex justify-end gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowScanModal(false)}
                      className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-surface-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!modalCode.trim()}
                      style={{ backgroundColor: accent }}
                      className="rounded-xl px-5 py-2 text-xs font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
                    >
                      View Full History
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ── Pending Due Payment Popup Modal ─────────────────────────────── */}
      {showDuePaymentModal && unpaidInvoices.length > 0 && (
        <Modal
          title={hasOverdue ? 'Overdue Payment Action Required' : 'Pending Due Payment Notice'}
          description="Official billing statement and settlement reminder for your battery service visits."
          size="xl"
          onClose={handleDismissDueModal}
        >
          <div className="space-y-3.5">
            {/* Alert Header Banner inside Modal */}
            <div
              className={`p-3 rounded-xl border flex items-center gap-3 ${
                hasOverdue
                  ? 'bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-900/40 text-rose-800 dark:text-rose-200'
                  : 'bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-900/40 text-amber-900 dark:text-amber-200'
              }`}
            >
              <div
                className={`p-1.5 rounded-lg shrink-0 ${
                  hasOverdue
                    ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-300'
                    : 'bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-300'
                }`}
              >
                <FiAlertTriangle className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-black">
                  {hasOverdue
                    ? `${overdueInvoices.length} Overdue Invoice${overdueInvoices.length > 1 ? 's' : ''} Past Due Date`
                    : `${unpaidInvoices.length} Pending Invoice${unpaidInvoices.length > 1 ? 's' : ''} Requiring Payment`}
                </h4>
                <p className="text-[11px] opacity-90 mt-0.5 leading-snug">
                  Please arrange payment remittance for the outstanding invoices listed below to ensure uninterrupted battery logistics and repairs.
                </p>
              </div>
            </div>

            {/* List of Pending Invoices */}
            <div className="space-y-2.5 max-h-[38vh] overflow-y-auto pr-1">
              {unpaidInvoices.map((inv) => {
                const dueStatus = getDueDaysStatus(inv.due_date);
                const isImg = isImageFile(inv.file_name, inv.file_path);
                const isLoadingThis = actionLoading === inv.id;

                return (
                  <div
                    key={inv.id}
                    className={`p-3 rounded-xl border transition-all ${
                      dueStatus.isOverdue
                        ? 'bg-rose-50/40 border-rose-200 hover:border-rose-300 dark:bg-rose-950/20 dark:border-rose-900/40'
                        : 'bg-slate-50/70 border-slate-200/80 hover:border-amber-300 dark:bg-surface-850 dark:border-white/10'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                            isImg
                              ? 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/40'
                              : 'bg-red-50 text-red-600 border-red-100 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/40'
                          }`}
                        >
                          <FiFileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                              {inv.invoice_number}
                            </span>
                            {dueStatus.isOverdue ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50">
                                <FiAlertTriangle className="w-2.5 h-2.5" />
                                <span>{dueStatus.text}</span>
                              </span>
                            ) : dueStatus.isDueToday ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300 dark:border-amber-800/50">
                                <FiClock className="w-2.5 h-2.5" />
                                <span>Due Today</span>
                              </span>
                            ) : inv.due_date ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
                                <FiClock className="w-2.5 h-2.5" />
                                <span>{dueStatus.text}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
                                <span>Pending Payment</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2.5 text-[11px] text-slate-500 dark:text-neutral-400 mt-0.5 flex-wrap">
                            <span>
                              Issued:{' '}
                              <span className="font-medium text-slate-700 dark:text-neutral-300">
                                {inv.issue_date
                                  ? new Date(inv.issue_date).toLocaleDateString('en-GB', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric',
                                    })
                                  : '—'}
                              </span>
                            </span>
                            {inv.due_date && (
                              <span>
                                • Due:{' '}
                                <span
                                  className={`font-bold ${
                                    dueStatus.isOverdue
                                      ? 'text-rose-600 dark:text-rose-400'
                                      : 'text-slate-800 dark:text-white'
                                  }`}
                                >
                                  {new Date(inv.due_date).toLocaleDateString('en-GB', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                  })}
                                </span>
                              </span>
                            )}
                          </div>

                          {inv.notes && (
                            <p className="text-[11px] text-slate-600 dark:text-neutral-300 mt-1 bg-white dark:bg-surface-900/80 p-1.5 rounded-lg border border-slate-200/60 dark:border-white/5 line-clamp-2">
                              <span className="font-bold text-slate-400 text-[9px] uppercase mr-1">
                                Note:
                              </span>
                              {inv.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                        {inv.file_path && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleViewInvoice(inv)}
                              disabled={isLoadingThis}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 dark:bg-surface-800 dark:text-neutral-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 transition-colors cursor-pointer disabled:opacity-50"
                              title="View Document"
                            >
                              <FiEye className="w-3 h-3 text-emerald-500" />
                              <span>View</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadInvoice(inv)}
                              disabled={isLoadingThis}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 dark:bg-surface-800 dark:text-neutral-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 transition-colors cursor-pointer disabled:opacity-50"
                              title="Download Invoice"
                            >
                              <FiDownload className="w-3 h-3 text-blue-500" />
                              <span>PDF</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Remittance Guidance */}
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 text-[10.5px] text-slate-500 dark:text-neutral-400 flex items-center gap-2">
              <FiClock className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>For invoice payment receipts or questions, contact our support desk or message Help & Support.</span>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-slate-100 dark:border-white/10">
              <button
                type="button"
                onClick={handleDismissDueModal}
                className="rounded-xl px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                Remind Me Later
              </button>
              <Link
                to="/my/invoices"
                onClick={() => setShowDuePaymentModal(false)}
                style={{ backgroundColor: accent }}
                className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-sm hover:opacity-90 transition-all cursor-pointer"
              >
                <span>Open Invoices & Bills Page</span>
                <FiArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Milestone Certificate Celebration Popup Modal ────────────── */}
      {showMilestoneModal && activeMilestoneCert && (
        <MilestoneCertificateModal
          certificate={activeMilestoneCert}
          clientName={client?.name}
          onClose={() => setShowMilestoneModal(false)}
          onAcknowledge={(cert) => {
            setShowMilestoneModal(false);
            // Refresh milestone status
            apiClient.get('/certificates/my-milestones').then((res) => {
              if (res?.data) setMilestoneData(res.data);
            });
          }}
        />
      )}


      {/* ── Add Truck Intake Modal ────────────────────────────────────── */}
      {showAddTruckModal && (
        <Modal onClose={() => !submittingTruck && setShowAddTruckModal(false)} title="Record Incoming Truck Intake">
          <form onSubmit={handleRecordTruckIntake} className="space-y-4 pt-1">
            <div>
              <p className="text-xs text-slate-500 dark:text-neutral-400">
                Log an incoming shipment dispatched to Refurbnics workshop for diagnostics & refurbishment.
              </p>
            </div>

            {truckError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                {truckError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-neutral-200 mb-1">
                  Truck / License Plate Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={truckForm.truckNumber}
                  onChange={(e) => setTruckForm((prev) => ({ ...prev, truckNumber: e.target.value }))}
                  placeholder="e.g. TR-8042 or KL18ABCD1234"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-hidden dark:border-white/10 dark:bg-surface-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-neutral-200 mb-1">
                  Driver Name / Contact
                </label>
                <input
                  type="text"
                  value={truckForm.driverName}
                  onChange={(e) => setTruckForm((prev) => ({ ...prev, driverName: e.target.value }))}
                  placeholder="e.g. John Smith"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-hidden dark:border-white/10 dark:bg-surface-800 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-neutral-200 mb-1">
                Battery Quantity <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTruckForm((prev) => ({ ...prev, batteryCount: Math.max(1, (Number(prev.batteryCount) || 1) - 1) }))}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 cursor-pointer"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  required
                  value={truckForm.batteryCount}
                  onChange={(e) => setTruckForm((prev) => ({ ...prev, batteryCount: Math.max(1, Number(e.target.value) || 1) }))}
                  className="w-24 rounded-xl border border-slate-200 bg-white py-2 text-center text-xs font-black text-slate-900 focus:border-emerald-500 focus:outline-hidden dark:border-white/10 dark:bg-surface-800 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setTruckForm((prev) => ({ ...prev, batteryCount: (Number(prev.batteryCount) || 1) + 1 }))}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 cursor-pointer"
                >
                  +
                </button>
                <span className="text-xs text-slate-400 dark:text-neutral-400 pl-1 font-medium">
                  battery pack{truckForm.batteryCount > 1 ? 's' : ''} on this vehicle
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-neutral-200 mb-1">
                Specific Battery Codes or Serials <span className="text-[11px] font-normal text-slate-400 dark:text-neutral-400">(Optional)</span>
              </label>
              <textarea
                rows={2}
                value={truckForm.batteryCodes}
                onChange={(e) => setTruckForm((prev) => ({ ...prev, batteryCodes: e.target.value }))}
                placeholder="e.g. HF-001, HF-002, HF-003 (comma or newline separated)"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-hidden dark:border-white/10 dark:bg-surface-800 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-neutral-200 mb-1">
                Fault / Service Notes <span className="text-[11px] font-normal text-slate-400 dark:text-neutral-400">(Optional)</span>
              </label>
              <textarea
                rows={2}
                value={truckForm.issueDescription}
                onChange={(e) => setTruckForm((prev) => ({ ...prev, issueDescription: e.target.value }))}
                placeholder="e.g. Routine 500-cycle overhaul, sudden discharge error, BMS diagnostics needed…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-hidden dark:border-white/10 dark:bg-surface-800 dark:text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-white/10">
              <button
                type="button"
                disabled={submittingTruck}
                onClick={() => setShowAddTruckModal(false)}
                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-white/10 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingTruck}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-black text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition-all cursor-pointer"
              >
                {submittingTruck ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Recording…</span>
                  </>
                ) : (
                  <>
                    <FiTruck className="h-3.5 w-3.5" />
                    <span>Record Intake</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Truck Intake Success Modal ─────────────────────────────────── */}
      {showSuccessModal && intakeSuccessResult && (
        <Modal onClose={() => setShowSuccessModal(false)}>
          <div className="flex flex-col items-center justify-center p-3 sm:p-5 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300 shadow-md ring-8 ring-emerald-50 dark:ring-emerald-950/30 animate-in zoom-in-75 duration-200">
              <FiCheckCircle className="h-8 w-8" />
            </div>

            <h3 className="mt-4 text-lg font-black text-slate-900 dark:text-white">
              Truck Intake Recorded Successfully!
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400 max-w-sm">
              Your dispatch has been registered. The Refurbnics workshop has been notified and will verify the batteries upon arrival.
            </p>

            <div className="mt-5 w-full rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 text-left dark:border-white/10 dark:bg-surface-850">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-neutral-400 uppercase tracking-wider block">
                    Truck Number
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white font-mono">
                    {intakeSuccessResult.intake?.truck_number || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-neutral-400 uppercase tracking-wider block">
                    Driver
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {intakeSuccessResult.intake?.driver_name || 'Fleet Driver'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-neutral-400 uppercase tracking-wider block">
                    Batteries Dispatched
                  </span>
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                    {intakeSuccessResult.count || intakeSuccessResult.intake?.battery_count || 1} packs
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-neutral-400 uppercase tracking-wider block">
                    Status
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
                    Pending Arrival
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex w-full justify-center">
              <button
                type="button"
                onClick={() => setShowSuccessModal(false)}
                className="w-full rounded-xl bg-slate-900 py-2.5 text-xs font-black text-white shadow-xs hover:bg-emerald-600 dark:bg-surface-800 dark:hover:bg-emerald-600 transition-all cursor-pointer"
              >
                ✓ Done & Return to Dashboard
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Client Service Rating Modal ───────────────────────────────── */}
      {showRatingModal && (
        <RatingModal
          batteryCode={ratingTargetBatteryCode}
          clientId={client?.id}
          onClose={() => setShowRatingModal(false)}
          onSuccess={() => {
            // Optionally reload or toast
          }}
        />
      )}
    </div>
  );
}

export default ClientDashboardPage;

