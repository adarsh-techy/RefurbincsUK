import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import apiClient from '../../services/api-client';
import Icon from '../../components/ui/Icon';
import { DEFAULT_COLUMNS, MAX_SHEET_CODES, ROWS, codesInRange, printQrSheet, shareQrSheet } from '../../utils/print-qr-sheet';

// QR / battery ID generation for office roles — the mobile version of the web
// Generate QR Code page: Individual (POST /batteries/generate) or Bulk (pick a
// client, a count and an optional starting number, POST
// /batteries/generate-bulk). The QR sheet (A4, `columns` x 9, Battery ID under
// each code — same layout as the web PDF) can be printed or shared as a PDF
// right after generating, or re-printed later for any numbered range.

const BATTERY_NUMBER_DIGITS = 7;
const prefixOf = (name) => (name || '').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();
const pad = (n, len) => String(n).padStart(len, '0');

export default function AdminGenerateQrScreen() {
  const [clients, setClients] = useState([]);
  const [client, setClient] = useState(null);
  const [count, setCount] = useState('100');
  const [start, setStart] = useState('');
  const [suggestedStart, setSuggestedStart] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [mode, setMode] = useState('bulk'); // individual | bulk (same tabs as the web page)
  const [serial, setSerial] = useState('');
  // QR sheet printing
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [printing, setPrinting] = useState(null); // 'print' | 'share' | null
  const [printError, setPrintError] = useState(null);
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');

  useEffect(() => {
    apiClient.get('/clients')
      .then(({ data }) => setClients((Array.isArray(data) ? data : data?.data || []).filter((c) => c.user_role !== 'recycle_client')))
      .catch((err) => setError(err.response?.data?.message || err.message));
  }, []);

  // Next free number for the chosen client, same call the web page makes
  useEffect(() => {
    if (!client) { setSuggestedStart(1); return; }
    apiClient.get('/batteries/count-by-client', { params: { clientName: client.name } })
      .then(({ data }) => setSuggestedStart((Number(data.lastNumber) || 0) + 1))
      .catch(() => setSuggestedStart(1));
  }, [client]);

  const n = Math.max(Number(count) || 0, 0);
  const from = Number(start) > 0 ? Number(start) : suggestedStart;
  const to = from + Math.max(n, 1) - 1;
  const prefix = prefixOf(client?.name);
  const padLen = Math.max(BATTERY_NUMBER_DIGITS, String(to).length);
  const preview = useMemo(() => (prefix ? `${prefix}-${pad(from, padLen)}  →  ${prefix}-${pad(to, padLen)}` : '—'), [prefix, from, to, padLen]);

  // Battery IDs the last Generate created (bulk: firstCode → lastCode)
  function generatedCodes() {
    if (!result?.firstCode) return [];
    if (!result.lastCode || result.lastCode === result.firstCode) return [result.firstCode];
    const [p1, n1] = result.firstCode.split(/-(?=\d+$)/);
    const [, n2] = result.lastCode.split(/-(?=\d+$)/);
    return codesInRange(p1, Number(n1), Number(n2));
  }

  function rangeCodes() {
    if (!client) throw new Error('Select the client first.');
    const a = Number(rangeFrom);
    const b = Number(rangeTo || rangeFrom);
    if (!Number.isInteger(a) || a < 1 || !Number.isInteger(b) || b < a) throw new Error('Enter a valid From / To number (To must be ≥ From).');
    return codesInRange(prefix, a, b);
  }

  async function runPrint(kind, getCodes) {
    setPrintError(null);
    setPrinting(kind);
    try {
      const codes = getCodes();
      await (kind === 'share' ? shareQrSheet : printQrSheet)(codes, columns);
    } catch (err) {
      setPrintError(err.message || 'Could not build the QR sheet.');
    } finally {
      setPrinting(null);
    }
  }

  const perSheet = columns * ROWS;

  async function generateOne() {
    setError(null);
    setResult(null);
    if (!client) { setError('Select a client first.'); return; }
    setSubmitting(true);
    try {
      const code = `${prefix}-${pad(suggestedStart, BATTERY_NUMBER_DIGITS)}`;
      const { data } = await apiClient.post('/batteries/generate', { clientName: client.name, batteryCode: code, serialNumber: serial.trim() || undefined });
      setResult({ message: 'Battery created', firstCode: data.battery_code, lastCode: data.battery_code, count: 1 });
      setSerial('');
      setSuggestedStart((x) => x + 1);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function generate() {
    if (mode === 'individual') return generateOne();
    setError(null);
    setResult(null);
    if (!client) { setError('Select a client first.'); return; }
    if (!Number.isInteger(n) || n < 1 || n > 50000) { setError('Enter a count between 1 and 50,000.'); return; }
    setSubmitting(true);
    try {
      const { data } = await apiClient.post('/batteries/generate-bulk', {
        clientName: client.name,
        count: n,
        startNumber: Number(start) > 0 ? Number(start) : undefined,
      });
      setResult(data);
      setStart('');
      setSuggestedStart((s) => s + n);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView className="flex-1 bg-slate-50" contentContainerClassName="p-4 pb-16 gap-4" keyboardShouldPersistTaps="handled">
      <View className="flex-row gap-1 rounded-2xl border border-violet-200 bg-violet-50/60 p-1">
        {[['individual', 'Individual QR Code'], ['bulk', 'Bulk Generation']].map(([id, label]) => (
          <TouchableOpacity key={id} onPress={() => { setMode(id); setResult(null); setError(null); }} className={`flex-1 items-center rounded-xl py-2.5 ${mode === id ? 'bg-violet-600' : ''}`}>
            <Text className={`text-xs font-bold ${mode === id ? 'text-white' : 'text-slate-500'}`}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text className="text-xs text-slate-500">
        {mode === 'individual' ? 'Creates one battery with the next free ID for the client.' : 'Creates many batteries at once.'} Print or share the QR sheet right after, or re-print any range below.
      </Text>

      <Text className="text-[11px] font-bold uppercase tracking-wider text-slate-500">1. Client</Text>
      <View className="flex-row flex-wrap gap-2">
        {clients.map((c) => {
          const active = client?.id === c.id;
          return (
            <TouchableOpacity key={c.id} onPress={() => { setClient(c); setResult(null); }} className={`rounded-xl border px-3 py-2 ${active ? 'border-violet-600 bg-violet-600' : 'border-slate-200 bg-white'}`}>
              <Text className={`text-xs font-bold ${active ? 'text-white' : 'text-slate-700'}`}>{c.name}</Text>
            </TouchableOpacity>
          );
        })}
        {clients.length === 0 && <Text className="text-xs text-slate-400">Loading clients…</Text>}
      </View>

      {mode === 'individual' ? (
        <View>
          <Text className="text-[11px] font-bold uppercase tracking-wider text-slate-500">2. Battery number (serial, optional)</Text>
          <TextInput value={serial} onChangeText={setSerial} placeholder="Manufacturer serial" placeholderTextColor="#94a3b8" className="mt-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900" />
          <Text className="mt-2 text-xs text-slate-500">{client ? `New ID: ${prefix}-${pad(suggestedStart, BATTERY_NUMBER_DIGITS)}` : 'Pick a client to see the next ID'}</Text>
        </View>
      ) : (
        <>
      <Text className="text-[11px] font-bold uppercase tracking-wider text-slate-500">2. How many</Text>
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Text className="mb-1 text-xs font-semibold text-slate-600">Count</Text>
          <TextInput value={count} onChangeText={setCount} keyboardType="number-pad" className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base font-bold text-slate-900" />
        </View>
        <View className="flex-1">
          <Text className="mb-1 text-xs font-semibold text-slate-600">Start number (optional)</Text>
          <TextInput value={start} onChangeText={setStart} keyboardType="number-pad" placeholder={String(suggestedStart)} placeholderTextColor="#94a3b8" className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base font-bold text-slate-900" />
        </View>
      </View>

        </>
      )}

      {mode === 'bulk' && (
      <View className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
        <Text className="text-[10px] font-bold uppercase tracking-wide text-violet-700">Preview</Text>
        <Text className="mt-1 text-sm font-black text-violet-900">{preview}</Text>
        <Text className="mt-0.5 text-[11px] text-violet-700">{client ? `${n.toLocaleString()} batteries for ${client.name}` : 'Pick a client to see the ID range'}</Text>
      </View>
      )}

      {error && (
        <View className="rounded-2xl border border-red-200 bg-red-50 p-3">
          <Text className="text-xs font-semibold text-red-700">{error}</Text>
        </View>
      )}

      <TouchableOpacity disabled={submitting} onPress={generate} className={`items-center rounded-2xl bg-violet-600 py-4 ${submitting ? 'opacity-60' : ''}`}>
        <Text className="text-base font-bold text-white">{submitting ? 'Generating…' : 'Generate'}</Text>
      </TouchableOpacity>

      {result && (
        <View className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <View className="flex-row items-center gap-2">
            <Icon name="checkCircle" color="#059669" size={18} />
            <Text className="text-sm font-extrabold text-emerald-800">{result.message || 'Generated'}</Text>
          </View>
          <Text className="mt-1 text-xs text-emerald-700">{result.firstCode} → {result.lastCode} ({Number(result.count || 0).toLocaleString()} codes)</Text>
          <View className="mt-3 flex-row gap-2">
            <TouchableOpacity disabled={Boolean(printing)} onPress={() => runPrint('print', generatedCodes)} className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 ${printing ? 'opacity-60' : ''}`}>
              <Icon name="package" color="#fff" size={14} />
              <Text className="text-xs font-bold text-white">{printing === 'print' ? 'Building…' : 'Print QR sheet'}</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={Boolean(printing)} onPress={() => runPrint('share', generatedCodes)} className={`flex-1 items-center justify-center rounded-xl border border-emerald-300 bg-white py-2.5 ${printing ? 'opacity-60' : ''}`}>
              <Text className="text-xs font-bold text-emerald-700">{printing === 'share' ? 'Building…' : 'Share PDF'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Print / re-print a QR sheet ─────────────────────────────── */}
      <View className="rounded-2xl border border-slate-200 bg-white p-4">
        <Text className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Print QR sheet</Text>
        <Text className="mt-1 text-xs text-slate-500">
          {client ? `Battery IDs ${prefix}-… for ${client.name}.` : 'Pick a client above.'} One A4 sheet = {perSheet} QR codes ({columns} across × {ROWS} down), Battery ID under each. Up to {MAX_SHEET_CODES.toLocaleString()} per print.
        </Text>
        <View className="mt-3 flex-row gap-2">
          <View className="flex-1">
            <Text className="mb-1 text-xs font-semibold text-slate-600">From #</Text>
            <TextInput value={rangeFrom} onChangeText={setRangeFrom} keyboardType="number-pad" placeholder="1" placeholderTextColor="#94a3b8" className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base font-bold text-slate-900" />
          </View>
          <View className="flex-1">
            <Text className="mb-1 text-xs font-semibold text-slate-600">To #</Text>
            <TextInput value={rangeTo} onChangeText={setRangeTo} keyboardType="number-pad" placeholder={String(Math.max(suggestedStart - 1, 1))} placeholderTextColor="#94a3b8" className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base font-bold text-slate-900" />
          </View>
        </View>
        {client && Number(rangeFrom) > 0 ? (
          <Text className="mt-1.5 text-[11px] font-semibold text-violet-700">
            {(() => { try { const c = rangeCodes(); return `${c[0]} → ${c[c.length - 1]} (${c.length.toLocaleString()} codes)`; } catch (e) { return e.message; } })()}
          </Text>
        ) : null}
        <Text className="mb-1 mt-3 text-xs font-semibold text-slate-600">QR codes per row</Text>
        <View className="flex-row gap-1.5">
          {[3, 4, 5, 6].map((c) => (
            <TouchableOpacity key={c} onPress={() => setColumns(c)} className={`rounded-xl border px-3.5 py-2 ${columns === c ? 'border-violet-600 bg-violet-600' : 'border-slate-200 bg-white'}`}>
              <Text className={`text-xs font-bold ${columns === c ? 'text-white' : 'text-slate-700'}`}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {printError && <Text className="mt-2 text-xs font-semibold text-red-600">{printError}</Text>}
        <View className="mt-3 flex-row gap-2">
          <TouchableOpacity disabled={Boolean(printing)} onPress={() => runPrint('print', rangeCodes)} className={`flex-1 items-center rounded-xl bg-violet-600 py-3 ${printing ? 'opacity-60' : ''}`}>
            <Text className="text-xs font-bold text-white">{printing === 'print' ? 'Building…' : 'Print'}</Text>
          </TouchableOpacity>
          <TouchableOpacity disabled={Boolean(printing)} onPress={() => runPrint('share', rangeCodes)} className={`flex-1 items-center rounded-xl border border-violet-300 bg-white py-3 ${printing ? 'opacity-60' : ''}`}>
            <Text className="text-xs font-bold text-violet-700">{printing === 'share' ? 'Building…' : 'Share PDF'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
