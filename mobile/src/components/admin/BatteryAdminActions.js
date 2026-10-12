import { useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import apiClient from '../../services/api-client';

// Super-admin tools on the battery detail screen: correct the status (the
// web "Correct status" form, opened by the screen), and — as on the web
// Generate QR list — block / unblock the battery app-wide (PATCH
// /batteries/:id/block) or delete it.
export default function BatteryAdminActions({ battery, onChanged, onDeleted, onCorrectStatus }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function run(fn) {
    setBusy(true);
    setError(null);
    try { await fn(); } catch (err) { setError(err.response?.data?.message || err.message); } finally { setBusy(false); }
  }

  function toggleBlock() {
    const hide = !battery.is_blocked;
    Alert.alert(hide ? 'Block this battery?' : 'Unblock this battery?', hide ? 'It disappears from every list and scan until unblocked. History is kept.' : 'It shows up in lists and scans again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: hide ? 'Block' : 'Unblock', onPress: () => run(async () => { await apiClient.patch(`/batteries/${battery.id}/block`, { blocked: hide }); onChanged?.(); }) },
    ]);
  }

  function remove() {
    Alert.alert('Delete Battery', `Delete battery "${battery.battery_code}"? This can't be undone.`, [
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
        <View className="mt-3 gap-2">
          {onCorrectStatus && (
            <TouchableOpacity disabled={busy} onPress={onCorrectStatus} className="items-center rounded-xl bg-violet-600 py-2.5">
              <Text className="text-xs font-bold text-white">Correct status</Text>
            </TouchableOpacity>
          )}
          <View className="flex-row gap-2">
            <TouchableOpacity disabled={busy} onPress={toggleBlock} className="flex-1 items-center rounded-xl bg-slate-800 py-2.5">
              <Text className="text-xs font-bold text-white">{battery.is_blocked ? 'Unblock battery' : 'Block battery'}</Text>
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
