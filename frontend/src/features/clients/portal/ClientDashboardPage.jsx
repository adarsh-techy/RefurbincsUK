import { useEffect, useState, useCallback, useMemo } from 'react';
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
  FiSearch,
  FiActivity,
  FiTool,
  FiPackage,
  FiLayers,
  FiRefreshCw,
  FiTrendingUp,
  FiCpu,
  FiExternalLink,
  FiInbox,
  FiFilter,
  FiZap,
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

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
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

  // All batteries & interactive filter tab
  const [allBatteries, setAllBatteries] = useState([]);
  const [tableTab, setTableTab] = useState('all');
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
        apiClient.get('/tickets?limit=4').catch(() => ({ data: { data: [] } })),
        apiClient.get('/clients/me/invoices').catch(() => ({ data: { data: [] } })),
        apiClient.get('/certificates/my-milestones').catch(() => ({ data: null })),
      ]);

      setData(dashRes.data);
      const batts = battRes.data?.data || [];
      setAllBatteries(batts);
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
    setSubmittingTruck(true);
    setTruckError(null);
    try {
      const codesArray = truckForm.batteryCodes
        .split(/[\n,]+/)
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean);

      const payload = {
        truckNumber: truckForm.truckNumber.trim() || 'N/A',
        driverName: truckForm.driverName.trim() || 'Fleet Driver',
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

  const { client, stats } = data || {};
  const totalBatteries = Number(stats?.battery_count || 0);
  const inRepair = Number(stats?.in_repair_count || 0);
  const inProgress = Number(stats?.in_progress_count || 0);
  const inTesting = Number(stats?.in_testing_count || 0);
  const repaired = Number(stats?.repaired_count || 0);
  const returned = Number(stats?.returned_count || 0);
  const unserviceable = Number(stats?.unserviceable_count || 0);
  const repairVisits = Number(stats?.repair_visit_count || 0);
  const balanceOwed = Number(stats?.balance || 0);

  const activeWorkshop = inProgress + inTesting + repaired;

  // Filtered batteries for table based on active tab and search query
  const filteredBatteries = useMemo(() => {
    let list = allBatteries;
    switch (tableTab) {
      case 'workshop':
        list = list.filter((b) =>
          ['in_progress', 'in_testing', 'testing', 'repair_testing', 'repaired'].includes(b.status)
        );
        break;
      case 'fleet':
        list = list.filter((b) => b.status === 'returned');
        break;
      case 'packed':
        list = list.filter((b) => b.status === 'in_repair');
        break;
      case 'unserviceable':
        list = list.filter((b) =>
          ['unserviceable', 'tested_parts_removed', 'recycled'].includes(b.status)
        );
        break;
      default:
        break;
    }

    if (inlineSearch.trim()) {
      const q = inlineSearch.trim().toLowerCase();
      list = list.filter(
        (b) =>
          (b.battery_code && b.battery_code.toLowerCase().includes(q)) ||
          (b.serial_number && b.serial_number.toLowerCase().includes(q)) ||
          (b.truck_number && String(b.truck_number).toLowerCase().includes(q))
      );
    }

    return list;
  }, [allBatteries, tableTab, inlineSearch]);

  // Tab counts
  const workshopCount = useMemo(
    () =>
      allBatteries.filter((b) =>
        ['in_progress', 'in_testing', 'testing', 'repair_testing', 'repaired'].includes(b.status)
      ).length,
    [allBatteries]
  );
  const fleetCount = useMemo(() => allBatteries.filter((b) => b.status === 'returned').length, [allBatteries]);
  const packedCount = useMemo(() => allBatteries.filter((b) => b.status === 'in_repair').length, [allBatteries]);
  const unserviceableCount = useMemo(
    () =>
      allBatteries.filter((b) =>
        ['unserviceable', 'tested_parts_removed', 'recycled'].includes(b.status)
      ).length,
    [allBatteries]
  );

  // Operational metrics
  const fleetAvailabilityRate =
    totalBatteries > 0 ? ((returned / totalBatteries) * 100).toFixed(1) : '100.0';
  const restorationSuccessRate =
    returned + unserviceable > 0 ? ((returned / (returned + unserviceable)) * 100).toFixed(1) : '100.0';
  const estimatedCo2Saved = (returned * 3.8).toFixed(0);

  // Milestone and ESG progress
  const servicedCount = Number(milestoneData?.servicedCount || 0);
  const allMilestoneCerts = milestoneData?.allCerts || [];
  const milestoneTiers = milestoneData?.milestoneTiers || [];
  const nextMilestoneTier = milestoneTiers.find((t) => t.count > servicedCount);
  const nextTierProgress = nextMilestoneTier
    ? Math.min(100, Math.round((servicedCount / nextMilestoneTier.count) * 100))
    : 100;

  const unpaidInvoices = invoices.filter((inv) => inv.status !== 'paid');
  const overdueInvoices = unpaidInvoices.filter(isOverdue);
  const hasOverdue = overdueInvoices.length > 0;

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

      {/* ── Top Header Section (Clean, Vibrant & 100% Responsive) ────────── */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50/50 to-emerald-50/30 p-5 sm:p-6 shadow-sm dark:border-white/10 dark:from-surface-900 dark:via-surface-900 dark:to-emerald-950/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4 min-w-0">
            {client?.logo_path ? (
              <img
                src={logoUrl(client.logo_path)}
                alt={`${client.name} logo`}
                className="h-12 w-12 sm:h-14 sm:w-14 shrink-0 rounded-2xl border border-slate-200/80 bg-white object-contain p-1.5 shadow-2xs dark:border-white/10 dark:bg-surface-850"
              />
            ) : (
              <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-black text-lg shadow-sm">
                {(client?.name || 'C').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/80 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Verified Fleet Portal
                </span>
                <span className="text-[11px] text-slate-400 dark:text-neutral-500 font-medium">
                  {getTimeGreeting()}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white truncate mt-1">
                {client?.name ? `${client.name}` : 'Client Fleet Hub'}
              </h1>
              <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
                Real-time battery lifecycle tracking, workshop diagnostics, return deliveries & certified ESG impact.
              </p>
            </div>
          </div>

          {/* Responsive Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full lg:w-auto pt-2 lg:pt-0">
            <button
              type="button"
              onClick={() => setShowAddTruckModal(true)}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 active:scale-95 transition-all cursor-pointer"
            >
              <FiTruck className="w-4 h-4" />
              <span>+ Add Truck Intake</span>
            </button>
            <button
              type="button"
              onClick={() => setShowScanModal(true)}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-300 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 dark:hover:bg-surface-700 active:scale-95 transition-all cursor-pointer"
            >
              <FiSearch className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Scan QR / Search</span>
            </button>
            <Link
              to="/my/battery-sorting"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-300 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 dark:hover:bg-surface-700 active:scale-95 transition-all"
            >
              <FiLayers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Sort Batteries</span>
            </Link>
            <Link
              to="/my/invoices"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-300 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 dark:hover:bg-surface-700 active:scale-95 transition-all"
            >
              <FiFileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Invoices</span>
            </Link>
            <Link
              to="/my/support"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-300 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 dark:hover:bg-surface-700 active:scale-95 transition-all"
            >
              <FiInbox className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Help Desk</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ── 8 Primary Fleet KPI Metric Cards Grid ───────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Card 1: Total Fleet */}
        <Link
          to="/my/batteries/all"
          className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-400 dark:border-white/10 dark:bg-surface-900"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-400 dark:text-neutral-400">
              Total Fleet
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-neutral-300 group-hover:scale-105 transition-transform">
              <FiLayers className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              {totalBatteries.toLocaleString()}
            </span>
            <div className="mt-1 flex items-center justify-between text-[11px] sm:text-xs text-slate-500 dark:text-neutral-400">
              <span>Registered units</span>
              <span className="font-bold text-slate-700 dark:text-neutral-300 group-hover:translate-x-0.5 transition-transform">View All →</span>
            </div>
          </div>
        </Link>

        {/* Card 2: Stage 1 · Packed to Repair */}
        <Link
          to="/my/batteries/packed"
          className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-amber-200/90 bg-gradient-to-br from-amber-50/50 via-white to-amber-50/20 p-4 sm:p-5 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-amber-400 dark:border-amber-900/40 dark:from-amber-950/20 dark:to-surface-900"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Stage 1 · Packed
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 group-hover:scale-105 transition-transform">
              <FiPackage className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-amber-800 dark:text-amber-300">
              {inRepair.toLocaleString()}
            </span>
            <div className="mt-1 flex items-center justify-between text-[11px] sm:text-xs text-amber-700/80 dark:text-amber-400/80">
              <span>Awaiting intake</span>
              <span className="font-bold text-amber-800 dark:text-amber-300 group-hover:translate-x-0.5 transition-transform">Inspect →</span>
            </div>
          </div>
        </Link>

        {/* Card 3: Stage 2 · In Workshop Service */}
        <Link
          to="/my/batteries/pending"
          className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-blue-200/90 bg-gradient-to-br from-blue-50/50 via-white to-blue-50/20 p-4 sm:p-5 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-blue-400 dark:border-blue-900/40 dark:from-blue-950/20 dark:to-surface-900"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-blue-700 dark:text-blue-400">
              Stage 2 · In Service
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 group-hover:scale-105 transition-transform">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-blue-600" />
              </span>
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-blue-800 dark:text-blue-300">
              {(inProgress + inTesting).toLocaleString()}
            </span>
            <div className="mt-1 flex items-center justify-between text-[11px] sm:text-xs text-blue-700/80 dark:text-blue-400/80">
              <span>{inProgress} rep · {inTesting} test</span>
              <span className="font-bold text-blue-800 dark:text-blue-300 group-hover:translate-x-0.5 transition-transform">Live Queue →</span>
            </div>
          </div>
        </Link>

        {/* Card 4: Repaired & QA Passed */}
        <Link
          to="/my/batteries/pending"
          className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-teal-200/90 bg-gradient-to-br from-teal-50/50 via-white to-teal-50/20 p-4 sm:p-5 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-teal-400 dark:border-teal-900/40 dark:from-teal-950/20 dark:to-surface-900"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-teal-700 dark:text-teal-400">
              Repaired & Certified
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 group-hover:scale-105 transition-transform">
              <FiCheckCircle className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-teal-800 dark:text-teal-300">
              {repaired.toLocaleString()}
            </span>
            <div className="mt-1 flex items-center justify-between text-[11px] sm:text-xs text-teal-700/80 dark:text-teal-400/80">
              <span>Ready for dispatch</span>
              <span className="font-bold text-teal-800 dark:text-teal-300 group-hover:translate-x-0.5 transition-transform">View →</span>
            </div>
          </div>
        </Link>

        {/* Card 5: Stage 3 · Returned & Active Fleet */}
        <Link
          to="/my/batteries/received"
          className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-emerald-200/90 bg-gradient-to-br from-emerald-50/50 via-white to-emerald-50/20 p-4 sm:p-5 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-emerald-400 dark:border-emerald-900/40 dark:from-emerald-950/20 dark:to-surface-900"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Stage 3 · Active Fleet
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 group-hover:scale-105 transition-transform">
              <FiShield className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-emerald-800 dark:text-emerald-300">
              {returned.toLocaleString()}
            </span>
            <div className="mt-1 flex items-center justify-between text-[11px] sm:text-xs text-emerald-700/80 dark:text-emerald-400/80">
              <span>Operating in fleet</span>
              <span className="font-bold text-emerald-800 dark:text-emerald-300 group-hover:translate-x-0.5 transition-transform">View Fleet →</span>
            </div>
          </div>
        </Link>

        {/* Card 6: Decommissioned / Unserviceable */}
        <Link
          to="/my/batteries/all"
          className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-rose-200/90 bg-gradient-to-br from-rose-50/50 via-white to-rose-50/20 p-4 sm:p-5 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-rose-400 dark:border-rose-900/40 dark:from-rose-950/20 dark:to-surface-900"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-rose-700 dark:text-rose-400">
              Decommissioned
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 group-hover:scale-105 transition-transform">
              <FiRefreshCw className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-rose-800 dark:text-rose-300">
              {unserviceable.toLocaleString()}
            </span>
            <div className="mt-1 flex items-center justify-between text-[11px] sm:text-xs text-rose-700/80 dark:text-rose-400/80">
              <span>Recycled / Defect</span>
              <span className="font-bold text-rose-800 dark:text-rose-300 group-hover:translate-x-0.5 transition-transform">History →</span>
            </div>
          </div>
        </Link>

        {/* Card 7: Total Service Cycles */}
        <Link
          to="/my/history"
          className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-violet-200/90 bg-gradient-to-br from-violet-50/50 via-white to-violet-50/20 p-4 sm:p-5 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-violet-400 dark:border-violet-900/40 dark:from-violet-950/20 dark:to-surface-900"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-violet-700 dark:text-violet-400">
              Service Cycles
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 group-hover:scale-105 transition-transform">
              <FiActivity className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-violet-800 dark:text-violet-300">
              {repairVisits.toLocaleString()}
            </span>
            <div className="mt-1 flex items-center justify-between text-[11px] sm:text-xs text-violet-700/80 dark:text-violet-400/80">
              <span>All-time repair jobs</span>
              <span className="font-bold text-violet-800 dark:text-violet-300 group-hover:translate-x-0.5 transition-transform">Timeline →</span>
            </div>
          </div>
        </Link>

        {/* Card 8: Outstanding Balance */}
        <Link
          to="/my/transactions"
          className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-amber-200/90 bg-gradient-to-br from-amber-50/60 via-white to-amber-50/20 p-4 sm:p-5 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-amber-400 dark:border-amber-900/40 dark:from-amber-950/20 dark:to-surface-900"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-400">
              Verified Balance
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 group-hover:scale-105 transition-transform font-bold text-sm">
              £
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-amber-900 dark:text-amber-300">
              {formatCurrency(balanceOwed)}
            </span>
            <div className="mt-1 flex items-center justify-between text-[11px] sm:text-xs text-amber-800/80 dark:text-amber-400/80">
              <span>{unpaidInvoices.length > 0 ? `${unpaidInvoices.length} unpaid bill(s)` : 'Account settled'}</span>
              <span className="font-bold text-amber-800 dark:text-amber-300 group-hover:translate-x-0.5 transition-transform">Billing →</span>
            </div>
          </div>
        </Link>
      </div>

      {/* ── Fleet Health, Operational Throughput & ESG Bar ────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Metric 1: Fleet Availability */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-2xs dark:border-white/10 dark:bg-surface-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
              Fleet Operational Availability
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
              <FiCheck className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {fleetAvailabilityRate}%
            </span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              {returned} / {totalBatteries} in rotation
            </span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, Number(fleetAvailabilityRate)))}%` }}
            />
          </div>
        </div>

        {/* Metric 2: Workshop Restoration Yield */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-2xs dark:border-white/10 dark:bg-surface-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
              Refurbishment Success Rate
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
              <FiTrendingUp className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {restorationSuccessRate}%
            </span>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-black uppercase text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
              High Yield QA
            </span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, Number(restorationSuccessRate)))}%` }}
            />
          </div>
        </div>

        {/* Metric 3: ESG Impact & Environmental Carbon Offset */}
        <Link
          to="/my/certificates"
          className="group rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/40 via-white to-teal-50/30 p-5 shadow-2xs hover:border-emerald-400 hover:shadow-md transition-all dark:border-emerald-900/40 dark:from-emerald-950/20 dark:to-surface-900 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
              <FiGlobe className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>ESG Impact & CO₂ Avoided</span>
            </span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
              Eco Certified
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-900 dark:text-emerald-200">
              ~{estimatedCo2Saved} kg CO₂
            </span>
            <span className="text-xs font-bold text-emerald-700 group-hover:translate-x-0.5 transition-transform dark:text-emerald-300">
              View ESG Milestone →
            </span>
          </div>
          <p className="mt-1 text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
            Circular economy battery reclamation diverting toxic metals from landfill.
          </p>
        </Link>
      </div>

      {/* ── Visual 3-Stage Fleet Lifecycle Pipeline ─────────────────────── */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-surface-900">
        <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <FiActivity className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>3-Stage Fleet Lifecycle Journey</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-neutral-400">
              End-to-end transparent visibility of your batteries through intake, workshop restoration, and fleet delivery.
            </p>
          </div>
          <Link
            to="/my/batteries/all"
            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
          >
            All Inventory ({totalBatteries}) →
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Stage 1: Packed to Repair */}
          <Link
            to="/my/batteries/packed"
            className="group relative flex flex-col justify-between rounded-2xl border border-amber-200/80 bg-gradient-to-b from-amber-50/50 to-white p-5 shadow-2xs transition-all hover:border-amber-400 hover:shadow-md dark:border-amber-900/40 dark:from-amber-950/20 dark:to-surface-850"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-800 shadow-2xs dark:bg-amber-950/60 dark:text-amber-300">
                    <FiPackage className="h-5 w-5" />
                  </span>
                  <span className="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
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
              <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400 leading-relaxed">
                Packaged at your facility or scheduled for workshop truck intake and initial receiving verification.
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-bold text-amber-700 dark:border-white/5 dark:text-amber-400">
              <span>Inspect Packed List</span>
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </div>
          </Link>

          {/* Stage 2: In Service & Testing */}
          <Link
            to="/my/batteries/pending"
            className="group relative flex flex-col justify-between rounded-2xl border border-blue-200/80 bg-gradient-to-b from-blue-50/50 to-white p-5 shadow-2xs transition-all hover:border-blue-400 hover:shadow-md dark:border-blue-900/40 dark:from-blue-950/20 dark:to-surface-850"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-700 shadow-2xs dark:bg-blue-950/60 dark:text-blue-300">
                    <FiTool className="h-5 w-5" />
                  </span>
                  <span className="text-xs font-black uppercase tracking-wider text-blue-800 dark:text-blue-300">
                    Stage 2
                  </span>
                </div>
                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-extrabold text-blue-900 dark:bg-blue-950/70 dark:text-blue-200">
                  {activeWorkshop} Units
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-800 dark:text-white dark:group-hover:text-blue-300">
                Workshop Service & Testing
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400 leading-relaxed">
                Precision cell replacement, BMS diagnostics, and automated charge/discharge cycle bench testing.
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-bold text-blue-700 dark:border-white/5 dark:text-blue-400">
              <span>Inspect Service Queue</span>
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </div>
          </Link>

          {/* Stage 3: Battery Received / In Fleet */}
          <Link
            to="/my/batteries/received"
            className="group relative flex flex-col justify-between rounded-2xl border border-emerald-200/80 bg-gradient-to-b from-emerald-50/50 to-white p-5 shadow-2xs transition-all hover:border-emerald-400 hover:shadow-md dark:border-emerald-900/40 dark:from-emerald-950/20 dark:to-surface-850"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 shadow-2xs dark:bg-emerald-950/60 dark:text-emerald-300">
                    <FiShield className="h-5 w-5" />
                  </span>
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    Stage 3
                  </span>
                </div>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-extrabold text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-200">
                  {returned} Units
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-800 dark:text-white dark:group-hover:text-emerald-300">
                Battery Received (Active Fleet)
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400 leading-relaxed">
                QA-approved batteries verified, return-dispatched, and operating reliably in your depot fleet.
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-bold text-emerald-700 dark:border-white/5 dark:text-emerald-400">
              <span>View Received Fleet</span>
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </div>
          </Link>
        </div>
      </div>

      {/* ── ESG Sustainability Badges & Milestone Progress ──────────────── */}
      <div className="rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/40 via-white to-teal-50/30 p-5 sm:p-6 shadow-sm dark:border-emerald-900/40 dark:from-surface-900 dark:via-surface-900 dark:to-emerald-950/20">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 shadow-2xs">
              <FiAward className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Sustainability Milestones &amp; Green Fleet Badges
                </h3>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black uppercase text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                  {allMilestoneCerts.length > 0 ? `${allMilestoneCerts.length} Earned` : 'In Progress'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-neutral-400">
                Official circular economy credentials recognizing your depot&apos;s carbon reduction and battery reuse.
              </p>
            </div>
          </div>

          <Link
            to="/my/certificates"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 self-start sm:self-auto"
          >
            <span>View All ESG Certificates</span>
            <FiArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Milestone Progress Bar */}
        {nextMilestoneTier && (
          <div className="mt-4 rounded-2xl border border-emerald-100 bg-white/80 p-3.5 dark:border-white/5 dark:bg-surface-850">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <FiZap className="w-3.5 h-3.5" />
                </span>
                <span className="font-bold text-slate-800 dark:text-neutral-200">
                  Target: {nextMilestoneTier.title}
                </span>
              </div>
              <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                {servicedCount.toLocaleString()} / {nextMilestoneTier.count.toLocaleString()} Serviced Units ({nextTierProgress}%)
              </span>
            </div>
            <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 transition-all duration-500"
                style={{ width: `${nextTierProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Badges Display */}
        {allMilestoneCerts.length > 0 && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {allMilestoneCerts.map((cert) => (
              <div
                key={cert.id}
                onClick={() => setSelectedPreviewCert(cert)}
                className="group flex items-center justify-between gap-3 p-3 rounded-2xl border border-slate-200/80 bg-white hover:border-emerald-400 hover:shadow-xs transition-all cursor-pointer dark:border-white/10 dark:bg-surface-850"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40 group-hover:scale-105 transition-transform">
                    <FiAward className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-xs text-slate-900 dark:text-white truncate">
                      {cert.title}
                    </p>
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                      {(cert.co2_saved_kg || 0).toLocaleString()} kg CO₂ Offset
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPreviewCert(cert);
                  }}
                  className="shrink-0 p-1.5 text-xs font-bold text-slate-600 hover:text-emerald-600 dark:text-neutral-300 dark:hover:text-emerald-400 transition-colors"
                  title="Inspect Certificate"
                >
                  <FiEye className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <form onSubmit={handleInlineSubmit} className="relative flex items-center">
        <div className="relative w-full">
          <input
            type="text"
            value={inlineSearch}
            onChange={(e) => setInlineSearch(e.target.value)}
            placeholder="Quick Search: Enter Battery ID (e.g. UBE-0001, BAT-16-147) or physical serial number…"
            className="w-full rounded-2xl border border-slate-200/90 bg-white py-3 pl-11 pr-24 text-xs sm:text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-surface-900 dark:text-neutral-100 shadow-2xs"
          />
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 dark:text-neutral-500">
            <FiSearch className="h-4 w-4" />
          </div>
          <button
            type="submit"
            disabled={!inlineSearch.trim()}
            style={{ backgroundColor: accent }}
            className="absolute inset-y-1.5 right-1.5 inline-flex items-center gap-1.5 rounded-xl px-4 text-xs font-bold text-white shadow-2xs hover:opacity-90 disabled:opacity-40 transition-all cursor-pointer"
          >
            <span>Search</span>
            <FiArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>

      {/* ── Fleet Batteries Activity & Inspection Table ───────────────────── */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-4.5 sm:p-6 shadow-sm dark:border-white/10 dark:bg-surface-900">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <FiLayers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Fleet Battery Activity &amp; Records</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-neutral-400">
              Live records of your registered battery units, physical serials, and current lifecycle stages.
            </p>
          </div>

          <Link
            to="/my/batteries/all"
            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 self-start sm:self-auto"
          >
            View Full Inventory ({allBatteries.length}) →
          </Link>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 overflow-x-auto text-xs font-bold dark:border-white/5">
          <button
            type="button"
            onClick={() => setTableTab('all')}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              tableTab === 'all'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100 dark:text-neutral-400 dark:hover:bg-surface-800'
            }`}
          >
            <span>All Batteries</span>
            <span className="rounded-full bg-slate-200/60 dark:bg-surface-700 text-[10px] px-1.5 py-0.2">
              {allBatteries.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTableTab('workshop')}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              tableTab === 'workshop'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100 dark:text-neutral-400 dark:hover:bg-surface-800'
            }`}
          >
            <span>In Workshop</span>
            <span className="rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 text-[10px] px-1.5 py-0.2">
              {workshopCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTableTab('fleet')}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              tableTab === 'fleet'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100 dark:text-neutral-400 dark:hover:bg-surface-800'
            }`}
          >
            <span>Active in Fleet</span>
            <span className="rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] px-1.5 py-0.2">
              {fleetCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTableTab('packed')}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              tableTab === 'packed'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100 dark:text-neutral-400 dark:hover:bg-surface-800'
            }`}
          >
            <span>Packed to Repair</span>
            <span className="rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px] px-1.5 py-0.2">
              {packedCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTableTab('unserviceable')}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              tableTab === 'unserviceable'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100 dark:text-neutral-400 dark:hover:bg-surface-800'
            }`}
          >
            <span>Decommissioned</span>
            <span className="rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 text-[10px] px-1.5 py-0.2">
              {unserviceableCount}
            </span>
          </button>
        </div>

        {filteredBatteries.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400 dark:text-neutral-500">
            No batteries matching the selected filter.
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4.5 px-4.5 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[650px] text-left text-xs">
              <thead className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:border-white/5 dark:text-neutral-500">
                <tr>
                  <th className="pb-3 pr-4">Battery ID</th>
                  <th className="pb-3 pr-4">Physical Serial</th>
                  <th className="pb-3 pr-4">Current Status</th>
                  <th className="pb-3 pr-4">Logistics / Truck</th>
                  <th className="pb-3 pr-4">Date Logged</th>
                  <th className="pb-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                {filteredBatteries.slice(0, 8).map((item) => (
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
                        <span className="font-semibold text-slate-800 dark:text-neutral-100 font-mono">
                          {item.serial_number}
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-neutral-500 font-normal">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3.5 pr-4">
                      {hasBeenServiced(item) ? (
                        <ClientStatusBadge
                          status={item.status}
                          isVerified={item.return_status === 'verified' || Boolean(item.return_verified_at)}
                          returnStatus={item.return_status}
                        />
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-neutral-300">
                          Registered
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 pr-4 text-slate-600 dark:text-neutral-300">
                      {item.truck_number ? (
                        <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                          <FiTruck className="w-3 h-3 text-slate-400" />
                          <span>#{item.truck_number}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-neutral-500">—</span>
                      )}
                    </td>
                    <td className="py-3.5 pr-4 text-slate-500 dark:text-neutral-400">
                      {item.created_at
                        ? new Date(item.created_at).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td className="py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {item.status === 'returned' && (
                          <button
                            type="button"
                            onClick={() => {
                              setRatingTargetBatteryCode(item.battery_code);
                              setShowRatingModal(true);
                            }}
                            className="inline-flex items-center gap-1 rounded-xl bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-900/60 transition-colors cursor-pointer"
                            title="Rate Workshop Service Quality"
                          >
                            <FiStar className="w-3 h-3 text-amber-500 fill-amber-400" />
                            <span>Rate</span>
                          </button>
                        )}
                        <Link
                          to={`/batteries/${encodeURIComponent(item.battery_code)}`}
                          className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:bg-emerald-600 hover:text-white dark:bg-white/10 dark:text-neutral-200 dark:hover:bg-emerald-600"
                        >
                          Details →
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Two Column Lower Hub: Billing & Statements + Help Center ────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Recent Invoices & Billing Overview */}
        <div className="lg:col-span-7 flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-4.5 sm:p-6 shadow-sm dark:border-white/10 dark:bg-surface-900">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/5">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                  <FiFileText className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Invoices &amp; Statements</h3>
                  <p className="text-[11px] text-slate-400 dark:text-neutral-400">Recent billing notices and PDF receipts</p>
                </div>
              </div>

              <Link
                to="/my/invoices"
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
              >
                All Invoices ({invoices.length}) →
              </Link>
            </div>

            <div className="mt-4 space-y-2.5">
              {invoices.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center dark:border-white/10 dark:bg-surface-850">
                  <p className="text-xs font-semibold text-slate-700 dark:text-neutral-300">No invoices issued yet</p>
                  <p className="mt-1 text-[11px] text-slate-400 dark:text-neutral-500">Service statements will appear here upon completion.</p>
                </div>
              ) : (
                invoices.slice(0, 3).map((inv) => {
                  const dueStatus = getDueDaysStatus(inv.due_date);
                  const isImg = isImageFile(inv.file_name, inv.file_path);
                  const isLoadingThis = actionLoading === inv.id;

                  return (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-slate-200/70 hover:border-slate-300 dark:border-white/5 dark:hover:border-white/10 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                            inv.status === 'paid'
                              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'
                              : 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400'
                          }`}
                        >
                          <FiFileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                              {inv.invoice_number}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                inv.status === 'paid'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                                  : dueStatus.isOverdue
                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300'
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                              }`}
                            >
                              {inv.status === 'paid' ? 'Paid' : dueStatus.isOverdue ? 'Overdue' : 'Pending'}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400 dark:text-neutral-500 block">
                            Issued {inv.issue_date ? new Date(inv.issue_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {inv.file_path && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleViewInvoice(inv)}
                              disabled={isLoadingThis}
                              className="px-2.5 py-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-surface-800 dark:text-neutral-200 dark:hover:bg-surface-700 rounded-lg transition-colors cursor-pointer"
                            >
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadInvoice(inv)}
                              disabled={isLoadingThis}
                              className="p-1.5 text-xs text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/50 rounded-lg transition-colors cursor-pointer"
                              title="Download PDF"
                            >
                              <FiDownload className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-5 border-t border-slate-100 pt-4 dark:border-white/5 flex items-center justify-between text-xs font-bold">
            <Link
              to="/my/transactions"
              className="text-amber-800 hover:underline dark:text-amber-400"
            >
              View Detailed Billing History →
            </Link>
            <Link
              to="/my/invoices"
              className="text-emerald-700 hover:underline dark:text-emerald-400"
            >
              Download PDF Statements →
            </Link>
          </div>
        </div>

        {/* Right Column: Direct Help & Support Desk */}
        <div className="lg:col-span-5 flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-4.5 sm:p-6 shadow-sm dark:border-white/10 dark:bg-surface-900">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/5">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
                  <FiInbox className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Help &amp; Support Desk</h3>
                  <p className="text-[11px] text-slate-400 dark:text-neutral-400">Direct message line to Refurbnics operations</p>
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
                  <p className="text-xs font-semibold text-slate-700 dark:text-neutral-300">All caught up</p>
                  <p className="mt-1 text-[11px] text-slate-400 dark:text-neutral-500">No active support inquiries. Need assistance with a delivery or battery?</p>
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
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold capitalize text-slate-700 dark:bg-white/10 dark:text-neutral-300">
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
              <FiPlus className="h-4 w-4" />
              <span>Create New Support Ticket</span>
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
                  Truck Number <span className="text-[11px] font-normal text-slate-400 dark:text-neutral-400">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={truckForm.truckNumber}
                  onChange={(e) => setTruckForm((prev) => ({ ...prev, truckNumber: e.target.value }))}
                  placeholder="e.g. TR-8042 or GB21 XYZ (Optional)"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-hidden dark:border-white/10 dark:bg-surface-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-neutral-200 mb-1">
                  Driver Name <span className="text-[11px] font-normal text-slate-400 dark:text-neutral-400">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={truckForm.driverName}
                  onChange={(e) => setTruckForm((prev) => ({ ...prev, driverName: e.target.value }))}
                  placeholder="e.g. John Smith (Optional)"
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
                Specific Battery Codes <span className="text-[11px] font-normal text-slate-400 dark:text-neutral-400">(Optional)</span>
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
                className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-300 dark:hover:bg-surface-700 shadow-2xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingTruck}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 transition-all cursor-pointer"
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

      {/* ── Official ESG Milestone Certificate Inspection Modal ─────────── */}
      {selectedPreviewCert && (
        <Modal
          title={selectedPreviewCert.title || 'Official Milestone ESG Certificate'}
          size="xl"
          onClose={() => setSelectedPreviewCert(null)}
        >
          <div className="max-h-[82vh] overflow-y-auto pr-1">
            <CertificateView
              certificate={selectedPreviewCert}
              clientName={client?.name}
              showActions={true}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}

export default ClientDashboardPage;

