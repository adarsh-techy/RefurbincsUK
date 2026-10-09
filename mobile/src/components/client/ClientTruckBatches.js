import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../../services/api-client';
import extractBatteryCode from '../../utils/extract-battery-code';
import { Badge, StatusBadge } from '../ui/Badge';
import Icon from '../ui/Icon';

// Truck-batch view for the client's Packed and Received buckets — the same
// grouping and actions as the web ClientBatteriesPage:
//   packed    one card per truck intake the client packed (plus an
//             "awaiting pickup" group for batteries packed without a truck);
//             until the workshop verifies arrival the client can edit the
//             truck/driver, add or remove batteries, or cancel the batch.
//   received  one card per return dispatch; the client confirms receipt
//             (PATCH /returns/:id/verify-receipt) and can rate the service
//             (POST /ratings, one per battery, same payload as the web
//             RatingModal).
// `rows` are the bucket rows from GET /clients/me/batteries; `onChanged`
// re-fetches them after any write.

const PRESET_FEEDBACK_OPTIONS = [
  '⚡ Fast & On-Time Turnaround',
  '🔋 Battery Health & Range Fully Restored',
  '🔧 Technical Fault Completely Resolved',
  '📦 Secure & High-Quality Workshop Packaging',
  '🚚 Smooth Delivery & Return Dispatch',
  '✨ Exceptional Refurbishment Workmanship',
  '💬 Transparent & Prompt Communication',
  '🛡️ Comprehensive Safety & BMS Calibration',
  '📊 Accurate Testing & Diagnostic Accuracy',
  '🌱 High Environmental & Eco-Impact Standards',
];

const when = (v) => (v ? new Date(v).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

// Same grouping as the web page's rawBatches
export function groupBatches(rows, bucket) {
  const isReceived = bucket === 'received';
  const map = new Map();
  for (const item of rows || []) {
    const key = isReceived
      ? item.return_id ? `return_${item.return_id}` : item.return_truck ? `return_trk_${item.return_truck}` : 'returned_batch'
      : item.intake_id ? `truck_${item.intake_id}` : item.truck_number ? `truck_num_${item.truck_number}` : 'awaiting_pickup';
    if (!map.has(key)) {
      map.set(key, {
        key,
        intakeId: isReceived ? item.return_id : item.intake_id || item.truck_intake_id || null,
        returnId: item.return_id || null,
        truckNumber: isReceived ? item.return_truck || 'Return Dispatch' : item.truck_number || null,
        driverName: isReceived ? item.return_driver || 'Workshop Driver' : item.driver_name || null,
        at: isReceived ? item.return_date || item.last_repaired_at || item.created_at : item.intake_at || item.created_at,
        status: isReceived ? item.return_status || 'verified' : item.intake_status || 'pending_arrival',
        verifiedAt: isReceived ? item.return_verified_at || null : item.verified_at || null,
        isAwaitingPickup: !isReceived && !item.truck_number && !item.intake_id && !item.truck_intake_id,
        batteries: [],
      });
    }
    const g = map.get(key);
    if (!g.batteries.some((b) => b.id === item.id)) g.batteries.push(item);
  }
  return Array.from(map.values()).sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
}

function batchVerified(b) {
  return b.status === 'verified' || Boolean(b.verifiedAt);
}

function PackedRowStatus({ row, verified }) {
  if (!verified) return <Badge tone="warning">Waiting for verify</Badge>;
  if (row.status === 'in_repair') return <Badge tone="warning">Waiting for service</Badge>;
  return <StatusBadge status={row.status} />;
}

export default function ClientTruckBatches({ bucket, rows, onChanged }) {
  const navigation = useNavigation();
  const isReceived = bucket === 'received';
  const batches = useMemo(() => groupBatches(rows, bucket), [rows, bucket]);
  const [selectedKey, setSelectedKey] = useState(null);
  const selected = batches.find((b) => b.key === selectedKey) || null;
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  // edit batch modal
  const [editOpen, setEditOpen] = useState(false);
  const [editTruck, setEditTruck] = useState('');
  const [editDriver, setEditDriver] = useState('');
  // add batteries modal
  const [addOpen, setAddOpen] = useState(false);
  const [addCodes, setAddCodes] = useState('');
  // rating modal
  const [rateOpen, setRateOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState([]);
  const [feedback, setFeedback] = useState('');
  const [ratedReturns, setRatedReturns] = useState(new Set());

  useEffect(() => {
    if (!isReceived) return;
    apiClient.get('/ratings/my')
      .then(({ data }) => setRatedReturns(new Set((data?.data || []).map((r) => String(r.return_id)).filter((v) => v && v !== 'null'))))
      .catch(() => {});
  }, [isReceived, rows]);

  async function run(label, fn, { closeDetail } = {}) {
    setBusy(true);
    setNotice(null);
    try {
      const msg = await fn();
      setNotice({ ok: true, text: msg || `${label} done.` });
      if (closeDetail) setSelectedKey(null);
      await onChanged?.();
    } catch (err) {
      setNotice({ ok: false, text: err.response?.data?.message || err.message });
    } finally {
      setBusy(false);
    }
  }

  function confirm(title, message, onYes, destructive) {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: destructive ? 'Yes, do it' : 'Confirm', style: destructive ? 'destructive' : 'default', onPress: onYes },
    ]);
  }

  // ── actions ──────────────────────────────────────────────────────────
  const saveEdit = () => run('Batch update', async () => {
    if (!editTruck.trim()) throw new Error('Truck number is required.');
    await apiClient.patch(`/clients/me/truck-intakes/${selected.intakeId}`, { truckNumber: editTruck.trim(), driverName: editDriver.trim() || undefined });
    setEditOpen(false);
    return 'Truck batch details saved.';
  });

  const addBatteries = () => run('Add batteries', async () => {
    const codes = addCodes.split(/[\s,]+/).map((c) => extractBatteryCode(c)).filter(Boolean);
    if (codes.length === 0) throw new Error('Enter at least one battery code.');
    const existing = new Set(selected.batteries.map((b) => (b.battery_code || '').toUpperCase()));
    const fresh = codes.filter((c) => !existing.has(c.toUpperCase()));
    if (fresh.length === 0) throw new Error('Those batteries are already in this batch.');
    if (selected.intakeId) {
      const { data } = await apiClient.post(`/clients/me/truck-intakes/${selected.intakeId}/batteries`, { batteries: fresh.map((code) => ({ code })) });
      setAddOpen(false);
      setAddCodes('');
      return data?.message || `${fresh.length} batteries added.`;
    }
    await apiClient.post('/clients/me/batteries/pack-to-repair', { batteries: fresh.map((code) => ({ code })) });
    setAddOpen(false);
    setAddCodes('');
    return `${fresh.length} batteries packed.`;
  });

  const removeBattery = (row) => confirm('Remove battery?', `${row.battery_code} will be taken off this truck and returned to your fleet list.`, () =>
    run('Remove', async () => {
      await apiClient.delete(`/clients/me/truck-intakes/${selected.intakeId || 'awaiting_pickup'}/batteries/${row.id}`);
      return `${row.battery_code} removed from the batch.`;
    }), true);

  const cancelBatch = () => confirm('Cancel this truck batch?', 'All its batteries go back to your fleet list. This cannot be undone.', () =>
    run('Cancel batch', async () => {
      const { data } = await apiClient.delete(`/clients/me/truck-intakes/${selected.intakeId}`);
      return data?.message || 'Batch cancelled.';
    }, { closeDetail: true }), true);

  const verifyReceipt = () => confirm('Confirm receipt?', `Confirm that ${selected.batteries.length} batter${selected.batteries.length === 1 ? 'y' : 'ies'} on ${selected.truckNumber} arrived back with you.`, () =>
    run('Receipt confirmation', async () => {
      const { data } = await apiClient.patch(`/returns/${selected.returnId || selected.intakeId}/verify-receipt`);
      return data?.message || 'Receipt confirmed. Thank you.';
    }));

  const submitRating = () => run('Rating', async () => {
    if (!rating) throw new Error('Pick a star rating first.');
    const returnId = selected.returnId || selected.intakeId || null;
    for (const b of selected.batteries) {
      await apiClient.post('/ratings', { batteryCode: b.battery_code, returnId, rating, presetTags: tags, customFeedback: feedback.trim() || undefined });
    }
    setRateOpen(false);
    setRating(0);
    setTags([]);
    setFeedback('');
    return 'Thanks for rating this return.';
  });

  // ── list view ────────────────────────────────────────────────────────
  if (!selected) {
    return (
      <ScrollView className="flex-1" contentContainerClassName="p-4 gap-2.5 pb-16">
        {notice && (
          <View className={`rounded-2xl border p-3 ${notice.ok ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
            <Text className={`text-xs font-semibold ${notice.ok ? 'text-emerald-700' : 'text-red-700'}`}>{notice.text}</Text>
          </View>
        )}
        {batches.length === 0 ? (
          <View className="items-center rounded-2xl border border-slate-200 bg-white p-8">
            <Icon name="truck" color="#94a3b8" size={24} />
            <Text className="mt-2 text-sm font-semibold text-slate-800">{isReceived ? 'No return dispatches yet' : 'No truck batches packed yet'}</Text>
            <Text className="mt-0.5 text-center text-xs text-slate-400">
              {isReceived ? 'Batteries sent back by the workshop will appear here by truck.' : 'Use "Pack Batteries for Repair" to start a truck batch.'}
            </Text>
          </View>
        ) : (
          batches.map((b) => {
            const verified = batchVerified(b);
            return (
              <TouchableOpacity key={b.key} onPress={() => { setNotice(null); setSelectedKey(b.key); }} className={`rounded-2xl border bg-white p-4 ${verified ? 'border-slate-200' : 'border-amber-300'}`}>
                <View className="flex-row items-start justify-between gap-2">
                  <View className="flex-1">
                    <Text className="text-base font-extrabold text-slate-900">
                      {b.isAwaitingPickup ? 'Packed · awaiting truck' : `Truck ${b.truckNumber}`}
                    </Text>
                    <Text className="text-xs text-slate-600">{b.driverName ? `Driver: ${b.driverName}` : 'No driver yet'} · {when(b.at)}</Text>
                  </View>
                  {isReceived ? (
                    <Badge tone={verified ? 'good' : 'warning'}>{verified ? 'Receipt confirmed' : 'Confirm receipt'}</Badge>
                  ) : (
                    <Badge tone={verified ? 'good' : 'warning'}>{verified ? 'At workshop' : 'Pending arrival'}</Badge>
                  )}
                </View>
                <View className="mt-3 flex-row items-center justify-between">
                  <Text className="text-xs font-semibold text-slate-500">{b.batteries.length} batter{b.batteries.length === 1 ? 'y' : 'ies'}</Text>
                  <Text className="text-xs font-bold text-blue-700">View details ›</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    );
  }

  // ── detail view ──────────────────────────────────────────────────────
  const verified = batchVerified(selected);
  const canEdit = !isReceived && !verified;
  const rated = ratedReturns.has(String(selected.returnId || selected.intakeId));

  return (
    <ScrollView className="flex-1" contentContainerClassName="p-4 gap-3 pb-16">
      <TouchableOpacity onPress={() => { setSelectedKey(null); setNotice(null); }} className="flex-row items-center gap-1">
        <Icon name="arrowLeft" color="#2563eb" size={16} />
        <Text className="text-sm font-bold text-blue-700">All {isReceived ? 'return dispatches' : 'truck batches'}</Text>
      </TouchableOpacity>

      <View className="rounded-3xl border border-slate-200 bg-white p-4">
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1">
            <Text className="text-lg font-extrabold text-slate-900">{selected.isAwaitingPickup ? 'Packed · awaiting truck' : `Truck ${selected.truckNumber}`}</Text>
            <Text className="text-xs text-slate-600">{selected.driverName ? `Driver: ${selected.driverName}` : 'No driver yet'}</Text>
            <Text className="text-[11px] text-slate-400">{isReceived ? 'Dispatched' : 'Packed'} {when(selected.at)}{selected.verifiedAt ? ` · ${isReceived ? 'confirmed' : 'verified'} ${when(selected.verifiedAt)}` : ''}</Text>
          </View>
          {isReceived ? (
            <Badge tone={verified ? 'good' : 'warning'}>{verified ? 'Receipt confirmed' : 'Awaiting confirmation'}</Badge>
          ) : (
            <Badge tone={verified ? 'good' : 'warning'}>{verified ? 'Verified at workshop' : 'Pending arrival'}</Badge>
          )}
        </View>

        <View className="mt-3 flex-row flex-wrap gap-2">
          {canEdit && selected.intakeId && (
            <TouchableOpacity disabled={busy} onPress={() => { setEditTruck(selected.truckNumber || ''); setEditDriver(selected.driverName || ''); setEditOpen(true); }} className="rounded-xl bg-slate-800 px-3 py-2">
              <Text className="text-xs font-bold text-white">Edit truck</Text>
            </TouchableOpacity>
          )}
          {canEdit && (
            <TouchableOpacity disabled={busy} onPress={() => setAddOpen(true)} className="rounded-xl bg-blue-600 px-3 py-2">
              <Text className="text-xs font-bold text-white">+ Add batteries</Text>
            </TouchableOpacity>
          )}
          {canEdit && selected.intakeId && (
            <TouchableOpacity disabled={busy} onPress={cancelBatch} className="rounded-xl bg-red-600 px-3 py-2">
              <Text className="text-xs font-bold text-white">Cancel batch</Text>
            </TouchableOpacity>
          )}
          {isReceived && !verified && (
            <TouchableOpacity disabled={busy} onPress={verifyReceipt} className="rounded-xl bg-emerald-600 px-3 py-2">
              <Text className="text-xs font-bold text-white">Confirm receipt</Text>
            </TouchableOpacity>
          )}
          {isReceived && (
            rated ? (
              <View className="rounded-xl bg-slate-100 px-3 py-2"><Text className="text-xs font-bold text-slate-500">★ Rated</Text></View>
            ) : (
              <TouchableOpacity disabled={busy} onPress={() => setRateOpen(true)} className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2">
                <Text className="text-xs font-bold text-amber-800">★ Rate this return</Text>
              </TouchableOpacity>
            )
          )}
        </View>
        {!isReceived && !verified && (
          <Text className="mt-2 text-[11px] text-amber-700">You can change this batch until the workshop verifies the truck's arrival.</Text>
        )}
      </View>

      {notice && (
        <View className={`rounded-2xl border p-3 ${notice.ok ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
          <Text className={`text-xs font-semibold ${notice.ok ? 'text-emerald-700' : 'text-red-700'}`}>{notice.text}</Text>
        </View>
      )}

      <Text className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{selected.batteries.length} batteries on this truck</Text>
      {selected.batteries.map((row) => (
        <View key={`${row.id}-${row.intake_id ?? row.return_id ?? 'x'}`} className="rounded-2xl border border-slate-200 bg-white p-3.5">
          <View className="flex-row items-center justify-between gap-2">
            <TouchableOpacity onPress={() => navigation.navigate('BatteryDetail', { code: row.battery_code, fromScan: false })} className="flex-1">
              <Text className="text-sm font-extrabold text-blue-700">{row.battery_code}</Text>
              <Text className="text-[11px] text-slate-500">{row.serial_number ? `SN ${row.serial_number}` : 'No serial number'}</Text>
            </TouchableOpacity>
            {isReceived ? <StatusBadge status={row.status} /> : <PackedRowStatus row={row} verified={verified} />}
          </View>
          {row.notes ? <Text className="mt-1.5 text-[11px] text-slate-500" numberOfLines={2}>{row.notes}</Text> : null}
          {canEdit && (
            <TouchableOpacity disabled={busy} onPress={() => removeBattery(row)} className="mt-2 self-end rounded-lg border border-red-200 bg-red-50 px-2.5 py-1">
              <Text className="text-[11px] font-bold text-red-700">Remove</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      {/* Edit truck modal */}
      <Modal visible={editOpen} transparent animationType="fade" onRequestClose={() => setEditOpen(false)}>
        <View className="flex-1 items-center justify-center bg-black/60 px-6">
          <View className="w-full rounded-3xl bg-white p-5">
            <Text className="text-base font-extrabold text-slate-900">Edit truck batch</Text>
            <Text className="mt-3 text-xs font-semibold text-slate-600">Truck number *</Text>
            <TextInput value={editTruck} onChangeText={setEditTruck} autoCapitalize="characters" className="mt-1 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900" />
            <Text className="mt-3 text-xs font-semibold text-slate-600">Driver name</Text>
            <TextInput value={editDriver} onChangeText={setEditDriver} className="mt-1 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900" />
            <View className="mt-4 flex-row gap-2">
              <TouchableOpacity onPress={() => setEditOpen(false)} className="flex-1 items-center rounded-2xl bg-slate-100 py-3"><Text className="text-sm font-bold text-slate-700">Cancel</Text></TouchableOpacity>
              <TouchableOpacity disabled={busy} onPress={saveEdit} className="flex-1 items-center rounded-2xl bg-blue-600 py-3"><Text className="text-sm font-bold text-white">{busy ? 'Saving…' : 'Save'}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add batteries modal */}
      <Modal visible={addOpen} transparent animationType="fade" onRequestClose={() => setAddOpen(false)}>
        <View className="flex-1 items-center justify-center bg-black/60 px-6">
          <View className="w-full rounded-3xl bg-white p-5">
            <Text className="text-base font-extrabold text-slate-900">Add batteries to this batch</Text>
            <Text className="mt-0.5 text-xs text-slate-500">Type or paste battery codes, one per line (QR links are fine too).</Text>
            <TextInput value={addCodes} onChangeText={setAddCodes} multiline autoCapitalize="characters" autoCorrect={false} placeholder={'HUM-0000021\nHUM-0000022'} placeholderTextColor="#94a3b8" className="mt-3 min-h-[110px] rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900" style={{ textAlignVertical: 'top' }} />
            <View className="mt-4 flex-row gap-2">
              <TouchableOpacity onPress={() => setAddOpen(false)} className="flex-1 items-center rounded-2xl bg-slate-100 py-3"><Text className="text-sm font-bold text-slate-700">Cancel</Text></TouchableOpacity>
              <TouchableOpacity disabled={busy} onPress={addBatteries} className="flex-1 items-center rounded-2xl bg-blue-600 py-3"><Text className="text-sm font-bold text-white">{busy ? 'Adding…' : 'Add'}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Rating modal */}
      <Modal visible={rateOpen} transparent animationType="fade" onRequestClose={() => setRateOpen(false)}>
        <View className="flex-1 justify-end bg-black/60">
          <View className="max-h-[88%] rounded-t-3xl bg-white p-5">
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text className="text-base font-extrabold text-slate-900">Rate this return</Text>
              <Text className="mt-0.5 text-xs text-slate-500">Truck {selected.truckNumber} · {selected.batteries.length} batteries</Text>
              <View className="mt-4 flex-row justify-center gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <TouchableOpacity key={n} onPress={() => setRating(n)} hitSlop={6}>
                    <Text className={`text-4xl ${n <= rating ? 'text-amber-400' : 'text-slate-200'}`}>★</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text className="mt-4 text-xs font-semibold text-slate-600">What went well?</Text>
              <View className="mt-2 flex-row flex-wrap gap-1.5">
                {PRESET_FEEDBACK_OPTIONS.map((tag) => {
                  const on = tags.includes(tag);
                  return (
                    <TouchableOpacity key={tag} onPress={() => setTags(on ? tags.filter((t) => t !== tag) : [...tags, tag])} className={`rounded-xl border px-2.5 py-1.5 ${on ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-white'}`}>
                      <Text className={`text-[11px] font-semibold ${on ? 'text-amber-800' : 'text-slate-600'}`}>{tag}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TextInput value={feedback} onChangeText={setFeedback} multiline placeholder="Anything else you'd like us to know? (optional)" placeholderTextColor="#94a3b8" className="mt-3 min-h-[80px] rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900" style={{ textAlignVertical: 'top' }} />
              <View className="mt-4 flex-row gap-2 pb-4">
                <TouchableOpacity onPress={() => setRateOpen(false)} className="flex-1 items-center rounded-2xl bg-slate-100 py-3"><Text className="text-sm font-bold text-slate-700">Cancel</Text></TouchableOpacity>
                <TouchableOpacity disabled={busy || !rating} onPress={submitRating} className={`flex-1 items-center rounded-2xl bg-amber-500 py-3 ${!rating ? 'opacity-50' : ''}`}><Text className="text-sm font-bold text-white">{busy ? 'Sending…' : 'Submit rating'}</Text></TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
