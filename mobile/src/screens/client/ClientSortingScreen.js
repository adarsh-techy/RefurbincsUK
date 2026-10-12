import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../../services/api-client';
import { isLikelyRfidTag, resolveBatteryInput, resolveBatteryScan } from '../../utils/scan-input';
import ScanBatteryInput from '../../components/scan/ScanBatteryInput';
import { exportSortGroup } from '../../utils/export-sort-group';
import Icon from '../../components/ui/Icon';
import SortDialog, { NameModal } from '../../components/client/sorting/SortDialog';
import SortGroupCard from '../../components/client/sorting/SortGroupCard';
import SortedBattery from '../../components/client/sorting/SortedBattery';
import AvailableBatteries from '../../components/client/sorting/AvailableBatteries';
import { NOT_WITH_CLIENT_STATUSES, capitalizeFirstLetter, formatDate, isBatteryPackedForRepair, plural, sortedBatteryCodes } from '../../components/client/sorting/sort-utils';

// Battery Sorting — the mobile twin of the web ClientBatterySortPage.
// Creating, renaming and deleting a group is saved straight away; batteries
// scanned into (or removed from) an open group stay local until "Save Group",
// with an "(Unsaved changes)" marker and a Save / Discard prompt on the way
// out — the same as the web page.

function storageKey(userId) {
  return `battery-sort-groups-${userId || 'guest'}`;
}

const sameList = (a, b) => JSON.stringify(a || []) === JSON.stringify(b || []);

export default function ClientSortingScreen() {
  const navigation = useNavigation();
  const user = useSelector((state) => state.auth.user);

  const [groups, setGroups] = useState([]);
  const groupsRef = useRef([]); // latest groups, so back-to-back scans see each other
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [registeredBatteries, setRegisteredBatteries] = useState([]);
  const [batteriesLoaded, setBatteriesLoaded] = useState(false);
  const [batteriesLoadError, setBatteriesLoadError] = useState(null);

  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [nameModalMode, setNameModalMode] = useState('create');
  const [nameInput, setNameInput] = useState('');
  const [nameTargetId, setNameTargetId] = useState(null);
  const [duplicateName, setDuplicateName] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [activeGroupId, setActiveGroupId] = useState(null);
  const [savedGroupBatteries, setSavedGroupBatteries] = useState(null); // the open group as last saved
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'
  const [groupSearch, setGroupSearch] = useState('');
  const [tapFeedback, setTapFeedback] = useState(null);
  const tapTimer = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [showUnsaved, setShowUnsaved] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(null); // { name, count } → banner on the list
  const [successModal, setSuccessModal] = useState(false);

  const updateGroups = useCallback((next) => {
    groupsRef.current = next;
    setGroups(next);
  }, []);

  const loadGroups = useCallback(async () => {
    setLoadError(null);
    try {
      const { data } = await apiClient.get('/clients/me/sort-groups');
      updateGroups(data?.data || []);
      setLoaded(true);
    } catch {
      // never fall back to [] — saving on top of a failed load would wipe
      // every group stored server-side; changes are blocked instead
      setLoadError('Could not load your sort groups. Pull down to refresh before making changes.');
    }
  }, [updateGroups]);

  // The client's batteries with their RFID tags — the tag → battery lookup.
  const loadRegistered = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/clients/me/batteries');
      const list = data?.data || [];
      setRegisteredBatteries(list);
      setBatteriesLoaded(true);
      setBatteriesLoadError(null);
      return list;
    } catch {
      setBatteriesLoadError('Could not load your fleet list, so batteries cannot be verified. Tap to retry.');
      return null;
    }
  }, []);

  useEffect(() => {
    AsyncStorage.removeItem(storageKey(user?.id)).catch(() => {});
    loadGroups();
    loadRegistered();
  }, [user?.id, loadGroups, loadRegistered]);

  useEffect(() => () => clearTimeout(tapTimer.current), []);

  async function refresh() {
    setRefreshing(true);
    await Promise.all([loadGroups(), loadRegistered()]);
    setRefreshing(false);
  }

  const activeGroup = useMemo(() => groups.find((g) => g.id === activeGroupId) || null, [groups, activeGroupId]);
  const hasUnsavedChanges = Boolean(activeGroup && savedGroupBatteries !== null && !sameList(activeGroup.batteries, savedGroupBatteries));

  const codeToBattery = useMemo(() => {
    const map = new Map();
    registeredBatteries.forEach((b) => map.set(b.battery_code.toUpperCase(), b));
    return map;
  }, [registeredBatteries]);

  const allSortedBatteryMap = useMemo(() => {
    const map = new Map();
    groups.forEach((g) => (g.batteries || []).forEach((code) => map.set(String(code).toUpperCase(), g.name)));
    return map;
  }, [groups]);

  const availableFleetBatteries = useMemo(
    () =>
      registeredBatteries.filter(
        (b) => !allSortedBatteryMap.has(b.battery_code.toUpperCase()) && !NOT_WITH_CLIENT_STATUSES.has(b.status)
      ),
    [registeredBatteries, allSortedBatteryMap]
  );

  const totals = useMemo(() => {
    let sorted = 0;
    let inService = 0;
    groups.forEach((g) =>
      (g.batteries || []).forEach((code) => {
        sorted += 1;
        if (isBatteryPackedForRepair(codeToBattery.get(String(code).trim().toUpperCase()))) inService += 1;
      })
    );
    return { sorted, inService, available: Math.max(0, sorted - inService) };
  }, [groups, codeToBattery]);

  const filteredGroups = useMemo(() => {
    const q = groupSearch.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(q) || (g.batteries || []).some((c) => c.toLowerCase().includes(q)));
  }, [groups, groupSearch]);

  // ── saving ─────────────────────────────────────────────────────────────
  // Create / rename / delete are saved at once. A failed PUT is shown and the
  // list is re-synced from the server, so a change that didn't save can't
  // quietly reappear (or vanish) later.
  async function persistGroups(next) {
    if (loadError) return;
    // the open group's unsaved scans stay unsaved — only "Save Group" saves them
    const toSave =
      activeGroupId && savedGroupBatteries !== null
        ? next.map((g) => (g.id === activeGroupId ? { ...g, batteries: savedGroupBatteries } : g))
        : next;
    try {
      await apiClient.put('/clients/me/sort-groups', { groups: toSave });
      setSaveError(null);
    } catch (err) {
      setSaveError(err?.response?.data?.message || 'Could not save your sort groups. Your last change was not saved.');
      try {
        const { data } = await apiClient.get('/clients/me/sort-groups');
        updateGroups(data?.data || []);
      } catch {
        // keep the local state; the banner already says it isn't saved
      }
    }
  }

  function closeGroup() {
    setActiveGroupId(null);
    setSavedGroupBatteries(null);
    setTapFeedback(null);
  }

  // "Save Group" and "Save & Leave": save every group, close the open one and
  // confirm with the success popup + banner.
  async function saveActiveGroup() {
    if (loadError || saving) return;
    setSaving(true);
    try {
      await apiClient.put('/clients/me/sort-groups', { groups: groupsRef.current });
      setSaveError(null);
      setSavedSuccess({ name: activeGroup?.name || 'Group', count: activeGroup?.batteries?.length || 0 });
      setShowUnsaved(false);
      closeGroup();
      setSuccessModal(true);
    } catch (err) {
      setShowUnsaved(false);
      setSaveError(err?.response?.data?.message || 'Could not save this group. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function handleBack() {
    if (hasUnsavedChanges) setShowUnsaved(true);
    else closeGroup();
  }

  function discardAndLeave() {
    if (activeGroupId && savedGroupBatteries !== null) {
      updateGroups(groupsRef.current.map((g) => (g.id === activeGroupId ? { ...g, batteries: savedGroupBatteries } : g)));
    }
    setShowUnsaved(false);
    closeGroup();
  }

  // Header back / Android back inside a group goes back to the group list
  // (asking about unsaved changes first) instead of leaving Battery Sorting.
  useEffect(() => {
    if (!activeGroupId) return undefined;
    return navigation.addListener('beforeRemove', (e) => {
      e.preventDefault();
      handleBack();
    });
  });

  function openGroup(group) {
    setActiveGroupId(group.id);
    setSavedGroupBatteries([...(group.batteries || [])]);
    setTapFeedback(null);
  }

  // ── create / rename / delete ───────────────────────────────────────────
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
    const current = groupsRef.current;
    const duplicate = current.some(
      (g) => g.name.trim().toLowerCase() === trimmed.toLowerCase() && (nameModalMode === 'create' || g.id !== nameTargetId)
    );
    if (duplicate) {
      setNameModalOpen(false);
      setDuplicateName(trimmed);
      return;
    }
    if (nameModalMode === 'create') {
      const newGroup = {
        id: `sort-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: trimmed,
        createdAt: new Date().toISOString(),
        batteries: [],
      };
      const next = [newGroup, ...current];
      updateGroups(next);
      persistGroups(next);
      setActiveGroupId(newGroup.id);
      setSavedGroupBatteries([]);
    } else {
      const next = current.map((g) => (g.id === nameTargetId ? { ...g, name: trimmed } : g));
      updateGroups(next);
      persistGroups(next);
    }
    setNameModalOpen(false);
    setNameInput('');
    setNameTargetId(null);
  }

  function confirmDeleteGroup() {
    if (!deleteTarget) return;
    const next = groupsRef.current.filter((g) => g.id !== deleteTarget.id);
    updateGroups(next);
    persistGroups(next);
    if (activeGroupId === deleteTarget.id) closeGroup();
    setDeleteTarget(null);
  }

  // ── add / remove batteries (unsaved until "Save Group") ────────────────
  const addBattery = useCallback(
    async (rawCode) => {
      const group = groupsRef.current.find((g) => g.id === activeGroupId);
      if (!group) return undefined;
      if (batteriesLoadError && !batteriesLoaded) return { tone: 'bad', message: batteriesLoadError.replace(' Tap to retry.', '') };
      if (!batteriesLoaded) return { tone: 'warn', message: 'Your fleet list is still loading. Please try again in a moment.' };

      // QR link, battery code, serial or an RFID tag read by a reader
      let list = registeredBatteries;
      let resolved = resolveBatteryInput(rawCode, list);
      if (resolved.unassignedTag) {
        // the list may be stale (tag assigned after this screen opened) —
        // reload once before refusing the tag
        const fresh = await loadRegistered();
        if (!fresh) {
          return {
            tone: 'bad',
            message: `Read ${resolved.code}, but the app can't reach the server to look up this RFID tag. Check the Wi-Fi / server address and try again.`,
          };
        }
        list = fresh;
        // not in the fleet list: ask the server, so an assigned tag whose
        // battery can't be sorted gets its real reason below
        resolved = await resolveBatteryScan(rawCode, fresh);
      }
      if (resolved.unassignedTag) return { ignore: true }; // unregistered tag: ignored
      if (!resolved.code) return { tone: 'bad', message: 'Please enter a valid battery code or scan a QR code.' };

      // a serial number typed in the box
      let battery = resolved.battery;
      if (!battery) {
        const upper = resolved.code.toUpperCase();
        battery = list.find((b) => b.serial_number && b.serial_number.toUpperCase() === upper) || null;
      }
      if (!battery) {
        return { tone: 'bad', message: `Battery "${resolved.code}" is not one of your registered batteries. Only registered batteries can be sorted.` };
      }
      const code = battery.battery_code.toUpperCase();

      // a battery can only be in one group
      const latest = groupsRef.current;
      const owner = latest.find((g) => (g.batteries || []).some((c) => String(c).toUpperCase() === code));
      if (owner) {
        // the reader sweeps the whole battery area and keeps re-reading tags
        // already added — those are skipped quietly; a typed code still says so
        if (owner.id === group.id && isLikelyRfidTag(rawCode)) return { ignore: true };
        return owner.id === group.id
          ? { tone: 'warn', message: `Battery ${code} is already in this sort group.` }
          : { tone: 'bad', message: `Battery ${code} is already sorted in the "${owner.name}" group.` };
      }

      updateGroups(latest.map((g) => (g.id === group.id ? { ...g, batteries: [...g.batteries, code] } : g)));
      const viaTag =
        battery.rfid_tag && String(rawCode).toUpperCase().replace(/[^0-9A-Z]/g, '') === String(battery.rfid_tag).toUpperCase();
      return { tone: 'good', message: `✓ ${code} added to ${group.name}${viaTag ? ' (RFID)' : ''} — tap Save Group to keep it` };
    },
    [activeGroupId, batteriesLoaded, batteriesLoadError, registeredBatteries, loadRegistered, updateGroups]
  );

  // "+ Add" on the available list
  async function addFromList(code) {
    const res = await addBattery(code);
    clearTimeout(tapTimer.current);
    setTapFeedback(res || null);
    tapTimer.current = setTimeout(() => setTapFeedback(null), 4000);
  }

  function removeBattery(code) {
    updateGroups(groupsRef.current.map((g) => (g.id === activeGroupId ? { ...g, batteries: g.batteries.filter((c) => c !== code) } : g)));
  }

  async function exportActiveGroup() {
    if (!activeGroup?.batteries?.length) return;
    setExporting(true);
    try {
      await exportSortGroup(activeGroup);
    } catch (err) {
      setSaveError(err.message || 'Could not export. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  const openHistory = (code) => navigation.navigate('BatteryDetail', { code });

  const dialogs = (
    <>
      <NameModal
        visible={nameModalOpen}
        mode={nameModalMode}
        value={nameInput}
        onChangeValue={setNameInput}
        onCancel={() => setNameModalOpen(false)}
        onSubmit={handleNameSubmit}
      />
      <SortDialog
        visible={Boolean(duplicateName)}
        tone="warning"
        title="Group Name Already Exists"
        message={`You already have a sort group named "${duplicateName}". Please choose a different name.`}
        onClose={() => setDuplicateName(null)}
        buttons={[{ label: 'OK', kind: 'primary', onPress: () => setDuplicateName(null) }]}
      />
      <SortDialog
        visible={Boolean(deleteTarget)}
        tone="danger"
        title="Delete Sort Group"
        message={`Are you sure you want to delete the "${deleteTarget?.name}" sort group? Your batteries will not be deleted from your fleet, only removed from this group.`}
        onClose={() => setDeleteTarget(null)}
        buttons={[
          { label: 'Keep Group', onPress: () => setDeleteTarget(null) },
          { label: 'Delete Group', kind: 'dangerSolid', onPress: confirmDeleteGroup },
        ]}
      />
      <SortDialog
        visible={showUnsaved}
        tone="warning"
        title={`Save changes to "${activeGroup?.name || ''}"?`}
        message="You have sorted or removed batteries in this group without saving. Would you like to save them before leaving?"
        onClose={() => setShowUnsaved(false)}
        buttons={[
          { label: 'Keep Editing', onPress: () => setShowUnsaved(false) },
          { label: 'Discard Changes', kind: 'danger', onPress: discardAndLeave },
          { label: saving ? 'Saving…' : 'Save & Leave', kind: 'primary', onPress: saveActiveGroup },
        ]}
      />
      <SortDialog
        visible={successModal}
        tone="success"
        title={`"${savedSuccess?.name || 'Group'}" Saved!`}
        message={`All sorted batteries (${plural(savedSuccess?.count || 0, 'battery', 'batteries')}) in this group have been updated and saved successfully.`}
        onClose={() => setSuccessModal(false)}
        buttons={[{ label: 'OK', kind: 'primary', onPress: () => setSuccessModal(false) }]}
      />
    </>
  );

  const saveErrorBanner = saveError ? (
    <View className="mx-4 mt-3 flex-row items-start justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
      <Text className="flex-1 text-xs font-semibold text-rose-700">{saveError}</Text>
      <TouchableOpacity onPress={() => setSaveError(null)}>
        <Text className="text-xs font-bold text-rose-700">Dismiss</Text>
      </TouchableOpacity>
    </View>
  ) : null;

  // ── Group Detail View ────────────────────────────────────────────────
  if (activeGroup) {
    const packedCount = activeGroup.batteries.filter((c) => isBatteryPackedForRepair(codeToBattery.get(c.toUpperCase()))).length;
    const count = activeGroup.batteries.length;

    const header = (
      <View>
        <View className="border-b border-slate-200/80 bg-white px-4 pb-3.5 pt-3 dark:border-slate-800 dark:bg-slate-900">
          <TouchableOpacity
            onPress={handleBack}
            className="self-start flex-row items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800"
          >
            <Text className="text-xs font-bold text-slate-700 dark:text-slate-200">← Back to Sort Groups</Text>
          </TouchableOpacity>
          <Text className="mt-2.5 text-xl font-bold text-slate-900 dark:text-white">{activeGroup.name}</Text>
          <Text className="mt-0.5 text-xs text-slate-500">
            Created {formatDate(activeGroup.createdAt)} • {count} {count === 1 ? 'battery' : 'batteries'} sorted
            {packedCount > 0 ? <Text className="font-bold text-red-600">{`  • ${packedCount} packed to service`}</Text> : null}
            {hasUnsavedChanges ? <Text className="font-semibold text-amber-600">{'  • (Unsaved changes)'}</Text> : null}
          </Text>

          <View className="mt-3 flex-row flex-wrap gap-2">
            <TouchableOpacity
              onPress={saveActiveGroup}
              disabled={saving || Boolean(loadError)}
              className={`flex-row items-center gap-1.5 rounded-xl px-4 py-2.5 ${
                hasUnsavedChanges ? 'bg-emerald-600 shadow-md shadow-emerald-600/40' : 'border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 shadow-none'
              } ${saving ? 'opacity-60' : ''}`}
            >
              {saving ? (
                <ActivityIndicator size="small" color={hasUnsavedChanges ? '#fff' : '#334155'} />
              ) : (
                <Icon name="check" size={15} color={hasUnsavedChanges ? '#ffffff' : '#334155'} />
              )}
              <Text className={`text-xs font-bold ${hasUnsavedChanges ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}>
                {hasUnsavedChanges ? 'Save Group ●' : 'Save Group'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => openRenameModal(activeGroup)}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 dark:border-slate-700 dark:bg-slate-800"
            >
              <Text className="text-xs font-bold text-slate-700 dark:text-slate-200">Rename</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setDeleteTarget(activeGroup)} className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5">
              <Text className="text-xs font-bold text-red-700">Delete Group</Text>
            </TouchableOpacity>
          </View>
        </View>

        {saveErrorBanner}

        <View className="p-4 pb-2">
          <View className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <View className="mb-3 flex-row items-start justify-between gap-2">
              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <View className="h-7 w-7 items-center justify-center rounded-lg bg-blue-50">
                    <Icon name="search" size={15} color="#2563eb" />
                  </View>
                  <Text className="flex-1 text-sm font-bold text-slate-900 dark:text-white">Scan or Type a Battery to Sort</Text>
                </View>
                <Text className="mt-1 text-xs text-slate-500">
                  Use the RFID reader, the camera (QR), or type the code / serial.
                </Text>
              </View>
            </View>
            {availableFleetBatteries.length > 0 && (
              <View className="mb-3 self-start flex-row items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 dark:border-slate-700 dark:bg-slate-800">
                <View className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <Text className="text-xs font-semibold text-slate-600 dark:text-slate-300">{availableFleetBatteries.length} available to sort</Text>
              </View>
            )}
            <ScanBatteryInput
              onSubmit={addBattery}
              placeholder="Scan or type battery code / serial…"
              feedback={tapFeedback}
              startInRfidMode
            />
            {batteriesLoadError ? (
              <TouchableOpacity onPress={loadRegistered} className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                <Text className="text-[11px] font-semibold text-amber-800">{batteriesLoadError}</Text>
              </TouchableOpacity>
            ) : null}
            <AvailableBatteries batteries={availableFleetBatteries} onAdd={addFromList} />
          </View>
        </View>

        <View className="flex-row flex-wrap items-center justify-between gap-2 px-4 pb-3">
          <TouchableOpacity
            onPress={exportActiveGroup}
            disabled={count === 0 || exporting}
            className={`flex-row items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 dark:border-emerald-800 dark:bg-emerald-950/40 ${
              count === 0 ? 'opacity-50' : ''
            }`}
          >
            <Icon name="package" size={14} color="#047857" />
            <Text className="text-xs font-bold text-emerald-800 dark:text-emerald-300">{exporting ? 'Exporting…' : 'Download Excel (.xlsx)'}</Text>
          </TouchableOpacity>
          <View className="flex-row rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-800">
            {[
              ['table', 'Table'],
              ['cards', 'Cards'],
            ].map(([key, label]) => (
              <TouchableOpacity
                key={key}
                onPress={() => setViewMode(key)}
                className={`rounded-lg px-3 py-1.5 ${viewMode === key ? 'bg-blue-600' : ''}`}
              >
                <Text className={`text-xs font-bold ${viewMode === key ? 'text-white' : 'text-slate-600 dark:text-slate-300'}`}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    );

    return (
      <View className="flex-1 bg-slate-50 dark:bg-slate-950">
        <FlatList
          automaticallyAdjustKeyboardInsets
          data={sortedBatteryCodes(activeGroup.batteries)}
          keyExtractor={(code) => code}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={header}
          contentContainerClassName={`pb-16 ${viewMode === 'cards' ? 'gap-3' : ''}`}
          ListEmptyComponent={
            <View className="mx-4 items-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-10 dark:border-slate-800 dark:bg-slate-900">
              <Text className="text-sm font-semibold text-slate-700 dark:text-slate-300">No batteries sorted into this group yet.</Text>
              <Text className="mt-1 text-xs text-slate-400">Scan or type a battery code above to add it.</Text>
            </View>
          }
          renderItem={({ item: code, index }) => (
            <View className={viewMode === 'cards' ? 'px-4' : ''}>
              <SortedBattery
                code={code}
                index={index}
                match={codeToBattery.get(code.toUpperCase())}
                view={viewMode}
                onOpenHistory={() => openHistory(code)}
                onRemove={() => removeBattery(code)}
              />
            </View>
          )}
        />
        {hasUnsavedChanges && (
          <View className="absolute bottom-0 left-0 right-0 flex-row items-center gap-3 border-t border-amber-200 bg-amber-50 px-4 py-3">
            <Text className="flex-1 text-xs font-semibold text-amber-800">Unsaved changes in this group</Text>
            <TouchableOpacity onPress={saveActiveGroup} disabled={saving} className="rounded-xl bg-emerald-600 px-4 py-2.5">
              <Text className="text-xs font-bold text-white">{saving ? 'Saving…' : 'Save Group'}</Text>
            </TouchableOpacity>
          </View>
        )}
        {dialogs}
      </View>
    );
  }

  // ── Groups Overview List ─────────────────────────────────────────────
  const stats = [
    { label: 'Sort Groups', value: groups.length, sub: 'Custom sorting pools', icon: 'grid', color: '#7e22ce', bg: 'bg-purple-50' },
    { label: 'Total Sorted Units', value: totals.sorted, sub: 'Allocated into groups', icon: 'package', color: '#1d4ed8', bg: 'bg-blue-50' },
    { label: 'Available in Fleet', value: totals.available, sub: 'Active & operational', icon: 'checkCircle', color: '#047857', bg: 'bg-emerald-50', tone: 'text-emerald-700' },
    { label: 'In Maintenance', value: totals.inService, sub: 'Packed to service / testing', icon: 'truck', color: '#be123c', bg: 'bg-rose-50', tone: 'text-rose-700' },
  ];

  const listHeader = (
    <View className="gap-4">
      <View className="flex-row items-start justify-between gap-3">
        <Text className="flex-1 text-xs text-slate-500">
          Organize your batteries into your own groups — by requirement, site, or order — by scanning or typing battery codes into a card.
        </Text>
        <TouchableOpacity onPress={openCreateModal} disabled={Boolean(loadError)} className="rounded-xl bg-emerald-600 px-3.5 py-2.5">
          <Text className="text-xs font-bold text-white">+ New Sort Group</Text>
        </TouchableOpacity>
      </View>

      {savedSuccess && !successModal ? (
        <View className="flex-row items-center gap-2.5 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3">
          <View className="h-6 w-6 items-center justify-center rounded-full bg-emerald-200">
            <Text className="text-xs font-bold text-emerald-800">✓</Text>
          </View>
          <Text className="flex-1 text-xs font-semibold text-emerald-900">
            Group "<Text className="font-bold">{savedSuccess.name}</Text>" saved successfully ({plural(savedSuccess.count, 'battery', 'batteries')}).
          </Text>
          <TouchableOpacity onPress={() => setSavedSuccess(null)} hitSlop={8}>
            <Text className="text-emerald-700">✕</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View className="flex-row flex-wrap justify-between gap-y-3">
        {stats.map((s) => (
          <View key={s.label} style={{ width: '48.5%' }} className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
            <View className="flex-row items-start justify-between gap-1">
              <Text className="flex-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{s.label}</Text>
              <View className={`h-7 w-7 items-center justify-center rounded-xl ${s.bg}`}>
                <Icon name={s.icon} size={14} color={s.color} />
              </View>
            </View>
            <Text className={`mt-1.5 font-mono text-2xl font-black ${s.tone || 'text-slate-900 dark:text-white'}`}>{s.value}</Text>
            <Text className={`mt-0.5 text-[11px] ${s.tone ? `${s.tone} font-medium` : 'text-slate-500'}`}>{s.sub}</Text>
          </View>
        ))}
      </View>

      {groups.length > 0 && (
        <View className="gap-2">
          <View className="flex-row items-center rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800">
            <Icon name="search" size={15} color="#94a3b8" />
            <TextInput
              value={groupSearch}
              onChangeText={setGroupSearch}
              placeholder="Search sort group name or battery code…"
              placeholderTextColor="#94a3b8"
              autoCorrect={false}
              className="min-w-0 flex-1 px-2 py-2.5 text-xs text-slate-900 dark:text-white"
            />
            {groupSearch.trim() ? (
              <TouchableOpacity onPress={() => setGroupSearch('')} hitSlop={8}>
                <Text className="text-slate-400">✕</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <View className="flex-row items-center gap-3">
            <Text className="text-xs font-bold text-slate-500">
              Showing {filteredGroups.length} of {groups.length} {groups.length === 1 ? 'group' : 'groups'}
            </Text>
            {groupSearch.trim() ? (
              <TouchableOpacity onPress={() => setGroupSearch('')}>
                <Text className="text-xs font-bold text-emerald-600">Clear filter</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      )}

      {saveError ? (
        <View className="flex-row items-start justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
          <Text className="flex-1 text-xs font-semibold text-rose-700">{saveError}</Text>
          <TouchableOpacity onPress={() => setSaveError(null)}>
            <Text className="text-xs font-bold text-rose-700">Dismiss</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <FlatList
        automaticallyAdjustKeyboardInsets
        data={loaded && !loadError ? filteredGroups : []}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListHeaderComponent={listHeader}
        contentContainerClassName="p-4 gap-4 pb-16"
        ListEmptyComponent={
          loadError ? (
            <View className="rounded-3xl border border-rose-200 bg-rose-50 p-8">
              <Text className="text-center text-sm font-semibold text-rose-700">{loadError}</Text>
            </View>
          ) : !loaded ? (
            <View className="h-48 items-center justify-center">
              <ActivityIndicator color="#10b981" />
            </View>
          ) : groups.length === 0 ? (
            <View className="items-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-10 dark:border-slate-800 dark:bg-slate-900">
              <View className="mb-3 h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                <Icon name="grid" size={22} color="#64748b" />
              </View>
              <Text className="text-sm font-semibold text-slate-700 dark:text-slate-300">No sort groups yet.</Text>
              <Text className="mt-1 text-center text-xs text-slate-400">
                Tap '+ New Sort Group' above to start categorizing and organizing batteries for your fleet requirements.
              </Text>
            </View>
          ) : (
            <Text className="py-8 text-center text-xs text-slate-500">No sort group matches "{groupSearch}".</Text>
          )
        }
        renderItem={({ item }) => (
          <SortGroupCard group={item} codeToBattery={codeToBattery} onOpen={() => openGroup(item)} onDelete={() => setDeleteTarget(item)} />
        )}
      />
      {dialogs}
    </View>
  );
}
