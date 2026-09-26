import { useEffect, useState, useMemo, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import apiClient from '../../../services/api-client';
import DataTable from '../../../components/ui/table/DataTable';
import TableState from '../../../components/ui/table/TableState';
import InfiniteScrollTrigger from '../../../components/ui/table/InfiniteScrollTrigger';
import { ClientStatusBadge } from '../../../components/ui/primitives/Badge';
import { fetchSortGroups } from '../../../utils/sort-groups';
import Modal from '../../../components/ui/overlays/Modal';
import QrScanner from '../../../components/ui/primitives/QrScanner';
import extractBatteryCode from '../../../utils/extract-battery-code';
import { useTheme } from '../../../context/ThemeContext';
import { FiStar, FiEdit2, FiTrash2, FiPlus, FiTruck, FiAlertCircle, FiCamera, FiActivity, FiCheckCircle, FiXCircle, FiLayers, FiFilter, FiRefreshCw } from 'react-icons/fi';
import { hasClientPermission } from '../../../utils/permissions';
import ClientReturnVerifyModal from '../components/ClientReturnVerifyModal';
import RatingModal from '../../../components/feedback/RatingModal';

// One place that turns a grouped batch (see groupMap) — optionally with a
// specific battery row — into the truck_intake id its API calls need.
// Returns null for awaiting-pickup groups, which have no intake row.
function resolveBatchIntakeId(batch, battery = null) {
  if (!batch) return null;
  if (batch.intakeId) return batch.intakeId;
  if (battery?.truck_intake_id || battery?.intake_id) return battery.truck_intake_id || battery.intake_id;
  const tagged = batch.batteries?.find((b) => b.truck_intake_id || b.intake_id);
  if (tagged) return tagged.truck_intake_id || tagged.intake_id;
  if (typeof batch.key === 'string' && batch.key.startsWith('truck_')) {
    const n = Number(batch.key.replace('truck_', ''));
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

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

// The date that actually matters to a client filtering the All Batteries
// table — when it was last returned, repaired, or received at the workshop
// — rather than `created_at`, which stays fixed at original registration
// and is often identical across a whole bulk-imported fleet, making a
// created_at-only date filter return either everything or nothing.
function getRelevantDate(item) {
  if (item.status === 'returned' && item.return_date) return item.return_date;
  if (item.last_repaired_at) return item.last_repaired_at;
  if (item.intake_at) return item.intake_at;
  return item.created_at;
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
  const dataRequestIdRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Delivery batches (return_id) the client has already rated — once rated,
  // the Rate button is replaced with a "Rated" badge instead of letting them
  // submit feedback again for the same shipment.
  const [ratedReturnIds, setRatedReturnIds] = useState(() => new Set());
  function loadRatedReturns() {
    apiClient
      .get('/ratings/my')
      .then(({ data: result }) => {
        const ids = (result.data || [])
          .map((r) => r.return_id)
          .filter((id) => id !== null && id !== undefined)
          .map(String);
        setRatedReturnIds(new Set(ids));
      })
      .catch(() => {
        // non-blocking — worst case the Rate button just stays visible
      });
  }
  function isReturnRated(id) {
    return id !== null && id !== undefined && ratedReturnIds.has(String(id));
  }

  // Default view is 'batch_table' (Admin-style Table View), with toggle to 'cards'
  const [viewMode, setViewMode] = useState('batch_table');

  // Rating feedback modal state
  const [ratingModalData, setRatingModalData] = useState({
    isOpen: false,
    batteryCode: '',
    batteryCodes: [],
    truckNumber: '',
    driverName: '',
    returnId: null,
  });

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
  const [batchStatusFilter, setBatchStatusFilter] = useState('all');

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
  const isLogisticsReady = Boolean(truckNumber.trim() && driverName.trim());
  const [scanInput, setScanInput] = useState('');
  const [scannedBatteries, setScannedBatteries] = useState([]);
  const [showScanSuggestions, setShowScanSuggestions] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [packing, setPacking] = useState(false);
  const [packError, setPackError] = useState(null);
  const [packSuccess, setPackSuccess] = useState(null);
  const [showIntakeSuccessModal, setShowIntakeSuccessModal] = useState(false);
  const [intakeSuccessResult, setIntakeSuccessResult] = useState(null);

  // "Pick from Sort" — reviewing a previously-built Battery Sorting group
  // and choosing which of its batteries to add to this intake, instead of
  // re-scanning every code by hand. Two steps: pick a group, then review /
  // deselect its batteries before anything is actually added to the form.
  const [pickSortOpen, setPickSortOpen] = useState(false);
  const [pickSortStep, setPickSortStep] = useState('groups'); // 'groups' | 'review'
  const [sortGroups, setSortGroups] = useState([]);
  const [pickSortGroup, setPickSortGroup] = useState(null);
  const [pickSortSelected, setPickSortSelected] = useState(new Set());
  const [pickedSortGroupIds, setPickedSortGroupIds] = useState(new Set());

  // Return shipment verification modal state
  const [verifyTargetReturn, setVerifyTargetReturn] = useState(null);

  // ── Edit Batch State ─────────────────────────────────────────────────
  const [editBatchTarget, setEditBatchTarget] = useState(null);
  const [editBatchTruck, setEditBatchTruck] = useState('');
  const [editBatchDriver, setEditBatchDriver] = useState('');
  const [editBatchBatteries, setEditBatchBatteries] = useState([]);
  const [editBatchAddInput, setEditBatchAddInput] = useState('');
  const [editBatchAddSerial, setEditBatchAddSerial] = useState('');
  const [editBatchAddNotes, setEditBatchAddNotes] = useState('');
  const [editBatchAddCamera, setEditBatchAddCamera] = useState(false);
  const [editBatchAddLoading, setEditBatchAddLoading] = useState(false);
  const [editBatchShowSuggestions, setEditBatchShowSuggestions] = useState(false);
  const [editBatchRemovingId, setEditBatchRemovingId] = useState(null);
  const [editBatchSaving, setEditBatchSaving] = useState(false);
  const [editBatchError, setEditBatchError] = useState(null);
  const [editBatchSuccess, setEditBatchSuccess] = useState(null);

  // ── Edit Battery in Batch State ──────────────────────────────────────
  const [editBatteryTarget, setEditBatteryTarget] = useState(null);
  const [editBatterySerial, setEditBatterySerial] = useState('');
  const [editBatteryNotes, setEditBatteryNotes] = useState('');
  const [editBatterySaving, setEditBatterySaving] = useState(false);
  const [editBatteryError, setEditBatteryError] = useState(null);

  // ── Remove Battery from Batch State ──────────────────────────────────
  const [removeBatteryTarget, setRemoveBatteryTarget] = useState(null);
  const [removeBatteryLoading, setRemoveBatteryLoading] = useState(false);
  const [removeBatteryError, setRemoveBatteryError] = useState(null);

  // ── Delete / Cancel Batch State ──────────────────────────────────────
  const [deleteBatchTarget, setDeleteBatchTarget] = useState(null);
  const [deleteBatchLoading, setDeleteBatchLoading] = useState(false);
  const [deleteBatchError, setDeleteBatchError] = useState(null);

  // ── Add More Batteries to Existing Batch State ───────────────────────
  const [addMoreToBatchOpen, setAddMoreToBatchOpen] = useState(false);
  const [addMoreScanInput, setAddMoreScanInput] = useState('');
  const [addMoreBatteries, setAddMoreBatteries] = useState([]);
  const [addMoreShowSuggestions, setAddMoreShowSuggestions] = useState(false);
  const [addMoreCameraOpen, setAddMoreCameraOpen] = useState(false);
  const [addMoreLoading, setAddMoreLoading] = useState(false);
  const [addMoreError, setAddMoreError] = useState(null);
  const [addMoreSuccess, setAddMoreSuccess] = useState(null);

  function loadData() {
    setLoading(true);
    setError(null);
    // Guards against out-of-order responses: if the page's initial fetch
    // (fired on mount/bucket change) is still in flight when a pack/add
    // action calls loadData() again, an older response can resolve AFTER
    // the newer one and silently overwrite the just-saved data with stale
    // data. Only the response from the most recently issued request wins.
    const requestId = ++dataRequestIdRef.current;
    apiClient
      .get('/clients/me/batteries', { params: effectiveBucket === 'all' ? {} : { bucket: effectiveBucket } })
      .then(({ data: result }) => {
        if (requestId !== dataRequestIdRef.current) return;
        setData(result.data || []);
      })
      .catch((err) => {
        if (requestId !== dataRequestIdRef.current) return;
        setError(err.response?.data?.message || err.message);
      })
      .finally(() => {
        if (requestId !== dataRequestIdRef.current) return;
        setLoading(false);
      });

    // Also fetch all client's registered batteries for suggestions in scan input
    apiClient
      .get('/clients/me/batteries')
      .then(({ data: result }) => {
        if (requestId !== dataRequestIdRef.current) return;
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

  useEffect(() => {
    loadRatedReturns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          intakeId: isReceived ? item.return_id : (item.intake_id || item.truck_intake_id || null),
          returnId: item.return_id || null,
          truckNumber: isReceived ? (item.return_truck || 'Return Dispatch') : (item.truck_number || null),
          driverName: isReceived ? (item.return_driver || 'Workshop Driver') : (item.driver_name || null),
          intakeAt: isReceived ? (item.return_date || item.last_repaired_at || item.created_at) : (item.intake_at || item.created_at),
          intakeStatus: isReceived ? (item.return_status || 'verified') : (item.intake_status || 'pending_arrival'),
          verifiedAt: isReceived ? (item.return_verified_at || null) : (item.verified_at || null),
          isAwaitingPickup: !isReceived && !item.truck_number && !item.intake_id && !item.truck_intake_id,
          isReturnDispatch: isReceived,
          batteries: [],
        });
      }
      groupMap.get(key).batteries.push(item);
    });

    const sorted = Array.from(groupMap.values()).sort(
      (a, b) => new Date(b.intakeAt || 0) - new Date(a.intakeAt || 0)
    );

    if (effectiveBucket === 'pending') {
      // In Service & Testing: only show truck batches that have been received at workshop
      return sorted.filter(
        (batch) => batch.intakeStatus !== 'pending_arrival' && !batch.isAwaitingPickup
      );
    }

    // Packed to repair: every truck ever packed for this client, whether
    // it's still on the way (pending_arrival) or has already arrived and
    // is awaiting technician pickup — matches the backend's `packed`
    // bucket, which now returns all in_repair batteries regardless of
    // truck arrival status.
    return sorted;
  }, [data, effectiveBucket]);

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

  // Suggestions for adding another battery inside the Edit Batch Modal
  const editBatchScanSuggestions = useMemo(() => {
    if (!editBatchTarget) return [];
    const q = editBatchAddInput.trim().toLowerCase();
    const existingInBatch = new Set(
      (editBatchBatteries || []).map((b) => (b.battery_code || b.code || '').toUpperCase())
    );
    return allRegisteredBatteries
      .filter((b) => !existingInBatch.has(b.battery_code.toUpperCase()))
      .filter((b) => !NOT_RETURNABLE_STATUSES.has(b.status))
      .filter((b) => {
        if (!q) return true;
        return (
          b.battery_code.toLowerCase().includes(q) ||
          (b.serial_number && b.serial_number.toLowerCase().includes(q))
        );
      })
      .slice(0, 8);
  }, [allRegisteredBatteries, editBatchTarget, editBatchBatteries, editBatchAddInput, NOT_RETURNABLE_STATUSES]);

  // Active Selected Batch Object for Detail Page (augmented with all registered batteries)
  const selectedBatch = useMemo(() => {
    if (!activeBatchKey) return null;
    const batch = rawBatches.find((b) => b.key === activeBatchKey);
    if (!batch) return null;

    if (allRegisteredBatteries && allRegisteredBatteries.length > 0) {
      const isReceived = effectiveBucket === 'received';
      const allBatchBatteries = allRegisteredBatteries.filter((item) => {
        if (isReceived) {
          if (batch.returnId && item.return_id) return String(item.return_id) === String(batch.returnId);
          if (batch.truckNumber && item.return_truck) return String(item.return_truck) === String(batch.truckNumber);
        } else {
          if (batch.intakeId && item.intake_id) return String(item.intake_id) === String(batch.intakeId);
          if (batch.truckNumber && item.truck_number) return String(item.truck_number) === String(batch.truckNumber);
        }
        return false;
      });

      if (allBatchBatteries.length > 0) {
        return {
          ...batch,
          batteries: allBatchBatteries,
        };
      }
    }

    return batch;
  }, [rawBatches, activeBatchKey, allRegisteredBatteries, effectiveBucket]);

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

  // ── Edit Batch Handlers ──────────────────────────────────────────────
  function openEditBatch(batch) {
    setEditBatchTarget({ ...batch, intakeId: resolveBatchIntakeId(batch) });
    setEditBatchTruck(batch.truckNumber || '');
    setEditBatchDriver(batch.driverName || '');
    setEditBatchBatteries(batch.batteries || []);
    setEditBatchAddInput('');
    setEditBatchAddSerial('');
    setEditBatchAddNotes('');
    setEditBatchAddCamera(false);
    setEditBatchAddLoading(false);
    setEditBatchShowSuggestions(false);
    setEditBatchRemovingId(null);
    setEditBatchError(null);
    setEditBatchSuccess(null);
  }

  async function handleEditModalAddBattery(customCode, customSerial, customNotes) {
    const resolvedIntakeId = resolveBatchIntakeId(editBatchTarget);

    if (!resolvedIntakeId) {
      setEditBatchError('This batch cannot be modified directly (missing intake ID).');
      return;
    }
    const raw = customCode !== undefined ? customCode : editBatchAddInput;
    const code = (extractBatteryCode(raw) || raw || '').trim().toUpperCase();
    if (!code) {
      setEditBatchError('Please enter or scan a battery code.');
      return;
    }

    const serial = (customSerial !== undefined ? customSerial : editBatchAddSerial).trim();
    const notes = (customNotes !== undefined ? customNotes : editBatchAddNotes).trim();

    if (editBatchBatteries.some((b) => (b.battery_code || b.code || '').toUpperCase() === code)) {
      setEditBatchError(`Battery ${code} is already in this intake batch.`);
      return;
    }

    setEditBatchAddLoading(true);
    setEditBatchError(null);
    setEditBatchSuccess(null);

    try {
      const res = await apiClient.post(
        `/clients/me/truck-intakes/${resolvedIntakeId}/batteries`,
        {
          batteries: [{ code, serialNumber: serial || undefined, issueDescription: notes || undefined }],
        }
      );

      const addedList = res.data?.data?.added || [];
      const newAddedItem = addedList[0] || {
        id: 'added-' + Date.now(),
        battery_code: code,
        serial_number: serial || null,
        notes: notes || null,
        status: 'in_repair',
        truck_intake_id: resolvedIntakeId,
      };

      setEditBatchBatteries((prev) => [...prev, newAddedItem]);
      setEditBatchAddInput('');
      setEditBatchAddSerial('');
      setEditBatchAddNotes('');
      setEditBatchAddCamera(false);
      setEditBatchShowSuggestions(false);
      setEditBatchSuccess(`✓ Added battery ${code} to intake.`);
      loadData();
    } catch (err) {
      setEditBatchError(err.response?.data?.message || err.message || 'Failed to add battery.');
    } finally {
      setEditBatchAddLoading(false);
    }
  }

  async function handleEditModalRemoveBattery(battery) {
    const resolvedIntakeId = resolveBatchIntakeId(editBatchTarget, battery) || 'awaiting_pickup';

    const batteryIdentifier = battery.id || battery.battery_code || battery.code;
    setEditBatchRemovingId(batteryIdentifier);
    setEditBatchError(null);
    setEditBatchSuccess(null);

    try {
      await apiClient.delete(
        `/clients/me/truck-intakes/${resolvedIntakeId}/batteries/${batteryIdentifier}`
      );
      setEditBatchBatteries((prev) =>
        prev.filter((b) =>
          battery.id ? b.id !== battery.id : (b.battery_code || b.code) !== (battery.battery_code || battery.code)
        )
      );
      setEditBatchSuccess(`✓ Removed battery ${battery.battery_code || battery.code || ''} from intake.`);
      loadData();
    } catch (err) {
      setEditBatchError(err.response?.data?.message || err.message || 'Failed to remove battery.');
    } finally {
      setEditBatchRemovingId(null);
    }
  }

  async function handleEditBatchSave(e) {
    if (e) e.preventDefault();
    if (!editBatchTarget) return;
    if (!editBatchTruck.trim()) {
      setEditBatchError('Truck Number is required.');
      return;
    }
    if (!editBatchDriver.trim()) {
      setEditBatchError('Driver Name is required.');
      return;
    }
    setEditBatchSaving(true);
    setEditBatchError(null);
    try {
      const finalTruck = editBatchTruck.trim();
      const finalDriver = editBatchDriver.trim();
      if (editBatchTarget.intakeId) {
        await apiClient.patch(`/clients/me/truck-intakes/${editBatchTarget.intakeId}`, {
          truckNumber: finalTruck,
          driverName: finalDriver,
        });
      }
      setEditBatchSuccess('✓ Truck batch details saved successfully.');
      setTimeout(() => {
        setEditBatchTarget(null);
        loadData();
      }, 400);
    } catch (err) {
      setEditBatchError(err.response?.data?.message || err.message);
    } finally {
      setEditBatchSaving(false);
    }
  }

  // ── Edit Battery Details Handlers ────────────────────────────────────
  function openEditBattery(row) {
    setEditBatteryTarget(row);
    setEditBatterySerial(row.serial_number || '');
    setEditBatteryNotes(row.notes || '');
    setEditBatteryError(null);
  }

  async function handleEditBatterySave(e) {
    e.preventDefault();
    if (!editBatteryTarget) return;
    setEditBatterySaving(true);
    setEditBatteryError(null);
    try {
      await apiClient.patch(`/clients/me/batteries/${editBatteryTarget.id}`, {
        serialNumber: editBatterySerial.trim() || null,
        notes: editBatteryNotes.trim() || null,
      });
      setEditBatteryTarget(null);
      loadData();
    } catch (err) {
      setEditBatteryError(err.response?.data?.message || err.message);
    } finally {
      setEditBatterySaving(false);
    }
  }

  // ── Remove Battery from Batch Confirmation ───────────────────────────
  async function handleRemoveBatteryConfirm() {
    if (!removeBatteryTarget) return;
    setRemoveBatteryLoading(true);
    setRemoveBatteryError(null);
    try {
      const resolvedIntakeId =
        resolveBatchIntakeId(removeBatteryTarget, removeBatteryTarget.battery) || 'awaiting_pickup';
      const batteryIdentifier = removeBatteryTarget.battery?.id || removeBatteryTarget.battery?.battery_code;
      await apiClient.delete(
        `/clients/me/truck-intakes/${resolvedIntakeId}/batteries/${batteryIdentifier}`
      );
      setRemoveBatteryTarget(null);
      loadData();
    } catch (err) {
      setRemoveBatteryError(err.response?.data?.message || err.message);
    } finally {
      setRemoveBatteryLoading(false);
    }
  }

  // ── Delete / Cancel Entire Batch Confirmation ────────────────────────
  async function handleDeleteBatchConfirm() {
    if (!deleteBatchTarget) return;
    setDeleteBatchLoading(true);
    setDeleteBatchError(null);
    try {
      await apiClient.delete(`/clients/me/truck-intakes/${deleteBatchTarget.intakeId}`);
      setDeleteBatchTarget(null);
      setActiveBatchKey(null);
      loadData();
    } catch (err) {
      setDeleteBatchError(err.response?.data?.message || err.message);
    } finally {
      setDeleteBatchLoading(false);
    }
  }

  // ── Add More Batteries to Batch Handlers ─────────────────────────────
  const addMoreScanSuggestions = useMemo(() => {
    const q = addMoreScanInput.trim().toLowerCase();
    const existingInBatch = new Set((selectedBatch?.batteries || []).map((b) => b.battery_code.toUpperCase()));
    const existingInStaging = new Set(addMoreBatteries.map((b) => b.code.toUpperCase()));
    return allRegisteredBatteries
      .filter((b) => !existingInBatch.has(b.battery_code.toUpperCase()))
      .filter((b) => !existingInStaging.has(b.battery_code.toUpperCase()))
      .filter((b) => !NOT_RETURNABLE_STATUSES.has(b.status))
      .filter((b) => {
        if (!q) return true;
        return (
          b.battery_code.toLowerCase().includes(q) ||
          (b.serial_number && b.serial_number.toLowerCase().includes(q))
        );
      })
      .slice(0, 8);
  }, [allRegisteredBatteries, selectedBatch, addMoreBatteries, addMoreScanInput, NOT_RETURNABLE_STATUSES]);

  function handleAddMoreBattery(rawCode, initialSerial = '') {
    const code = (extractBatteryCode(rawCode) || rawCode || '').trim().toUpperCase();
    if (!code) return;

    if (addMoreBatteries.some((b) => b.code.toUpperCase() === code)) {
      setAddMoreError(`Battery ${code} is already staged to be added.`);
      return;
    }
    if (selectedBatch?.batteries?.some((b) => b.battery_code.toUpperCase() === code)) {
      setAddMoreError(`Battery ${code} is already present in this truck batch.`);
      return;
    }

    const existing = allRegisteredBatteries.find(
      (b) => b.battery_code.toUpperCase() === code
    );
    if (existing) {
      if (['in_repair', 'in_progress', 'in_testing', 'repaired'].includes(existing.status)) {
        setAddMoreError(`Battery ${code} is already in the repair pipeline (${existing.status.replace('_', ' ')}).`);
        return;
      }
      if (existing.status === 'unserviceable') {
        setAddMoreError(`Battery ${code} is marked as unserviceable.`);
        return;
      }
    }

    setAddMoreBatteries((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        code,
        serial: initialSerial || (existing ? existing.serial_number : '') || '',
        issue: '',
      },
    ]);
    setAddMoreScanInput('');
    setAddMoreError(null);
  }

  async function handleAddMoreToBatchSubmit(e) {
    e.preventDefault();
    if (!selectedBatch?.intakeId) {
      setAddMoreError('Intake batch ID is required.');
      return;
    }
    let finalBatteries = [...addMoreBatteries];
    if (addMoreScanInput.trim()) {
      const code = (extractBatteryCode(addMoreScanInput) || addMoreScanInput).trim().toUpperCase();
      if (code && !finalBatteries.some((b) => b.code === code)) {
        finalBatteries.push({ id: Date.now(), code, serial: '', issue: '' });
      }
    }
    if (finalBatteries.length === 0) {
      setAddMoreError('Please scan or select at least one battery.');
      return;
    }

    setAddMoreLoading(true);
    setAddMoreError(null);
    try {
      const res = await apiClient.post(`/clients/me/truck-intakes/${selectedBatch.intakeId}/batteries`, {
        batteries: finalBatteries.map((b) => ({
          batteryCode: b.code,
          serialNumber: b.serial.trim() || undefined,
          issueDescription: b.issue.trim() || undefined,
        })),
      });
      setAddMoreSuccess(res.data?.message || 'Batteries added to batch successfully!');
      setAddMoreBatteries([]);
      setAddMoreScanInput('');
      loadData();
      setTimeout(() => {
        setAddMoreToBatchOpen(false);
        setAddMoreSuccess(null);
      }, 1000);
    } catch (err) {
      setAddMoreError(err.response?.data?.message || err.message);
    } finally {
      setAddMoreLoading(false);
    }
  }

  // Handle adding scanned/typed battery to form list
  function handleAddBattery(rawCode, initialSerial = '') {
    if (!truckNumber.trim() || !driverName.trim()) {
      setPackError('Please enter Truck Number and Driver Name first.');
      return;
    }
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
      // Already packed onto THIS SAME truck's shipment, which hasn't
      // arrived/been verified yet — that's not a conflict, it's the client
      // continuing to build the same still-open batch, so let it through
      // instead of blocking with a confusing "already in pipeline" error.
      const normalizeTruck = (v) => (v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const sameOpenTruckBatch =
        existing.status === 'in_repair' &&
        existing.intake_status === 'pending_arrival' &&
        truckNumber.trim() &&
        existing.truck_number &&
        normalizeTruck(existing.truck_number) === normalizeTruck(truckNumber);

      if (!sameOpenTruckBatch) {
        if (['in_repair', 'in_progress', 'in_testing', 'repaired'].includes(existing.status)) {
          setPackError(`Battery ${code} is already in the repair pipeline (${existing.status.replace('_', ' ')}).`);
          return;
        }
        if (existing.status === 'unserviceable') {
          setPackError(`Battery ${code} has been marked as unserviceable.`);
          return;
        }
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
      if (!truckNumber.trim() || !driverName.trim()) {
        setPackError('Please enter Truck Number and Driver Name first.');
        return;
      }
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
    if (!truckNumber.trim() || !driverName.trim()) {
      setPackError('Please enter Truck Number and Driver Name first.');
      return;
    }
    setSortGroups([]);
    fetchSortGroups()
      .then((data) => setSortGroups(data || []))
      .catch(() => setSortGroups([]));
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

  // Filter out sort groups that have already been selected into this intake or where
  // all batteries are already packed / already in the intake list.
  const availableSortGroups = useMemo(() => {
    return sortGroups.filter((group) => {
      if (pickedSortGroupIds.has(group.id)) return false;
      const groupBatteries = group.batteries || [];
      if (groupBatteries.length === 0) return false;
      const remaining = groupBatteries.filter((code) => !isAlreadyPacked(code));
      return remaining.length > 0;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortGroups, pickedSortGroupIds, scannedCodes, allRegisteredBatteries]);

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
    if (pickSortGroup?.id) {
      setPickedSortGroupIds((prev) => new Set([...prev, pickSortGroup.id]));
    }
    setPickSortOpen(false);
    setPickSortGroup(null);
  }

  // Handle Submission of Admin-style Intake Form
  async function handlePackSubmit(e) {
    e.preventDefault();
    if (!truckNumber.trim()) {
      setPackError('Truck Number is required.');
      return;
    }
    if (!driverName.trim()) {
      setPackError('Driver Name is required.');
      return;
    }
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

      setIntakeSuccessResult({
        intake: res.data?.intake,
        count: finalBatteries.length,
        truckNumber: truckNumber.trim() || 'N/A',
        driverName: driverName.trim() || 'Fleet Driver',
      });
      setTruckNumber('');
      setDriverName('');
      setScanInput('');
      setScannedBatteries([]);
      setPickedSortGroupIds(new Set());
      setPackModalOpen(false);
      setShowIntakeSuccessModal(true);
      loadData();
    } catch (err) {
      setPackError(err.response?.data?.message || err.message);
    } finally {
      setPacking(false);
    }
  }

  // Metrics breakdown for selected batch (Total, Waiting for Service, In Service, Service Completed, Unserviceable, Returned, Recycled)
  const batchMetrics = useMemo(() => {
    if (!selectedBatch?.batteries) {
      return { total: 0, reachedWorkshop: 0, inService: 0, serviced: 0, unserviceable: 0, returned: 0, recycled: 0 };
    }
    const bats = selectedBatch.batteries;
    const total = bats.length;
    const isBatchVerified = selectedBatch.intakeStatus === 'verified' || Boolean(selectedBatch.verifiedAt);

    const inService = bats.filter((b) =>
      ['in_progress', 'in_testing', 'testing', 'repair_testing'].includes(b.status)
    ).length;
    const serviced = bats.filter((b) => b.status === 'repaired').length;
    const unserviceable = bats.filter((b) =>
      ['unserviceable', 'tested_parts_removed', 'unserviceable_parts_removed'].includes(b.status)
    ).length;
    const returned = bats.filter((b) => b.status === 'returned').length;
    const recycled = bats.filter((b) => b.status === 'recycled').length;

    const reachedWorkshop = bats.filter((b) => {
      const isVerified = isBatchVerified || Boolean(b.verified_at);
      if (!isVerified) return false;
      const isHandled =
        ['in_progress', 'in_testing', 'testing', 'repair_testing', 'repaired', 'unserviceable', 'tested_parts_removed', 'unserviceable_parts_removed', 'returned', 'recycled'].includes(b.status);
      return !isHandled;
    }).length;

    return { total, reachedWorkshop, inService, serviced, unserviceable, returned, recycled };
  }, [selectedBatch]);

  // Filtered batteries in detail page
  const detailBatteries = useMemo(() => {
    if (!selectedBatch) return [];
    let list = selectedBatch.batteries || [];
    const isBatchVerified = selectedBatch.intakeStatus === 'verified' || Boolean(selectedBatch.verifiedAt);

    if (batchStatusFilter === 'reached_workshop') {
      list = list.filter((b) => {
        const isVerified = isBatchVerified || Boolean(b.verified_at);
        if (!isVerified) return false;
        const isHandled =
          ['in_progress', 'in_testing', 'testing', 'repair_testing', 'repaired', 'unserviceable', 'tested_parts_removed', 'unserviceable_parts_removed', 'returned', 'recycled'].includes(b.status);
        return !isHandled;
      });
    } else if (batchStatusFilter === 'in_service') {
      list = list.filter((b) => ['in_progress', 'in_testing', 'testing', 'repair_testing'].includes(b.status));
    } else if (batchStatusFilter === 'serviced') {
      list = list.filter((b) => b.status === 'repaired');
    } else if (batchStatusFilter === 'unserviceable') {
      list = list.filter((b) => ['unserviceable', 'tested_parts_removed', 'unserviceable_parts_removed'].includes(b.status));
    } else if (batchStatusFilter === 'returned') {
      list = list.filter((b) => b.status === 'returned');
    } else if (batchStatusFilter === 'recycled') {
      list = list.filter((b) => b.status === 'recycled');
    }

    if (!batchSearch.trim()) return list;
    const q = batchSearch.toLowerCase();
    return list.filter(
      (b) =>
        (b.battery_code && b.battery_code.toLowerCase().includes(q)) ||
        (b.serial_number && b.serial_number.toLowerCase().includes(q)) ||
        (b.status && b.status.toLowerCase().includes(q)) ||
        (b.notes && b.notes.toLowerCase().includes(q))
    );
  }, [selectedBatch, batchSearch, batchStatusFilter]);

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
    {
      key: 'status',
      label: 'Status',
      render: (row) => {
        if (effectiveBucket === 'packed') {
          const isVerified =
            selectedBatch?.intakeStatus === 'verified' ||
            Boolean(selectedBatch?.verifiedAt) ||
            Boolean(row.verified_at);
          if (!isVerified) {
            return (
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                Waiting for Verify
              </span>
            );
          }

          if (row.status === 'unserviceable' || row.status === 'tested_parts_removed' || row.status === 'unserviceable_parts_removed') {
            const isTestFailed = row.status === 'tested_parts_removed' || row.status === 'unserviceable_parts_removed';
            return (
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-red-200/90 bg-red-50/90 px-2.5 py-0.5 text-xs font-semibold text-red-700 shadow-2xs dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500 ring-2 ring-red-400/30" />
                <span>Unserviceable</span>
                {isTestFailed && (
                  <>
                    <span className="font-normal text-red-300 dark:text-red-600">·</span>
                    <span className="text-[11px] font-bold text-red-600 dark:text-red-400">Test Failed</span>
                  </>
                )}
              </span>
            );
          }

          if (row.status === 'in_progress' || row.status === 'in_testing' || row.status === 'testing' || row.status === 'repair_testing') {
            return (
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-blue-200/90 bg-blue-50/90 px-2.5 py-0.5 text-xs font-semibold text-blue-700 shadow-2xs dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-300">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500 animate-pulse" />
                <span>In Service</span>
              </span>
            );
          }

          if (row.status === 'repaired') {
            return (
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-200/90 bg-emerald-50/90 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 shadow-2xs dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3 text-emerald-600 dark:text-emerald-400">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                </svg>
                <span>Service Completed</span>
              </span>
            );
          }

          if (row.status === 'returned') {
            return (
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-sky-200/90 bg-sky-50/90 px-2.5 py-0.5 text-xs font-semibold text-sky-800 shadow-2xs dark:border-sky-900/40 dark:bg-sky-950/40 dark:text-sky-300">
                <FiTruck className="h-3 w-3 text-sky-600 dark:text-sky-400" />
                <span>Returned</span>
              </span>
            );
          }

          if (row.status === 'recycled') {
            return (
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-black bg-black px-2.5 py-0.5 text-xs font-semibold text-white shadow-2xs dark:border-neutral-800 dark:bg-black dark:text-white">
                <span>Recycled</span>
              </span>
            );
          }

          return (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-yellow-300 bg-yellow-50 px-2.5 py-0.5 text-xs font-bold text-yellow-800 shadow-2xs dark:border-yellow-700/60 dark:bg-yellow-950/40 dark:text-yellow-300">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3 text-yellow-600 dark:text-yellow-400">
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
              </svg>
              <span>Waiting for Service</span>
            </span>
          );
        }

        const isVerified =
          effectiveBucket === 'received'
            ? selectedBatch?.intakeStatus === 'verified' ||
              Boolean(selectedBatch?.verifiedAt) ||
              row.return_status === 'verified' ||
              Boolean(row.return_verified_at)
            : row.return_status === 'verified' || Boolean(row.return_verified_at);
        return (
          <ClientStatusBadge
            status={row.status}
            isVerified={isVerified}
            returnStatus={row.return_status || (selectedBatch?.intakeStatus === 'verified' ? 'verified' : selectedBatch?.intakeStatus)}
          />
        );
      },
    },
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
      label: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-1.5 justify-end">
          {effectiveBucket === 'packed' && selectedBatch?.intakeStatus !== 'verified' && !selectedBatch?.verifiedAt && (
            <>
              <button
                type="button"
                onClick={() => openEditBattery(row)}
                className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-blue-600 hover:text-white dark:bg-white/10 dark:text-neutral-200 dark:hover:bg-blue-600 transition-colors shadow-2xs cursor-pointer"
                title="Edit Serial Number & Defect Notes"
              >
                <FiEdit2 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
              <button
                type="button"
                onClick={() => setRemoveBatteryTarget({ battery: row, intakeId: selectedBatch.intakeId || 'awaiting_pickup' })}
                className="inline-flex items-center gap-1 rounded-xl bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-700 hover:bg-red-600 hover:text-white border border-red-200 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-600 transition-colors shadow-2xs cursor-pointer"
                title="Remove and return to fleet"
              >
                <FiTrash2 className="w-3.5 h-3.5" />
                <span>Remove</span>
              </button>
            </>
          )}
          {effectiveBucket === 'received' && (
            isReturnRated(selectedBatch?.intakeId || selectedBatch?.returnId) ? (
              <span className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500 dark:bg-white/5 dark:text-neutral-400">
                <FiStar className="w-3 h-3 fill-amber-400 text-amber-400" />
                <span>Rated</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setRatingModalData({
                    isOpen: true,
                    batteryCode: row.battery_code,
                    batteryCodes: [row.battery_code],
                    truckNumber: selectedBatch?.truckNumber || '',
                    driverName: selectedBatch?.driverName || '',
                    returnId: selectedBatch?.intakeId || selectedBatch?.returnId || null,
                  });
                }}
                className="inline-flex items-center gap-1 rounded-xl bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 border border-amber-300 hover:bg-amber-100 dark:bg-amber-950/50 dark:border-amber-900/50 dark:text-amber-300 transition-colors shadow-2xs cursor-pointer"
              >
                <FiStar className="w-3 h-3 fill-amber-400 text-amber-400" />
                <span>Rate</span>
              </button>
            )
          )}
          <Link
            to={`/batteries/${encodeURIComponent(row.battery_code)}`}
            className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:bg-emerald-600 hover:text-white dark:bg-white/10 dark:text-neutral-200 dark:hover:bg-emerald-600"
          >
            <span>History →</span>
          </Link>
        </div>
      ),
    },
  ].filter((col) => !(effectiveBucket === 'packed' && col.key === 'actions'));

  // Admin-Matched Global Fleet Table Columns for "All Batteries" Page
  const globalFleetTableColumns = [
    {
      key: 'battery_code',
      label: 'Battery ID',
      width: '140px',
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
      width: '220px',
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
      width: '160px',
      sortValue: (row) => row.status || 'registered',
      render: (row) => (
        <ClientStatusBadge
          status={row.status || 'registered'}
          isVerified={row.return_status === 'verified' || Boolean(row.return_verified_at)}
          returnStatus={row.return_status}
        />
      ),
    },
    {
      key: 'last_repaired_at',
      label: 'Previous Repair Date',
      width: '190px',
      sortValue: (row) => (row.last_repaired_at ? new Date(row.last_repaired_at).getTime() : 0),
      render: (row) =>
        row.last_repaired_at ? (
          <span className="font-medium text-slate-700 dark:text-neutral-200">
            {new Date(row.last_repaired_at).toLocaleString()}
          </span>
        ) : (
          <span className="text-slate-400 dark:text-neutral-500">—</span>
        ),
    },
  ];

  // In Service & Testing Table Columns — a flat per-battery table (unlike
  // packed/received, which are naturally truck-batch shaped) since a
  // battery mid-workshop isn't meaningfully grouped by the truck it
  // originally arrived on.
  const pendingTableColumns = [
    {
      key: 'battery_code',
      label: 'Battery ID',
      width: '140px',
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
      width: '200px',
      render: (row) =>
        row.serial_number ? (
          <span className="font-semibold text-slate-800 dark:text-neutral-100">{row.serial_number}</span>
        ) : (
          <span className="text-xs text-slate-400 dark:text-neutral-500 italic">Not set</span>
        ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '160px',
      sortValue: (row) => row.status || '',
      render: (row) => (
        <ClientStatusBadge
          status={row.status}
          isVerified={row.return_status === 'verified' || Boolean(row.return_verified_at)}
          returnStatus={row.return_status}
        />
      ),
    },
    {
      key: 'truck_number',
      label: 'Arrived On',
      width: '160px',
      render: (row) => row.truck_number || <span className="text-slate-400 dark:text-neutral-500">—</span>,
    },
    {
      key: 'intake_at',
      label: 'Time in Workshop',
      width: '190px',
      sortValue: (row) => {
        const d = row.intake_at || row.created_at;
        return d ? new Date(d).getTime() : 0;
      },
      render: (row) => new Date(row.intake_at || row.created_at).toLocaleString(),
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
      // "In Service" is one filter option covering several underlying
      // statuses — in_progress/in_testing plus the legacy testing/
      // repair_testing values that ClientStatusBadge also still renders as
      // "In Testing & QA". Matching only in_progress/in_testing here made
      // any battery still sitting on a legacy status vanish from the list
      // the moment this filter was applied, even though its badge showed
      // it was very much still in service.
      const matchesStatus =
        !statusFilter ||
        (statusFilter === 'in_service'
          ? ['in_progress', 'in_testing', 'testing', 'repair_testing', 'in_repair', 'repaired'].includes(item.status)
          : statusFilter === 'unserviceable'
          ? ['unserviceable', 'tested_parts_removed', 'unserviceable_parts_removed'].includes(item.status)
          : item.status === statusFilter);
      const matchesDate = !date || toLocalDateValue(getRelevantDate(item)) === date;
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

  // In Service & Testing — search by battery code/serial (the batch-level
  // search only matches driver/truck name, which doesn't help once a
  // battery is mid-workshop rather than still tied to its intake truck).
  const filteredPendingData = useMemo(() => {
    if (effectiveBucket !== 'pending') return [];
    return data.filter((item) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        (item.battery_code && item.battery_code.toLowerCase().includes(q)) ||
        (item.serial_number && item.serial_number.toLowerCase().includes(q)) ||
        (item.truck_number && item.truck_number.toLowerCase().includes(q));
      const matchesDate = !date || toLocalDateValue(item.intake_at || item.created_at) === date;
      return matchesSearch && matchesDate;
    });
  }, [data, effectiveBucket, search, date]);

  const visiblePendingRows = useMemo(() => {
    return filteredPendingData.slice(0, visibleCount);
  }, [filteredPendingData, visibleCount]);

  const hasMorePending = visibleCount < filteredPendingData.length;
  const loadMorePending = () => {
    setVisibleCount((prev) => prev + 20);
  };

  const visibleBatchRows = useMemo(() => {
    return batches.slice(0, visibleCount);
  }, [batches, visibleCount]);

  const hasMoreBatches = visibleCount < batches.length;
  const loadMoreBatches = () => {
    setVisibleCount((prev) => prev + 20);
  };

  if (!meta) {
    return <TableState tone="error">Unknown battery list.</TableState>;
  }

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
              Waiting for Verify
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-600 bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white shadow-2xs dark:border-emerald-500 dark:bg-emerald-600 dark:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-white">
              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
            </svg>
            Verified
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
          {effectiveBucket === 'packed' && batch.intakeStatus !== 'verified' && !batch.verifiedAt && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openEditBatch(batch);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-700 shadow-2xs hover:bg-blue-100 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/60 transition-colors"
              title="Edit Truck and Driver Details"
            >
              <FiEdit2 className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
          )}
          {effectiveBucket === 'received' && (
            batch.intakeStatus === 'pending_verification' ? (
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
            ) : isReturnRated(batch.intakeId || batch.returnId) ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-500 dark:bg-white/5 dark:text-neutral-400">
                <FiStar className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span>Rated</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const codes = (batch.batteries || []).map((b) => b.battery_code).filter(Boolean);
                  setRatingModalData({
                    isOpen: true,
                    batteryCode: codes[0] || '',
                    batteryCodes: codes,
                    truckNumber: batch.truckNumber || '',
                    driverName: batch.driverName || '',
                    returnId: batch.intakeId || batch.returnId || null,
                  });
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 dark:bg-amber-950/40 dark:border-amber-900/50 dark:text-amber-300 transition-colors shadow-2xs"
                title="Rate this delivery batch"
              >
                <FiStar className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span>Rate</span>
              </button>
            )
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
                setBatchStatusFilter('all');
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition-all hover:bg-slate-100 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 dark:hover:bg-surface-700 cursor-pointer"
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

          <div className="flex items-center gap-2 flex-wrap">
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
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition-colors cursor-pointer"
                  >
                    <span>📷</span>
                    <span>Scan to Verify Receipt</span>
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                    </svg>
                    Received & Verified
                  </span>
                  {isReturnRated(selectedBatch.intakeId || selectedBatch.returnId) ? (
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3.5 py-1.5 text-xs font-bold text-slate-500 dark:bg-white/5 dark:text-neutral-400">
                      <FiStar className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span>Rated — Thank You!</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        const codes = (selectedBatch.batteries || []).map((b) => b.battery_code).filter(Boolean);
                        setRatingModalData({
                          isOpen: true,
                          batteryCode: codes[0] || '',
                          batteryCodes: codes,
                          truckNumber: selectedBatch.truckNumber || '',
                          driverName: selectedBatch.driverName || '',
                          returnId: selectedBatch.intakeId || selectedBatch.returnId || null,
                        });
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-amber-600 transition-colors cursor-pointer"
                    >
                      <FiStar className="w-3.5 h-3.5 fill-white text-white" />
                      <span>Rate Delivery Batch</span>
                    </button>
                  )}
                </div>
              )
            ) : selectedBatch.intakeStatus === 'pending_arrival' ? (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-1.5 text-xs font-bold text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300">
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                  Waiting for Verify
                </span>

                {effectiveBucket === 'packed' && selectedBatch.intakeStatus !== 'verified' && !selectedBatch.verifiedAt && (
                  <>
                    <button
                      type="button"
                      onClick={() => openEditBatch(selectedBatch)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-3.5 py-1.5 text-xs font-bold text-blue-700 shadow-2xs hover:bg-blue-50 dark:border-blue-800/40 dark:bg-surface-800 dark:text-blue-300 dark:hover:bg-surface-700 transition-colors cursor-pointer"
                    >
                      <FiEdit2 className="w-3.5 h-3.5" />
                      <span>Edit Batch</span>
                    </button>

                    {selectedBatch.intakeId && (
                      <button
                        type="button"
                        onClick={() => {
                          setAddMoreToBatchOpen(true);
                          setAddMoreCameraOpen(false);
                          setAddMoreError(null);
                          setAddMoreSuccess(null);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 transition-colors cursor-pointer"
                      >
                        <FiPlus className="w-3.5 h-3.5" />
                        <span>+ Add Batteries</span>
                      </button>
                    )}

                    {/* Only a real truck intake can be cancelled — an
                        awaiting-pickup group has no intake row to delete. */}
                    {resolveBatchIntakeId(selectedBatch) && (
                      <button
                        type="button"
                        onClick={() => setDeleteBatchTarget({ ...selectedBatch, intakeId: resolveBatchIntakeId(selectedBatch) })}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3.5 py-1.5 text-xs font-bold text-red-700 shadow-2xs hover:bg-red-50 dark:border-red-800/40 dark:bg-surface-800 dark:text-red-300 dark:hover:bg-surface-700 transition-colors cursor-pointer"
                      >
                        <FiTrash2 className="w-3.5 h-3.5" />
                        <span>Cancel Batch</span>
                      </button>
                    )}
                  </>
                )}
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-yellow-300 bg-yellow-50 px-3.5 py-1.5 text-xs font-bold text-yellow-800 shadow-2xs dark:border-yellow-700/60 dark:bg-yellow-950/40 dark:text-yellow-300">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-yellow-600 dark:text-yellow-400">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                </svg>
                Waiting for Service
              </span>
            )}
            <span className="rounded-xl bg-emerald-100 px-3.5 py-1.5 text-xs font-black text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-200">
              {selectedBatch.batteries.length} Batteries
            </span>
          </div>
        </div>

        {/* ── Top Status & Volume Breakdown Cards for this Truck Intake ────────────── */}
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4 lg:grid-cols-7 sm:gap-4">
          {/* Card 1: Total in Batch */}
          <button
            type="button"
            onClick={() => setBatchStatusFilter('all')}
            className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-3.5 text-left transition-all duration-200 cursor-pointer ${
              batchStatusFilter === 'all'
                ? 'border-blue-500 bg-blue-100/90 shadow-xs dark:border-blue-400 dark:bg-blue-950/60 ring-2 ring-blue-500/30'
                : 'border-blue-200/80 bg-blue-50/70 hover:border-blue-300 hover:bg-blue-100/60 dark:border-blue-900/40 dark:bg-blue-950/20 dark:hover:border-blue-800'
            }`}
          >
            <div>
              <span className="text-[10.5px] font-bold tracking-wider text-blue-900/80 uppercase dark:text-blue-300">
                Total Units
              </span>
            </div>
            <div className="mt-2.5">
              <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                {batchMetrics.total}
              </span>
              <p className="mt-0.5 text-[10.5px] font-medium text-slate-500 dark:text-neutral-400">
                All in truck
              </p>
            </div>
          </button>

          {/* Card 2: Waiting for Service */}
          <button
            type="button"
            onClick={() => setBatchStatusFilter('reached_workshop')}
            className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-3.5 text-left transition-all duration-200 cursor-pointer ${
              batchStatusFilter === 'reached_workshop'
                ? 'border-amber-500 bg-amber-100/90 shadow-xs dark:border-amber-400 dark:bg-amber-950/60 ring-2 ring-amber-500/30'
                : 'border-amber-200/80 bg-amber-50/70 hover:border-amber-300 hover:bg-amber-100/60 dark:border-amber-900/40 dark:bg-amber-950/20 dark:hover:border-amber-800'
            }`}
          >
            <div>
              <span className="text-[10.5px] font-bold tracking-wider text-amber-800 uppercase dark:text-amber-400">
                Waiting for Service
              </span>
            </div>
            <div className="mt-2.5">
              <span className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400">
                {batchMetrics.reachedWorkshop}
              </span>
              <p className="mt-0.5 text-[10.5px] font-medium text-amber-700/70 dark:text-amber-400/70">
                At workshop
              </p>
            </div>
          </button>

          {/* Card 3: In Service */}
          <button
            type="button"
            onClick={() => setBatchStatusFilter('in_service')}
            className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-3.5 text-left transition-all duration-200 cursor-pointer ${
              batchStatusFilter === 'in_service'
                ? 'border-indigo-500 bg-indigo-100/90 shadow-xs dark:border-indigo-400 dark:bg-indigo-950/60 ring-2 ring-indigo-500/30'
                : 'border-indigo-200/80 bg-indigo-50/70 hover:border-indigo-300 hover:bg-indigo-100/60 dark:border-indigo-900/40 dark:bg-indigo-950/20 dark:hover:border-indigo-800'
            }`}
          >
            <div>
              <span className="text-[10.5px] font-bold tracking-wider text-indigo-800 uppercase dark:text-indigo-400">
                In Service
              </span>
            </div>
            <div className="mt-2.5">
              <span className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400">
                {batchMetrics.inService}
              </span>
              <p className="mt-0.5 text-[10.5px] font-medium text-indigo-700/70 dark:text-indigo-400/70">
                Repairing / Testing
              </p>
            </div>
          </button>

          {/* Card 4: Service Completed */}
          <button
            type="button"
            onClick={() => setBatchStatusFilter('serviced')}
            className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-3.5 text-left transition-all duration-200 cursor-pointer ${
              batchStatusFilter === 'serviced'
                ? 'border-teal-500 bg-teal-100/90 shadow-xs dark:border-teal-400 dark:bg-teal-950/60 ring-2 ring-teal-500/30'
                : 'border-emerald-200/80 bg-emerald-50/70 hover:border-emerald-300 hover:bg-emerald-100/60 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:hover:border-emerald-800'
            }`}
          >
            <div>
              <span className="text-[10.5px] font-bold tracking-wider text-teal-800 uppercase dark:text-teal-400">
                Completed
              </span>
            </div>
            <div className="mt-2.5">
              <span className="text-xl sm:text-2xl font-black text-teal-600 dark:text-teal-400">
                {batchMetrics.serviced}
              </span>
              <p className="mt-0.5 text-[10.5px] font-medium text-teal-700/70 dark:text-teal-400/70">
                Repaired & ready
              </p>
            </div>
          </button>

          {/* Card 5: Unserviceable */}
          <button
            type="button"
            onClick={() => setBatchStatusFilter('unserviceable')}
            className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-3.5 text-left transition-all duration-200 cursor-pointer ${
              batchStatusFilter === 'unserviceable'
                ? 'border-rose-500 bg-rose-100/90 shadow-xs dark:border-rose-400 dark:bg-rose-950/60 ring-2 ring-rose-500/30'
                : 'border-rose-200/80 bg-rose-50/70 hover:border-rose-300 hover:bg-rose-100/60 dark:border-rose-900/40 dark:bg-rose-950/20 dark:hover:border-rose-800'
            }`}
          >
            <div>
              <span className="text-[10.5px] font-bold tracking-wider text-rose-800 uppercase dark:text-rose-400">
                Unserviceable
              </span>
            </div>
            <div className="mt-2.5">
              <span className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400">
                {batchMetrics.unserviceable}
              </span>
              <p className="mt-0.5 text-[10.5px] font-medium text-rose-700/70 dark:text-rose-400/70">
                Cannot service
              </p>
            </div>
          </button>

          {/* Card 6: Returned */}
          <button
            type="button"
            onClick={() => setBatchStatusFilter('returned')}
            className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-3.5 text-left transition-all duration-200 cursor-pointer ${
              batchStatusFilter === 'returned'
                ? 'border-sky-500 bg-sky-100/90 shadow-xs dark:border-sky-400 dark:bg-sky-950/60 ring-2 ring-sky-500/30'
                : 'border-sky-200/80 bg-sky-50/70 hover:border-sky-300 hover:bg-sky-100/60 dark:border-sky-900/40 dark:bg-sky-950/20 dark:hover:border-sky-800'
            }`}
          >
            <div>
              <span className="text-[10.5px] font-bold tracking-wider text-sky-800 uppercase dark:text-sky-400">
                Returned
              </span>
            </div>
            <div className="mt-2.5">
              <span className="text-xl sm:text-2xl font-black text-sky-600 dark:text-sky-400">
                {batchMetrics.returned}
              </span>
              <p className="mt-0.5 text-[10.5px] font-medium text-sky-700/70 dark:text-sky-400/70">
                Delivered back
              </p>
            </div>
          </button>

          {/* Card 7: Recycled */}
          <button
            type="button"
            onClick={() => setBatchStatusFilter('recycled')}
            className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-3.5 text-left transition-all duration-200 cursor-pointer ${
              batchStatusFilter === 'recycled'
                ? 'border-neutral-800 bg-neutral-200/90 shadow-xs dark:border-neutral-300 dark:bg-neutral-800 ring-2 ring-neutral-500/30'
                : 'border-neutral-200/80 bg-neutral-100/80 hover:border-neutral-300 hover:bg-neutral-200/60 dark:border-neutral-700/60 dark:bg-neutral-800/40 dark:hover:border-neutral-600'
            }`}
          >
            <div>
              <span className="text-[10.5px] font-bold tracking-wider text-neutral-800 uppercase dark:text-neutral-300">
                Recycled
              </span>
            </div>
            <div className="mt-2.5">
              <span className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-white">
                {batchMetrics.recycled}
              </span>
              <p className="mt-0.5 text-[10.5px] font-medium text-neutral-600 dark:text-neutral-400">
                Decommissioned
              </p>
            </div>
          </button>
        </div>

        {/* ── Search in this Batch ────────────────────── */}
        <div className="flex items-center justify-between gap-3">
          {batchStatusFilter !== 'all' ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-neutral-400">
                Filtered by:{' '}
                <span className="font-semibold text-slate-700 dark:text-neutral-200 capitalize">
                  {batchStatusFilter === 'reached_workshop' ? 'Waiting for Service' : batchStatusFilter.replace('_', ' ')}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setBatchStatusFilter('all')}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                Clear filter
              </button>
            </div>
          ) : <div />}

          {/* Search Input */}
          <div className="relative w-full md:w-72 shrink-0">
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
              placeholder="Search Battery ID, Serial, Status…"
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-surface-800 dark:text-white dark:placeholder:text-neutral-500"
            />
          </div>
        </div>

        {/* Detailed Full Table for this Truck Batch */}
        <DataTable
          columns={detailTableColumns}
          rows={detailBatteries}
          showRowNumber
          emptyMessage="No batteries match your selected status filter or search in this truck batch."
          maxHeight="calc(100vh - 300px)"
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
              <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-white/10 dark:bg-surface-800">
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
                  setPickedSortGroupIds(new Set());
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {/* Card 1: Total Fleet */}
          <div
            onClick={() => setStatusFilter('')}
            className={`rounded-2xl border p-4 shadow-2xs transition-all cursor-pointer ${
              statusFilter === ''
                ? 'border-slate-400 bg-slate-50/70 dark:border-white/30 dark:bg-surface-800 ring-2 ring-slate-400/20'
                : 'border-slate-200/80 bg-white dark:border-white/10 dark:bg-surface-900 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
                Total Fleet
              </span>
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-neutral-300">
                <FiLayers className="w-3.5 h-3.5" />
              </span>
            </div>
            <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
              {data.length}
            </p>
          </div>

          {/* Card 2: Active in Fleet */}
          <div
            onClick={() => setStatusFilter(statusFilter === 'returned' ? '' : 'returned')}
            className={`rounded-2xl border p-4 shadow-2xs transition-all cursor-pointer ${
              statusFilter === 'returned'
                ? 'border-emerald-500 bg-emerald-50/40 dark:border-emerald-600 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                : 'border-slate-200/80 bg-white dark:border-white/10 dark:bg-surface-900 hover:border-emerald-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Active in Fleet
              </span>
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300">
                <FiCheckCircle className="w-3.5 h-3.5" />
              </span>
            </div>
            <p className="mt-1 text-2xl font-black text-emerald-700 dark:text-emerald-400">
              {data.filter((b) => b.status === 'returned').length}
            </p>
          </div>

          {/* Card 3: In Workshop Repair */}
          <div
            onClick={() => setStatusFilter(statusFilter === 'in_service' ? '' : 'in_service')}
            className={`rounded-2xl border p-4 shadow-2xs transition-all cursor-pointer ${
              statusFilter === 'in_service' || statusFilter === 'in_repair' || statusFilter === 'repaired'
                ? 'border-amber-500 bg-amber-50/40 dark:border-amber-600 dark:bg-amber-950/30 ring-2 ring-amber-500/20'
                : 'border-slate-200/80 bg-white dark:border-white/10 dark:bg-surface-900 hover:border-amber-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                In Workshop Repair
              </span>
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300">
                <FiActivity className="w-3.5 h-3.5" />
              </span>
            </div>
            <p className="mt-1 text-2xl font-black text-amber-700 dark:text-amber-400">
              {data.filter((b) => ['in_repair', 'in_progress', 'in_testing', 'testing', 'repair_testing', 'repaired'].includes(b.status)).length}
            </p>
          </div>

          {/* Card 4: Unserviceable */}
          <div
            onClick={() => setStatusFilter(statusFilter === 'unserviceable' ? '' : 'unserviceable')}
            className={`rounded-2xl border p-4 shadow-2xs transition-all cursor-pointer ${
              statusFilter === 'unserviceable'
                ? 'border-rose-500 bg-rose-50/40 dark:border-rose-600 dark:bg-rose-950/30 ring-2 ring-rose-500/20'
                : 'border-slate-200/80 bg-white dark:border-white/10 dark:bg-surface-900 hover:border-rose-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                Unserviceable
              </span>
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300">
                <FiXCircle className="w-3.5 h-3.5" />
              </span>
            </div>
            <p className="mt-1 text-2xl font-black text-rose-700 dark:text-rose-400">
              {data.filter((b) => ['unserviceable', 'tested_parts_removed', 'unserviceable_parts_removed'].includes(b.status)).length}
            </p>
          </div>

          {/* Card 5: Recycled */}
          <div
            onClick={() => setStatusFilter(statusFilter === 'recycled' ? '' : 'recycled')}
            className={`rounded-2xl border p-4 shadow-2xs transition-all cursor-pointer ${
              statusFilter === 'recycled'
                ? 'border-purple-500 bg-purple-50/40 dark:border-purple-600 dark:bg-purple-950/30 ring-2 ring-purple-500/20'
                : 'border-slate-200/80 bg-white dark:border-white/10 dark:bg-surface-900 hover:border-purple-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                Recycled
              </span>
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-300">
                <FiRefreshCw className="w-3.5 h-3.5" />
              </span>
            </div>
            <p className="mt-1 text-2xl font-black text-purple-700 dark:text-purple-400">
              {data.filter((b) => b.status === 'recycled').length}
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
              <option value="returned">Active in Fleet</option>
              <option value="in_service">In Workshop Repair</option>
              <option value="in_repair">Packed for Repair</option>
              <option value="repaired">Repair Complete</option>
              <option value="unserviceable">Unserviceable</option>
              <option value="recycled">Recycled</option>
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
                maxHeight="calc(100vh - 270px)"
                onScrollBottom={hasMoreAll ? loadMoreAll : null}
                tableLayout="fixed"
              />
              <InfiniteScrollTrigger
                hasMore={hasMoreAll}
                loading={false}
                onVisible={loadMoreAll}
              />
              {filteredAllData.length > 20 && (
                <div className="mt-3 text-center text-xs font-semibold text-slate-400 dark:text-neutral-500">
                  Showing {visibleAllRows.length} of {filteredAllData.length} batteries • Scroll inside table to load more (20 per page)
                </div>
              )}
            </div>
          ) : effectiveBucket === 'pending' ? (
            /* ── Direct per-battery table for In Service & Testing ────── */
            <div>
              <DataTable
                headerColor="blue"
                columns={pendingTableColumns}
                rows={visiblePendingRows}
                showRowNumber
                emptyMessage={meta.empty}
                maxHeight="calc(100vh - 270px)"
                onScrollBottom={hasMorePending ? loadMorePending : null}
                tableLayout="fixed"
              />
              <InfiniteScrollTrigger
                hasMore={hasMorePending}
                loading={false}
                onVisible={loadMorePending}
              />
              {filteredPendingData.length > 20 && (
                <div className="mt-3 text-center text-xs font-semibold text-slate-400 dark:text-neutral-500">
                  Showing {visiblePendingRows.length} of {filteredPendingData.length} batteries • Scroll inside table to load more (20 per page)
                </div>
              )}
            </div>
          ) : (
            /* ── Batch Table / Cards for 'packed' / 'received' ─────────── */
            viewMode === 'batch_table' ? (
              <div>
                <DataTable
                  columns={intakeTableColumns}
                  rows={visibleBatchRows}
                  showRowNumber
                  maxHeight="calc(100vh - 270px)"
                  onScrollBottom={hasMoreBatches ? loadMoreBatches : null}
                  emptyMessage={meta.empty}
                />
                <InfiniteScrollTrigger
                  hasMore={hasMoreBatches}
                  loading={false}
                  onVisible={loadMoreBatches}
                />
                {batches.length > 20 && (
                  <div className="mt-3 text-center text-xs font-semibold text-slate-400 dark:text-neutral-500">
                    Showing {visibleBatchRows.length} of {batches.length} batches • Scroll inside table to load more (20 per page)
                  </div>
                )}
              </div>
            ) : (
              batches.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/50 p-12 text-center dark:border-white/10 dark:bg-surface-900">
                  <p className="text-sm font-semibold text-slate-700 dark:text-neutral-300">
                    {meta.empty}
                  </p>
                  <p className="mt-1 text-xs text-slate-400 dark:text-neutral-500">
                    Click &apos;+ Add Intake&apos; to scan or enter batteries.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {visibleBatchRows.map((batch) => {
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
                                    Waiting for Verify
                                  </span>
                                ) : (
                                  <span className="font-bold text-emerald-700 dark:text-emerald-300">
                                    ✓ Verified
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Card Bottom Links */}
                          <div className="mt-4 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/5">
                            <div className="flex items-center gap-2">
                              {effectiveBucket === 'packed' && batch.intakeStatus !== 'verified' && !batch.verifiedAt && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditBatch(batch);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-300 transition-colors shadow-2xs"
                                >
                                  <FiEdit2 className="w-3 h-3" />
                                  <span>Edit</span>
                                </button>
                              )}
                              {effectiveBucket === 'received' && (
                                batch.intakeStatus === 'pending_verification' ? (
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
                                ) : isReturnRated(batch.intakeId || batch.returnId) ? (
                                  <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500 dark:bg-white/5 dark:text-neutral-400">
                                    <FiStar className="w-3 h-3 fill-amber-400 text-amber-400" />
                                    <span>Rated</span>
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const codes = (batch.batteries || []).map((b) => b.battery_code).filter(Boolean);
                                      setRatingModalData({
                                        isOpen: true,
                                        batteryCode: codes[0] || '',
                                        batteryCodes: codes,
                                        truckNumber: batch.truckNumber || '',
                                        driverName: batch.driverName || '',
                                        returnId: batch.intakeId || batch.returnId || null,
                                      });
                                    }}
                                    className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 hover:bg-amber-100 dark:bg-amber-950/40 dark:border-amber-900/50 dark:text-amber-300 transition-colors shadow-2xs"
                                  >
                                    <FiStar className="w-3 h-3 fill-amber-400 text-amber-400" />
                                    <span>Rate</span>
                                  </button>
                                )
                              )}
                            </div>
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 group-hover:text-blue-700 group-hover:translate-x-0.5 transition-all dark:text-blue-400">
                              <span>View Details</span>
                              <span>→</span>
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <InfiniteScrollTrigger
                    hasMore={hasMoreBatches}
                    loading={false}
                    onVisible={loadMoreBatches}
                  />
                  {batches.length > 20 && (
                    <div className="mt-4 text-center text-xs font-semibold text-slate-400 dark:text-neutral-500">
                      Showing {visibleBatchRows.length} of {batches.length} batches • Scroll down to load more
                    </div>
                  )}
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
          size="7xl"
          className="h-[85vh] max-h-[85vh]"
          onClose={() => setPackModalOpen(false)}
        >
          <form onSubmit={handlePackSubmit} className="flex h-full flex-col gap-5">
            {packSuccess && (
              <div className="shrink-0 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300">
                ✓ {packSuccess}
              </div>
            )}

            {packError && (
              <div className="shrink-0 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
                {packError}
              </div>
            )}

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-12">
              {/* Left: truck details + scan controls */}
              <div className="flex min-h-0 flex-col gap-4 lg:col-span-7">
              <div className="shrink-0">
                <label className={labelClasses}>
                  Truck Number <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={truckNumber}
                  onChange={(e) => setTruckNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. GB21 XYZ or LD68 FGH"
                  autoComplete="off"
                  className={formInputClasses}
                />
              </div>

              <div className="shrink-0">
                <label className={labelClasses}>
                  Driver Name <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={driverName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDriverName(val.charAt(0).toUpperCase() + val.slice(1));
                  }}
                  placeholder="e.g. George Davies"
                  className={formInputClasses}
                />
              </div>

              {/* ── Scan / Add Batteries Box (Exact Admin Format) ─────── */}
              <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-blue-300 bg-slate-50 p-4 dark:border-blue-800/40 dark:bg-surface-950">
                <div className="mb-1 flex shrink-0 items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-neutral-100">
                    Scan Batteries (returning)
                  </h3>
                  <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-slate-500 dark:bg-surface-800 dark:text-neutral-400">
                    {scannedBatteries.length} scanned
                  </span>
                </div>
                <p className="mb-3 shrink-0 text-xs text-slate-500 dark:text-neutral-400">
                  For batteries being packed or intaked for repair. A handheld scanner types straight into the box below — or select from your registered battery list.
                </p>

                {!isLogisticsReady && (
                  <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-300/80 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-300">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-200 text-[11px] font-black text-amber-900 dark:bg-amber-900 dark:text-amber-200">
                      !
                    </span>
                    <span>Please enter Truck Number &amp; Driver Name above first to type battery number, scan, or pick from sort.</span>
                  </div>
                )}

                <div className="flex shrink-0 gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      disabled={!isLogisticsReady}
                      value={scanInput}
                      onChange={(e) => {
                        setScanInput(e.target.value.toUpperCase());
                        setShowScanSuggestions(true);
                      }}
                      onKeyDown={handleScanKeyDown}
                      onFocus={() => {
                        if (isLogisticsReady) setShowScanSuggestions(true);
                      }}
                      placeholder={
                        isLogisticsReady
                          ? 'Scan, type code or pick from suggestions…'
                          : 'Enter Truck Number & Driver Name above first…'
                      }
                      autoComplete="off"
                      className={`${formInputClasses} ${
                        !isLogisticsReady ? 'cursor-not-allowed opacity-60 bg-slate-100 dark:bg-surface-900' : ''
                      }`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddBattery(scanInput)}
                    disabled={!isLogisticsReady || !scanInput.trim()}
                    className="shrink-0 rounded-md bg-brand-600 px-3.5 py-2.5 text-sm font-medium text-white shadow-xs hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    disabled={!isLogisticsReady}
                    onClick={() => setCameraOpen((prev) => !prev)}
                    className="shrink-0 rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-200 dark:hover:bg-surface-700"
                  >
                    {cameraOpen ? 'Close Camera' : 'Use Camera'}
                  </button>
                  <button
                    type="button"
                    disabled={!isLogisticsReady}
                    onClick={openPickFromSort}
                    className="shrink-0 rounded-md border border-emerald-300 bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
                    title={
                      isLogisticsReady
                        ? 'Import batteries from a pre-built Battery Sorting group'
                        : 'Enter Truck Number & Driver Name first'
                    }
                  >
                    Pick from Sort
                  </button>
                </div>

                {/* ── Inline Suggestions List (Fully visible, never clipped) ── */}
                {showScanSuggestions && (
                  <div className="mt-3 shrink-0 overflow-hidden rounded-xl border border-blue-300 bg-white shadow-sm dark:border-blue-800/60 dark:bg-surface-900">
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
                            className="flex w-full items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2 text-left text-xs transition-all hover:border-blue-400 hover:bg-blue-600 hover:text-white group dark:border-white/5 dark:bg-surface-800 dark:hover:border-blue-500 dark:hover:bg-blue-600"
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
                  <div className="mt-3 shrink-0">
                    <QrScanner
                      onScan={(value) => {
                        handleAddBattery(value);
                        setCameraOpen(false);
                      }}
                      onClose={() => setCameraOpen(false)}
                    />
                  </div>
                )}
              </div>
              </div>

              {/* Right: added batteries list — its own scroll area */}
              <div className="flex min-h-0 flex-col lg:col-span-5">
                <div className="mb-2 flex shrink-0 items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-neutral-300">
                    Added Batteries
                  </h3>
                  <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-slate-500 shadow-xs dark:bg-surface-800 dark:text-neutral-400">
                    {scannedBatteries.length} added
                  </span>
                </div>
                <div className="min-h-[220px] flex-1 overflow-y-auto rounded-xl border border-slate-200 dark:border-white/10">
                  {scannedBatteries.length === 0 ? (
                    <div className="flex h-full items-center justify-center p-6 text-center text-xs text-slate-400 dark:text-neutral-500">
                      Batteries you add on the left will appear here.
                    </div>
                  ) : (
                    <ul className="flex flex-col gap-2 p-2">
                      {scannedBatteries.map((b, idx) => (
                        <li
                          key={b.id}
                          className="flex shrink-0 flex-col gap-2 rounded-lg border border-blue-200 bg-white p-2.5 dark:border-blue-900/40 dark:bg-surface-900"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 dark:bg-white/10 dark:text-neutral-300">
                                {idx + 1}
                              </span>
                              <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                                {b.code}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeScanned(idx)}
                              className="text-xs font-bold text-red-500 hover:text-red-700 p-1"
                              title="Remove"
                            >
                              ✕
                            </button>
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <input
                              type="text"
                              value={b.issue}
                              onChange={(e) => updateScannedField(idx, 'issue', e.target.value)}
                              placeholder="Defect reason / notes (optional)"
                              className="w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs dark:border-white/10 dark:bg-surface-800 dark:text-white"
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            {/* Sticky Frosted-Glass Bottom Right Actions Bar */}
            <div className="sticky bottom-0 z-20 -mx-4 -mb-4 sm:-mx-6 sm:-mb-5 mt-auto flex shrink-0 flex-col gap-3 border-t border-slate-200/90 bg-white/95 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-white/10 dark:bg-surface-900/95 backdrop-blur-md">
              <div className="flex items-center gap-2">
                {scannedBatteries.length > 0 ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{scannedBatteries.length} batteries staged for intake</span>
                  </span>
                ) : (
                  <span className="text-xs font-medium text-slate-500 dark:text-neutral-400">
                    Scan or pick batteries on the left to add them
                  </span>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setPackModalOpen(false)}
                  className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-300 dark:hover:bg-surface-700 shadow-2xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={packing || (scannedBatteries.length === 0 && !scanInput.trim())}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                >
                  <span>✓</span>
                  <span>
                    {packing
                      ? 'Recording Intake…'
                      : `Record Intake (${scannedBatteries.length + (scanInput.trim() ? 1 : 0)} Batteries)`}
                  </span>
                </button>
              </div>
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
            availableSortGroups.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center dark:border-white/10 dark:bg-surface-900">
                <p className="text-sm font-semibold text-slate-700 dark:text-neutral-300">
                  {sortGroups.length === 0
                    ? 'No sort groups yet.'
                    : 'All sort groups are already selected or packed.'}
                </p>
                <p className="mt-1 text-xs text-slate-400 dark:text-neutral-500">
                  {sortGroups.length === 0
                    ? 'Build one on the Battery Sorting page, then pick it from here next time.'
                    : 'There are no remaining unpacked batteries in your sort groups.'}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 max-h-96 overflow-y-auto">
                {availableSortGroups.map((group) => {
                  const remaining = (group.batteries || []).filter((code) => !isAlreadyPacked(code));
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => reviewSortGroup(group)}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-2xs transition-all hover:border-emerald-500/80 hover:bg-emerald-50/50 dark:border-white/10 dark:bg-surface-900 dark:hover:border-emerald-400/60 dark:hover:bg-emerald-950/20"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">
                          {group.name}
                        </span>
                        <span className="text-xs text-slate-400 dark:text-neutral-500">
                          {remaining.length} {remaining.length === 1 ? 'battery' : 'batteries'} available
                          {remaining.length < (group.batteries || []).length && (
                            <span className="ml-1 text-[11px] text-amber-600 dark:text-amber-400">
                              ({(group.batteries || []).length - remaining.length} already packed)
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                        Review →
                      </span>
                    </button>
                  );
                })}
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
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center dark:border-white/10 dark:bg-surface-900">
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
          onSuccess={(verifiedData, returnBatteries) => {
            loadData();
            const allBatchBatteries = (returnBatteries && returnBatteries.length > 0)
              ? returnBatteries
              : (verifyTargetReturn?.batteries || []);
            const codes = allBatchBatteries.map((b) => b.battery_code).filter(Boolean);
            setRatingModalData({
              isOpen: true,
              batteryCode: codes[0] || '',
              batteryCodes: codes,
              truckNumber: verifyTargetReturn?.truckNumber || '',
              driverName: verifyTargetReturn?.driverName || '',
              returnId: verifyTargetReturn?.intakeId || verifyTargetReturn?.returnId || null,
            });
            setVerifyTargetReturn(null);
          }}
        />
      )}

      {/* ── Rating & Service Feedback Modal (For whole truck delivery or single battery) ── */}
      {ratingModalData.isOpen && (
        <RatingModal
          batteryCode={ratingModalData.batteryCode}
          batteryCodes={ratingModalData.batteryCodes}
          truckNumber={ratingModalData.truckNumber}
          driverName={ratingModalData.driverName}
          returnId={ratingModalData.returnId}
          clientId={user?.client_id || user?.id}
          onClose={() =>
            setRatingModalData({
              isOpen: false,
              batteryCode: '',
              batteryCodes: [],
              truckNumber: '',
              driverName: '',
              returnId: null,
            })
          }
          onSuccess={() => {
            loadData();
            loadRatedReturns();
          }}
        />
      )}

      {/* ── Edit Batch Modal (Logistics, Add Battery, Remove Battery) ── */}
      {editBatchTarget && (
        <Modal
          size="3xl"
          title={`Edit Truck Batch — ${editBatchTarget.truckNumber || 'Intake'}`}
          description="Update truck information, add new batteries to this intake shipment, or remove units."
          onClose={() => {
            setEditBatchTarget(null);
            setEditBatchError(null);
            setEditBatchSuccess(null);
          }}
        >
          <div className="flex flex-col gap-5">
            {editBatchSuccess && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                {editBatchSuccess}
              </div>
            )}

            {editBatchError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
                {editBatchError}
              </div>
            )}

            {/* 1. Truck & Driver Metadata */}
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-white/10 dark:bg-surface-800/60">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-200 mb-3 flex items-center gap-1.5">
                <FiTruck className="w-3.5 h-3.5 text-blue-500" />
                <span>Truck Logistics & Vehicle Info</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClasses}>
                    Truck Number <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editBatchTruck}
                    onChange={(e) => setEditBatchTruck(e.target.value.toUpperCase())}
                    placeholder="e.g. GB21 XYZ or LD68 FGH"
                    autoComplete="off"
                    className={formInputClasses}
                  />
                </div>
                <div>
                  <label className={labelClasses}>
                    Driver Name <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editBatchDriver}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditBatchDriver(val.charAt(0).toUpperCase() + val.slice(1));
                    }}
                    placeholder="e.g. George Davies"
                    className={formInputClasses}
                  />
                </div>
                <div className="sm:col-span-2 flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleEditBatchSave}
                    disabled={editBatchSaving}
                    style={{ backgroundColor: accent }}
                    className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-2xs hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {editBatchSaving ? (
                      <>
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span>Saving…</span>
                      </>
                    ) : (
                      <>
                        <FiCheckCircle className="w-3.5 h-3.5" />
                        <span>Save Truck &amp; Driver Info</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Batteries in this Intake Batch */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-white/10 dark:bg-surface-800">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-200">
                    Batteries in this Intake ({editBatchBatteries.length} Loaded)
                  </h4>
                </div>
                <span className="text-[11px] text-slate-400 dark:text-neutral-500">
                  {editBatchBatteries.length === 1 ? '1 battery' : `${editBatchBatteries.length} batteries`}
                </span>
              </div>

              {editBatchBatteries.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400 dark:border-white/10 dark:text-neutral-500">
                  No batteries in this intake batch. Use the form below to add batteries.
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100 dark:divide-white/5">
                  {editBatchBatteries.map((b, idx) => (
                    <div
                      key={b.id || b.battery_code || idx}
                      className="pt-2 first:pt-0 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span className="font-mono text-slate-400 dark:text-neutral-500 w-5 text-center font-bold">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-800/40 px-2 py-0.5 rounded-lg">
                              {b.battery_code || b.code}
                            </span>
                            {b.serial_number && (
                              <span className="font-mono text-slate-600 dark:text-neutral-300 text-[11px]">
                                SN: {b.serial_number}
                              </span>
                            )}
                          </div>
                          {b.notes && (
                            <p className="text-[11px] text-slate-500 dark:text-neutral-400 truncate mt-0.5">
                              {b.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleEditModalRemoveBattery(b)}
                        disabled={editBatchRemovingId === (b.id || b.battery_code || b.code)}
                        className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50/80 px-2.5 py-1 text-xs font-bold text-red-700 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-900/50 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                        title="Remove from this intake"
                      >
                        {editBatchRemovingId === b.id ? (
                          <div className="h-3 w-3 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                        ) : (
                          <FiTrash2 className="w-3.5 h-3.5" />
                        )}
                        <span>Remove</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Add Another Battery to this Intake Batch */}
            <div className="rounded-2xl border border-blue-200/90 bg-blue-50/40 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
              <div className="flex items-center justify-between mb-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                  <FiPlus className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Add Another Battery to this Intake</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setEditBatchAddCamera((prev) => !prev)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 dark:text-blue-400 cursor-pointer"
                >
                  <FiCamera className="w-3.5 h-3.5" />
                  <span>{editBatchAddCamera ? 'Close Camera' : 'Scan QR'}</span>
                </button>
              </div>

              {editBatchAddCamera && (
                <div className="mb-3 rounded-xl overflow-hidden border border-blue-200 dark:border-blue-800/60">
                  <QrScanner
                    onScan={(scanned) => {
                      const code = extractBatteryCode(scanned);
                      if (code) {
                        handleEditModalAddBattery(code);
                      }
                    }}
                    onClose={() => setEditBatchAddCamera(false)}
                  />
                </div>
              )}

              <div className="space-y-3">
                <div className="relative">
                  <input
                    type="text"
                    value={editBatchAddInput}
                    onChange={(e) => {
                      setEditBatchAddInput(e.target.value.toUpperCase());
                      setEditBatchShowSuggestions(true);
                    }}
                    onFocus={() => setEditBatchShowSuggestions(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (editBatchAddInput.trim()) {
                          handleEditModalAddBattery();
                        }
                      }
                    }}
                    placeholder="Type battery ID (e.g. UBE-0012) or scan QR code…"
                    className="w-full rounded-xl border border-blue-300 bg-white px-3.5 py-2 text-xs font-mono font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden dark:border-blue-800/60 dark:bg-surface-800 dark:text-white dark:placeholder:text-neutral-500"
                  />

                  {/* Suggestions Dropdown */}
                  {editBatchShowSuggestions && editBatchScanSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-xl border border-blue-200 bg-white p-1.5 shadow-xl dark:border-blue-800/60 dark:bg-surface-900">
                      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
                        Available Fleet Batteries
                      </div>
                      {editBatchScanSuggestions.map((b) => (
                        <button
                          key={b.id || b.battery_code}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            handleEditModalAddBattery(b.battery_code, b.serial_number || '', b.notes || '');
                          }}
                          className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/30"
                        >
                          <span className="font-mono font-bold text-blue-700 dark:text-blue-400">
                            {b.battery_code}
                          </span>
                          {b.serial_number && (
                            <span className="text-[11px] text-slate-500 dark:text-neutral-400 font-mono">
                              SN: {b.serial_number}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    value={editBatchAddSerial}
                    onChange={(e) => setEditBatchAddSerial(e.target.value)}
                    placeholder="Serial Number (Optional)"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden dark:border-white/10 dark:bg-surface-800 dark:text-white dark:placeholder:text-neutral-500"
                  />
                  <input
                    type="text"
                    value={editBatchAddNotes}
                    onChange={(e) => setEditBatchAddNotes(e.target.value)}
                    placeholder="Fault / Defect Note (Optional)"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden dark:border-white/10 dark:bg-surface-800 dark:text-white dark:placeholder:text-neutral-500"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleEditModalAddBattery()}
                    disabled={editBatchAddLoading || !editBatchAddInput.trim()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {editBatchAddLoading ? (
                      <>
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span>Adding Battery…</span>
                      </>
                    ) : (
                      <>
                        <FiPlus className="w-3.5 h-3.5" />
                        <span>Add to Intake</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-white/5">
              <button
                type="button"
                onClick={() => {
                  setEditBatchTarget(null);
                  setEditBatchError(null);
                  setEditBatchSuccess(null);
                }}
                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-white/10 cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleEditBatchSave}
                disabled={editBatchSaving}
                style={{ backgroundColor: accent }}
                className="rounded-xl px-5 py-2 text-xs font-bold text-white shadow-xs hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer"
              >
                {editBatchSaving ? 'Saving Changes…' : 'Save & Done'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Edit Battery in Batch Modal ───────────────────────────────── */}
      {editBatteryTarget && (
        <Modal
          title={`Edit Battery — ${editBatteryTarget.battery_code}`}
          description="Update the physical serial number or fault/defect notes for this battery."
          onClose={() => {
            setEditBatteryTarget(null);
            setEditBatteryError(null);
          }}
        >
          <form onSubmit={handleEditBatterySave} className="flex flex-col gap-4">
            {editBatteryError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
                {editBatteryError}
              </div>
            )}
            <div>
              <label className={labelClasses}>Physical Battery Number (Manufacturer Serial)</label>
              <input
                type="text"
                value={editBatterySerial}
                onChange={(e) => setEditBatterySerial(e.target.value)}
                placeholder="e.g. SN-88213"
                autoComplete="off"
                className={formInputClasses}
              />
            </div>
            <div>
              <label className={labelClasses}>Defect / Fault Notes</label>
              <textarea
                rows={3}
                value={editBatteryNotes}
                onChange={(e) => setEditBatteryNotes(e.target.value)}
                placeholder="e.g. BMS error code E04, water ingress, degraded range…"
                className={formInputClasses}
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
                These notes are forwarded to the repair technicians at the workshop.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
              <button
                type="button"
                onClick={() => {
                  setEditBatteryTarget(null);
                  setEditBatteryError(null);
                }}
                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editBatterySaving}
                style={{ backgroundColor: accent }}
                className="rounded-xl px-5 py-2 text-xs font-bold text-white shadow-xs hover:opacity-90 disabled:opacity-50"
              >
                {editBatterySaving ? 'Saving…' : 'Save Battery'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Remove Battery Confirmation Modal ──────────────────────────── */}
      {removeBatteryTarget && (
        <Modal
          title="Remove Battery from Batch?"
          description={`Are you sure you want to remove ${removeBatteryTarget.battery.battery_code} from this truck intake?`}
          onClose={() => {
            setRemoveBatteryTarget(null);
            setRemoveBatteryError(null);
          }}
        >
          <div className="flex flex-col gap-4">
            {removeBatteryError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
                {removeBatteryError}
              </div>
            )}
            <p className="text-xs text-slate-600 dark:text-neutral-300">
              The battery <strong className="font-mono text-slate-900 dark:text-white">{removeBatteryTarget.battery.battery_code}</strong> will be unlinked from this truck dispatch and returned to your available fleet inventory.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
              <button
                type="button"
                onClick={() => {
                  setRemoveBatteryTarget(null);
                  setRemoveBatteryError(null);
                }}
                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-white/10"
              >
                Keep in Batch
              </button>
              <button
                type="button"
                onClick={handleRemoveBatteryConfirm}
                disabled={removeBatteryLoading}
                className="rounded-xl bg-red-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {removeBatteryLoading ? 'Removing…' : 'Remove from Batch'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Delete / Cancel Batch Confirmation Modal ──────────────────── */}
      {deleteBatchTarget && (
        <Modal
          title="Cancel Truck Intake Batch?"
          description={`Are you sure you want to cancel and delete Truck ${deleteBatchTarget.truckNumber || 'Batch'}?`}
          onClose={() => {
            setDeleteBatchTarget(null);
            setDeleteBatchError(null);
          }}
        >
          <div className="flex flex-col gap-4">
            {deleteBatchError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
                {deleteBatchError}
              </div>
            )}
            <p className="text-xs text-slate-600 dark:text-neutral-300">
              This will completely cancel the intake batch. All <strong className="text-slate-900 dark:text-white">{deleteBatchTarget.batteries?.length || 0} batteries</strong> in this batch will be automatically unlinked and safely returned to your active fleet inventory.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
              <button
                type="button"
                onClick={() => {
                  setDeleteBatchTarget(null);
                  setDeleteBatchError(null);
                }}
                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-white/10"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={handleDeleteBatchConfirm}
                disabled={deleteBatchLoading}
                className="rounded-xl bg-red-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleteBatchLoading ? 'Cancelling…' : 'Cancel & Delete Batch'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Add Batteries to Existing Batch Modal ────────────────────── */}
      {addMoreToBatchOpen && selectedBatch && (
        <Modal
          title={`Add Batteries to Truck ${selectedBatch.truckNumber || ''}`}
          description="Scan or choose additional batteries to include in this truck dispatch."
          size="3xl"
          className="min-h-[520px]"
          onClose={() => setAddMoreToBatchOpen(false)}
        >
          <form onSubmit={handleAddMoreToBatchSubmit} className="flex flex-col gap-5">
            {addMoreSuccess && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300">
                ✓ {addMoreSuccess}
              </div>
            )}
            {addMoreError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
                {addMoreError}
              </div>
            )}

            <div className="rounded-xl border border-blue-300 bg-slate-50 p-4 dark:border-blue-800/40 dark:bg-surface-950">
              <div className="mb-1 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-neutral-100">
                  Scan or Pick Batteries
                </h3>
                <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-slate-500 dark:bg-surface-800 dark:text-neutral-400">
                  {addMoreBatteries.length} selected
                </span>
              </div>
              <p className="mb-3 text-xs text-slate-500 dark:text-neutral-400">
                Type or scan a battery code to add to Truck {selectedBatch.truckNumber || 'Batch'}.
              </p>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={addMoreScanInput}
                    onChange={(e) => {
                      setAddMoreScanInput(e.target.value.toUpperCase());
                      setAddMoreShowSuggestions(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddMoreBattery(addMoreScanInput);
                      }
                    }}
                    onFocus={() => setAddMoreShowSuggestions(true)}
                    placeholder="Scan, type code or pick from suggestions…"
                    autoComplete="off"
                    className={formInputClasses}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleAddMoreBattery(addMoreScanInput)}
                  disabled={!addMoreScanInput.trim()}
                  className="shrink-0 rounded-md bg-brand-600 px-3.5 py-2.5 text-sm font-medium text-white shadow-xs hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setAddMoreCameraOpen((prev) => !prev)}
                  className="shrink-0 rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-200 dark:hover:bg-surface-700"
                >
                  {addMoreCameraOpen ? 'Close Camera' : 'Use Camera'}
                </button>
              </div>

              {/* Suggestions */}
              {addMoreShowSuggestions && (
                <div className="mt-3 overflow-hidden rounded-xl border border-blue-300 bg-white shadow-sm dark:border-blue-800/60 dark:bg-surface-900">
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-3.5 py-2 text-[11px] font-bold text-slate-600 dark:border-white/10 dark:bg-surface-800/80 dark:text-neutral-300">
                    <span>Available Registered Batteries ({addMoreScanSuggestions.length})</span>
                    <button
                      type="button"
                      onClick={() => setAddMoreShowSuggestions(false)}
                      className="rounded px-2 py-0.5 text-[11px] font-semibold text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
                    >
                      Hide
                    </button>
                  </div>
                  <div className="max-h-52 overflow-y-auto p-2 space-y-1">
                    {addMoreScanSuggestions.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-500 dark:text-neutral-400">
                        {addMoreScanInput.trim() ? `Press 'Add' to include "${addMoreScanInput}".` : 'No other registered batteries available.'}
                      </div>
                    ) : (
                      addMoreScanSuggestions.map((b) => (
                        <button
                          key={b.id || b.battery_code}
                          type="button"
                          onClick={() => {
                            handleAddMoreBattery(b.battery_code, b.serial_number);
                            setAddMoreShowSuggestions(false);
                          }}
                          className="flex w-full items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2 text-left text-xs transition-all hover:border-blue-400 hover:bg-blue-600 hover:text-white group dark:border-white/5 dark:bg-surface-800 dark:hover:border-blue-500 dark:hover:bg-blue-600"
                        >
                          <div className="font-mono font-bold text-slate-900 group-hover:text-white dark:text-white">
                            {b.battery_code}
                            {b.serial_number && <span className="ml-2 text-[11px] font-normal text-slate-400 dark:text-neutral-400 group-hover:text-blue-100">({b.serial_number})</span>}
                          </div>
                          <span className="rounded-lg bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 group-hover:bg-white group-hover:text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                            + Add
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              {addMoreCameraOpen && (
                <div className="mt-3">
                  <QrScanner
                    onScan={(value) => {
                      handleAddMoreBattery(value);
                      setAddMoreCameraOpen(false);
                    }}
                    onClose={() => setAddMoreCameraOpen(false)}
                  />
                </div>
              )}

              {addMoreBatteries.length > 0 && (
                <ul className="mt-3 flex flex-col gap-2 max-h-52 overflow-y-auto no-scrollbar">
                  {addMoreBatteries.map((b, idx) => (
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
                          onChange={(e) => {
                            const val = e.target.value;
                            setAddMoreBatteries((prev) => prev.map((item, i) => (i === idx ? { ...item, serial: val } : item)));
                          }}
                          placeholder="Serial (optional)"
                          className="w-28 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs dark:border-white/10 dark:bg-surface-800 dark:text-white"
                        />
                        <input
                          type="text"
                          value={b.issue}
                          onChange={(e) => {
                            const val = e.target.value;
                            setAddMoreBatteries((prev) => prev.map((item, i) => (i === idx ? { ...item, issue: val } : item)));
                          }}
                          placeholder="Defect reason (optional)"
                          className="flex-1 sm:w-44 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs dark:border-white/10 dark:bg-surface-800 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() => setAddMoreBatteries((prev) => prev.filter((_, i) => i !== idx))}
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

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
              <button
                type="button"
                onClick={() => setAddMoreToBatchOpen(false)}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addMoreLoading || (addMoreBatteries.length === 0 && !addMoreScanInput.trim())}
                style={{ backgroundColor: accent }}
                className="rounded-md px-5 py-2 text-sm font-medium text-white shadow-xs hover:opacity-90 disabled:opacity-50 transition-all"
              >
                {addMoreLoading ? 'Saving…' : `Add ${addMoreBatteries.length + (addMoreScanInput.trim() ? 1 : 0)} Batteries`}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Truck Intake Success Modal ─────────────────────────────────── */}
      {showIntakeSuccessModal && intakeSuccessResult && (
        <Modal onClose={() => setShowIntakeSuccessModal(false)}>
          <div className="flex flex-col items-center justify-center p-3 sm:p-5 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300 shadow-md ring-8 ring-emerald-50 dark:ring-emerald-950/30 animate-in zoom-in-75 duration-200">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8">
                <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.74-5.25Z" clipRule="evenodd" />
              </svg>
            </div>

            <h3 className="mt-4 text-lg font-black text-slate-900 dark:text-white">
              Truck Intake Recorded Successfully!
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400 max-w-sm">
              Your intake dispatch has been registered. The workshop has been notified and will verify the batteries upon arrival.
            </p>

            <div className="mt-5 w-full rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 text-left dark:border-white/10 dark:bg-surface-850">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-neutral-400 uppercase tracking-wider block">
                    Truck Number
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white font-mono">
                    {intakeSuccessResult.truckNumber || intakeSuccessResult.intake?.truck_number || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-neutral-400 uppercase tracking-wider block">
                    Driver
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {intakeSuccessResult.driverName || intakeSuccessResult.intake?.driver_name || 'Fleet Driver'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-neutral-400 uppercase tracking-wider block">
                    Batteries Recorded
                  </span>
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                    {intakeSuccessResult.count} {intakeSuccessResult.count === 1 ? 'pack' : 'packs'}
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
                onClick={() => setShowIntakeSuccessModal(false)}
                className="w-full rounded-xl bg-slate-900 py-2.5 text-xs font-black text-white shadow-xs hover:bg-emerald-600 dark:bg-surface-800 dark:hover:bg-emerald-600 transition-all cursor-pointer"
              >
                ✓ Done
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default ClientBatteriesPage;
