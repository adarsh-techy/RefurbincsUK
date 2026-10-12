import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Modal, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import apiClient from '../../services/api-client';
import Icon from '../../components/ui/Icon';
import { StatusBadge } from '../../components/ui/Badge';
import { clearTagCache, normalizeRfidTag } from '../../utils/scan-input';
import ScanBatteryInput from '../../components/scan/ScanBatteryInput';
import { shareCsv } from '../../utils/share-csv';
import CopyButton from '../../components/ui/CopyButton';

// RFID Assignment — the mobile version of the web RfidAssignmentPage: the
// .xlsx template, pick the client, choose the .xlsx/.csv (Battery Number,
// RFID Tag, Client Name), review the dry run row by row (filters, search,
// per-row status and reason), export the results, then Assign. Below it,
// the tags-by-battery list (GET /batteries/rfid-assignments, 10 per
// request: coverage figures, assigned / not assigned, client filter,
// search), where a tag can also be assigned or changed by hand: tap
// "+ Assign tag", then read the sticker (Zebra trigger / RFID reader) or
// type it — after each save the next battery without a tag comes up.

const STATUS_META = {
  assigned: { label: '✓ Matched — ready to assign', done: '✓ Assigned', cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  replaced: { label: '✓ Matched — will replace old tag', done: '✓ Assigned (old tag replaced)', cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  unchanged: { label: '✓ Already has this tag', done: '✓ Already has this tag', cls: 'text-slate-600 bg-slate-100 border-slate-200' },
  created: { label: '✓ New battery — will be registered', done: '✓ Registered + tag assigned', cls: 'text-violet-700 bg-violet-50 border-violet-200' },
  not_found: { label: '✕ Battery number not found', done: '✕ Skipped — battery not found', cls: 'text-rose-700 bg-rose-50 border-rose-200' },
  tag_in_use: { label: '✕ Tag belongs to another battery', done: '✕ Skipped — tag belongs to another battery', cls: 'text-amber-800 bg-amber-50 border-amber-200' },
  duplicate_in_sheet: { label: '✕ Repeated in this file', done: '✕ Skipped — repeated in this file', cls: 'text-amber-800 bg-amber-50 border-amber-200' },
  client_mismatch: { label: '✕ Client name does not match', done: '✕ Skipped — client name does not match', cls: 'text-amber-800 bg-amber-50 border-amber-200' },
  error: { label: '✕ Row is incomplete', done: '✕ Skipped — row is incomplete', cls: 'text-rose-700 bg-rose-50 border-rose-200' },
};

const FILTERS = [
  { id: 'all', label: 'All rows' },
  { id: 'ok', label: 'Matched ✓', test: (r) => ['assigned', 'replaced', 'unchanged', 'created'].includes(r.status) },
  { id: 'not_found', label: 'Battery not found ✕', test: (r) => r.status === 'not_found' },
  { id: 'problem', label: 'Other problems ✕', test: (r) => ['tag_in_use', 'duplicate_in_sheet', 'client_mismatch', 'error'].includes(r.status) },
];

const PAGE = 10;
const RESULT_PAGE = 50;

const STAT_TONES = {
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  rose: 'border-rose-200 bg-rose-50 text-rose-800',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  violet: 'border-violet-200 bg-violet-50 text-violet-800',
  slate: 'border-slate-200 bg-slate-50 text-slate-700',
};

function Stat({ label, value, tone = 'slate' }) {
  return (
    <Text className={`rounded-lg border px-2.5 py-1 text-xs ${STAT_TONES[tone]}`}>
      <Text className="font-black">{value}</Text> {label}
    </Text>
  );
}

// the API's .xlsx template (Battery Number, RFID Tag, Client Name + a
// "How to fill" sheet), downloaded with the login token and shared
async function downloadTemplate() {
  const token = await AsyncStorage.getItem('token');
  const file = await File.downloadFileAsync(`${apiClient.defaults.baseURL}/batteries/rfid-template`, new File(Paths.cache, 'rfid-assignment-template.xlsx'), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    idempotent: true,
  });
  if (!(await Sharing.isAvailableAsync())) throw new Error(`Sharing isn't available on this device. File saved at ${file.uri}`);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: 'rfid-assignment-template.xlsx',
  });
}

export default function AdminRfidScreen() {
  const navigation = useNavigation();
  const [clients, setClients] = useState([]);
  const [allClients, setAllClients] = useState([]);
  const [client, setClient] = useState('');
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [stage, setStage] = useState('idle'); // idle | checking | checked | assigning | done
  const [error, setError] = useState(null);
  const [createMissing, setCreateMissing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [resultSearch, setResultSearch] = useState('');
  const [resultClient, setResultClient] = useState('');
  const [shown, setShown] = useState(RESULT_PAGE);
  const [templateBusy, setTemplateBusy] = useState(false);

  // tags-by-battery list
  const [listClient, setListClient] = useState('');
  const [listSearch, setListSearch] = useState('');
  const [tagged, setTagged] = useState('all');
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ assigned: 0, unassigned: 0 });
  const [assigning, setAssigning] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(null);
  const reqRef = useRef(0);

  useEffect(() => {
    apiClient.get('/clients').then(({ data }) => {
      const list = Array.isArray(data) ? data : data?.data || [];
      setClients(list.filter((c) => c.user_role !== 'recycle_client').map((c) => c.name).sort());
      setAllClients(list.map((c) => c.name).sort());
    }).catch(() => {});
  }, []);

  const fetchList = useCallback(async (offset, replace) => {
    const id = ++reqRef.current;
    try {
      const params = { tagged, limit: PAGE, offset };
      if (listClient) params.clientName = listClient;
      if (listSearch.trim()) params.search = listSearch.trim();
      const { data } = await apiClient.get('/batteries/rfid-assignments', { params });
      if (id !== reqRef.current) return;
      setRows((r) => (replace ? data.data : [...r, ...data.data]));
      setHasMore(Boolean(data.hasMore));
      setTotal(Number(data.total) || 0);
      if (data.counts) setCounts(data.counts);
      setListError(null);
    } catch (err) {
      if (id === reqRef.current) setListError(err.response?.data?.message || err.message);
    } finally {
      if (id === reqRef.current) setListLoading(false);
    }
  }, [tagged, listClient, listSearch]);

  useEffect(() => {
    setListLoading(true);
    const t = setTimeout(() => fetchList(0, true), listSearch ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchList, listSearch]);

  // Manual assign — same endpoint and checks as the sheet upload, one row.
  async function saveTag(row, raw) {
    // same cleanup as the server (drops a reader's ]Q1 / EPC: prefix)
    const tag = normalizeRfidTag(raw);
    if (!tag) return { tone: 'warn', message: 'Type or scan the tag first.' };
    try {
      const { data } = await apiClient.post('/batteries/rfid-assign', {
        assignments: [{ batteryCode: row.battery_code, rfidTag: tag, clientName: row.client_name }],
        clientName: row.client_name || '',
      });
      const res = data?.results?.[0];
      if (!res || !['assigned', 'replaced', 'unchanged'].includes(res.status)) {
        return { tone: 'bad', message: res?.message || 'Could not assign this tag.' };
      }
      setRows((list) => list.map((x) => (x.id === row.id ? { ...x, rfid_tag: res.rfidTag } : x)));
      clearTagCache(); // scan boxes must see the new tag straight away
      if (!row.rfid_tag) setCounts((c) => ({ assigned: c.assigned + 1, unassigned: Math.max(0, c.unassigned - 1) }));
      const i = rows.findIndex((x) => x.id === row.id);
      const next = rows.slice(i + 1).find((x) => !x.rfid_tag) || null;
      setAssigning(next);
      return { tone: 'good', message: `✓ ${res.rfidTag} saved on ${row.battery_code}${next ? ` — now scan ${next.battery_code}` : ''}` };
    } catch (err) {
      if (!err.response) return { tone: 'bad', message: "Can't reach the server. Check the Wi-Fi / server address." };
      return { tone: 'bad', message: err.response?.data?.message || err.message };
    }
  }

  function skipToNext(row) {
    const i = rows.findIndex((x) => x.id === row.id);
    setAssigning(rows.slice(i + 1).find((x) => !x.rfid_tag) || null);
  }

  async function send(dryRun, f = file) {
    const fd = new FormData();
    fd.append('file', { uri: f.uri, name: f.name, type: f.type });
    fd.append('clientName', client);
    const query = dryRun ? '?dryRun=true' : createMissing ? '?createMissing=true' : '';
    const { data } = await apiClient.post(`/batteries/rfid-assign${query}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    return data;
  }

  async function pick() {
    setError(null);
    if (!client) { setError('Select the client first, then choose the file.'); return; }
    const res = await DocumentPicker.getDocumentAsync({
      type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', '*/*'],
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets?.length) return;
    const a = res.assets[0];
    const f = { uri: a.uri, name: a.name || 'sheet.xlsx', size: a.size, type: a.mimeType || (/\.csv$/i.test(a.name || '') ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') };
    setFile(f);
    setResult(null);
    setCreateMissing(false);
    setFilter('all');
    setStage('checking');
    try {
      setResult(await send(true, f));
      setStage('checked');
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      setStage('idle');
    }
  }

  async function assign() {
    setStage('assigning');
    setError(null);
    try {
      setResult(await send(false));
      clearTagCache();
      setStage('done');
      setListLoading(true);
      fetchList(0, true);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      setStage('checked');
    }
  }

  // keeps the client: the next sheet is usually for the same one
  function reset() {
    setFile(null);
    setResult(null);
    setError(null);
    setStage('idle');
    setFilter('all');
    setResultSearch('');
    setResultClient('');
  }

  const resultRows = result?.results || [];
  const summary = result?.summary || {};
  const committed = stage === 'done';
  const creatable = resultRows.filter((r) => r.status === 'not_found' && r.canCreate);
  const willCreate = !committed && createMissing ? creatable.length : 0;
  const matched = (summary.assigned || 0) + (summary.replaced || 0) + (summary.created || 0) + willCreate;
  const clientsInFile = useMemo(() => [...new Set(resultRows.map((r) => r.clientName).filter(Boolean))].sort(), [resultRows]);
  const visible = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter);
    const q = resultSearch.trim().toLowerCase();
    return resultRows.filter((r) =>
      (!f?.test || f.test(r)) &&
      (!resultClient || (r.clientName || '') === resultClient) &&
      (!q || r.batteryCode?.toLowerCase().includes(q) || r.rfidTag?.toLowerCase().includes(q)));
  }, [resultRows, filter, resultSearch, resultClient]);
  useEffect(() => { setShown(RESULT_PAGE); }, [resultRows, filter, resultSearch, resultClient]);

  async function exportResults() {
    const lines = [['Row', 'Battery Number', 'RFID Tag', 'Status', 'Detail'].join(',')];
    for (const r of resultRows) {
      const meta = STATUS_META[r.status] || { done: r.status, label: r.status };
      lines.push([r.rowNumber, r.batteryCode, r.rfidTag, committed ? meta.done : meta.label, (r.message || '').replace(/,/g, ';')].map((v) => `"${String(v ?? '')}"`).join(','));
    }
    try {
      await shareCsv('rfid-assignment-results.csv', lines.join('\n'));
    } catch (err) {
      Alert.alert('Export failed', err.message);
    }
  }

  async function onTemplate() {
    setTemplateBusy(true);
    try {
      await downloadTemplate();
    } catch (err) {
      Alert.alert('Template', err.message || 'Could not download the template.');
    } finally {
      setTemplateBusy(false);
    }
  }

  const pct = counts.assigned + counts.unassigned > 0 ? Math.round((counts.assigned / (counts.assigned + counts.unassigned)) * 100) : 0;
  const busy = stage === 'checking' || stage === 'assigning';

  const header = (
    <View className="gap-3 pb-2">
      <View>
        <Text className="text-2xl font-bold text-violet-700">RFID Assignment</Text>
        <Text className="text-xs text-slate-500">
          Upload a sheet of battery numbers and RFID tags. Each battery number is matched to a battery created on the Generate QR Code page and its tag is assigned.
        </Text>
        <View className="mt-2 flex-row flex-wrap gap-2">
          <TouchableOpacity disabled={templateBusy} onPress={onTemplate} className="rounded-xl border border-slate-300 bg-white px-3 py-2">
            <Text className="text-xs font-bold text-slate-700">{templateBusy ? 'Downloading…' : 'Download template (.xlsx)'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('GenerateQr')} className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2">
            <Text className="text-xs font-bold text-violet-700">Generate QR Codes →</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Upload */}
      <View className="rounded-3xl border border-slate-200 bg-white p-4">
        <Text className="text-sm font-extrabold text-slate-900">1. Pick the client, then upload the sheet</Text>
        <Text className="mt-1 text-xs text-slate-500">
          .xlsx or .csv with columns <Text className="font-bold">Battery Number</Text>, <Text className="font-bold">RFID Tag</Text> and <Text className="font-bold">Client Name</Text> (header row required). The client you pick here is used for every row; a row with its own Client Name must match the battery's client. Tags are stored as upper-case letters and digits; colons and spaces are ignored. Up to 5,000 rows.
        </Text>
        {file && (
          <Text className="mt-2 text-[11px] text-slate-500">
            Selected: <Text className="font-semibold text-slate-700">{file.name}</Text>{file.size ? ` (${Math.round(file.size / 1024)} KB)` : ''}
          </Text>
        )}
        <Text className="mb-1 mt-3 text-[11px] font-bold uppercase text-slate-500">Select client *</Text>
        <View className="flex-row flex-wrap gap-2">
          {clients.map((c) => (
            <TouchableOpacity key={c} disabled={busy} onPress={() => { setClient(c); setError(null); }} className={`rounded-xl border px-3 py-2 ${client === c ? 'border-violet-600 bg-violet-600' : 'border-slate-300 bg-white'}`}>
              <Text className={`text-xs font-bold ${client === c ? 'text-white' : 'text-slate-700'}`}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View className="mt-3 flex-row gap-2">
          <TouchableOpacity disabled={!client || busy} onPress={pick} className={`flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-violet-700 py-3 ${!client || busy ? 'opacity-50' : ''}`}>
            <Icon name="photo" color="#fff" size={16} />
            <Text className="text-sm font-bold text-white">{stage === 'checking' ? 'Reading sheet…' : file ? 'Choose another file' : 'Choose file'}</Text>
          </TouchableOpacity>
          {file ? (
            <TouchableOpacity onPress={reset} className="items-center justify-center rounded-2xl border border-slate-200 px-4">
              <Text className="text-sm font-bold text-slate-600">Clear</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {error ? <Text className="mt-2 rounded-xl bg-rose-50 p-2.5 text-xs font-semibold text-rose-700">{error}</Text> : null}
      </View>

      {result ? (
        <>
          <View className="rounded-3xl border border-slate-200 bg-white p-4">
            <Text className="text-sm font-extrabold text-slate-900">
              {committed ? '3. Done — tags saved' : '2. Check the table below, then press Assign'}
              <Text className="text-xs font-semibold text-violet-700">  Client: {client}</Text>
            </Text>
            {!committed && (
              <Text className="mt-1 text-xs text-slate-500">
                Nothing has been saved yet. Rows marked ✓ will get their tag when you press <Text className="font-bold">Assign</Text>; rows marked ✕ are skipped and the reason is shown with each row.
              </Text>
            )}
            <View className="mt-3 flex-row flex-wrap gap-1.5">
              <Stat label="rows in file" value={resultRows.length} />
              <Stat label={committed ? 'tags assigned' : 'ready to assign'} value={committed ? result.written ?? matched : matched} tone="emerald" />
              {(summary.unchanged || 0) > 0 && <Stat label="already had this tag" value={summary.unchanged} />}
              {(summary.created || 0) > 0 && <Stat label="new batteries registered" value={summary.created} tone="violet" />}
              {(summary.not_found || 0) - willCreate > 0 && <Stat label="battery not found" value={summary.not_found - willCreate} tone="rose" />}
              {(summary.tag_in_use || 0) > 0 && <Stat label="tag belongs to another battery" value={summary.tag_in_use} tone="amber" />}
              {(summary.duplicate_in_sheet || 0) > 0 && <Stat label="repeated in file" value={summary.duplicate_in_sheet} tone="amber" />}
              {(summary.client_mismatch || 0) > 0 && <Stat label="client name mismatch" value={summary.client_mismatch} tone="amber" />}
              {(summary.error || 0) > 0 && <Stat label="incomplete rows" value={summary.error} tone="rose" />}
            </View>
            {!committed && creatable.length > 0 && (
              <TouchableOpacity onPress={() => setCreateMissing((v) => !v)} className={`mt-3 flex-row items-start gap-2.5 rounded-2xl border p-3 ${createMissing ? 'border-violet-500 bg-violet-50' : 'border-violet-200 bg-white'}`}>
                <View className={`mt-0.5 h-5 w-5 items-center justify-center rounded-md border-2 ${createMissing ? 'border-violet-600 bg-violet-600' : 'border-violet-300 bg-white'}`}>
                  {createMissing ? <Text className="text-[11px] font-black text-white">✓</Text> : null}
                </View>
                <Text className="flex-1 text-xs text-violet-900">
                  <Text className="font-bold">Also register {creatable.length} new batter{creatable.length === 1 ? 'y' : 'ies'} for {client}</Text>
                  {` (${creatable[0].batteryCode}${creatable.length > 1 ? ` … ${creatable[creatable.length - 1].batteryCode}` : ''}) and assign their tags. These numbers are in the sheet but not in the system yet — same as generating them on the QR page. Leave unticked to skip them.`}
                </Text>
              </TouchableOpacity>
            )}
            {!committed && (summary.not_found || 0) - creatable.length > 0 && (
              <Text className="mt-2 text-xs text-rose-700">
                {summary.not_found - creatable.length} battery number{summary.not_found - creatable.length === 1 ? '' : 's'} can't be matched or registered (wrong prefix or unknown client) — see the reason on each row. Those rows will be skipped.
              </Text>
            )}
            {committed && (
              <Text className="mt-2 text-xs font-semibold text-emerald-700">
                {result.written} tag{result.written === 1 ? '' : 's'} saved{result.created ? `, including ${result.created} newly registered batter${result.created === 1 ? 'y' : 'ies'}` : ''}. Scanning any of these tags now opens the battery just like its QR code.
              </Text>
            )}
            <View className="mt-3 flex-row gap-2">
              <TouchableOpacity onPress={exportResults} className="flex-1 items-center rounded-2xl border border-slate-300 py-3">
                <Text className="text-xs font-bold text-slate-700">Export results (.csv)</Text>
              </TouchableOpacity>
              {!committed ? (
                <TouchableOpacity disabled={matched === 0 || stage === 'assigning'} onPress={assign} className={`flex-1 items-center rounded-2xl bg-emerald-600 py-3 ${matched === 0 ? 'opacity-50' : ''}`}>
                  <Text className="text-xs font-bold text-white">{stage === 'assigning' ? 'Assigning…' : `Assign ${matched} tag${matched === 1 ? '' : 's'}`}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={reset} className="flex-1 items-center rounded-2xl bg-violet-700 py-3">
                  <Text className="text-xs font-bold text-white">Upload another sheet</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Rows of the sheet */}
          <View className="rounded-3xl border border-slate-200 bg-white p-4">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5">
              {FILTERS.map((f) => {
                const n = f.test ? resultRows.filter(f.test).length : resultRows.length;
                const on = filter === f.id;
                return (
                  <TouchableOpacity key={f.id} onPress={() => setFilter(f.id)} className={`rounded-xl px-3 py-1.5 ${on ? 'bg-violet-600' : 'bg-slate-100'}`}>
                    <Text className={`text-[11px] font-bold ${on ? 'text-white' : 'text-slate-600'}`}>{f.label} ({n})</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {clientsInFile.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5 pt-2">
                {['', ...clientsInFile].map((c) => (
                  <TouchableOpacity key={c || 'all'} onPress={() => setResultClient(c)} className={`rounded-xl border px-3 py-1.5 ${resultClient === c ? 'border-violet-600 bg-violet-600' : 'border-slate-200'}`}>
                    <Text className={`text-[11px] font-bold ${resultClient === c ? 'text-white' : 'text-slate-600'}`}>{c || 'All clients'}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <TextInput value={resultSearch} onChangeText={setResultSearch} placeholder="Search battery number or tag…" placeholderTextColor="#94a3b8" autoCorrect={false} className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900" />
            <View className="mt-2 gap-1.5">
              {visible.length === 0 ? (
                <Text className="py-4 text-center text-xs text-slate-400">No rows match this filter.</Text>
              ) : (
                visible.slice(0, shown).map((r, idx) => {
                  const toCreate = !committed && createMissing && r.status === 'not_found' && r.canCreate;
                  const meta = STATUS_META[toCreate ? 'created' : r.status] || { label: r.status, done: r.status, cls: 'text-slate-600 bg-slate-100 border-slate-200' };
                  const bad = (r.status === 'not_found' && !toCreate) || r.status === 'error';
                  const why = r.status === 'assigned' ? '' : r.status === 'replaced' ? `Currently has ${r.previousTag}; it will be replaced` : r.message;
                  return (
                    <View key={`${r.rowNumber}-${r.batteryCode}`} className={`rounded-xl border p-2.5 ${bad ? 'border-rose-200 bg-rose-50/60' : 'border-slate-200'}`}>
                      <View className="flex-row items-center gap-2">
                        <Text className="text-[11px] font-semibold text-slate-400">#{idx + 1}</Text>
                        {r.batteryId ? (
                          <TouchableOpacity onPress={() => navigation.navigate('BatteryDetail', { code: r.batteryCode, fromScan: false })}>
                            <Text className="text-xs font-bold text-blue-700">{r.batteryCode}</Text>
                          </TouchableOpacity>
                        ) : (
                          <Text className="text-xs font-bold text-slate-900">{r.batteryCode || 'empty'}</Text>
                        )}
                        <Text className="flex-1 text-right font-mono text-[11px] text-slate-600" numberOfLines={1}>{r.rfidTag || 'empty'}</Text>
                      </View>
                      {r.sheetBatteryCode ? <Text className="text-[10px] text-slate-400">written as {r.sheetBatteryCode}</Text> : null}
                      <Text className={`mt-1 self-start rounded-full border px-2 py-0.5 text-[10px] font-bold ${meta.cls}`}>{committed ? meta.done : meta.label}</Text>
                      {why ? <Text className="mt-1 text-[11px] text-slate-500">{why}</Text> : null}
                    </View>
                  );
                })
              )}
              {visible.length > 0 && (
                shown < visible.length ? (
                  <TouchableOpacity onPress={() => setShown((n) => Math.min(n + RESULT_PAGE, visible.length))} className="items-center rounded-xl border border-slate-200 py-2">
                    <Text className="text-xs font-bold text-slate-600">Show more ({Math.min(shown, visible.length)} of {visible.length})</Text>
                  </TouchableOpacity>
                ) : (
                  <Text className="text-center text-[11px] text-slate-400">Showing all {visible.length} rows</Text>
                )
              )}
            </View>
          </View>
        </>
      ) : stage === 'idle' ? (
        <View className="items-center rounded-3xl border border-dashed border-slate-300 bg-white p-5">
          <Text className="text-sm font-bold text-slate-700">No sheet uploaded yet</Text>
          <Text className="mt-1 text-center text-xs text-slate-500">
            Export the battery numbers from the Battery Fleet page, add the RFID tag beside each one, and upload the file here.
          </Text>
        </View>
      ) : null}

      {/* Tags by battery */}
      <View className="rounded-3xl border border-slate-200 bg-white p-4">
        <Text className="text-sm font-extrabold text-slate-900">RFID tags by battery</Text>
        <Text className="text-[11px] text-slate-500">{listClient || 'All clients'} · in battery-number order</Text>
        <View className="mt-3 flex-row gap-2">
          {[['Tagged', counts.assigned.toLocaleString(), 'text-emerald-700'], ['Without tag', counts.unassigned.toLocaleString(), 'text-rose-700'], ['Coverage', `${pct}%`, 'text-violet-700']].map(([label, v, color]) => (
            <View key={label} className="flex-1 rounded-xl bg-slate-50 p-2">
              <Text className="text-[10px] font-bold uppercase text-slate-400">{label}</Text>
              <Text className={`text-base font-black ${color}`}>{listLoading ? '…' : v}</Text>
            </View>
          ))}
        </View>
        <View className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <View className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
        </View>
        <View className="mt-3 flex-row rounded-xl bg-slate-100 p-1">
          {[['all', 'All', counts.assigned + counts.unassigned], ['yes', 'Assigned', counts.assigned], ['no', 'Not assigned', counts.unassigned]].map(([id, label, n]) => (
            <TouchableOpacity key={id} onPress={() => setTagged(id)} className={`flex-1 items-center rounded-lg py-1.5 ${tagged === id ? 'bg-white' : ''}`}>
              <Text className={`text-xs font-bold ${tagged === id ? 'text-violet-700' : 'text-slate-500'}`}>{label} {listLoading ? '…' : n.toLocaleString()}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5 pt-2">
          {['', ...allClients].map((c) => (
            <TouchableOpacity key={c || 'all'} onPress={() => setListClient(c)} className={`rounded-xl border px-3 py-1.5 ${listClient === c ? 'border-violet-600 bg-violet-600' : 'border-slate-200'}`}>
              <Text className={`text-[11px] font-bold ${listClient === c ? 'text-white' : 'text-slate-600'}`}>{c || 'All clients'}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TextInput value={listSearch} onChangeText={setListSearch} placeholder="Search battery number or tag…" placeholderTextColor="#94a3b8" autoCapitalize="characters" autoCorrect={false} className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900" />
        {listError ? <Text className="mt-2 text-xs font-semibold text-red-600">{listError}</Text> : null}
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-slate-50">
      <FlatList
        className="flex-1 bg-slate-50"
        contentContainerClassName="p-4 pb-16 gap-2"
        data={listLoading && rows.length === 0 ? [] : rows}
        keyExtractor={(r) => String(r.id)}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => { setListLoading(true); fetchList(0, true); }} />}
        onEndReached={() => { if (hasMore && !listLoading) { setListLoading(true); fetchList(rows.length, false); } }}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          listLoading ? (
            <Text className="py-6 text-center text-xs text-slate-400">Loading…</Text>
          ) : (
            <View className="items-center rounded-2xl border border-slate-200 bg-white p-6">
              <Text className="text-sm font-bold text-slate-700">
                {tagged === 'no' ? `Every battery${listClient ? ' for this client' : ''} already has a tag` : tagged === 'yes' ? `No batteries with an RFID tag${listClient ? ' for this client' : ''} yet` : 'No batteries found'}
              </Text>
              <Text className="mt-1 text-xs text-slate-500">{tagged === 'yes' ? 'Upload a sheet above to assign tags.' : listSearch ? 'Try a different search.' : ''}</Text>
              {tagged !== 'all' && !listSearch && (
                <TouchableOpacity onPress={() => setTagged('all')} className="mt-3 rounded-xl bg-violet-600 px-4 py-2">
                  <Text className="text-xs font-bold text-white">Show all batteries</Text>
                </TouchableOpacity>
              )}
            </View>
          )
        }
        ListFooterComponent={
          rows.length > 0 ? (
            <Text className="py-3 text-center text-[11px] text-slate-400">
              {hasMore ? `Loading more… (${rows.length} of ${total})` : `Showing all ${rows.length} rows`}
            </Text>
          ) : null
        }
        renderItem={({ item: r, index }) => (
          <View className="rounded-2xl border border-slate-200 bg-white p-3">
            <View className="flex-row flex-wrap items-center justify-between gap-2">
              <View className="flex-row items-center gap-2">
                <Text className="font-mono text-xs font-bold text-slate-400">#{index + 1}</Text>
                <TouchableOpacity onPress={() => navigation.navigate('BatteryDetail', { code: r.battery_code, fromScan: false })}>
                  <Text className="text-sm font-bold text-blue-700">{r.battery_code}</Text>
                </TouchableOpacity>
              </View>
              <StatusBadge status={r.status} />
            </View>
            <View className="mt-2 flex-row items-center gap-2">
              {r.rfid_tag ? (
                <View className="flex-1 flex-row items-center gap-1.5">
                  <Text className="shrink font-mono text-[11px] text-emerald-700" numberOfLines={1} selectable>● {r.rfid_tag}</Text>
                  <CopyButton value={r.rfid_tag} />
                </View>
              ) : (
                <View className="flex-1"><Text className="self-start rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">● No tag yet</Text></View>
              )}
              <TouchableOpacity onPress={() => setAssigning(r)} hitSlop={6} className={`rounded-lg border px-2.5 py-1.5 ${r.rfid_tag ? 'border-slate-200 bg-white' : 'border-violet-200 bg-violet-50'}`}>
                <Text className={`text-[11px] font-bold ${r.rfid_tag ? 'text-slate-600' : 'text-violet-700'}`}>{r.rfid_tag ? 'Change' : '+ Assign tag'}</Text>
              </TouchableOpacity>
            </View>
            <Text className="mt-1 text-[11px] text-slate-500">Serial: {r.serial_number || '—'}{r.client_name ? ` · ${r.client_name}` : ''}</Text>
          </View>
        )}
      />

      <Modal visible={Boolean(assigning)} transparent animationType="slide" onRequestClose={() => setAssigning(null)}>
        <View className="flex-1 justify-end bg-black/50">
          <View className="w-full max-w-2xl self-center rounded-t-3xl bg-white p-5 pb-8 dark:bg-slate-900">
            <View className="flex-row items-center gap-2">
              <Icon name="rfid" color="#6d28d9" size={20} />
              <Text className="flex-1 text-base font-extrabold text-slate-900 dark:text-white">
                {assigning?.rfid_tag ? 'Change tag' : 'Assign tag'} · {assigning?.battery_code}
              </Text>
              <TouchableOpacity onPress={() => setAssigning(null)} hitSlop={10}>
                <Text className="text-sm font-bold text-slate-500">Done</Text>
              </TouchableOpacity>
            </View>
            <Text className="mb-3 mt-1 text-xs text-slate-500">
              {assigning?.client_name ? `${assigning.client_name} · ` : ''}
              {assigning?.rfid_tag ? `Current tag ${assigning.rfid_tag}. ` : ''}
              Read the sticker with the reader (or type it). After saving, the next battery without a tag comes up.
            </Text>
            {assigning && (
              <ScanBatteryInput
                startInRfidMode
                showCamera={false}
                submitLabel="Save"
                placeholder={assigning.rfid_tag ? 'New tag — type or scan' : 'Type or scan tag…'}
                multiple={false}
                onSubmit={(raw) => saveTag(assigning, raw)}
              />
            )}
            {assigning && !assigning.rfid_tag && (
              <TouchableOpacity onPress={() => skipToNext(assigning)} className="mt-3 items-center rounded-xl border border-slate-200 py-2.5">
                <Text className="text-xs font-bold text-slate-600">Skip to next battery without a tag</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
