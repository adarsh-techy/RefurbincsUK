import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../../services/api-client';
import ManifestPicker, { resolveScan } from '../../components/admin/sa2/ManifestPicker';
import useFleetClients from '../../components/admin/sa2/useFleetClients';
import DateTimeField, { DocumentBox, pickDocument } from '../../components/admin/sa2/DateTimeField';
import { apiError, ClientSelect, ErrorBox, GhostButton, Input, Label, PrimaryButton } from '../../components/admin/sa2/ui';
import { statusLabel } from '../../components/ui/Badge';
import { useReaderGuard } from '../../utils/reader-guard';

// Admin create flows: "Record a Return" and "Record a Recycle Shipment" —
// the web ReturnForm and RecycleForm with the same checks, endpoints and
// payloads. Batteries are added by scanning (RFID / QR / typed code) or
// from the list of eligible batteries; each scan is checked against
// GET /batteries/:code like the web. (Truck intakes are recorded by
// clients, not created from the admin app.)

const statusText = (s) => statusLabel(s);

function Card({ children }) {
  return <View className="gap-3.5 rounded-2xl border border-slate-200 bg-white p-4">{children}</View>;
}

function Footer({ summary, ok, onCancel, onSubmit, submitLabel, disabled }) {
  return (
    <View className="gap-3 border-t border-slate-200 bg-white p-4 pb-8">
      <Text className={`text-xs ${ok ? 'font-bold text-emerald-700' : 'font-medium text-slate-500'}`}>{ok ? `✓ ${summary}` : summary}</Text>
      <View className="flex-row gap-2.5">
        <GhostButton label="Cancel" onPress={onCancel} />
        <View className="flex-1">
          <PrimaryButton tone="emerald" label={submitLabel} onPress={onSubmit} disabled={disabled} />
        </View>
      </View>
    </View>
  );
}

const plural = (n) => `${n} ${n === 1 ? 'battery' : 'batteries'}`;

// ── Return dispatch ─────────────────────────────────────────────────────
export function AdminReturnCreateScreen() {
  const navigation = useNavigation();
  const clients = useFleetClients();
  const [clientId, setClientId] = useState('');
  const [truckNumber, setTruckNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  // a tag the reader types into these fields goes to the scan box instead
  const scanRef = useRef(null);
  const toScanBox = (tag) => scanRef.current?.scan(tag);
  const onTruckChange = useReaderGuard(truckNumber, (t) => setTruckNumber(t.toUpperCase()), toScanBox);
  const onDriverChange = useReaderGuard(driverName, setDriverName, toScanBox);
  const [returnedAt, setReturnedAt] = useState(new Date());
  const [docFile, setDocFile] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [added, setAdded] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const client = clients.find((c) => String(c.id) === clientId);

  // the picked client's repaired-and-ready batteries
  useEffect(() => {
    if (!client) { setCandidates([]); return undefined; }
    let cancelled = false;
    apiClient
      .get('/batteries', { params: { clientName: client.name, status: 'repaired', limit: 200 } })
      .then(({ data }) => { if (!cancelled) setCandidates(data.data || []); })
      .catch(() => { if (!cancelled) setCandidates([]); });
    return () => { cancelled = true; };
  }, [client]);

  function selectClient(id) {
    setClientId(id);
    setAdded([]);
  }

  async function onScan(raw) {
    const r = await resolveScan(raw, candidates);
    if (r.error) return { tone: 'bad', message: r.error };
    if (!r.code) return undefined;
    try {
      const { data } = await apiClient.get(`/batteries/${encodeURIComponent(r.code)}`);
      const battery = data.battery;
      if (added.some((b) => b.id === battery.id)) return { tone: 'warn', message: `${battery.battery_code} is already in this return manifest.` };
      if (battery.status !== 'repaired') return { tone: 'bad', message: `${battery.battery_code} is not ready to return (status: ${statusText(battery.status)}).` };
      if (client && battery.client_name && battery.client_name.toLowerCase() !== client.name.toLowerCase()) {
        return { tone: 'bad', message: `${battery.battery_code} belongs to ${battery.client_name}, not ${client.name}.` };
      }
      setAdded((prev) => (prev.some((b) => b.id === battery.id) ? prev : [...prev, battery]));
      return { tone: 'good', message: `✓ ${battery.battery_code}${battery.serial_number ? ` (SN: ${battery.serial_number})` : ''} added.` };
    } catch (err) {
      return { tone: 'bad', message: err.response?.status === 404 ? `No battery found with code "${r.code}".` : apiError(err) };
    }
  }

  async function submit() {
    if (!clientId) return setError('Please select a fleet client.');
    if (!truckNumber.trim() || !driverName.trim()) return setError('Dispatch truck number and driver name are required.');
    if (!returnedAt) return setError('Enter a valid return date and time.');
    if (added.length === 0) return setError('Please add at least one repaired battery to dispatch.');
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('truckNumber', truckNumber);
      fd.append('driverName', driverName);
      fd.append('clientId', clientId);
      fd.append('returnedAt', returnedAt.toISOString());
      fd.append('batteryIds', JSON.stringify(added.map((b) => b.id)));
      if (docFile) fd.append('docFile', { uri: docFile.uri, name: docFile.name, type: docFile.type });
      await apiClient.post('/returns', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      navigation.goBack();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-slate-50">
      <ScrollView contentContainerClassName="p-4 pb-10 gap-4" keyboardShouldPersistTaps="handled">
        <View>
          <Text className="text-base font-extrabold text-slate-900">Record a Return</Text>
          <Text className="text-xs text-slate-500">Dispatch repaired batteries back to the customer.</Text>
        </View>
        <Card>
          <View>
            <Label>🏢 Destination Client</Label>
            <Text className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Select Fleet Client ({clients.length})</Text>
            <ClientSelect clients={clients} value={clientId} onChange={(id) => selectClient(id)} />
          </View>
          <View>
            <Label>🚚 Dispatch Truck Number</Label>
            <Input value={truckNumber} onChangeText={onTruckChange} autoCapitalize="characters" placeholder="e.g. GB21 XYZ" />
          </View>
          <View>
            <Label>👤 Driver Name</Label>
            <Input value={driverName} onChangeText={onDriverChange} placeholder="e.g. George Davies" />
          </View>
          <View>
            <Label>📅 Return Date & Time</Label>
            <DateTimeField value={returnedAt} onChange={setReturnedAt} autoLabel="Auto-Set: Current Time" />
          </View>
          <View>
            <Label>Return Note / Document File (Optional)</Label>
            <DocumentBox file={docFile} onPick={async () => setDocFile(await pickDocument())} onRemove={() => setDocFile(null)} />
          </View>
        </Card>

        <ManifestPicker
          scanRef={scanRef}
          label="Scan / Pick Repaired Batteries for Return"
          countText={clientId ? `${candidates.filter((b) => !added.some((a) => a.id === b.id)).length} repaired units ready` : null}
          disabled={!clientId}
          placeholder={clientId ? 'Scan QR code or enter repaired battery ID…' : 'Select destination client above first…'}
          candidates={candidates}
          added={added}
          onScan={onScan}
          onRemove={(b) => setAdded((prev) => prev.filter((x) => x.id !== b.id))}
          suggestionTitle={(filtering, n) => (filtering ? `Matching Repaired Batteries (${n})` : `Repaired & Ready for ${client?.name} (${n})`)}
          notice={{
            title: 'Dispatch Verification Note',
            text: 'Only batteries that have successfully passed all testing and are marked as Repaired can be added to this return shipment.',
          }}
          manifestTitle="Return Shipment Manifest"
          stagedBadge={{ label: 'Repaired', cls: 'bg-emerald-100 text-emerald-800' }}
          emptyTitle="No batteries staged for return yet"
          emptyText={clientId ? 'Scan QR or select from the list above.' : 'Select a client first to view ready repaired units.'}
        />
        <ErrorBox text={error} />
      </ScrollView>
      <Footer
        ok={added.length > 0}
        summary={added.length > 0 ? `${added.length} repaired batteries staged for return` : 'Select client and add batteries to dispatch'}
        onCancel={() => navigation.goBack()}
        onSubmit={submit}
        submitLabel={submitting ? 'Recording Dispatch…' : `✓ Record Return (${plural(added.length)})`}
        disabled={submitting || added.length === 0 || !clientId}
      />
    </KeyboardAvoidingView>
  );
}

// ── Recycle shipment ────────────────────────────────────────────────────
export function AdminRecycleCreateScreen() {
  const navigation = useNavigation();
  const partners = useFleetClients(true, 'recycle');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  // a tag the reader types into these fields goes to the scan box instead
  const scanRef = useRef(null);
  const toScanBox = (tag) => scanRef.current?.scan(tag);
  const onVehicleChange = useReaderGuard(vehicleNumber, (t) => setVehicleNumber(t.toUpperCase()), toScanBox);
  const onDriverChange = useReaderGuard(driverName, setDriverName, toScanBox);
  const [partnerId, setPartnerId] = useState('');
  const [pricePerKg, setPricePerKg] = useState('3.40');
  const [totalWeightKg, setTotalWeightKg] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [added, setAdded] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get('/batteries', { params: { status: 'unserviceable,tested_parts_removed', limit: 200 } })
      .then(({ data }) => { if (!cancelled) setCandidates(data.data || []); })
      .catch(() => { if (!cancelled) setCandidates([]); });
    return () => { cancelled = true; };
  }, []);

  async function onScan(raw) {
    const r = await resolveScan(raw, candidates);
    if (r.error) return { tone: 'bad', message: r.error };
    if (!r.code) return undefined;
    try {
      const { data } = await apiClient.get(`/batteries/${encodeURIComponent(r.code)}`);
      const battery = data.battery;
      if (added.some((b) => b.id === battery.id)) return { tone: 'warn', message: `${battery.battery_code} is already in this recycle manifest.` };
      if (battery.status !== 'unserviceable' && battery.status !== 'tested_parts_removed') {
        return { tone: 'bad', message: `${battery.battery_code} is not marked unserviceable (status: ${statusText(battery.status)}).` };
      }
      if (data.pendingPartsRemoval?.length > 0) {
        return { tone: 'bad', message: `${battery.battery_code} still has ${data.pendingPartsRemoval.length} fitted part(s) that must be removed & restocked first.` };
      }
      setAdded((prev) => (prev.some((b) => b.id === battery.id) ? prev : [...prev, battery]));
      return { tone: 'good', message: `✓ ${battery.battery_code}${battery.serial_number ? ` (SN: ${battery.serial_number})` : ''} added to recycle manifest.` };
    } catch (err) {
      return { tone: 'bad', message: err.response?.status === 404 ? `No battery found with code "${r.code}".` : apiError(err) };
    }
  }

  const rate = parseFloat(pricePerKg) || 3.4;
  const weight = parseFloat(totalWeightKg) || 0;

  async function submit() {
    if (!vehicleNumber.trim() || !driverName.trim()) return setError('Vehicle number and driver name are required.');
    if (added.length === 0) return setError('Please add at least one unserviceable battery to recycle.');
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post('/recycle', {
        vehicleNumber,
        driverName,
        batteryIds: added.map((b) => b.id),
        recycleClientId: partnerId || undefined,
        totalWeightKg: totalWeightKg !== '' ? Number(totalWeightKg) : undefined,
        pricePerKg: pricePerKg !== '' ? Number(pricePerKg) : 3.4,
      });
      navigation.goBack();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-slate-50">
      <ScrollView contentContainerClassName="p-4 pb-10 gap-4" keyboardShouldPersistTaps="handled">
        <View>
          <Text className="text-base font-extrabold text-slate-900">Record a Recycle Shipment</Text>
          <Text className="text-xs text-slate-500">Send unserviceable batteries out for recycling.</Text>
        </View>
        <Card>
          <View>
            <Label>🚚 Vehicle / Truck Number</Label>
            <Input value={vehicleNumber} onChangeText={onVehicleChange} autoCapitalize="characters" placeholder="e.g. GB21 XYZ" />
          </View>
          <View>
            <Label>👤 Driver Name</Label>
            <Input value={driverName} onChangeText={onDriverChange} placeholder="e.g. George Davies" />
          </View>
          <View>
            <Label>🏢 Recycle Partner (Optional)</Label>
            <ClientSelect
              clients={[{ id: '', name: 'None (General Smelting / Recycling)' }, ...partners]}
              value={partnerId}
              onChange={(id) => setPartnerId(id)}
            />
          </View>
        </Card>

        <Card>
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Label>£ Rate per kg (£/kg)</Label>
              <Input value={pricePerKg} onChangeText={setPricePerKg} keyboardType="decimal-pad" placeholder="3.40" />
            </View>
            <View className="flex-1">
              <Label>⚖ Total Weight (kg)</Label>
              <Input value={totalWeightKg} onChangeText={setTotalWeightKg} keyboardType="decimal-pad" placeholder="e.g. 120.50" />
            </View>
          </View>
          <View>
            <Label>£ Calculated Total Payout</Label>
            <View className="flex-row items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5">
              <Text className="text-[11px] font-semibold text-slate-500">{pricePerKg || '3.40'} × {totalWeightKg || '0'} kg</Text>
              <Text className="text-base font-bold text-emerald-700">£{(rate * weight).toFixed(2)}</Text>
            </View>
          </View>
        </Card>

        <ManifestPicker
          scanRef={scanRef}
          label="Scan / Pick Unserviceable Batteries"
          countText={`${candidates.filter((b) => !added.some((a) => a.id === b.id)).length} unserviceable units available`}
          placeholder="Scan QR or enter unserviceable battery code…"
          candidates={candidates}
          added={added}
          onScan={onScan}
          onRemove={(b) => setAdded((prev) => prev.filter((x) => x.id !== b.id))}
          suggestionTitle={(filtering, n) => (filtering ? `Matching Unserviceable Units (${n})` : `Available for Recycling (${n})`)}
          sugMeta={(b) => b.client_name || null}
          notice={{
            title: '🛡 Environmental & Material Recovery Notice',
            text: 'Only packs verified as degraded beyond repair (unserviceable) and stripped of reusable components are eligible for raw materials recycling.',
          }}
          manifestTitle="Recycle Shipment Manifest"
          stagedBadge={{ label: 'Unserviceable', cls: 'bg-rose-100 text-rose-800' }}
          emptyTitle="No batteries staged for recycling yet"
          emptyText="Scan QR codes or select unserviceable packs from the list above."
        />
        <ErrorBox text={error} />
      </ScrollView>
      <Footer
        ok={added.length > 0}
        summary={added.length > 0 ? `${added.length} unserviceable batteries staged for recycling` : 'Scan or pick unserviceable batteries to create shipment'}
        onCancel={() => navigation.goBack()}
        onSubmit={submit}
        submitLabel={submitting ? 'Recording Shipment…' : `✓ Record Recycle Shipment (${plural(added.length)})`}
        disabled={submitting || added.length === 0}
      />
    </KeyboardAvoidingView>
  );
}

