import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../../services/api-client';
import { resolveBatteryInput, UNASSIGNED_TAG_MESSAGE } from '../../utils/scan-input';
import ScanBatteryInput from '../../components/scan/ScanBatteryInput';
import Icon from '../../components/ui/Icon';

// "Add truck intake" from the client dashboard — the same form and call as
// the web ClientDashboardPage (POST /clients/me/truck-intakes { truckNumber,
// driverName, batteryCount, batteryCodes, issueDescription }). Batteries can
// be scanned with an RFID reader, the camera or typed; a scanned RFID tag is
// matched to the client's own battery, and a tag nobody assigned is refused.

const Field = ({ label, required, optional, children }) => (
  <View>
    <Text className="mb-1.5 text-xs font-semibold text-slate-600">
      {label}
      {required ? <Text className="text-red-500"> *</Text> : null}
      {optional ? <Text className="font-normal text-slate-400"> (Optional)</Text> : null}
    </Text>
    {children}
  </View>
);

const inputClass = 'rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900';

export default function ClientTruckIntakeScreen() {
  const navigation = useNavigation();
  const [truckNumber, setTruckNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [batteryCount, setBatteryCount] = useState('1');
  const [codes, setCodes] = useState([]);
  const [issue, setIssue] = useState('');
  const [fleet, setFleet] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    apiClient.get('/clients/me/batteries').then(({ data }) => setFleet(data.data || [])).catch(() => {});
  }, []);

  function addScanned(raw) {
    const r = resolveBatteryInput(raw, fleet);
    if (r.unassignedTag) return { tone: 'bad', message: `${UNASSIGNED_TAG_MESSAGE} (tag ${r.code})` };
    const code = (r.code || '').toUpperCase();
    if (!code) return undefined;
    if (codes.includes(code)) return { tone: 'warn', message: `${code} is already on this truck.` };
    const next = [...codes, code];
    setCodes(next);
    // the count follows the scans unless the client typed a bigger number
    setBatteryCount((c) => String(Math.max(Number(c) || 0, next.length)));
    return { tone: 'good', message: `✓ ${code} added${r.battery?.serial_number ? ` (SN ${r.battery.serial_number})` : ''}` };
  }


  async function submit() {
    setError(null);
    if (!truckNumber.trim()) return setError('Truck Number is required.');
    if (!driverName.trim()) return setError('Driver Name is required.');
    setBusy(true);
    try {
      const { data } = await apiClient.post('/clients/me/truck-intakes', {
        truckNumber: truckNumber.trim(),
        driverName: driverName.trim(),
        batteryCount: Number(batteryCount) || (codes.length > 0 ? codes.length : 1),
        batteryCodes: codes,
        issueDescription: issue.trim(),
      });
      setDone(data?.data || data || {});
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to record truck intake.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    const rows = [
      ['Truck Number', done.intake?.truck_number || 'N/A'],
      ['Driver', done.intake?.driver_name || 'Fleet Driver'],
      ['Batteries Dispatched', `${done.count || done.intake?.battery_count || 1} packs`],
      ['Status', 'Pending Arrival'],
    ];
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 p-6">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-emerald-100"><Icon name="checkCircle" color="#059669" size={30} /></View>
        <Text className="mt-4 text-center text-lg font-extrabold text-slate-900">Truck Intake Recorded Successfully!</Text>
        <Text className="mt-1 text-center text-xs text-slate-500">
          Your dispatch has been registered. The Refurbnics workshop has been notified and will verify the batteries upon arrival.
        </Text>
        <View className="mt-5 w-full gap-2 rounded-2xl border border-slate-200 bg-white p-4">
          {rows.map(([k, v]) => (
            <View key={k} className="flex-row justify-between">
              <Text className="text-[11px] font-semibold uppercase text-slate-500">{k}</Text>
              <Text className={`text-xs font-bold ${k === 'Status' ? 'text-amber-600' : 'text-slate-900'}`}>{v}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity onPress={() => navigation.goBack()} className="mt-6 w-full items-center rounded-2xl bg-emerald-600 py-3.5">
          <Text className="text-sm font-bold text-white">✓ Done &amp; Return to Dashboard</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('MyBatteries', { initialBucket: 'packed' })} className="mt-2 w-full items-center rounded-2xl bg-slate-100 py-3.5">
          <Text className="text-sm font-bold text-slate-700">View packed trucks</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-slate-50">
      <ScrollView contentContainerClassName="p-4 pb-24 gap-4" keyboardShouldPersistTaps="handled">
        {error && (
          <View className="rounded-2xl border border-red-200 bg-red-50 p-3"><Text className="text-xs font-semibold text-red-700">{error}</Text></View>
        )}
        <Text className="rounded-2xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
          Log an incoming shipment dispatched to Refurbnics workshop for diagnostics &amp; refurbishment.
        </Text>
        <Field label="Truck Number" required>
          <TextInput value={truckNumber} onChangeText={(t) => setTruckNumber(t.toUpperCase())} placeholder="e.g. TR-8042 or GB21 XYZ" placeholderTextColor="#94a3b8" autoCapitalize="characters" className={inputClass} />
        </Field>
        <Field label="Driver Name" required>
          <TextInput value={driverName} onChangeText={(t) => setDriverName(t ? t.charAt(0).toUpperCase() + t.slice(1) : t)} placeholder="e.g. George Davies" placeholderTextColor="#94a3b8" className={inputClass} />
        </Field>
        <Field label="Battery Quantity" required>
          <View className="flex-row items-center gap-2">
            <TouchableOpacity onPress={() => setBatteryCount((c) => String(Math.max(1, (Number(c) || 1) - 1)))} className="h-11 w-11 items-center justify-center rounded-xl border border-slate-300 bg-white">
              <Text className="text-lg font-bold text-slate-700">-</Text>
            </TouchableOpacity>
            <TextInput
              value={batteryCount}
              onChangeText={(t) => setBatteryCount(t.replace(/[^0-9]/g, ''))}
              onBlur={() => setBatteryCount((c) => String(Math.max(1, Number(c) || 1)))}
              keyboardType="number-pad"
              className={`${inputClass} w-20 text-center font-bold`}
            />
            <TouchableOpacity onPress={() => setBatteryCount((c) => String((Number(c) || 1) + 1))} className="h-11 w-11 items-center justify-center rounded-xl border border-slate-300 bg-white">
              <Text className="text-lg font-bold text-slate-700">+</Text>
            </TouchableOpacity>
            <Text className="flex-1 text-xs text-slate-500">battery pack{Number(batteryCount) > 1 ? 's' : ''} on this vehicle</Text>
          </View>
        </Field>
        <Field label="Specific Battery Codes" optional>
          <ScanBatteryInput onSubmit={addScanned} placeholder="Scan RFID / QR or type a code (e.g. HF-001)" />
          {codes.length > 0 && (
            <View className="mt-2 gap-1.5">
              {codes.map((c) => (
                <View key={c} className="flex-row items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <Text className="font-mono text-xs font-bold text-blue-700">{c}</Text>
                  <TouchableOpacity onPress={() => setCodes((l) => l.filter((x) => x !== c))} hitSlop={8}><Icon name="x" color="#64748b" size={14} /></TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </Field>
        <Field label="Fault / Service Notes" optional>
          <TextInput value={issue} onChangeText={setIssue} multiline placeholder="e.g. Routine 500-cycle overhaul, sudden discharge error, BMS diagnostics needed…" placeholderTextColor="#94a3b8" className={`${inputClass} min-h-[90px]`} style={{ textAlignVertical: 'top' }} />
        </Field>
        <View className="flex-row gap-2">
          <TouchableOpacity disabled={busy} onPress={() => navigation.goBack()} className="flex-1 items-center rounded-2xl bg-slate-100 py-3.5">
            <Text className="text-sm font-bold text-slate-700">Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity disabled={busy} onPress={submit} className={`flex-[2] flex-row items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3.5 ${busy ? 'opacity-60' : ''}`}>
            <Icon name="truck" color="#fff" size={16} />
            <Text className="text-sm font-bold text-white">{busy ? 'Recording…' : 'Record Intake'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
