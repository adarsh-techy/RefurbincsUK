import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import QRCode from 'qrcode';
import apiClient from '../../../services/api-client';
import PageHeader from '../../../components/ui/primitives/PageHeader';
import useInfiniteList from '../../../utils/use-infinite-list';
import DataTable from '../../../components/ui/table/DataTable';
import TableState from '../../../components/ui/table/TableState';
import InfiniteScrollTrigger from '../../../components/ui/table/InfiniteScrollTrigger';
import Modal from '../../../components/ui/overlays/Modal';
import ConfirmModal from '../../../components/ui/overlays/ConfirmModal';
import AlertModal from '../../../components/ui/overlays/AlertModal';
import RowActions from '../../../components/ui/table/RowActions';
import useFetchList from '../../../utils/use-fetch-list';
import { downloadQrSheet, previewQrSheet, DEFAULT_COLUMNS, ROWS, SHEET_SIZE } from '../../../utils/generate-qr-sheet';

import { FiDownload, FiArrowRight, FiEye, FiPrinter, FiSquare, FiLayers } from 'react-icons/fi';

const BATTERY_NUMBER_DIGITS = 7;

const inputClasses =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-violet-400';
const formInputClasses =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-violet-400';
const labelClasses = 'mb-1 block text-xs font-bold text-slate-700 dark:text-neutral-200';

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
  const fleetClients = useMemo(
    () => (clients || []).filter((c) => c.user_role !== 'recycle_client'),
    [clients]
  );
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
    total: listTotal,
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

  // Each client has its own stored battery-code prefix (clients.battery_prefix);
  // the first three letters of the name are only a fallback.
  const prefixFor = (name) => {
    const trimmed = name.trim();
    if (!trimmed) return '';
    const match = fleetClients.find((c) => c.name.trim().toLowerCase() === trimmed.toLowerCase());
    return match?.battery_prefix || trimmed.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();
  };

  // ── Individual: derived battery ID ────────────────────────────────────────
  // Battery numbers are zero-padded to 7 digits (HUM-0000001), matching the
  // backend's bulk generation.
  const clientPrefix = prefixFor(clientName);
  const computedBatteryId = clientPrefix ? `${clientPrefix}-${String(suggestedNumber).padStart(BATTERY_NUMBER_DIGITS, '0')}` : '';

  // ── Bulk: preview range ────────────────────────────────────────────────────
  const bulkStart = Number(bulkStartNumber) > 0 ? Number(bulkStartNumber) : bulkSuggestedStart;
  const bulkEnd = bulkStart + (Math.max(Number(bulkCount) || 1, 1)) - 1;
  const bulkPrefix = prefixFor(bulkClientName);
  const padLen = Math.max(BATTERY_NUMBER_DIGITS, String(bulkEnd).length);
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
    <div className="space-y-4 pb-12 w-full max-w-full">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-base sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Generate QR Code
            </h1>
            <span className="rounded-full bg-violet-100 dark:bg-violet-950/60 px-2 py-0.2 text-[9px] sm:text-[10px] font-bold text-violet-700 dark:text-violet-300">
              Asset Identifiers
            </span>
          </div>
          <p className="mt-0.5 text-[10.5px] sm:text-xs text-slate-500 dark:text-slate-400">
            Create QR codes for batteries — scan one to open its full history
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <Link
            to="/rfid-assignment"
            className="inline-flex h-7 sm:h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 sm:px-2.5 text-[10px] sm:text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-white/10 dark:bg-surface-800 dark:text-slate-200 cursor-pointer"
          >
            <span>RFID Assignment</span>
            <FiArrowRight className="h-3 w-3" />
          </Link>
          <div className="inline-flex h-7 sm:h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[10.5px] sm:text-xs font-bold text-slate-700 shadow-2xs dark:border-white/10 dark:bg-surface-800 dark:text-slate-200">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Total: <strong className="text-slate-900 dark:text-white">{(listTotal || 0).toLocaleString()}</strong></span>
          </div>
        </div>
      </div>

      {/* ── Tab switcher ───────────────────────────────────────────────────── */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-0.5 dark:bg-surface-800/80 max-w-xs sm:max-w-sm">
        <button
          type="button"
          onClick={() => { setActiveTab('individual'); setError(null); setQrResult(null); }}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'individual'
              ? 'bg-white shadow-2xs text-violet-700 dark:bg-surface-900 dark:text-violet-300'
              : 'text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white'
          }`}
        >
          <FiSquare className="h-3.5 w-3.5" />
          Individual QR
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('bulk'); setBulkError(null); setBulkResult(null); }}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'bulk'
              ? 'bg-white shadow-2xs text-violet-700 dark:bg-surface-900 dark:text-violet-300'
              : 'text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white'
          }`}
        >
          <FiLayers className="h-3.5 w-3.5" />
          Bulk Generation
        </button>
      </div>

      {/* ── Individual tab ─────────────────────────────────────────────────── */}
      {activeTab === 'individual' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-3.5 rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4.5 shadow-2xs dark:border-white/10 dark:bg-surface-900"
          >
            <div>
              <label className={labelClasses}>
                Battery Number <span className="text-[10.5px] font-normal text-slate-400 dark:text-neutral-500">(optional)</span>
              </label>
              <input
                type="text"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="e.g. SN-88213 (printed on battery)"
                autoComplete="off"
                className={formInputClasses}
              />
              <p className="mt-1 text-[10.5px] text-slate-500 dark:text-neutral-400">
                The manufacturer's serial number physically printed on the battery.
              </p>
            </div>

            <div>
              <label className={labelClasses}>Client <span className="text-rose-500">*</span></label>
              <select
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className={formInputClasses}
                required
              >
                <option value="">Select a client</option>
                {fleetClients.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClasses}>Battery ID</label>
              <input
                type="text"
                value={computedBatteryId}
                readOnly
                placeholder="Select a client to auto-generate"
                className={`${formInputClasses} cursor-not-allowed font-mono opacity-80`}
              />
              <p className="mt-1 text-[10.5px] text-slate-500 dark:text-neutral-400">
                Automatically generated from the client name. The QR code links to this ID.
              </p>
            </div>

            {error && <p className="text-xs font-bold text-rose-600 dark:text-rose-400">{error}</p>}

            <div className="flex justify-end gap-1.5 pt-2 border-t border-slate-100 dark:border-white/5">
              <button
                type="button"
                onClick={handleReset}
                className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-300 cursor-pointer"
              >
                Reset
              </button>
              <button
                type="submit"
                disabled={submitting || !clientName.trim()}
                className="inline-flex h-8 items-center justify-center rounded-lg bg-violet-700 hover:bg-violet-800 px-3.5 text-xs font-bold text-white shadow-xs disabled:cursor-not-allowed disabled:opacity-50 transition-all cursor-pointer"
              >
                {submitting ? 'Generating…' : 'Generate QR Code'}
              </button>
            </div>
          </form>

          <div className="flex flex-col items-center justify-center rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs dark:border-white/10 dark:bg-surface-900">
            {qrResult ? (
              <div className="flex flex-col items-center text-center">
                <img
                  src={qrResult.dataUrl}
                  alt={`QR code for battery ${qrResult.batteryCode}`}
                  className="h-48 w-48 sm:h-56 sm:w-56 rounded-xl border border-slate-100 p-2 shadow-2xs dark:border-white/10"
                />
                <p className="mt-2.5 font-mono text-sm font-black text-slate-900 dark:text-white">{qrResult.batteryCode}</p>
                {qrResult.clientName && (
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-neutral-400">Client: {qrResult.clientName}</p>
                )}
                <p className="mt-0.5 max-w-xs truncate text-[10px] text-slate-400">
                  {qrResult.detailUrl}
                </p>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg bg-violet-700 hover:bg-violet-800 px-3.5 text-xs font-bold text-white shadow-xs transition-all cursor-pointer"
                >
                  <FiDownload className="h-3.5 w-3.5" />
                  <span>Download PNG</span>
                </button>
              </div>
            ) : (
              <p className="text-center text-xs text-slate-400 dark:text-neutral-500 py-8">
                Select a client and generate its QR code to preview it here.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Bulk tab ───────────────────────────────────────────────────────── */}
      {activeTab === 'bulk' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <form
            onSubmit={handleBulkSubmit}
            className="flex flex-col gap-3.5 rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4.5 shadow-2xs dark:border-white/10 dark:bg-surface-900"
          >
            <div>
              <label className={labelClasses}>Client <span className="text-rose-500">*</span></label>
              <select
                value={bulkClientName}
                onChange={(e) => setBulkClientName(e.target.value)}
                className={formInputClasses}
                required
              >
                <option value="">Select a client</option>
                {fleetClients.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClasses}>
                Starting Number
                {bulkClientName ? (
                  <span className="ml-1.5 text-[10.5px] font-normal text-slate-400">
                    (next: {bulkSuggestedStart})
                  </span>
                ) : (
                  <span className="ml-1.5 text-[10.5px] font-normal text-slate-400">
                    (Select client first)
                  </span>
                )}
              </label>
              <input
                type="number"
                min="1"
                disabled={!bulkClientName.trim()}
                value={bulkStartNumber}
                onChange={(e) => setBulkStartNumber(e.target.value)}
                placeholder={bulkClientName.trim() ? String(bulkSuggestedStart) : 'Select a client first'}
                className={`${formInputClasses} [appearance:textfield] disabled:cursor-not-allowed disabled:opacity-50`}
              />
              <p className="mt-1 text-[10.5px] text-slate-500 dark:text-neutral-400">
                Leave blank to auto-continue from the last generated number.
              </p>
            </div>

            <div>
              <label className={labelClasses}>How many QR Codes</label>
              {/* Quick presets */}
              <div className="mb-1.5 flex flex-wrap gap-1">
                {BULK_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    disabled={!bulkClientName.trim()}
                    onClick={() => setBulkCount(String(preset))}
                    className={`rounded-md border px-2 py-0.5 text-[11px] font-bold transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${
                      bulkCount === String(preset) && bulkClientName.trim()
                        ? 'border-violet-500 bg-violet-50 text-violet-700 dark:border-violet-400 dark:bg-violet-950/40 dark:text-violet-300'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-300'
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
                disabled={!bulkClientName.trim()}
                value={bulkCount}
                onChange={(e) => setBulkCount(e.target.value)}
                placeholder={bulkClientName.trim() ? 'e.g. 500' : 'Select client first'}
                className={`${formInputClasses} [appearance:textfield] disabled:cursor-not-allowed disabled:opacity-50`}
                required
              />
            </div>

            {bulkError && <p className="text-xs font-bold text-rose-600 dark:text-rose-400">{bulkError}</p>}

            <div className="flex justify-end gap-1.5 pt-2 border-t border-slate-100 dark:border-white/5">
              <button
                type="button"
                onClick={handleBulkReset}
                className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-300 cursor-pointer"
              >
                Reset
              </button>
              <button
                type="submit"
                disabled={bulkSubmitting || !bulkClientName.trim()}
                className="inline-flex h-8 items-center justify-center rounded-lg bg-violet-700 hover:bg-violet-800 px-3.5 text-xs font-bold text-white shadow-xs disabled:cursor-not-allowed disabled:opacity-50 transition-all cursor-pointer"
              >
                {bulkSubmitting ? 'Generating…' : 'Generate Bulk QR Codes'}
              </button>
            </div>
          </form>

          {/* ── Bulk preview card ────────────────────────────────────────── */}
          <div className="flex flex-col justify-center rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs dark:border-white/10 dark:bg-surface-900">
            {bulkResult ? (
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/60">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 text-emerald-600 dark:text-emerald-400">
                    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    {bulkResult.count?.toLocaleString()} QR Codes Generated!
                  </p>
                  <p className="text-xs text-slate-500">
                    Client: <span className="font-semibold text-slate-800 dark:text-neutral-200">{bulkResult.clientName}</span>
                  </p>
                </div>
                <div className="w-full rounded-xl border border-slate-200/80 bg-slate-50 p-2.5 dark:border-white/10 dark:bg-surface-850">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">First ID</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{bulkResult.firstCode}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Last ID</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{bulkResult.lastCode}</span>
                  </div>
                </div>
                <p className="text-center text-[10.5px] text-slate-400">
                  Battery Numbers can be assigned later by Admin or Client.
                </p>
              </div>
            ) : (
              <>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-neutral-400 mb-2">Range Preview</h3>
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-white/10 dark:bg-surface-850">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Client</span>
                    <span className="font-semibold text-slate-800 dark:text-neutral-100">
                      {bulkClientName || <span className="text-slate-400">Not selected</span>}
                    </span>
                  </div>
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Count</span>
                    <span className="font-semibold text-slate-800 dark:text-neutral-100">
                      {bulkClientName.trim() && Number(bulkCount) > 0 ? Number(bulkCount).toLocaleString() : '—'}
                    </span>
                  </div>
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="text-slate-500">First ID</span>
                    <span className="font-mono font-bold text-violet-700 dark:text-violet-300">{bulkClientName.trim() ? bulkFirstPreview : '—'}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Last ID</span>
                    <span className="font-mono font-bold text-violet-700 dark:text-violet-300">{bulkClientName.trim() ? bulkLastPreview : '—'}</span>
                  </div>
                </div>
                <p className="mt-2 text-[10.5px] text-slate-400">
                  {bulkClientName.trim()
                    ? `All ${Number(bulkCount) > 0 ? Number(bulkCount).toLocaleString() : '…'} batteries will be created instantly.`
                    : 'Select a client to configure quantity and preview generated IDs.'}
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Generated QR Codes list ─────────────────────────────────────────── */}
      <div className="mt-6">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xs sm:text-sm font-black tracking-tight text-slate-900 dark:text-white uppercase">
              Generated QR Codes
            </h2>
            <span className="rounded-full bg-slate-100 text-slate-700 dark:bg-surface-800 dark:text-neutral-300 px-2 py-0.5 text-[10px] font-bold">
              {(listTotal || 0).toLocaleString()}
            </span>
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-56">
              <input
                type="text"
                value={listSearchInput}
                onChange={(e) => setListSearchInput(e.target.value)}
                placeholder="Search battery or client…"
                className="h-8 w-full rounded-lg border border-slate-300 bg-white pl-2.5 pr-6 text-xs font-semibold text-slate-900 shadow-2xs placeholder:text-slate-400 placeholder:font-normal focus:border-violet-500 focus:outline-none dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-100"
              />
              {listSearchInput && (
                <button
                  type="button"
                  onClick={() => { setListSearchInput(''); setListSearch(''); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
            <select
              value={listClientFilter}
              onChange={(e) => setListClientFilter(e.target.value)}
              className="h-8 max-w-[130px] rounded-lg border border-slate-300 bg-white px-2 text-[11px] font-semibold text-slate-900 shadow-2xs focus:border-violet-500 focus:outline-none dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-100 cursor-pointer shrink-0 truncate"
            >
              <option value="">All Clients ({fleetClients.length})</option>
              {fleetClients.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
            {isSuperAdmin && (
              <label className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-neutral-300 cursor-pointer ml-1">
                <input
                  type="checkbox"
                  checked={showBlocked}
                  onChange={(e) => setShowBlocked(e.target.checked)}
                  className="rounded border-slate-300 text-violet-600 focus:ring-violet-500/20"
                />
                <span className="hidden sm:inline">Blocked</span>
              </label>
            )}
          </div>
        </div>

        {/* ── Print Sheet form ───────────────────────────────────────────── */}
        <form
          onSubmit={handleDownloadSheet}
          className="mb-3.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/90 bg-slate-50/70 p-2.5 sm:p-3 dark:border-white/10 dark:bg-surface-850/60"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-slate-700 dark:text-neutral-300 flex items-center gap-1">
              <FiPrinter className="h-3.5 w-3.5 text-slate-500" />
              <span>Print Sheet (A4):</span>
            </span>
            <div className="flex items-center gap-1 text-[10.5px] text-slate-600 dark:text-neutral-400">
              <span>From #</span>
              <input
                type="number"
                min="1"
                value={sheetStart}
                onChange={(e) => setSheetStart(e.target.value)}
                className="h-7 w-16 rounded-md border border-slate-300 bg-white px-1.5 text-xs font-semibold text-slate-900 focus:border-violet-500 focus:outline-none dark:border-surface-600 dark:bg-surface-800 dark:text-white"
              />
            </div>
            <div className="flex items-center gap-1 text-[10.5px] text-slate-600 dark:text-neutral-400">
              <span>Count</span>
              <input
                type="number"
                min="1"
                value={sheetCount}
                onChange={(e) => setSheetCount(e.target.value)}
                className="h-7 w-16 rounded-md border border-slate-300 bg-white px-1.5 text-xs font-semibold text-slate-900 focus:border-violet-500 focus:outline-none dark:border-surface-600 dark:bg-surface-800 dark:text-white"
              />
            </div>
            <div className="flex items-center gap-1 text-[10.5px] text-slate-600 dark:text-neutral-400">
              <span>Cols</span>
              <input
                type="number"
                min="1"
                value={sheetColumns}
                onChange={(e) => setSheetColumns(e.target.value)}
                className="h-7 w-12 rounded-md border border-slate-300 bg-white px-1.5 text-xs font-semibold text-slate-900 focus:border-violet-500 focus:outline-none dark:border-surface-600 dark:bg-surface-800 dark:text-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <button
              type="button"
              onClick={handlePreviewSheet}
              disabled={sheetLoading}
              className="inline-flex h-7 items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-[10.5px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 cursor-pointer"
            >
              {sheetLoading ? 'Building…' : 'View Sheet'}
            </button>
            <button
              type="submit"
              disabled={sheetLoading}
              className="inline-flex h-7 items-center justify-center rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 text-[10.5px] font-bold text-white shadow-2xs disabled:opacity-50 transition-all cursor-pointer"
            >
              {sheetLoading ? 'Building…' : 'Download PDF'}
            </button>
          </div>
          {sheetError && <p className="w-full text-xs font-semibold text-rose-600 dark:text-rose-400">{sheetError}</p>}
        </form>

        {rowError && <AlertModal title="Action Failed" message={rowError} onClose={() => setRowError(null)} />}
        {listError && <TableState tone="error">{listError}</TableState>}

        <div className="mb-2 flex items-center justify-between px-1 text-[11px] font-medium text-slate-500 dark:text-neutral-400">
          <div>
            Showing <span className="font-bold text-slate-800 dark:text-neutral-200">{generatedBatteries.length}</span> of{' '}
            <span className="font-bold text-slate-800 dark:text-neutral-200">{(listTotal || 0).toLocaleString()}</span>{' '}
            {listTotal === 1 ? 'battery QR code' : 'battery QR codes'}
            {(listSearch || listClientFilter) ? ' (filtered)' : ''}
          </div>
        </div>

        {generatedBatteries.length === 0 && listLoading ? (
          <TableState>Loading…</TableState>
        ) : (
          <>
            {/* Desktop Table (>= lg) */}
            <div className="hidden lg:block overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs dark:border-white/10 dark:bg-surface-900">
              <DataTable
                columns={qrColumns}
                rows={generatedBatteries}
                emptyMessage="No QR codes generated yet."
                showRowNumber
                headerColor="blue"
                maxHeight="calc(100vh - 270px)"
                onScrollBottom={listHasMore && !listLoading ? loadMoreGenerated : null}
              />
            </div>

            {/* Mobile Card Stream (< lg) - ZERO HORIZONTAL SCROLL */}
            <div className="block lg:hidden max-h-[60vh] overflow-y-auto divide-y divide-slate-100 dark:divide-white/5 p-1">
              {generatedBatteries.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">No QR codes generated yet.</p>
              ) : (
                generatedBatteries.map((r, idx) => (
                  <div
                    key={r.id}
                    className={`p-2.5 mb-1.5 rounded-xl border transition-all ${
                      r.is_blocked
                        ? 'border-rose-200 bg-rose-50/50 dark:border-rose-900/40 dark:bg-rose-950/20'
                        : 'border-slate-200/80 bg-white dark:border-white/10 dark:bg-surface-850'
                    }`}
                  >
                    {/* Header Row */}
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono text-[10px] font-bold text-slate-400">#{idx + 1}</span>
                        <Link
                          to={`/batteries/${encodeURIComponent(r.battery_code)}`}
                          className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline truncate"
                        >
                          🔋 {r.battery_code}
                        </Link>
                        {r.is_blocked && (
                          <span className="shrink-0 rounded-full bg-rose-100 px-1.5 py-0.2 text-[9px] font-bold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                            Blocked
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium shrink-0">
                        {r.qr_generated_at ? new Date(r.qr_generated_at).toLocaleDateString() : ''}
                      </span>
                    </div>

                    {/* Client & Battery Serial Row */}
                    <div className="mt-1 flex items-center justify-between gap-2 text-[10.5px]">
                      <div className="text-slate-500 dark:text-neutral-400 truncate">
                        Client: <span className="font-semibold text-slate-800 dark:text-neutral-200">{r.client_name || '—'}</span>
                      </div>
                      <div className="shrink-0">
                        {renderSerialCell(r)}
                      </div>
                    </div>

                    {/* Action Buttons Row */}
                    <div className="mt-2 flex items-center justify-end gap-1.5 border-t border-slate-100 dark:border-white/5 pt-1.5">
                      <button
                        type="button"
                        onClick={() => handleViewRow(r)}
                        className="inline-flex h-6.5 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[10px] font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-surface-800 dark:text-slate-200 cursor-pointer"
                      >
                        <FiEye className="h-3 w-3" />
                        <span>View</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadRow(r)}
                        className="inline-flex h-6.5 items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2 text-[10px] font-bold text-violet-700 hover:bg-violet-100 dark:border-violet-800/40 dark:bg-violet-950/40 dark:text-violet-300 cursor-pointer"
                      >
                        <FiDownload className="h-3 w-3" />
                        <span>Download</span>
                      </button>
                      {isSuperAdmin && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleToggleBlock(r)}
                            className="inline-flex h-6.5 items-center rounded-md border border-amber-200 bg-amber-50 px-1.5 text-[10px] font-bold text-amber-800 hover:bg-amber-100 dark:border-amber-800/40 dark:bg-amber-950/40 dark:text-amber-300 cursor-pointer"
                          >
                            {r.is_blocked ? 'Unblock' : 'Block'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(r)}
                            className="inline-flex h-6.5 items-center rounded-md border border-rose-200 bg-rose-50 px-1.5 text-[10px] font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-800/40 dark:bg-rose-950/40 dark:text-rose-300 cursor-pointer"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

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
