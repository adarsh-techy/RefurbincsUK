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
    <View className="gap-1.5">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5 py-0.5">
        {clients.map((c) => {
          const active = value === c.name;
          return (
            <TouchableOpacity
              key={c.id}
              onPress={() => onChange(active ? '' : c.name)}
              className={`rounded-lg border px-2.5 py-1.5 ${active ? 'border-violet-600 bg-violet-600' : 'border-slate-200 bg-slate-50'}`}
            >
              <Text className={`text-xs ${active ? 'font-bold text-white' : 'font-medium text-slate-700'}`}>{c.name}</Text>
            </TouchableOpacity>
          );
        })}
        {clients.length === 0 && <Text className="text-xs text-slate-400">Loading clients…</Text>}
      </ScrollView>
      {value ? (
        <View className="flex-row items-center gap-1.5 self-start">
          <Text className="text-[11px] text-slate-500">Selected:</Text>
          <Text className="text-[11px] font-bold text-violet-700">{value}</Text>
          <TouchableOpacity onPress={() => onChange('')} hitSlop={6}>
            <Text className="text-[11px] font-bold text-slate-400">✕ Clear</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

function Label({ children, hint }) {
  return (
    <Text className="mb-1 text-xs font-semibold text-slate-700">
      {children}
      {hint ? <Text className="text-[10px] font-normal text-slate-400"> {hint}</Text> : null}
    </Text>
  );
}

const input = 'rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-900';

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
    <View className="gap-3 pb-2">
      {/* Executive Header */}
      <View className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1">
            <View className="flex-row items-center gap-1.5 flex-wrap">
              <Text className="text-lg font-extrabold text-slate-900">Generate QR Code</Text>
              <View className="rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5">
                <Text className="text-[10px] font-bold text-violet-700">Asset Identifiers</Text>
              </View>
            </View>
            <Text className="mt-0.5 text-xs text-slate-500">Create & manage trackable battery QR identities</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('RfidAssignment')}
            className="flex-row items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5"
          >
            <Icon name="rfid" color="#6d28d9" size={13} />
            <Text className="text-xs font-bold text-violet-700">RFID →</Text>
          </TouchableOpacity>
        </View>

        <View className="mt-2.5 flex-row items-center justify-between border-t border-slate-100 pt-2.5">
          <View className="flex-row items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1">
            <View className="h-2 w-2 rounded-full bg-emerald-500" />
            <Text className="text-[11px] font-semibold text-emerald-800">
              Total Generated: <Text className="font-extrabold text-emerald-950">{listTotal.toLocaleString()}</Text>
            </Text>
          </View>
          <Text className="text-[10px] text-slate-400">Scan QR to open lifecycle</Text>
        </View>
      </View>

      {/* Segmented Pill Navigation */}
      <View className="flex-row rounded-xl border border-slate-200 bg-slate-100/90 p-1">
        {[['individual', 'Individual QR Code'], ['bulk', 'Bulk Generation']].map(([id, label]) => {
          const active = tab === id;
          return (
            <TouchableOpacity
              key={id}
              onPress={() => {
                setTab(id);
                if (id === 'individual') { setError(null); setQrResult(null); }
                else { setBulkError(null); setBulkResult(null); }
              }}
              className={`flex-1 items-center rounded-lg py-2 ${active ? 'bg-white shadow-2xs' : ''}`}
            >
              <Text className={`text-xs ${active ? 'font-bold text-violet-700' : 'font-semibold text-slate-500'}`}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {tab === 'individual' ? (
        <>
          <View className="gap-3 rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
            <View>
              <Label hint="(optional — physical serial)">Battery Number</Label>
              <TextInput
                value={serialNumber}
                onChangeText={setSerialNumber}
                placeholder="e.g. SN-88213"
                placeholderTextColor="#94a3b8"
                autoCorrect={false}
                className={input}
              />
              <Text className="mt-1 text-[10.5px] text-slate-400">Physical number printed on battery. Leave blank if unknown — can add later.</Text>
            </View>

            <View>
              <Label>Client <Text className="text-red-500">*</Text></Label>
              <ClientPicker clients={clients} value={clientName} onChange={setClientName} />
            </View>

            <View>
              <Label>Battery ID Preview</Label>
              <View className="flex-row items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <Text className="font-mono text-xs font-bold text-slate-900">{computedBatteryId || 'Select a client to auto-generate'}</Text>
                {computedBatteryId ? (
                  <View className="rounded bg-violet-100 px-1.5 py-0.5">
                    <Text className="text-[10px] font-bold text-violet-700">Auto</Text>
                  </View>
                ) : null}
              </View>
              <Text className="mt-1 text-[10.5px] text-slate-400">Prefix + next sequence number for this client.</Text>
            </View>

            {error ? <Text className="text-xs font-semibold text-red-600">{error}</Text> : null}

            <View className="flex-row justify-end gap-2 pt-1 border-t border-slate-100">
              <TouchableOpacity onPress={handleReset} className="rounded-lg border border-slate-200 bg-white px-3.5 py-2">
                <Text className="text-xs font-medium text-slate-600">Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={submitting || !clientName.trim()}
                className={`rounded-lg bg-violet-700 px-4 py-2 ${submitting || !clientName.trim() ? 'opacity-50' : 'shadow-xs'}`}
              >
                <Text className="text-xs font-bold text-white">{submitting ? 'Generating…' : 'Generate QR Code'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* QR Result / Placeholder Preview */}
          <View className="items-center rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs">
            {qrResult ? (
              <View className="items-center w-full">
                <View className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
                  <QrImage code={qrResult.batteryCode} size={150} />
                </View>
                <Text className="mt-2.5 font-mono text-sm font-extrabold text-slate-900">{qrResult.batteryCode}</Text>
                {qrResult.clientName ? <Text className="text-xs text-slate-500">Client: <Text className="font-semibold text-slate-700">{qrResult.clientName}</Text></Text> : null}
                <Text className="mt-1 max-w-[90%] text-center text-[10.5px] text-slate-400" numberOfLines={2} selectable>{qrContentFor(qrResult.batteryCode)}</Text>
                <TouchableOpacity
                  onPress={() => shareSingleQr(qrResult.batteryCode).catch((e) => Alert.alert('QR code', e.message))}
                  className="mt-3 flex-row items-center gap-1.5 rounded-lg bg-violet-700 px-4 py-2 shadow-xs"
                >
                  <Icon name="download" color="#ffffff" size={13} />
                  <Text className="text-xs font-bold text-white">Download PDF</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View className="py-4 items-center">
                <Icon name="battery" color="#cbd5e1" size={26} />
                <Text className="mt-2 text-center text-xs font-medium text-slate-400">Select a client and click Generate to preview QR code here.</Text>
              </View>
            )}
          </View>
        </>
      ) : (
        <>
          <View className="gap-3 rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
            <View>
              <Label>Client <Text className="text-red-500">*</Text></Label>
              <ClientPicker clients={clients} value={bulkClientName} onChange={setBulkClientName} />
            </View>

            <View className="flex-row gap-2">
              <View className="flex-1">
                <Label hint={hasBulkClient ? `(next: ${bulkSuggestedStart})` : ''}>Start #</Label>
                <TextInput
                  value={bulkStartNumber}
                  onChangeText={setBulkStartNumber}
                  editable={hasBulkClient}
                  keyboardType="number-pad"
                  placeholder={hasBulkClient ? String(bulkSuggestedStart) : 'Select client'}
                  placeholderTextColor="#94a3b8"
                  className={`${input} ${hasBulkClient ? '' : 'opacity-50'}`}
                />
              </View>

              <View className="flex-1">
                <Label>Quantity</Label>
                <TextInput
                  value={bulkCount}
                  onChangeText={setBulkCount}
                  editable={hasBulkClient}
                  keyboardType="number-pad"
                  placeholder={hasBulkClient ? 'e.g. 100' : 'Select client'}
                  placeholderTextColor="#94a3b8"
                  className={`${input} ${hasBulkClient ? '' : 'opacity-50'}`}
                />
              </View>
            </View>

            {/* Quick Presets */}
            <View>
              <Text className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Quick Presets</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1 py-0.5">
                {BULK_PRESETS.map((p) => {
                  const active = hasBulkClient && bulkCount === String(p);
                  return (
                    <TouchableOpacity
                      key={p}
                      disabled={!hasBulkClient}
                      onPress={() => setBulkCount(String(p))}
                      className={`rounded-lg border px-2.5 py-1 ${active ? 'border-violet-600 bg-violet-600' : 'border-slate-200 bg-slate-50'} ${hasBulkClient ? '' : 'opacity-40'}`}
                    >
                      <Text className={`text-xs ${active ? 'font-bold text-white' : 'font-medium text-slate-600'}`}>
                        {p >= 1000 ? `${p / 1000}k` : p}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {bulkError ? <Text className="text-xs font-semibold text-red-600">{bulkError}</Text> : null}

            <View className="flex-row justify-end gap-2 pt-1 border-t border-slate-100">
              <TouchableOpacity onPress={handleBulkReset} className="rounded-lg border border-slate-200 bg-white px-3.5 py-2">
                <Text className="text-xs font-medium text-slate-600">Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleBulkSubmit}
                disabled={bulkSubmitting || !hasBulkClient}
                className={`rounded-lg bg-violet-700 px-4 py-2 ${bulkSubmitting || !hasBulkClient ? 'opacity-50' : 'shadow-xs'}`}
              >
                <Text className="text-xs font-bold text-white">{bulkSubmitting ? 'Generating…' : 'Generate Bulk'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Bulk Result / Range Preview */}
          <View className="rounded-2xl border border-violet-200/90 bg-violet-50/50 p-3.5 shadow-2xs">
            {bulkResult ? (
              <View className="items-center">
                <Icon name="checkCircle" color="#059669" size={26} />
                <Text className="mt-1.5 text-sm font-extrabold text-slate-900">{Number(bulkResult.count || 0).toLocaleString()} QR Codes Generated!</Text>
                <Text className="text-xs text-slate-500">Client: <Text className="font-semibold text-slate-800">{bulkResult.clientName}</Text></Text>
                <View className="mt-2.5 w-full flex-row gap-2">
                  <View className="flex-1 rounded-xl border border-slate-200/80 bg-white p-2">
                    <Text className="text-[10px] font-bold uppercase text-slate-400">First ID</Text>
                    <Text className="font-mono text-xs font-bold text-slate-900">{bulkResult.firstCode}</Text>
                  </View>
                  <View className="flex-1 rounded-xl border border-slate-200/80 bg-white p-2">
                    <Text className="text-[10px] font-bold uppercase text-slate-400">Last ID</Text>
                    <Text className="font-mono text-xs font-bold text-slate-900">{bulkResult.lastCode}</Text>
                  </View>
                </View>
                <View className="mt-2.5 w-full flex-row gap-2">
                  <TouchableOpacity disabled={Boolean(resultPrinting)} onPress={() => printResult('print')} className="flex-1 items-center rounded-lg bg-emerald-600 py-2">
                    <Text className="text-xs font-bold text-white">{resultPrinting === 'print' ? 'Building…' : 'Print Sheet'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity disabled={Boolean(resultPrinting)} onPress={() => printResult('share')} className="flex-1 items-center rounded-lg border border-emerald-300 bg-white py-2">
                    <Text className="text-xs font-bold text-emerald-700">{resultPrinting === 'share' ? 'Building…' : 'Download PDF'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-xs font-bold uppercase tracking-wider text-slate-700">Range Preview</Text>
                  <View className="rounded bg-violet-100 px-1.5 py-0.5">
                    <Text className="text-[10px] font-bold text-violet-700">Live</Text>
                  </View>
                </View>
                {[
                  ['Client', bulkClientName || 'Not selected'],
                  ['Quantity', hasBulkClient && Number(bulkCount) > 0 ? Number(bulkCount).toLocaleString() : '—'],
                  ['First ID', hasBulkClient ? bulkFirstPreview : '—'],
                  ['Last ID', hasBulkClient ? bulkLastPreview : '—'],
                ].map(([k, v]) => (
                  <View key={k} className="flex-row justify-between border-b border-violet-100/80 py-1">
                    <Text className="text-xs text-slate-500">{k}</Text>
                    <Text className="font-mono text-xs font-bold text-slate-900">{v}</Text>
                  </View>
                ))}
                <Text className="mt-1.5 text-[10.5px] text-slate-500">
                  {hasBulkClient
                    ? `All ${Number(bulkCount) > 0 ? Number(bulkCount).toLocaleString() : '…'} batteries will be created instantly. Physical serials can be assigned later.`
                    : 'Select a client above to preview the generated ID range.'}
                </Text>
              </>
            )}
          </View>
        </>
      )}

      {/* Generated QR Codes List Header & Print Sheet Card */}
      <View className="gap-2.5 rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
        <View className="flex-row items-center justify-between">
          <Text className="text-xs font-extrabold uppercase tracking-wider text-slate-700">Generated QR Codes</Text>
          <Text className="text-xs font-semibold text-slate-500">Total: <Text className="font-extrabold text-slate-900">{listTotal.toLocaleString()}</Text></Text>
        </View>

        {/* Compact Search */}
        <View className="flex-row items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 py-1.5">
          <Icon name="search" color="#94a3b8" size={13} />
          <TextInput
            value={listSearchInput}
            onChangeText={setListSearchInput}
            placeholder="Search Battery ID or Client"
            placeholderTextColor="#94a3b8"
            autoCorrect={false}
            className="min-w-0 flex-1 py-0.5 text-xs text-slate-900"
          />
          {listSearchInput ? (
            <TouchableOpacity onPress={() => { setListSearchInput(''); setListSearch(''); }} hitSlop={8}>
              <Icon name="x" color="#64748b" size={13} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Horizontal Client Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1 py-0.5">
          {[{ id: 'all', name: '' }, ...clients].map((c) => {
            const active = listClientFilter === c.name;
            return (
              <TouchableOpacity
                key={String(c.id)}
                onPress={() => setListClientFilter(c.name)}
                className={`rounded-lg border px-2.5 py-1 ${active ? 'border-violet-600 bg-violet-600' : 'border-slate-200 bg-slate-50'}`}
              >
                <Text className={`text-[11px] ${active ? 'font-bold text-white' : 'font-medium text-slate-600'}`}>{c.name || 'All Clients'}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {isSuperAdmin && (
          <TouchableOpacity onPress={() => setShowBlocked((v) => !v)} className="flex-row items-center gap-2 self-start py-0.5">
            <View className={`h-4 w-4 items-center justify-center rounded border ${showBlocked ? 'border-violet-600 bg-violet-600' : 'border-slate-300 bg-white'}`}>
              {showBlocked ? <Text className="text-[9px] font-black text-white">✓</Text> : null}
            </View>
            <Text className="text-xs font-medium text-slate-700">Show blocked</Text>
          </TouchableOpacity>
        )}

        {/* Compact Print QR Sheet */}
        <View className="gap-2 rounded-xl border border-violet-100 bg-violet-50/40 p-2.5">
          <View className="flex-row items-center justify-between">
            <Text className="text-[11px] font-bold text-violet-900">Print QR Sheet (A4 PDF)</Text>
            <Text className="text-[10px] text-violet-700 font-medium">{columnsNum * ROWS} per sheet</Text>
          </View>
          <View className="flex-row gap-1.5">
            <View className="flex-1">
              <Text className="mb-0.5 text-[10px] font-medium text-slate-600">Start #</Text>
              <TextInput value={sheetStart} onChangeText={setSheetStart} keyboardType="number-pad" className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 text-center" />
            </View>
            <View className="flex-1">
              <Text className="mb-0.5 text-[10px] font-medium text-slate-600">Count</Text>
              <TextInput value={sheetCount} onChangeText={setSheetCount} keyboardType="number-pad" className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 text-center" />
            </View>
            <View className="flex-1">
              <Text className="mb-0.5 text-[10px] font-medium text-slate-600">Cols</Text>
              <TextInput value={sheetColumns} onChangeText={setSheetColumns} keyboardType="number-pad" className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 text-center" />
            </View>
          </View>
          <View className="flex-row gap-2 mt-0.5">
            <TouchableOpacity
              disabled={Boolean(sheetLoading)}
              onPress={() => runSheet('view')}
              className={`flex-1 items-center rounded-lg border border-violet-300 bg-white py-1.5 ${sheetLoading ? 'opacity-60' : ''}`}
            >
              <Text className="text-xs font-bold text-violet-700">{sheetLoading === 'view' ? 'Building…' : 'View Sheet'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={Boolean(sheetLoading)}
              onPress={() => runSheet('download')}
              className={`flex-1 items-center rounded-lg bg-violet-700 py-1.5 ${sheetLoading ? 'opacity-60' : 'shadow-2xs'}`}
            >
              <Text className="text-xs font-bold text-white">{sheetLoading === 'download' ? 'Building…' : 'Download PDF'}</Text>
            </TouchableOpacity>
          </View>
          {sheetError ? <Text className="text-xs font-semibold text-red-600">{sheetError}</Text> : null}
        </View>

        {listError ? <Text className="text-xs font-semibold text-red-600">{listError}</Text> : null}
        <Text className="text-[11px] font-medium text-slate-500">
          Showing <Text className="font-bold text-slate-800">{rows.length}</Text> of <Text className="font-bold text-slate-800">{listTotal.toLocaleString()}</Text>{' '}
          {listTotal === 1 ? 'battery' : 'batteries'}{listSearch || listClientFilter ? ' (filtered)' : ''}
        </Text>
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-slate-50">
      <FlatList
        data={rows}
        keyExtractor={(r) => String(r.id)}
        contentContainerClassName="p-3 gap-2 pb-16"
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
            <View className={`rounded-xl border bg-white p-3 shadow-2xs ${r.is_blocked ? 'border-red-200 bg-red-50/20' : 'border-slate-200/90'}`}>
              <View className="flex-row items-center justify-between gap-2">
                <TouchableOpacity onPress={() => navigation.navigate('BatteryDetail', { code: r.battery_code, fromScan: false })} className="flex-1 flex-row items-center gap-1.5">
                  <Text className="text-[10.5px] font-semibold text-slate-400">#{index + 1}</Text>
                  <Text className="font-mono text-xs font-extrabold text-violet-700">{r.battery_code}</Text>
                  {r.is_blocked ? <Text className="rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-700">Blocked</Text> : null}
                </TouchableOpacity>
                <Text className="text-[10px] text-slate-400">{r.qr_generated_at ? new Date(r.qr_generated_at).toLocaleDateString() : ''}</Text>
              </View>

              <View className="mt-1.5 flex-row items-center justify-between flex-wrap gap-1">
                <Text className="text-xs text-slate-500">Client: <Text className="font-semibold text-slate-800">{r.client_name || '—'}</Text></Text>
                
                {/* Battery Number */}
                <View className="flex-row items-center gap-1">
                  {!r.serial_number ? (
                    <TouchableOpacity onPress={() => setSerialTarget(r)} className="rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5">
                      <Text className="text-[10.5px] font-bold text-violet-700">+ Add No.</Text>
                    </TouchableOpacity>
                  ) : (
                    <View className="flex-row items-center gap-1">
                      <Text className="font-mono text-xs font-bold text-slate-900">{r.serial_number}</Text>
                      {clientLocked ? (
                        <Text className="rounded bg-amber-100 px-1 py-0.2 text-[9px] font-bold text-amber-800">🔒 Client</Text>
                      ) : null}
                      {(!clientLocked || isAdmin) && (
                        <TouchableOpacity onPress={() => setSerialTarget(r)} hitSlop={6}>
                          <Text className="text-[10.5px] font-bold text-blue-600">Edit</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              </View>

              {/* Action Buttons Row */}
              <View className="mt-2 flex-row flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2">
                <TouchableOpacity onPress={() => setViewingQr(r)} className="flex-row items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1">
                  <Icon name="eye" color="#475569" size={12} />
                  <Text className="text-xs font-semibold text-slate-700">View</Text>
                </TouchableOpacity>
                <TouchableOpacity disabled={busyRow === r.id} onPress={() => downloadRow(r)} className="flex-row items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1">
                  <Icon name="download" color="#6d28d9" size={12} />
                  <Text className="text-xs font-bold text-violet-700">{busyRow === r.id ? '…' : 'PDF'}</Text>
                </TouchableOpacity>
                {isSuperAdmin && (
                  <>
                    <TouchableOpacity disabled={busyRow === r.id} onPress={() => toggleBlock(r)} className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1">
                      <Text className="text-xs font-bold text-amber-800">{r.is_blocked ? 'Unblock' : 'Block'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => confirmDelete(r)} className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1">
                      <Text className="text-xs font-bold text-red-700">Delete</Text>
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
