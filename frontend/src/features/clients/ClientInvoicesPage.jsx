import { useEffect, useState } from 'react';
import {
  FiEye,
  FiDownload,
  FiExternalLink,
  FiFileText,
  FiImage,
  FiCheckCircle,
  FiClock,
  FiAlertCircle,
} from 'react-icons/fi';
import apiClient from '../../services/api-client';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import TableState from '../../components/ui/TableState';
import Modal from '../../components/ui/Modal';

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

function ClientInvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Active preview
  const [previewData, setPreviewData] = useState(null); // { invoice, blobUrl, isImg }
  const [actionLoading, setActionLoading] = useState(null);

  function isOverdue(inv) {
    if (inv.status === 'paid' || !inv.due_date) return false;
    const due = new Date(inv.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today;
  }

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

  // Filtered
  const filtered = invoices.filter((inv) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      inv.invoice_number?.toLowerCase().includes(q) ||
      inv.file_name?.toLowerCase().includes(q) ||
      inv.notes?.toLowerCase().includes(q);

    const matchesDate = !dateFilter || inv.issue_date?.slice(0, 10) === dateFilter;

    const matchesStatus =
      !statusFilter ||
      (statusFilter === 'paid' && inv.status === 'paid') ||
      (statusFilter === 'unpaid' && inv.status !== 'paid') ||
      (statusFilter === 'overdue' && isOverdue(inv));

    return matchesSearch && matchesDate && matchesStatus;
  });

  const columns = [
    {
      key: 'invoice_number',
      label: 'Invoice / Bill Document',
      width: '32%',
      render: (row) => {
        const isImg = isImageFile(row.file_name, row.file_path);
        return (
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                isImg
                  ? 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/40'
                  : 'bg-red-50 text-red-600 border-red-100 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/40'
              }`}
            >
              {isImg ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 0 1 2.25-2.25h16.5A2.25 2.25 0 0 1 22.5 6v12a2.25 2.25 0 0 1-2.25 2.25H3.75A2.25 2.25 0 0 1 1.5 18V6ZM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0 0 21 18v-1.94l-2.69-2.689a1.5 1.5 0 0 0-2.12 0l-.88.879.97.97a.75.75 0 1 1-1.06 1.06l-5.16-5.159a1.5 1.5 0 0 0-2.12 0L3 16.061Zm10.125-7.81a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25A3.75 3.75 0 0 0 9 1.5H5.625Z" />
                  <path d="M12.971 1.816A5.23 5.23 0 0 1 16.5 5.25v1.875c0 .207.168.375.375.375H18.75a5.23 5.23 0 0 1 3.434 3.529.75.75 0 0 0 .566.246h.75a.75.75 0 0 0 0-1.5h-.75a.75.75 0 0 0-.277.053A3.75 3.75 0 0 0 18.75 7.5h-1.875A1.875 1.875 0 0 1 15 5.625V3.75a3.75 3.75 0 0 0-2.3-3.473.75.75 0 0 0-.246.566v.75a.75.75 0 0 0 1.5 0v-.75a.75.75 0 0 0-.053-.277Z" />
                </svg>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900 dark:text-white truncate" title={row.invoice_number}>
                {row.invoice_number}
              </p>
              {row.file_name && (
                <p className="text-xs text-slate-400 dark:text-neutral-400 truncate" title={row.file_name}>
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
      width: '18%',
      render: (row) => {
        const isPaid = row.status === 'paid';
        const overdue = isOverdue(row);

        if (isPaid) {
          return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50 shadow-2xs">
              <FiCheckCircle className="w-3.5 h-3.5 text-emerald-500" />
              <span>Paid</span>
            </span>
          );
        }

        if (overdue) {
          return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50 shadow-2xs">
              <FiAlertCircle className="w-3.5 h-3.5 text-rose-500" />
              <span>Overdue</span>
            </span>
          );
        }

        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50 shadow-2xs">
            <FiClock className="w-3.5 h-3.5 text-amber-500" />
            <span>Pending Payment</span>
          </span>
        );
      },
    },
    {
      key: 'dates',
      label: 'Dates (Received / Due)',
      width: '20%',
      render: (row) => {
        const overdue = isOverdue(row);
        return (
          <div className="text-xs space-y-0.5">
            <div className="text-slate-700 dark:text-neutral-300 font-medium flex items-center gap-1">
              <span className="text-slate-400 dark:text-neutral-500 text-[10px]">Received:</span>
              <span>{row.issue_date ? new Date(row.issue_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span>
            </div>
            {row.due_date && (
              <div className={`font-semibold flex items-center gap-1 ${overdue ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-neutral-400'}`}>
                <span className="text-[10px] uppercase font-bold">Due:</span>
                <span>{new Date(row.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                {overdue && <span className="text-[10px] px-1 py-0.2 rounded bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 font-bold">Overdue</span>}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'notes',
      label: 'Notes / Description',
      width: '20%',
      render: (row) => (
        <span className="text-xs text-slate-600 dark:text-neutral-300 block truncate" title={row.notes}>
          {row.notes || '—'}
        </span>
      ),
    },
    {
      key: 'file',
      label: 'Actions',
      width: '10%',
      render: (row) => {
        if (!row.file_path) {
          return <span className="text-xs text-slate-400">No file attached</span>;
        }
        const isImg = isImageFile(row.file_name, row.file_path);
        const isLoadingThis = actionLoading === row.id;
        return (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleView(row)}
              disabled={isLoadingThis}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-emerald-600 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-emerald-400 transition-colors cursor-pointer disabled:opacity-50"
              title="View Invoice Document"
            >
              <FiEye className="h-4.5 w-4.5" />
            </button>

            <button
              type="button"
              onClick={() => handleDownload(row)}
              disabled={isLoadingThis}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors cursor-pointer disabled:opacity-50 ${
                isImg
                  ? 'text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40'
                  : 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40'
              }`}
              title="Download Invoice File"
            >
              <FiDownload className="h-4.5 w-4.5" />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices & Bills"
        description="Official billing statements, payment due dates, and downloadable invoices (PDF / Images) issued for your battery fleet."
      />

      {/* Filter Bar */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs dark:border-white/10 dark:bg-surface-900">
        <div className="min-w-[13rem] flex-1 sm:flex-none">
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300">
            Search Invoice / PDF
          </label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, file name or notes…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-surface-800 dark:text-white sm:w-56"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300">
            Payment Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:outline-hidden dark:border-white/10 dark:bg-surface-800 dark:text-white"
          >
            <option value="">All Invoices</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Pending Payment</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300">
              Date Received
            </label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-surface-800 dark:text-white"
            />
          </div>
          {dateFilter && (
            <button
              type="button"
              onClick={() => setDateFilter('')}
              className="self-end pb-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-neutral-400"
            >
              Clear
            </button>
          )}
        </div>

        {(search || statusFilter || dateFilter) && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setStatusFilter('');
              setDateFilter('');
            }}
            className="self-end pb-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-neutral-400"
          >
            Clear all
          </button>
        )}
      </div>

      {loading && <TableState>Loading invoices…</TableState>}
      {error && <TableState tone="error">{error}</TableState>}

      {!loading && !error && (
        <DataTable
          tableLayout="fixed"
          headerColor="blue"
          columns={columns}
          rows={filtered}
          showRowNumber
          emptyMessage="No invoice PDF files have been sent yet."
        />
      )}

      {/* ── Document Preview Modal ────────────────────────────────────── */}
      {previewData && (
        <Modal
          title={previewData.invoice.invoice_number || 'Invoice Document'}
          description={previewData.invoice.file_name || 'Document Viewer'}
          onClose={handleClosePreview}
          size="5xl"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/10">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-neutral-400">
                {previewData.isImg ? <FiImage className="w-4 h-4 text-blue-500" /> : <FiFileText className="w-4 h-4 text-red-500" />}
                <span>{previewData.invoice.file_name || 'Invoice Document'}</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewData.blobUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:text-neutral-200 dark:hover:bg-white/20 rounded-lg transition-all"
                >
                  <FiExternalLink className="w-3.5 h-3.5" />
                  <span>Open in New Tab</span>
                </a>
                <button
                  type="button"
                  onClick={() => handleDownload(previewData.invoice)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-all shadow-2xs"
                >
                  <FiDownload className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              </div>
            </div>

            <div className="min-h-[60vh] max-h-[75vh] flex items-center justify-center bg-slate-100 dark:bg-black/30 rounded-xl overflow-hidden p-2">
              {previewData.isImg ? (
                <img
                  src={previewData.blobUrl}
                  alt={previewData.invoice.invoice_number}
                  className="max-h-[70vh] max-w-full object-contain rounded-lg shadow-md"
                />
              ) : (
                <iframe
                  src={previewData.blobUrl}
                  title="Invoice PDF Preview"
                  className="w-full h-[70vh] rounded-lg border-0 bg-white"
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
