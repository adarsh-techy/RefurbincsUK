import { useEffect, useMemo, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import apiClient from '../../../services/api-client';
import ScanBatteryInput from '../../scan/ScanBatteryInput';
import { resolveBatteryInput, UNASSIGNED_TAG_MESSAGE, scanThen } from '../../../utils/scan-input';
import { Badge, statusLabel } from '../../ui/Badge';
import Icon from '../../ui/Icon';
import {
  Btn,
  ClientStatusBadge,
  Dialog,
  FieldLabel,
  NOT_RETURNABLE_STATUSES,
  Notice,
  Sheet,
  capitalizeFirst,
  hasBeenServiced,
  inputClass,
  normalizeTruck,
} from './common';

// Packed → "+ Add Intake" — the web "Add Truck Intake" modal: truck + driver
// first, then scan / type / pick batteries (suggestions from the fleet, or
// "Pick from Sort" to take a Battery Sorting group), a defect note per
// battery, and "Record Intake (N Batteries)" → POST
// /clients/me/batteries/pack-to-repair. Ends on the same success summary.

export default function AddIntakeModal({ visible, fleet = [], onClose, onRecorded }) {
  const [truckNumber, setTruckNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [items, setItems] = useState([]); // { id, code, serial, issue }
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [error, setError] = useState(null);
  const [packing, setPacking] = useState(false);
  const [success, setSuccess] = useState(null);

  // Pick from Sort
  const [pickOpen, setPickOpen] = useState(false);
  const [pickStep, setPickStep] = useState('groups');
  const [sortGroups, setSortGroups] = useState([]);
  const [sortLoadError, setSortLoadError] = useState(null);
  const [pickGroup, setPickGroup] = useState(null);
  const [pickSelected, setPickSelected] = useState(new Set());
  const [pickedGroupIds, setPickedGroupIds] = useState(new Set());

  useEffect(() => {
    if (!visible) return;
    setTruckNumber('');
    setDriverName('');
    setItems([]);
    setError(null);
    setShowSuggestions(true);
    setPickedGroupIds(new Set());
  }, [visible]);

  const ready = Boolean(truckNumber.trim() && driverName.trim());
  const addedCodes = useMemo(() => new Set(items.map((b) => b.code.toUpperCase())), [items]);

  const suggestions = useMemo(
    () => fleet
      .filter((b) => !addedCodes.has(b.battery_code.toUpperCase()))
      .filter((b) => !NOT_RETURNABLE_STATUSES.has(b.status))
      .slice(0, 8),
    [fleet, addedCodes]
  );

  // same checks as the web handleAddBattery; returns a scan result
  function addBattery(raw, initialSerial = '', list = items) {
    if (!truckNumber.trim() || !driverName.trim()) {
      const message = 'Please enter Truck Number and Driver Name first.';
      setError(message);
      return { tone: 'warn', message };
    }
    const resolved = resolveBatteryInput(raw, fleet);
    if (resolved.unassignedTag) return { tone: 'bad', message: `${UNASSIGNED_TAG_MESSAGE} (tag ${resolved.code})` };
    const code = (resolved.code || '').toUpperCase();
    if (!code) return undefined;
    if (list.some((b) => b.code.toUpperCase() === code)) {
      return { tone: 'warn', message: `Battery ${code} has already been added to this intake list.` };
    }
    const existing = fleet.find((b) => b.battery_code.toUpperCase() === code);
    if (existing) {
      // already on THIS still-open truck — the client is just continuing it
      const sameOpenTruck =
        existing.status === 'in_repair' &&
        existing.intake_status === 'pending_arrival' &&
        existing.truck_number &&
        normalizeTruck(existing.truck_number) === normalizeTruck(truckNumber);
      if (!sameOpenTruck) {
        if (['in_repair', 'in_progress', 'in_testing', 'repaired'].includes(existing.status)) {
          return { tone: 'bad', message: `Battery ${code} is already in the repair pipeline (${statusLabel(existing.status)}).` };
        }
        if (existing.status === 'unserviceable') {
          return { tone: 'bad', message: `Battery ${code} has been marked as unserviceable.` };
        }
      }
    }
    const item = { id: `${Date.now()}-${Math.random()}`, code, serial: initialSerial || existing?.serial_number || '', issue: '' };
    list.push(item);
    setItems([...list]);
    setError(null);
    return { tone: 'good', message: `✓ ${code} added (${list.length} on this truck)` };
  }

  const scanAdd = (raw) => scanThen(raw, fleet, (code) => addBattery(code, '', [...items]));

  function pickSuggestion(b) {
    const res = addBattery(b.battery_code, b.serial_number, [...items]);
    if (res?.tone !== 'good') setError(res?.message || null);
  }

  // ── Pick from Sort ───────────────────────────────────────────────────
  function isAlreadyPacked(code) {
    if (addedCodes.has(code.toUpperCase())) return true;
    const match = fleet.find((b) => b.battery_code.toUpperCase() === code.toUpperCase());
    return match ? NOT_RETURNABLE_STATUSES.has(match.status) : false;
  }

  function openPickFromSort() {
    if (!ready) {
      setError('Please enter Truck Number and Driver Name first.');
      return;
    }
    setSortGroups([]);
    setSortLoadError(null);
    apiClient
      .get('/clients/me/sort-groups')
      .then(({ data }) => setSortGroups(data?.data || []))
      .catch((err) => setSortLoadError(err.response?.data?.message || err.message));
    setPickStep('groups');
    setPickGroup(null);
    setPickOpen(true);
  }

  const availableGroups = sortGroups.filter((g) => {
    if (pickedGroupIds.has(g.id)) return false;
    const bats = g.batteries || [];
    return bats.length > 0 && bats.some((c) => !isAlreadyPacked(c));
  });
  const pickAvailable = pickGroup ? (pickGroup.batteries || []).filter((c) => !isAlreadyPacked(c)) : [];

  function reviewGroup(group) {
    setPickGroup(group);
    setPickSelected(new Set((group.batteries || []).filter((c) => !isAlreadyPacked(c))));
    setPickStep('review');
  }

  function confirmPick() {
    const list = [...items];
    const refused = [];
    pickSelected.forEach((code) => {
      const res = addBattery(code, '', list);
      if (res && res.tone !== 'good') refused.push(res.message);
    });
    if (refused.length) setError(refused.join('\n'));
    if (pickGroup?.id) setPickedGroupIds((prev) => new Set([...prev, pickGroup.id]));
    setPickOpen(false);
    setPickGroup(null);
  }

  // ── Record ───────────────────────────────────────────────────────────
  async function submit() {
    if (!truckNumber.trim()) return setError('Truck Number is required.');
    if (!driverName.trim()) return setError('Driver Name is required.');
    if (items.length === 0) return setError('Please scan or add at least one battery to intake.');
    setPacking(true);
    setError(null);
    try {
      const res = await apiClient.post('/clients/me/batteries/pack-to-repair', {
        truckNumber: truckNumber.trim(),
        driverName: driverName.trim(),
        batteries: items.map((b) => ({
          batteryCode: b.code,
          serialNumber: b.serial.trim() || undefined,
          issueDescription: b.issue.trim() || undefined,
        })),
      });
      setSuccess({
        intake: res.data?.intake,
        count: items.length,
        truckNumber: truckNumber.trim() || 'N/A',
        driverName: driverName.trim() || 'Fleet Driver',
      });
      onRecorded?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setPacking(false);
    }
  }

  return (
    <>
      <Sheet
        visible={visible}
        title="Add Truck Intake"
        description="Record a truck delivering or packing batteries for workshop repair."
        onClose={onClose}
        footer={
          <View>
            <Text className={`mb-2 text-center text-[11px] font-semibold ${items.length ? 'text-emerald-700' : 'text-slate-500'}`}>
              {items.length > 0 ? `${items.length} batteries staged for intake` : 'Scan or pick batteries to add them'}
            </Text>
            <View className="flex-row gap-2">
              <Btn label="Cancel" tone="ghost" onPress={onClose} className="flex-1" />
              <Btn
                label={packing ? 'Recording Intake…' : `✓ Record Intake (${items.length} Batteries)`}
                onPress={submit}
                disabled={packing || items.length === 0}
                className="flex-[2]"
              />
            </View>
          </View>
        }
      >
        {error ? <Notice tone="bad">{error}</Notice> : null}

        <View>
          <FieldLabel required>Truck Number</FieldLabel>
          <TextInput value={truckNumber} onChangeText={(t) => setTruckNumber(t.toUpperCase())} placeholder="e.g. GB21 XYZ or LD68 FGH" placeholderTextColor="#94a3b8" autoCapitalize="characters" autoCorrect={false} className={inputClass} />
        </View>
        <View>
          <FieldLabel required>Driver Name</FieldLabel>
          <TextInput value={driverName} onChangeText={(t) => setDriverName(capitalizeFirst(t))} placeholder="e.g. George Davies" placeholderTextColor="#94a3b8" className={inputClass} />
        </View>

        <View className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-bold text-slate-900 dark:text-white">Scan Batteries (returning)</Text>
            <Badge tone="info">{items.length} scanned</Badge>
          </View>
          <Text className="mt-1 text-[11px] text-slate-500">
            For batteries being packed or intaked for repair. Scan with the RFID reader or camera, type a code — or select from your registered battery list.
          </Text>
          {!ready && (
            <View className="mt-2 flex-row items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5">
              <Icon name="alertTriangle" color="#b45309" size={14} />
              <Text className="flex-1 text-[11px] font-semibold text-amber-800">
                Please enter Truck Number &amp; Driver Name above first to type battery number, scan, or pick from sort.
              </Text>
            </View>
          )}
          <View className="mt-3">
            <ScanBatteryInput
              onSubmit={scanAdd}
              disabled={!ready}
              placeholder={ready ? 'Scan, type code or pick from suggestions…' : 'Enter Truck Number & Driver Name above first…'}
            />
          </View>
          <TouchableOpacity
            disabled={!ready}
            onPress={openPickFromSort}
            className={`mt-2 items-center rounded-xl border border-violet-300 bg-violet-50 py-2.5 ${!ready ? 'opacity-50' : ''}`}
          >
            <Text className="text-xs font-bold text-violet-700">Pick from Sort</Text>
          </TouchableOpacity>

          {ready && (
            showSuggestions ? (
              <View className="mt-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <View className="flex-row items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-800">
                  <Text className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Available Registered Batteries ({suggestions.length})</Text>
                  <TouchableOpacity onPress={() => setShowSuggestions(false)} hitSlop={8}>
                    <Text className="text-[11px] font-bold text-slate-500">Hide</Text>
                  </TouchableOpacity>
                </View>
                {suggestions.length === 0 ? (
                  <Text className="p-3 text-center text-[11px] text-slate-400">No eligible batteries found in your returned fleet.</Text>
                ) : (
                  suggestions.map((b) => (
                    <TouchableOpacity key={b.id || b.battery_code} onPress={() => pickSuggestion(b)} className="flex-row items-center justify-between border-b border-slate-100 px-3 py-2.5 dark:border-slate-800">
                      <View className="flex-1 flex-row items-center gap-2">
                        <Icon name="battery" color="#64748b" size={14} />
                        <Text className="text-xs font-bold text-slate-800 dark:text-slate-100">{b.battery_code}</Text>
                      </View>
                      <Text className="mr-2 text-[10px] capitalize text-slate-400">{b.status ? statusLabel(b.status) : 'Ready'}</Text>
                      <Text className="text-[11px] font-bold text-emerald-700">+ Add to Intake</Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            ) : (
              <TouchableOpacity onPress={() => setShowSuggestions(true)} className="mt-2 self-start">
                <Text className="text-[11px] font-bold text-blue-700">Show registered batteries</Text>
              </TouchableOpacity>
            )
          )}
        </View>

        <View className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-bold text-slate-900 dark:text-white">Added Batteries</Text>
            <Badge tone="good">{items.length} added</Badge>
          </View>
          {items.length === 0 ? (
            <Text className="mt-3 rounded-xl border border-dashed border-slate-300 p-4 text-center text-[11px] text-slate-400">
              Batteries you add above will appear here.
            </Text>
          ) : (
            items.map((b, idx) => (
              <View key={b.id} className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-950">
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs font-bold text-slate-900 dark:text-white">
                    <Text className="text-slate-400">{idx + 1}. </Text>
                    {b.code}
                  </Text>
                  <TouchableOpacity onPress={() => setItems((prev) => prev.filter((x) => x.id !== b.id))} hitSlop={8}>
                    <Text className="text-sm font-bold text-red-500">✕</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  value={b.issue}
                  onChangeText={(t) => setItems((prev) => prev.map((x) => (x.id === b.id ? { ...x, issue: t } : x)))}
                  placeholder="Defect reason / notes (optional)"
                  placeholderTextColor="#94a3b8"
                  className="mt-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </View>
            ))
          )}
        </View>

        {/* Pick from Sort — sits inside the sheet so it shows above it */}
        <Dialog
          visible={pickOpen}
          title={pickStep === 'groups' ? 'Pick from a Sort Group' : pickGroup?.name || 'Review Batteries'}
          description={
            pickStep === 'groups'
              ? 'Choose a Battery Sorting group, then review which of its batteries to add.'
              : 'Uncheck any battery you don’t want to include, then add the rest to this intake.'
          }
          onClose={() => setPickOpen(false)}
        >
          {pickStep === 'groups' ? (
            <View className="mt-3">
              {sortLoadError ? <Notice tone="bad">{sortLoadError}</Notice> : availableGroups.length === 0 ? (
                <View className="items-center py-4">
                  <Text className="text-sm font-semibold text-slate-700">{sortGroups.length === 0 ? 'No sort groups yet.' : 'All sort groups are already selected or packed.'}</Text>
                  <Text className="mt-1 text-center text-[11px] text-slate-500">
                    {sortGroups.length === 0
                      ? 'Build one on the Battery Sorting page, then pick it from here next time.'
                      : 'There are no remaining unpacked batteries in your sort groups.'}
                  </Text>
                </View>
              ) : (
                <View className="max-h-80 gap-2">
                  {availableGroups.map((g) => {
                    const rem = (g.batteries || []).filter((c) => !isAlreadyPacked(c));
                    return (
                      <TouchableOpacity key={g.id} onPress={() => reviewGroup(g)} className="flex-row items-center justify-between rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                        <View className="flex-1">
                          <Text className="text-sm font-bold text-slate-900 dark:text-white">{g.name}</Text>
                          <Text className="text-[11px] text-slate-500">
                            {rem.length} {rem.length === 1 ? 'battery' : 'batteries'} available
                            {rem.length < (g.batteries || []).length ? ` (${(g.batteries || []).length - rem.length} already packed)` : ''}
                          </Text>
                        </View>
                        <Text className="text-xs font-bold text-blue-700">Review →</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
              <Btn label="Close" tone="ghost" onPress={() => setPickOpen(false)} className="mt-4" />
            </View>
          ) : (
            <View className="mt-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-semibold text-slate-600">{pickSelected.size} of {pickAvailable.length} selected</Text>
                <View className="flex-row gap-3">
                  <TouchableOpacity onPress={() => setPickSelected(new Set(pickAvailable))}><Text className="text-xs font-bold text-blue-700">Select All</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => setPickSelected(new Set())}><Text className="text-xs font-bold text-slate-500">Clear</Text></TouchableOpacity>
                </View>
              </View>
              {pickAvailable.length < (pickGroup?.batteries || []).length && (
                <Text className="mt-1 text-[11px] text-slate-500">
                  {(pickGroup.batteries.length - pickAvailable.length)} already packed{' '}
                  {pickGroup.batteries.length - pickAvailable.length === 1 ? 'battery is' : 'batteries are'} hidden from this group.
                </Text>
              )}
              {pickAvailable.length === 0 ? (
                <Text className="py-4 text-center text-xs text-slate-500">Every battery in this group is already packed.</Text>
              ) : (
                <View className="mt-2 max-h-72">
                  {pickAvailable.map((code) => {
                    const match = fleet.find((b) => b.battery_code.toUpperCase() === code.toUpperCase());
                    const checked = pickSelected.has(code);
                    return (
                      <TouchableOpacity
                        key={code}
                        onPress={() => setPickSelected((prev) => {
                          const next = new Set(prev);
                          if (next.has(code)) next.delete(code);
                          else next.add(code);
                          return next;
                        })}
                        className={`mb-1.5 flex-row items-center justify-between gap-2 rounded-xl border px-3 py-2 ${checked ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'}`}
                      >
                        <View className="flex-row items-center gap-2">
                          <View className={`h-4 w-4 items-center justify-center rounded border ${checked ? 'border-emerald-600 bg-emerald-600' : 'border-slate-400'}`}>
                            {checked ? <Icon name="check" color="#fff" size={10} /> : null}
                          </View>
                          <Text className="font-mono text-xs font-bold text-slate-800">{code}</Text>
                        </View>
                        {match ? (
                          hasBeenServiced(match) ? <ClientStatusBadge row={match} /> : <Badge tone="neutral">Not yet serviced</Badge>
                        ) : (
                          <Badge tone="warning">Not in your fleet</Badge>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
              <View className="mt-4 flex-row gap-2">
                <Btn label="← Back to Groups" tone="ghost" onPress={() => { setPickStep('groups'); setPickGroup(null); }} className="flex-1" />
                <Btn label={`Add ${pickSelected.size > 0 ? `${pickSelected.size} ` : ''}to Intake`} onPress={confirmPick} disabled={pickSelected.size === 0} className="flex-1" />
              </View>
            </View>
          )}
        </Dialog>
      </Sheet>

      {/* Truck Intake Success */}
      <Dialog visible={Boolean(success)} onClose={() => setSuccess(null)}>
        <View className="items-center">
          <View className="h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
            <Icon name="checkCircle" color="#059669" size={28} />
          </View>
          <Text className="mt-3 text-center text-base font-extrabold text-slate-900 dark:text-white">Truck Intake Recorded Successfully!</Text>
          <Text className="mt-1 text-center text-xs text-slate-500">
            Your intake dispatch has been registered. The workshop has been notified and will verify the batteries upon arrival.
          </Text>
        </View>
        {success ? (
          <View className="mt-4 gap-2 rounded-2xl bg-slate-50 p-3 dark:bg-slate-950">
            {[
              ['Truck Number', success.truckNumber || success.intake?.truck_number || 'N/A'],
              ['Driver', success.driverName || success.intake?.driver_name || 'Fleet Driver'],
              ['Batteries Recorded', `${success.count} ${success.count === 1 ? 'pack' : 'packs'}`],
              ['Status', 'Pending Arrival'],
            ].map(([k, v]) => (
              <View key={k} className="flex-row justify-between">
                <Text className="text-[11px] font-semibold uppercase text-slate-500">{k}</Text>
                <Text className={`text-xs font-bold ${k === 'Status' ? 'text-amber-600' : 'text-slate-900 dark:text-white'}`}>{v}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <Btn label="✓ Done" onPress={() => setSuccess(null)} className="mt-4" />
      </Dialog>
    </>
  );
}
