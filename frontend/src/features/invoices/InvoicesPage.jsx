import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  FiEye,
  FiDownload,
  FiTrash2,
  FiCheckCircle,
  FiClock,
  FiAlertCircle,
  FiCalendar,
  FiCheck,
  FiUploadCloud,
  FiFileText,
  FiImage,
  FiUser,
  FiSend,
  FiX,
  FiMail,
} from 'react-icons/fi';
import apiClient from '../../services/api-client';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import TableState from '../../components/ui/TableState';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { useTheme } from '../../context/ThemeContext';

function InvoicesPage() {
  const user = useSelector((state) => state.auth.user);
  const isSuperAdmin = user?.role === 'super_admin';
  const { customTheme } = useTheme();
  const accent = customTheme?.accentColor || '#10b981';

  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [updatingPaidId, setUpdatingPaidId] = useState(null);

  // Form State
  const [clientId, setClientId] = useState('');
  const [title, setTitle] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [isPaid, setIsPaid] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);

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

  function setQuickDueDate(days) {
    const base = issueDate ? new Date(issueDate) : new Date();
    base.setDate(base.getDate() + days);
    setDueDate(base.toISOString().slice(0, 10));
  }

  function fetchData() {
    setLoading(true);
    setError(null);
    Promise.all([
      apiClient.get('/invoices'),
      apiClient.get('/clients'),
    ])
      .then(([invRes, clientRes]) => {
        setInvoices(invRes.data || []);
        setClients(clientRes.data || []);
      })
      .catch((err) => {
        setError(err.response?.data?.message || err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (clientId) {
      const found = clients.find((c) => String(c.id) === String(clientId));
      if (found) {
        setRecipientEmail(found.invoice_email || found.login_email || found.email || '');
      }
    }
  }, [clientId, clients]);

  function handleClientSelectChange(val) {
    setClientId(val);
    const found = clients.find((c) => String(c.id) === String(val));
    if (found) {
      setRecipientEmail(found.invoice_email || found.login_email || found.email || '');
    } else {
      setRecipientEmail('');
    }
  }

  function openUploadModal() {
    const today = new Date().toISOString().slice(0, 10);
    const defaultDue = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    setClientId('');
    setTitle('');
    setIssueDate(today);
    setDueDate(defaultDue);
    setIsPaid(false);
    setSendEmail(true);
    setRecipientEmail('');
    setNotes('');
    setInvoiceFile(null);
    setFilePreview(null);
    setFormError(null);
    setFormOpen(true);
  }

  function handleFileChange(e) {
    const file = e.target.files[0] || null;
    setInvoiceFile(file);
    if (file) {
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
      if (isImageFile(file.name)) {
        setFilePreview(URL.createObjectURL(file));
      } else {
        setFilePreview(null);
      }
      setFormError(null);
    } else {
      setFilePreview(null);
    }
  }

  function handleRemoveFile() {
    setInvoiceFile(null);
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
      setFilePreview(null);
    }
  }

  async function handleFormSubmit(e) {
    e.preventDefault();
    if (!clientId) {
      setFormError('Please select a client to issue the invoice.');
      return;
    }
    if (!invoiceFile) {
      setFormError('Please upload an invoice document (PDF or Image file).');
      return;
    }
    setSaving(true);
    setFormError(null);

    try {
      const formData = new FormData();
      formData.append('clientId', clientId);
      formData.append('title', title.trim() || invoiceFile.name.replace(/\.[^/.]+$/, ''));
      formData.append('issueDate', issueDate);
      if (dueDate) formData.append('dueDate', dueDate);
      formData.append('status', isPaid ? 'paid' : 'sent');
      formData.append('sendEmail', sendEmail ? 'true' : 'false');
      if (recipientEmail) formData.append('recipientEmail', recipientEmail.trim());
      if (notes) formData.append('notes', notes);
      formData.append('pdfFile', invoiceFile);

      await apiClient.post('/invoices', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setFormOpen(false);
      fetchData();
    } catch (err) {
      setFormError(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleTogglePaid(invoice) {
    const isCurrentlyPaid = invoice.status === 'paid';
    const newStatus = isCurrentlyPaid ? 'sent' : 'paid';
    setUpdatingPaidId(invoice.id);

    // Optimistic UI update
    setInvoices((prev) =>
      prev.map((inv) => (inv.id === invoice.id ? { ...inv, status: newStatus } : inv))
    );

    try {
      await apiClient.patch(`/invoices/${invoice.id}`, { status: newStatus });
    } catch (err) {
      // Revert if error
      setInvoices((prev) =>
        prev.map((inv) => (inv.id === invoice.id ? { ...inv, status: invoice.status } : inv))
      );
      alert(err.response?.data?.message || err.message || 'Failed to update payment status.');
    } finally {
      setUpdatingPaidId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    try {
      await apiClient.delete(`/invoices/${deleteTarget.id}`);
      setDeleteTarget(null);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
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

  async function handleView(invoice) {
    if (!invoice.file_path) return;
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
      const msg = await parseErrorMessage(err);
      alert(msg);
    }
  }

  async function handleDownload(invoice) {
    if (!invoice.file_path) return;
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
    }
  }

  // Filtered List
  const filtered = invoices.filter((inv) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      inv.invoice_number?.toLowerCase().includes(q) ||
      inv.file_name?.toLowerCase().includes(q) ||
      inv.client_name?.toLowerCase().includes(q) ||
      inv.notes?.toLowerCase().includes(q);

    const matchesClient = !clientFilter || String(inv.client_id) === String(clientFilter);
    const matchesDate = !dateFilter || inv.issue_date?.slice(0, 10) === dateFilter;

    const matchesStatus =
      !statusFilter ||
      (statusFilter === 'paid' && inv.status === 'paid') ||
      (statusFilter === 'unpaid' && inv.status !== 'paid') ||
      (statusFilter === 'overdue' && isOverdue(inv));

    return matchesSearch && matchesClient && matchesDate && matchesStatus;
  });

  const columns = [
    {
      key: 'invoice_number',
      label: 'Invoice Title / Reference',
      width: '28%',
      render: (row) => {
        const isImg = isImageFile(row.file_name, row.file_path);
        return (
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                isImg
                  ? 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/40'
                  : 'bg-red-50 text-red-600 border-red-100 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/40'
              }`}
            >
              {isImg ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 0 1 2.25-2.25h16.5A2.25 2.25 0 0 1 22.5 6v12a2.25 2.25 0 0 1-2.25 2.25H3.75A2.25 2.25 0 0 1 1.5 18V6ZM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0 0 21 18v-1.94l-2.69-2.689a1.5 1.5 0 0 0-2.12 0l-.88.879.97.97a.75.75 0 1 1-1.06 1.06l-5.16-5.159a1.5 1.5 0 0 0-2.12 0L3 16.061Zm10.125-7.81a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
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
                <p className="text-[11px] text-slate-400 dark:text-neutral-400 truncate" title={row.file_name}>
                  {row.file_name}
                </p>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: 'client_name',
      label: 'Client',
      width: '18%',
      render: (row) => (
        <span className="font-semibold text-slate-800 dark:text-neutral-100 truncate block" title={row.client_name}>
          {row.client_name}
        </span>
      ),
    },
    {
      key: 'payment_status',
      label: 'Payment Status',
      width: '18%',
      render: (row) => {
        const isPaidStatus = row.status === 'paid';
        const overdue = isOverdue(row);
        const isUpdating = updatingPaidId === row.id;

        return (
          <div className="flex items-center gap-2.5">
            {/* Interactive Checkbox */}
            <label
              className={`inline-flex items-center gap-1.5 cursor-pointer select-none px-2.5 py-1 rounded-xl border transition-all ${
                isPaidStatus
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-300 shadow-2xs'
                  : overdue
                    ? 'bg-rose-50 border-rose-300 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800/60 dark:text-rose-300'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 dark:bg-white/5 dark:border-white/10 dark:text-neutral-300 dark:hover:bg-white/10'
              } ${isUpdating ? 'opacity-50 pointer-events-none' : ''}`}
              title={isPaidStatus ? 'Click to mark as Unpaid' : 'Click to mark as Paid'}
            >
              <input
                type="checkbox"
                checked={isPaidStatus}
                onChange={() => handleTogglePaid(row)}
                className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
              />
              <span className="text-xs font-bold">
                {isPaidStatus ? 'Paid' : overdue ? 'Overdue' : 'Unpaid'}
              </span>
            </label>
          </div>
        );
      },
    },
    {
      key: 'dates',
      label: 'Dates (Issued / Due)',
      width: '18%',
      render: (row) => {
        const overdue = isOverdue(row);
        return (
          <div className="text-xs space-y-0.5">
            <div className="text-slate-700 dark:text-neutral-300 font-medium flex items-center gap-1">
              <span className="text-slate-400 dark:text-neutral-500 text-[10px]">Issued:</span>
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
      label: 'Notes',
      width: '10%',
      render: (row) => (
        <span className="text-xs text-slate-600 dark:text-neutral-300 block truncate" title={row.notes}>
          {row.notes || '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '8%',
      render: (row) => {
        const isImg = isImageFile(row.file_name, row.file_path);
        return (
          <div className="flex items-center gap-1">
            {row.file_path && (
              <>
                <button
                  type="button"
                  onClick={() => handleView(row)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-emerald-600 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                  title="View Invoice"
                >
                  <FiEye className="h-4.5 w-4.5" />
                </button>

                <button
                  type="button"
                  onClick={() => handleDownload(row)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors cursor-pointer ${
                    isImg
                      ? 'text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40'
                      : 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40'
                  }`}
                  title="Download Invoice"
                >
                  <FiDownload className="h-4.5 w-4.5" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setDeleteTarget(row)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition-colors cursor-pointer"
              title="Delete Invoice"
            >
              <FiTrash2 className="h-4.5 w-4.5" />
            </button>
          </div>
        );
      },
    },
  ];

  const selectedClientObj = clients.find((c) => String(c.id) === String(clientId));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="Upload and send invoices (PDF / Images) directly to client dashboards, track due dates and mark payments."
        titleClassName="text-2xl font-bold tracking-tight text-green-600 dark:text-green-400"
      >
        <Button variant="darkViolet" onClick={openUploadModal}>
          + Upload & Send Invoice
        </Button>
      </PageHeader>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs dark:border-white/10 dark:bg-surface-900">
        <div className="min-w-[13rem] flex-1 sm:flex-none">
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300">
            Search Invoice
          </label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, client or notes…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-surface-800 dark:text-white sm:w-56"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300">
            Client
          </label>
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:outline-hidden dark:border-white/10 dark:bg-surface-800 dark:text-white"
          >
            <option value="">All Clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
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
            <option value="">All Statuses</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid / Pending</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300">
              Upload Date
            </label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:outline-hidden dark:border-white/10 dark:bg-surface-800 dark:text-white"
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

        {(search || clientFilter || statusFilter || dateFilter) && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setClientFilter('');
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
          emptyMessage="No invoices found."
        />
      )}

      {/* ── PROFESSIONAL LARGE UPLOAD & SEND INVOICE MODAL ─────────────────── */}
      {formOpen && (
        <Modal
          title="Upload & Send Invoice Document"
          description="Issue and dispatch an official invoice or billing statement directly to the client's dashboard."
          size="4xl"
          onClose={() => setFormOpen(false)}
        >
          <form onSubmit={handleFormSubmit} className="space-y-6">
            {formError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300 flex items-center gap-2">
                <FiAlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{formError}</span>
              </div>
            )}

            {/* 1. Client Selection Card */}
            <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/60 dark:border-white/10 dark:bg-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-neutral-200 flex items-center gap-1.5">
                  <FiUser className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Target Client Account <span className="text-red-500">*</span></span>
                </label>
                {selectedClientObj && (
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/40">
                    Selected: {selectedClientObj.name}
                  </span>
                )}
              </div>

              <select
                value={clientId}
                onChange={(e) => handleClientSelectChange(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:outline-hidden dark:border-white/10 dark:bg-surface-800 dark:text-white shadow-2xs"
              >
                <option value="">-- Choose a Client Account --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.invoice_email ? `• Billing: ${c.invoice_email}` : (c.email || c.login_email) ? `• Login: ${c.email || c.login_email}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Main Two-Column Grid: File Uploader (Left) & Metadata (Right) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              {/* Left Column: File Dropzone & Live Document Preview (5 cols) */}
              <div className="md:col-span-5 flex flex-col">
                <label className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-neutral-300 flex items-center gap-1.5">
                  <FiFileText className="w-3.5 h-3.5 text-blue-500" />
                  <span>Document File (PDF / Image) <span className="text-red-500">*</span></span>
                </label>

                <div
                  className={`flex-1 min-h-[220px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-5 text-center transition-all relative ${
                    invoiceFile
                      ? 'border-emerald-400 bg-emerald-50/20 dark:border-emerald-800/60 dark:bg-emerald-950/20'
                      : 'border-slate-300 hover:border-emerald-400 bg-slate-50/70 hover:bg-emerald-50/10 dark:border-white/15 dark:bg-surface-800/30'
                  }`}
                >
                  {invoiceFile ? (
                    <div className="w-full flex flex-col items-center space-y-3">
                      {filePreview ? (
                        <div className="relative max-h-36 max-w-full overflow-hidden rounded-xl border border-slate-200 dark:border-white/10 shadow-xs">
                          <img
                            src={filePreview}
                            alt="Invoice Preview"
                            className="max-h-36 object-contain"
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center shadow-xs">
                          <FiFileText className="w-8 h-8" />
                        </div>
                      )}

                      <div className="text-center px-2">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[200px]" title={invoiceFile.name}>
                          {invoiceFile.name}
                        </p>
                        <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                          {(invoiceFile.size / (1024 * 1024)).toFixed(2)} MB • Ready to dispatch
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleRemoveFile}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/40 cursor-pointer"
                      >
                        <FiX className="w-3.5 h-3.5" />
                        <span>Change File</span>
                      </button>
                    </div>
                  ) : (
                    <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer p-4">
                      <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 flex items-center justify-center shadow-2xs mb-3">
                        <FiUploadCloud className="w-7 h-7" />
                      </div>
                      <p className="text-xs font-extrabold text-slate-800 dark:text-neutral-200">
                        Click to select or drag & drop
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-neutral-400 mt-1">
                        PDF, PNG, JPG, JPEG, WEBP (Max 15MB)
                      </p>
                      <input
                        type="file"
                        accept="application/pdf,image/png,image/jpeg,image/webp,.pdf,.png,.jpg,.jpeg,.webp"
                        onChange={handleFileChange}
                        required
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Right Column: Invoice Reference, Schedule & Payment Settings (7 cols) */}
              <div className="md:col-span-7 space-y-4">
                {/* Reference / Title */}
                <div>
                  <label className="mb-1 block text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-neutral-300">
                    Invoice Title / Reference
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Invoice - August 2026 or INV-2026-081"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:border-emerald-500 focus:outline-hidden dark:border-white/10 dark:bg-surface-800 dark:text-white shadow-2xs"
                  />
                </div>

                {/* Billing Schedule (Issue Date & Due Date) */}
                <div className="p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/60 dark:border-white/10 dark:bg-white/5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-neutral-300 flex items-center gap-1.5">
                      <FiCalendar className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Billing Schedule</span>
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setQuickDueDate(7)}
                        className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 hover:bg-slate-100 text-slate-700 dark:text-neutral-300"
                      >
                        +7 Days
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickDueDate(14)}
                        className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 hover:bg-slate-100 text-slate-700 dark:text-neutral-300"
                      >
                        +14 Days
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickDueDate(30)}
                        className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 hover:bg-slate-100 text-slate-700 dark:text-neutral-300"
                      >
                        +30 Days
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 dark:text-neutral-400 block mb-1">
                        Issue Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={issueDate}
                        onChange={(e) => setIssueDate(e.target.value)}
                        required
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-emerald-500 focus:outline-hidden dark:border-white/10 dark:bg-surface-800 dark:text-white shadow-2xs"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-500 dark:text-neutral-400 block mb-1">
                        Payment Due Date
                      </label>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-emerald-500 focus:outline-hidden dark:border-white/10 dark:bg-surface-800 dark:text-white shadow-2xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Payment Status Switch Card */}
                <div
                  onClick={() => setIsPaid(!isPaid)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer select-none flex items-center justify-between ${
                    isPaid
                      ? 'bg-emerald-50/90 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800/60 shadow-2xs'
                      : 'bg-slate-50/60 border-slate-200/80 hover:bg-slate-100/60 dark:bg-white/5 dark:border-white/10'
                  }`}
                >
                  <div className="space-y-0.5">
                    <span className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                      {isPaid ? (
                        <FiCheckCircle className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <FiClock className="w-4 h-4 text-amber-500" />
                      )}
                      <span>{isPaid ? 'Payment Received & Settled' : 'Payment Pending (Unpaid)'}</span>
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-neutral-400">
                      {isPaid
                        ? 'Invoice will immediately show as Paid on client dashboard'
                        : 'Invoice will show with Pending Due status'}
                    </p>
                  </div>

                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all ${
                      isPaid
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'border-slate-300 bg-white dark:bg-surface-800 dark:border-white/20 text-transparent'
                    }`}
                  >
                    <FiCheck className="w-4 h-4 stroke-[3]" />
                  </div>
                </div>

                {/* Email Dispatch Card */}
                <div className="p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/60 dark:border-white/10 dark:bg-white/5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={sendEmail}
                        onChange={(e) => setSendEmail(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                      />
                      <span className="text-xs font-extrabold text-slate-800 dark:text-neutral-200 flex items-center gap-1.5">
                        <FiMail className="w-3.5 h-3.5 text-blue-500" />
                        <span>Email Invoice & Attachment to Client</span>
                      </span>
                    </label>

                    {selectedClientObj && sendEmail && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40">
                        {selectedClientObj.invoice_email
                          ? 'Auto-prefilled from Client Profile'
                          : selectedClientObj.login_email || selectedClientObj.email
                            ? 'Auto-prefilled from Login Email'
                            : 'No Saved Email'}
                      </span>
                    )}
                  </div>

                  {sendEmail && (
                    <div className="pl-6 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-500 dark:text-neutral-400 block">
                          Recipient Billing Email:
                        </label>
                        {selectedClientObj &&
                          (selectedClientObj.invoice_email || selectedClientObj.login_email || selectedClientObj.email) &&
                          recipientEmail !== (selectedClientObj.invoice_email || selectedClientObj.login_email || selectedClientObj.email) && (
                            <button
                              type="button"
                              onClick={() =>
                                setRecipientEmail(
                                  selectedClientObj.invoice_email || selectedClientObj.login_email || selectedClientObj.email || ''
                                )
                              }
                              className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 underline cursor-pointer"
                            >
                              Reset to client email
                            </button>
                          )}
                      </div>
                      <input
                        type="email"
                        value={recipientEmail}
                        onChange={(e) => setRecipientEmail(e.target.value)}
                        placeholder="e.g. accounts@clientfleet.co.uk or billing@company.com"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-emerald-500 focus:outline-hidden dark:border-white/10 dark:bg-surface-800 dark:text-white shadow-2xs"
                      />
                      <p className="text-[10px] text-slate-400 dark:text-neutral-500">
                        {selectedClientObj?.invoice_email ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            ✓ Automatically prefilled from client&apos;s configured Invoice / Billing email.
                          </span>
                        ) : selectedClientObj?.login_email || selectedClientObj?.email ? (
                          <span className="text-blue-600 dark:text-blue-400 font-medium">
                            ℹ️ Prefilled from client portal login email ({selectedClientObj.login_email || selectedClientObj.email}).
                          </span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 font-medium">
                            ⚠️ Client has no email on file. Please enter recipient email manually.
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 3. Notes / Instructions */}
            <div>
              <label className="mb-1 block text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-neutral-300">
                Optional Notes / Remittance Instructions
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add bank transfer reference, terms, or customer remarks (visible on client portal & email)…"
                rows="2"
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:outline-hidden dark:border-white/10 dark:bg-surface-800 dark:text-white shadow-2xs"
              />
            </div>

            {/* 4. Modal Footer Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-neutral-400">
                <FiCheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Document delivered to client portal {sendEmail && recipientEmail ? `and ${recipientEmail}` : ''}.</span>
              </div>

              <div className="flex items-center gap-2.5 justify-end">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-white/10 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !clientId || !invoiceFile}
                  style={{ backgroundColor: accent }}
                  className="inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-xs font-extrabold text-white shadow-sm hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer"
                >
                  <FiSend className="w-3.5 h-3.5" />
                  <span>{saving ? 'Uploading & Dispatching…' : 'Upload & Send Invoice'}</span>
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <ConfirmModal
          title="Delete Invoice"
          message={`Are you sure you want to delete invoice "${deleteTarget.invoice_number}" for ${deleteTarget.client_name}? This action cannot be undone.`}
          confirmWord="delete"
          confirmLabel="Delete Invoice"
          requireTyping={true}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

export default InvoicesPage;
