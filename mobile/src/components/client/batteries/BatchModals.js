import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import apiClient from '../../../services/api-client';
import ScanBatteryInput from '../../scan/ScanBatteryInput';
import { resolveBatteryInput, UNASSIGNED_TAG_MESSAGE } from '../../../utils/scan-input';
import { Badge, statusLabel } from '../../ui/Badge';
import Icon from '../../ui/Icon';
import {
  Btn,
  Dialog,
  FieldLabel,
  NOT_RETURNABLE_STATUSES,
  Notice,
  Sheet,
  capitalizeFirst,
  inputClass,
  resolveBatchIntakeId,
} from './common';

// The web ClientBatteriesPage popups for a packed truck batch that the
// workshop hasn't verified yet:
//   EditBatchModal   truck + driver ("Save Truck & Driver Info"), the batteries
//                    on it (Remove each) and "Add Another Battery to this
//                    Intake" with optional serial / defect note
//   AddMoreModal     "+ Add Batteries": stage several (scan / suggestions),
//                    each with serial + defect reason, then add in one call
//   EditBatteryModal serial + defect notes of one battery
//   ConfirmDialog    remove battery / cancel batch confirmations

function errText(err) {
  return err.response?.data?.message || err.message;
}

export function EditBatchModal({ batch, fleet = [], onClose, onChanged }) {
  const [truck, setTruck] = useState('');
  const [driver, setDriver] = useState('');
  const [list, setList] = useState([]);
  const [serial, setSerial] = useState('');
  const [notes, setNotes] = useState('');
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const intakeId = resolveBatchIntakeId(batch);

  useEffect(() => {
    if (!batch) return;
    setTruck(batch.truckNumber || '');
    setDriver(batch.driverName || '');
    setList(batch.batteries || []);
    setSerial('');
    setNotes('');
    setError(null);
    setSuccess(null);
    setShowSuggestions(true);
  }, [batch]);

  const suggestions = useMemo(() => {
    const inBatch = new Set(list.map((b) => (b.battery_code || b.code || '').toUpperCase()));
    return fleet
      .filter((b) => !inBatch.has(b.battery_code.toUpperCase()))
      .filter((b) => !NOT_RETURNABLE_STATUSES.has(b.status))
      .slice(0, 8);
  }, [fleet, list]);

  async function addBattery(raw, customSerial, customNotes) {
    if (!intakeId) {
      const message = 'This batch cannot be modified directly (missing intake ID).';
      setError(message);
      return { tone: 'bad', message };
    }
    const resolved = resolveBatteryInput(raw, fleet);
    if (resolved.unassignedTag) return { tone: 'bad', message: `${UNASSIGNED_TAG_MESSAGE} (tag ${resolved.code})` };
    const code = (resolved.code || '').toUpperCase();
    if (!code) return { tone: 'warn', message: 'Please enter or scan a battery code.' };
    const s = (customSerial !== undefined ? customSerial : serial).trim();
    const n = (customNotes !== undefined ? customNotes : notes).trim();
    if (list.some((b) => (b.battery_code || b.code || '').toUpperCase() === code)) {
      return { tone: 'warn', message: `Battery ${code} is already in this intake batch.` };
    }
    setAdding(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await apiClient.post(`/clients/me/truck-intakes/${intakeId}/batteries`, {
        batteries: [{ code, serialNumber: s || undefined, issueDescription: n || undefined }],
      });
      const added = res.data?.data?.added?.[0] || {
        id: `added-${Date.now()}`,
        battery_code: code,
        serial_number: s || null,
        notes: n || null,
        status: 'in_repair',
        truck_intake_id: intakeId,
      };
      setList((prev) => [...prev, added]);
      setSerial('');
      setNotes('');
      const message = `✓ Added battery ${code} to intake.`;
      setSuccess(message);
      onChanged?.();
      return { tone: 'good', message };
    } catch (err) {
      const message = errText(err) || 'Failed to add battery.';
      setError(message);
      return { tone: 'bad', message };
    } finally {
      setAdding(false);
    }
  }

  async function removeBattery(b) {
    const id = b.id || b.battery_code || b.code;
    const target = resolveBatchIntakeId(batch, b) || 'awaiting_pickup';
    setRemovingId(id);
    setError(null);
    setSuccess(null);
    try {
      await apiClient.delete(`/clients/me/truck-intakes/${target}/batteries/${id}`);
      setList((prev) => prev.filter((x) => (b.id ? x.id !== b.id : (x.battery_code || x.code) !== (b.battery_code || b.code))));
      setSuccess(`✓ Removed battery ${b.battery_code || b.code || ''} from intake.`);
      onChanged?.();
    } catch (err) {
      setError(errText(err) || 'Failed to remove battery.');
    } finally {
      setRemovingId(null);
    }
  }

  async function save(closeAfter) {
    if (!truck.trim()) return setError('Truck Number is required.');
    if (!driver.trim()) return setError('Driver Name is required.');
    setSaving(true);
    setError(null);
    try {
      if (batch.intakeId) {
        await apiClient.patch(`/clients/me/truck-intakes/${batch.intakeId}`, { truckNumber: truck.trim(), driverName: driver.trim() });
      }
      setSuccess('✓ Truck batch details saved successfully.');
      onChanged?.();
      if (closeAfter) setTimeout(onClose, 400);
    } catch (err) {
      setError(errText(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      visible={Boolean(batch)}
      title={`Edit Truck Batch — ${batch?.truckNumber || 'Intake'}`}
      description="Update truck information, add new batteries to this intake shipment, or remove units."
      onClose={onClose}
      footer={
        <View className="flex-row gap-2">
          <Btn label="Close" tone="ghost" onPress={onClose} className="flex-1" />
          <Btn label={saving ? 'Saving Changes…' : 'Save & Done'} onPress={() => save(true)} disabled={saving} className="flex-1" />
        </View>
      }
    >
      {success ? <Notice tone="good">{success}</Notice> : null}
      {error ? <Notice tone="bad">{error}</Notice> : null}

      <View className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
        <View className="mb-3 flex-row items-center gap-2">
          <Icon name="truck" color="#2563eb" size={16} />
          <Text className="text-sm font-bold text-slate-900 dark:text-white">Truck Logistics & Vehicle Info</Text>
        </View>
        <FieldLabel required>Truck Number</FieldLabel>
        <TextInput value={truck} onChangeText={(t) => setTruck(t.toUpperCase())} placeholder="e.g. GB21 XYZ or LD68 FGH" placeholderTextColor="#94a3b8" autoCapitalize="characters" autoCorrect={false} className={inputClass} />
        <View className="h-3" />
        <FieldLabel required>Driver Name</FieldLabel>
        <TextInput value={driver} onChangeText={(t) => setDriver(capitalizeFirst(t))} placeholder="e.g. George Davies" placeholderTextColor="#94a3b8" className={inputClass} />
        <Btn label={saving ? 'Saving…' : 'Save Truck & Driver Info'} onPress={() => save(false)} disabled={saving} className="mt-3" />
      </View>

      <View className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
        <View className="flex-row items-center justify-between">
          <Text className="flex-1 text-sm font-bold text-slate-900 dark:text-white">Batteries in this Intake ({list.length} Loaded)</Text>
          <Badge tone="info">{list.length === 1 ? '1 battery' : `${list.length} batteries`}</Badge>
        </View>
        {list.length === 0 ? (
          <Text className="mt-3 rounded-xl border border-dashed border-slate-300 p-4 text-center text-[11px] text-slate-400">
            No batteries in this intake batch. Use the form below to add batteries.
          </Text>
        ) : (
          list.map((b, idx) => {
            const id = b.id || b.battery_code || b.code;
            return (
              <View key={id || idx} className="mt-2 flex-row items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
                <View className="flex-1">
                  <Text className="text-xs font-bold text-slate-900 dark:text-white">
                    <Text className="text-slate-400">{idx + 1}. </Text>
                    {b.battery_code || b.code}
                    {b.serial_number ? <Text className="font-normal text-slate-500">  SN: {b.serial_number}</Text> : null}
                  </Text>
                  {b.notes ? <Text className="text-[11px] text-slate-500" numberOfLines={2}>{b.notes}</Text> : null}
                </View>
                <TouchableOpacity disabled={removingId === id} onPress={() => removeBattery(b)} className="flex-row items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5">
                  {removingId === id ? <ActivityIndicator size="small" color="#dc2626" /> : null}
                  <Text className="text-[11px] font-bold text-red-700">Remove</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </View>

      <View className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
        <Text className="text-sm font-bold text-slate-900 dark:text-white">+ Add Another Battery to this Intake</Text>
        <TextInput value={serial} onChangeText={setSerial} placeholder="Serial Number (Optional)" placeholderTextColor="#94a3b8" autoCorrect={false} className="mt-3 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
        <TextInput value={notes} onChangeText={setNotes} placeholder="Fault / Defect Note (Optional)" placeholderTextColor="#94a3b8" className="mt-2 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
        <View className="mt-2">
          <ScanBatteryInput
            onSubmit={(raw) => addBattery(raw)}
            disabled={adding}
            submitLabel={adding ? 'Adding…' : 'Add to Intake'}
            placeholder="Type battery ID (e.g. UBE-0012) or scan QR / RFID…"
          />
        </View>
        {showSuggestions && suggestions.length > 0 ? (
          <View className="mt-3 rounded-xl border border-slate-200 dark:border-slate-800">
            <View className="flex-row items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-800">
              <Text className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Available Fleet Batteries</Text>
              <TouchableOpacity onPress={() => setShowSuggestions(false)} hitSlop={8}>
                <Text className="text-[11px] font-bold text-slate-500">Hide</Text>
              </TouchableOpacity>
            </View>
            {suggestions.map((b) => (
              <TouchableOpacity key={b.id || b.battery_code} disabled={adding} onPress={() => addBattery(b.battery_code, b.serial_number || '', b.notes || '')} className="flex-row items-center justify-between border-b border-slate-100 px-3 py-2.5 dark:border-slate-800">
                <Text className="text-xs font-bold text-slate-800 dark:text-slate-100">{b.battery_code}</Text>
                {b.serial_number ? <Text className="text-[11px] text-slate-500">SN: {b.serial_number}</Text> : <Text className="text-[11px] font-bold text-emerald-700">+ Add</Text>}
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </View>
    </Sheet>
  );
}

export function AddMoreModal({ batch, fleet = [], onClose, onChanged }) {
  const [staged, setStaged] = useState([]); // { id, code, serial, issue }
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (!batch) return;
    setStaged([]);
    setError(null);
    setSuccess(null);
    setShowSuggestions(true);
  }, [batch]);

  const suggestions = useMemo(() => {
    const inBatch = new Set((batch?.batteries || []).map((b) => b.battery_code.toUpperCase()));
    const inStage = new Set(staged.map((b) => b.code.toUpperCase()));
    return fleet
      .filter((b) => !inBatch.has(b.battery_code.toUpperCase()) && !inStage.has(b.battery_code.toUpperCase()))
      .filter((b) => !NOT_RETURNABLE_STATUSES.has(b.status))
      .slice(0, 8);
  }, [fleet, batch, staged]);

  function stage(raw, initialSerial = '') {
    const resolved = resolveBatteryInput(raw, fleet);
    if (resolved.unassignedTag) return { tone: 'bad', message: `${UNASSIGNED_TAG_MESSAGE} (tag ${resolved.code})` };
    const code = (resolved.code || '').toUpperCase();
    if (!code) return undefined;
    if (staged.some((b) => b.code.toUpperCase() === code)) return { tone: 'warn', message: `Battery ${code} is already staged to be added.` };
    if (batch?.batteries?.some((b) => b.battery_code.toUpperCase() === code)) {
      return { tone: 'warn', message: `Battery ${code} is already present in this truck batch.` };
    }
    const existing = fleet.find((b) => b.battery_code.toUpperCase() === code);
    if (existing) {
      if (['in_repair', 'in_progress', 'in_testing', 'repaired'].includes(existing.status)) {
        return { tone: 'bad', message: `Battery ${code} is already in the repair pipeline (${statusLabel(existing.status)}).` };
      }
      if (existing.status === 'unserviceable') return { tone: 'bad', message: `Battery ${code} is marked as unserviceable.` };
    }
    setStaged((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, code, serial: initialSerial || existing?.serial_number || '', issue: '' }]);
    setError(null);
    return { tone: 'good', message: `✓ ${code} staged (${staged.length + 1} selected)` };
  }

  async function submit() {
    if (!batch?.intakeId) return setError('Intake batch ID is required.');
    if (staged.length === 0) return setError('Please scan or select at least one battery.');
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.post(`/clients/me/truck-intakes/${batch.intakeId}/batteries`, {
        batteries: staged.map((b) => ({
          batteryCode: b.code,
          serialNumber: b.serial.trim() || undefined,
          issueDescription: b.issue.trim() || undefined,
        })),
      });
      setSuccess(res.data?.message || 'Batteries added to batch successfully!');
      setStaged([]);
      onChanged?.();
      setTimeout(onClose, 1000);
    } catch (err) {
      setError(errText(err));
    } finally {
      setLoading(false);
    }
  }

  const update = (id, field, val) => setStaged((prev) => prev.map((x) => (x.id === id ? { ...x, [field]: val } : x)));

  return (
    <Sheet
      visible={Boolean(batch)}
      title={`Add Batteries to Truck ${batch?.truckNumber || ''}`}
      description="Scan or choose additional batteries to include in this truck dispatch."
      onClose={onClose}
      footer={
        <View className="flex-row gap-2">
          <Btn label="Cancel" tone="ghost" onPress={onClose} className="flex-1" />
          <Btn label={loading ? 'Saving…' : `Add ${staged.length} Batteries`} onPress={submit} disabled={loading || staged.length === 0} className="flex-1" />
        </View>
      }
    >
      {success ? <Notice tone="good">✓ {success}</Notice> : null}
      {error ? <Notice tone="bad">{error}</Notice> : null}
      <View className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-bold text-slate-900 dark:text-white">Scan or Pick Batteries</Text>
          <Badge tone="info">{staged.length} selected</Badge>
        </View>
        <Text className="mb-3 mt-1 text-[11px] text-slate-500">Type or scan a battery code to add to Truck {batch?.truckNumber || 'Batch'}.</Text>
        <ScanBatteryInput onSubmit={stage} placeholder="Scan, type code or pick from suggestions…" />
        {showSuggestions ? (
          <View className="mt-3 rounded-xl border border-slate-200 dark:border-slate-800">
            <View className="flex-row items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-800">
              <Text className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Available Registered Batteries ({suggestions.length})</Text>
              <TouchableOpacity onPress={() => setShowSuggestions(false)} hitSlop={8}>
                <Text className="text-[11px] font-bold text-slate-500">Hide</Text>
              </TouchableOpacity>
            </View>
            {suggestions.length === 0 ? (
              <Text className="p-3 text-center text-[11px] text-slate-400">No other registered batteries available.</Text>
            ) : (
              suggestions.map((b) => (
                <TouchableOpacity
                  key={b.id || b.battery_code}
                  onPress={() => {
                    const res = stage(b.battery_code, b.serial_number);
                    if (res && res.tone !== 'good') setError(res.message);
                  }}
                  className="flex-row items-center justify-between border-b border-slate-100 px-3 py-2.5 dark:border-slate-800"
                >
                  <Text className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    {b.battery_code}
                    {b.serial_number ? <Text className="font-normal text-slate-500"> ({b.serial_number})</Text> : null}
                  </Text>
                  <Text className="text-[11px] font-bold text-emerald-700">+ Add</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        ) : (
          <TouchableOpacity onPress={() => setShowSuggestions(true)} className="mt-2 self-start">
            <Text className="text-[11px] font-bold text-blue-700">Show registered batteries</Text>
          </TouchableOpacity>
        )}
      </View>
      {staged.map((b, idx) => (
        <View key={b.id} className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-bold text-slate-900 dark:text-white">
              <Text className="text-slate-400">{idx + 1}. </Text>
              {b.code}
            </Text>
            <TouchableOpacity onPress={() => setStaged((prev) => prev.filter((x) => x.id !== b.id))} hitSlop={8}>
              <Text className="text-sm font-bold text-red-500">✕</Text>
            </TouchableOpacity>
          </View>
          <View className="mt-1.5 flex-row gap-2">
            <TextInput value={b.serial} onChangeText={(t) => update(b.id, 'serial', t)} placeholder="Serial (optional)" placeholderTextColor="#94a3b8" className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
            <TextInput value={b.issue} onChangeText={(t) => update(b.id, 'issue', t)} placeholder="Defect reason (optional)" placeholderTextColor="#94a3b8" className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
          </View>
        </View>
      ))}
    </Sheet>
  );
}

export function EditBatteryModal({ battery, onClose, onChanged }) {
  const [serial, setSerial] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setSerial(battery?.serial_number || '');
    setNotes(battery?.notes || '');
    setError(null);
  }, [battery]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await apiClient.patch(`/clients/me/batteries/${battery.id}`, { serialNumber: serial.trim() || null, notes: notes.trim() || null });
      onChanged?.();
      onClose();
    } catch (err) {
      setError(errText(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      visible={Boolean(battery)}
      title={`Edit Battery — ${battery?.battery_code || ''}`}
      description="Update the physical serial number or fault/defect notes for this battery."
      onClose={onClose}
    >
      {error ? <View className="mt-3"><Notice tone="bad">{error}</Notice></View> : null}
      <Text className="mb-1.5 mt-4 text-xs font-semibold text-slate-700 dark:text-slate-200">Physical Battery Number (Manufacturer Serial)</Text>
      <TextInput value={serial} onChangeText={setSerial} placeholder="e.g. SN-88213" placeholderTextColor="#94a3b8" autoCorrect={false} className={inputClass} />
      <Text className="mb-1.5 mt-3 text-xs font-semibold text-slate-700 dark:text-slate-200">Defect / Fault Notes</Text>
      <TextInput value={notes} onChangeText={setNotes} multiline placeholder="e.g. BMS error code E04, water ingress, degraded range…" placeholderTextColor="#94a3b8" className={`${inputClass} min-h-[80px]`} style={{ textAlignVertical: 'top' }} />
      <Text className="mt-1 text-[11px] text-slate-400">These notes are forwarded to the repair technicians at the workshop.</Text>
      <View className="mt-4 flex-row gap-2">
        <Btn label="Cancel" tone="ghost" onPress={onClose} className="flex-1" />
        <Btn label={saving ? 'Saving…' : 'Save Battery'} onPress={save} disabled={saving} className="flex-1" />
      </View>
    </Dialog>
  );
}

// confirm: { title, description, body, keepLabel, goLabel, busyLabel, run: async () => {} }
export function ConfirmDialog({ confirm, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => setError(null), [confirm]);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      await confirm.run();
      onClose();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog visible={Boolean(confirm)} title={confirm?.title} description={confirm?.description} onClose={onClose}>
      {error ? <View className="mt-3"><Notice tone="bad">{error}</Notice></View> : null}
      {confirm?.body ? <Text className="mt-3 text-xs leading-5 text-slate-600 dark:text-slate-300">{confirm.body}</Text> : null}
      <View className="mt-5 flex-row gap-2">
        <Btn label={confirm?.keepLabel || 'Cancel'} tone="ghost" onPress={onClose} className="flex-1" />
        <Btn label={busy ? confirm?.busyLabel || 'Working…' : confirm?.goLabel || 'Confirm'} tone="danger" onPress={go} disabled={busy} className="flex-1" />
      </View>
    </Dialog>
  );
}
