import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../../services/api-client';
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
  not_found: { label: '✕ Battery number not found', done: '✕ Skipped — battery not found', cls: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50' },
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
  { id: 'ok', label: 'Matched ✓', test: (r) => ['assigned', 'replaced', 'unchanged'].includes(r.status) },
  { id: 'not_found', label: 'Battery not found ✕', test: (r) => r.status === 'not_found' },
  { id: 'problem', label: 'Other problems ✕', test: (r) => ['tag_in_use', 'duplicate_in_sheet', 'client_mismatch', 'error'].includes(r.status) },
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
  const sentinelRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    apiClient.get('/clients')
      .then(({ data }) => setClients((Array.isArray(data) ? data : data?.data || []).filter((c) => c.user_role !== 'recycle_client').map((c) => c.name).sort()))
      .catch(() => {});
  }, []);

  async function send(selected, dryRun) {
    const formData = new FormData();
    formData.append('file', selected);
    formData.append('clientName', uploadClient);
    const { data } = await apiClient.post(`/batteries/rfid-assign${dryRun ? '?dryRun=true' : ''}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  }

  async function handleFile(selected) {
    if (!selected) return;
    if (!uploadClient) { setError('Select the client first, then choose the file.'); return; }
    setFile(selected);
    setResult(null);
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
  const matched = (summary.assigned || 0) + (summary.replaced || 0);
  const committed = stage === 'done';
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
  }, [rows, filter, search, clientFilter]);

  // Lazy load: when the sentinel row at the bottom of the scroll box becomes
  // visible, reveal the next PAGE_SIZE rows
  useEffect(() => {
    const el = sentinelRef.current;
    const root = scrollRef.current;
    if (!el || !root || !hasMore) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setShown((n) => Math.min(n + PAGE_SIZE, visible.length));
      },
      { root, rootMargin: '80px' }
    );
    io.observe(el);
    return () => io.disconnect();
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
    <div className="space-y-5">
      <PageHeader
        title="RFID Assignment"
        description="Upload a sheet of battery numbers and RFID tags. Each battery number is matched to a battery created on the Generate QR Code page and its tag is assigned."
        titleClassName="text-2xl font-bold tracking-tight text-violet-700 dark:text-violet-300"
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={downloadTemplate}>Download template (.xlsx)</Button>
          <Link to="/batteries-qr-code" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-200 dark:hover:bg-surface-700">
            Generate QR Codes →
          </Link>
        </div>
      </PageHeader>

      {/* Upload */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-surface-900">
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">1. Pick the client, then upload the sheet</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
              .xlsx or .csv with columns <span className="font-mono font-semibold">Battery Number</span>, <span className="font-mono font-semibold">RFID Tag</span> and{' '}
              <span className="font-mono font-semibold">Client Name</span> (header row required). The client you pick here is used for every row; a row with its own Client Name must match the battery's client. Tags are stored as upper-case letters and digits; colons and spaces are ignored. Up to 5,000 rows.
            </p>
            {file && (
              <p className="mt-2 text-xs font-medium text-slate-700 dark:text-neutral-200">
                Selected: <span className="font-mono">{file.name}</span> ({Math.round(file.size / 1024)} KB)
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={uploadClient}
              onChange={(e) => { setUploadClient(e.target.value); setError(null); }}
              disabled={stage === 'previewing' || stage === 'assigning'}
              className={`rounded-md border px-3 py-2 text-sm text-slate-900 focus:border-violet-500 focus:outline-none dark:bg-surface-800 dark:text-neutral-100 ${uploadClient ? 'border-slate-300 dark:border-surface-600' : 'border-violet-400 ring-2 ring-violet-500/20'}`}
            >
              <option value="">Select client *</option>
              {clients.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <Button variant="darkViolet" onClick={() => inputRef.current?.click()} disabled={!uploadClient || stage === 'previewing' || stage === 'assigning'} title={uploadClient ? '' : 'Select the client first'}>
              {stage === 'previewing' ? 'Reading sheet…' : file ? 'Choose another file' : 'Choose file'}
            </Button>
            {file && <Button variant="ghost" onClick={reset}>Clear</Button>}
          </div>
        </div>
        {error && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-800/50 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </div>
        )}
      </div>

      {result && (
        <>
          {/* Summary + action */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-surface-900">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {committed ? '3. Done — tags saved' : '2. Check the table below, then press Assign'}
                  <span className="ml-2 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-bold text-violet-700 dark:border-violet-800/50 dark:bg-violet-950/40 dark:text-violet-300">Client: {uploadClient}</span>
                </p>
                {!committed && (
                  <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
                    Nothing has been saved yet. Rows marked ✓ will get their tag when you press <b>Assign</b>; rows marked ✕ are skipped and the reason is shown in the last column.
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <Stat label="rows in file" value={rows.length} />
                  <Stat label={committed ? 'tags assigned' : 'ready to assign'} value={matched} tone="emerald" />
                  {(summary.unchanged || 0) > 0 && <Stat label="already had this tag" value={summary.unchanged} />}
                  {(summary.not_found || 0) > 0 && <Stat label="battery not found" value={summary.not_found} tone="rose" />}
                  {(summary.tag_in_use || 0) > 0 && <Stat label="tag belongs to another battery" value={summary.tag_in_use} tone="amber" />}
                  {(summary.duplicate_in_sheet || 0) > 0 && <Stat label="repeated in file" value={summary.duplicate_in_sheet} tone="amber" />}
                  {(summary.client_mismatch || 0) > 0 && <Stat label="client name mismatch" value={summary.client_mismatch} tone="amber" />}
                  {(summary.error || 0) > 0 && <Stat label="incomplete rows" value={summary.error} tone="rose" />}
                </div>
                {!committed && (summary.not_found || 0) > 0 && (
                  <p className="mt-2 text-xs text-rose-700 dark:text-rose-300">
                    {summary.not_found} battery number{summary.not_found === 1 ? '' : 's'} do{summary.not_found === 1 ? 'es' : ''} not exist yet. Generate them on the QR page, or fix the sheet — those rows will be skipped.
                  </p>
                )}
                {committed && (
                  <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    {result.written} tag{result.written === 1 ? '' : 's'} saved. Scanning any of these tags now opens the battery just like its QR code.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={exportResults}>Export results (.csv)</Button>
                {!committed ? (
                  <Button variant="primary" onClick={handleAssign} disabled={matched === 0 || stage === 'assigning'}>
                    {stage === 'assigning' ? 'Assigning…' : `Assign ${matched} tag${matched === 1 ? '' : 's'}`}
                  </Button>
                ) : (
                  <Button variant="darkViolet" onClick={reset}>Upload another sheet</Button>
                )}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-surface-900">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
              <div className="flex flex-wrap gap-1.5">
                {FILTERS.map((f) => {
                  const count = f.test ? rows.filter(f.test).length : rows.length;
                  const active = filter === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFilter(f.id)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${active ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-surface-800 dark:text-neutral-300'}`}
                    >
                      {f.label} ({count})
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-2">
                {clientsInFile.length > 1 && (
                  <select
                    value={clientFilter}
                    onChange={(e) => setClientFilter(e.target.value)}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-violet-500 focus:outline-none dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-100"
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
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-100 sm:w-64"
                />
              </div>
            </div>
            <div ref={scrollRef} className="max-h-[60vh] overflow-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-surface-800">
                  <tr>
                    <th className="px-4 py-3 font-bold text-slate-700 dark:text-neutral-300">#</th>
                    <th className="px-4 py-3 font-bold text-slate-700 dark:text-neutral-300">Battery Number</th>
                    <th className="px-4 py-3 font-bold text-slate-700 dark:text-neutral-300">RFID Tag (from file)</th>
                    <th className="px-4 py-3 font-bold text-slate-700 dark:text-neutral-300">Assignment Status</th>
                    <th className="px-4 py-3 font-bold text-slate-700 dark:text-neutral-300">Why</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {visible.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">No rows match this filter.</td>
                    </tr>
                  ) : (
                    pageRows.map((r) => {
                      const meta = STATUS_META[r.status] || { label: r.status, done: r.status, cls: '' };
                      const notFound = r.status === 'not_found';
                      const bad = notFound || r.status === 'error';
                      return (
                        <tr key={`${r.rowNumber}-${r.batteryCode}`} className={bad ? 'bg-rose-50/70 dark:bg-rose-950/20' : ''}>
                          <td className="px-4 py-2.5 text-slate-400">{r.rowNumber}</td>
                          <td className={`px-4 py-2.5 font-mono font-semibold ${notFound ? 'text-rose-700 dark:text-rose-300' : 'text-slate-900 dark:text-white'}`}>
                            {r.batteryId ? (
                              <Link to={`/batteries/${encodeURIComponent(r.batteryCode)}`} className="hover:underline">{r.batteryCode}</Link>
                            ) : (
                              <span className="inline-flex items-center gap-1.5">
                                {notFound && <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />}
                                {r.batteryCode || <span className="italic text-slate-400">empty</span>}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-slate-700 dark:text-neutral-200">{r.rfidTag || <span className="italic text-slate-400">empty</span>}</td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${meta.cls}`}>
                              {committed ? meta.done : meta.label}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-slate-500 dark:text-neutral-400">
                            {r.status === 'assigned' ? '' : r.status === 'replaced' ? `Currently has ${r.previousTag}; it will be replaced` : r.message}
                          </td>
                        </tr>
                      );
                    })
                  )}
                  {visible.length > 0 && (
                    <tr ref={sentinelRef}>
                      <td colSpan={5} className="px-4 py-3 text-center text-[11px] text-slate-400">
                        {hasMore ? `Loading more… (${pageRows.length} of ${visible.length})` : `Showing all ${visible.length} rows`}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!result && stage === 'idle' && (
        <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-white/10">
          <p className="text-sm font-semibold text-slate-700 dark:text-neutral-200">No sheet uploaded yet</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
            Export the battery numbers from the Battery Fleet page, add the RFID tag beside each one, and upload the file here.
          </p>
        </div>
      )}

      <AssignedTagsTable version={assignedVersion} />
    </div>
  );
}

// Every battery that already has an RFID tag — GET /batteries/rfid-assignments,
// 10 per request, next page fetched as the bottom of the box scrolls into
// view. Filter by client and search by battery number / tag.
function AssignedTagsTable({ version }) {
  const [clients, setClients] = useState([]);
  const [clientName, setClientName] = useState('');
  const [search, setSearch] = useState('');
  const [tagged, setTagged] = useState('yes'); // yes | no | all
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ assigned: 0, unassigned: 0 });
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);
  const sentinelRef = useRef(null);
  const requestRef = useRef(0);
  const debounceRef = useRef(null);

  useEffect(() => {
    apiClient.get('/clients').then(({ data }) => setClients((Array.isArray(data) ? data : data?.data || []).map((c) => c.name).sort())).catch(() => {});
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
    const el = sentinelRef.current;
    const root = scrollRef.current;
    if (!el || !root || !hasMore || loading) return undefined;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !loadingMore) {
        setLoadingMore(true);
        fetchPage(rows.length, false);
      }
    }, { root, rootMargin: '80px' });
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, loading, loadingMore, rows.length]);

  const pct = counts.assigned + counts.unassigned > 0 ? Math.round((counts.assigned / (counts.assigned + counts.unassigned)) * 100) : 0;
  const [copied, setCopied] = useState(null);
  function copyTag(tag) {
    navigator.clipboard?.writeText(tag).then(() => { setCopied(tag); setTimeout(() => setCopied(null), 1200); }).catch(() => {});
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-surface-900">
      {/* Header band */}
      <div className="border-b border-slate-200 bg-gradient-to-r from-violet-50 via-white to-emerald-50 px-5 py-4 dark:border-white/10 dark:from-violet-950/30 dark:via-surface-900 dark:to-emerald-950/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="M4.9 19.1a10 10 0 0 1 0-14.2" /><path d="M7.8 16.2a6 6 0 0 1 0-8.4" /><circle cx="12" cy="12" r="2" /><path d="M16.2 7.8a6 6 0 0 1 0 8.4" /><path d="M19.1 4.9a10 10 0 0 1 0 14.2" />
              </svg>
            </div>
            <div>
              <p className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">RFID tags by battery</p>
              <p className="text-xs text-slate-500 dark:text-neutral-400">{clientName || 'All clients'} · in battery-number order</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:w-[372px]">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-3.5 py-2 dark:border-emerald-800/50 dark:bg-emerald-950/40">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Tagged</p>
              <p className="text-lg font-black text-emerald-800 dark:text-emerald-200">{loading ? '…' : counts.assigned.toLocaleString()}</p>
            </div>
            <div className={`rounded-2xl border px-3.5 py-2 ${counts.unassigned > 0 ? 'border-rose-200 bg-rose-50/80 dark:border-rose-800/50 dark:bg-rose-950/40' : 'border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-surface-800'}`}>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${counts.unassigned > 0 ? 'text-rose-700 dark:text-rose-300' : 'text-slate-500'}`}>Without tag</p>
              <p className={`text-lg font-black ${counts.unassigned > 0 ? 'text-rose-800 dark:text-rose-200' : 'text-slate-700 dark:text-neutral-200'}`}>{loading ? '…' : counts.unassigned.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-violet-200 bg-violet-50/80 px-3.5 py-2 dark:border-violet-800/50 dark:bg-violet-950/40">
              <p className="text-[10px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">Coverage</p>
              <p className="text-lg font-black text-violet-800 dark:text-violet-200">{loading ? '…' : `${pct}%`}</p>
            </div>
          </div>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-violet-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
        <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-surface-800">
          {[['yes', 'Assigned', counts.assigned], ['no', 'Not assigned', counts.unassigned], ['all', 'All', counts.assigned + counts.unassigned]].map(([id, label, n]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTagged(id)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${tagged === id ? 'bg-white text-violet-700 shadow-sm dark:bg-surface-900 dark:text-violet-300' : 'text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-white'}`}
            >
              {label} <span className={`ml-1 inline-block min-w-[2.25rem] rounded-full px-1.5 py-0.5 text-center text-[10px] tabular-nums ${tagged === id ? 'bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300' : 'bg-slate-200/80 text-slate-500 dark:bg-white/10 dark:text-neutral-400'}`}>{loading ? '…' : n.toLocaleString()}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className="w-48 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-100"
          >
            <option value="">All clients</option>
            {clients.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="relative">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400">
              <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search battery number or tag…"
              className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-100 sm:w-72 sm:min-w-[18rem]"
            />
          </div>
        </div>
      </div>
      {error && <p className="px-5 py-2 text-xs font-medium text-rose-600">{error}</p>}

      {/* Table */}
      {/* Fixed height + fixed column widths: the box stays the same size
          whether it holds 2 rows or 500, is loading, or is filtered. */}
      <div ref={scrollRef} className="h-[520px] overflow-auto">
        <table className="w-full min-w-[720px] table-fixed text-left text-xs">
          <colgroup>
            <col className="w-[22%]" />
            <col className="w-[40%]" />
            <col className="w-[16%]" />
            <col className="w-[22%]" />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur dark:bg-surface-800/95">
            <tr className="border-b border-slate-200 dark:border-white/10">
              <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">Battery</th>
              <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">RFID tag</th>
              <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">Serial</th>
              <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={`sk-${i}`} className="animate-pulse">
                  {[28, 48, 20, 24].map((w, c) => (
                    <td key={c} className="px-5 py-3.5"><div className="h-3 rounded bg-slate-200/80 dark:bg-white/10" style={{ width: `${w}%` }} /></td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-14 text-center">
                  <p className="text-sm font-semibold text-slate-700 dark:text-neutral-200">
                    {tagged === 'no' ? `Every battery${clientName ? ' for this client' : ''} already has a tag` : tagged === 'yes' ? `No batteries with an RFID tag${clientName ? ' for this client' : ''} yet` : 'No batteries found'}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{tagged === 'yes' ? 'Upload a sheet above to assign tags.' : search ? 'Try a different search.' : ''}</p>
                </td>
              </tr>
            ) : (
              rows.map((r, idx) => (
                <tr key={r.id} className={`group transition-colors hover:bg-violet-50/50 dark:hover:bg-violet-950/20 ${idx % 2 ? 'bg-slate-50/40 dark:bg-white/[0.02]' : ''}`}>
                  <td className="px-5 py-3">
                    <Link to={`/batteries/${encodeURIComponent(r.battery_code)}`} className="block truncate font-mono text-[13px] font-bold text-blue-700 hover:underline dark:text-blue-400">{r.battery_code}</Link>
                  </td>
                  <td className="px-5 py-3">
                    {r.rfid_tag ? (
                      <button
                        type="button"
                        onClick={() => copyTag(r.rfid_tag)}
                        title="Click to copy"
                        className="inline-flex max-w-full items-center gap-2 whitespace-nowrap rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-mono text-[12px] font-semibold text-emerald-800 transition-colors hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-200"
                      >
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                        <span className="truncate">{r.rfid_tag}</span>
                        <span className="font-sans text-[10px] font-bold text-emerald-600/70 opacity-0 transition-opacity group-hover:opacity-100 dark:text-emerald-300/70">{copied === r.rfid_tag ? 'Copied!' : 'copy'}</span>
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-rose-300 bg-rose-50/70 px-2.5 py-1 text-[11px] font-bold text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/30 dark:text-rose-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> No tag yet
                      </span>
                    )}
                  </td>
                  <td className="truncate px-5 py-3 font-mono text-slate-600 dark:text-neutral-300">{r.serial_number || <span className="text-slate-300 dark:text-neutral-600">—</span>}</td>
                  <td className="whitespace-nowrap px-5 py-3"><StatusBadge status={r.status} /></td>
                </tr>
              ))
            )}
            {!loading && rows.length > 0 && (
              <tr ref={sentinelRef}>
                <td colSpan={4} className="px-5 py-3 text-center text-[11px] text-slate-400">
                  {hasMore ? `Loading more… (${rows.length} of ${total})` : `Showing all ${rows.length} rows`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }) {
  const tones = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300',
    rose: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800/50 dark:bg-rose-950/40 dark:text-rose-300',
    amber: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-300',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-semibold ${tones[tone] || 'border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200'}`}>
      <span className="text-sm font-black">{value}</span> {label}
    </span>
  );
}

export default RfidAssignmentPage;
