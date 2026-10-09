import { useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import apiClient from '../../services/api-client';

// Super-admin tools on the battery detail screen — the same three actions as
// the web BatteryDetailPage admin menu: correct the status, hide/unhide the
// battery app-wide (PATCH /batteries/:id/block), or delete it.
const STATUSES = [
  ['in_repair', 'Awaiting repair'],
  ['in_progress', 'Repairing'],
  ['in_testing', 'In testing'],
  ['repaired', 'Repaired'],
  ['returned', 'Returned'],
  ['unserviceable', 'Unserviceable'],
  ['recycled', 'Recycled'],
];

export default function BatteryAdminActions({ battery, onChanged, onDeleted }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function run(fn) {
    setBusy(true);
    setError(null);
    try { await fn(); } catch (err) { setError(err.response?.data?.message || err.message); } finally { setBusy(false); }
  }

  function setStatus(status, label) {
    if (status === battery.status) return;
    Alert.alert('Change status?', `${battery.battery_code} → ${label}. Use this only to correct a mistake.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Change', onPress: () => run(async () => { await apiClient.patch(`/batteries/${battery.id}`, { status }); onChanged?.(); }) },
    ]);
  }

  function toggleBlock() {
    const hide = !battery.is_blocked;
    Alert.alert(hide ? 'Hide this battery?' : 'Unhide this battery?', hide ? 'It disappears from every list and scan until unhidden. History is kept.' : 'It shows up in lists and scans again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: hide ? 'Hide' : 'Unhide', onPress: () => run(async () => { await apiClient.patch(`/batteries/${battery.id}/block`, { blocked: hide }); onChanged?.(); }) },
    ]);
  }

  function remove() {
    Alert.alert('Delete battery?', `${battery.battery_code} and its history will be removed. A copy is kept in the Trash Bin.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => run(async () => { await apiClient.delete(`/batteries/${battery.id}`); onDeleted?.(); }) },
    ]);
  }

  return (
    <View className="mb-5 rounded-3xl border border-violet-200 bg-violet-50/60 p-4">
      <TouchableOpacity onPress={() => setOpen((o) => !o)} className="flex-row items-center justify-between">
        <Text className="text-xs font-extrabold uppercase tracking-wider text-violet-800">Super admin actions</Text>
        <Text className="text-violet-700">{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open && (
        <View className="mt-3 gap-3">
          <Text className="text-[11px] font-bold text-slate-600">Correct status</Text>
          <View className="flex-row flex-wrap gap-1.5">
            {STATUSES.map(([s, label]) => (
              <TouchableOpacity key={s} disabled={busy} onPress={() => setStatus(s, label)} className={`rounded-lg border px-2.5 py-1.5 ${battery.status === s ? 'border-violet-600 bg-violet-600' : 'border-slate-300 bg-white'}`}>
                <Text className={`text-[11px] font-bold ${battery.status === s ? 'text-white' : 'text-slate-700'}`}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View className="flex-row gap-2">
            <TouchableOpacity disabled={busy} onPress={toggleBlock} className="flex-1 items-center rounded-xl bg-slate-800 py-2.5">
              <Text className="text-xs font-bold text-white">{battery.is_blocked ? 'Unhide battery' : 'Hide battery'}</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={busy} onPress={remove} className="flex-1 items-center rounded-xl border border-red-200 bg-red-50 py-2.5">
              <Text className="text-xs font-bold text-red-700">Delete battery</Text>
            </TouchableOpacity>
          </View>
          {error ? <Text className="text-xs font-semibold text-red-600">{error}</Text> : null}
        </View>
      )}
    </View>
  );
}
