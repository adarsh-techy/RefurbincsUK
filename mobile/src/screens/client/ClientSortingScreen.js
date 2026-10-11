import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSelector } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../../services/api-client';
import extractBatteryCode from '../../utils/extract-battery-code';
import { resolveBatteryInput, UNASSIGNED_TAG_MESSAGE } from '../../utils/scan-input';
import ScanBatteryInput from '../../components/scan/ScanBatteryInput';
import { exportSortGroup } from '../../utils/export-sort-group';
import { StatusBadge } from '../../components/ui/Badge';

function storageKey(userId) {
  return `battery-sort-groups-${userId || 'guest'}`;
}

function capitalizeFirstLetter(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export default function ClientSortingScreen() {
  const user = useSelector((state) => state.auth.user);
  const [groups, setGroups] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const lastSavedRef = useRef(null);
  const [registeredBatteries, setRegisteredBatteries] = useState([]);
  const [batteriesLoaded, setBatteriesLoaded] = useState(false); // false → RFID tags can't be matched yet
  const [exporting, setExporting] = useState(false);

  // Same export as the web sort page: the open group → "<name>.xlsx"
  async function exportActiveGroup(group) {
    setExporting(true);
    try {
      await exportSortGroup(group);
    } catch (err) {
      Alert.alert('Could not export', err.message || 'Please try again.');
    } finally {
      setExporting(false);
    }
  }

  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [nameModalMode, setNameModalMode] = useState('create');
  const [nameInput, setNameInput] = useState('');
  const [nameTargetId, setNameTargetId] = useState(null);

  const [activeGroupId, setActiveGroupId] = useState(null);

  useEffect(() => {
    AsyncStorage.removeItem(storageKey(user?.id)).catch(() => {});
    setLoadError(null);
    apiClient
      .get('/clients/me/sort-groups')
      .then(({ data }) => {
        const serverGroups = data?.data || [];
        lastSavedRef.current = JSON.stringify(serverGroups);
        setGroups(serverGroups);
        // Only enable the save effect after a successful load — saving [] on
        // top of a failed load would delete every group stored server-side.
        setLoaded(true);
      })
      .catch(() => {
        setLoadError('Could not load your sort groups. Pull to refresh before making changes.');
      });
  }, [user?.id]);

  // Auto-save on change. Skips when the groups are identical to what the
  // server last gave us (i.e. right after load), since the PUT is a
  // delete-and-reinsert of every row.
  useEffect(() => {
    if (!loaded || loadError) return;
    const serialized = JSON.stringify(groups);
    if (serialized === lastSavedRef.current) return;
    apiClient
      .put('/clients/me/sort-groups', { groups })
      .then(() => {
        lastSavedRef.current = serialized;
      })
      .catch(() => {});
  }, [groups, loaded, loadError]);

  // The client's batteries with their RFID tags — the tag → battery lookup.
  const loadRegistered = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/clients/me/batteries');
      const list = data?.data || [];
      setRegisteredBatteries(list);
      setBatteriesLoaded(true);
      return list;
    } catch {
      setBatteriesLoaded(false);
      return null;
    }
  }, []);

  useEffect(() => {
    loadRegistered();
  }, [loadRegistered]);

  const activeGroup = useMemo(() => groups.find((g) => g.id === activeGroupId) || null, [groups, activeGroupId]);

  const codeToBattery = useMemo(() => {
    const map = new Map();
    registeredBatteries.forEach((b) => map.set(b.battery_code.toUpperCase(), b));
    return map;
  }, [registeredBatteries]);

  function openCreateModal() {
    setNameModalMode('create');
    setNameInput('');
    setNameTargetId(null);
    setNameModalOpen(true);
  }

  function openRenameModal(group) {
    setNameModalMode('rename');
    setNameInput(group.name);
    setNameTargetId(group.id);
    setNameModalOpen(true);
  }

  function handleNameSubmit() {
    const trimmed = capitalizeFirstLetter(nameInput.trim());
    if (!trimmed) return;

    if (nameModalMode === 'create') {
      const newGroup = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: trimmed,
        createdAt: new Date().toISOString(),
        batteries: [],
      };
      setGroups((prev) => [newGroup, ...prev]);
      setActiveGroupId(newGroup.id);
    } else {
      setGroups((prev) => prev.map((g) => (g.id === nameTargetId ? { ...g, name: trimmed } : g)));
    }
    setNameModalOpen(false);
  }

  function deleteGroup(id) {
    Alert.alert('Delete Group', 'Remove this sort group? This does not affect the batteries themselves.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setGroups((prev) => prev.filter((g) => g.id !== id));
          if (activeGroupId === id) setActiveGroupId(null);
        },
      },
    ]);
  }

  const addBattery = useCallback(
    async (rawCode) => {
      if (!activeGroup) return;
      // QR link, battery code, or an RFID tag read by a reader
      let resolved = resolveBatteryInput(rawCode, registeredBatteries);
      if (resolved.unassignedTag) {
        // The list may be stale (tag assigned after this screen opened) or
        // may never have loaded — reload once before refusing the tag.
        const fresh = await loadRegistered();
        if (!fresh) {
          const message = `Read ${resolved.code}, but the app can't reach the server to look up this RFID tag. Check the Wi-Fi / server address and try again.`;
          return { tone: 'bad', message };
        }
        resolved = resolveBatteryInput(rawCode, fresh);
      }
      if (resolved.unassignedTag) {
        const message = `${UNASSIGNED_TAG_MESSAGE} (tag ${resolved.code})`;
        return { tone: 'bad', message };
      }
      const code = resolved.code;
      if (!code) return;
      if (batteriesLoaded && !resolved.battery) {
        return { tone: 'bad', message: `${code} is not one of your registered batteries — check the number.` };
      }
      if (activeGroup.batteries.some((c) => c.toUpperCase() === code)) {
        const message = `Battery ${code} is already sorted into this group.`;
        return { tone: 'warn', message };
      }
      setGroups((prev) =>
        prev.map((g) => (g.id === activeGroup.id ? { ...g, batteries: [...g.batteries, code] } : g))
      );
      const viaTag = resolved.battery?.rfid_tag && String(rawCode).toUpperCase().replace(/[^0-9A-Z]/g, '') === resolved.battery.rfid_tag;
      return { tone: 'good', message: `✓ ${code} added to ${activeGroup.name}${viaTag ? ' (RFID)' : ''}` };
    },
    [activeGroup, registeredBatteries, loadRegistered, batteriesLoaded]
  );

  function removeBattery(code) {
    if (!activeGroup) return;
    setGroups((prev) =>
      prev.map((g) => (g.id === activeGroup.id ? { ...g, batteries: g.batteries.filter((c) => c !== code) } : g))
    );
  }

  // ── Group Detail View ────────────────────────────────────────────────
  if (activeGroup) {
    return (
      <View className="flex-1 bg-slate-50 dark:bg-slate-950">
        <View className="border-b border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 px-4 pt-3 pb-3">
          <View className="flex-row items-center justify-between">
            <TouchableOpacity onPress={() => setActiveGroupId(null)}>
              <Text className="text-sm font-bold text-blue-600 dark:text-blue-400">‹ Back</Text>
            </TouchableOpacity>
            <View className="flex-row items-center gap-3">
              <TouchableOpacity onPress={() => openRenameModal(activeGroup)}>
                <Text className="text-xs font-bold text-slate-500 dark:text-slate-400">Rename</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteGroup(activeGroup.id)}>
                <Text className="text-xs font-bold text-red-600 dark:text-red-400">Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text className="mt-2 text-lg font-extrabold text-slate-900 dark:text-white">{activeGroup.name}</Text>
          <View className="flex-row items-center justify-between">
            <Text className="text-[11px] text-slate-500 dark:text-slate-400">
              {activeGroup.batteries.length} {activeGroup.batteries.length === 1 ? 'battery' : 'batteries'} sorted
            </Text>
            {activeGroup.batteries.length > 0 && (
              <TouchableOpacity
                disabled={exporting}
                onPress={() => exportActiveGroup(activeGroup)}
                className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 dark:border-emerald-800 dark:bg-emerald-950/40"
              >
                <Text className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">{exporting ? 'Exporting…' : 'Export to Excel'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <>
            <View className="p-4">
              <View className="rounded-2xl border border-blue-200 dark:border-blue-800/40 bg-white dark:bg-slate-900 p-4">
                <Text className="mb-2 text-xs font-bold text-slate-900 dark:text-white">Scan or Type a Battery</Text>
                <ScanBatteryInput
                  onSubmit={addBattery}
                  startInRfidMode
                />
                {!batteriesLoaded && (
                  <TouchableOpacity onPress={loadRegistered} className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                    <Text className="text-[11px] font-semibold text-amber-800">
                      Your battery list hasn't loaded, so RFID tags can't be matched yet. Tap to retry.
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <FlatList
              data={activeGroup.batteries}
              keyExtractor={(code) => code}
              contentContainerClassName="px-4 pb-16 gap-2.5"
              ListEmptyComponent={
                <View className="items-center justify-center py-16">
                  <Text className="text-sm font-bold text-slate-900 dark:text-white">No batteries sorted yet</Text>
                  <Text className="mt-1 text-xs text-slate-400 dark:text-slate-500">Scan or type a code above to add it.</Text>
                </View>
              }
              renderItem={({ item: code }) => {
                const match = codeToBattery.get(code.toUpperCase());
                return (
                  <View className="flex-row items-center justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
                    <View>
                      <Text className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400">{code}</Text>
                      <View className="mt-1">
                        {match ? (
                          <StatusBadge status={match.status} />
                        ) : (
                          <Text className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">Not in your fleet</Text>
                        )}
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => removeBattery(code)} className="rounded-lg p-1.5">
                      <Text className="text-xs font-bold text-red-600 dark:text-red-400">Remove</Text>
                    </TouchableOpacity>
                  </View>
                );
              }}
            />
        </>

        <NameModal
          visible={nameModalOpen}
          mode={nameModalMode}
          value={nameInput}
          onChangeValue={setNameInput}
          onCancel={() => setNameModalOpen(false)}
          onSubmit={handleNameSubmit}
        />
      </View>
    );
  }

  // ── Group List View ──────────────────────────────────────────────────
  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <View className="flex-row items-center justify-between border-b border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 px-4 py-3">
        <Text className="text-xs text-slate-500 dark:text-slate-400">Organize batteries by requirement</Text>
        <TouchableOpacity onPress={openCreateModal} className="rounded-xl bg-blue-600 px-3.5 py-2 active:bg-blue-700">
          <Text className="text-xs font-bold text-white">+ New Group</Text>
        </TouchableOpacity>
      </View>

      {loadError ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-sm font-semibold text-rose-600 dark:text-rose-400">{loadError}</Text>
        </View>
      ) : !loaded ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#38bdf8" />
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => item.id}
          contentContainerClassName="p-4 gap-3 pb-16"
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Text className="text-sm font-bold text-slate-900 dark:text-white">No sort groups yet</Text>
              <Text className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Tap "+ New Group" to start organizing batteries for a requirement.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setActiveGroupId(item.id)}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm active:bg-slate-850"
            >
              <View className="flex-row items-center justify-between">
                <Text className="flex-1 pr-2 text-sm font-extrabold text-slate-900 dark:text-white" numberOfLines={1}>
                  {item.name}
                </Text>
                <View className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5">
                  <Text className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">{item.batteries.length}</Text>
                </View>
              </View>
              <Text className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                Created {new Date(item.createdAt).toLocaleDateString()}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      <NameModal
        visible={nameModalOpen}
        mode={nameModalMode}
        value={nameInput}
        onChangeValue={setNameInput}
        onCancel={() => setNameModalOpen(false)}
        onSubmit={handleNameSubmit}
      />
    </View>
  );
}

function NameModal({ visible, mode, value, onChangeValue, onCancel, onSubmit }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 items-center justify-center bg-slate-50 dark:bg-slate-950/80 px-6">
        <View className="w-full max-w-sm rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl">
          <Text className="text-base font-extrabold text-slate-900 dark:text-white">
            {mode === 'create' ? 'New Sort Group' : 'Rename Sort Group'}
          </Text>
          <Text className="mb-2 mt-4 text-xs font-semibold text-slate-500 dark:text-slate-400">Group Name</Text>
          <TextInput
            value={value}
            onChangeText={(text) => onChangeValue(capitalizeFirstLetter(text))}
            placeholder="e.g. Site A Requirement, Order #204"
            placeholderTextColor="#64748b"
            autoCapitalize="sentences"
            autoFocus
            className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-white"
          />
          <View className="mt-5 flex-row justify-end gap-2.5">
            <TouchableOpacity onPress={onCancel} className="rounded-xl px-4 py-2.5">
              <Text className="text-sm font-medium text-slate-500 dark:text-slate-400">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onSubmit}
              disabled={!value.trim()}
              className="rounded-xl bg-blue-600 px-5 py-2.5 shadow-md shadow-blue-600/30 disabled:opacity-50"
            >
              <Text className="text-sm font-bold text-white">{mode === 'create' ? 'Create' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
