import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import QRCode from 'qrcode';
import apiClient from '../../services/api-client';
import PageHeader from '../../components/ui/PageHeader';
import useInfiniteList from '../../utils/use-infinite-list';
import DataTable from '../../components/ui/DataTable';
import TableState from '../../components/ui/TableState';
import InfiniteScrollTrigger from '../../components/ui/InfiniteScrollTrigger';
import Modal from '../../components/ui/Modal';
import ConfirmModal from '../../components/ui/ConfirmModal';
import AlertModal from '../../components/ui/AlertModal';
import RowActions from '../../components/ui/RowActions';
import useFetchList from '../../utils/use-fetch-list';
import { downloadQrSheet, previewQrSheet, DEFAULT_COLUMNS, ROWS, SHEET_SIZE } from '../../utils/generate-qr-sheet';

const inputClasses =
  'w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-blue-800/40 dark:bg-blue-900/10 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/30';
const formInputClasses =
  'w-full rounded-md border border-blue-200 bg-blue-50/60 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-blue-800/40 dark:bg-blue-900/10 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/30';
const labelClasses = 'mb-1.5 block text-sm font-medium text-slate-700 dark:text-neutral-200';

const DEBOUNCE_MS = 250;
const LIST_PAGE_SIZE = 20;
const BULK_PRESETS = [10, 50, 100, 500, 1000, 5000, 10000, 50000];

// Registers batteries for a client and generates QR codes.
// Supports two modes: Individual (1 QR with optional Battery Number preview)
// and Bulk (1–50,000 QR codes batch-created in one API call).
// Battery Number (manufacturer serial) is optional at creation time. A
// Client can set it once, while blank, but not edit it afterwards — Admin
// can always set or override it, including a Client-set one, behind typing
// CONFIRM in the edit modal.
function GenerateQrPage() {
  const user = useSelector((state) => state.auth.user);
  const isSuperAdmin = user?.role === 'super_admin';

  // ── Tab state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('individual'); // 'individual' | 'bulk'

  // ── Individual form state ──────────────────────────────────────────────────
  const [serialNumber, setSerialNumber] = useState('');
  const [clientName, setClientName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [qrResult, setQrResult] = useState(null);
  const [suggestedNumber, setSuggestedNumber] = useState(1);
  const numberDebounceRef = useRef(null);

  // ── Bulk form state ────────────────────────────────────────────────────────
  const [bulkClientName, setBulkClientName] = useState('');
  const [bulkCount, setBulkCount] = useState('100');
  const [bulkStartNumber, setBulkStartNumber] = useState('');
  const [bulkSuggestedStart, setBulkSuggestedStart] = useState(1);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkError, setBulkError] = useState(null);
  const [bulkResult, setBulkResult] = useState(null);
  const bulkDebounceRef = useRef(null);

  // ── List + filter state ────────────────────────────────────────────────────
  const { data: clients } = useFetchList('/clients');
  const [listSearchInput, setListSearchInput] = useState('');
  const [listSearch, setListSearch] = useState('');
  const listDebounceRef = useRef(null);
  const [viewingQr, setViewingQr] = useState(null);
  const [listClientFilter, setListClientFilter] = useState('');
  const [showBlocked, setShowBlocked] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [rowError, setRowError] = useState(null);

  // ── Serial Number update modal ─────────────────────────────────────────────
  const [serialTarget, setSerialTarget] = useState(null); // battery row
  const [serialInput, setSerialInput] = useState('');
  // Typed twice to catch a mistyped number before it saves.
  const [serialInputRetype, setSerialInputRetype] = useState('');
  const [serialSaving, setSerialSaving] = useState(false);
  const [serialError, setSerialError] = useState(null);
  // Overriding an existing Battery Number (client-set or not) needs CONFIRM
  // typed first — a client can no longer edit one once it's set, so this is
  // the only path left for fixing a mistaken or client-locked number.
  const [serialConfirmText, setSerialConfirmText] = useState('');

  // ── Print sheet state ──────────────────────────────────────────────────────
  const [sheetStart, setSheetStart] = useState('1');
  const [sheetCount, setSheetCount] = useState(String(SHEET_SIZE));
  const [sheetColumns, setSheetColumns] = useState(String(DEFAULT_COLUMNS));
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetError, setSheetError] = useState(null);

  const {
    items: generatedBatteries,
    loading: listLoading,
    hasMore: listHasMore,
    error: listError,
    loadMore: loadMoreGenerated,
    refetch: refetchGenerated,
  } = useInfiniteList('/batteries', LIST_PAGE_SIZE, {
    qrGenerated: true,
    search: listSearch || undefined,
    clientName: listClientFilter || undefined,
    includeBlocked: showBlocked || undefined,
  });

  // ── Individual: auto-suggest next sequence number for chosen client ────────
  useEffect(() => {
    clearTimeout(numberDebounceRef.current);
    if (!clientName.trim()) { setSuggestedNumber(1); return; }
    numberDebounceRef.current = setTimeout(async () => {
      try {
        const { data } = await apiClient.get('/batteries/count-by-client', {
          params: { clientName: clientName.trim() },
        });
        setSuggestedNumber(data.lastNumber + 1);
      } catch { setSuggestedNumber(1); }
    }, DEBOUNCE_MS);
    return () => clearTimeout(numberDebounceRef.current);
  }, [clientName]);

  // ── Bulk: auto-suggest starting number for chosen client ──────────────────
  useEffect(() => {
    clearTimeout(bulkDebounceRef.current);
    if (!bulkClientName.trim()) { setBulkSuggestedStart(1); return; }
    bulkDebounceRef.current = setTimeout(async () => {
      try {
        const { data } = await apiClient.get('/batteries/count-by-client', {
          params: { clientName: bulkClientName.trim() },
        });
        setBulkSuggestedStart(data.lastNumber + 1);
      } catch { setBulkSuggestedStart(1); }
    }, DEBOUNCE_MS);
    return () => clearTimeout(bulkDebounceRef.current);
  }, [bulkClientName]);

  // ── Individual: derived battery ID ────────────────────────────────────────
  const clientPrefix = clientName.trim().replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();
  const computedBatteryId = clientPrefix ? `${clientPrefix}-${String(suggestedNumber).padStart(4, '0')}` : '';

  // ── Bulk: preview range ────────────────────────────────────────────────────
  const bulkStart = Number(bulkStartNumber) > 0 ? Number(bulkStartNumber) : bulkSuggestedStart;
  const bulkEnd = bulkStart + (Math.max(Number(bulkCount) || 1, 1)) - 1;
  const bulkPrefix = bulkClientName.trim().replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();
  const padLen = Math.max(4, String(bulkEnd).length);
  const bulkFirstPreview = bulkPrefix ? `${bulkPrefix}-${String(bulkStart).padStart(padLen, '0')}` : '—';
  const bulkLastPreview = bulkPrefix ? `${bulkPrefix}-${String(bulkEnd).padStart(padLen, '0')}` : '—';

  // ── List: debounced search ─────────────────────────────────────────────────
  useEffect(() => {
    clearTimeout(listDebounceRef.current);
    listDebounceRef.current = setTimeout(() => setListSearch(listSearchInput.trim()), DEBOUNCE_MS);
    return () => clearTimeout(listDebounceRef.current);
  }, [listSearchInput]);

  // ── Individual: submit ─────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    if (!clientName.trim()) { setError('Select a client first — the Battery ID is generated from it.'); return; }
    setSubmitting(true); setError(null); setQrResult(null);
    try {
      const { data: created } = await apiClient.post('/batteries/generate', {
        clientName: clientName.trim(),
        serialNumber: serialNumber.trim() || undefined,
        batteryCode: computedBatteryId,
      });
      const detailUrl = `${window.location.origin}/batteries/${encodeURIComponent(created.battery_code)}`;
      const dataUrl = await QRCode.toDataURL(detailUrl, { width: 320, margin: 1 });
      // Clear form fields first, then show the result preview
      setSerialNumber(''); setClientName('');
      setQrResult({ dataUrl, detailUrl, batteryCode: created.battery_code, clientName: created.client_name || clientName.trim() });
      refetchGenerated();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally { setSubmitting(false); }
  }

  function handleDownload() {
    const link = document.createElement('a');
    link.href = qrResult.dataUrl;
    link.download = `qr-${qrResult.batteryCode}.png`;
    link.click();
  }

  // ── Bulk: submit ───────────────────────────────────────────────────────────
  async function handleBulkSubmit(e) {
    e.preventDefault();
    const count = Number(bulkCount);
    if (!bulkClientName.trim()) { setBulkError('Select a client first.'); return; }
    if (!count || count < 1 || count > 50000) { setBulkError('Please enter a count between 1 and 50,000.'); return; }
    setBulkSubmitting(true); setBulkError(null); setBulkResult(null);
    try {
      const payload = {
        clientName: bulkClientName.trim(),
        count,
        ...(Number(bulkStartNumber) > 0 ? { startNumber: Number(bulkStartNumber) } : {}),
      };
      const { data } = await apiClient.post('/batteries/generate-bulk', payload);
      // Clear all form fields so the form is ready for the next batch
      setBulkClientName(''); setBulkCount('100'); setBulkStartNumber('');
      setBulkResult(data);
      refetchGenerated();
    } catch (err) {
      setBulkError(err.response?.data?.message || err.message);
    } finally { setBulkSubmitting(false); }
  }

  function handleBulkReset() {
    setBulkClientName(''); setBulkCount('100'); setBulkStartNumber('');
    setBulkResult(null); setBulkError(null);
  }

  // ── Row QR helpers ─────────────────────────────────────────────────────────
  async function buildRowQr(row) {
    const detailUrl = `${window.location.origin}/batteries/${encodeURIComponent(row.battery_code)}`;
    const dataUrl = await QRCode.toDataURL(detailUrl, { width: 320, margin: 1 });
    return { dataUrl, detailUrl, batteryCode: row.battery_code, clientName: row.client_name };
  }

  async function handleDownloadRow(row) {
    const { dataUrl, batteryCode } = await buildRowQr(row);
    const link = document.createElement('a'); link.href = dataUrl;
    link.download = `qr-${batteryCode}.png`; link.click();
  }

  async function handleViewRow(row) { setViewingQr(await buildRowQr(row)); }

  // ── Serial Number modal ────────────────────────────────────────────────────
  function openSerialModal(row) {
    setSerialTarget(row);
    setSerialInput(row.serial_number || '');
    setSerialInputRetype(row.serial_number || '');
    setSerialConfirmText('');
    setSerialError(null);
  }

  async function handleSerialSave() {
    if (serialInput.trim() && serialInput.trim() !== serialInputRetype.trim()) {
      setSerialError('The two battery numbers you typed don’t match. Please re-check and try again.');
      return;
    }
    setSerialSaving(true); setSerialError(null);
    try {
      await apiClient.patch(`/batteries/${serialTarget.id}/serial-number`, {
        serialNumber: serialInput.trim(),
      });
      refetchGenerated();
      setSerialTarget(null);
    } catch (err) {
      setSerialError(err.response?.data?.message || err.message);
    } finally { setSerialSaving(false); }
  }

  // ── Print sheet ────────────────────────────────────────────────────────────
  async function fetchBatteriesRange(startPosition, count) {
    const batteries = [];
    let offset = startPosition - 1;
    while (batteries.length < count) {
      const { data } = await apiClient.get('/batteries', {
        params: { qrGenerated: true, limit: Math.min(100, count - batteries.length), offset },
      });
      const page = data.data || [];
      batteries.push(...page);
      offset += page.length;
      if (!data.hasMore || page.length === 0) break;
    }
    return batteries;
  }

  async function runSheetAction(action) {
    const startPosition = Math.max(Number(sheetStart) || 1, 1);
    const count = Math.max(Number(sheetCount) || SHEET_SIZE, 1);
    const columns = Math.max(Number(sheetColumns) || DEFAULT_COLUMNS, 1);
    setSheetError(null); setSheetLoading(true);
    try {
      const batteries = await fetchBatteriesRange(startPosition, count);
      if (batteries.length === 0) { setSheetError(`No generated QR codes found starting from position ${startPosition}.`); return; }
      await action(batteries, columns);
    } catch (err) {
      setSheetError(err.response?.data?.message || err.message);
    } finally { setSheetLoading(false); }
  }

  function handlePreviewSheet(e) { e.preventDefault(); runSheetAction(previewQrSheet); }
  function handleDownloadSheet(e) { e.preventDefault(); runSheetAction(downloadQrSheet); }

  async function handleToggleBlock(row) {
    setRowError(null);
    try {
      await apiClient.patch(`/batteries/${row.id}/block`, { blocked: !row.is_blocked });
      refetchGenerated();
    } catch (err) { setRowError(err.response?.data?.message || err.message); }
  }

  async function handleConfirmDelete() {
    setRowError(null);
    try {
      await apiClient.delete(`/batteries/${deleteTarget.id}`);
      setDeleteTarget(null); refetchGenerated();
    } catch (err) {
      setRowError(err.response?.data?.message || err.message);
      setDeleteTarget(null);
    }
  }

  function handleReset() { setSerialNumber(''); setClientName(''); setQrResult(null); setError(null); }

  // ── Battery Number cell renderer ───────────────────────────────────────────
  function renderSerialCell(row) {
    const isClientLocked = row.serial_number_added_by_role === 'client' && row.serial_number;
    const isAdminSet = row.serial_number && !isClientLocked;
    const isAdmin = user?.role === 'super_admin' || user?.role === 'admin';

    if (!row.serial_number) {
      return (
        <button
          type="button"
          onClick={() => openSerialModal(row)}
          className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" />
          </svg>
          Add Number
        </button>
      );
    }

    if (isClientLocked) {
      return (
        <div className="flex items-center gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-slate-800 dark:text-neutral-100">{row.serial_number}</span>
            <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                <path fillRule="evenodd" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z" clipRule="evenodd" />
              </svg>
              Set by Client
            </span>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => openSerialModal(row)}
              title="Edit Battery Number (requires confirmation)"
              className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-neutral-500 dark:hover:bg-blue-900/30 dark:hover:text-neutral-300"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.596.892l-.848 2.047a.75.75 0 0 0 .98.98l2.047-.848a2.75 2.75 0 0 0 .892-.596l4.261-4.263a1.75 1.75 0 0 0 0-2.474Z" />
                <path d="M4.75 3.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h6.5c.69 0 1.25-.56 1.25-1.25V9a.75.75 0 0 1 1.5 0v2.25A2.75 2.75 0 0 1 11.25 14h-6.5A2.75 2.75 0 0 1 2 11.25v-6.5A2.75 2.75 0 0 1 4.75 2H7a.75.75 0 0 1 0 1.5H4.75Z" />
              </svg>
            </button>
          )}
        </div>
      );
    }

    // Admin-set or editable
    return (
      <div className="flex items-center gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-slate-800 dark:text-neutral-100">{row.serial_number}</span>
          {isAdminSet && (
            <span className="text-[10px] font-medium text-slate-400 dark:text-neutral-500">
              Set by {row.serial_number_added_by_role}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => openSerialModal(row)}
          title="Edit Battery Number"
          className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-neutral-500 dark:hover:bg-blue-900/30 dark:hover:text-neutral-300"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.596.892l-.848 2.047a.75.75 0 0 0 .98.98l2.047-.848a2.75 2.75 0 0 0 .892-.596l4.261-4.263a1.75 1.75 0 0 0 0-2.474Z" />
            <path d="M4.75 3.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h6.5c.69 0 1.25-.56 1.25-1.25V9a.75.75 0 0 1 1.5 0v2.25A2.75 2.75 0 0 1 11.25 14h-6.5A2.75 2.75 0 0 1 2 11.25v-6.5A2.75 2.75 0 0 1 4.75 2H7a.75.75 0 0 1 0 1.5H4.75Z" />
          </svg>
        </button>
      </div>
    );
  }

  // ── Table columns ──────────────────────────────────────────────────────────
  const qrColumns = [
    {
      key: 'battery_code', label: 'Battery ID',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Link to={`/batteries/${row.battery_code}`} className="font-medium text-blue-700 hover:underline dark:text-blue-400">
            {row.battery_code}
          </Link>
          {row.is_blocked && (
            <span className="rounded-full bg-critical-100 px-2 py-0.5 text-[11px] font-semibold text-critical-700 dark:bg-red-500/15 dark:text-red-300">
              Blocked
            </span>
          )}
        </div>
      ),
    },
    { key: 'client_name', label: 'Client', render: (row) => row.client_name || '—' },
    {
      key: 'serial_number', label: 'Battery Number',
      render: (row) => renderSerialCell(row),
    },
    {
      key: 'qr_generated_at', label: 'Generated',
      render: (row) => new Date(row.qr_generated_at).toLocaleString(),
    },
    {
      key: 'actions', label: '',
      render: (row) => (
        <div className="-mr-2 flex items-center gap-6">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => handleViewRow(row)}
              aria-label={`View QR code for ${row.battery_code}`}
              className="text-slate-400 hover:text-brand-700 dark:text-neutral-500 dark:hover:text-emerald-400"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
                <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => handleDownloadRow(row)}
              className="text-sm font-medium text-brand-700 hover:underline dark:text-emerald-400"
            >
              Download
            </button>
          </div>
          {isSuperAdmin && (
            <RowActions
              onToggleBlock={() => handleToggleBlock(row)}
              isBlocked={row.is_blocked}
              onDelete={() => setDeleteTarget(row)}
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Generate QR Code"
        description="Create QR codes for batteries — scan one to open its full history."
        titleClassName="text-2xl font-bold tracking-tight text-green-600 dark:text-green-400"
      />

      {/* ── Tab switcher ───────────────────────────────────────────────────── */}
      <div className="mb-6 flex gap-1 rounded-xl border border-blue-200 bg-blue-50/50 p-1 dark:border-blue-800/40 dark:bg-blue-900/10">
        <button
          type="button"
          onClick={() => { setActiveTab('individual'); setError(null); setQrResult(null); }}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
            activeTab === 'individual'
              ? 'bg-white shadow-sm text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
              : 'text-slate-500 hover:text-slate-700 dark:text-neutral-400 dark:hover:text-neutral-200'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M4.25 2A2.25 2.25 0 0 0 2 4.25v11.5A2.25 2.25 0 0 0 4.25 18h11.5A2.25 2.25 0 0 0 18 15.75V4.25A2.25 2.25 0 0 0 15.75 2H4.25ZM15 5.75a.75.75 0 0 0-1.5 0v8.5a.75.75 0 0 0 1.5 0v-8.5Zm-8.5 6a.75.75 0 0 0-1.5 0v2.5a.75.75 0 0 0 1.5 0v-2.5ZM8.25 8a.75.75 0 0 1 .75.75v5.5a.75.75 0 0 1-1.5 0v-5.5A.75.75 0 0 1 8.25 8Zm3.25 2a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
          </svg>
          Individual QR Code
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('bulk'); setBulkError(null); setBulkResult(null); }}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
            activeTab === 'bulk'
              ? 'bg-white shadow-sm text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
              : 'text-slate-500 hover:text-slate-700 dark:text-neutral-400 dark:hover:text-neutral-200'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M2 4.5A2.5 2.5 0 0 1 4.5 2h11A2.5 2.5 0 0 1 18 4.5v11a2.5 2.5 0 0 1-2.5 2.5H8.457a4.5 4.5 0 0 0 .043-.5c0-.67-.145-1.306-.404-1.879L6.943 13.5H15.5a.5.5 0 0 0 .5-.5v-8a.5.5 0 0 0-.5-.5h-11a.5.5 0 0 0-.5.5V12l-1.5-3.5V4.5Z" />
            <path d="M6 14.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
          Bulk Generation 
        </button>
      </div>

      {/* ── Individual tab ─────────────────────────────────────────────────── */}
      {activeTab === 'individual' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-5 rounded-xl border border-blue-200 p-5 shadow-sm dark:border-blue-800/40"
          >
            <div>
              <label className={labelClasses}>Battery Number <span className="text-xs font-normal text-slate-400 dark:text-neutral-500">(optional — can be added later)</span></label>
              <input
                type="text"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="e.g. SN-88213 — the number printed on the battery"
                autoComplete="off"
                className={formInputClasses}
              />
              <p className="mt-1.5 text-xs text-slate-500 dark:text-neutral-400">
                The manufacturer's serial number physically printed on the battery. Leave blank if unknown — Admin or Client can add it later.
              </p>
            </div>

            <div>
              <label className={labelClasses}>Client <span className="text-critical-600 dark:text-red-400">*</span></label>
              <select
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full rounded-md border border-blue-200 bg-blue-50/60 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-blue-800/40 dark:bg-black dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-400/30"
                required
              >
                <option value="">Select a client</option>
                {(clients || []).map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-neutral-400">
                Select the client/company that owns this battery.
              </p>
            </div>

            <div>
              <label className={labelClasses}>Battery ID</label>
              <input
                type="text"
                value={computedBatteryId}
                readOnly
                placeholder="Select a client to auto-generate"
                className={`${formInputClasses} cursor-not-allowed font-mono opacity-75`}
              />
              <p className="mt-1.5 text-xs text-slate-500 dark:text-neutral-400">
                Automatically generated from the client name. The QR code encodes a link to this ID.
              </p>
            </div>

            {error && <p className="text-sm text-critical-600 dark:text-red-400">{error}</p>}

            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={handleReset}
                className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-blue-900/30"
              >
                Reset
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-violet-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-violet-800 disabled:opacity-50"
              >
                {submitting ? 'Generating…' : 'Generate QR Code'}
              </button>
            </div>
          </form>

          <div className="flex flex-col items-center justify-center rounded-xl border border-blue-200 p-5 shadow-sm dark:border-blue-800/40">
            {qrResult ? (
              <>
                <img
                  src={qrResult.dataUrl}
                  alt={`QR code for battery ${qrResult.batteryCode}`}
                  className="h-64 w-64 rounded-lg border border-slate-100 dark:border-surface-700"
                />
                <p className="mt-4 text-sm font-semibold text-slate-800 dark:text-neutral-100">{qrResult.batteryCode}</p>
                {qrResult.clientName && (
                  <p className="text-sm text-slate-500 dark:text-neutral-400">Client: {qrResult.clientName}</p>
                )}
                <p className="mt-1 max-w-xs truncate text-center text-xs text-slate-400 dark:text-neutral-500">
                  {qrResult.detailUrl}
                </p>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
                >
                  Download PNG
                </button>
              </>
            ) : (
              <p className="text-center text-sm text-slate-400 dark:text-neutral-500">
                Select a client and generate its QR code to preview it here.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Bulk tab ───────────────────────────────────────────────────────── */}
      {activeTab === 'bulk' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <form
            onSubmit={handleBulkSubmit}
            className="flex flex-col gap-5 rounded-xl border border-violet-200 p-5 shadow-sm dark:border-violet-800/40"
          >
            <div>
              <label className={labelClasses}>Client <span className="text-critical-600 dark:text-red-400">*</span></label>
              <select
                value={bulkClientName}
                onChange={(e) => setBulkClientName(e.target.value)}
                className="w-full rounded-md border border-violet-200 bg-violet-50/60 px-3.5 py-2.5 text-sm text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30 dark:border-violet-800/40 dark:bg-black dark:text-white dark:focus:border-violet-400 dark:focus:ring-violet-400/30"
                required
              >
                <option value="">Select a client</option>
                {(clients || []).map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClasses}>
                Starting Number
                {bulkClientName && (
                  <span className="ml-2 text-xs font-normal text-slate-400 dark:text-neutral-500">
                    (next for {bulkClientName}: {bulkSuggestedStart})
                  </span>
                )}
              </label>
              <input
                type="number"
                min="1"
                value={bulkStartNumber}
                onChange={(e) => setBulkStartNumber(e.target.value)}
                placeholder={bulkClientName ? String(bulkSuggestedStart) : 'e.g. 1'}
                className={`${formInputClasses} [appearance:textfield]`}
              />
              <p className="mt-1.5 text-xs text-slate-500 dark:text-neutral-400">
                Leave blank to auto-continue from the last generated number for this client.
              </p>
            </div>

            <div>
              <label className={labelClasses}>How many QR Codes</label>
              {/* Quick presets */}
              <div className="mb-2 flex flex-wrap gap-1.5">
                {BULK_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setBulkCount(String(preset))}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                      bulkCount === String(preset)
                        ? 'border-violet-500 bg-violet-100 text-violet-700 dark:border-violet-400 dark:bg-violet-900/40 dark:text-violet-300'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-violet-300 hover:text-violet-700 dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-300 dark:hover:border-violet-500 dark:hover:text-violet-300'
                    }`}
                  >
                    {preset >= 1000 ? `${preset / 1000}k` : preset}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min="1"
                max="50000"
                value={bulkCount}
                onChange={(e) => setBulkCount(e.target.value)}
                className={`${formInputClasses} [appearance:textfield]`}
                required
              />
              <p className="mt-1.5 text-xs text-slate-500 dark:text-neutral-400">
                Maximum 50,000 per batch. Battery Numbers can be assigned later by Admin or Client.
              </p>
            </div>

            {bulkError && <p className="text-sm text-critical-600 dark:text-red-400">{bulkError}</p>}

            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={handleBulkReset}
                className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-violet-900/30"
              >
                Reset
              </button>
              <button
                type="submit"
                disabled={bulkSubmitting}
                className="rounded-md bg-violet-700 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-violet-600 disabled:opacity-50"
              >
                {bulkSubmitting ? 'Generating…' : 'Generate Bulk QR Codes'}
              </button>
            </div>
          </form>

          {/* ── Bulk preview card ────────────────────────────────────────── */}
          <div className="flex flex-col justify-center gap-4 rounded-xl border border-violet-200 p-5 shadow-sm dark:border-violet-800/40">
            {bulkResult ? (
              <div className="flex flex-col items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-emerald-500/15">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8 text-green-600 dark:text-emerald-400">
                    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-800 dark:text-neutral-100">
                    {bulkResult.count?.toLocaleString()} QR Codes Generated!
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-neutral-400">
                    Client: <span className="font-medium">{bulkResult.clientName}</span>
                  </p>
                </div>
                <div className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-surface-700 dark:bg-surface-900">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 dark:text-neutral-400">First ID</span>
                    <span className="font-mono font-medium text-slate-800 dark:text-neutral-100">{bulkResult.firstCode}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm">
                    <span className="text-slate-500 dark:text-neutral-400">Last ID</span>
                    <span className="font-mono font-medium text-slate-800 dark:text-neutral-100">{bulkResult.lastCode}</span>
                  </div>
                </div>
                <p className="text-center text-xs text-slate-400 dark:text-neutral-500">
                  Battery Numbers (manufacturer serials) can be assigned to each battery later by Admin or Client.
                </p>
              </div>
            ) : (
              <>
                <h3 className="text-sm font-semibold text-slate-600 dark:text-neutral-300">Range Preview</h3>
                <div className="rounded-lg border border-violet-100 bg-violet-50/60 p-4 dark:border-violet-800/30 dark:bg-violet-900/10">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500 dark:text-neutral-400">Client</span>
                    <span className="text-sm font-semibold text-slate-800 dark:text-neutral-100">
                      {bulkClientName || <span className="text-slate-300 dark:text-neutral-600">Not selected</span>}
                    </span>
                  </div>
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500 dark:text-neutral-400">Count</span>
                    <span className="text-sm font-semibold text-slate-800 dark:text-neutral-100">
                      {Number(bulkCount) > 0 ? Number(bulkCount).toLocaleString() : '—'}
                    </span>
                  </div>
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500 dark:text-neutral-400">First ID</span>
                    <span className="font-mono text-sm font-semibold text-violet-700 dark:text-violet-300">{bulkFirstPreview}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500 dark:text-neutral-400">Last ID</span>
                    <span className="font-mono text-sm font-semibold text-violet-700 dark:text-violet-300">{bulkLastPreview}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-400 dark:text-neutral-500">
                  All {Number(bulkCount) > 0 ? Number(bulkCount).toLocaleString() : '…'} batteries will be created instantly.
                  Battery Numbers (physical serials) are optional — Admin or Client can fill them in after printing.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Generated QR Codes list ─────────────────────────────────────────── */}
      <div className="mt-8">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-neutral-400">
            Generated QR Codes
          </h2>
          <div className="flex flex-nowrap items-center gap-6 pr-4">
            <div className="relative max-w-sm w-full">
              <input
                type="text"
                value={listSearchInput}
                onChange={(e) => setListSearchInput(e.target.value)}
                placeholder="Search by Battery ID or Client Name"
                className={`${inputClasses} w-full pr-8`}
              />
              {listSearchInput && (
                <button
                  type="button"
                  onClick={() => { setListSearchInput(''); setListSearch(''); }}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-neutral-500 dark:hover:bg-blue-900/30 dark:hover:text-neutral-300"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                    <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                  </svg>
                </button>
              )}
            </div>
            <select
              value={listClientFilter}
              onChange={(e) => setListClientFilter(e.target.value)}
              className="w-full max-w-[10rem] shrink-0 rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-blue-800/40 dark:bg-black dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-400/30"
            >
              <option value="">All Clients</option>
              {(clients || []).map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
            {isSuperAdmin && (
              <label className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm text-slate-600 dark:text-neutral-300">
                <input
                  type="checkbox"
                  checked={showBlocked}
                  onChange={(e) => setShowBlocked(e.target.checked)}
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500/30 dark:border-surface-600"
                />
                Show blocked
              </label>
            )}
          </div>
        </div>

        {/* ── Print Sheet form ───────────────────────────────────────────── */}
        <form
          onSubmit={handleDownloadSheet}
          className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-blue-200 p-4 dark:border-blue-800/40"
        >
          <div>
            <label className={labelClasses}>Print QR Sheet — start from #</label>
            <input
              type="number"
              min="1"
              value={sheetStart}
              onChange={(e) => setSheetStart(e.target.value)}
              className={`${inputClasses} max-w-[8rem]`}
            />
          </div>
          <div>
            <label className={labelClasses}>How many</label>
            <input
              type="number"
              min="1"
              value={sheetCount}
              onChange={(e) => setSheetCount(e.target.value)}
              className={`${inputClasses} max-w-[8rem]`}
            />
          </div>
          <div>
            <label className={labelClasses}>Per row</label>
            <input
              type="number"
              min="1"
              value={sheetColumns}
              onChange={(e) => setSheetColumns(e.target.value)}
              className={`${inputClasses} max-w-[8rem]`}
            />
          </div>
          <p className="mb-2.5 text-xs text-slate-500 dark:text-neutral-400">
            One A4 sheet = {(Math.max(Number(sheetColumns) || DEFAULT_COLUMNS, 1)) * ROWS} QR codes (
            {Math.max(Number(sheetColumns) || DEFAULT_COLUMNS, 1)} across × {ROWS} down), oldest-generated
            first, each labeled with its Battery ID. Asking for more spills onto extra sheets in the same PDF.
          </p>
          <div className="ml-auto flex shrink-0 gap-2">
            <button
              type="button"
              onClick={handlePreviewSheet}
              disabled={sheetLoading}
              className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-200 dark:hover:bg-surface-700"
            >
              {sheetLoading ? 'Building sheet…' : 'View Sheet'}
            </button>
            <button
              type="submit"
              disabled={sheetLoading}
              className="rounded-md bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              {sheetLoading ? 'Building sheet…' : 'Download Sheet (PDF)'}
            </button>
          </div>
          {sheetError && <p className="w-full text-sm text-critical-600 dark:text-red-400">{sheetError}</p>}
        </form>

        {rowError && <AlertModal title="Action Failed" message={rowError} onClose={() => setRowError(null)} />}
        {listError && <TableState tone="error">{listError}</TableState>}

        {generatedBatteries.length === 0 && listLoading ? (
          <TableState>Loading…</TableState>
        ) : (
          <>
            <DataTable
              columns={qrColumns}
              rows={generatedBatteries}
              emptyMessage="No QR codes generated yet."
              showRowNumber
              headerColor="blue"
            />
            <InfiniteScrollTrigger hasMore={listHasMore} loading={listLoading} onVisible={loadMoreGenerated} />
          </>
        )}
      </div>

      {/* ── QR viewer modal ─────────────────────────────────────────────────── */}
      {viewingQr && (
        <Modal title={viewingQr.batteryCode} onClose={() => setViewingQr(null)}>
          <div className="flex flex-col items-center">
            <img
              src={viewingQr.dataUrl}
              alt={`QR code for battery ${viewingQr.batteryCode}`}
              className="h-64 w-64 rounded-lg border border-slate-100 dark:border-surface-700"
            />
            {viewingQr.clientName && (
              <p className="mt-4 text-sm text-slate-500 dark:text-neutral-400">Client: {viewingQr.clientName}</p>
            )}
            <p className="mt-1 max-w-xs truncate text-center text-xs text-slate-400 dark:text-neutral-500">
              {viewingQr.detailUrl}
            </p>
            <button
              type="button"
              onClick={() => {
                const link = document.createElement('a');
                link.href = viewingQr.dataUrl;
                link.download = `qr-${viewingQr.batteryCode}.png`;
                link.click();
              }}
              className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
            >
              Download PNG
            </button>
          </div>
        </Modal>
      )}

      {/* ── Battery Number edit modal ────────────────────────────────────────── */}
      {serialTarget && (
        <Modal
          title={`Battery Number — ${serialTarget.battery_code}`}
          onClose={() => { setSerialTarget(null); setSerialError(null); }}
        >
          <div className="flex flex-col gap-4">
            {serialTarget.serial_number && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                {serialTarget.serial_number_added_by_role === 'client' ? (
                  <>
                    <strong>Client-set number:</strong> the client can no longer edit this themselves. Changing it
                    is an admin override — type <strong>CONFIRM</strong> below to unlock Save.
                  </>
                ) : (
                  <>
                    You're changing an existing Battery Number. Type <strong>CONFIRM</strong> below to unlock Save.
                  </>
                )}
              </div>
            )}
            <div>
              <label className={labelClasses}>Battery Number (manufacturer serial)</label>
              <input
                type="text"
                value={serialInput}
                onChange={(e) => setSerialInput(e.target.value)}
                placeholder="e.g. SN-88213"
                autoComplete="off"
                className={formInputClasses}
              />
              <p className="mt-1.5 text-xs text-slate-500 dark:text-neutral-400">
                Leave blank to clear the Battery Number.
              </p>
            </div>
            {serialInput.trim() && (
              <div>
                <label className={labelClasses}>Re-type to Confirm</label>
                <input
                  type="text"
                  value={serialInputRetype}
                  onChange={(e) => setSerialInputRetype(e.target.value)}
                  placeholder="Type the battery number again"
                  autoComplete="off"
                  className={formInputClasses}
                />
                <p className="mt-1.5 text-xs text-slate-500 dark:text-neutral-400">Typed twice to catch typos.</p>
              </div>
            )}
            {serialTarget.serial_number && (
              <div>
                <label className={labelClasses}>
                  Type <span className="font-semibold text-amber-700 dark:text-amber-400">CONFIRM</span> to change it
                </label>
                <input
                  type="text"
                  value={serialConfirmText}
                  onChange={(e) => setSerialConfirmText(e.target.value)}
                  placeholder="CONFIRM"
                  autoComplete="off"
                  className={formInputClasses}
                />
              </div>
            )}
            {serialError && <p className="text-sm text-critical-600 dark:text-red-400">{serialError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setSerialTarget(null); setSerialError(null); }}
                className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-blue-900/30"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSerialSave}
                disabled={
                  serialSaving ||
                  (serialInput.trim() && serialInput.trim() !== serialInputRetype.trim()) ||
                  (serialTarget.serial_number && serialConfirmText.trim().toUpperCase() !== 'CONFIRM')
                }
                className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {serialSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Delete confirm modal ─────────────────────────────────────────────── */}
      {deleteTarget && (
        <ConfirmModal
          title="Delete Battery"
          message={`Delete battery "${deleteTarget.battery_code}"? This can't be undone.`}
          requireTyping={false}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

export default GenerateQrPage;
