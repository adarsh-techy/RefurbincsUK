import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiDownload, FiArrowRight, FiInfo, FiUploadCloud, FiSearch, FiX } from 'react-icons/fi';
import apiClient from '../../../services/api-client';
import { clearTagCache, normalizeRfidTag } from '../../../utils/scan-input';
import PageHeader from '../../../components/ui/primitives/PageHeader';
import Button from '../../../components/ui/primitives/Button';
import { StatusBadge } from '../../../components/ui/primitives/Badge';

// RFID Assignment — upload an Excel/CSV of battery number + RFID tag. The
// sheet is first sent as a dry run (POST /batteries/rfid-assign?dryRun=true)
// so the admin sees exactly which rows match before anything is written,
// then "Assign" sends it again for real. Battery numbers come from the
// Generate QR Code page; a number the fleet doesn't know is highlighted so
// it can be generated (or the sheet corrected) first.

// One plain-English status per row. `label` is shown while reviewing (before
// anything is saved), `done` after the Assign button has run.
const STATUS_META = {
  assigned: { label: '✓ Matched — ready to assign', done: '✓ Assigned', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50' },
  replaced: { label: '✓ Matched — will replace old tag', done: '✓ Assigned (old tag replaced)', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50' },
  unchanged: { label: '✓ Already has this tag', done: '✓ Already has this tag', cls: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-surface-800 dark:text-neutral-300 dark:border-white/10' },
  created: { label: '✓ New battery — will be registered', done: '✓ Registered + tag assigned', cls: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800/50' },
  not_found: { label: '✕ Battery number not found', done: '✕ Skipped — battery not found', cls: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50' },
  already_tagged: { label: '✕ Battery already has a tag', done: '✕ Skipped — battery already has a tag', cls: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50' },
  tag_in_use: { label: '✕ Tag belongs to another battery', done: '✕ Skipped — tag belongs to another battery', cls: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50' },
  duplicate_in_sheet: { label: '✕ Repeated in this file', done: '✕ Skipped — repeated in this file', cls: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50' },
  client_mismatch: { label: '✕ Client name does not match', done: '✕ Skipped — client name does not match', cls: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50' },
  error: { label: '✕ Row is incomplete', done: '✕ Skipped — row is incomplete', cls: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50' },
};
// The table renders in a scrollable box and only mounts PAGE_SIZE rows at a
// time, adding the next PAGE_SIZE whenever the bottom scrolls into view —
// a 5,000-row sheet stays snappy without a pager.
const PAGE_SIZE = 10;

const FILTERS = [
  { id: 'all', label: 'All rows' },
  { id: 'ok', label: 'Matched ✓', test: (r) => ['assigned', 'replaced', 'unchanged', 'created'].includes(r.status) },
  { id: 'not_found', label: 'Battery not found ✕', test: (r) => r.status === 'not_found' },
  { id: 'problem', label: 'Other problems ✕', test: (r) => ['already_tagged', 'tag_in_use', 'duplicate_in_sheet', 'client_mismatch', 'error'].includes(r.status) },
];

// .xlsx template from the API (Battery Number, RFID Tag, Client Name + a
// "How to fill" sheet)
async function downloadTemplate() {
  const { data } = await apiClient.get('/batteries/rfid-template', { responseType: 'blob' });
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'rfid-assignment-template.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}

function RfidAssignmentPage() {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [clients, setClients] = useState([]);
  const [uploadClient, setUploadClient] = useState(''); // mandatory: whose batteries this sheet is for
  const [result, setResult] = useState(null); // last server response (dry run or commit)
  const [stage, setStage] = useState('idle'); // idle | previewing | previewed | assigning | done
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [shown, setShown] = useState(PAGE_SIZE);
  const [assignedVersion, setAssignedVersion] = useState(0); // bump → assigned table reloads
  const [createMissing, setCreateMissing] = useState(false); // also register numbers that don't exist yet
  const [showGuide, setShowGuide] = useState(false);
  // desktop table and phone cards each scroll on their own, with their own
  // "load more" marker — shared refs end up on the hidden layout
  const sentinelRef = useRef(null);
  const scrollRef = useRef(null);
  const mobileSentinelRef = useRef(null);
  const mobileScrollRef = useRef(null);

  useEffect(() => {
    apiClient.get('/clients')
      .then(({ data }) => setClients((Array.isArray(data) ? data : data?.data || []).filter((c) => c.user_role !== 'recycle_client').map((c) => c.name).sort()))
      .catch(() => {});
  }, []);

  async function send(selected, dryRun) {
    const formData = new FormData();
    formData.append('file', selected);
    formData.append('clientName', uploadClient);
    const params = new URLSearchParams();
    if (dryRun) params.set('dryRun', 'true');
    if (!dryRun && createMissing) params.set('createMissing', 'true');
    const { data } = await apiClient.post(`/batteries/rfid-assign${params.toString() ? `?${params}` : ''}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    if (!dryRun) clearTagCache();
    return data;
  }

  async function handleFile(selected) {
    if (!selected) return;
    if (!uploadClient) { setError('Select the client first, then choose the file.'); return; }
    setFile(selected);
    setResult(null);
    setCreateMissing(false);
    setError(null);
    setFilter('all');
    setStage('previewing');
    try {
      setResult(await send(selected, true));
      setStage('previewed');
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      setStage('idle');
    }
  }

  async function handleAssign() {
    if (!file) return;
    setStage('assigning');
    setError(null);
    try {
      setResult(await send(file, false));
      setStage('done');
      setAssignedVersion((v) => v + 1);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      setStage('previewed');
    }
  }

  function reset() {
    setFile(null);
    setResult(null);
    setError(null);
    setStage('idle');
    setFilter('all');
    setSearch('');
    setClientFilter('');
    if (inputRef.current) inputRef.current.value = '';
    // keep uploadClient: the next sheet is usually for the same client
  }

  const rows = result?.results || [];
  const summary = result?.summary || {};
  const creatable = rows.filter((r) => r.status === 'not_found' && r.canCreate);
  const committed = stage === 'done';
  const willCreate = !committed && createMissing ? creatable.length : 0;
  const matched = (summary.assigned || 0) + (summary.replaced || 0) + (summary.created || 0) + willCreate;
  const visible = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter);
    const q = search.trim().toLowerCase();
    return rows.filter((r) =>
      (!f?.test || f.test(r)) &&
      (!clientFilter || (r.clientName || '') === clientFilter) &&
      (!q || r.batteryCode?.toLowerCase().includes(q) || r.rfidTag?.toLowerCase().includes(q))
    );
  }, [rows, filter, search, clientFilter]);
  const clientsInFile = useMemo(() => [...new Set(rows.map((r) => r.clientName).filter(Boolean))].sort(), [rows]);
  const pageRows = visible.slice(0, shown);
  const hasMore = shown < visible.length;

  // Back to the first page whenever the data, filter or search changes
  useEffect(() => {
    setShown(PAGE_SIZE);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    if (mobileScrollRef.current) mobileScrollRef.current.scrollTop = 0;
  }, [rows, filter, search, clientFilter]);

  // Lazy load: when the sentinel row at the bottom of the scroll box becomes
  // visible, reveal the next PAGE_SIZE rows
  useEffect(() => {
    if (!hasMore) return undefined;
    const reveal = (entries) => {
      if (entries.some((e) => e.isIntersecting)) setShown((n) => Math.min(n + PAGE_SIZE, visible.length));
    };
    // one observer per layout; only the visible one ever fires
    const observers = [
      [sentinelRef.current, scrollRef.current],
      [mobileSentinelRef.current, mobileScrollRef.current],
    ]
      .filter(([el, root]) => el && root)
      .map(([el, root]) => {
        const io = new IntersectionObserver(reveal, { root, rootMargin: '80px' });
        io.observe(el);
        return io;
      });
    return () => observers.forEach((io) => io.disconnect());
  }, [hasMore, visible.length, pageRows.length]);

  function exportResults() {
    const lines = [['Row', 'Battery Number', 'RFID Tag', 'Status', 'Detail'].join(',')];
    for (const r of rows) {
      const meta = STATUS_META[r.status] || { done: r.status, label: r.status };
      lines.push([r.rowNumber, r.batteryCode, r.rfidTag, committed ? meta.done : meta.label, (r.message || '').replace(/,/g, ';')].map((v) => `"${String(v ?? '')}"`).join(','));
    }
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `rfid-assignment-results.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-2.5 sm:space-y-3.5 pb-12 w-full max-w-full">
      {/* ── Executive Page Header ─────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h1 className="text-sm sm:text-lg font-black tracking-tight text-slate-900 dark:text-white truncate">
              RFID Fleet Assignment
            </h1>
            <span className="rounded-full bg-violet-100 dark:bg-violet-950/60 px-1.5 py-0.2 text-[8.5px] sm:text-[9.5px] font-bold text-violet-700 dark:text-violet-300">
              Bulk Sync
            </span>
          </div>
          <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
            Batch assign RFID tags via spreadsheet or register individual asset tags
          </p>
        </div>

        <Link
          to="/batteries-qr-code"
          className="inline-flex h-7 items-center gap-1 shrink-0 rounded-lg border border-violet-200 bg-violet-50 px-2 sm:px-2.5 text-[10px] sm:text-xs font-bold text-violet-700 hover:bg-violet-100 dark:border-violet-800/40 dark:bg-violet-950/40 dark:text-violet-300"
        >
          <span>QR Codes</span>
          <FiArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* ── 1. Compact Bulk Upload Bar ─────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-2.5 sm:p-3 shadow-2xs dark:border-white/10 dark:bg-surface-900">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="flex h-4.5 w-4.5 items-center justify-center rounded-md bg-violet-100 text-[9.5px] font-black text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
              1
            </span>
            <span className="text-[11.5px] sm:text-xs font-extrabold text-slate-900 dark:text-white truncate">
              Upload Assignment Spreadsheet
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0 text-[10px]">
            <button
              type="button"
              onClick={downloadTemplate}
              className="inline-flex items-center gap-0.5 font-bold text-slate-600 dark:text-neutral-300 hover:text-slate-900 hover:underline cursor-pointer"
            >
              <FiDownload className="h-3 w-3" />
              <span>Template</span>
            </button>
            <span className="text-slate-300 dark:text-white/20">•</span>
            <button
              type="button"
              onClick={() => setShowGuide((v) => !v)}
              className="font-bold text-violet-600 dark:text-violet-400 hover:underline cursor-pointer"
            >
              {showGuide ? 'Hide Guide' : 'Format Guide'}
            </button>
          </div>
        </div>

        {showGuide && (
          <div className="mt-2 rounded-lg bg-slate-50 dark:bg-surface-800/60 p-2 text-[10px] sm:text-[10.5px] text-slate-600 dark:text-neutral-300 space-y-0.5">
            <p>• Required columns: <span className="font-mono font-bold text-slate-800 dark:text-neutral-100">Battery Number</span>, <span className="font-mono font-bold text-slate-800 dark:text-neutral-100">RFID Tag</span>, and optional <span className="font-mono font-bold text-slate-800 dark:text-neutral-100">Client Name</span>.</p>
            <p>• Tags are automatically cleaned and stored in uppercase; colons, dashes, and whitespace are ignored.</p>
          </div>
        )}

        {/* Upload action controls row */}
        <div className="mt-2 flex items-center gap-1.5 w-full">
          <select
            value={uploadClient}
            onChange={(e) => { setUploadClient(e.target.value); setError(null); }}
            disabled={stage === 'previewing' || stage === 'assigning'}
            className="h-8 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 text-[11px] font-semibold text-slate-800 focus:border-violet-500 focus:outline-none dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-100 cursor-pointer truncate"
          >
            <option value="">Select Fleet Client *</option>
            {clients.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={!uploadClient || stage === 'previewing' || stage === 'assigning'}
            title={uploadClient ? '' : 'Select the client first'}
            className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-violet-700 hover:bg-violet-800 px-3 text-[11px] font-bold text-white shadow-xs active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
          >
            <FiUploadCloud className="h-3.5 w-3.5" />
            <span>{stage === 'previewing' ? 'Reading…' : file ? 'Change File' : 'Choose File'}</span>
          </button>
          {file && (
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-2 text-[10.5px] font-bold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-surface-800 dark:text-slate-300 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {file && (
          <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-violet-50 dark:bg-violet-950/40 px-2 py-0.5 text-[10px] font-bold text-violet-700 dark:text-violet-300 border border-violet-200/60 dark:border-violet-800/40">
            <span>📄 {file.name}</span>
            <span className="opacity-60">({Math.round(file.size / 1024)} KB)</span>
          </div>
        )}

        {error && (
          <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[10.5px] font-bold text-rose-700 dark:border-rose-800/50 dark:bg-rose-950/40 dark:text-rose-300">
            ✕ {error}
          </div>
        )}
      </div>

      {result && (
        <>
          {/* ── 2. Dry Run Verification Summary ───────────────────────── */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4.5 dark:border-white/10 dark:bg-surface-900 shadow-2xs">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                  {committed ? '3. Done — tags saved' : '2. Check the table below, then press Assign'}
                  <span className="ml-2 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.2 text-[10px] font-bold text-violet-700 dark:border-violet-800/50 dark:bg-violet-950/40 dark:text-violet-300">Client: {uploadClient}</span>
                </p>
                {!committed && (
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-neutral-400">
                    Nothing has been saved yet. Rows marked ✓ will get their tag when you press <b>Assign</b>; rows marked ✕ are skipped and the reason is shown in the last column.
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                  <Stat label="rows in file" value={rows.length} />
                  <Stat label={committed ? 'tags assigned' : 'ready to assign'} value={matched} tone="emerald" />
                  {(summary.unchanged || 0) > 0 && <Stat label="already had this tag" value={summary.unchanged} />}
                  {(summary.created || 0) > 0 && <Stat label="new batteries registered" value={summary.created} tone="violet" />}
                  {(summary.not_found || 0) - willCreate > 0 && <Stat label="battery not found" value={summary.not_found - willCreate} tone="rose" />}
                  {(summary.already_tagged || 0) > 0 && <Stat label="battery already has a tag" value={summary.already_tagged} tone="rose" />}
                  {(summary.tag_in_use || 0) > 0 && <Stat label="tag belongs to another battery" value={summary.tag_in_use} tone="amber" />}
                  {(summary.duplicate_in_sheet || 0) > 0 && <Stat label="repeated in file" value={summary.duplicate_in_sheet} tone="amber" />}
                  {(summary.client_mismatch || 0) > 0 && <Stat label="client name mismatch" value={summary.client_mismatch} tone="amber" />}
                  {(summary.error || 0) > 0 && <Stat label="incomplete rows" value={summary.error} tone="rose" />}
                </div>
                {!committed && creatable.length > 0 && (
                  <label className="mt-2.5 flex cursor-pointer items-start gap-2 rounded-xl border border-violet-200 bg-violet-50 p-2.5 text-[11px] text-violet-900 dark:border-violet-800/50 dark:bg-violet-950/40 dark:text-violet-200">
                    <input
                      type="checkbox"
                      checked={createMissing}
                      onChange={(e) => setCreateMissing(e.target.checked)}
                      className="mt-0.5 h-3.5 w-3.5 accent-violet-600"
                    />
                    <span>
                      <b>Also register {creatable.length} new batter{creatable.length === 1 ? 'y' : 'ies'} for {uploadClient}</b>{' '}
                      ({creatable[0].batteryCode}{creatable.length > 1 ? ` … ${creatable[creatable.length - 1].batteryCode}` : ''}) and assign their tags.
                      These numbers are in the sheet but not in the system yet. Leave unticked to skip them.
                    </span>
                  </label>
                )}
                {committed && (
                  <p className="mt-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    ✓ {result.written} tag{result.written === 1 ? '' : 's'} saved{result.created ? `, including ${result.created} newly registered batter${result.created === 1 ? 'y' : 'ies'}` : ''}. Scanning any of these tags now opens the battery just like its QR code.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={exportResults}
                  className="inline-flex h-8 sm:h-8.5 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-[11px] sm:text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-white/10 dark:bg-surface-800 dark:text-slate-200 cursor-pointer"
                >
                  Export results (.csv)
                </button>
                {!committed ? (
                  <button
                    type="button"
                    onClick={handleAssign}
                    disabled={matched === 0 || stage === 'assigning'}
                    className="inline-flex h-8 sm:h-8.5 items-center justify-center rounded-xl bg-emerald-600 px-3.5 text-[11px] sm:text-xs font-black text-white shadow-xs hover:bg-emerald-700 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {stage === 'assigning' ? 'Assigning…' : `Assign ${matched} tag${matched === 1 ? '' : 's'}`}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={reset}
                    className="inline-flex h-8 sm:h-8.5 items-center justify-center rounded-xl bg-violet-700 px-3.5 text-[11px] sm:text-xs font-black text-white shadow-xs hover:bg-violet-800 cursor-pointer"
                  >
                    Upload another sheet
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── Table & Responsive Stream ─────────────────────────────── */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-surface-900 shadow-2xs">
            <div className="flex flex-col gap-2.5 border-b border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
                {FILTERS.map((f) => {
                  const count = f.test ? rows.filter(f.test).length : rows.length;
                  const active = filter === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFilter(f.id)}
                      className={`shrink-0 rounded-lg px-2.5 py-1 text-[10.5px] font-bold transition-colors cursor-pointer ${active ? 'bg-violet-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-surface-800 dark:text-neutral-300'}`}
                    >
                      {f.label} ({count})
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                {clientsInFile.length > 1 && (
                  <select
                    value={clientFilter}
                    onChange={(e) => setClientFilter(e.target.value)}
                    className="h-8 rounded-xl border border-slate-300 px-2.5 text-[11px] sm:text-xs text-slate-900 focus:border-violet-500 focus:outline-none dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-100"
                  >
                    <option value="">All clients</option>
                    {clientsInFile.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search battery number or tag…"
                  className="h-8 w-full rounded-xl border border-slate-300 px-2.5 text-[11px] sm:text-xs text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-100 sm:w-56"
                />
              </div>
            </div>

            {/* Desktop Table (>= lg) */}
            <div ref={scrollRef} className="hidden lg:block max-h-[60vh] overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-surface-800">
                  <tr>
                    <th className="px-4 py-2.5 font-bold text-slate-700 dark:text-neutral-300">#</th>
                    <th className="px-4 py-2.5 font-bold text-slate-700 dark:text-neutral-300">Battery Number</th>
                    <th className="px-4 py-2.5 font-bold text-slate-700 dark:text-neutral-300">RFID Tag (from file)</th>
                    <th className="px-4 py-2.5 font-bold text-slate-700 dark:text-neutral-300">Assignment Status</th>
                    <th className="px-4 py-2.5 font-bold text-slate-700 dark:text-neutral-300">Why</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {visible.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">No rows match this filter.</td>
                    </tr>
                  ) : (
                    pageRows.map((r, idx) => {
                      const toCreate = !committed && createMissing && r.status === 'not_found' && r.canCreate;
                      const meta = STATUS_META[toCreate ? 'created' : r.status] || { label: r.status, done: r.status, cls: '' };
                      const notFound = r.status === 'not_found' && !toCreate;
                      const bad = notFound || r.status === 'error';
                      return (
                        <tr key={`${r.rowNumber}-${r.batteryCode}`} className={bad ? 'bg-rose-50/70 dark:bg-rose-950/20' : ''}>
                          <td className="px-4 py-2 font-mono font-semibold text-slate-500 dark:text-neutral-400">
                            <span>{idx + 1}</span>
                            {r.rowNumber && r.rowNumber !== idx + 1 && (
                              <span className="block text-[9.5px] font-normal text-slate-400">row {r.rowNumber}</span>
                            )}
                          </td>
                          <td className={`px-4 py-2 font-mono font-semibold ${notFound ? 'text-rose-700 dark:text-rose-300' : 'text-slate-900 dark:text-white'}`}>
                            {r.batteryId ? (
                              <Link to={`/batteries/${encodeURIComponent(r.batteryCode)}`} className="hover:underline">{r.batteryCode}</Link>
                            ) : (
                              <span className="inline-flex items-center gap-1.5">
                                {notFound && <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />}
                                {r.batteryCode || <span className="italic text-slate-400">empty</span>}
                              </span>
                            )}
                            {r.sheetBatteryCode && (
                              <span className="block text-[9.5px] font-normal text-slate-400">written as {r.sheetBatteryCode}</span>
                            )}
                          </td>
                          <td className="px-4 py-2 font-mono text-slate-700 dark:text-neutral-200">{r.rfidTag || <span className="italic text-slate-400">empty</span>}</td>
                          <td className="px-4 py-2">
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] sm:text-[10.5px] font-bold ${meta.cls}`}>
                              {committed ? meta.done : meta.label}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-slate-500 dark:text-neutral-400 text-[11px]">
                            {r.status === 'assigned' ? '' : r.status === 'replaced' ? `Currently has ${r.previousTag}; it will be replaced` : r.message}
                          </td>
                        </tr>
                      );
                    })
                  )}
                  {visible.length > 0 && (
                    <tr ref={sentinelRef}>
                      <td colSpan={5} className="px-4 py-2.5 text-center text-[10.5px] text-slate-400">
                        {hasMore ? `Loading more… (${pageRows.length} of ${visible.length})` : `Showing all ${visible.length} rows`}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Stream (< lg) - ZERO HORIZONTAL SCROLL */}
            <div ref={mobileScrollRef} className="block lg:hidden max-h-[60vh] overflow-y-auto divide-y divide-slate-100 dark:divide-white/5 p-2">
              {visible.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">No rows match this filter.</p>
              ) : (
                pageRows.map((r, idx) => {
                  const toCreate = !committed && createMissing && r.status === 'not_found' && r.canCreate;
                  const meta = STATUS_META[toCreate ? 'created' : r.status] || { label: r.status, done: r.status, cls: '' };
                  const notFound = r.status === 'not_found' && !toCreate;
                  const bad = notFound || r.status === 'error';
                  const why = r.status === 'assigned' ? '' : r.status === 'replaced' ? `Currently has ${r.previousTag}; it will be replaced` : r.message;

                  return (
                    <div key={`${r.rowNumber}-${r.batteryCode}`} className={`rounded-xl p-2.5 mb-1.5 border transition-all ${bad ? 'border-rose-200 bg-rose-50/60 dark:border-rose-900/40 dark:bg-rose-950/20' : 'border-slate-200/80 bg-white dark:border-white/10 dark:bg-surface-850'}`}>
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono text-[10px] font-bold text-slate-400">#{idx + 1}</span>
                          {r.batteryId ? (
                            <Link to={`/batteries/${encodeURIComponent(r.batteryCode)}`} className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline truncate">
                              🔋 {r.batteryCode}
                            </Link>
                          ) : (
                            <span className="font-mono text-xs font-bold text-slate-900 dark:text-white truncate">{r.batteryCode || 'empty'}</span>
                          )}
                        </div>
                        <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[9.5px] font-bold ${meta.cls}`}>
                          {committed ? meta.done : meta.label}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center justify-between gap-2 text-[10.5px]">
                        <span className="text-slate-400">RFID Tag:</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-neutral-200">{r.rfidTag || '—'}</span>
                      </div>

                      {why ? (
                        <p className="mt-1 border-t border-slate-100 dark:border-white/5 pt-1 text-[10px] text-slate-500 dark:text-neutral-400">
                          {why}
                        </p>
                      ) : null}
                    </div>
                  );
                })
              )}
              {visible.length > 0 && (
                <div ref={mobileSentinelRef} className="py-2.5 text-center text-[10.5px] font-medium text-slate-400">
                  {hasMore ? `Loading more… (${pageRows.length} of ${visible.length})` : `Showing all ${visible.length} rows`}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <AssignedTagsTable version={assignedVersion} />
    </div>
  );
}

// Every battery with its RFID tag (or "No tag yet") — GET
// /batteries/rfid-assignments, 10 per request, next page fetched as the
// bottom of the box scrolls into view. Filter by client / tagged, search by
// battery number or tag, and assign or change a tag right in the row.
function AssignedTagsTable({ version }) {
  const [clients, setClients] = useState([]);
  const [clientName, setClientName] = useState('');
  const [search, setSearch] = useState('');
  // 'all' by default: before any sheet is uploaded nothing is assigned, and an
  // 'Assigned'-only table would look empty even though the batteries exist
  const [tagged, setTagged] = useState('all'); // all | yes | no
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ assigned: 0, unassigned: 0 });
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);
  // desktop table and phone cards each have their own "load more" marker —
  // one shared ref ends up on the hidden one and nothing past the first page loads
  const sentinelRef = useRef(null);
  const mobileSentinelRef = useRef(null);
  const requestRef = useRef(0);
  const debounceRef = useRef(null);

  useEffect(() => {
    apiClient.get('/clients').then(({ data }) => setClients((Array.isArray(data) ? data : data?.data || []).filter((c) => c.user_role !== 'recycle_client').map((c) => c.name).sort())).catch(() => {});
  }, []);

  async function fetchPage(offset, replace) {
    const reqId = ++requestRef.current;
    try {
      const params = { limit: PAGE_SIZE, offset, tagged };
      if (clientName) params.clientName = clientName;
      if (search.trim()) params.search = search.trim();
      const { data } = await apiClient.get('/batteries/rfid-assignments', { params });
      if (reqId !== requestRef.current) return;
      setRows((prev) => (replace ? data.data : [...prev, ...data.data]));
      setHasMore(Boolean(data.hasMore));
      setTotal(Number(data.total) || 0);
      if (data.counts) setCounts(data.counts);
      setError(null);
    } catch (err) {
      if (reqId === requestRef.current) setError(err.response?.data?.message || err.message);
    } finally {
      if (reqId === requestRef.current) { setLoading(false); setLoadingMore(false); }
    }
  }

  // reload from the top when the filters change or a sheet was just assigned
  useEffect(() => {
    clearTimeout(debounceRef.current);
    setLoading(true);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    debounceRef.current = setTimeout(() => fetchPage(0, true), search ? 300 : 0);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientName, search, tagged, version]);

  useEffect(() => {
    const markers = [sentinelRef.current, mobileSentinelRef.current].filter(Boolean);
    const root = scrollRef.current;
    if (!markers.length || !root || !hasMore || loading) return undefined;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !loadingMore) {
        setLoadingMore(true);
        fetchPage(rows.length, false);
      }
    }, { root, rootMargin: '80px' });
    markers.forEach((m) => io.observe(m)); // only the visible one ever intersects
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, loading, loadingMore, rows.length]);

  const pct = counts.assigned + counts.unassigned > 0 ? Math.round((counts.assigned / (counts.assigned + counts.unassigned)) * 100) : 0;
  const [editingId, setEditingId] = useState(null); // row whose tag is being typed / scanned

  // Manual assign from the table: same endpoint and checks as the sheet
  // upload (tag already on another battery, client mismatch…), one row.
  async function saveTag(row, rawTag) {
    const { data } = await apiClient.post('/batteries/rfid-assign', {
      assignments: [{ batteryCode: row.battery_code, rfidTag: rawTag, clientName: row.client_name }],
      clientName: row.client_name || '',
    });
    const res = data?.results?.[0];
    if (!res || !['assigned', 'replaced', 'unchanged'].includes(res.status)) {
      throw new Error(res?.message || 'Could not assign this tag.');
    }
    const hadTag = Boolean(row.rfid_tag);
    setRows((list) => list.map((x) => (x.id === row.id ? { ...x, rfid_tag: res.rfidTag } : x)));
    clearTagCache(); // scan boxes must see the new tag straight away
    if (!hadTag) setCounts((c) => ({ assigned: c.assigned + 1, unassigned: Math.max(0, c.unassigned - 1) }));
    return res;
  }

  // after a save, jump to the next battery without a tag so a reader can
  // tag a run of batteries back to back
  function editNextUntagged(afterId) {
    const i = rows.findIndex((x) => x.id === afterId);
    const next = rows.slice(i + 1).find((x) => !x.rfid_tag);
    setEditingId(next ? next.id : null);
  }

  const [copied, setCopied] = useState(null);
  function copyTag(tag) {
    navigator.clipboard?.writeText(tag).then(() => { setCopied(tag); setTimeout(() => setCopied(null), 1200); }).catch(() => {});
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs dark:border-white/10 dark:bg-surface-900">
      {/* Consolidated Header & Live Metrics Strip */}
      <div className="border-b border-slate-200/80 bg-gradient-to-r from-emerald-500/10 via-slate-50 to-emerald-500/5 px-3 py-2 sm:px-4 sm:py-2.5 dark:border-white/10 dark:from-emerald-950/20 dark:via-surface-900 dark:to-surface-900">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="text-xs sm:text-sm font-black tracking-tight text-slate-900 dark:text-white truncate">
              RFID Live Register
            </h3>
            <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.2 text-[8.5px] font-black text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              LIVE
            </span>
          </div>

          {/* Integrated Micro-Metrics */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 text-[10px] sm:text-[11px] font-bold shrink-0">
            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>{loading ? '…' : counts.assigned.toLocaleString()} Tagged</span>
            </span>
            <span className="text-slate-300 dark:text-white/20">•</span>
            <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              <span>{loading ? '…' : counts.unassigned.toLocaleString()} Untagged</span>
            </span>
            <span className="text-slate-300 dark:text-white/20">•</span>
            <span className="text-slate-700 dark:text-neutral-200 font-black">{pct}%</span>
          </div>
        </div>

        {/* 2px Progress Bar */}
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
          <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Unified Toolbar (Segmented Filters + Search) */}
      <div className="border-b border-slate-200/80 px-2.5 sm:px-4 py-1.5 sm:py-2 dark:border-white/10 bg-slate-50/50 dark:bg-surface-800/30 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        {/* Segmented Filter Pills */}
        <div className="inline-flex rounded-lg bg-slate-200/70 p-0.5 dark:bg-surface-800 w-full sm:w-auto">
          {[['all', 'All', counts.assigned + counts.unassigned], ['yes', 'Assigned', counts.assigned], ['no', 'Untagged', counts.unassigned]].map(([id, label, n]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTagged(id)}
              className={`flex-1 sm:flex-initial rounded-md px-2 py-1 text-[10px] sm:text-xs font-bold transition-all cursor-pointer ${tagged === id ? 'bg-white text-emerald-800 shadow-2xs dark:bg-surface-900 dark:text-emerald-300' : 'text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white'}`}
            >
              {label} <span className={`ml-0.5 rounded-full px-1 py-0.2 text-[8.5px] sm:text-[9.5px] font-bold tabular-nums ${tagged === id ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-slate-300/60 text-slate-600 dark:bg-white/10 dark:text-neutral-400'}`}>{loading ? '…' : n.toLocaleString()}</span>
            </button>
          ))}
        </div>

        {/* Client selector + Search input */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <select
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className="h-7.5 max-w-[120px] sm:max-w-[150px] rounded-lg border border-slate-300 bg-white px-2 text-[10.5px] sm:text-xs font-semibold text-slate-900 shadow-2xs focus:border-emerald-500 focus:outline-none dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-100 cursor-pointer shrink-0 truncate"
          >
            <option value="">All Fleet Clients ({clients.length})</option>
            {clients.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="relative flex-1 sm:w-48">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search battery or tag…"
              className="h-7.5 w-full rounded-lg border border-slate-300 bg-white pl-2.5 pr-6 text-[10.5px] sm:text-xs font-semibold text-slate-900 shadow-2xs placeholder:text-slate-400 placeholder:font-normal focus:border-emerald-500 focus:outline-none dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-100"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>
      {error && <p className="px-6 py-2 text-xs font-semibold text-rose-600 bg-rose-50/50">{error}</p>}

      {/* Table & Mobile Stream */}
      <div ref={scrollRef} className="h-[520px] overflow-auto">
        {/* Desktop Table (>= lg) */}
        <table className="hidden lg:table w-full min-w-[720px] table-fixed text-left text-xs">
          <colgroup>
            <col className="w-[8%]" />
            <col className="w-[23%]" />
            <col className="w-[37%]" />
            <col className="w-[16%]" />
            <col className="w-[16%]" />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-md dark:bg-surface-800/95">
            <tr className="border-b border-slate-200/90 dark:border-white/10">
              <th className="px-5 py-3 text-[10.5px] font-black uppercase tracking-wider text-slate-500 dark:text-neutral-400 text-center">#</th>
              <th className="px-5 py-3 text-[10.5px] font-black uppercase tracking-wider text-slate-500 dark:text-neutral-400">Battery</th>
              <th className="px-5 py-3 text-[10.5px] font-black uppercase tracking-wider text-slate-500 dark:text-neutral-400">RFID Tag</th>
              <th className="px-5 py-3 text-[10.5px] font-black uppercase tracking-wider text-slate-500 dark:text-neutral-400">Serial Number</th>
              <th className="px-5 py-3 text-[10.5px] font-black uppercase tracking-wider text-slate-500 dark:text-neutral-400">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {loading ? (
              Array.from({ length: 7 }).map((_, i) => (
                <tr key={`sk-${i}`} className="animate-pulse">
                  {[8, 23, 37, 16, 16].map((w, c) => (
                    <td key={c} className="px-5 py-3.5"><div className="h-3 rounded-md bg-slate-200/80 dark:bg-white/10" style={{ width: `${w * 3}%` }} /></td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-14 text-center">
                  <p className="text-sm font-bold text-slate-800 dark:text-neutral-200">
                    {tagged === 'no' ? `Every battery${clientName ? ` for ${clientName}` : ''} already has a tag` : tagged === 'yes' ? `No batteries with an RFID tag${clientName ? ` for ${clientName}` : ''} yet` : 'No batteries found'}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{tagged === 'yes' ? 'Upload a sheet above to assign tags.' : search ? 'Try a different search query.' : ''}</p>
                  {(tagged !== 'all' || search || clientName) && (
                    <button
                      type="button"
                      onClick={() => { setTagged('all'); setSearch(''); setClientName(''); }}
                      className="mt-3.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 shadow-2xs hover:bg-emerald-100 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300 cursor-pointer"
                    >
                      Reset filters & show all
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              rows.map((r, idx) => (
                <tr key={r.id} className="group transition-colors hover:bg-emerald-50/30 dark:hover:bg-emerald-950/15">
                  <td className="px-5 py-2.5 text-center">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100/90 font-mono text-[10.5px] font-black text-slate-600 transition-colors group-hover:bg-emerald-100 group-hover:text-emerald-800 dark:bg-surface-800 dark:text-neutral-400 dark:group-hover:bg-emerald-950/60 dark:group-hover:text-emerald-300">
                      {idx + 1}
                    </span>
                  </td>
                  <td className="px-5 py-2.5">
                    <Link
                      to={`/batteries/${encodeURIComponent(r.battery_code)}`}
                      className="inline-block truncate font-mono text-xs font-extrabold text-blue-700 transition-colors hover:text-blue-800 hover:underline dark:text-blue-400"
                    >
                      {r.battery_code}
                    </Link>
                    {r.client_name && (
                      <span className="block truncate text-[10.5px] font-medium text-slate-400 dark:text-neutral-500">
                        {r.client_name}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-2.5">
                    <TagCell
                      row={r}
                      editing={editingId === r.id}
                      onEdit={() => setEditingId(r.id)}
                      onCancel={() => setEditingId(null)}
                      onSave={saveTag}
                      onSaved={() => setEditingId(null)}
                      copied={copied}
                      onCopy={copyTag}
                    />
                  </td>
                  <td className="truncate px-5 py-2.5 font-mono text-xs font-semibold text-slate-700 dark:text-neutral-300">
                    {r.serial_number || <span className="font-normal italic text-slate-300 dark:text-neutral-600">—</span>}
                  </td>
                  <td className="whitespace-nowrap px-5 py-2.5">
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              ))
            )}
            {!loading && rows.length > 0 && (
              <tr ref={sentinelRef}>
                <td colSpan={5} className="px-5 py-3 text-center text-[10.5px] font-medium text-slate-400 bg-slate-50/50 dark:bg-surface-800/20">
                  {hasMore ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                      Loading more batteries… ({rows.length} of {total})
                    </span>
                  ) : (
                    <span>✓ Showing all {rows.length} batteries</span>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Mobile Stream (< lg) - ZERO HORIZONTAL SCROLL */}
        <div className="block lg:hidden divide-y divide-slate-100 dark:divide-white/5 p-2">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={`sk-m-${i}`} className="py-2.5 animate-pulse space-y-2">
                <div className="h-4 w-3/4 rounded bg-slate-200/80 dark:bg-white/10" />
                <div className="h-3 w-1/2 rounded bg-slate-200/60 dark:bg-white/5" />
              </div>
            ))
          ) : rows.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-neutral-300">
                {tagged === 'no' ? `Every battery${clientName ? ` for ${clientName}` : ''} already has a tag` : tagged === 'yes' ? `No batteries with an RFID tag${clientName ? ` for ${clientName}` : ''} yet` : 'No batteries found'}
              </p>
              {(tagged !== 'all' || search || clientName) && (
                <button
                  type="button"
                  onClick={() => { setTagged('all'); setSearch(''); setClientName(''); }}
                  className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 shadow-2xs dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300 cursor-pointer"
                >
                  Reset filters & show all
                </button>
              )}
            </div>
          ) : (
            rows.map((r, idx) => (
              <div key={r.id} className="py-2.5 first:pt-1 last:pb-1">
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-100 font-mono text-[10px] font-bold text-slate-500 dark:bg-surface-800 dark:text-neutral-400">
                      {idx + 1}
                    </span>
                    <Link
                      to={`/batteries/${encodeURIComponent(r.battery_code)}`}
                      className="truncate font-mono text-xs font-black text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      🔋 {r.battery_code}
                    </Link>
                  </div>
                  <StatusBadge status={r.status} />
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                  {r.client_name ? (
                    <span className="rounded bg-slate-100 dark:bg-surface-800 px-1.5 py-0.2 font-bold text-slate-700 dark:text-slate-300">
                      {r.client_name}
                    </span>
                  ) : null}
                  {r.serial_number ? (
                    <span className="rounded bg-slate-100 dark:bg-surface-800 px-1.5 py-0.2 font-mono font-semibold text-slate-600 dark:text-neutral-400">
                      SN: {r.serial_number}
                    </span>
                  ) : (
                    <span className="text-slate-400">No serial</span>
                  )}
                </div>

                <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-white/5">
                  <TagCell
                    row={r}
                    editing={editingId === r.id}
                    onEdit={() => setEditingId(r.id)}
                    onCancel={() => setEditingId(null)}
                    onSave={saveTag}
                    onSaved={() => setEditingId(null)}
                    copied={copied}
                    onCopy={copyTag}
                  />
                </div>
              </div>
            ))
          )}
          {!loading && rows.length > 0 && (
            <div ref={mobileSentinelRef} className="py-2.5 text-center text-[10px] font-medium text-slate-400">
              {hasMore ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  Loading more batteries… ({rows.length} of {total})
                </span>
              ) : (
                <span>✓ Showing all {rows.length} batteries</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// RFID tag cell of the tags-by-battery table: shows the tag (click to copy)
// or "No tag yet", and edits in place — type it, or click the box and read the
// sticker with an RFID reader (it types the tag and presses Enter). Stays
// inside the fixed column so the table never changes size.
function TagCell({ row, editing, onEdit, onCancel, onSave, onSaved, copied, onCopy }) {
  const [tag1, setTag1] = useState('');
  const [tag2, setTag2] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const input1Ref = useRef(null);
  const input2Ref = useRef(null);

  useEffect(() => {
    if (!editing) return;
    setTag1('');
    setTag2('');
    setError(null);
    input1Ref.current?.focus();
  }, [editing]);

  async function verifyAndSave() {
    const clean1 = normalizeRfidTag(tag1);
    const clean2 = normalizeRfidTag(tag2);

    if (!clean1) {
      setError('Enter tag in 1st box first.');
      input1Ref.current?.focus();
      return;
    }
    if (!clean2) {
      setError('Re-enter tag in 2nd box to verify.');
      input2Ref.current?.focus();
      return;
    }
    if (clean1 !== clean2) {
      setError('Tags do not match! Please check and re-type.');
      input2Ref.current?.focus();
      input2Ref.current?.select();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(row, clean1);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    const clean1 = normalizeRfidTag(tag1);
    const clean2 = normalizeRfidTag(tag2);
    const isMatching = clean1 && clean2 && clean1 === clean2;
    const isMismatch = clean1 && clean2 && clean1 !== clean2;

    return (
      <div className="w-full py-1">
        <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-xs dark:border-white/10 dark:bg-surface-800">
          <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-neutral-400">
            <span className="flex items-center gap-1 text-slate-700 dark:text-neutral-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Double Verification (Enter tag 2 times)
            </span>
            <button
              type="button"
              onClick={onCancel}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200 cursor-pointer"
              title="Cancel (Esc)"
            >
              ✕
            </button>
          </div>

          <div className="space-y-1.5">
            {/* Box 1 */}
            <div className="flex items-center gap-1.5">
              <span className="w-16 shrink-0 text-[10px] font-bold text-slate-500 dark:text-neutral-400">1st Enter:</span>
              <input
                ref={input1Ref}
                autoFocus
                value={tag1}
                onChange={(e) => { setTag1(e.target.value); setError(null); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (tag1.trim()) {
                      input2Ref.current?.focus();
                      input2Ref.current?.select();
                    }
                  }
                  if (e.key === 'Escape') onCancel();
                }}
                readOnly={saving}
                placeholder="Scan or type tag…"
                className="w-full min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-50/50 px-2 py-1 font-mono text-[11px] uppercase text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-surface-900 dark:text-neutral-100"
              />
            </div>

            {/* Box 2 */}
            <div className="flex items-center gap-1.5">
              <span className="w-16 shrink-0 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">2nd Verify:</span>
              <input
                ref={input2Ref}
                value={tag2}
                onChange={(e) => { setTag2(e.target.value); setError(null); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    verifyAndSave();
                  }
                  if (e.key === 'Escape') onCancel();
                }}
                readOnly={saving}
                placeholder="Re-enter same tag…"
                className={`w-full min-w-0 flex-1 rounded-lg border px-2 py-1 font-mono text-[11px] uppercase text-slate-900 focus:outline-none dark:text-neutral-100 ${
                  isMatching
                    ? 'border-emerald-500 bg-emerald-50/60 dark:border-emerald-600 dark:bg-emerald-950/40'
                    : isMismatch
                    ? 'border-rose-400 bg-rose-50/60 dark:border-rose-600 dark:bg-rose-950/40'
                    : 'border-slate-300 bg-slate-50/50 dark:border-white/15 dark:bg-surface-900'
                }`}
              />
              <button
                type="button"
                onClick={verifyAndSave}
                disabled={saving || !clean1 || !clean2}
                title="Verify and Save (Enter)"
                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-emerald-700 active:scale-95 disabled:opacity-40 cursor-pointer"
              >
                {saving ? '…' : '✓ Save'}
              </button>
            </div>
          </div>

          {/* Feedback & status message */}
          {error ? (
            <p className="mt-1.5 text-[10px] font-bold text-rose-600 dark:text-rose-400">
              ✕ {error}
            </p>
          ) : isMatching ? (
            <p className="mt-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
              ✓ Tags match perfectly! Press Enter or click Save.
            </p>
          ) : (
            <p className="mt-1 text-[9px] text-slate-400 dark:text-neutral-500">
              {row.rfid_tag ? `Current: ${row.rfid_tag} · ` : ''}Scan / type tag in both fields to confirm.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (row.rfid_tag) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={() => onCopy(row.rfid_tag)}
          title="Click to copy RFID tag"
          className="group/btn inline-flex min-w-0 max-w-full items-center gap-2 whitespace-nowrap rounded-xl border border-emerald-300/80 bg-emerald-50/90 px-3 py-1.5 font-mono text-[12px] font-bold text-emerald-800 shadow-2xs transition-all hover:border-emerald-400 hover:bg-emerald-100/90 active:scale-98 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200 cursor-pointer"
        >
          <span className="flex h-2 w-2 shrink-0 items-center justify-center">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          <span className="truncate tracking-wider">{row.rfid_tag}</span>
          <span className="flex items-center gap-1 font-sans text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
            {copied === row.rfid_tag ? (
              <span className="inline-flex items-center gap-0.5 text-emerald-700 dark:text-emerald-300 font-extrabold animate-fade-in">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                </svg>
                Copied!
              </span>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3 opacity-40 group-hover/btn:opacity-100 transition-opacity">
                <path d="M7 3.5A1.5 1.5 0 0 1 8.5 2h3.879a1.5 1.5 0 0 1 1.06.44l3.122 3.12a1.5 1.5 0 0 1 .439 1.061V16.5A1.5 1.5 0 0 1 15.5 18h-7A1.5 1.5 0 0 1 7 16.5v-13Z" />
                <path d="M5 6.5A1.5 1.5 0 0 1 6.5 5h.75v1.5H6.5a.5.5 0 0 0-.5.5v10a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5v-.75H15v.75A1.5 1.5 0 0 1 13.5 18h-7A1.5 1.5 0 0 1 5 16.5v-10Z" />
              </svg>
            )}
          </span>
        </button>
        <button
          type="button"
          onClick={onEdit}
          title="Edit RFID tag"
          aria-label="Edit RFID tag"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-emerald-700 active:scale-95 dark:text-neutral-400 dark:hover:bg-surface-800 dark:hover:text-emerald-300 cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
            <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-rose-200 bg-rose-50/80 px-2.5 py-1 text-[11px] font-bold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> No tag yet
      </span>
      <button
        type="button"
        onClick={onEdit}
        title="Assign RFID tag"
        aria-label="Assign RFID tag"
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-emerald-600 transition-colors hover:bg-emerald-50 hover:text-emerald-700 active:scale-95 dark:text-emerald-400 dark:hover:bg-emerald-950/40 cursor-pointer"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
        </svg>
      </button>
    </div>
  );
}

function Stat({ label, value, tone }) {
  const tones = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300',
    rose: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800/50 dark:bg-rose-950/40 dark:text-rose-300',
    amber: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-300',
    violet: 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-800/50 dark:bg-violet-950/40 dark:text-violet-300',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-semibold ${tones[tone] || 'border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200'}`}>
      <span className="text-sm font-black">{value}</span> {label}
    </span>
  );
}

export default RfidAssignmentPage;
