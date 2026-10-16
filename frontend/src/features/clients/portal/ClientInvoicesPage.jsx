import { useEffect, useState, useMemo } from 'react';
import {
  FiEye,
  FiDownload,
  FiExternalLink,
  FiFileText,
  FiImage,
  FiCheckCircle,
  FiClock,
  FiAlertCircle,
  FiSearch,
  FiX,
  FiGrid,
  FiList,
  FiRefreshCw,
  FiCalendar,
} from 'react-icons/fi';
import apiClient from '../../../services/api-client';
import DataTable from '../../../components/ui/table/DataTable';
import TableState from '../../../components/ui/table/TableState';
import Modal from '../../../components/ui/overlays/Modal';
import { useTheme } from '../../../context/ThemeContext';

// YYYY-MM-DD in the viewer's own timezone, to match the date input's value
function localDateKey(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isImageFile(fileName = '', filePath = '') {
  return /\.(png|jpe?g|webp|gif|svg)$/i.test(fileName || filePath || '');
}

async function parseErrorMessage(err) {
  if (err.response?.data instanceof Blob) {
    try {
      const text = await err.response.data.text();
      const json = JSON.parse(text);
      return json.message || err.message;
    } catch (_) {}
  }
  return err.response?.data?.message || err.message || 'Failed to access invoice file.';
}

function isOverdue(inv) {
  if (inv.status === 'paid' || !inv.due_date) return false;
  const due = new Date(inv.due_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

function ClientInvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { customTheme } = useTheme();
  const accent = customTheme?.accentColor || '#10b981';

  // Filters
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState(''); // '' | 'paid' | 'unpaid' | 'overdue'

  // Default to compact cards on mobile (< 768px) to eliminate horizontal table scrolling
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768 ? 'cards' : 'table';
    }
    return 'cards';
  });

  // Active preview
  const [previewData, setPreviewData] = useState(null); // { invoice, blobUrl, isImg }
  const [actionLoading, setActionLoading] = useState(null);

  const fetchInvoices = () => {
    setLoading(true);
    setError(null);
    apiClient
      .get('/clients/me/invoices')
      .then((res) => {
        setInvoices(res.data?.data || []);
      })
      .catch((err) => {
        setError(err.response?.data?.message || err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  async function handleView(invoice) {
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
      setPreviewData({ invoice, blobUrl, isImg });
    } catch (err) {
      const msg = await parseErrorMessage(err);
      alert(msg);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDownload(invoice) {
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
      const msg = await parseErrorMessage(err);
      alert(msg);
    } finally {
      setActionLoading(null);
    }
  }

  function handleClosePreview() {
    if (previewData?.blobUrl) {
      URL.revokeObjectURL(previewData.blobUrl);
    }
    setPreviewData(null);
  }

  // Summary statistics
  const stats = useMemo(() => {
    let paid = 0;
    let pending = 0;
    let overdue = 0;

    invoices.forEach((inv) => {
      if (inv.status === 'paid') {
        paid += 1;
      } else if (isOverdue(inv)) {
        overdue += 1;
      } else {
        pending += 1;
      }
    });

    return {
      total: invoices.length,
      paid,
      pending,
      overdue,
    };
  }, [invoices]);

  // Filtered list
  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        inv.invoice_number?.toLowerCase().includes(q) ||
        inv.file_name?.toLowerCase().includes(q) ||
        inv.notes?.toLowerCase().includes(q);

      const matchesDate = !dateFilter || localDateKey(inv.issue_date) === dateFilter;

      const matchesStatus =
        !statusFilter ||
        (statusFilter === 'paid' && inv.status === 'paid') ||
        (statusFilter === 'unpaid' && inv.status !== 'paid' && !isOverdue(inv)) ||
        (statusFilter === 'overdue' && isOverdue(inv));

      return matchesSearch && matchesDate && matchesStatus;
    });
  }, [invoices, search, dateFilter, statusFilter]);

  const anyFilter = Boolean(search || statusFilter || dateFilter);

  const columns = [
    {
      key: 'invoice_number',
      label: 'Invoice / Bill Document',
      render: (row) => {
        const isImg = isImageFile(row.file_name, row.file_path);
        return (
          <div className="flex items-center gap-2.5 min-w-0 py-0.5">
            <div
              className={`flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg sm:rounded-xl border ${
                isImg
                  ? 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/40'
                  : 'bg-red-50 text-red-600 border-red-100 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/40'
              }`}
            >
              {isImg ? <FiImage className="h-4 w-4" /> : <FiFileText className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm truncate" title={row.invoice_number}>
                {row.invoice_number}
              </p>
              {row.file_name && (
                <p className="text-[10px] sm:text-xs text-slate-400 dark:text-neutral-400 truncate" title={row.file_name}>
                  {row.file_name}
                </p>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: 'payment_status',
      label: 'Payment Status',
      render: (row) => {
        const isPaid = row.status === 'paid';
        const overdue = isOverdue(row);

        if (isPaid) {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50 shadow-2xs">
              <FiCheckCircle className="w-3 h-3 text-emerald-500" />
              <span>Paid</span>
            </span>
          );
        }

        if (overdue) {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50 shadow-2xs">
              <FiAlertCircle className="w-3 h-3 text-rose-500" />
              <span>Overdue</span>
            </span>
          );
        }

        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50 shadow-2xs">
            <FiClock className="w-3 h-3 text-amber-500" />
            <span>Pending</span>
          </span>
        );
      },
    },
    {
      key: 'dates',
      label: 'Dates (Received / Due)',
      render: (row) => {
        const overdue = isOverdue(row);
        return (
          <div className="text-[11px] sm:text-xs space-y-0.5">
            <div className="text-slate-600 dark:text-neutral-300 font-medium flex items-center gap-1">
              <span className="text-slate-400 dark:text-neutral-500 text-[10px]">Received:</span>
              <span>{formatDate(row.issue_date)}</span>
            </div>
            {row.due_date && (
              <div className={`font-semibold flex items-center gap-1 ${overdue ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-neutral-400'}`}>
                <span className="text-[10px] uppercase font-bold">Due:</span>
                <span>{formatDate(row.due_date)}</span>
                {overdue && (
                  <span className="text-[9px] px-1 rounded bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 font-bold">
                    Overdue
                  </span>
                )}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'notes',
      label: 'Notes / Description',
      render: (row) => (
        <span className="text-[11px] sm:text-xs text-slate-500 dark:text-neutral-400 block truncate max-w-xs" title={row.notes}>
          {row.notes || '—'}
        </span>
      ),
    },
    {
      key: 'file',
      label: 'Actions',
      render: (row) => {
        if (!row.file_path) {
          return <span className="text-[10px] text-slate-400">No file</span>;
        }
        const isImg = isImageFile(row.file_name, row.file_path);
        const isLoadingThis = actionLoading === row.id;
        return (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleView(row)}
              disabled={isLoadingThis}
              className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-emerald-600 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-emerald-400 transition-colors cursor-pointer disabled:opacity-50"
              title="View Invoice Document"
            >
              <FiEye className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => handleDownload(row)}
              disabled={isLoadingThis}
              className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg transition-colors cursor-pointer disabled:opacity-50 ${
                isImg
                  ? 'text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40'
                  : 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40'
              }`}
              title="Download Invoice File"
            >
              <FiDownload className="h-4 w-4" />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-3 min-w-0 pb-10">
      {/* 1. Page Header - Compact & refined */}
      <div className="border-b border-slate-200/80 pb-2.5 dark:border-white/10">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <h1 className="text-base sm:text-xl font-black tracking-tight text-slate-900 dark:text-white">
              Invoices & Bills
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-surface-800 dark:text-neutral-300 border border-slate-200 dark:border-white/10">
              {filtered.length} {filtered.length === 1 ? 'Invoice' : 'Invoices'}
            </span>
          </div>

          <button
            type="button"
            onClick={fetchInvoices}
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 dark:hover:bg-surface-700 cursor-pointer shrink-0 transition-colors"
            title="Refresh invoices"
          >
            <FiRefreshCw className={`h-3 w-3 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
        <p className="text-[10.5px] sm:text-xs text-slate-500 dark:text-neutral-400 mt-0.5 leading-tight">
          Official billing statements, payment due dates, and downloadable invoice documents for your fleet.
        </p>
      </div>

      {loading ? (
        <TableState>Loading invoices…</TableState>
      ) : error ? (
        <TableState tone="error">{error}</TableState>
      ) : (
        <>
          {/* 2. Top Metric Cards - Compact 2x2 Grid with Interactive Status Filtering */}
          <div className="grid grid-cols-2 gap-2 sm:gap-2.5 lg:grid-cols-4">
            {/* Total Invoices */}
            <div
              onClick={() => setStatusFilter('')}
              className={`rounded-xl border p-2.5 sm:p-3 flex flex-col justify-between transition-all cursor-pointer ${
                !statusFilter
                  ? 'border-blue-300 bg-blue-50/40 dark:border-blue-800/60 dark:bg-blue-950/20 shadow-2xs'
                  : 'border-slate-200/90 bg-white hover:border-slate-300 dark:border-surface-700 dark:bg-surface-900'
              }`}
            >
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
                  Total Invoices
                </span>
                <div className="flex h-5.5 w-5.5 sm:h-6 sm:w-6 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300">
                  <FiFileText className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                </div>
              </div>
              <div className="mt-1.5">
                <p className="text-sm sm:text-lg font-black text-slate-900 dark:text-white leading-none">
                  {stats.total}
                </p>
                <p className="text-[9px] text-slate-400 dark:text-neutral-400 mt-0.5 font-medium">
                  All Statements
                </p>
              </div>
            </div>

            {/* Paid */}
            <div
              onClick={() => setStatusFilter(statusFilter === 'paid' ? '' : 'paid')}
              className={`rounded-xl border p-2.5 sm:p-3 flex flex-col justify-between transition-all cursor-pointer ${
                statusFilter === 'paid'
                  ? 'border-emerald-300 bg-emerald-50/40 dark:border-emerald-800/60 dark:bg-emerald-950/20 shadow-2xs'
                  : 'border-slate-200/90 bg-white hover:border-slate-300 dark:border-surface-700 dark:bg-surface-900'
              }`}
            >
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  Paid
                </span>
                <div className="flex h-5.5 w-5.5 sm:h-6 sm:w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <FiCheckCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                </div>
              </div>
              <div className="mt-1.5">
                <p className="text-sm sm:text-lg font-black text-emerald-600 dark:text-emerald-400 leading-none">
                  {stats.paid}
                </p>
                <p className="text-[9px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5 font-medium">
                  Settled & Cleared
                </p>
              </div>
            </div>

            {/* Pending */}
            <div
              onClick={() => setStatusFilter(statusFilter === 'unpaid' ? '' : 'unpaid')}
              className={`rounded-xl border p-2.5 sm:p-3 flex flex-col justify-between transition-all cursor-pointer ${
                statusFilter === 'unpaid'
                  ? 'border-amber-300 bg-amber-50/40 dark:border-amber-800/60 dark:bg-amber-950/20 shadow-2xs'
                  : 'border-slate-200/90 bg-white hover:border-slate-300 dark:border-surface-700 dark:bg-surface-900'
              }`}
            >
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                  Pending
                </span>
                <div className="flex h-5.5 w-5.5 sm:h-6 sm:w-6 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300">
                  <FiClock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                </div>
              </div>
              <div className="mt-1.5">
                <p className="text-sm sm:text-lg font-black text-amber-600 dark:text-amber-400 leading-none">
                  {stats.pending}
                </p>
                <p className="text-[9px] text-amber-600/80 dark:text-amber-400/80 mt-0.5 font-medium">
                  Awaiting Payment
                </p>
              </div>
            </div>

            {/* Overdue */}
            <div
              onClick={() => setStatusFilter(statusFilter === 'overdue' ? '' : 'overdue')}
              className={`rounded-xl border p-2.5 sm:p-3 flex flex-col justify-between transition-all cursor-pointer ${
                statusFilter === 'overdue'
                  ? 'border-rose-300 bg-rose-50/40 dark:border-rose-800/60 dark:bg-rose-950/20 shadow-2xs'
                  : 'border-slate-200/90 bg-white hover:border-slate-300 dark:border-surface-700 dark:bg-surface-900'
              }`}
            >
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">
                  Overdue
                </span>
                <div className="flex h-5.5 w-5.5 sm:h-6 sm:w-6 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300">
                  <FiAlertCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                </div>
              </div>
              <div className="mt-1.5">
                <p className="text-sm sm:text-lg font-black text-rose-600 dark:text-rose-400 leading-none">
                  {stats.overdue}
                </p>
                <p className="text-[9px] text-rose-600/80 dark:text-rose-400/80 mt-0.5 font-medium">
                  Action Required
                </p>
              </div>
            </div>
          </div>

          {/* Overdue Notice Banner */}
          {stats.overdue > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-300/80 bg-rose-50/80 p-2.5 sm:p-3 text-xs text-rose-950 shadow-2xs dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
              <FiAlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              <div className="min-w-0 flex-1 leading-relaxed text-[11px] sm:text-xs">
                <strong className="font-bold">
                  {stats.overdue} invoice{stats.overdue === 1 ? '' : 's'} past due date.
                </strong>{' '}
                Please review and clear outstanding invoices to ensure uninterrupted battery repairs and logistics.
              </div>
            </div>
          )}

          {/* 3. Search and Filters Toolbar */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {/* Search Input - Clean & No Icon Overlap */}
            <div className="relative flex-1 sm:max-w-xs">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-neutral-500 pointer-events-none" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search invoice number or file…"
                className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-7 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden dark:border-surface-700 dark:bg-surface-800 dark:text-neutral-100 shadow-2xs"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-neutral-300"
                >
                  <FiX className="h-3 w-3" />
                </button>
              ) : null}
            </div>

            {/* Filters & View Switcher */}
            <div className="flex items-center justify-between sm:justify-end gap-1.5 flex-wrap">
              {/* Status Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                {[
                  { id: '', label: 'All', count: stats.total },
                  { id: 'paid', label: 'Paid', count: stats.paid },
                  { id: 'unpaid', label: 'Pending', count: stats.pending },
                  { id: 'overdue', label: 'Overdue', count: stats.overdue },
                ].map((tab) => {
                  const active = statusFilter === tab.id;
                  return (
                    <button
                      key={tab.id || 'all'}
                      type="button"
                      onClick={() => setStatusFilter(tab.id)}
                      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                        active
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs'
                          : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-surface-700 dark:bg-surface-800 dark:text-neutral-300'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.2 text-[9px] ${
                          active
                            ? 'bg-white/20 text-white dark:bg-slate-200 dark:text-slate-900'
                            : 'bg-slate-100 text-slate-500 dark:bg-surface-700 dark:text-neutral-400'
                        }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Date Filter & Clear */}
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 focus:border-blue-500 focus:outline-hidden dark:border-surface-700 dark:bg-surface-800 dark:text-neutral-200 shadow-2xs"
                  title="Filter by received date"
                />

                {anyFilter && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setStatusFilter('');
                      setDateFilter('');
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:border-surface-700 dark:bg-surface-800 dark:text-neutral-400 cursor-pointer shadow-2xs"
                    title="Clear all filters"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-surface-700 dark:bg-surface-800">
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`rounded-md p-1 transition-colors cursor-pointer ${
                    viewMode === 'cards'
                      ? 'bg-white text-slate-900 shadow-2xs dark:bg-surface-700 dark:text-white'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200'
                  }`}
                  title="Card view"
                >
                  <FiGrid className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`rounded-md p-1 transition-colors cursor-pointer ${
                    viewMode === 'table'
                      ? 'bg-white text-slate-900 shadow-2xs dark:bg-surface-700 dark:text-white'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200'
                  }`}
                  title="Table view"
                >
                  <FiList className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* 4. Invoices Content Area */}
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-slate-200/90 bg-white p-6 sm:p-8 text-center dark:border-surface-700/80 dark:bg-surface-900 shadow-2xs">
              <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-surface-800 dark:text-neutral-400 mb-2">
                <FiFileText className="h-5 w-5" />
              </div>
              <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-neutral-200">
                {anyFilter ? 'No invoices match your filter criteria' : 'No invoices or billing statements issued yet'}
              </p>
              <p className="mt-1 text-[11px] text-slate-400 max-w-sm mx-auto">
                {anyFilter
                  ? 'Try clearing the search or status filter above to view all statements.'
                  : 'Official invoice PDFs and billing receipts from the workshop will appear here.'}
              </p>
              {anyFilter && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setStatusFilter('');
                    setDateFilter('');
                  }}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 cursor-pointer"
                >
                  Reset Filters
                </button>
              )}
            </div>
          ) : viewMode === 'cards' ? (
            /* Compact Responsive Cards Grid */
            <div className="grid grid-cols-1 gap-2 sm:gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((inv, idx) => {
                const isImg = isImageFile(inv.file_name, inv.file_path);
                const isPaid = inv.status === 'paid';
                const overdue = isOverdue(inv);
                const isBusy = actionLoading === inv.id;

                return (
                  <div
                    key={inv.id || idx}
                    className="flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-2.5 sm:p-3 shadow-2xs transition-all hover:border-slate-300 dark:border-surface-700/80 dark:bg-surface-900"
                  >
                    <div>
                      {/* Card Header: Icon + Number + Status */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          <div
                            className={`flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg border ${
                              isImg
                                ? 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/40'
                                : 'bg-red-50 text-red-600 border-red-100 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/40'
                            }`}
                          >
                            {isImg ? <FiImage className="h-3.5 w-3.5" /> : <FiFileText className="h-3.5 w-3.5" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-neutral-100 truncate">
                              {inv.invoice_number}
                            </h3>
                            {inv.file_name && (
                              <p className="font-mono text-[9.5px] text-slate-400 dark:text-neutral-400 truncate mt-0.5">
                                {inv.file_name}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Status Badge */}
                        {isPaid ? (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50">
                            <FiCheckCircle className="w-2.5 h-2.5 text-emerald-500" />
                            <span>Paid</span>
                          </span>
                        ) : overdue ? (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-bold bg-rose-50 text-rose-700 border border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50">
                            <FiAlertCircle className="w-2.5 h-2.5 text-rose-500" />
                            <span>Overdue</span>
                          </span>
                        ) : (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50">
                            <FiClock className="w-2.5 h-2.5 text-amber-500" />
                            <span>Pending</span>
                          </span>
                        )}
                      </div>

                      {/* Dates Strip */}
                      <div className="mt-2 grid grid-cols-2 gap-1.5 rounded-lg bg-slate-50 p-2 dark:bg-surface-800/80">
                        <div>
                          <p className="text-[9px] font-semibold text-slate-400 dark:text-neutral-400">Received Date</p>
                          <p className="text-[11px] sm:text-xs font-bold text-slate-700 dark:text-neutral-200 leading-tight">
                            {formatDate(inv.issue_date)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] font-semibold text-slate-400 dark:text-neutral-400">Payment Due</p>
                          <p
                            className={`text-[11px] sm:text-xs font-bold leading-tight ${
                              overdue ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-neutral-200'
                            }`}
                          >
                            {formatDate(inv.due_date)}
                          </p>
                        </div>
                      </div>

                      {/* Notes snippet */}
                      {inv.notes ? (
                        <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500 dark:text-neutral-400 line-clamp-2">
                          {inv.notes}
                        </p>
                      ) : null}
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-surface-800">
                      {inv.file_path ? (
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleView(inv)}
                            disabled={isBusy}
                            className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white py-1.5 text-[11px] font-bold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-surface-700 dark:bg-surface-800 dark:text-neutral-200 transition-all cursor-pointer disabled:opacity-50"
                          >
                            <FiEye className="h-3 w-3 text-slate-500" />
                            <span>View</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownload(inv)}
                            disabled={isBusy}
                            style={{ backgroundColor: accent }}
                            className="inline-flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-bold text-white shadow-2xs hover:opacity-90 transition-all cursor-pointer disabled:opacity-50"
                          >
                            <FiDownload className="h-3 w-3" />
                            <span>Download</span>
                          </button>
                        </div>
                      ) : (
                        <p className="text-center text-[9.5px] text-slate-400 py-1">No document attached</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Table View */
            <div className="overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-2xs dark:border-surface-700/80 dark:bg-surface-900">
              <DataTable
                tableLayout="fixed"
                headerColor="blue"
                columns={columns}
                rows={filtered}
                showRowNumber
                maxHeight="calc(100vh - 270px)"
                emptyMessage="No invoice PDF files have been sent yet."
              />
            </div>
          )}
        </>
      )}

      {/* Document Preview Modal */}
      {previewData && (
        <Modal
          title={previewData.invoice.invoice_number || 'Invoice Document'}
          description={previewData.invoice.file_name || 'Document Viewer'}
          onClose={handleClosePreview}
          size="5xl"
          centered
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5 dark:border-white/10">
              <div className="flex min-w-0 items-center gap-2 text-xs text-slate-500 dark:text-neutral-400">
                {previewData.isImg ? (
                  <FiImage className="w-4 h-4 shrink-0 text-blue-500" />
                ) : (
                  <FiFileText className="w-4 h-4 shrink-0 text-red-500" />
                )}
                <span className="truncate">{previewData.invoice.file_name || 'Invoice Document'}</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewData.blobUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:text-neutral-200 dark:hover:bg-white/20 rounded-lg transition-all"
                >
                  <FiExternalLink className="w-3.5 h-3.5" />
                  <span>Open in Tab</span>
                </a>
                <button
                  type="button"
                  onClick={() => handleDownload(previewData.invoice)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-all shadow-2xs cursor-pointer"
                >
                  <FiDownload className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              </div>
            </div>

            <div className="min-h-[45vh] max-h-[70vh] flex items-center justify-center bg-slate-100 dark:bg-black/30 rounded-xl overflow-hidden p-2">
              {previewData.isImg ? (
                <img
                  src={previewData.blobUrl}
                  alt={previewData.invoice.invoice_number}
                  className="max-h-[65vh] max-w-full object-contain rounded-lg shadow-md"
                />
              ) : (
                <iframe
                  src={previewData.blobUrl}
                  title="Invoice PDF Preview"
                  className="w-full h-[65vh] rounded-lg border-0 bg-white"
                />
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default ClientInvoicesPage;
