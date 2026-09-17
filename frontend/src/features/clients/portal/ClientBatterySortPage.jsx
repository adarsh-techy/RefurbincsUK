import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import * as XLSX from 'xlsx';
import apiClient from '../../../services/api-client';
import DataTable from '../../../components/ui/table/DataTable';
import Modal from '../../../components/ui/overlays/Modal';
import ConfirmModal from '../../../components/ui/overlays/ConfirmModal';
import AlertModal from '../../../components/ui/overlays/AlertModal';
import QrScanner from '../../../components/ui/primitives/QrScanner';
import { ClientStatusBadge } from '../../../components/ui/primitives/Badge';
import extractBatteryCode from '../../../utils/extract-battery-code';
import { useTheme } from '../../../context/ThemeContext';

const formInputClasses =
  'w-full rounded-md border border-blue-300 bg-blue-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 dark:border-blue-800/40 dark:bg-blue-900/20 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/30';

// A battery is registered with status 'returned' from day one — it means
// "currently with the client", not "came back from a service visit" — so a
// battery that has never actually been through truck intake, repair, or a
// return dispatch shouldn't show a "Returned" badge; it's simply never been
// serviced yet.
function hasBeenServiced(row) {
  return Boolean(row.truck_intake_id || row.intake_id || row.last_repaired_at || row.return_id);
}

function isBatteryPackedForRepair(battery) {
  if (!battery) return false;
  return Boolean(
    battery.status === 'in_repair' ||
    battery.status === 'in_progress' ||
    battery.status === 'in_testing'
  );
}

function getBatteryPackedDate(battery) {
  if (!battery) return null;
  return battery.intake_at || battery.created_at;
}

function storageKey(userId) {
  return `battery-sort-groups-${userId || 'guest'}`;
}

function loadGroups(userId) {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveGroups(userId, groups) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(groups));
  } catch {
    // non-blocking — sorting is a local convenience tool
  }
}

function formatDate(val) {
  if (!val) return '—';
  return new Date(val).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function ClientBatterySortPage() {
  const { customTheme } = useTheme();
  const accent = customTheme?.accentColor || '#10b981';
  const { user } = useSelector((state) => state.auth);

  const [registeredBatteries, setRegisteredBatteries] = useState([]);
  const [groups, setGroups] = useState(() => loadGroups(user?.id));

  // Create / rename group modal
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [nameModalMode, setNameModalMode] = useState('create'); // 'create' | 'rename'
  const [nameInput, setNameInput] = useState('');
  const [nameTargetId, setNameTargetId] = useState(null);
  const [duplicateNameAlert, setDuplicateNameAlert] = useState(null);

  // Active group detail view
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [detailViewMode, setDetailViewMode] = useState('table'); // 'table' | 'cards'
  const [scanInput, setScanInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [addError, setAddError] = useState(null);
  const [groupSearch, setGroupSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saveFeedback, setSaveFeedback] = useState(false);
  const [savedGroupBatteries, setSavedGroupBatteries] = useState(null);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [saveSuccessModal, setSaveSuccessModal] = useState(false);

  useEffect(() => {
    apiClient
      .get('/clients/me/batteries')
      .then(({ data: result }) => setRegisteredBatteries(result.data || []))
      .catch(() => {
        // non-blocking — used only for suggestions/status lookup
      });
  }, []);

  const activeGroup = useMemo(
    () => groups.find((g) => g.id === activeGroupId) || null,
    [groups, activeGroupId]
  );

  const hasUnsavedChanges = Boolean(
    activeGroup &&
    savedGroupBatteries !== null &&
    JSON.stringify(activeGroup.batteries || []) !== JSON.stringify(savedGroupBatteries || [])
  );

  function openGroup(group) {
    setActiveGroupId(group.id);
    setSavedGroupBatteries([...(group.batteries || [])]);
  }

  function handleSaveGroup() {
    saveGroups(user?.id, groups);
    if (activeGroup) {
      setSavedGroupBatteries([...(activeGroup.batteries || [])]);
    }
    setSaveFeedback(true);
    setSaveSuccessModal(true);
    setTimeout(() => setSaveFeedback(false), 2500);
  }

  function handleBackClick() {
    if (hasUnsavedChanges) {
      setShowUnsavedModal(true);
    } else {
      setActiveGroupId(null);
      setSavedGroupBatteries(null);
    }
  }

  function handleSaveAndLeave() {
    saveGroups(user?.id, groups);
    setShowUnsavedModal(false);
    setActiveGroupId(null);
    setSavedGroupBatteries(null);
  }

  function handleDiscardAndLeave() {
    if (activeGroupId && savedGroupBatteries !== null) {
      setGroups((prev) =>
        prev.map((g) =>
          g.id === activeGroupId ? { ...g, batteries: savedGroupBatteries } : g
        )
      );
    }
    setShowUnsavedModal(false);
    setActiveGroupId(null);
    setSavedGroupBatteries(null);
  }

  const codeToBattery = useMemo(() => {
    const map = new Map();
    registeredBatteries.forEach((b) => map.set(b.battery_code.toUpperCase(), b));
    return map;
  }, [registeredBatteries]);

  function handleExportExcel() {
    if (!activeGroup || !activeGroup.batteries || activeGroup.batteries.length === 0) return;

    const exportData = activeGroup.batteries.map((code) => ({
      'Battery ID': code,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    const cleanSheetName = (activeGroup.name || 'Sorted Batteries')
      .replace(/[:\\/?*\[\]]/g, '_')
      .trim()
      .slice(0, 31) || 'Batteries';

    XLSX.utils.book_append_sheet(workbook, worksheet, cleanSheetName);

    worksheet['!cols'] = [
      { wch: 20 },
    ];

    const safeName = (activeGroup.name || 'Sorted_Batteries')
      .replace(/[\\/:*?"<>|]/g, '_')
      .trim() || 'Sorted_Batteries';
    XLSX.writeFile(workbook, `${safeName}.xlsx`);
  }

  const sortedTableColumns = useMemo(() => [
    {
      key: 'battery_code',
      label: 'Battery ID',
      render: (row) => {
        const isPackedForRepair = isBatteryPackedForRepair(row.match);
        return (
          <Link
            to={`/batteries/${encodeURIComponent(row.code)}`}
            className={`font-mono font-bold hover:underline ${
              isPackedForRepair
                ? 'text-red-700 dark:text-red-400 dark:hover:text-red-300'
                : 'text-blue-700 dark:text-blue-400'
            }`}
          >
            {row.code}
          </Link>
        );
      },
    },
    {
      key: 'serial_number',
      label: 'Physical Serial Number',
      render: (row) => {
        return row.match?.serial_number ? (
          <span className="font-semibold text-slate-800 dark:text-neutral-100 font-mono">
            {row.match.serial_number}
          </span>
        ) : (
          <span className="text-xs text-slate-400 dark:text-neutral-500">—</span>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => {
        const isPackedForRepair = isBatteryPackedForRepair(row.match);
        const packedDate = getBatteryPackedDate(row.match);

        return (
          <div className="flex flex-wrap items-center gap-1.5">
            {row.match && hasBeenServiced(row.match) ? (
              <ClientStatusBadge status={row.match.status} />
            ) : row.match ? (
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
                Not yet serviced
              </span>
            ) : (
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Not in your fleet
              </span>
            )}

            {isPackedForRepair && (
              <span className="rounded-md bg-red-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-red-800 dark:border dark:border-red-500/30 dark:bg-red-950/60 dark:text-red-300">
                Packed to Service{packedDate ? ` (${formatDate(packedDate)})` : ''}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'notes',
      label: 'Defect Notes',
      render: (row) => (
        <span className="text-xs text-slate-600 dark:text-neutral-300">
          {row.match?.notes || '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <Link
            to={`/batteries/${encodeURIComponent(row.code)}`}
            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-blue-600 hover:text-white transition-colors dark:bg-white/10 dark:text-neutral-200 dark:hover:bg-blue-600"
          >
            <span>History</span>
            <span>→</span>
          </Link>
          <button
            type="button"
            onClick={() => removeBatteryFromActiveGroup(row.code)}
            className="rounded-lg p-1 text-slate-400 hover:bg-red-100 hover:text-red-600 dark:text-neutral-500 dark:hover:bg-red-950/50 dark:hover:text-red-300"
            title="Remove from group"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      ),
    },
  ], []);

  // Only suggest batteries actually in the client's hands right now — not
  // ones away at the workshop for repair/testing, or unserviceable.
  const NOT_WITH_CLIENT_STATUSES = useMemo(
    () => new Set(['in_repair', 'in_progress', 'in_testing', 'repaired', 'unserviceable']),
    []
  );

  // Map of all currently sorted battery codes to their group name across all groups
  const allSortedBatteryMap = useMemo(() => {
    const map = new Map();
    groups.forEach((g) => {
      (g.batteries || []).forEach((code) => {
        map.set(code.toUpperCase(), g.name);
      });
    });
    return map;
  }, [groups]);

  const scanSuggestions = useMemo(() => {
    const q = scanInput.trim().toLowerCase();
    return registeredBatteries
      .filter((b) => !allSortedBatteryMap.has(b.battery_code.toUpperCase()))
      .filter((b) => !NOT_WITH_CLIENT_STATUSES.has(b.status))
      .filter((b) => {
        if (!q) return true;
        return (
          b.battery_code.toLowerCase().includes(q) ||
          (b.serial_number && b.serial_number.toLowerCase().includes(q))
        );
      })
      .slice(0, 8);
  }, [registeredBatteries, scanInput, allSortedBatteryMap, NOT_WITH_CLIENT_STATUSES]);

  const filteredGroups = useMemo(() => {
    const q = groupSearch.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.batteries.some((code) => code.toLowerCase().includes(q))
    );
  }, [groups, groupSearch]);

  function openCreateModal() {
    setNameModalMode('create');
    setNameInput('');
    setNameTargetId(null);
    setNameModalOpen(true);
  }

  function openRenameModal(group) {
    setNameModalMode('rename');
    setNameInput(group.name);
    setNameTargetId(group.id);
    setNameModalOpen(true);
  }

  function handleNameSubmit(e) {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) return;

    // Check uniqueness (case-insensitive) except against self when renaming
    const duplicate = groups.some(
      (g) =>
        g.name.trim().toLowerCase() === trimmed.toLowerCase() &&
        (nameModalMode === 'create' || g.id !== nameTargetId)
    );
    if (duplicate) {
      setDuplicateNameAlert(trimmed);
      return;
    }

    if (nameModalMode === 'create') {
      const newGroup = {
        id: `sort-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: trimmed,
        createdAt: new Date().toISOString(),
        batteries: [],
      };
      const next = [newGroup, ...groups];
      setGroups(next);
      saveGroups(user?.id, next);
      setActiveGroupId(newGroup.id);
      setSavedGroupBatteries([]);
    } else {
      const next = groups.map((g) => (g.id === nameTargetId ? { ...g, name: trimmed } : g));
      setGroups(next);
      saveGroups(user?.id, next);
    }

    setNameModalOpen(false);
    setNameInput('');
    setNameTargetId(null);
  }

  function requestDeleteGroup(group) {
    setDeleteTarget(group);
  }

  function confirmDeleteGroup() {
    if (!deleteTarget) return;
    const next = groups.filter((g) => g.id !== deleteTarget.id);
    setGroups(next);
    saveGroups(user?.id, next);
    if (activeGroupId === deleteTarget.id) {
      setActiveGroupId(null);
      setSavedGroupBatteries(null);
    }
    setDeleteTarget(null);
  }

  function addBatteryToActiveGroup(rawInput) {
    if (!activeGroup) return;
    const extracted = extractBatteryCode(rawInput);
    if (!extracted) {
      setAddError('Please enter a valid battery code or scan a QR code.');
      return;
    }
    const code = extracted.toUpperCase();

    const existingGroupName = allSortedBatteryMap.get(code);
    if (existingGroupName) {
      if (existingGroupName.toLowerCase() === activeGroup.name.toLowerCase()) {
        setAddError(`Battery ${code} is already in this sort group.`);
      } else {
        setAddError(`Battery ${code} is already sorted in the "${existingGroupName}" group.`);
      }
      return;
    }

    setGroups((prev) =>
      prev.map((g) =>
        g.id === activeGroup.id ? { ...g, batteries: [...g.batteries, code] } : g
      )
    );
    setScanInput('');
    setAddError(null);
  }

  function removeBatteryFromActiveGroup(code) {
    if (!activeGroup) return;
    setGroups((prev) =>
      prev.map((g) =>
        g.id === activeGroup.id
          ? { ...g, batteries: g.batteries.filter((c) => c !== code) }
          : g
      )
    );
  }

  function handleScanKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addBatteryToActiveGroup(scanInput);
    }
  }

  // ── Active Group Detail View ──────────────────────────────────────────
  if (activeGroup) {
    const activePackedCount = activeGroup.batteries.filter((code) => {
      const b = codeToBattery.get(code.toUpperCase());
      return isBatteryPackedForRepair(b);
    }).length;

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-5 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBackClick}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition-all hover:bg-slate-100 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 dark:hover:bg-surface-700"
            >
              <span>←</span>
              <span>Back to Sort Groups</span>
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {activeGroup.name}
              </h1>
              <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
                Created {formatDate(activeGroup.createdAt)} • {activeGroup.batteries.length}{' '}
                {activeGroup.batteries.length === 1 ? 'battery' : 'batteries'} sorted
                {activePackedCount > 0 && (
                  <span className="ml-1.5 font-bold text-red-600 dark:text-red-400">
                    • {activePackedCount} packed to service
                  </span>
                )}
                {hasUnsavedChanges && (
                  <span className="ml-1.5 font-semibold text-amber-600 dark:text-amber-400">
                    • (Unsaved changes)
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasUnsavedChanges && (
              <button
                type="button"
                onClick={handleSaveGroup}
                style={{ backgroundColor: accent }}
                className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-xs transition-all hover:opacity-90 active:scale-98 ring-2 ring-emerald-400/50 animate-pulse"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                </svg>
                <span>Save Group</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => openRenameModal(activeGroup)}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-100 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 dark:hover:bg-surface-700"
            >
              Rename
            </button>
            <button
              type="button"
              onClick={() => requestDeleteGroup(activeGroup)}
              className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-bold text-red-700 shadow-2xs hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
            >
              Delete Group
            </button>
          </div>
        </div>

        {/* Scan / Type Add Box */}
        <div className="rounded-xl border border-blue-300 bg-slate-50 p-4 dark:border-blue-800/40 dark:bg-surface-900">
          <h3 className="mb-1 text-sm font-semibold text-slate-800 dark:text-neutral-100">
            Scan or Type a Battery to Sort Here
          </h3>
          <p className="mb-3 text-xs text-slate-500 dark:text-neutral-400">
            Use a handheld scanner (types straight into the box), your camera, or type the
            battery code / serial directly. Pick from your registered fleet for a quick match.
          </p>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={scanInput}
                onChange={(e) => {
                  setScanInput(e.target.value.toUpperCase());
                  setShowSuggestions(true);
                }}
                onKeyDown={handleScanKeyDown}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder="Scan or type battery code / serial…"
                autoComplete="off"
                className={formInputClasses}
              />
              {showSuggestions && scanSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-surface-700 dark:bg-surface-800">
                  {scanSuggestions.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onMouseDown={() => {
                        addBatteryToActiveGroup(b.battery_code);
                        setShowSuggestions(false);
                      }}
                      className="flex w-full items-center justify-between border-b border-slate-100 px-3.5 py-2.5 text-left text-xs transition-colors hover:bg-emerald-50 dark:border-surface-700/50 dark:hover:bg-surface-700 last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-slate-800 dark:text-neutral-100">
                          {b.battery_code}
                        </span>
                        {b.serial_number && (
                          <span className="text-xs text-slate-500 dark:text-neutral-400">
                            (SN: {b.serial_number})
                          </span>
                        )}
                      </div>
                      {hasBeenServiced(b) ? (
                        <ClientStatusBadge status={b.status} />
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-neutral-500">—</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => addBatteryToActiveGroup(scanInput)}
              style={{ backgroundColor: accent }}
              className="rounded-md px-4 py-2.5 text-sm font-bold text-white shadow-xs hover:opacity-90"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 dark:hover:bg-surface-700"
              title="Scan with camera"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                <circle cx="12" cy="13" r="3" />
              </svg>
            </button>
          </div>

          {addError && <p className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400">{addError}</p>}
        </div>

        {cameraOpen && (
          <QrScanner
            onScan={(value) => {
              addBatteryToActiveGroup(value);
              setCameraOpen(false);
            }}
            onClose={() => setCameraOpen(false)}
          />
        )}

        {/* Toolbar: Excel Export & View Switcher (Table vs Cards) */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={activeGroup.batteries.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 shadow-2xs hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/40 transition-colors"
              title="Download sorted batteries as Excel spreadsheet (.xlsx)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 0 0 3 3.5v13A1.5 1.5 0 0 0 4.5 18h11a1.5 1.5 0 0 0 1.5-1.5V7.621a1.5 1.5 0 0 0-.44-1.06l-4.12-4.122A1.5 1.5 0 0 0 11.378 2H4.5Zm4.75 6.75a.75.75 0 0 1 1.5 0v3.69l1.22-1.22a.75.75 0 1 1 1.06 1.06l-2.5 2.5a.75.75 0 0 1-1.06 0l-2.5-2.5a.75.75 0 1 1 1.06-1.06l1.22 1.22V8.75Z" clipRule="evenodd" />
              </svg>
              <span>Download Excel (.xlsx)</span>
            </button>
          </div>

          <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-2xs dark:border-white/10 dark:bg-surface-800">
            <button
              type="button"
              onClick={() => setDetailViewMode('table')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                detailViewMode === 'table'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path fillRule="evenodd" d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Zm0 5.25a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
              </svg>
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setDetailViewMode('cards')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                detailViewMode === 'cards'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M4.25 2A2.25 2.25 0 0 0 2 4.25v2.5A2.25 2.25 0 0 0 4.25 9h2.5A2.25 2.25 0 0 0 9 6.75v-2.5A2.25 2.25 0 0 0 6.75 2h-2.5Zm0 9A2.25 2.25 0 0 0 2 13.25v2.5A2.25 2.25 0 0 0 4.25 18h2.5A2.25 2.25 0 0 0 9 15.75v-2.5A2.25 2.25 0 0 0 6.75 11h-2.5Zm9-9A2.25 2.25 0 0 0 11 4.25v2.5A2.25 2.25 0 0 0 13.25 9h2.5A2.25 2.25 0 0 0 18 6.75v-2.5A2.25 2.25 0 0 0 15.75 2h-2.5Zm0 9A2.25 2.25 0 0 0 11 13.25v2.5A2.25 2.25 0 0 0 13.25 18h2.5A2.25 2.25 0 0 0 18 15.75v-2.5A2.25 2.25 0 0 0 15.75 11h-2.5Z" />
              </svg>
              <span>Cards</span>
            </button>
          </div>
        </div>

        {/* Sorted Battery List */}
        {activeGroup.batteries.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/50 p-12 text-center dark:border-white/10 dark:bg-surface-900">
            <p className="text-sm font-semibold text-slate-700 dark:text-neutral-300">
              No batteries sorted into this group yet.
            </p>
            <p className="mt-1 text-xs text-slate-400">Scan or type a battery code above to add it.</p>
          </div>
        ) : detailViewMode === 'table' ? (
          <DataTable
            columns={sortedTableColumns}
            rows={activeGroup.batteries.map((code) => ({
              id: code,
              code,
              match: codeToBattery.get(code.toUpperCase()),
            }))}
            showRowNumber
            emptyMessage="No batteries sorted into this group yet."
            maxHeight="calc(100vh - 360px)"
          />
        ) : (
          <div className="grid max-h-[calc(100vh-360px)] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
            {activeGroup.batteries.map((code) => {
              const match = codeToBattery.get(code.toUpperCase());
              const isPackedForRepair = isBatteryPackedForRepair(match);
              const packedDate = getBatteryPackedDate(match);

              return (
                <div
                  key={code}
                  className={`flex flex-col justify-between gap-3 rounded-2xl border p-4 shadow-xs transition-all ${
                    isPackedForRepair
                      ? 'border-red-300 bg-red-50/90 dark:border-red-500/40 dark:bg-red-950/25'
                      : 'border-slate-200/90 bg-white dark:border-white/10 dark:bg-surface-900'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        to={`/batteries/${encodeURIComponent(code)}`}
                        className={`block truncate font-mono text-sm font-bold hover:underline ${
                          isPackedForRepair
                            ? 'text-red-700 dark:text-red-400 dark:hover:text-red-300'
                            : 'text-blue-700 dark:text-blue-400'
                        }`}
                      >
                        {code}
                      </Link>
                      {match?.serial_number && (
                        <p className="text-[11px] font-medium text-slate-600 dark:text-neutral-400">
                          SN: {match.serial_number}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeBatteryFromActiveGroup(code)}
                      className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-red-100 hover:text-red-600 dark:text-neutral-500 dark:hover:bg-red-950/50 dark:hover:text-red-300"
                      title="Remove from group"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                        <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-200/50 dark:border-white/5">
                    <div className="flex items-center justify-between gap-2">
                      {match && hasBeenServiced(match) ? (
                        <ClientStatusBadge status={match.status} />
                      ) : match ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
                          Not yet serviced
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                          Not in your fleet
                        </span>
                      )}

                      {isPackedForRepair && (
                        <span className="rounded-md bg-red-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-red-800 dark:border dark:border-red-500/30 dark:bg-red-950/60 dark:text-red-300">
                          Packed to Service
                        </span>
                      )}
                    </div>

                    {isPackedForRepair && packedDate && (
                      <p className="text-[11px] font-semibold text-red-700 dark:text-red-400">
                        Packed to Service: <span className="font-normal text-slate-600 dark:text-red-200/90">{formatDate(packedDate)}</span>
                        {match?.truck_number ? ` • Truck ${match.truck_number}` : ''}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {nameModalOpen && (
          <Modal
            title={nameModalMode === 'create' ? 'New Sort Group' : 'Rename Sort Group'}
            onClose={() => setNameModalOpen(false)}
          >
            <form onSubmit={handleNameSubmit} className="flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-200">
                  Group Name
                </label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="e.g. Site A Requirement, 40Ah Batch, Order #204"
                  autoComplete="off"
                  autoFocus
                  className={formInputClasses}
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNameModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ backgroundColor: accent }}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-white shadow-xs hover:opacity-90"
                >
                  {nameModalMode === 'create' ? 'Create Group' : 'Save Name'}
                </button>
              </div>
            </form>
          </Modal>
        )}

        {deleteTarget && (
          <ConfirmModal
            title="Delete Sort Group"
            message={`Are you sure you want to delete the "${deleteTarget.name}" sort group? Your batteries will not be deleted from your fleet, only removed from this group.`}
            confirmLabel="Delete Group"
            cancelLabel="Keep Group"
            tone="danger"
            onConfirm={confirmDeleteGroup}
            onCancel={() => setDeleteTarget(null)}
          />
        )}

        {duplicateNameAlert && (
          <AlertModal
            title="Group Name Already Exists"
            message={`You already have a sort group named "${duplicateNameAlert}". Please choose a different name.`}
            onClose={() => setDuplicateNameAlert(null)}
          />
        )}

        {showUnsavedModal && (
          <Modal
            title="Unsaved Changes"
            onClose={() => setShowUnsavedModal(false)}
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-4 border border-amber-200 dark:border-amber-900/40 dark:bg-amber-950/40">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 text-amber-600 shrink-0">
                  <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
                </svg>
                <div className="text-xs">
                  <p className="font-bold text-amber-900 dark:text-amber-200 text-sm">
                    Save changes to &quot;{activeGroup?.name}&quot;?
                  </p>
                  <p className="mt-1 text-amber-800 dark:text-amber-300">
                    You have sorted or removed batteries in this group without saving. Would you like to save them before leaving?
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowUnsavedModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-white/10"
                >
                  Keep Editing
                </button>
                <button
                  type="button"
                  onClick={handleDiscardAndLeave}
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300"
                >
                  Discard Changes
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndLeave}
                  style={{ backgroundColor: accent }}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-white shadow-xs hover:opacity-90 active:scale-98"
                >
                  Save &amp; Leave
                </button>
              </div>
            </div>
          </Modal>
        )}

        {saveSuccessModal && (
          <Modal
            title="Group Saved Successfully"
            onClose={() => setSaveSuccessModal(false)}
          >
            <div className="flex flex-col gap-5">
              <div className="flex items-start gap-3.5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/50">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-6 w-6 text-emerald-600 dark:text-emerald-400"
                  >
                    <path
                      fillRule="evenodd"
                      d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.74-5.25Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
                <div className="text-sm">
                  <h4 className="font-bold text-slate-900 dark:text-neutral-100 text-base">
                    "{activeGroup?.name || 'Group'}" Saved!
                  </h4>
                  <p className="mt-1 text-xs text-slate-600 dark:text-neutral-300 leading-relaxed">
                    All sorted batteries ({activeGroup?.batteries?.length || 0}{' '}
                    {activeGroup?.batteries?.length === 1 ? 'battery' : 'batteries'}) in this group have been updated and saved successfully.
                  </p>
                </div>
              </div>

              <div className="flex justify-end border-t border-slate-100 pt-4 dark:border-surface-700">
                <button
                  type="button"
                  onClick={() => setSaveSuccessModal(false)}
                  style={{ backgroundColor: accent }}
                  className="rounded-xl px-5 py-2 text-xs font-bold text-white shadow-xs hover:opacity-90 active:scale-98 transition-all"
                >
                  OK
                </button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    );
  }

  // ── Groups Overview List ──────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-5 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Battery Sorting
          </h1>
          <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1">
            Organize your batteries into your own groups — by requirement, site, or order —
            by scanning or typing battery codes into a card.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          style={{ backgroundColor: accent }}
          className="inline-flex items-center gap-2 self-start rounded-xl px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:opacity-90 active:scale-98"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
          </svg>
          <span>+ New Sort Group</span>
        </button>
      </div>

      {groups.length > 0 && (
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
            value={groupSearch}
            onChange={(e) => setGroupSearch(e.target.value)}
            placeholder="Search group name or battery code…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-surface-800 dark:text-white dark:placeholder:text-neutral-500"
          />
        </div>
      )}

      {groups.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/50 p-12 text-center dark:border-white/10 dark:bg-surface-900">
          <p className="text-sm font-semibold text-slate-700 dark:text-neutral-300">
            No sort groups yet.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Click &apos;+ New Sort Group&apos; to start organizing batteries for a requirement.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredGroups.map((group) => {
            const groupPacked = (group.batteries || [])
              .map((code) => ({
                code,
                battery: codeToBattery.get(String(code).trim().toUpperCase()),
              }))
              .filter((item) => isBatteryPackedForRepair(item.battery));
            const hasPacked = groupPacked.length > 0;
            let latestPackedDate = null;
            if (hasPacked) {
              for (const item of groupPacked) {
                const d = getBatteryPackedDate(item.battery);
                if (d && (!latestPackedDate || new Date(d) > new Date(latestPackedDate))) {
                  latestPackedDate = d;
                }
              }
            }

            return (
              <div
                key={group.id}
                onClick={() => openGroup(group)}
                className={`group relative flex cursor-pointer flex-col justify-between rounded-2xl border p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                  hasPacked
                    ? 'border-red-300 bg-red-50/70 hover:border-red-500 dark:border-red-500/35 dark:bg-red-950/20 dark:hover:border-red-500/60'
                    : 'border-slate-200/90 bg-white hover:border-emerald-500/80 dark:border-white/10 dark:bg-surface-900 dark:hover:border-emerald-400/60'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                        hasPacked
                          ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-500/30'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/40'
                      }`}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                          <path d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-19.5 0v6a2.25 2.25 0 0 0 2.25 2.25h15a2.25 2.25 0 0 0 2.25-2.25v-6m-19.5 0h19.5M4.5 9.75V6a2.25 2.25 0 0 1 2.25-2.25h10.5A2.25 2.25 0 0 1 19.5 6v3.75" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
                          Sort Group
                        </span>
                        <h3 className={`truncate text-base font-extrabold transition-colors ${
                          hasPacked
                            ? 'text-slate-900 group-hover:text-red-700 dark:text-white dark:group-hover:text-red-400'
                            : 'text-slate-900 group-hover:text-emerald-600 dark:text-white dark:group-hover:text-emerald-400'
                        }`}>
                          {group.name}
                        </h3>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {hasPacked && (
                        <span className="inline-flex items-center gap-1 rounded-xl border border-red-300 bg-red-100 px-2 py-0.5 text-[11px] font-extrabold text-red-800 shadow-2xs dark:border-red-500/30 dark:bg-red-950/50 dark:text-red-300">
                          📦 {groupPacked.length} Packed
                        </span>
                      )}
                      <span className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-xs font-extrabold shadow-2xs ${
                        hasPacked
                          ? 'border-red-300/80 bg-red-100 text-red-800 dark:border-red-500/30 dark:bg-red-950/50 dark:text-red-300'
                          : 'border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300'
                      }`}>
                        {group.batteries.length}
                      </span>
                    </div>
                  </div>

                  <div className={`mt-4 rounded-xl p-3 text-xs ${hasPacked ? 'bg-red-100/60 dark:bg-red-950/20 dark:border dark:border-red-900/30' : 'bg-slate-50/80 dark:bg-white/5'}`}>
                    <div className="flex items-center justify-between text-slate-600 dark:text-neutral-400">
                      <span className="text-slate-400 dark:text-neutral-500">Created:</span>
                      <span className="font-medium text-slate-700 dark:text-neutral-300">
                        {formatDate(group.createdAt)}
                      </span>
                    </div>
                    {hasPacked && latestPackedDate && (
                      <div className="mt-1.5 flex items-center justify-between font-semibold text-red-700 dark:text-red-400">
                        <span className="text-slate-500 dark:text-neutral-400">Packed to Service:</span>
                        <span className="font-normal dark:text-red-200/90">{formatDate(latestPackedDate)}</span>
                      </div>
                    )}
                    {group.batteries.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1 border-t border-slate-200/50 pt-2 dark:border-white/5">
                        {group.batteries.slice(0, 4).map((code) => {
                          const b = codeToBattery.get(String(code).trim().toUpperCase());
                          const bPacked = isBatteryPackedForRepair(b);
                          return (
                            <span
                              key={code}
                              className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                                bPacked
                                  ? 'bg-red-200/80 text-red-900 border border-red-300 dark:bg-red-950/50 dark:text-red-300 dark:border-red-500/30'
                                  : 'bg-white text-slate-600 dark:bg-surface-800 dark:text-neutral-300'
                              }`}
                            >
                              {code}
                            </span>
                          );
                        })}
                        {group.batteries.length > 4 && (
                          <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 dark:bg-surface-800">
                            +{group.batteries.length - 4} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      requestDeleteGroup(group);
                    }}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:text-neutral-500 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                    title="Delete group"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <span className={`inline-flex items-center gap-1 text-xs font-bold transition-all group-hover:translate-x-0.5 ${
                    hasPacked
                      ? 'text-red-700 group-hover:text-red-800 dark:text-red-400'
                      : 'text-emerald-600 group-hover:text-emerald-700 dark:text-emerald-400'
                  }`}>
                    <span>Open Group</span>
                    <span>→</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {nameModalOpen && (
        <Modal
          title={nameModalMode === 'create' ? 'New Sort Group' : 'Rename Sort Group'}
          onClose={() => setNameModalOpen(false)}
        >
          <form onSubmit={handleNameSubmit} className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-200">
                Group Name
              </label>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="e.g. Site A Requirement, 40Ah Batch, Order #204"
                autoComplete="off"
                autoFocus
                className={formInputClasses}
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setNameModalOpen(false)}
                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{ backgroundColor: accent }}
                className="rounded-xl px-5 py-2 text-xs font-bold text-white shadow-xs hover:opacity-90"
              >
                {nameModalMode === 'create' ? 'Create Group' : 'Save Name'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete Sort Group"
          message={
            <>
              Delete <span className="font-semibold text-slate-900 dark:text-white">{deleteTarget.name}</span>?
              This only removes your local grouping — the batteries in it are unaffected and stay in your fleet.
            </>
          }
          confirmLabel="Delete Group"
          requireTyping={false}
          onConfirm={confirmDeleteGroup}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {duplicateNameAlert && (
        <AlertModal
          title="Duplicate Group Name"
          message={duplicateNameAlert}
          onClose={() => setDuplicateNameAlert(null)}
        />
      )}
    </div>
  );
}

export default ClientBatterySortPage;
