import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import apiClient from '../../../services/api-client';
import ScanBatteryInput from '../../scan/ScanBatteryInput';
import { resolveBatteryInput, UNASSIGNED_TAG_MESSAGE, scanThen } from '../../../utils/scan-input';
import { apiError, Feedback, GhostButton, PrimaryButton, SearchBox } from './ui';

// "Scan to Verify Shipment Arrival" — the phone version of the web
// TruckVerifyModal. Every battery on the truck is scanned (RFID / QR /
// code / serial) or marked by hand; Confirm unlocks only when all are done
// and sends PATCH /truck-intakes/:id/verify-arrival. A battery back for the
// 2nd+ time this month opens the "Repeat Intake Flag" popup. Progress is
// kept per truck while the app runs (the web keeps it in sessionStorage), so
// inspecting a battery and coming back doesn't lose the scans.
//
// props: visible, intakeId, initialData ({ intake, batteries }), onClose(),
// onSuccess(), onInspect(code) — opens a battery's history

const progressCache = new Map(); // intakeId → { codes: [], at: { CODE: ms } }

const monthName = (d = new Date()) => d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
const timeText = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const dateTimeText = (v) => (v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const ordinal = (n) => (n === 2 ? '2nd' : `${n}th`);

export default function TruckVerifyModal({ visible, intakeId, initialData = null, onClose, onSuccess, onInspect }) {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState(null);
  const [codes, setCodes] = useState([]);
  const [scannedAt, setScannedAt] = useState({});
  const [filter, setFilter] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState(null);
  const [repeat, setRepeat] = useState(null);
  const [note, setNote] = useState(null); // feedback for taps (the scan box shows its own)
  const noteTimer = useRef(null);

  const id = intakeId || data?.intake?.id;

  useEffect(() => {
    if (!visible) return;
    const saved = progressCache.get(String(id));
    setCodes(saved?.codes || []);
    setScannedAt(saved?.at || {});
    setFilter('');
    setConfirmError(null);
    if (initialData) {
      setData(initialData);
      setLoading(false);
      return;
    }
    if (!intakeId) return;
    setLoading(true);
    setError(null);
    apiClient
      .get(`/truck-intakes/${intakeId}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, intakeId, initialData]);

  useEffect(() => {
    if (id && codes.length) progressCache.set(String(id), { codes, at: scannedAt });
  }, [id, codes, scannedAt]);

  useEffect(() => () => clearTimeout(noteTimer.current), []);

  function flash(result) {
    if (!result) return;
    clearTimeout(noteTimer.current);
    setNote(result);
    noteTimer.current = setTimeout(() => setNote(null), 3500);
  }

  const intake = data?.intake;
  const batteries = useMemo(() => data?.batteries || [], [data]);
  const expected = useMemo(() => batteries.map((b) => b.battery_code.toUpperCase()), [batteries]);
  const scannedSet = useMemo(() => new Set(codes), [codes]);
  const allScanned = expected.length > 0 && expected.every((c) => scannedSet.has(c));
  const remaining = useMemo(() => batteries.filter((b) => !scannedSet.has(b.battery_code.toUpperCase())), [batteries, scannedSet]);
  const pct = expected.length ? Math.round((scannedSet.size / expected.length) * 100) : 0;

  const suggestions = useMemo(() => {
    const q = filter.trim().toUpperCase();
    if (!q) return remaining.slice(0, 15);
    return remaining
      .filter((b) => (b.battery_code || '').toUpperCase().includes(q) || (b.serial_number || '').toUpperCase().includes(q))
      .slice(0, 10);
  }, [filter, remaining]);

  // 2nd+ arrival this month → popup (checked against the battery's visits)
  async function checkRepeat(match, code) {
    const currentId = Number(id);
    let count = Number(match?.intake_count_this_month) || 0;
    let visits = Array.isArray(match?.visits_this_month) ? [...match.visits_this_month] : [];
    if (count <= 1 || visits.length <= 1) {
      try {
        const res = await apiClient.get(`/batteries/${encodeURIComponent(code)}`);
        const now = new Date();
        const thisMonth = (res.data?.visits || []).filter((v) => {
          const d = new Date(v.intake_at || v.created_at);
          return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        });
        const hasCurrent = thisMonth.some((v) => Number(v.truck_intake_id) === currentId);
        const total = thisMonth.length + (hasCurrent ? 0 : 1);
        if (total > 1) {
          count = total;
          visits = hasCurrent
            ? thisMonth
            : [...thisMonth, { truck_intake_id: currentId, truck_number: intake?.truck_number, driver_name: intake?.driver_name, intake_at: intake?.intake_at || new Date().toISOString(), is_current_intake: true }];
        }
      } catch {
        // keep what the list row already said
      }
    }
    if (count > 1 || visits.length > 1) {
      setRepeat({ battery: match || { battery_code: code }, count: Math.max(count, visits.length), visits });
    }
  }

  function handleScan(raw) {
    const resolved = resolveBatteryInput(raw, batteries);
    if (resolved.unassignedTag) return { tone: 'bad', message: `${UNASSIGNED_TAG_MESSAGE} (tag ${resolved.code})` };
    const rawVal = (resolved.code || '').trim();
    if (!rawVal) return undefined;
    const query = rawVal.toUpperCase();
    const match = batteries.find(
      (b) => b.battery_code.toUpperCase() === query || (b.serial_number && b.serial_number.toUpperCase() === query)
    );
    const code = match ? match.battery_code.toUpperCase() : query;
    if (scannedSet.has(code)) return { tone: 'warn', message: `${code} was already verified.` };
    if (!expected.includes(code)) return { tone: 'bad', message: `"${rawVal}" is not in this truck shipment.` };
    const now = Date.now();
    setCodes((prev) => [...prev, code]);
    setScannedAt((prev) => ({ ...prev, [code]: now }));
    checkRepeat(match, code);
    return {
      tone: 'good',
      message: `✓ ${code}${match?.serial_number ? ` (SN: ${match.serial_number})` : ''} verified at ${timeText(now)}.`,
    };
  }

  function unverify(code) {
    setCodes((prev) => prev.filter((c) => c !== code));
    setScannedAt((prev) => {
      const next = { ...prev };
      delete next[code];
      return next;
    });
    if (codes.length <= 1) progressCache.delete(String(id));
    flash({ tone: 'warn', message: `${code} verification undone.` });
  }

  async function confirm() {
    setConfirming(true);
    setConfirmError(null);
    try {
      const res = await apiClient.patch(`/truck-intakes/${id}/verify-arrival`);
      progressCache.delete(String(id));
      setCodes([]);
      setScannedAt({});
      onSuccess?.(res.data);
      onClose?.();
    } catch (err) {
      setConfirmError(apiError(err));
    } finally {
      setConfirming(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-slate-50">
        <View className="border-b border-slate-200 bg-white px-4 pb-3" style={{ paddingTop: Math.max(48, insets.top + 12) }}>
          <View className="flex-row items-center justify-between gap-3">
            <Text className="flex-1 text-base font-extrabold text-slate-900">Scan to Verify Shipment Arrival</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Text className="text-lg font-bold text-slate-400">✕</Text>
            </TouchableOpacity>
          </View>
          <Text className="mt-0.5 text-xs text-slate-500">
            {intake
              ? `Truck: ${intake.truck_number || '—'} · Driver: ${intake.driver_name || '—'}${intake.client_name ? ` · Client: ${intake.client_name}` : ''}`
              : 'Verifying truck shipment batteries'}
          </Text>
        </View>

        {loading ? (
          <Text className="p-8 text-center text-sm text-slate-500">Loading truck shipment details…</Text>
        ) : error ? (
          <Text className="m-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</Text>
        ) : (
          <ScrollView contentContainerClassName="w-full max-w-2xl self-center p-4 gap-4 pb-8" keyboardShouldPersistTaps="handled">
            {/* metadata + progress */}
            <View className="rounded-2xl border border-slate-200 bg-white p-3.5">
              <View className="flex-row flex-wrap items-center gap-2">
                <Text className="rounded-xl bg-slate-900 px-3 py-1 text-xs font-black text-white">🚚 {intake?.truck_number || 'TRUCK'}</Text>
                {intake?.driver_name ? <Text className="text-xs font-semibold text-slate-600">👤 {intake.driver_name}</Text> : null}
                {intake?.client_name ? (
                  <Text className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700">{intake.client_name}</Text>
                ) : null}
              </View>
              <View className="mt-2.5 flex-row items-center justify-between">
                <Text className={`text-xs font-bold ${remaining.length ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {remaining.length ? `${remaining.length} remaining` : 'All scanned'}
                </Text>
                <Text className="rounded-xl border border-emerald-200 bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">
                  {scannedSet.size} / {expected.length} verified ({pct}%)
                </Text>
              </View>
              <View className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-slate-200">
                <View className="h-2.5 rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
              </View>
            </View>

            {/* scan box */}
            <View>
              <Text className="mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">Scan Barcode / QR or Type Battery ID</Text>
              <ScanBatteryInput onSubmit={(raw) => scanThen(raw, batteries, handleScan)} submitLabel="Verify" placeholder="Scan QR or enter battery ID / serial…" startInRfidMode />
              {note ? <View className="mt-2"><Feedback feedback={note} /></View> : null}
            </View>

            {/* the web's suggestion dropdown */}
            {remaining.length > 0 && (
              <View className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <View className="border-b border-slate-100 bg-slate-50 px-3.5 py-2">
                  <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {filter.trim() ? `Matching Batteries On Truck (${suggestions.length})` : `Unscanned On Truck (${remaining.length})`}
                  </Text>
                  <View className="mt-2">
                    <SearchBox value={filter} onChangeText={setFilter} placeholder="Type to filter by ID or serial…" />
                  </View>
                </View>
                {suggestions.map((b) => (
                  <TouchableOpacity
                    key={b.battery_code}
                    onPress={() => flash(handleScan(b.battery_code))}
                    className="flex-row items-center justify-between border-b border-slate-100 px-3.5 py-2.5"
                  >
                    <View className="flex-1 pr-2">
                      <View className="flex-row flex-wrap items-center gap-2">
                        <Text className="font-mono text-sm font-bold text-slate-900">{b.battery_code}</Text>
                        {Number(b.intake_count_this_month) > 1 ? (
                          <Text className="rounded-md border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-800">↻ {b.intake_count_this_month}x this mo</Text>
                        ) : null}
                      </View>
                      {b.serial_number ? <Text className="mt-0.5 font-mono text-[11px] text-slate-500">SN: {b.serial_number}</Text> : null}
                    </View>
                    <Text className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">+ Verify</Text>
                  </TouchableOpacity>
                ))}
                {suggestions.length === 0 ? <Text className="px-3.5 py-3 text-xs text-slate-400">No unscanned battery matches.</Text> : null}
                {!filter.trim() && remaining.length > suggestions.length ? (
                  <Text className="px-3.5 py-2 text-[11px] text-slate-400">+{remaining.length - suggestions.length} more batteries — type to filter</Text>
                ) : null}
              </View>
            )}

            <View className="rounded-xl border border-slate-200 bg-slate-100/60 p-3.5">
              <Text className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-800">Shipment Verification Protocol</Text>
              <Text className="text-[11px] leading-4 text-slate-500">
                Verify each battery physical code upon offloading the truck. Once all <Text className="font-bold">{expected.length} batteries</Text> are verified, the confirmation button below will unlock.
              </Text>
            </View>

            {/* manifest */}
            <View>
              <View className="mb-2 flex-row items-center justify-between">
                <Text className="text-xs font-bold uppercase tracking-wider text-slate-700">Shipment Manifest ({batteries.length})</Text>
                <Text className="text-[11px] font-bold text-slate-500">{scannedSet.size} of {batteries.length} scanned</Text>
              </View>
              <View className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {batteries.length === 0 ? <Text className="p-6 text-center text-xs text-slate-400">No batteries on this truck.</Text> : null}
                {batteries.map((b, i) => {
                  const code = b.battery_code.toUpperCase();
                  const done = scannedSet.has(code);
                  return (
                    <View key={code} className={`flex-row items-center justify-between px-3.5 py-2.5 ${i ? 'border-t border-slate-100' : ''} ${done ? 'bg-emerald-50/70' : ''}`}>
                      <View className="flex-1 pr-2">
                        <View className="flex-row flex-wrap items-center gap-1.5">
                          <Text className="font-mono text-sm font-bold text-slate-900">{code}</Text>
                          {Number(b.intake_count_this_month) > 1 ? (
                            <Text className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-800">⚠️ {b.intake_count_this_month}x this mo</Text>
                          ) : null}
                        </View>
                        {b.serial_number ? <Text className="font-mono text-[11px] text-slate-500">SN: {b.serial_number}</Text> : null}
                        {scannedAt[code] ? <Text className="text-[10px] font-medium text-emerald-600">Scanned at {timeText(scannedAt[code])}</Text> : null}
                      </View>
                      {done ? (
                        <View className="flex-row items-center gap-1.5">
                          <Text className="rounded-lg bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">✓ Verified</Text>
                          <TouchableOpacity onPress={() => unverify(code)} hitSlop={8} className="rounded-lg px-1.5 py-1">
                            <Text className="text-sm font-bold text-slate-400">✕</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity onPress={() => flash(handleScan(code))} className="rounded-lg border border-slate-300 px-2.5 py-1.5">
                          <Text className="text-[11px] font-bold text-slate-700">Mark Scanned</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          </ScrollView>
        )}

        {!loading && !error ? (
          <View className="gap-3 border-t border-slate-200 bg-white p-4" style={{ paddingBottom: Math.max(32, insets.bottom + 12) }}>
            <Text className={`text-xs ${allScanned ? 'font-bold text-emerald-700' : 'font-medium text-slate-500'}`}>
              {allScanned
                ? `✓ All ${expected.length} batteries verified · Ready to confirm arrival`
                : `🕒 ${remaining.length} of ${expected.length} batteries remaining to scan`}
            </Text>
            {confirmError ? <Text className="text-xs font-semibold text-red-600">{confirmError}</Text> : null}
            <View className="flex-row gap-2.5">
              <GhostButton label="Cancel" onPress={onClose} />
              <View className="flex-1">
                <PrimaryButton
                  tone="emerald"
                  disabled={!allScanned || confirming}
                  onPress={confirm}
                  label={confirming ? 'Confirming Arrival…' : allScanned ? '✓ Confirm Truck Arrived & Verified' : `✓ Scan Remaining (${remaining.length} left)`}
                />
              </View>
            </View>
          </View>
        ) : null}
      </View>

      <RepeatIntakePopup
        data={repeat}
        intake={intake}
        currentId={Number(id)}
        onClose={() => setRepeat(null)}
        onInspect={(code) => {
          setRepeat(null);
          onInspect?.(code);
        }}
      />
    </Modal>
  );
}

function RepeatIntakePopup({ data, intake, currentId, onClose, onInspect }) {
  if (!data) return null;
  const { battery, count, visits = [] } = data;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-center bg-black/50 px-4">
        <ScrollView className="max-h-[88%] w-full max-w-lg self-center rounded-3xl bg-white" contentContainerClassName="p-4 gap-3.5">
          <View className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <View className="flex-row flex-wrap items-center gap-2">
              <Text className="rounded-full border border-amber-300 bg-amber-200 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-950">↻ Repeat Intake Flag</Text>
              <Text className="font-mono text-xs font-bold text-amber-800">{monthName()}</Text>
            </View>
            <Text className="mt-1.5 text-xl font-black tracking-tight text-slate-900">{ordinal(count)} Time Intake in Current Month</Text>
            <Text className="mt-1 text-xs leading-5 text-slate-600">
              Battery <Text className="font-mono font-black text-slate-950">{battery?.battery_code}</Text> has arrived at the workshop facility{' '}
              <Text className="font-bold text-amber-950">{count} times</Text> during <Text className="font-bold">{monthName()}</Text>.
            </Text>
          </View>

          <View className="gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            {[
              ['Battery ID', battery?.battery_code],
              ['Physical Serial Number', battery?.serial_number || '—'],
              ['Fleet Client', battery?.client_name || intake?.client_name || 'Fleet Client'],
            ].map(([label, value]) => (
              <View key={label} className="rounded-xl border border-slate-100 bg-white p-2.5">
                <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</Text>
                <Text className="mt-0.5 font-mono text-sm font-bold text-slate-900">{value}</Text>
              </View>
            ))}
          </View>

          <View className="gap-2">
            <Text className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Intake Trips Recorded in {monthName()} ({visits.length || count})
            </Text>
            {visits.map((v, idx) => {
              const isCurrent = Number(v.truck_intake_id) === currentId || v.is_current_intake;
              return (
                <View key={v.visit_id || v.truck_intake_id || idx} className={`rounded-xl border p-3 ${isCurrent ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                  <View className="flex-row flex-wrap items-center justify-between gap-2">
                    <View className="flex-row items-center gap-2">
                      <Text className={`rounded-md px-2 py-0.5 text-[10px] font-black ${isCurrent ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                        Trip #{idx + 1} {isCurrent ? '(Current)' : '(Previous)'}
                      </Text>
                      <Text className="text-xs font-bold text-slate-800">Truck {v.truck_number || '—'}</Text>
                    </View>
                    <Text className="font-mono text-[11px] text-slate-500">{dateTimeText(v.intake_at || v.created_at)}</Text>
                  </View>
                  <View className="mt-2 flex-row items-center justify-between">
                    <Text className="text-[11px] text-slate-600">Driver: <Text className="font-bold text-slate-800">{v.driver_name || '—'}</Text></Text>
                    <Text className={`text-[11px] font-bold ${isCurrent ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {isCurrent ? '✓ Verified on Arrival' : 'Previous workshop cycle'}
                    </Text>
                  </View>
                </View>
              );
            })}
            {visits.length === 0 ? (
              <Text className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
                This battery has <Text className="font-bold">{count} recorded intakes</Text> in {monthName()}. Please inspect previous service history to check if the battery experiences recurring faults.
              </Text>
            ) : null}
          </View>

          <View className="rounded-2xl border border-blue-200 bg-blue-50 p-3.5">
            <Text className="text-xs leading-5 text-blue-900">
              <Text className="font-bold">Workshop Advisory:</Text> Repeat intakes within the same month may indicate recurring cell imbalances, intermittent BMS communication errors, or rapid fleet rotation. Thorough diagnostic capacity testing is recommended.
            </Text>
          </View>

          <View className="gap-2">
            <GhostButton label="Inspect Full Battery History ↗" tone="blue" onPress={() => onInspect(battery?.battery_code)} />
            <PrimaryButton label="Acknowledge & Continue Scanning" tone="slate" onPress={onClose} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
