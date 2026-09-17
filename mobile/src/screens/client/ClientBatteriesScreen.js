import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import apiClient from '../../services/api-client';
import extractBatteryCode from '../../utils/extract-battery-code';
import { StatusBadge } from '../../components/ui/Badge';
import Icon from '../../components/ui/Icon';

const BUCKET_TABS = [
  { id: 'all', label: 'All' },
  { id: 'packed', label: 'Packed' },
  { id: 'pending', label: 'In Service' },
  { id: 'received', label: 'Received' },
];

const DATE_FILTERS = [
  { id: 'all', label: 'All Dates' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'Last 7 Days' },
  { id: 'month', label: 'Last 30 Days' },
];

// The date that best represents "when this happened" for a given bucket —
// e.g. a battery in the Received bucket should be filtered by when it was
// actually returned, not when it was first registered.
function relevantDate(item, bucket) {
  if (bucket === 'received' && item.return_date) return item.return_date;
  return item.created_at;
}

function matchesDateFilter(dateStr, filter) {
  if (filter === 'all') return true;
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  if (filter === 'today') {
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  }
  if (filter === 'week') {
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return d >= sevenDaysAgo;
  }
  if (filter === 'month') {
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return d >= thirtyDaysAgo;
  }
  return true;
}

export default function ClientBatteriesScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const initialBucket = route.params?.initialBucket || 'all';

  const [activeTab, setActiveTab] = useState(initialBucket);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [batteries, setBatteries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Battery Number assign/edit modal state
  const [serialModalTarget, setSerialModalTarget] = useState(null);
  const [serialInput, setSerialInput] = useState('');
  const [serialSaving, setSerialSaving] = useState(false);
  const [serialError, setSerialError] = useState(null);

  // Pack-for-repair intake modal state
  const [packModalOpen, setPackModalOpen] = useState(false);
  const [truckNumber, setTruckNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [scanInput, setScanInput] = useState('');
  const [scannedBatteries, setScannedBatteries] = useState([]);
  const [packing, setPacking] = useState(false);
  const [packError, setPackError] = useState(null);
  const [packSuccess, setPackSuccess] = useState(null);

  const fetchBatteries = useCallback(async () => {
    setError(null);
    try {
      const params = {};
      if (activeTab !== 'all') {
        params.bucket = activeTab;
      }
      const { data } = await apiClient.get('/clients/me/batteries', { params });
      setBatteries(data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (route.params?.initialBucket) {
      setActiveTab(route.params.initialBucket);
    }
  }, [route.params?.initialBucket]);

  useEffect(() => {
    setLoading(true);
    fetchBatteries();
  }, [fetchBatteries]);

  function onRefresh() {
    setRefreshing(true);
    fetchBatteries();
  }

  function openSerialModal(battery) {
    setSerialModalTarget(battery);
    setSerialInput(battery.serial_number || '');
    setSerialError(null);
  }

  async function handleSerialSave() {
    if (!serialModalTarget) return;
    setSerialSaving(true);
    setSerialError(null);
    try {
      await apiClient.patch(`/batteries/${serialModalTarget.id}/serial-number`, {
        serialNumber: serialInput.trim(),
      });
      setSerialModalTarget(null);
      fetchBatteries();
    } catch (err) {
      setSerialError(err.response?.data?.message || err.message);
    } finally {
      setSerialSaving(false);
    }
  }

  function addScanned(rawCode) {
    const code = (extractBatteryCode(rawCode) || rawCode || '').trim().toUpperCase();
    if (!code) return;
    if (scannedBatteries.some((b) => b.code === code)) {
      setPackError(`Battery ${code} has already been added to this list.`);
      return;
    }
    setScannedBatteries((prev) => [...prev, { id: Date.now() + Math.random(), code }]);
    setScanInput('');
    setPackError(null);
  }

  function removeScanned(id) {
    setScannedBatteries((prev) => prev.filter((b) => b.id !== id));
  }

  function closePackModal() {
    setPackModalOpen(false);
    setTruckNumber('');
    setDriverName('');
    setScanInput('');
    setScannedBatteries([]);
    setPackError(null);
    setPackSuccess(null);
  }

  async function handlePackSubmit() {
    let finalBatteries = [...scannedBatteries];
    if (scanInput.trim()) {
      const code = (extractBatteryCode(scanInput) || scanInput).trim().toUpperCase();
      if (code && !finalBatteries.some((b) => b.code === code)) {
        finalBatteries.push({ id: Date.now(), code });
      }
    }
    if (finalBatteries.length === 0) {
      setPackError('Please scan or add at least one battery to intake.');
      return;
    }

    setPacking(true);
    setPackError(null);
    try {
      const res = await apiClient.post('/clients/me/batteries/pack-to-repair', {
        truckNumber: truckNumber.trim() || undefined,
        driverName: driverName.trim() || undefined,
        batteries: finalBatteries.map((b) => ({ batteryCode: b.code })),
      });
      setPackSuccess(res.data?.message || `${finalBatteries.length} batteries recorded for repair intake!`);
      fetchBatteries();
      setTimeout(closePackModal, 1200);
    } catch (err) {
      setPackError(err.response?.data?.message || err.message);
    } finally {
      setPacking(false);
    }
  }

  const filteredBatteries = batteries.filter((b) => {
    if (!matchesDateFilter(relevantDate(b, activeTab), dateFilter)) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return (
      b.battery_code?.toLowerCase().includes(q) ||
      b.serial_number?.toLowerCase().includes(q)
    );
  });

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      {/* ── Search & Filter Header ────────────────────────────────────────── */}
      <View className="border-b border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 px-4 pt-3 pb-3">
        {/* Search Bar */}
        <View className="flex-row items-center gap-2 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2">
          <Icon name="search" color="#64748b" size={15} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by Battery ID or Serial Number…"
            placeholderTextColor="#64748b"
            autoCapitalize="characters"
            className="flex-1 text-xs text-slate-900 dark:text-white"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Icon name="close" color="#64748b" size={13} />
            </TouchableOpacity>
          )}
        </View>

        {/* Tab Filters */}
        <View className="mt-3 flex-row gap-1.5">
          {BUCKET_TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                className={`rounded-xl px-3.5 py-1.5 ${
                  active
                    ? 'bg-blue-600 shadow-sm shadow-blue-600/30'
                    : 'bg-slate-100/80 dark:bg-slate-800/80'
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    active ? 'text-white' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Date Filter */}
        <View className="mt-2.5 flex-row gap-1.5">
          {DATE_FILTERS.map((f) => {
            const active = dateFilter === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                onPress={() => setDateFilter(f.id)}
                className={`rounded-xl px-3 py-1.5 ${
                  active ? 'bg-emerald-600 shadow-sm shadow-emerald-600/30' : 'bg-slate-100/80 dark:bg-slate-800/80'
                }`}
              >
                <Text
                  className={`text-[11px] font-bold ${
                    active ? 'text-white' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {activeTab === 'packed' && (
          <TouchableOpacity
            onPress={() => setPackModalOpen(true)}
            className="mt-3 items-center rounded-xl bg-blue-600 py-2.5 active:bg-blue-700"
          >
            <Text className="text-xs font-bold text-white">+ Pack Batteries for Repair</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Body List ─────────────────────────────────────────────────────── */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#38bdf8" />
          <Text className="mt-2 text-xs text-slate-500 dark:text-slate-400 font-medium">Loading fleet batteries…</Text>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-center text-sm text-red-600 dark:text-red-400 font-medium">{error}</Text>
          <TouchableOpacity
            onPress={fetchBatteries}
            className="mt-3 rounded-xl bg-blue-600 px-5 py-2.5 shadow-sm"
          >
            <Text className="text-xs font-bold text-white">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredBatteries}
          keyExtractor={(item) => String(item.id)}
          contentContainerClassName="p-4 gap-3 pb-16"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#38bdf8"
              colors={['#38bdf8']}
            />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <View className="h-16 w-16 items-center justify-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <Icon name="battery" color="#94a3b8" size={22} />
              </View>
              <Text className="mt-3 font-bold text-slate-900 dark:text-white text-base">No batteries found</Text>
              <Text className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                {search || dateFilter !== 'all'
                  ? 'Try a different search term or date range'
                  : 'No batteries under this category'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isClientLocked = item.serial_number_added_by_role === 'client';
            return (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() =>
                  navigation.navigate('BatteryDetail', { code: item.battery_code, fromScan: false })
                }
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm active:bg-slate-850"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-base font-extrabold text-blue-600 dark:text-blue-400">
                      {item.battery_code}
                    </Text>
                    {item.is_blocked && (
                      <View className="rounded-full bg-red-50 dark:bg-red-950 px-2 py-0.5 border border-red-200 dark:border-red-800/40">
                        <Text className="text-[10px] font-bold text-red-600 dark:text-red-400">Blocked</Text>
                      </View>
                    )}
                  </View>
                  <StatusBadge status={item.status} />
                </View>

                {/* Battery Number row */}
                <View className="mt-3 flex-row items-center justify-between border-t border-slate-200/80 dark:border-slate-800/80 pt-2.5">
                  <View className="flex-1 mr-2">
                    {item.serial_number ? (
                      <View className="flex-row items-center gap-1.5 flex-wrap">
                        <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                          SN: {item.serial_number}
                        </Text>
                        <View
                          className={`rounded-full px-2 py-0.5 border ${
                            isClientLocked
                              ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800/40'
                              : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          <Text
                            className={`text-[10px] font-bold ${
                              isClientLocked ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {isClientLocked ? 'Set by you' : 'Admin'}
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <Text className="text-xs text-slate-400 dark:text-slate-500 italic">No Serial Number</Text>
                    )}
                  </View>

                  <TouchableOpacity
                    onPress={() => openSerialModal(item)}
                    className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-1.5 border border-slate-300 dark:border-slate-700 active:bg-slate-200 dark:active:bg-slate-700"
                  >
                    <Text className="text-xs font-bold text-blue-600 dark:text-blue-400">
                      {item.serial_number ? 'Edit' : '+ Add Number'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* ── Serial Number Modal (Dark Executive) ──────────────────────────── */}
      {serialModalTarget && (
        <Modal
          visible={!!serialModalTarget}
          transparent
          animationType="fade"
          onRequestClose={() => setSerialModalTarget(null)}
        >
          <View className="flex-1 items-center justify-center bg-slate-50 dark:bg-slate-950/80 px-6 backdrop-blur-md">
            <View className="w-full max-w-sm rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl">
              <View className="flex-row items-center justify-between">
                <Text className="text-base font-extrabold text-slate-900 dark:text-white">
                  Battery Number
                </Text>
                <View className="rounded-full bg-blue-50 dark:bg-blue-950 px-2.5 py-0.5 border border-blue-200 dark:border-blue-800/40">
                  <Text className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">{serialModalTarget.battery_code}</Text>
                </View>
              </View>

              <Text className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Enter the physical serial number printed on the battery. Once set by you, it is locked from admin overwrites.
              </Text>

              <TextInput
                value={serialInput}
                onChangeText={setSerialInput}
                placeholder="e.g. SN-88213"
                placeholderTextColor="#64748b"
                autoFocus
                className="mt-4 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3.5 text-sm text-slate-900 dark:text-white focus:border-blue-500"
              />

              {serialError && (
                <Text className="mt-2 text-xs text-red-600 dark:text-red-400 font-medium">{serialError}</Text>
              )}

              <View className="mt-6 flex-row justify-end gap-2.5">
                <TouchableOpacity
                  onPress={() => setSerialModalTarget(null)}
                  className="rounded-xl px-4 py-2.5"
                >
                  <Text className="text-sm font-medium text-slate-500 dark:text-slate-400">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSerialSave}
                  disabled={serialSaving}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 shadow-md shadow-blue-600/30 disabled:opacity-50"
                >
                  {serialSaving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text className="text-sm font-bold text-white">Save Number</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ── Pack-for-Repair Intake Modal ────────────────────────────────── */}
      <Modal visible={packModalOpen} transparent animationType="fade" onRequestClose={closePackModal}>
        <View className="flex-1 items-center justify-center bg-slate-50 dark:bg-slate-950/80 px-6">
          <View className="w-full max-w-sm rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl">
            <Text className="text-base font-extrabold text-slate-900 dark:text-white">Pack Batteries for Repair</Text>
            <Text className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Scan or type battery codes to send for workshop repair.
            </Text>

            {packSuccess && (
              <View className="mt-3 rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/40 p-3">
                <Text className="text-xs font-bold text-emerald-600 dark:text-emerald-300">{packSuccess}</Text>
              </View>
            )}
            {packError && (
              <View className="mt-3 rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-950/40 p-3">
                <Text className="text-xs font-medium text-red-600 dark:text-red-300">{packError}</Text>
              </View>
            )}

            <Text className="mb-1.5 mt-4 text-xs font-semibold text-slate-500 dark:text-slate-400">Truck Number (optional)</Text>
            <TextInput
              value={truckNumber}
              onChangeText={setTruckNumber}
              placeholder="e.g. GB21 XYZ"
              placeholderTextColor="#64748b"
              className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-white"
            />

            <Text className="mb-1.5 mt-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Driver Name (optional)</Text>
            <TextInput
              value={driverName}
              onChangeText={setDriverName}
              placeholder="e.g. George Davies"
              placeholderTextColor="#64748b"
              className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-white"
            />

            <Text className="mb-1.5 mt-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Scan / Add Batteries</Text>
            <View className="flex-row gap-2">
              <TextInput
                value={scanInput}
                onChangeText={(v) => setScanInput(v.toUpperCase())}
                onSubmitEditing={() => addScanned(scanInput)}
                placeholder="Battery code…"
                placeholderTextColor="#64748b"
                autoCapitalize="characters"
                className="flex-1 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-white"
              />
              <TouchableOpacity
                onPress={() => addScanned(scanInput)}
                className="items-center justify-center rounded-2xl bg-blue-600 px-4"
              >
                <Text className="text-xs font-bold text-white">Add</Text>
              </TouchableOpacity>
            </View>

            {scannedBatteries.length > 0 && (
              <View className="mt-3 max-h-32">
                <FlatList
                  data={scannedBatteries}
                  keyExtractor={(item) => String(item.id)}
                  renderItem={({ item }) => (
                    <View className="mb-1.5 flex-row items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2">
                      <Text className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">{item.code}</Text>
                      <TouchableOpacity onPress={() => removeScanned(item.id)}>
                        <Text className="text-xs font-bold text-red-600 dark:text-red-400">Remove</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                />
              </View>
            )}

            <View className="mt-5 flex-row justify-end gap-2.5">
              <TouchableOpacity onPress={closePackModal} className="rounded-xl px-4 py-2.5">
                <Text className="text-sm font-medium text-slate-500 dark:text-slate-400">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handlePackSubmit}
                disabled={packing}
                className="rounded-xl bg-blue-600 px-5 py-2.5 shadow-md shadow-blue-600/30 disabled:opacity-50"
              >
                {packing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text className="text-sm font-bold text-white">Submit Intake</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
