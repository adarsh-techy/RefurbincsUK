import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, RefreshControl, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import apiClient from '../../services/api-client';
import Icon from '../../components/ui/Icon';

// RFID Assignment — the mobile version of the web RfidAssignmentPage:
// pick the client, choose the .xlsx/.csv (Battery Number, RFID Tag,
// Client Name), review the dry run, then Assign. Below it, the tags-by-
// battery list (assigned / not assigned, per client, 10 per request).

const STATUS = {
  assigned: ['✓ Ready to assign', '✓ Assigned', 'text-emerald-700 bg-emerald-50 border-emerald-200'],
  replaced: ['✓ Will replace old tag', '✓ Assigned (replaced)', 'text-emerald-700 bg-emerald-50 border-emerald-200'],
  unchanged: ['✓ Already has this tag', '✓ Already has this tag', 'text-slate-600 bg-slate-100 border-slate-200'],
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

  // tags-by-battery list
  const [tagged, setTagged] = useState('yes');
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({ assigned: 0, unassigned: 0 });
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

  async function send(dryRun, f = file) {
    const fd = new FormData();
    fd.append('file', { uri: f.uri, name: f.name, type: f.type });
    fd.append('clientName', client);
    const { data } = await apiClient.post(`/batteries/rfid-assign${dryRun ? '?dryRun=true' : ''}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
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
  const ready = (s.assigned || 0) + (s.replaced || 0);
  const done = stage === 'done';
  const problems = (result?.results || []).filter((r) => !['assigned', 'replaced', 'unchanged'].includes(r.status));

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
            {problems.length ? <Text className="rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700">{problems.length} skipped</Text> : null}
          </View>
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
          {[['yes', 'Assigned'], ['no', 'Not assigned'], ['all', 'All']].map(([id, label]) => (
            <TouchableOpacity key={id} onPress={() => setTagged(id)} className={`flex-1 items-center rounded-lg py-1.5 ${tagged === id ? 'bg-white' : ''}`}>
              <Text className={`text-xs font-bold ${tagged === id ? 'text-violet-700' : 'text-slate-500'}`}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  return (
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
        <TouchableOpacity onPress={() => navigation.navigate('BatteryDetail', { code: r.battery_code, fromScan: false })} className="flex-row items-center justify-between rounded-2xl border border-slate-200 bg-white p-3">
          <Text className="text-sm font-bold text-blue-700">{r.battery_code}</Text>
          {r.rfid_tag ? (
            <Text className="ml-2 flex-1 text-right font-mono text-[11px] text-emerald-700" numberOfLines={1}>{r.rfid_tag}</Text>
          ) : (
            <Text className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">No tag yet</Text>
          )}
        </TouchableOpacity>
      )}
    />
  );
}

export { TextInput };
