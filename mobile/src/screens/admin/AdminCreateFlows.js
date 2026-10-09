import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import apiClient from '../../services/api-client';
import { StatusBadge } from '../../components/ui/Badge';
import Icon from '../../components/ui/Icon';
import { resolveBatteryInput, UNASSIGNED_TAG_MESSAGE } from '../../utils/scan-input';

// Admin create flows that were web-only: Truck Intake, Return Dispatch and
// Recycle Shipment — same endpoints and payloads as TruckIntakeForm,
// ReturnForm and RecycleForm. Every battery box takes a QR link, a battery
// code, or an RFID tag (a reader in keyboard mode types it + Enter);
// unassigned tags are refused.

function Label({ children, required }) {
  return <Text className="mb-1.5 text-xs font-bold text-slate-600">{children}{required ? <Text className="text-red-500"> *</Text> : null}</Text>;
}
function Input(props) {
  return <TextInput placeholderTextColor="#94a3b8" autoCorrect={false} {...props} className={`rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 ${props.className || ''}`} />;
}
function ClientChips({ clients, value, onChange }) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {clients.map((c) => {
        const on = String(c.id) === String(value);
        return (
          <TouchableOpacity key={c.id} onPress={() => onChange(c)} className={`rounded-xl border px-3 py-2 ${on ? 'border-violet-600 bg-violet-600' : 'border-slate-300 bg-white'}`}>
            <Text className={`text-xs font-bold ${on ? 'text-white' : 'text-slate-700'}`}>{c.name}</Text>
          </TouchableOpacity>
        );
      })}
      {clients.length === 0 && <Text className="text-xs text-slate-400">Loading…</Text>}
    </View>
  );
}
function ErrorBox({ text }) {
  if (!text) return null;
  return <View className="rounded-2xl border border-red-200 bg-red-50 p-3"><Text className="text-xs font-semibold text-red-700">{text}</Text></View>;
}
function SubmitButton({ onPress, busy, label, disabled }) {
  return (
    <TouchableOpacity disabled={busy || disabled} onPress={onPress} className={`mt-2 items-center rounded-2xl bg-emerald-600 py-4 ${busy || disabled ? 'opacity-50' : ''}`}>
      <Text className="text-base font-bold text-white">{busy ? 'Saving…' : label}</Text>
    </TouchableOpacity>
  );
}

function useClients(kind) {
  const [clients, setClients] = useState([]);
  useEffect(() => {
    apiClient.get('/clients').then(({ data }) => {
      const list = Array.isArray(data) ? data : data?.data || [];
      setClients(list.filter((c) => (kind === 'recycle' ? c.user_role === 'recycle_client' : c.user_role !== 'recycle_client')));
    }).catch(() => {});
  }, [kind]);
  return clients;
}

// Selectable list of eligible batteries + a scan box that ticks them.
function BatteryPicker({ batteries, selected, onToggle, loading, emptyText }) {
  const [scan, setScan] = useState('');
  const [msg, setMsg] = useState(null);
  function onScan() {
    const r = resolveBatteryInput(scan, batteries);
    setScan('');
    if (r.unassignedTag) { setMsg({ ok: false, text: UNASSIGNED_TAG_MESSAGE }); return; }
    if (!r.battery) { setMsg({ ok: false, text: `${r.code} is not in the list of eligible batteries.` }); return; }
    if (!selected.has(r.battery.id)) onToggle(r.battery.id);
    setMsg({ ok: true, text: `${r.battery.battery_code} selected` });
  }
  return (
    <View className="gap-2">
      <View className="flex-row gap-2">
        <Input value={scan} onChangeText={setScan} onSubmitEditing={onScan} placeholder="Scan QR / RFID tag or type code" autoCapitalize="characters" className="flex-1" />
        <TouchableOpacity onPress={onScan} className="items-center justify-center rounded-2xl bg-slate-800 px-4"><Text className="text-xs font-bold text-white">Add</Text></TouchableOpacity>
      </View>
      {msg && <Text className={`text-[11px] font-semibold ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{msg.text}</Text>}
      <View className="flex-row items-center justify-between">
        <Text className="text-[11px] font-bold text-slate-500">{selected.size} of {batteries.length} selected</Text>
        {batteries.length > 0 && (
          <TouchableOpacity onPress={() => batteries.forEach((b) => { if (selected.size === batteries.length || !selected.has(b.id)) onToggle(b.id); })}>
            <Text className="text-[11px] font-bold text-violet-700">{selected.size === batteries.length ? 'Clear all' : 'Select all'}</Text>
          </TouchableOpacity>
        )}
      </View>
      {loading ? <Text className="py-3 text-center text-xs text-slate-400">Loading batteries…</Text> : batteries.length === 0 ? (
        <Text className="py-3 text-center text-xs text-slate-400">{emptyText}</Text>
      ) : (
        <View className="gap-1.5">
          {batteries.map((b) => {
            const on = selected.has(b.id);
            return (
              <TouchableOpacity key={b.id} onPress={() => onToggle(b.id)} className={`flex-row items-center gap-3 rounded-2xl border p-3 ${on ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                <View className={`h-5 w-5 items-center justify-center rounded-md border ${on ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'}`}>{on ? <Icon name="check" color="#fff" size={12} /> : null}</View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-slate-900">{b.battery_code}</Text>
                  <Text className="text-[11px] text-slate-500" numberOfLines={1}>{b.client_name || ''}{b.rfid_tag ? ` · RFID ${b.rfid_tag}` : ''}</Text>
                </View>
                <StatusBadge status={b.status} />
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

function useSelection() {
  const [selected, setSelected] = useState(new Set());
  const toggle = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  return [selected, toggle, setSelected];
}

// ── Truck Intake ─────────────────────────────────────────────────────────
export function AdminIntakeCreateScreen() {
  const navigation = useNavigation();
  const clients = useClients('fleet');
  const [client, setClient] = useState(null);
  const [truck, setTruck] = useState('');
  const [driver, setDriver] = useState('');
  const [count, setCount] = useState('0');
  const [scan, setScan] = useState('');
  const [returning, setReturning] = useState([]); // existing batteries coming back
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function addReturning() {
    const raw = scan.trim();
    if (!raw) return;
    setScan('');
    setError(null);
    const r = resolveBatteryInput(raw, []);
    try {
      const { data } = await apiClient.get(`/batteries/${encodeURIComponent(r.code || raw)}`);
      const b = data.battery;
      if (returning.some((x) => x.id === b.id)) return;
      setReturning((list) => [...list, b]);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  }

  async function submit() {
    setError(null);
    if (!client) return setError('Select the client.');
    if (!truck.trim() || !driver.trim()) return setError('Truck number and driver name are required.');
    if ((Number(count) || 0) === 0 && returning.length === 0) return setError('Add a number of new batteries, or scan returning ones.');
    setBusy(true);
    try {
      await apiClient.post('/truck-intakes', {
        truckNumber: truck.trim(), driverName: driver.trim(), clientId: client.id,
        batteryCount: Number(count) || 0, scannedBatteryIds: returning.map((b) => b.id),
      });
      navigation.goBack();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-slate-50">
      <ScrollView contentContainerClassName="p-4 pb-24 gap-4" keyboardShouldPersistTaps="handled">
        <ErrorBox text={error} />
        <View><Label required>Client</Label><ClientChips clients={clients} value={client?.id} onChange={setClient} /></View>
        <View><Label required>Truck number</Label><Input value={truck} onChangeText={(t) => setTruck(t.toUpperCase())} placeholder="e.g. GB21 XYZ" autoCapitalize="characters" /></View>
        <View><Label required>Driver name</Label><Input value={driver} onChangeText={setDriver} placeholder="e.g. George Davies" /></View>
        <View>
          <Label>New batteries on this truck</Label>
          <Input value={count} onChangeText={setCount} keyboardType="number-pad" />
          <Text className="mt-1 text-[11px] text-slate-400">Batteries arriving for the first time — IDs are generated automatically.</Text>
        </View>
        <View>
          <Label>Returning batteries (already have a QR / RFID tag)</Label>
          <View className="flex-row gap-2">
            <Input value={scan} onChangeText={setScan} onSubmitEditing={addReturning} placeholder="Scan QR / RFID tag or type code" autoCapitalize="characters" className="flex-1" />
            <TouchableOpacity onPress={addReturning} className="items-center justify-center rounded-2xl bg-slate-800 px-4"><Text className="text-xs font-bold text-white">Add</Text></TouchableOpacity>
          </View>
          <View className="mt-2 gap-1.5">
            {returning.map((b) => (
              <View key={b.id} className="flex-row items-center justify-between rounded-2xl border border-slate-200 bg-white p-3">
                <Text className="text-sm font-bold text-slate-900">{b.battery_code}</Text>
                <TouchableOpacity onPress={() => setReturning((l) => l.filter((x) => x.id !== b.id))}><Icon name="x" color="#64748b" size={14} /></TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
        <SubmitButton onPress={submit} busy={busy} label={`Record intake (${(Number(count) || 0) + returning.length} batteries)`} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Return Dispatch ──────────────────────────────────────────────────────
export function AdminReturnCreateScreen() {
  const navigation = useNavigation();
  const clients = useClients('fleet');
  const [client, setClient] = useState(null);
  const [truck, setTruck] = useState('');
  const [driver, setDriver] = useState('');
  const [doc, setDoc] = useState(null);
  const [batteries, setBatteries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, toggle, setSelected] = useSelection();
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSelected(new Set());
    if (!client) { setBatteries([]); return; }
    setLoading(true);
    apiClient.get('/batteries', { params: { status: 'repaired', clientName: client.name, limit: 200, offset: 0 } })
      .then(({ data }) => setBatteries(data.data || []))
      .catch((err) => setError(err.response?.data?.message || err.message))
      .finally(() => setLoading(false));
  }, [client, setSelected]);

  async function pickDoc() {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
    if (!res.canceled && res.assets?.length) { const a = res.assets[0]; setDoc({ uri: a.uri, name: a.name, type: a.mimeType || 'application/pdf' }); }
  }

  async function submit() {
    setError(null);
    if (!client) return setError('Select the client.');
    if (!truck.trim() || !driver.trim()) return setError('Truck number and driver name are required.');
    if (selected.size === 0) return setError('Select at least one repaired battery.');
    setBusy(true);
    try {
      const ids = [...selected];
      if (doc) {
        const fd = new FormData();
        fd.append('truckNumber', truck.trim()); fd.append('driverName', driver.trim()); fd.append('clientId', String(client.id));
        fd.append('batteryIds', JSON.stringify(ids)); fd.append('returnedAt', new Date().toISOString());
        fd.append('docFile', { uri: doc.uri, name: doc.name, type: doc.type });
        await apiClient.post('/returns', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await apiClient.post('/returns', { truckNumber: truck.trim(), driverName: driver.trim(), clientId: client.id, batteryIds: ids, returnedAt: new Date().toISOString() });
      }
      navigation.goBack();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-slate-50">
      <ScrollView contentContainerClassName="p-4 pb-24 gap-4" keyboardShouldPersistTaps="handled">
        <ErrorBox text={error} />
        <View><Label required>Client</Label><ClientChips clients={clients} value={client?.id} onChange={setClient} /></View>
        <View><Label required>Truck number</Label><Input value={truck} onChangeText={(t) => setTruck(t.toUpperCase())} autoCapitalize="characters" /></View>
        <View><Label required>Driver name</Label><Input value={driver} onChangeText={setDriver} /></View>
        <View>
          <Label>Dispatch note / document (optional)</Label>
          <TouchableOpacity onPress={pickDoc} className="flex-row items-center gap-2 rounded-2xl border border-dashed border-violet-300 bg-violet-50 px-4 py-3">
            <Icon name="photo" color="#7c3aed" size={16} />
            <Text className="flex-1 text-xs font-bold text-violet-700" numberOfLines={1}>{doc ? doc.name : 'Choose PDF or photo'}</Text>
          </TouchableOpacity>
        </View>
        <View>
          <Label required>Repaired batteries to send back</Label>
          {client ? (
            <BatteryPicker batteries={batteries} selected={selected} onToggle={toggle} loading={loading} emptyText="No repaired batteries waiting for this client." />
          ) : <Text className="text-xs text-slate-400">Select a client to see their repaired batteries.</Text>}
        </View>
        <SubmitButton onPress={submit} busy={busy} label={`Dispatch ${selected.size} batter${selected.size === 1 ? 'y' : 'ies'}`} disabled={selected.size === 0} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Recycle Shipment ─────────────────────────────────────────────────────
export function AdminRecycleCreateScreen() {
  const navigation = useNavigation();
  const partners = useClients('recycle');
  const [partner, setPartner] = useState(null);
  const [vehicle, setVehicle] = useState('');
  const [driver, setDriver] = useState('');
  const [weight, setWeight] = useState('');
  const [price, setPrice] = useState('3.40');
  const [batteries, setBatteries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, toggle] = useSelection();
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiClient.get('/batteries', { params: { status: 'unserviceable', limit: 300, offset: 0 } })
      .then(({ data }) => setBatteries((data.data || []).filter((b) => ['unserviceable', 'tested_parts_removed'].includes(b.status))))
      .catch((err) => setError(err.response?.data?.message || err.message))
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo(() => (Number(weight) || 0) * (Number(price) || 0), [weight, price]);

  async function submit() {
    setError(null);
    if (!partner) return setError('Select the recycling partner.');
    if (!vehicle.trim() || !driver.trim()) return setError('Vehicle number and driver name are required.');
    if (selected.size === 0) return setError('Select at least one battery.');
    setBusy(true);
    try {
      await apiClient.post('/recycle', {
        vehicleNumber: vehicle.trim(), driverName: driver.trim(), batteryIds: [...selected], recycleClientId: partner.id,
        totalWeightKg: weight ? Number(weight) : undefined, pricePerKg: price ? Number(price) : undefined,
      });
      navigation.goBack();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-slate-50">
      <ScrollView contentContainerClassName="p-4 pb-24 gap-4" keyboardShouldPersistTaps="handled">
        <ErrorBox text={error} />
        <View><Label required>Recycling partner</Label><ClientChips clients={partners} value={partner?.id} onChange={setPartner} /></View>
        <View><Label required>Vehicle number</Label><Input value={vehicle} onChangeText={(t) => setVehicle(t.toUpperCase())} autoCapitalize="characters" /></View>
        <View><Label required>Driver name</Label><Input value={driver} onChangeText={setDriver} /></View>
        <View className="flex-row gap-2">
          <View className="flex-1"><Label>Total weight (kg)</Label><Input value={weight} onChangeText={setWeight} keyboardType="decimal-pad" /></View>
          <View className="flex-1"><Label>Price per kg (£)</Label><Input value={price} onChangeText={setPrice} keyboardType="decimal-pad" /></View>
        </View>
        {value > 0 && <Text className="text-xs font-bold text-emerald-700">Shipment value: £{value.toFixed(2)}</Text>}
        <View>
          <Label required>Unserviceable batteries</Label>
          <BatteryPicker batteries={batteries} selected={selected} onToggle={toggle} loading={loading} emptyText="No unserviceable batteries waiting." />
        </View>
        <SubmitButton onPress={submit} busy={busy} label={`Ship ${selected.size} batter${selected.size === 1 ? 'y' : 'ies'} for recycling`} disabled={selected.size === 0} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export { Switch };
