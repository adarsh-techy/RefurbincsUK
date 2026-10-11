import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Modal, RefreshControl, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import apiClient from '../../services/api-client';
import Icon from '../../components/ui/Icon';
import ScanBatteryInput from '../../components/scan/ScanBatteryInput';

// RFID Assignment — the mobile version of the web RfidAssignmentPage:
// pick the client, choose the .xlsx/.csv (Battery Number, RFID Tag,
// Client Name), review the dry run, then Assign. Below it, the tags-by-
// battery list (assigned / not assigned, per client, 10 per request), where a
// tag can also be assigned or changed by hand: tap "+ Assign", then read the
// sticker (Zebra trigger / RFID reader) or type it — after each save the
// next battery without a tag comes up, so a run can be tagged back to back.

const STATUS = {
  assigned: ['✓ Ready to assign', '✓ Assigned', 'text-emerald-700 bg-emerald-50 border-emerald-200'],
  replaced: ['✓ Will replace old tag', '✓ Assigned (replaced)', 'text-emerald-700 bg-emerald-50 border-emerald-200'],
  unchanged: ['✓ Already has this tag', '✓ Already has this tag', 'text-slate-600 bg-slate-100 border-slate-200'],
  created: ['✓ New battery — will be registered', '✓ Registered + tag assigned', 'text-violet-700 bg-violet-50 border-violet-200'],
  not_found: ['✕ Battery not found', '✕ Skipped — not found', 'text-rose-700 bg-rose-50 border-rose-200'],
  tag_in_use: ['✕ Tag on another battery', '✕ Skipped — tag in use', 'text-amber-800 bg-amber-50 border-amber-200'],
  duplicate_in_sheet: ['✕ Repeated in file', '✕ Skipped — repeated', 'text-amber-800 bg-amber-50 border-amber-200'],
  client_mismatch: ['✕ Client does not match', '✕ Skipped — wrong client', 'text-amber-800 bg-amber-50 border-amber-200'],
  error: ['✕ Row incomplete', '✕ Skipped — incomplete', 'text-rose-700 bg-rose-50 border-rose-200'],
};
const PAGE = 10;

export default function AdminRfidScreen() {
  const navigation = useNavigation();
  const [clients, setClients] = useState([]);
  const [client, setClient] = useState('');
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [stage, setStage] = useState('idle'); // idle | checking | checked | assigning | done
  const [error, setError] = useState(null);
  const [createMissing, setCreateMissing] = useState(false); // also register numbers that don't exist yet

  // tags-by-battery list
  const [tagged, setTagged] = useState('all'); // all by default — nothing is 'Assigned' before the first upload
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({ assigned: 0, unassigned: 0 });
  const [assigning, setAssigning] = useState(null); // row whose tag is being scanned / typed
  const [hasMore, setHasMore] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const reqRef = useRef(0);

  useEffect(() => {
    apiClient.get('/clients').then(({ data }) => setClients((Array.isArray(data) ? data : data?.data || []).filter((c) => c.user_role !== 'recycle_client').map((c) => c.name).sort())).catch(() => {});
  }, []);

  const fetchList = useCallback(async (offset, replace) => {
    const id = ++reqRef.current;
    try {
      const params = { tagged, limit: PAGE, offset };
      if (client) params.clientName = client;
      const { data } = await apiClient.get('/batteries/rfid-assignments', { params });
      if (id !== reqRef.current) return;
      setRows((r) => (replace ? data.data : [...r, ...data.data]));
      setHasMore(Boolean(data.hasMore));
      if (data.counts) setCounts(data.counts);
    } catch { /* list is secondary */ } finally {
      if (id === reqRef.current) setListLoading(false);
    }
  }, [tagged, client]);

  useEffect(() => { setListLoading(true); fetchList(0, true); }, [fetchList]);

  // Manual assign — same endpoint and checks as the sheet upload, one row.
  async function saveTag(row, raw) {
    const tag = String(raw || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
    if (!tag) return { tone: 'warn', message: 'Scan or type the tag first.' };
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
      if (!row.rfid_tag) setCounts((c) => ({ assigned: c.assigned + 1, unassigned: Math.max(0, c.unassigned - 1) }));
      // next battery without a tag, for back-to-back tagging
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
    if (!client) { setError('Select the client first.'); return; }
    const res = await DocumentPicker.getDocumentAsync({
      type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', '*/*'],
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets?.length) return;
    const a = res.assets[0];
    const f = { uri: a.uri, name: a.name || 'sheet.xlsx', type: a.mimeType || (/\.csv$/i.test(a.name || '') ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') };
    setFile(f);
    setResult(null);
    setCreateMissing(false);
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
      setStage('done');
      setListLoading(true);
      fetchList(0, true);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      setStage('checked');
    }
  }

  const s = result?.summary || {};
  const done = stage === 'done';
  const creatable = (result?.results || []).filter((r) => r.status === 'not_found' && r.canCreate);
  const willCreate = !done && createMissing ? creatable.length : 0;
  const ready = (s.assigned || 0) + (s.replaced || 0) + (s.created || 0) + willCreate;
  const problems = (result?.results || []).filter((r) => !['assigned', 'replaced', 'unchanged', 'created'].includes(r.status) && !(willCreate && r.canCreate));

  const header = (
    <View className="gap-3 pb-2">
      <View className="rounded-3xl border border-slate-200 bg-white p-4">
        <Text className="text-sm font-extrabold text-slate-900">1. Pick the client, then the Excel / CSV file</Text>
        <Text className="mt-1 text-xs text-slate-500">Columns: Battery Number, RFID Tag, Client Name. Download the template from the web admin.</Text>
        <View className="mt-3 flex-row flex-wrap gap-2">
          {clients.map((c) => (
            <TouchableOpacity key={c} onPress={() => { setClient(c); setError(null); }} className={`rounded-xl border px-3 py-2 ${client === c ? 'border-violet-600 bg-violet-600' : 'border-slate-300 bg-white'}`}>
              <Text className={`text-xs font-bold ${client === c ? 'text-white' : 'text-slate-700'}`}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity disabled={!client || stage === 'checking' || stage === 'assigning'} onPress={pick} className={`mt-3 flex-row items-center justify-center gap-2 rounded-2xl bg-violet-700 py-3 ${!client ? 'opacity-50' : ''}`}>
          <Icon name="photo" color="#fff" size={16} />
          <Text className="text-sm font-bold text-white">{stage === 'checking' ? 'Reading sheet…' : file ? 'Choose another file' : 'Choose file'}</Text>
        </TouchableOpacity>
        {file && <Text className="mt-2 text-[11px] text-slate-500">Selected: {file.name}</Text>}
        {error && <Text className="mt-2 text-xs font-semibold text-red-600">{error}</Text>}
      </View>

      {result && (
        <View className="rounded-3xl border border-slate-200 bg-white p-4">
          <Text className="text-sm font-extrabold text-slate-900">{done ? '3. Done — tags saved' : '2. Review, then assign'}</Text>
          {!done && <Text className="mt-1 text-xs text-slate-500">Nothing is saved yet. Client: {client}</Text>}
          <View className="mt-3 flex-row flex-wrap gap-2">
            <Text className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{(result.results || []).length} rows</Text>
            <Text className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">{done ? result.written : ready} {done ? 'assigned' : 'ready'}</Text>
            {s.unchanged ? <Text className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{s.unchanged} already set</Text> : null}
            {s.created ? <Text className="rounded-lg bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700">{s.created} new registered</Text> : null}
            {problems.length ? <Text className="rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700">{problems.length} skipped</Text> : null}
          </View>
          {!done && creatable.length > 0 && (
            <TouchableOpacity onPress={() => setCreateMissing((v) => !v)} className={`mt-3 flex-row items-start gap-2.5 rounded-2xl border p-3 ${createMissing ? 'border-violet-500 bg-violet-50' : 'border-violet-200 bg-white'}`}>
              <View className={`mt-0.5 h-5 w-5 items-center justify-center rounded-md border-2 ${createMissing ? 'border-violet-600 bg-violet-600' : 'border-violet-300 bg-white'}`}>
                {createMissing ? <Text className="text-[11px] font-black text-white">✓</Text> : null}
              </View>
              <Text className="flex-1 text-xs text-violet-900">
                <Text className="font-bold">Also register {creatable.length} new batter{creatable.length === 1 ? 'y' : 'ies'} for {client}</Text>
                {` (${creatable[0].batteryCode}${creatable.length > 1 ? ` … ${creatable[creatable.length - 1].batteryCode}` : ''}) and assign their tags. Leave off to skip them.`}
              </Text>
            </TouchableOpacity>
          )}
          {!done ? (
            <TouchableOpacity disabled={ready === 0 || stage === 'assigning'} onPress={assign} className={`mt-3 items-center rounded-2xl bg-emerald-600 py-3 ${ready === 0 ? 'opacity-50' : ''}`}>
              <Text className="text-sm font-bold text-white">{stage === 'assigning' ? 'Assigning…' : `Assign ${ready} tag${ready === 1 ? '' : 's'}`}</Text>
            </TouchableOpacity>
          ) : null}
          {problems.length > 0 && (
            <View className="mt-3 gap-1.5">
              <Text className="text-[11px] font-bold uppercase text-slate-500">Rows that need attention</Text>
              {problems.slice(0, 50).map((r) => {
                const st = STATUS[r.status] || [r.status, r.status, 'text-slate-600 bg-slate-100 border-slate-200'];
                return (
                  <View key={`${r.rowNumber}-${r.batteryCode}`} className="rounded-xl border border-slate-200 p-2.5">
                    <Text className="text-xs font-bold text-slate-900">Row {r.rowNumber} · {r.batteryCode || '—'}</Text>
                    <Text className={`mt-1 self-start rounded-full border px-2 py-0.5 text-[10px] font-bold ${st[2]}`}>{done ? st[1] : st[0]}</Text>
                    {r.message ? <Text className="mt-1 text-[11px] text-slate-500">{r.message}</Text> : null}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}

      <View className="rounded-3xl border border-slate-200 bg-white p-4">
        <Text className="text-sm font-extrabold text-slate-900">RFID tags by battery{client ? ` · ${client}` : ''}</Text>
        <Text className="mt-1 text-xs"><Text className="font-bold text-emerald-700">{counts.assigned} with a tag</Text> · <Text className={`font-bold ${counts.unassigned ? 'text-rose-700' : 'text-slate-500'}`}>{counts.unassigned} without</Text></Text>
        <View className="mt-3 flex-row rounded-xl bg-slate-100 p-1">
          {[['all', 'All'], ['yes', 'Assigned'], ['no', 'Not assigned']].map(([id, label]) => (
            <TouchableOpacity key={id} onPress={() => setTagged(id)} className={`flex-1 items-center rounded-lg py-1.5 ${tagged === id ? 'bg-white' : ''}`}>
              <Text className={`text-xs font-bold ${tagged === id ? 'text-violet-700' : 'text-slate-500'}`}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-slate-50">
    <FlatList
      className="flex-1 bg-slate-50"
      contentContainerClassName="p-4 pb-16 gap-2"
      data={rows}
      keyExtractor={(r) => String(r.id)}
      ListHeaderComponent={header}
      refreshControl={<RefreshControl refreshing={false} onRefresh={() => { setListLoading(true); fetchList(0, true); }} />}
      onEndReached={() => { if (hasMore && !listLoading) { setListLoading(true); fetchList(rows.length, false); } }}
      onEndReachedThreshold={0.4}
      ListEmptyComponent={<Text className="py-6 text-center text-xs text-slate-400">{listLoading ? 'Loading…' : 'No batteries here.'}</Text>}
      ListFooterComponent={hasMore ? <Text className="py-3 text-center text-[11px] text-slate-400">Loading more…</Text> : null}
      renderItem={({ item: r }) => (
        <TouchableOpacity onPress={() => navigation.navigate('BatteryDetail', { code: r.battery_code, fromScan: false })} className="flex-row items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-3">
          <Text className="text-sm font-bold text-blue-700">{r.battery_code}</Text>
          {r.rfid_tag ? (
            <Text className="flex-1 text-right font-mono text-[11px] text-emerald-700" numberOfLines={1}>{r.rfid_tag}</Text>
          ) : (
            <Text className="flex-1 text-right"><Text className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">No tag yet</Text></Text>
          )}
          <TouchableOpacity onPress={() => setAssigning(r)} hitSlop={6} className={`rounded-lg border px-2.5 py-1.5 ${r.rfid_tag ? 'border-slate-200 bg-white' : 'border-violet-200 bg-violet-50'}`}>
            <Text className={`text-[11px] font-bold ${r.rfid_tag ? 'text-slate-600' : 'text-violet-700'}`}>{r.rfid_tag ? 'Change' : '+ Assign'}</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      )}
      ListFooterComponentStyle={{ paddingBottom: 8 }}
    />

    <Modal visible={Boolean(assigning)} transparent animationType="slide" onRequestClose={() => setAssigning(null)}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="rounded-t-3xl bg-white p-5 pb-8 dark:bg-slate-900">
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
              placeholder="Scan or type the RFID tag…"
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

export { TextInput };
