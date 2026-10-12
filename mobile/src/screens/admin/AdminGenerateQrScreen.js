import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import apiClient from '../../services/api-client';
import Icon from '../../components/ui/Icon';
import { DEFAULT_COLUMNS, ROWS, codesInRange, printQrSheet, qrContentFor, shareQrSheet } from '../../utils/print-qr-sheet';
import QrCodeModal, { QrImage, shareSingleQr } from '../../components/admin/sa1/QrCodeModal';
import SerialNumberModal from '../../components/admin/sa1/SerialNumberModal';

// Generate QR Code — the mobile version of the web GenerateQrPage:
// Individual (POST /batteries/generate, with the QR preview) or Bulk (POST
// /batteries/generate-bulk, presets, starting number, ID range preview);
// then the Generated QR Codes list (GET /batteries?qrGenerated=true) with
// search, client filter, Show blocked (super admin), the print-sheet form
// (start from # / how many / per row → View Sheet or Download Sheet PDF),
// and per row: view / download the QR, add or edit the Battery Number, and
// (super admin) block / unblock or delete.

const BATTERY_NUMBER_DIGITS = 7;
const SHEET_SIZE = DEFAULT_COLUMNS * ROWS;
const LIST_PAGE = 20;
const DEBOUNCE_MS = 250;
const BULK_PRESETS = [10, 50, 100, 500, 1000, 5000, 10000, 50000];
// Each client has its own stored prefix (clients.battery_prefix); the first
// three letters of the name are only a fallback.
const prefixOf = (name, clients = []) => {
  const trimmed = (name || '').trim();
  const match = trimmed && clients.find((c) => (c.name || '').trim().toLowerCase() === trimmed.toLowerCase());
  return match?.battery_prefix || trimmed.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();
};
const pad = (n, len) => String(n).padStart(len, '0');

function useNextNumber(clientName) {
  const [next, setNext] = useState(1);
  useEffect(() => {
    if (!clientName) { setNext(1); return undefined; }
    const t = setTimeout(() => {
      apiClient.get('/batteries/count-by-client', { params: { clientName } })
        .then(({ data }) => setNext((Number(data.lastNumber) || 0) + 1))
        .catch(() => setNext(1));
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [clientName]);
  return [next, setNext];
}

function ClientPicker({ clients, value, onChange }) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {clients.map((c) => {
        const active = value === c.name;
        return (
          <TouchableOpacity key={c.id} onPress={() => onChange(active ? '' : c.name)} className={`rounded-xl border px-3 py-2 ${active ? 'border-violet-600 bg-violet-600' : 'border-blue-200 bg-blue-50/60'}`}>
            <Text className={`text-xs font-bold ${active ? 'text-white' : 'text-slate-700'}`}>{c.name}</Text>
          </TouchableOpacity>
        );
      })}
      {clients.length === 0 && <Text className="text-xs text-slate-400">Loading clients…</Text>}
    </View>
  );
}

function Label({ children, hint }) {
  return (
    <Text className="mb-1.5 text-sm font-medium text-slate-700">
      {children}
      {hint ? <Text className="text-xs font-normal text-slate-400"> {hint}</Text> : null}
    </Text>
  );
}

const input = 'rounded-xl border border-blue-200 bg-blue-50/60 px-3.5 py-2.5 text-sm text-slate-900';

export default function AdminGenerateQrScreen() {
  const navigation = useNavigation();
  const user = useSelector((s) => s.auth.user);
  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = isSuperAdmin || user?.role === 'admin';
  const [clients, setClients] = useState([]);
  const [tab, setTab] = useState('individual');

  // individual
  const [serialNumber, setSerialNumber] = useState('');
  const [clientName, setClientName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [qrResult, setQrResult] = useState(null);
  const [suggestedNumber] = useNextNumber(clientName);

  // bulk
  const [bulkClientName, setBulkClientName] = useState('');
  const [bulkCount, setBulkCount] = useState('100');
  const [bulkStartNumber, setBulkStartNumber] = useState('');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkError, setBulkError] = useState(null);
  const [bulkResult, setBulkResult] = useState(null);
  const [bulkSuggestedStart] = useNextNumber(bulkClientName);

  // generated list
  const [listSearchInput, setListSearchInput] = useState('');
  const [listSearch, setListSearch] = useState('');
  const [listClientFilter, setListClientFilter] = useState('');
  const [showBlocked, setShowBlocked] = useState(false);
  const [rows, setRows] = useState([]);
  const [listTotal, setListTotal] = useState(0);
  const [listHasMore, setListHasMore] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(null);
  const reqRef = useRef(0);

  // row modals
  const [viewingQr, setViewingQr] = useState(null);
  const [serialTarget, setSerialTarget] = useState(null);
  const [busyRow, setBusyRow] = useState(null);

  // print sheet
  const [sheetStart, setSheetStart] = useState('1');
  const [sheetCount, setSheetCount] = useState(String(SHEET_SIZE));
  const [sheetColumns, setSheetColumns] = useState(String(DEFAULT_COLUMNS));
  const [sheetLoading, setSheetLoading] = useState(null); // 'view' | 'download'
  const [sheetError, setSheetError] = useState(null);
  const [resultPrinting, setResultPrinting] = useState(null);

  useEffect(() => {
    apiClient.get('/clients')
      .then(({ data }) => setClients((Array.isArray(data) ? data : data?.data || []).filter((c) => c.user_role !== 'recycle_client')))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setListSearch(listSearchInput.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [listSearchInput]);

  const fetchList = useCallback(async (offset, replace) => {
    const id = ++reqRef.current;
    try {
      const params = { qrGenerated: true, limit: LIST_PAGE, offset };
      if (listSearch) params.search = listSearch;
      if (listClientFilter) params.clientName = listClientFilter;
      if (showBlocked) params.includeBlocked = true;
      const { data } = await apiClient.get('/batteries', { params });
      if (id !== reqRef.current) return;
      setRows((prev) => (replace ? data.data || [] : [...prev, ...(data.data || [])]));
      setListHasMore(Boolean(data.hasMore));
      setListTotal(Number(data.total) || 0);
      setListError(null);
    } catch (err) {
      if (id === reqRef.current) setListError(err.response?.data?.message || err.message);
    } finally {
      if (id === reqRef.current) setListLoading(false);
    }
  }, [listSearch, listClientFilter, showBlocked]);

  const refetchList = useCallback(() => { setListLoading(true); fetchList(0, true); }, [fetchList]);
  useEffect(() => { refetchList(); }, [refetchList]);

  // ── individual ──
  const clientPrefix = prefixOf(clientName, clients);
  const computedBatteryId = clientPrefix ? `${clientPrefix}-${pad(suggestedNumber, BATTERY_NUMBER_DIGITS)}` : '';

  async function handleSubmit() {
    if (!clientName.trim()) { setError('Select a client first — the Battery ID is generated from it.'); return; }
    setSubmitting(true);
    setError(null);
    setQrResult(null);
    try {
      const { data: created } = await apiClient.post('/batteries/generate', {
        clientName: clientName.trim(),
        serialNumber: serialNumber.trim() || undefined,
        batteryCode: computedBatteryId,
      });
      setSerialNumber('');
      setClientName('');
      setQrResult({ batteryCode: created.battery_code, clientName: created.client_name || clientName.trim() });
      refetchList();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setSerialNumber('');
    setClientName('');
    setQrResult(null);
    setError(null);
  }

  // ── bulk ──
  const bulkStart = Number(bulkStartNumber) > 0 ? Number(bulkStartNumber) : bulkSuggestedStart;
  const bulkEnd = bulkStart + Math.max(Number(bulkCount) || 1, 1) - 1;
  const bulkPrefix = prefixOf(bulkClientName, clients);
  const padLen = Math.max(BATTERY_NUMBER_DIGITS, String(bulkEnd).length);
  const bulkFirstPreview = bulkPrefix ? `${bulkPrefix}-${pad(bulkStart, padLen)}` : '—';
  const bulkLastPreview = bulkPrefix ? `${bulkPrefix}-${pad(bulkEnd, padLen)}` : '—';
  const hasBulkClient = Boolean(bulkClientName.trim());

  async function handleBulkSubmit() {
    const count = Number(bulkCount);
    if (!hasBulkClient) { setBulkError('Select a client first.'); return; }
    if (!count || count < 1 || count > 50000) { setBulkError('Please enter a count between 1 and 50,000.'); return; }
    setBulkSubmitting(true);
    setBulkError(null);
    setBulkResult(null);
    try {
      const payload = { clientName: bulkClientName.trim(), count, ...(Number(bulkStartNumber) > 0 ? { startNumber: Number(bulkStartNumber) } : {}) };
      const { data } = await apiClient.post('/batteries/generate-bulk', payload);
      setBulkClientName('');
      setBulkCount('100');
      setBulkStartNumber('');
      setBulkResult(data);
      refetchList();
    } catch (err) {
      setBulkError(err.response?.data?.message || err.message);
    } finally {
      setBulkSubmitting(false);
    }
  }

  function handleBulkReset() {
    setBulkClientName('');
    setBulkCount('100');
    setBulkStartNumber('');
    setBulkResult(null);
    setBulkError(null);
  }

  function bulkResultCodes() {
    if (!bulkResult?.firstCode) return [];
    const [p1, n1] = bulkResult.firstCode.split(/-(?=\d+$)/);
    const [, n2] = (bulkResult.lastCode || bulkResult.firstCode).split(/-(?=\d+$)/);
    return codesInRange(p1, Number(n1), Number(n2));
  }

  async function printResult(kind) {
    setResultPrinting(kind);
    try {
      const codes = bulkResultCodes();
      await (kind === 'share' ? shareQrSheet : printQrSheet)(codes, DEFAULT_COLUMNS);
    } catch (err) {
      Alert.alert('QR sheet', err.message || 'Could not build the QR sheet.');
    } finally {
      setResultPrinting(null);
    }
  }

  // ── print sheet: generated QR codes by position, oldest first ──
  async function fetchBatteriesRange(startPosition, count) {
    const batteries = [];
    let offset = startPosition - 1;
    while (batteries.length < count) {
      const { data } = await apiClient.get('/batteries', { params: { qrGenerated: true, limit: Math.min(100, count - batteries.length), offset } });
      const page = data.data || [];
      batteries.push(...page);
      offset += page.length;
      if (!data.hasMore || page.length === 0) break;
    }
    return batteries;
  }

  async function runSheet(kind) {
    const startPosition = Math.max(Number(sheetStart) || 1, 1);
    const count = Math.max(Number(sheetCount) || SHEET_SIZE, 1);
    const columns = Math.max(Number(sheetColumns) || DEFAULT_COLUMNS, 1);
    setSheetError(null);
    setSheetLoading(kind);
    try {
      const batteries = await fetchBatteriesRange(startPosition, count);
      if (batteries.length === 0) { setSheetError(`No generated QR codes found starting from position ${startPosition}.`); return; }
      const codes = batteries.map((b) => b.battery_code);
      await (kind === 'download' ? shareQrSheet : printQrSheet)(codes, columns);
    } catch (err) {
      setSheetError(err.response?.data?.message || err.message);
    } finally {
      setSheetLoading(null);
    }
  }

  // ── row actions ──
  async function toggleBlock(row) {
    setBusyRow(row.id);
    try {
      await apiClient.patch(`/batteries/${row.id}/block`, { blocked: !row.is_blocked });
      refetchList();
    } catch (err) {
      Alert.alert('Action Failed', err.response?.data?.message || err.message);
    } finally {
      setBusyRow(null);
    }
  }

  function confirmDelete(row) {
    Alert.alert('Delete Battery', `Delete battery "${row.battery_code}"? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.delete(`/batteries/${row.id}`);
            refetchList();
          } catch (err) {
            Alert.alert('Action Failed', err.response?.data?.message || err.message);
          }
        },
      },
    ]);
  }

  async function downloadRow(row) {
    setBusyRow(row.id);
    try {
      await shareSingleQr(row.battery_code);
    } catch (err) {
      Alert.alert('QR code', err.message || 'Could not build the QR file.');
    } finally {
      setBusyRow(null);
    }
  }

  const columnsNum = Math.max(Number(sheetColumns) || DEFAULT_COLUMNS, 1);

  const header = (
    <View className="gap-4 pb-3">
      <View>
        <Text className="text-2xl font-bold text-green-600">Generate QR Code</Text>
        <Text className="text-xs text-slate-500">Create QR codes for batteries — scan one to open its full history.</Text>
        <View className="mt-2 flex-row items-center gap-2 self-start rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5">
          <View className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <Text className="text-xs font-semibold text-emerald-800">
            Total Generated QR Codes: <Text className="font-bold text-emerald-950">{listTotal.toLocaleString()}</Text>
          </Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('RfidAssignment')} className="mt-2 self-start">
          <Text className="text-xs font-bold text-violet-700">RFID Assignment →</Text>
        </TouchableOpacity>
      </View>

      <View className="flex-row gap-1 rounded-2xl border border-slate-200 bg-white p-1">
        {[['individual', 'Individual QR Code'], ['bulk', 'Bulk Generation']].map(([id, label]) => (
          <TouchableOpacity
            key={id}
            onPress={() => { setTab(id); if (id === 'individual') { setError(null); setQrResult(null); } else { setBulkError(null); setBulkResult(null); } }}
            className={`flex-1 items-center rounded-xl py-2.5 ${tab === id ? 'bg-violet-600' : ''}`}
          >
            <Text className={`text-xs font-bold ${tab === id ? 'text-white' : 'text-slate-500'}`}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'individual' ? (
        <>
          <View className="gap-4 rounded-2xl border border-slate-200 bg-white p-4">
            <View>
              <Label hint="(optional — can be added later)">Battery Number</Label>
              <TextInput value={serialNumber} onChangeText={setSerialNumber} placeholder="e.g. SN-88213 — the number printed on the battery" placeholderTextColor="#94a3b8" autoCorrect={false} className={input} />
              <Text className="mt-1 text-[11px] text-slate-400">The manufacturer's serial number physically printed on the battery. Leave blank if unknown — Admin or Client can add it later.</Text>
            </View>
            <View>
              <Label>Client <Text className="text-red-500">*</Text></Label>
              <ClientPicker clients={clients} value={clientName} onChange={setClientName} />
              <Text className="mt-1 text-[11px] text-slate-400">Select the client/company that owns this battery.</Text>
            </View>
            <View>
              <Label>Battery ID</Label>
              <Text className={`${input} font-mono opacity-75`}>{computedBatteryId || 'Select a client to auto-generate'}</Text>
              <Text className="mt-1 text-[11px] text-slate-400">Automatically generated from the client name. The QR code encodes a link to this ID.</Text>
            </View>
            {error ? <Text className="text-xs font-semibold text-red-600">{error}</Text> : null}
            <View className="flex-row justify-end gap-2">
              <TouchableOpacity onPress={handleReset} className="rounded-xl border border-slate-200 px-4 py-2.5">
                <Text className="text-sm font-medium text-slate-600">Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSubmit} disabled={submitting || !clientName.trim()} className={`rounded-xl bg-violet-600 px-4 py-2.5 ${submitting || !clientName.trim() ? 'opacity-50' : ''}`}>
                <Text className="text-sm font-bold text-white">{submitting ? 'Generating…' : 'Generate QR Code'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View className="items-center rounded-2xl border border-dashed border-slate-300 bg-white p-4">
            {qrResult ? (
              <>
                <QrImage code={qrResult.batteryCode} size={180} />
                <Text className="mt-2 font-mono text-base font-bold text-slate-900">{qrResult.batteryCode}</Text>
                {qrResult.clientName ? <Text className="text-xs text-slate-500">Client: {qrResult.clientName}</Text> : null}
                <Text className="mt-1 text-center text-[11px] text-slate-400" selectable>{qrContentFor(qrResult.batteryCode)}</Text>
                <TouchableOpacity onPress={() => shareSingleQr(qrResult.batteryCode).catch((e) => Alert.alert('QR code', e.message))} className="mt-3 rounded-xl bg-violet-600 px-4 py-2.5">
                  <Text className="text-sm font-bold text-white">Download (PDF)</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text className="py-6 text-center text-xs text-slate-400">Select a client and generate its QR code to preview it here.</Text>
            )}
          </View>
        </>
      ) : (
        <>
          <View className="gap-4 rounded-2xl border border-slate-200 bg-white p-4">
            <View>
              <Label>Client <Text className="text-red-500">*</Text></Label>
              <ClientPicker clients={clients} value={bulkClientName} onChange={setBulkClientName} />
            </View>
            <View>
              <Label hint={hasBulkClient ? `(next for ${bulkClientName}: ${bulkSuggestedStart})` : '(Select a client first)'}>Starting Number</Label>
              <TextInput
                value={bulkStartNumber}
                onChangeText={setBulkStartNumber}
                editable={hasBulkClient}
                keyboardType="number-pad"
                placeholder={hasBulkClient ? String(bulkSuggestedStart) : 'Select a client first'}
                placeholderTextColor="#94a3b8"
                className={`${input} ${hasBulkClient ? '' : 'opacity-50'}`}
              />
              <Text className="mt-1 text-[11px] text-slate-400">Leave blank to auto-continue from the last generated number for this client.</Text>
            </View>
            <View>
              <Label hint={hasBulkClient ? undefined : '(Select a client first)'}>How many QR Codes</Label>
              <View className="mb-2 flex-row flex-wrap gap-1.5">
                {BULK_PRESETS.map((p) => {
                  const active = hasBulkClient && bulkCount === String(p);
                  return (
                    <TouchableOpacity key={p} disabled={!hasBulkClient} onPress={() => setBulkCount(String(p))} className={`rounded-md border px-2.5 py-1 ${active ? 'border-violet-500 bg-violet-100' : 'border-slate-200 bg-white'} ${hasBulkClient ? '' : 'opacity-40'}`}>
                      <Text className={`text-xs font-medium ${active ? 'text-violet-700' : 'text-slate-600'}`}>{p >= 1000 ? `${p / 1000}k` : p}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TextInput
                value={bulkCount}
                onChangeText={setBulkCount}
                editable={hasBulkClient}
                keyboardType="number-pad"
                placeholder={hasBulkClient ? 'e.g. 500' : 'Select a client first'}
                placeholderTextColor="#94a3b8"
                className={`${input} ${hasBulkClient ? '' : 'opacity-50'}`}
              />
              <Text className="mt-1 text-[11px] text-slate-400">
                {hasBulkClient ? 'Maximum 50,000 per batch. Battery Numbers can be assigned later by Admin or Client.' : 'Select a client above before choosing how many QR codes to generate.'}
              </Text>
            </View>
            {bulkError ? <Text className="text-xs font-semibold text-red-600">{bulkError}</Text> : null}
            <View className="flex-row justify-end gap-2">
              <TouchableOpacity onPress={handleBulkReset} className="rounded-xl border border-slate-200 px-4 py-2.5">
                <Text className="text-sm font-medium text-slate-600">Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleBulkSubmit} disabled={bulkSubmitting || !hasBulkClient} className={`rounded-xl bg-violet-600 px-4 py-2.5 ${bulkSubmitting || !hasBulkClient ? 'opacity-50' : ''}`}>
                <Text className="text-sm font-bold text-white">{bulkSubmitting ? 'Generating…' : 'Generate Bulk QR Codes'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4">
            {bulkResult ? (
              <View className="items-center">
                <Icon name="checkCircle" color="#059669" size={30} />
                <Text className="mt-2 text-base font-bold text-slate-900">{Number(bulkResult.count || 0).toLocaleString()} QR Codes Generated!</Text>
                <Text className="text-xs text-slate-500">Client: <Text className="font-semibold text-slate-800">{bulkResult.clientName}</Text></Text>
                <View className="mt-3 w-full flex-row gap-2">
                  <View className="flex-1 rounded-xl bg-white p-2.5">
                    <Text className="text-[10px] font-bold uppercase text-slate-400">First ID</Text>
                    <Text className="font-mono text-xs font-bold text-slate-900">{bulkResult.firstCode}</Text>
                  </View>
                  <View className="flex-1 rounded-xl bg-white p-2.5">
                    <Text className="text-[10px] font-bold uppercase text-slate-400">Last ID</Text>
                    <Text className="font-mono text-xs font-bold text-slate-900">{bulkResult.lastCode}</Text>
                  </View>
                </View>
                <View className="mt-3 w-full flex-row gap-2">
                  <TouchableOpacity disabled={Boolean(resultPrinting)} onPress={() => printResult('print')} className="flex-1 items-center rounded-xl bg-emerald-600 py-2.5">
                    <Text className="text-xs font-bold text-white">{resultPrinting === 'print' ? 'Building…' : 'Print QR sheet'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity disabled={Boolean(resultPrinting)} onPress={() => printResult('share')} className="flex-1 items-center rounded-xl border border-emerald-300 bg-white py-2.5">
                    <Text className="text-xs font-bold text-emerald-700">{resultPrinting === 'share' ? 'Building…' : 'Download Sheet (PDF)'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                <Text className="mb-2 text-sm font-semibold text-slate-600">Range Preview</Text>
                {[
                  ['Client', bulkClientName || 'Not selected'],
                  ['Count', hasBulkClient && Number(bulkCount) > 0 ? Number(bulkCount).toLocaleString() : '—'],
                  ['First ID', hasBulkClient ? bulkFirstPreview : '—'],
                  ['Last ID', hasBulkClient ? bulkLastPreview : '—'],
                ].map(([k, v]) => (
                  <View key={k} className="flex-row justify-between border-b border-violet-100 py-1.5">
                    <Text className="text-xs text-slate-500">{k}</Text>
                    <Text className="font-mono text-xs font-bold text-slate-900">{v}</Text>
                  </View>
                ))}
                <Text className="mt-2 text-[11px] text-slate-500">
                  {hasBulkClient
                    ? `All ${Number(bulkCount) > 0 ? Number(bulkCount).toLocaleString() : '…'} batteries will be created instantly. Battery Numbers (physical serials) are optional — Admin or Client can fill them in after printing.`
                    : 'Select a client above to configure quantity and preview the generated ID range.'}
                </Text>
              </>
            )}
          </View>
        </>
      )}

      {/* Generated QR Codes */}
      <View className="gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-bold uppercase tracking-wide text-slate-500">Generated QR Codes</Text>
          <Text className="text-xs text-slate-500">Total: <Text className="font-bold text-slate-900">{listTotal.toLocaleString()}</Text></Text>
        </View>
        <View className="flex-row items-center gap-2 rounded-xl border border-slate-300 px-3">
          <Icon name="search" color="#94a3b8" size={14} />
          <TextInput value={listSearchInput} onChangeText={setListSearchInput} placeholder="Search by Battery ID or Client Name" placeholderTextColor="#94a3b8" autoCorrect={false} className="flex-1 py-2 text-sm text-slate-900" />
          {listSearchInput ? (
            <TouchableOpacity onPress={() => { setListSearchInput(''); setListSearch(''); }} hitSlop={8}>
              <Icon name="x" color="#64748b" size={14} />
            </TouchableOpacity>
          ) : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5">
          {[{ id: 'all', name: '' }, ...clients].map((c) => {
            const active = listClientFilter === c.name;
            return (
              <TouchableOpacity key={String(c.id)} onPress={() => setListClientFilter(c.name)} className={`rounded-xl border px-3 py-1.5 ${active ? 'border-blue-600 bg-blue-600' : 'border-slate-200 bg-white'}`}>
                <Text className={`text-[11px] font-bold ${active ? 'text-white' : 'text-slate-600'}`}>{c.name || 'All Clients'}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {isSuperAdmin && (
          <TouchableOpacity onPress={() => setShowBlocked((v) => !v)} className="flex-row items-center gap-2 self-start">
            <View className={`h-5 w-5 items-center justify-center rounded border-2 ${showBlocked ? 'border-violet-600 bg-violet-600' : 'border-slate-300'}`}>
              {showBlocked ? <Text className="text-[10px] font-black text-white">✓</Text> : null}
            </View>
            <Text className="text-xs font-semibold text-slate-700">Show blocked</Text>
          </TouchableOpacity>
        )}

        <View className="gap-2 rounded-xl border border-violet-200 bg-violet-50/40 p-3">
          <View className="flex-row gap-2">
            {[['Print QR Sheet — start from #', sheetStart, setSheetStart], ['How many', sheetCount, setSheetCount], ['Per row', sheetColumns, setSheetColumns]].map(([label, v, set]) => (
              <View key={label} className="flex-1">
                <Text className="mb-1 text-[11px] font-medium text-slate-700" numberOfLines={2}>{label}</Text>
                <TextInput value={v} onChangeText={set} keyboardType="number-pad" className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900" />
              </View>
            ))}
          </View>
          <Text className="text-[11px] text-slate-500">
            One A4 sheet = {columnsNum * ROWS} QR codes ({columnsNum} across × {ROWS} down), oldest-generated first, each labeled with its Battery ID. Asking for more spills onto extra sheets in the same PDF.
          </Text>
          <View className="flex-row gap-2">
            <TouchableOpacity disabled={Boolean(sheetLoading)} onPress={() => runSheet('view')} className={`flex-1 items-center rounded-xl border border-violet-300 bg-white py-2.5 ${sheetLoading ? 'opacity-60' : ''}`}>
              <Text className="text-xs font-bold text-violet-700">{sheetLoading === 'view' ? 'Building sheet…' : 'View Sheet'}</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={Boolean(sheetLoading)} onPress={() => runSheet('download')} className={`flex-1 items-center rounded-xl bg-violet-600 py-2.5 ${sheetLoading ? 'opacity-60' : ''}`}>
              <Text className="text-xs font-bold text-white">{sheetLoading === 'download' ? 'Building sheet…' : 'Download Sheet (PDF)'}</Text>
            </TouchableOpacity>
          </View>
          {sheetError ? <Text className="text-xs font-semibold text-red-600">{sheetError}</Text> : null}
        </View>

        {listError ? <Text className="text-xs font-semibold text-red-600">{listError}</Text> : null}
        <Text className="text-xs font-semibold text-slate-500">
          Showing <Text className="font-bold text-slate-800">{rows.length}</Text> of <Text className="font-bold text-slate-800">{listTotal.toLocaleString()}</Text>{' '}
          {listTotal === 1 ? 'battery QR code' : 'battery QR codes'}{listSearch || listClientFilter ? ' (filtered)' : ''}
        </Text>
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-slate-50">
      <FlatList
        data={rows}
        keyExtractor={(r) => String(r.id)}
        contentContainerClassName="p-4 gap-2 pb-16"
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetchList} />}
        onEndReached={() => { if (listHasMore && !listLoading) { setListLoading(true); fetchList(rows.length, false); } }}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={<Text className="py-6 text-center text-xs text-slate-400">{listLoading ? 'Loading…' : 'No QR codes generated yet.'}</Text>}
        ListFooterComponent={listHasMore ? <Text className="py-3 text-center text-xs text-slate-400">Loading more…</Text> : null}
        renderItem={({ item: r, index }) => {
          const clientLocked = r.serial_number_added_by_role === 'client' && r.serial_number;
          return (
            <View className={`rounded-2xl border bg-white p-3.5 ${r.is_blocked ? 'border-red-200' : 'border-slate-200'}`}>
              <View className="flex-row items-center justify-between gap-2">
                <TouchableOpacity onPress={() => navigation.navigate('BatteryDetail', { code: r.battery_code, fromScan: false })} className="flex-1 flex-row items-center gap-2">
                  <Text className="text-[11px] font-semibold text-slate-400">{index + 1}.</Text>
                  <Text className="text-sm font-extrabold text-blue-700">{r.battery_code}</Text>
                  {r.is_blocked ? <Text className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">Blocked</Text> : null}
                </TouchableOpacity>
                <Text className="text-[11px] text-slate-400">{r.qr_generated_at ? new Date(r.qr_generated_at).toLocaleString() : ''}</Text>
              </View>
              <Text className="mt-1 text-xs text-slate-600">Client: <Text className="font-semibold text-slate-800">{r.client_name || '—'}</Text></Text>
              <View className="mt-1.5 flex-row flex-wrap items-center gap-2">
                <Text className="text-[10px] font-bold uppercase text-slate-400">Battery Number</Text>
                {!r.serial_number ? (
                  <TouchableOpacity onPress={() => setSerialTarget(r)} className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1">
                    <Text className="text-[11px] font-bold text-blue-700">+ Add Number</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <Text className="text-xs font-semibold text-slate-800">{r.serial_number}</Text>
                    {clientLocked ? (
                      <Text className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">🔒 Set by Client</Text>
                    ) : r.serial_number_added_by_role ? (
                      <Text className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">Set by {r.serial_number_added_by_role}</Text>
                    ) : null}
                    {(!clientLocked || isAdmin) && (
                      <TouchableOpacity onPress={() => setSerialTarget(r)} hitSlop={6}>
                        <Text className="text-[11px] font-bold text-blue-600">Edit</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
              <View className="mt-2.5 flex-row flex-wrap gap-2 border-t border-slate-100 pt-2.5">
                <TouchableOpacity onPress={() => setViewingQr(r)} className="flex-row items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5">
                  <Icon name="eye" color="#334155" size={13} />
                  <Text className="text-[11px] font-bold text-slate-700">View QR</Text>
                </TouchableOpacity>
                <TouchableOpacity disabled={busyRow === r.id} onPress={() => downloadRow(r)} className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5">
                  <Text className="text-[11px] font-bold text-violet-700">{busyRow === r.id ? '…' : 'Download'}</Text>
                </TouchableOpacity>
                {isSuperAdmin && (
                  <>
                    <TouchableOpacity disabled={busyRow === r.id} onPress={() => toggleBlock(r)} className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5">
                      <Text className="text-[11px] font-bold text-amber-800">{r.is_blocked ? 'Unblock' : 'Block'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => confirmDelete(r)} className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5">
                      <Text className="text-[11px] font-bold text-red-700">Delete</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          );
        }}
      />
      <QrCodeModal battery={viewingQr} onClose={() => setViewingQr(null)} />
      <SerialNumberModal battery={serialTarget} onClose={() => setSerialTarget(null)} onSaved={() => { setSerialTarget(null); refetchList(); }} />
    </View>
  );
}
