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

const Field = ({ label, required, children }) => (
  <View>
    <Text className="mb-1.5 text-xs font-semibold text-slate-600">{label}{required ? <Text className="text-red-500"> *</Text> : null}</Text>
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
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 p-6">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-emerald-100"><Icon name="truck" color="#059669" size={28} /></View>
        <Text className="mt-4 text-lg font-extrabold text-slate-900">Truck intake recorded</Text>
        <Text className="mt-1 text-center text-xs text-slate-500">
          {done.message || `Truck ${truckNumber.toUpperCase()} is on its way to the workshop. You can follow it under Packed.`}
        </Text>
        <TouchableOpacity onPress={() => navigation.navigate('MyBatteries', { initialBucket: 'packed' })} className="mt-6 w-full items-center rounded-2xl bg-blue-600 py-3.5">
          <Text className="text-sm font-bold text-white">View packed trucks</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()} className="mt-2 w-full items-center rounded-2xl bg-slate-100 py-3.5">
          <Text className="text-sm font-bold text-slate-700">Back to dashboard</Text>
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
        <Field label="Truck number" required>
          <TextInput value={truckNumber} onChangeText={(t) => setTruckNumber(t.toUpperCase())} placeholder="e.g. GB21 XYZ" placeholderTextColor="#94a3b8" autoCapitalize="characters" className={inputClass} />
        </Field>
        <Field label="Driver name" required>
          <TextInput value={driverName} onChangeText={setDriverName} placeholder="e.g. George Davies" placeholderTextColor="#94a3b8" className={inputClass} />
        </Field>
        <Field label="Number of batteries">
          <TextInput value={batteryCount} onChangeText={setBatteryCount} keyboardType="number-pad" className={inputClass} />
        </Field>
        <Field label="Batteries on this truck (scan or type)">
          <ScanBatteryInput onSubmit={addScanned} />
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
        <Field label="Issue description (optional)">
          <TextInput value={issue} onChangeText={setIssue} multiline placeholder="What's wrong with these batteries?" placeholderTextColor="#94a3b8" className={`${inputClass} min-h-[90px]`} style={{ textAlignVertical: 'top' }} />
        </Field>
        <TouchableOpacity disabled={busy} onPress={submit} className={`items-center rounded-2xl bg-blue-600 py-3.5 ${busy ? 'opacity-60' : ''}`}>
          <Text className="text-sm font-bold text-white">{busy ? 'Recording…' : 'Record truck intake'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
