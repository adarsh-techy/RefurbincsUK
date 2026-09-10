import { useEffect, useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import apiClient from '../../services/api-client';
import DataTable from '../../components/ui/DataTable';
import TableState from '../../components/ui/TableState';
import InfiniteScrollTrigger from '../../components/ui/InfiniteScrollTrigger';
import { ClientStatusBadge } from '../../components/ui/Badge';
import { loadSortGroups } from '../../utils/sort-groups';
import Modal from '../../components/ui/Modal';
import QrScanner from '../../components/ui/QrScanner';
import extractBatteryCode from '../../utils/extract-battery-code';
import { useTheme } from '../../context/ThemeContext';
import { hasClientPermission } from '../../utils/permissions';
import ClientReturnVerifyModal from './ClientReturnVerifyModal';
import RatingModal from '../../components/feedback/RatingModal';

const formInputClasses =
  'w-full rounded-md border border-blue-300 bg-blue-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 dark:border-blue-800/40 dark:bg-blue-900/20 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/30';
const labelClasses = 'mb-1.5 block text-sm font-medium text-slate-700 dark:text-neutral-200';

const BUCKET_META = {
  all: {
    title: 'All Batteries',
    description: 'Complete inventory of your registered battery fleet across all service stages.',
    empty: 'No batteries registered in your fleet.',
  },
  packed: {
    title: 'Battery Packed to Repair',
    description: 'Batteries delivered and logged by truck for workshop repair.',
    empty: 'No truck intake batches found.',
  },
  pending: {
    title: 'In Service & Testing',
    description: 'Batteries currently undergoing cell diagnostics, repair, or cycle testing.',
    empty: 'No batteries in service right now.',
  },
  received: {
    title: 'Battery Received',
    description: 'Batteries restored and returned back to your operational fleet.',
    empty: 'No batteries have been returned to you yet.',
  },
};

function formatDate(val) {
  if (!val) return '—';
  return new Date(val).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toLocalDateValue(value) {
  if (!value) return '';
  const dt = new Date(value);
  const offset = dt.getTimezoneOffset();
  return new Date(dt.getTime() - offset * 60000).toISOString().slice(0, 10);
}

// A battery is registered with status 'returned' from day one — it means
// "currently with the client", not "came back from a service visit" — so a
// battery that has never actually been through truck intake, repair, or a
// return dispatch shouldn't show a "Returned" badge; it's simply never been
// serviced yet.
function hasBeenServiced(row) {
  return Boolean(row.truck_intake_id || row.intake_id || row.last_repaired_at || row.return_id);
}

function ClientBatteriesPage() {
  const { bucket } = useParams();
  const effectiveBucket = bucket || 'all';
  const meta = BUCKET_META[effectiveBucket] || BUCKET_META.all;
  const { customTheme } = useTheme();
  const accent = customTheme?.accentColor || '#10b981';
  const { user } = useSelector((state) => state.auth);

  const [data, setData] = useState([]);
  const [allRegisteredBatteries, setAllRegisteredBatteries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Default view is 'batch_table' (Admin-style Table View), with toggle to 'cards'
  const [viewMode, setViewMode] = useState('batch_table');

  // Rating feedback modal state
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingBatteryCode, setRatingBatteryCode] = useState('');

  // Search, date, and status filters
  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Lazy loading on scroll for All Batteries (20 per page/scroll)
  const [visibleCount, setVisibleCount] = useState(20);

  useEffect(() => {
    setVisibleCount(20);
  }, [effectiveBucket, search, date, statusFilter]);

  // Selected Truck Batch for Dedicated Detail Page (NOT a popup!)
  const [activeBatchKey, setActiveBatchKey] = useState(null);
  const [batchSearch, setBatchSearch] = useState('');

  // Battery Number assign modal state
  const [serialTarget, setSerialTarget] = useState(null);
  const [serialInput, setSerialInput] = useState('');
  const [serialConfirmInput, setSerialConfirmInput] = useState('');
  const [serialSaving, setSerialSaving] = useState(false);
  const [serialError, setSerialError] = useState(null);

  // ── Admin-Style Intake Form Modal State ──────────────────────────────
  const [packModalOpen, setPackModalOpen] = useState(false);
  const [truckNumber, setTruckNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [scanInput, setScanInput] = useState('');
  const [scannedBatteries, setScannedBatteries] = useState([]);
  const [showScanSuggestions, setShowScanSuggestions] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [packing, setPacking] = useState(false);
  const [packError, setPackError] = useState(null);
  const [packSuccess, setPackSuccess] = useState(null);

  // "Pick from Sort" — reviewing a previously-built Battery Sorting group
  // and choosing which of its batteries to add to this intake, instead of
  // re-scanning every code by hand. Two steps: pick a group, then review /
  // deselect its batteries before anything is actually added to the form.
  const [pickSortOpen, setPickSortOpen] = useState(false);
  const [pickSortStep, setPickSortStep] = useState('groups'); // 'groups' | 'review'
  const [sortGroups, setSortGroups] = useState([]);
  const [pickSortGroup, setPickSortGroup] = useState(null);
  const [pickSortSelected, setPickSortSelected] = useState(new Set());

  // Return shipment verification modal state
  const [verifyTargetReturn, setVerifyTargetReturn] = useState(null);

  function loadData() {
    setLoading(true);
    setError(null);
    apiClient
      .get('/clients/me/batteries', { params: effectiveBucket === 'all' ? {} : { bucket: effectiveBucket } })
      .then(({ data: result }) => {
        setData(result.data || []);
      })
      .catch((err) => {
        setError(err.response?.data?.message || err.message);
      })
      .finally(() => {
        setLoading(false);
      });

    // Also fetch all client's registered batteries for suggestions in scan input
    apiClient
      .get('/clients/me/batteries')
      .then(({ data: result }) => {
        setAllRegisteredBatteries(result.data || []);
      })
      .catch(() => {
        // non-blocking fallback
      });
  }

  useEffect(() => {
    loadData();
    setActiveBatchKey(null);
    setSearch('');
    setDate('');
    setStatusFilter('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveBucket]);

  // Group batteries by Truck Intake Batch
  const rawBatches = useMemo(() => {
    if (!data || data.length === 0) return [];
    const groupMap = new Map();

    data.forEach((item) => {
      const isReceived = effectiveBucket === 'received';
      const key = isReceived
        ? item.return_id
          ? `return_${item.return_id}`
          : item.return_truck
            ? `return_trk_${item.return_truck}`
            : 'returned_batch'
        : item.intake_id
          ? `truck_${item.intake_id}`
          : item.truck_number
            ? `truck_num_${item.truck_number}`
            : 'awaiting_pickup';

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          id: key,
          key,
          intakeId: isReceived ? item.return_id : item.intake_id,
          returnId: item.return_id || null,
          truckNumber: isReceived ? (item.return_truck || 'Return Dispatch') : (item.truck_number || null),
          driverName: isReceived ? (item.return_driver || 'Workshop Driver') : (item.driver_name || null),
          intakeAt: isReceived ? (item.return_date || item.last_repaired_at || item.created_at) : (item.intake_at || item.created_at),
          intakeStatus: isReceived ? (item.return_status || 'verified') : (item.intake_status || 'pending_arrival'),
          verifiedAt: isReceived ? (item.return_verified_at || null) : (item.verified_at || null),
          isAwaitingPickup: !isReceived && !item.truck_number && !item.intake_id,
          isReturnDispatch: isReceived,
          batteries: [],
        });
      }
      groupMap.get(key).batteries.push(item);
    });

    return Array.from(groupMap.values()).sort(
      (a, b) => new Date(b.intakeAt || 0) - new Date(a.intakeAt || 0)
    );
  }, [data, effectiveBucket]);

  // Existing truck numbers for suggestions datalist
  const existingTruckNumbers = useMemo(() => {
    return Array.from(
      new Set(rawBatches.map((b) => b.truckNumber).filter(Boolean))
    );
  }, [rawBatches]);

  // Filtered Batches based on Search and Date
  const batches = useMemo(() => {
    return rawBatches.filter((batch) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        (batch.driverName && batch.driverName.toLowerCase().includes(q)) ||
        (batch.truckNumber && batch.truckNumber.toLowerCase().includes(q)) ||
        (batch.isAwaitingPickup && 'client packed batch'.includes(q));
      const matchesDate = !date || toLocalDateValue(batch.intakeAt) === date;
      return matchesSearch && matchesDate;
    });
  }, [rawBatches, search, date]);

  // Available client battery suggestions for "Scan Batteries (returning)"
  const scannedCodes = useMemo(
    () => new Set(scannedBatteries.map((b) => b.code.toUpperCase())),
    [scannedBatteries]
  );

  // Exclude batteries that are already in the repair pipeline or unserviceable
  const NOT_RETURNABLE_STATUSES = useMemo(
    () => new Set(['in_repair', 'in_progress', 'in_testing', 'repaired', 'unserviceable']),
    []
  );

  const scanSuggestions = useMemo(() => {
    const q = scanInput.trim().toLowerCase();
    return allRegisteredBatteries
      .filter((b) => !scannedCodes.has(b.battery_code.toUpperCase()))
      .filter((b) => !NOT_RETURNABLE_STATUSES.has(b.status))
      .filter((b) => {
        if (!q) return true;
        return (
          b.battery_code.toLowerCase().includes(q) ||
          (b.serial_number && b.serial_number.toLowerCase().includes(q))
        );
      })
      .slice(0, 8);
  }, [allRegisteredBatteries, scannedCodes, scanInput, NOT_RETURNABLE_STATUSES]);

  // Active Selected Batch Object for Detail Page
  const selectedBatch = useMemo(() => {
    if (!activeBatchKey) return null;
    return rawBatches.find((b) => b.key === activeBatchKey) || null;
  }, [rawBatches, activeBatchKey]);

  function openSerialModal(row) {
    setSerialTarget(row);
    setSerialInput(row.serial_number || '');
    setSerialConfirmInput(row.serial_number || '');
    setSerialError(null);
  }

  async function handleSerialSave() {
    if (serialInput.trim() !== serialConfirmInput.trim()) {
      setSerialError('The two battery numbers you typed don’t match. Please re-check and try again.');
      return;
    }
    setSerialSaving(true);
    setSerialError(null);
    try {
      await apiClient.patch(`/batteries/${serialTarget.id}/serial-number`, {
        serialNumber: serialInput.trim(),
      });
      setSerialTarget(null);
      loadData();
    } catch (err) {
      setSerialError(err.response?.data?.message || err.message);
    } finally {
      setSerialSaving(false);
    }
  }

  // Handle adding scanned/typed battery to form list
  function handleAddBattery(rawCode, initialSerial = '') {
    const code = (extractBatteryCode(rawCode) || rawCode || '').trim().toUpperCase();
    if (!code) return;

    if (scannedBatteries.some((b) => b.code.toUpperCase() === code)) {
      setPackError(`Battery ${code} has already been added to this intake list.`);
      return;
    }

    const existing = allRegisteredBatteries.find(
      (b) => b.battery_code.toUpperCase() === code
    );
    if (existing) {
      if (['in_repair', 'in_progress', 'in_testing', 'repaired'].includes(existing.status)) {
        setPackError(`Battery ${code} is already in the repair pipeline (${existing.status.replace('_', ' ')}).`);
        return;
      }
      if (existing.status === 'unserviceable') {
        setPackError(`Battery ${code} has been marked as unserviceable.`);
        return;
      }
    }

    setScannedBatteries((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        code,
        serial: initialSerial || (existing ? existing.serial_number : '') || '',
        issue: '',
      },
    ]);
    setScanInput('');
    setPackError(null);
  }

  function handleScanKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddBattery(scanInput);
    }
  }

  function removeScanned(idx) {
    setScannedBatteries((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateScannedField(idx, field, val) {
    setScannedBatteries((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: val } : item))
    );
  }

  function openPickFromSort() {
    setSortGroups(loadSortGroups(user?.id));
    setPickSortStep('groups');
    setPickSortGroup(null);
    setPickSortOpen(true);
  }

  // A sort-group battery is already packed when it's already been added to
  // this intake list, or when its current status shows it's already in the
  // repair pipeline (or unserviceable) — same rule the scan-suggestions box
  // uses, so a battery someone already packed doesn't get offered again.
  function isAlreadyPacked(code) {
    if (scannedCodes.has(code.toUpperCase())) return true;
    const match = allRegisteredBatteries.find((b) => b.battery_code.toUpperCase() === code.toUpperCase());
    return match ? NOT_RETURNABLE_STATUSES.has(match.status) : false;
  }

  const pickSortAvailableCodes = useMemo(() => {
    if (!pickSortGroup) return [];
    return pickSortGroup.batteries.filter((code) => !isAlreadyPacked(code));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickSortGroup, scannedCodes, allRegisteredBatteries]);

  function reviewSortGroup(group) {
    setPickSortGroup(group);
    const available = group.batteries.filter((code) => !isAlreadyPacked(code));
    setPickSortSelected(new Set(available));
    setPickSortStep('review');
  }

  function togglePickSortBattery(code) {
    setPickSortSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function confirmPickSortSelection() {
    pickSortSelected.forEach((code) => handleAddBattery(code));
    setPickSortOpen(false);
    setPickSortGroup(null);
  }

  // Handle Submission of Admin-style Intake Form
  async function handlePackSubmit(e) {
    e.preventDefault();
    if (scannedBatteries.length === 0 && !scanInput.trim()) {
      setPackError('Please scan or add at least one battery to intake.');
      return;
    }

    let finalBatteries = [...scannedBatteries];
    if (scanInput.trim()) {
      const code = (extractBatteryCode(scanInput) || scanInput).trim().toUpperCase();
      if (code && !finalBatteries.some((b) => b.code === code)) {
        finalBatteries.push({ id: Date.now(), code, serial: '', issue: '' });
      }
    }

    setPacking(true);
    setPackError(null);
    try {
      const res = await apiClient.post('/clients/me/batteries/pack-to-repair', {
        truckNumber: truckNumber.trim() || undefined,
        driverName: driverName.trim() || undefined,
        batteries: finalBatteries.map((b) => ({
          batteryCode: b.code,
          serialNumber: b.serial.trim() || undefined,
          issueDescription: b.issue.trim() || undefined,
        })),
      });

      setPackSuccess(
        res.data?.message || `${finalBatteries.length} batteries recorded for repair intake!`
      );
      setTruckNumber('');
      setDriverName('');
      setScanInput('');
      setScannedBatteries([]);
      loadData();
      setTimeout(() => {
        setPackModalOpen(false);
        setPackSuccess(null);
      }, 1200);
    } catch (err) {
      setPackError(err.response?.data?.message || err.message);
    } finally {
      setPacking(false);
    }
  }

  if (!meta) {
    return <TableState tone="error">Unknown battery list.</TableState>;
  }

  // Filtered batteries in detail page
  const detailBatteries = useMemo(() => {
    if (!selectedBatch) return [];
    if (!batchSearch.trim()) return selectedBatch.batteries;
    const q = batchSearch.toLowerCase();
    return selectedBatch.batteries.filter(
      (b) =>
        b.battery_code.toLowerCase().includes(q) ||
        (b.serial_number && b.serial_number.toLowerCase().includes(q)) ||
        (b.notes && b.notes.toLowerCase().includes(q))
    );
  }, [selectedBatch, batchSearch]);

  // Detail Page Columns
  const detailTableColumns = [
    {
      key: 'battery_code',
      label: 'Battery ID',
      render: (row) => (
        <Link
          to={`/batteries/${encodeURIComponent(row.battery_code)}`}
          className="font-mono font-bold text-emerald-700 hover:underline dark:text-emerald-400"
        >
          {row.battery_code}
        </Link>
      ),
    },
    {
      key: 'serial_number',
      label: 'Physical Serial Number',
      render: (row) => {
        if (!row.serial_number) {
          return (
            <button
              type="button"
              onClick={() => openSerialModal(row)}
              className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" />
              </svg>
              + Add Serial
            </button>
          );
        }
        return (
          <span className="font-semibold text-slate-800 dark:text-neutral-100">{row.serial_number}</span>
        );
      },
    },
    { key: 'status', label: 'Status', render: (row) => <ClientStatusBadge status={row.status} /> },
    {
      key: 'notes',
      label: 'Defect Notes',
      render: (row) => (
        <span className="text-xs text-slate-600 dark:text-neutral-300">
          {row.notes || '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Lifecycle History',
      render: (row) => (
        <Link
          to={`/batteries/${encodeURIComponent(row.battery_code)}`}
          className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:bg-emerald-600 hover:text-white dark:bg-white/10 dark:text-neutral-200 dark:hover:bg-emerald-600"
        >
          <span>View History</span>
          <span>→</span>
        </Link>
      ),
    },
  ];

  // Admin-Matched Global Fleet Table Columns for "All Batteries" Page
  const globalFleetTableColumns = [
    {
      key: 'battery_code',
      label: 'Battery ID',
      sortValue: (row) => row.battery_code,
      render: (row) => (
        <Link
          to={`/batteries/${encodeURIComponent(row.battery_code)}`}
          className="font-medium text-blue-700 hover:underline dark:text-blue-400 font-mono"
        >
          {row.battery_code}
        </Link>
      ),
    },
    {
      key: 'serial_number',
      label: 'Physical Serial Number',
      render: (row) => {
        if (!row.serial_number) {
          return (
            <button
              type="button"
              onClick={() => openSerialModal(row)}
              className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" />
              </svg>
              + Add Serial
            </button>
          );
        }
        return (
          <span className="font-semibold text-slate-800 dark:text-neutral-100">{row.serial_number}</span>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      sortValue: (row) => (hasBeenServiced(row) ? row.status || 'registered' : ''),
      render: (row) =>
        hasBeenServiced(row) ? (
          <ClientStatusBadge status={row.status} />
        ) : (
          <span className="text-xs text-slate-400 dark:text-neutral-500">—</span>
        ),
    },
    {
      key: 'created_at',
      label: 'Registered Time',
      sortValue: (row) => (row.created_at ? new Date(row.created_at).getTime() : 0),
      render: (row) => new Date(row.created_at).toLocaleString(),
    },
    {
      key: 'last_repaired_at',
      label: 'Previous Repair Date',
      sortValue: (row) => (row.last_repaired_at ? new Date(row.last_repaired_at).getTime() : 0),
      render: (row) =>
        row.last_repaired_at ? (
          <span className="font-medium text-slate-700 dark:text-neutral-200">
            {new Date(row.last_repaired_at).toLocaleString()}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
  ];

  // ── All Batteries Filtered Data & Infinite Scroll (20 per scroll) ──
  const filteredAllData = useMemo(() => {
    if (effectiveBucket !== 'all') return [];
    return data.filter((item) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        (item.battery_code && item.battery_code.toLowerCase().includes(q)) ||
        (item.serial_number && item.serial_number.toLowerCase().includes(q)) ||
        (item.truck_number && item.truck_number.toLowerCase().includes(q)) ||
        (item.notes && item.notes.toLowerCase().includes(q));
      // "In Service" is one filter option covering two underlying statuses
      // (in_progress, in_testing) — the status badge already collapses them
      // into a single "In Service" label for clients, so the filter needs
      // to match both or a battery in testing would vanish from the list.
      const matchesStatus =
        !statusFilter ||
        (statusFilter === 'in_service'
          ? item.status === 'in_progress' || item.status === 'in_testing'
          : item.status === statusFilter);
      const matchesDate = !date || toLocalDateValue(item.created_at) === date;
      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [data, effectiveBucket, search, statusFilter, date]);

  const visibleAllRows = useMemo(() => {
    return filteredAllData.slice(0, visibleCount);
  }, [filteredAllData, visibleCount]);

  const hasMoreAll = visibleCount < filteredAllData.length;
  const loadMoreAll = () => {
    setVisibleCount((prev) => prev + 20);
  };

  // Admin-Style Intake Table Columns
  const intakeTableColumns = [
    {
      key: 'truck_number',
      label: 'Truck',
      render: (batch) => (
        <button
          type="button"
          onClick={() => setActiveBatchKey(batch.key)}
          className="font-medium text-blue-700 hover:underline dark:text-blue-400 text-left font-mono"
        >
          {batch.isAwaitingPickup ? 'Client Packed Batch' : batch.truckNumber}
        </button>
      ),
    },
    {
      key: 'driver_name',
      label: 'Driver',
      render: (batch) => batch.driverName || '—',
    },
    {
      key: 'battery_count',
      label: 'Batteries',
      render: (batch) => (
        <span className="font-semibold text-slate-800 dark:text-neutral-100">
          {batch.batteries.length}
        </span>
      ),
    },
    {
      key: 'status',
      label: effectiveBucket === 'received' ? 'Receipt Status' : 'Workshop Status',
      render: (batch) => {
        if (effectiveBucket === 'received') {
          const isPending = batch.intakeStatus === 'pending_verification';
          if (isPending) {
            return (
              <span className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                Pending Verification
              </span>
            );
          }
          return (
            <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
              </svg>
              Received & Verified
            </span>
          );
        }

        const isPending = batch.intakeStatus === 'pending_arrival';
        if (isPending) {
          return (
            <span className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              On the Way to Workshop
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
            </svg>
            Received at Workshop
          </span>
        );
      },
    },
    {
      key: 'intakeAt',
      label: 'Date/Time',
      render: (batch) => formatDate(batch.intakeAt),
    },
    {
      key: 'actions',
      label: '',
      render: (batch) => (
        <div className="flex items-center justify-end gap-2">
          {effectiveBucket === 'received' && batch.intakeStatus === 'pending_verification' && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setVerifyTargetReturn(batch);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition-colors"
            >
              <span>📷</span>
              <span>Scan to Verify</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveBatchKey(batch.key)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-800 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 dark:hover:bg-surface-700"
          >
            View Details →
          </button>
        </div>
      ),
    },
  ];

  const bucketPermissionMap = {
    all: 'client_all_batteries',
    packed: 'client_packed',
    pending: 'client_in_service',
    received: 'client_received',
  };

  const isBucketAllowed = user?.role !== 'client' || hasClientPermission(user, bucketPermissionMap[effectiveBucket]);

  if (!isBucketAllowed) {
    return (
      <div className="py-12">
        <TableState tone="error">
          You do not have permission to view this section. Please contact your Refurbinics administrator if you need access.
        </TableState>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════
  // ── DEDICATED FULL-SCREEN BATCH DETAIL PAGE VIEW (NOT A POPUP) ───────
  // ═════════════════════════════════════════════════════════════════════
  if (selectedBatch) {
    return (
      <div className="space-y-6">
        {/* Back Navigation Bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-5 dark:border-white/10">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setActiveBatchKey(null);
                setBatchSearch('');
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition-all hover:bg-slate-100 dark:border-white/10 dark:bg-surface-850 dark:text-neutral-200 dark:hover:bg-surface-800"
            >
              <span>←</span>
              <span>Back to Intake List</span>
            </button>

            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <span>{selectedBatch.isAwaitingPickup ? 'Client Packed Batch' : `Truck ${selectedBatch.truckNumber}`}</span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
                {selectedBatch.isAwaitingPickup
                  ? 'Scheduled for workshop truck intake pickup'
                  : `Driver: ${selectedBatch.driverName || '—'} • Intaked on ${formatDate(selectedBatch.intakeAt)}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedBatch.isReturnDispatch ? (
              selectedBatch.intakeStatus === 'pending_verification' ? (
                <>
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-1.5 text-xs font-bold text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300">
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                    Pending Verification
                  </span>
                  <button
                    type="button"
                    onClick={() => setVerifyTargetReturn(selectedBatch)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition-colors"
                  >
                    <span>📷</span>
                    <span>Scan to Verify Receipt</span>
                  </button>
                </>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                  </svg>
                  Received & Verified
                </span>
              )
            ) : selectedBatch.intakeStatus === 'pending_arrival' ? (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-1.5 text-xs font-bold text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                On the Way to Workshop
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                </svg>
                Received at Workshop
              </span>
            )}
            <span className="rounded-xl bg-emerald-100 px-3.5 py-1.5 text-xs font-black text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-200">
              {selectedBatch.batteries.length} Batteries
            </span>
          </div>
        </div>

        {/* Search & Actions in this Batch */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            >
              <path
                fillRule="evenodd"
                d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
                clipRule="evenodd"
              />
            </svg>
            <input
              type="text"
              value={batchSearch}
              onChange={(e) => setBatchSearch(e.target.value)}
              placeholder="Search Battery ID, Serial, Notes…"
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-surface-850 dark:text-white"
            />
          </div>
        </div>

        {/* Detailed Full Table for this Truck Batch */}
        <DataTable
          columns={detailTableColumns}
          rows={detailBatteries}
          showRowNumber
          emptyMessage="No batteries match your search in this truck batch."
        />

        {/* Battery Number Assign / Update Modal */}
        {serialTarget && (
          <Modal
            title={`Battery Number — ${serialTarget.battery_code}`}
            onClose={() => {
              setSerialTarget(null);
              setSerialError(null);
            }}
          >
            <div className="flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-200">
                  Battery Number (manufacturer serial)
                </label>
                <input
                  type="text"
                  value={serialInput}
                  onChange={(e) => setSerialInput(e.target.value)}
                  placeholder="e.g. SN-88213"
                  autoComplete="off"
                  className={formInputClasses}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-200">
                  Re-type to Confirm
                </label>
                <input
                  type="text"
                  value={serialConfirmInput}
                  onChange={(e) => setSerialConfirmInput(e.target.value)}
                  placeholder="Type the battery number again"
                  autoComplete="off"
                  className={formInputClasses}
                />
                <p className="mt-1.5 text-xs text-slate-500 dark:text-neutral-400">
                  Typed twice to catch typos — the number physically printed on the battery. Once saved, this is
                  preserved on your records.
                </p>
              </div>
              {serialError && <p className="text-xs text-red-600 dark:text-red-400">{serialError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSerialTarget(null);
                    setSerialError(null);
                  }}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSerialSave}
                  disabled={
                    serialSaving || !serialInput.trim() || serialInput.trim() !== serialConfirmInput.trim()
                  }
                  style={{ backgroundColor: accent }}
                  className="rounded-xl px-5 py-2 text-xs font-bold text-white shadow-xs hover:opacity-90 disabled:opacity-50"
                >
                  {serialSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════
  // ── MAIN INTAKE BATCHES VIEW (TABLE & CARDS) ────────────────────────
  // ═════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">
      {/* ── Page Header with Action Button & View Switcher ─────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-5 dark:border-white/10">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {meta.title}
          </h1>
          <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1">
            {meta.description}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {effectiveBucket === 'packed' && (
            <>
              {/* View Switcher: Table | Cards for Packed Batches */}
              <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-white/10 dark:bg-surface-850">
                <button
                  type="button"
                  onClick={() => setViewMode('batch_table')}
                  style={viewMode === 'batch_table' ? { backgroundColor: accent, color: '#ffffff' } : {}}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
                    viewMode === 'batch_table'
                      ? 'shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white'
                  }`}
                >
                  Table View ({batches.length})
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  style={viewMode === 'cards' ? { backgroundColor: accent, color: '#ffffff' } : {}}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
                    viewMode === 'cards'
                      ? 'shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white'
                  }`}
                >
                  Cards View ({batches.length})
                </button>
              </div>

              {/* Add Battery to Packed Action */}
              <button
                type="button"
                onClick={() => {
                  setPackModalOpen(true);
                  setCameraOpen(false);
                  setPackError(null);
                  setPackSuccess(null);
                }}
                style={{ backgroundColor: accent }}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:opacity-90 active:scale-98"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
                </svg>
                <span>+ Add Intake</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Stat Summary Cards for All Batteries ────────────────────── */}
      {effectiveBucket === 'all' && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-white/10 dark:bg-surface-900">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
              Total Fleet
            </span>
            <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
              {data.length}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-white/10 dark:bg-surface-900">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Active in Fleet
            </span>
            <p className="mt-1 text-2xl font-black text-emerald-700 dark:text-emerald-400">
              {data.filter((b) => b.status === 'returned').length}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-white/10 dark:bg-surface-900">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              In Workshop Repair
            </span>
            <p className="mt-1 text-2xl font-black text-amber-700 dark:text-amber-400">
              {data.filter((b) => b.status !== 'returned' && b.status !== 'unserviceable').length}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-white/10 dark:bg-surface-900">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              Unserviceable
            </span>
            <p className="mt-1 text-2xl font-black text-rose-700 dark:text-rose-400">
              {data.filter((b) => b.status === 'unserviceable').length}
            </p>
          </div>
        </div>
      )}

      {/* ── Search & Filter Bar ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs dark:border-white/10 dark:bg-surface-900">
        <div className="min-w-[14rem] flex-1 sm:flex-none">
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300">
            {effectiveBucket === 'packed' ? 'Search Driver / Truck' : 'Search Battery / Serial'}
          </label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={effectiveBucket === 'packed' ? 'e.g. John or TRK-102' : 'Search Code, Serial, Notes…'}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-surface-800 dark:text-white sm:w-64"
          />
        </div>

        {effectiveBucket === 'all' && (
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300">
              Filter Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-surface-800 dark:text-white"
            >
              <option value="">All Statuses</option>
              <option value="in_repair">Packed for Repair</option>
              <option value="in_service">In Service</option>
              <option value="repaired">Repair Complete</option>
              <option value="returned">Back in Your Fleet</option>
              <option value="unserviceable">Not Repairable</option>
            </select>
          </div>
        )}

        <div className="flex items-center gap-2">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300">
              {effectiveBucket === 'packed' ? 'Intake Date' : 'Date'}
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-surface-800 dark:text-white"
            />
          </div>
          {date && (
            <button
              type="button"
              onClick={() => setDate('')}
              className="self-end pb-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-neutral-400"
            >
              Clear
            </button>
          )}
        </div>

        {(search || date || statusFilter) && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setDate('');
              setStatusFilter('');
            }}
            className="self-end pb-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-neutral-400"
          >
            Clear all
          </button>
        )}
      </div>

      {loading && <TableState>Loading batteries…</TableState>}
      {error && <TableState tone="error">{error}</TableState>}

      {!loading && !error && (
        <>
          {/* ── Direct Fleet Table for 'all' Bucket ─────────────────── */}
          {effectiveBucket === 'all' ? (
            <div>
              <DataTable
                headerColor="blue"
                columns={globalFleetTableColumns}
                rows={visibleAllRows}
                showRowNumber
                emptyMessage={meta.empty}
              />
              <InfiniteScrollTrigger
                hasMore={hasMoreAll}
                loading={false}
                onVisible={loadMoreAll}
              />
              {filteredAllData.length > 20 && (
                <div className="mt-3 text-center text-xs font-semibold text-slate-400 dark:text-neutral-500">
                  Showing {visibleAllRows.length} of {filteredAllData.length} batteries • Scroll down to load more (20 per page)
                </div>
              )}
            </div>
          ) : (
            /* ── Batch Table / Cards for 'packed' / 'pending' / 'received' ─ */
            viewMode === 'batch_table' ? (
              <DataTable
                columns={intakeTableColumns}
                rows={batches}
                showRowNumber
                emptyMessage={meta.empty}
              />
            ) : (
              batches.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/50 p-12 text-center dark:border-white/10 dark:bg-surface-850">
                  <p className="text-sm font-semibold text-slate-700 dark:text-neutral-300">
                    {meta.empty}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Click &apos;+ Add Intake&apos; to scan or enter batteries.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {batches.map((batch) => {
                    const count = batch.batteries.length;

                    return (
                      <div
                        key={batch.key}
                        onClick={() => setActiveBatchKey(batch.key)}
                        className="group relative flex cursor-pointer flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-500/80 hover:shadow-md dark:border-white/10 dark:bg-surface-900 dark:hover:border-blue-400/60"
                      >
                        <div>
                          {/* Card Top Row */}
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/40">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                                  <path d="M3.375 4.5C2.339 4.5 1.5 5.34 1.5 6.375V13.5h12V6.375c0-1.036-.84-1.875-1.875-1.875h-8.25ZM13.5 15h-12v2.625c0 1.035.84 1.875 1.875 1.875h.375a3 3 0 1 1 6 0h3a.75.75 0 0 0 .75-.75V15ZM15 6.75a.75.75 0 0 1 .75-.75h2.69a2.25 2.25 0 0 1 2.012 1.245l1.64 3.28A2.25 2.25 0 0 1 22.5 11.5v6a.75.75 0 0 1-.75.75h-.375a3 3 0 1 1-6 0v-4.5a.75.75 0 0 1 .75-.75H18a.75.75 0 0 0 .75-.75v-1.125a.75.75 0 0 0-.083-.342l-1.312-2.625A.75.75 0 0 0 16.69 7.5H15.75a.75.75 0 0 1-.75-.75ZM15 15h3.75a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-.75.75H15V15Z" />
                                </svg>
                              </div>
                              <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
                                  {batch.isAwaitingPickup ? 'Client Shipment' : 'Truck Intake'}
                                </span>
                                <h3 className="font-mono text-base font-extrabold text-slate-900 group-hover:text-blue-600 transition-colors dark:text-white dark:group-hover:text-blue-400">
                                  {batch.isAwaitingPickup ? 'Client Packed Batch' : batch.truckNumber}
                                </h3>
                              </div>
                            </div>

                            <span className="inline-flex items-center gap-1 rounded-xl border border-emerald-200/80 bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-emerald-800 shadow-2xs dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                                <path fillRule="evenodd" d="M11.379 2.073a.75.75 0 0 1 .621.802l-.634 5.375h3.384a.75.75 0 0 1 .586 1.218l-7 8.5a.75.75 0 0 1-1.206-.867l1.04-4.726H4.75a.75.75 0 0 1-.684-1.06l3.5-7.5a.75.75 0 0 1 .813-.442Z" clipRule="evenodd" />
                              </svg>
                              <span>{count} {count === 1 ? 'Battery' : 'Batteries'}</span>
                            </span>
                          </div>

                          {/* Metadata Rows */}
                          <div className="mt-4 space-y-2 rounded-xl bg-slate-50/80 p-3 text-xs dark:bg-white/5">
                            <div className="flex items-center justify-between text-slate-600 dark:text-neutral-300">
                              <span className="flex items-center gap-1.5 text-slate-400 dark:text-neutral-400">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                  <path d="M10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.465 14.493a1.23 1.23 0 0 0 .41 1.412A9.957 9.957 0 0 0 10 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 0 0-13.074.003Z" />
                                </svg>
                                Driver:
                              </span>
                              <strong className="font-semibold text-slate-800 dark:text-neutral-100">
                                {batch.driverName || '—'}
                              </strong>
                            </div>

                            <div className="flex items-center justify-between text-slate-600 dark:text-neutral-300">
                              <span className="flex items-center gap-1.5 text-slate-400 dark:text-neutral-400">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                  <path fillRule="evenodd" d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2Zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75Z" clipRule="evenodd" />
                                </svg>
                                Date:
                              </span>
                              <span className="font-medium text-slate-700 dark:text-neutral-200">
                                {formatDate(batch.intakeAt)}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-slate-600 dark:text-neutral-300 border-t border-slate-200/50 pt-2 dark:border-white/5">
                              <span className="flex items-center gap-1.5 text-slate-400 dark:text-neutral-400">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
                                </svg>
                                Status:
                              </span>
                              {batch.isReturnDispatch ? (
                                batch.intakeStatus === 'pending_verification' ? (
                                  <span className="font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                                    Pending Verification
                                  </span>
                                ) : (
                                  <span className="font-bold text-emerald-700 dark:text-emerald-300">
                                    ✓ Received & Verified
                                  </span>
                                )
                              ) : batch.intakeStatus === 'pending_arrival' ? (
                                <span className="font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                                  On the Way to Workshop
                                </span>
                              ) : (
                                <span className="font-bold text-emerald-700 dark:text-emerald-300">
                                  ✓ Received at Workshop
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Card Bottom Links */}
                        <div className="mt-4 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/5">
                          {effectiveBucket === 'received' && batch.intakeStatus === 'pending_verification' ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setVerifyTargetReturn(batch);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-bold text-white shadow-2xs hover:bg-blue-700 transition-colors"
                            >
                              <span>📷</span>
                              <span>Scan to Verify</span>
                            </button>
                          ) : (
                            <div />
                          )}
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 group-hover:text-blue-700 group-hover:translate-x-0.5 transition-all dark:text-blue-400">
                            <span>View Details</span>
                            <span>→</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )
          )}
        </>
      )}

      {/* ── Admin-Style Intake Form Modal (TruckIntakeForm Format) ─────── */}
      {packModalOpen && (
        <Modal
          title="Add Truck Intake"
          description="Record a truck delivering or packing batteries for workshop repair."
          size="3xl"
          className="min-h-[580px] md:min-h-[640px]"
          onClose={() => setPackModalOpen(false)}
        >
          <form onSubmit={handlePackSubmit} className="flex flex-col gap-5">
            {packSuccess && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300">
                ✓ {packSuccess}
              </div>
            )}

            {packError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
                {packError}
              </div>
            )}

            <div className="flex flex-col gap-4">
              <div>
                <label className={labelClasses}>Truck Number</label>
                <input
                  type="text"
                  list="client-truck-numbers"
                  value={truckNumber}
                  onChange={(e) => setTruckNumber(e.target.value)}
                  placeholder="e.g. GB21 XYZ or LD68 FGH"
                  autoComplete="off"
                  className={formInputClasses}
                  required
                />
                <datalist id="client-truck-numbers">
                  {existingTruckNumbers.map((num) => (
                    <option key={num} value={num} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className={labelClasses}>Driver Name</label>
                <input
                  type="text"
                  value={driverName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDriverName(val.charAt(0).toUpperCase() + val.slice(1));
                  }}
                  placeholder="e.g. George Davies"
                  className={formInputClasses}
                  required
                />
              </div>

              {/* ── Scan / Add Batteries Box (Exact Admin Format) ─────── */}
              <div className="rounded-xl border border-blue-300 bg-slate-50 p-4 dark:border-blue-800/40 dark:bg-surface-950">
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-neutral-100">
                    Scan Batteries (returning)
                  </h3>
                  <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-slate-500 dark:bg-surface-800 dark:text-neutral-400">
                    {scannedBatteries.length} scanned
                  </span>
                </div>
                <p className="mb-3 text-xs text-slate-500 dark:text-neutral-400">
                  For batteries being packed or intaked for repair. A handheld scanner types straight into the box below — or select from your registered battery list.
                </p>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={scanInput}
                      onChange={(e) => {
                        setScanInput(e.target.value.toUpperCase());
                        setShowScanSuggestions(true);
                      }}
                      onKeyDown={handleScanKeyDown}
                      onFocus={() => setShowScanSuggestions(true)}
                      placeholder="Scan, type code or pick from suggestions…"
                      autoComplete="off"
                      className={formInputClasses}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddBattery(scanInput)}
                    disabled={!scanInput.trim()}
                    className="shrink-0 rounded-md bg-brand-600 px-3.5 py-2.5 text-sm font-medium text-white shadow-xs hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setCameraOpen((prev) => !prev)}
                    className="shrink-0 rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-200 dark:hover:bg-surface-700"
                  >
                    {cameraOpen ? 'Close Camera' : 'Use Camera'}
                  </button>
                  <button
                    type="button"
                    onClick={openPickFromSort}
                    className="shrink-0 rounded-md border border-emerald-300 bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
                    title="Import batteries from a pre-built Battery Sorting group"
                  >
                    Pick from Sort
                  </button>
                </div>

                {/* ── Inline Suggestions List (Fully visible, never clipped) ── */}
                {showScanSuggestions && (
                  <div className="mt-3 overflow-hidden rounded-xl border border-blue-300 bg-white shadow-sm dark:border-blue-800/60 dark:bg-surface-900">
                    <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-3.5 py-2 text-[11px] font-bold text-slate-600 dark:border-white/10 dark:bg-surface-800/80 dark:text-neutral-300">
                      <span className="flex items-center gap-1.5">
                        <span>Available Registered Batteries</span>
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                          {scanSuggestions.length}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowScanSuggestions(false)}
                        className="rounded px-2 py-0.5 text-[11px] font-semibold text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
                      >
                        Hide
                      </button>
                    </div>

                    <div className="max-h-60 overflow-y-auto p-2 space-y-1.5">
                      {scanSuggestions.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-500 dark:text-neutral-400">
                          {scanInput.trim()
                            ? `No registered battery matches "${scanInput}". Press 'Add' to log as a new battery.`
                            : 'No eligible batteries found in your returned fleet.'}
                        </div>
                      ) : (
                        scanSuggestions.map((b) => (
                          <button
                            key={b.id || b.battery_code}
                            type="button"
                            onClick={() => {
                              handleAddBattery(b.battery_code, b.serial_number);
                              setShowScanSuggestions(false);
                            }}
                            className="flex w-full items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2 text-left text-xs transition-all hover:border-blue-400 hover:bg-blue-600 hover:text-white group dark:border-white/5 dark:bg-surface-850 dark:hover:border-blue-500 dark:hover:bg-blue-600"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-800 group-hover:bg-white/20 group-hover:text-white dark:bg-blue-950/60 dark:text-blue-300">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                                  <rect width="16" height="10" x="2" y="7" rx="2" ry="2" />
                                  <line x1="22" x2="22" y1="11" y2="13" />
                                </svg>
                              </span>
                              <div>
                                <div className="font-mono font-bold text-slate-900 group-hover:text-white dark:text-white">
                                  {b.battery_code}
                                </div>
                                {b.serial_number && (
                                  <div className="text-[10px] text-slate-500 group-hover:text-blue-100 dark:text-neutral-400">
                                    Serial: {b.serial_number}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="rounded-lg bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 group-hover:bg-white/20 group-hover:text-white dark:bg-emerald-950/80 dark:text-emerald-300">
                                {b.status?.replace('_', ' ') || 'Ready'}
                              </span>
                              <span className="rounded-lg bg-blue-100 px-2.5 py-1 text-[11px] font-bold text-blue-700 group-hover:bg-white group-hover:text-blue-700 shadow-2xs dark:bg-blue-950 dark:text-blue-300">
                                + Add to Intake
                              </span>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {cameraOpen && (
                  <div className="mt-3">
                    <QrScanner
                      onScan={(value) => {
                        handleAddBattery(value);
                        setCameraOpen(false);
                      }}
                      onClose={() => setCameraOpen(false)}
                    />
                  </div>
                )}

                {scannedBatteries.length > 0 && (
                  <ul className="mt-3 flex flex-col gap-2 max-h-60 overflow-y-auto no-scrollbar">
                    {scannedBatteries.map((b, idx) => (
                      <li
                        key={b.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-blue-200 bg-white p-2.5 dark:border-blue-900/40 dark:bg-surface-900"
                      >
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 dark:bg-white/10 dark:text-neutral-300">
                            {idx + 1}
                          </span>
                          <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                            {b.code}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-1 sm:justify-end">
                          <input
                            type="text"
                            value={b.serial}
                            onChange={(e) => updateScannedField(idx, 'serial', e.target.value)}
                            placeholder="Serial (optional)"
                            className="w-28 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs dark:border-white/10 dark:bg-surface-800 dark:text-white"
                          />
                          <input
                            type="text"
                            value={b.issue}
                            onChange={(e) => updateScannedField(idx, 'issue', e.target.value)}
                            placeholder="Defect reason (optional)"
                            className="flex-1 sm:w-44 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs dark:border-white/10 dark:bg-surface-800 dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={() => removeScanned(idx)}
                            className="text-xs font-bold text-red-500 hover:text-red-700 p-1"
                            title="Remove"
                          >
                            ✕
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
              <button
                type="button"
                onClick={() => setPackModalOpen(false)}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={packing || (scannedBatteries.length === 0 && !scanInput.trim())}
                className="rounded-md bg-green-600 px-5 py-2 text-sm font-medium text-white shadow-xs hover:bg-green-700 disabled:opacity-50 transition-all dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                {packing ? 'Saving…' : `Record Intake (${scannedBatteries.length + (scanInput.trim() ? 1 : 0)} Batteries)`}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Pick from Sort Modal ─────────────────────────────────────── */}
      {pickSortOpen && (
        <Modal
          title={pickSortStep === 'groups' ? 'Pick from a Sort Group' : pickSortGroup?.name || 'Review Batteries'}
          description={
            pickSortStep === 'groups'
              ? 'Choose a Battery Sorting group, then review which of its batteries to add.'
              : 'Uncheck any battery you don’t want to include, then add the rest to this intake.'
          }
          onClose={() => setPickSortOpen(false)}
        >
          {pickSortStep === 'groups' ? (
            sortGroups.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center dark:border-white/10 dark:bg-surface-850">
                <p className="text-sm font-semibold text-slate-700 dark:text-neutral-300">
                  No sort groups yet.
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Build one on the Battery Sorting page, then pick it from here next time.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 max-h-96 overflow-y-auto">
                {sortGroups.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => reviewSortGroup(group)}
                    disabled={group.batteries.length === 0}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-2xs transition-all hover:border-emerald-500/80 hover:bg-emerald-50/50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-surface-900 dark:hover:border-emerald-400/60 dark:hover:bg-emerald-950/20"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">
                        {group.name}
                      </span>
                      <span className="text-xs text-slate-400 dark:text-neutral-500">
                        {group.batteries.length} {group.batteries.length === 1 ? 'battery' : 'batteries'}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                      Review →
                    </span>
                  </button>
                ))}
              </div>
            )
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-600 dark:bg-white/5 dark:text-neutral-300">
                <span>{pickSortSelected.size} of {pickSortAvailableCodes.length} selected</span>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setPickSortSelected(new Set(pickSortAvailableCodes))}
                    className="font-bold text-emerald-700 hover:underline dark:text-emerald-400"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => setPickSortSelected(new Set())}
                    className="font-bold text-slate-500 hover:underline dark:text-neutral-400"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {pickSortAvailableCodes.length < pickSortGroup.batteries.length && (
                <p className="-mt-2 text-xs text-slate-400 dark:text-neutral-500">
                  {pickSortGroup.batteries.length - pickSortAvailableCodes.length} already packed{' '}
                  {pickSortGroup.batteries.length - pickSortAvailableCodes.length === 1 ? 'battery is' : 'batteries are'}{' '}
                  hidden from this group.
                </p>
              )}

              {pickSortAvailableCodes.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center dark:border-white/10 dark:bg-surface-850">
                  <p className="text-sm font-semibold text-slate-700 dark:text-neutral-300">
                    Every battery in this group is already packed.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5 max-h-80 overflow-y-auto">
                  {pickSortAvailableCodes.map((code) => {
                    const match = allRegisteredBatteries.find((b) => b.battery_code.toUpperCase() === code.toUpperCase());
                    const checked = pickSortSelected.has(code);
                    return (
                      <label
                        key={code}
                        className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 transition-all ${
                          checked
                            ? 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-800/50 dark:bg-emerald-950/20'
                            : 'border-slate-200 bg-white dark:border-white/10 dark:bg-surface-900'
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePickSortBattery(code)}
                            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-white/20"
                          />
                          <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                            {code}
                          </span>
                        </span>
                        {match ? (
                          hasBeenServiced(match) ? (
                            <ClientStatusBadge status={match.status} />
                          ) : (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
                              Not yet serviced
                            </span>
                          )
                        ) : (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                            Not in your fleet
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setPickSortStep('groups');
                    setPickSortGroup(null);
                  }}
                  className="text-xs font-bold text-slate-500 hover:underline dark:text-neutral-400"
                >
                  ← Back to Groups
                </button>
                <button
                  type="button"
                  onClick={confirmPickSortSelection}
                  disabled={pickSortSelected.size === 0}
                  style={pickSortSelected.size > 0 ? { backgroundColor: accent } : {}}
                  className="rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-xs transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-white/5 dark:disabled:text-neutral-500"
                >
                  Add {pickSortSelected.size > 0 ? `${pickSortSelected.size} ` : ''}to Intake
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* ── Battery Number Assign / Update Modal ──────────────────────── */}
      {serialTarget && (
        <Modal
          title={`Battery Number — ${serialTarget.battery_code}`}
          onClose={() => {
            setSerialTarget(null);
            setSerialError(null);
          }}
        >
          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-200">
                Battery Number (manufacturer serial)
              </label>
              <input
                type="text"
                value={serialInput}
                onChange={(e) => setSerialInput(e.target.value)}
                placeholder="e.g. SN-88213"
                autoComplete="off"
                className={formInputClasses}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-200">
                Re-type to Confirm
              </label>
              <input
                type="text"
                value={serialConfirmInput}
                onChange={(e) => setSerialConfirmInput(e.target.value)}
                placeholder="Type the battery number again"
                autoComplete="off"
                className={formInputClasses}
              />
              <p className="mt-1.5 text-xs text-slate-500 dark:text-neutral-400">
                Typed twice to catch typos — the number physically printed on the battery. Once saved, this is
                preserved on your records.
              </p>
            </div>
            {serialError && <p className="text-xs text-red-600 dark:text-red-400">{serialError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSerialTarget(null);
                  setSerialError(null);
                }}
                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSerialSave}
                disabled={
                  serialSaving || !serialInput.trim() || serialInput.trim() !== serialConfirmInput.trim()
                }
                style={{ backgroundColor: accent }}
                className="rounded-xl px-5 py-2 text-xs font-bold text-white shadow-xs hover:opacity-90 disabled:opacity-50"
              >
                {serialSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Client Return Verification Modal ──────────────────────────── */}
      {verifyTargetReturn && (
        <ClientReturnVerifyModal
          returnId={verifyTargetReturn.intakeId || verifyTargetReturn.returnId}
          batchData={verifyTargetReturn}
          onClose={() => setVerifyTargetReturn(null)}
          onSuccess={(verifiedData) => {
            loadData();
            const firstCode = verifyTargetReturn?.batteries?.[0]?.battery_code || '';
            setRatingBatteryCode(firstCode);
            setShowRatingModal(true);
            setVerifyTargetReturn(null);
          }}
        />
      )}

      {/* ── Service Rating Modal after Battery Receipt ─────────────────── */}
      {showRatingModal && (
        <RatingModal
          batteryCode={ratingBatteryCode}
          onClose={() => setShowRatingModal(false)}
          onSuccess={() => {
            setShowRatingModal(false);
          }}
        />
      )}
    </div>
  );
}

export default ClientBatteriesPage;
