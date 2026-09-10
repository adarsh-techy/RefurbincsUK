import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { CameraView, useCameraPermissions } from 'expo-camera';
import apiClient from '../services/api-client';
import extractBatteryCode from '../utils/extract-battery-code';
import { StatusBadge } from '../components/Badge';

function storageKey(userId) {
  return `battery-sort-groups-${userId || 'guest'}`;
}

export default function ClientSortingScreen() {
  const user = useSelector((state) => state.auth.user);
  const [groups, setGroups] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [registeredBatteries, setRegisteredBatteries] = useState([]);

  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [nameModalMode, setNameModalMode] = useState('create');
  const [nameInput, setNameInput] = useState('');
  const [nameTargetId, setNameTargetId] = useState(null);

  const [activeGroupId, setActiveGroupId] = useState(null);
  const [scanInput, setScanInput] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [addError, setAddError] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem(storageKey(user?.id))
      .then((raw) => setGroups(raw ? JSON.parse(raw) : []))
      .catch(() => setGroups([]))
      .finally(() => setLoaded(true));
  }, [user?.id]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(storageKey(user?.id), JSON.stringify(groups)).catch(() => {});
  }, [groups, loaded, user?.id]);

  useEffect(() => {
    apiClient
      .get('/clients/me/batteries')
      .then(({ data }) => setRegisteredBatteries(data?.data || []))
      .catch(() => {});
  }, []);

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
    const trimmed = nameInput.trim();
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
    (rawCode) => {
      if (!activeGroup) return;
      const code = (extractBatteryCode(rawCode) || rawCode || '').trim().toUpperCase();
      if (!code) return;
      if (activeGroup.batteries.some((c) => c.toUpperCase() === code)) {
        setAddError(`Battery ${code} is already sorted into this group.`);
        return;
      }
      setGroups((prev) =>
        prev.map((g) => (g.id === activeGroup.id ? { ...g, batteries: [...g.batteries, code] } : g))
      );
      setScanInput('');
      setAddError(null);
    },
    [activeGroup]
  );

  function removeBattery(code) {
    if (!activeGroup) return;
    setGroups((prev) =>
      prev.map((g) => (g.id === activeGroup.id ? { ...g, batteries: g.batteries.filter((c) => c !== code) } : g))
    );
  }

  async function handleOpenCamera() {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) return;
    }
    setCameraOpen(true);
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
          <Text className="text-[11px] text-slate-500 dark:text-slate-400">
            {activeGroup.batteries.length} {activeGroup.batteries.length === 1 ? 'battery' : 'batteries'} sorted
          </Text>
        </View>

        {cameraOpen ? (
          <View className="flex-1 gap-4 p-5">
            <View className="flex-1 overflow-hidden rounded-3xl border border-blue-500/50 bg-black">
              <CameraView
                style={{ flex: 1 }}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={({ data }) => {
                  addBattery(data);
                  setCameraOpen(false);
                }}
              />
            </View>
            <TouchableOpacity
              onPress={() => setCameraOpen(false)}
              className="items-center rounded-2xl bg-slate-100 dark:bg-slate-800 py-4 active:bg-slate-200 dark:active:bg-slate-700"
            >
              <Text className="text-sm font-bold text-slate-900 dark:text-white">Close Camera</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View className="p-4">
              <View className="rounded-2xl border border-blue-200 dark:border-blue-800/40 bg-white dark:bg-slate-900 p-4">
                <Text className="mb-2 text-xs font-bold text-slate-900 dark:text-white">Scan or Type a Battery</Text>
                <View className="flex-row gap-2">
                  <TextInput
                    value={scanInput}
                    onChangeText={(v) => setScanInput(v.toUpperCase())}
                    onSubmitEditing={() => addBattery(scanInput)}
                    placeholder="Battery code / serial…"
                    placeholderTextColor="#64748b"
                    autoCapitalize="characters"
                    className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white"
                  />
                  <TouchableOpacity
                    onPress={() => addBattery(scanInput)}
                    className="items-center justify-center rounded-xl bg-blue-600 px-4"
                  >
                    <Text className="text-xs font-bold text-white">Add</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleOpenCamera}
                    className="items-center justify-center rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-4"
                  >
                    <Text className="text-xs font-bold text-slate-900 dark:text-white">Scan</Text>
                  </TouchableOpacity>
                </View>
                {addError && <Text className="mt-2 text-[11px] font-semibold text-red-600 dark:text-red-400">{addError}</Text>}
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

  // ── Group List View ──────────────────────────────────────────────────
  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <View className="flex-row items-center justify-between border-b border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 px-4 py-3">
        <Text className="text-xs text-slate-500 dark:text-slate-400">Organize batteries by requirement</Text>
        <TouchableOpacity onPress={openCreateModal} className="rounded-xl bg-blue-600 px-3.5 py-2 active:bg-blue-700">
          <Text className="text-xs font-bold text-white">+ New Group</Text>
        </TouchableOpacity>
      </View>

      {!loaded ? (
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
            onChangeText={onChangeValue}
            placeholder="e.g. Site A Requirement, Order #204"
            placeholderTextColor="#64748b"
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
