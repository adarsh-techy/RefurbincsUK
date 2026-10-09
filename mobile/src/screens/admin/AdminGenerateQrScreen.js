import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import apiClient from '../../services/api-client';
import Icon from '../../components/ui/Icon';

// Bulk QR / battery ID generation for office roles — the mobile version of
// the web Generate QR Code page's "Bulk" tab: pick a client, a count and an
// optional starting number, POST /batteries/generate-bulk. Printing the QR
// sheet stays on the web (it needs a printer anyway).

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

  async function generate() {
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
      <View className="rounded-3xl border border-slate-200 bg-white p-4">
        <Text className="text-base font-extrabold text-slate-900">Bulk generate battery IDs</Text>
        <Text className="mt-0.5 text-xs text-slate-500">
          Creates the battery records and their QR codes. Print the QR sheet from the web admin.
        </Text>
      </View>

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

      <View className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
        <Text className="text-[10px] font-bold uppercase tracking-wide text-violet-700">Preview</Text>
        <Text className="mt-1 text-sm font-black text-violet-900">{preview}</Text>
        <Text className="mt-0.5 text-[11px] text-violet-700">{client ? `${n.toLocaleString()} batteries for ${client.name}` : 'Pick a client to see the ID range'}</Text>
      </View>

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
        </View>
      )}
    </ScrollView>
  );
}
