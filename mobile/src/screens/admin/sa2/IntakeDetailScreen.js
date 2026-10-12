import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import apiClient from '../../../services/api-client';
import TruckVerifyModal from '../../../components/admin/sa2/TruckVerifyModal';
import { apiError, SearchBox, shortTime, StatTile, ukDate } from '../../../components/admin/sa2/ui';

// Truck intake detail — the web TruckIntakeDetailPage: header (truck,
// arrival status, driver, client, intake date/time), the arrival banner with
// "Scan to Verify Arrival" while pending, stage cards that filter the list,
// search, and every battery off the truck with its workshop stage, repeat
// intake flag, previous service history and an Inspect link.
// route.params: { id }

function isThisMonth(v) {
  if (!v) return false;
  const d = new Date(v);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

// Same stage rules as the web getBatteryStageInfo
export function stageInfo(b, truckPending) {
  const status = b?.status || 'registered';
  const partsPending =
    Number(b?.pending_parts_count || 0) > 0 || b?.is_passed_back || status === 'passed_to_remove' || status === 'passed_for_part_removal';
  if (truckPending) return { key: 'pending_arrival', category: 'pending_arrival', label: 'Pending Arrival', sublabel: 'Packed on truck · Awaiting arrival scan', tone: 'amber' };
  if (partsPending && ['in_repair', 'registered', 'new', 'passed_to_remove', 'passed_for_part_removal'].includes(status)) {
    return { key: 'passed_to_remove', category: 'passed_to_remove', label: 'Passed to Remove Parts', sublabel: null, tone: 'amber' };
  }
  switch (status) {
    case 'repaired':
      return { key: 'repaired', category: 'repaired', label: 'Repair Completed', sublabel: 'Tested & QA passed · Ready for client dispatch', tone: 'emerald' };
    case 'returned':
      return { key: 'returned', category: 'returned', label: 'Returned to Client', sublabel: 'Dispatched back to client', tone: 'sky' };
    case 'in_progress':
      return { key: 'in_progress', category: 'in_progress', label: 'Repair In Progress', sublabel: 'Active repair underway on technician bench', tone: 'blue' };
    case 'in_testing':
    case 'testing':
    case 'repair_testing':
      return { key: 'in_testing', category: 'in_progress', label: 'In Testing & QA', sublabel: 'Diagnostic QA inspection & voltage testing', tone: 'purple' };
    case 'unserviceable':
    case 'tested_parts_removed':
    case 'unserviceable_parts_removed': {
      const removed = status.includes('parts_removed');
      return {
        key: 'unserviceable',
        category: 'unserviceable',
        label: b?.failed_testing ? 'Unserviceable · Test Failed' : 'Unserviceable',
        sublabel: b?.failed_testing
          ? removed ? 'QA Test Failed · Parts restocked' : 'QA Test Failed · Marked by tester'
          : removed ? 'Marked by technician · Parts restocked' : 'Marked by technician',
        tone: 'rose',
      };
    }
    case 'recycled':
      return { key: 'recycled', category: 'unserviceable', label: 'Sent for Recycling', sublabel: 'Scrapped for scrap recycling materials', tone: 'slate' };
    default:
      return { key: 'queued', category: 'queued', label: 'Queued for Repair', sublabel: 'Verified at workshop · Awaiting technician claim', tone: 'amber' };
  }
}

const BADGE = {
  amber: 'border-amber-300 bg-amber-50 text-amber-900',
  emerald: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  sky: 'border-sky-300 bg-sky-50 text-sky-900',
  blue: 'border-blue-300 bg-blue-50 text-blue-900',
  purple: 'border-purple-300 bg-purple-50 text-purple-900',
  rose: 'border-rose-300 bg-rose-50 text-rose-900',
  slate: 'border-slate-400 bg-slate-100 text-slate-800',
};

export default function IntakeDetailScreen() {
  const navigation = useNavigation();
  const { id } = useRoute().params || {};
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get(`/truck-intakes/${id}`);
      setData(res.data);
      setError(null);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const intake = data?.intake || {};
  const batteries = useMemo(() => data?.batteries || [], [data]);
  const isPending = intake.status === 'pending_arrival';

  useLayoutEffect(() => {
    navigation.setOptions({ title: intake.truck_number ? `Truck Intake ${intake.truck_number}` : 'Truck Intake' });
  }, [navigation, intake.truck_number]);

  const counts = useMemo(() => {
    const c = { total: batteries.length, pending: isPending ? batteries.length : 0, queued: 0, passedToRemove: 0, inProgress: 0, completed: 0, returned: 0, unserviceable: 0, testFailed: 0 };
    batteries.forEach((b) => {
      const s = stageInfo(b, isPending);
      if (s.category === 'passed_to_remove') c.passedToRemove++;
      else if (s.category === 'queued') c.queued++;
      else if (s.category === 'in_progress') c.inProgress++;
      else if (s.category === 'repaired') c.completed++;
      else if (s.category === 'returned') c.returned++;
      else if (s.category === 'unserviceable') {
        c.unserviceable++;
        if (b.failed_testing) c.testFailed++;
      }
    });
    return c;
  }, [batteries, isPending]);

  const cards = [
    { id: 'all', label: 'Total on Truck', count: counts.total, badge: 'Units', tone: 'blue' },
    isPending
      ? { id: 'pending_arrival', label: 'Pending Arrival', count: counts.pending, badge: 'In Transit', tone: 'amber' }
      : { id: 'queued', label: 'In Queue', count: counts.queued, badge: 'Waiting Bench', tone: 'amber' },
    ...(counts.passedToRemove > 0 ? [{ id: 'passed_to_remove', label: 'Parts Removal', count: counts.passedToRemove, badge: 'Rework', tone: 'orange' }] : []),
    { id: 'in_progress', label: 'In Progress & QA', count: counts.inProgress, badge: 'On Bench', tone: 'purple' },
    { id: 'completed', label: 'Completed', count: counts.completed, badge: 'Passed QA', tone: 'emerald' },
    { id: 'returned', label: 'Returned', count: counts.returned, badge: 'Dispatched', tone: 'sky' },
    { id: 'unserviceable', label: 'Unserviceable', count: counts.unserviceable, badge: counts.testFailed > 0 ? `${counts.testFailed} Test Failed` : 'Scrap', tone: 'rose' },
  ];

  const filtered = useMemo(() => {
    const want = { completed: 'repaired' }[statusFilter] || statusFilter;
    const q = query.trim().toLowerCase();
    return batteries.filter((b) => {
      const s = stageInfo(b, isPending);
      if (statusFilter !== 'all' && s.category !== want) return false;
      if (!q) return true;
      return [b.battery_code, b.serial_number, b.last_repaired_parts, s.label, s.sublabel].some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [batteries, isPending, statusFilter, query]);

  const openBattery = (code) => navigation.navigate('BatteryDetail', { code, fromScan: false });

  if (loading) return <Text className="flex-1 bg-slate-50 p-8 text-center text-sm text-slate-500">Loading truck intake details…</Text>;

  return (
    <View className="flex-1 bg-slate-50">
      <ScrollView
        contentContainerClassName="p-4 gap-4 pb-16"
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text className="text-xs font-semibold text-emerald-700">‹ Back to Truck Intakes</Text>
        </TouchableOpacity>

        {error ? (
          <Text className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</Text>
        ) : (
          <>
            {/* header */}
            <View>
              <View className="flex-row flex-wrap items-center gap-2">
                <Text className="text-lg text-slate-400">Truck Intake</Text>
                <Text className="font-mono text-lg font-black text-slate-900">{intake.truck_number}</Text>
                {isPending ? (
                  <Text className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800">🕒 Pending Arrival Scan</Text>
                ) : (
                  <Text className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800">✓ Arrival Verified</Text>
                )}
              </View>
              <View className="mt-2 flex-row flex-wrap gap-x-5 gap-y-1">
                <Text className="text-xs text-slate-400">Driver: <Text className="font-bold text-slate-800">{intake.driver_name || '—'}</Text></Text>
                {intake.client_name ? <Text className="text-xs text-slate-400">Client: <Text className="font-bold text-blue-700">{intake.client_name}</Text></Text> : null}
                <Text className="text-xs text-slate-400">Intake Date: <Text className="font-bold text-slate-800">{ukDate(intake.intake_at)}</Text></Text>
                <Text className="text-xs text-slate-400">Time: <Text className="font-bold text-slate-800">{shortTime(intake.intake_at)}</Text></Text>
              </View>
            </View>

            {/* arrival banner */}
            {isPending ? (
              <View className="gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4">
                <View className="flex-row items-start gap-3">
                  <Text className="text-2xl">🚚</Text>
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-amber-950">Truck In Transit — Pending Arrival Verification</Text>
                    <Text className="mt-1 self-start rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-black uppercase text-amber-900">{batteries.length} Batteries Expected</Text>
                    <Text className="mt-1 text-xs text-amber-800">
                      These batteries are registered on this shipment and will move into the workshop queue once scanned & verified off the truck.
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setVerifyOpen(true)} className="items-center rounded-xl bg-emerald-600 py-2.5">
                  <Text className="text-xs font-bold text-white">✓ Scan to Verify Arrival</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View className="flex-row items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5">
                <Text className="flex-1 text-xs font-semibold text-emerald-900">
                  ✓ All batteries verified and received at workshop on{' '}
                  <Text className="font-bold">
                    {new Date(intake.verified_at || intake.intake_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </Text>
                <Text className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">{batteries.length} Total Verified</Text>
              </View>
            )}

            {/* stage cards */}
            <View className="flex-row flex-wrap gap-2">
              {cards.map((c) => (
                <StatTile
                  key={c.id}
                  label={c.label}
                  value={c.count}
                  badge={c.badge}
                  tone={c.tone}
                  active={statusFilter === c.id}
                  onPress={() => setStatusFilter(statusFilter === c.id && c.id !== 'all' ? 'all' : c.id)}
                />
              ))}
            </View>

            {/* list header */}
            <View className="gap-2">
              <View className="flex-row flex-wrap items-center gap-2">
                <Text className="text-xs font-bold uppercase tracking-wider text-slate-900">Batteries from this Shipment</Text>
                <Text className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-black text-slate-800">
                  {filtered.length}{filtered.length !== batteries.length ? ` of ${batteries.length}` : ''}
                </Text>
                {statusFilter !== 'all' ? (
                  <TouchableOpacity onPress={() => setStatusFilter('all')} className="flex-row items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5">
                    <Text className="text-xs font-semibold text-blue-700">Filtered: <Text className="font-bold">{cards.find((c) => c.id === statusFilter)?.label || statusFilter}</Text>  ✕</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <Text className="text-[11px] text-slate-500">Live status and workshop pipeline stage of each individual battery delivered on truck {intake.truck_number}.</Text>
              <View className="flex-row items-center gap-2">
                <View className="flex-1"><SearchBox value={query} onChangeText={setQuery} placeholder="Search battery ID, serial, stage…" /></View>
                {statusFilter !== 'all' || query ? (
                  <TouchableOpacity onPress={() => { setStatusFilter('all'); setQuery(''); }} className="rounded-xl border border-slate-300 bg-white px-2.5 py-2">
                    <Text className="text-xs font-bold text-slate-600">Reset</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            {/* batteries */}
            <View className="gap-2">
              {filtered.length === 0 ? (
                <Text className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-400">
                  {statusFilter !== 'all' || query ? 'No batteries found matching the current search or stage filter.' : 'No batteries recorded for this intake.'}
                </Text>
              ) : null}
              {filtered.map((b, i) => {
                const s = stageInfo(b, isPending);
                const repeat = Number(b.intake_count_this_month) > 1;
                const recent = isThisMonth(b.last_repaired_at);
                return (
                  <View key={b.id || b.battery_code} className="rounded-2xl border border-slate-200 bg-white p-3.5">
                    <View className="flex-row items-start justify-between gap-2">
                      <View className="flex-1">
                        <Text className="text-[10px] font-bold text-slate-400">#{i + 1}</Text>
                        <TouchableOpacity onPress={() => openBattery(b.battery_code)}>
                          <Text className="font-mono text-sm font-bold text-blue-700">{b.battery_code}</Text>
                        </TouchableOpacity>
                        <View className="mt-0.5 flex-row flex-wrap items-center gap-1.5">
                          {b.serial_number ? (
                            <Text className="font-mono text-[11px] text-slate-500">SN: <Text className="font-bold text-slate-700">{b.serial_number}</Text></Text>
                          ) : (
                            <Text className="text-[11px] text-slate-400">No SN</Text>
                          )}
                          {repeat ? <Text className="rounded-sm bg-rose-100 px-1.5 text-[10px] font-bold text-rose-800">↻ {b.intake_count_this_month}x this month</Text> : null}
                        </View>
                      </View>
                      <TouchableOpacity onPress={() => openBattery(b.battery_code)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1">
                        <Text className="text-xs font-semibold text-blue-700">Inspect →</Text>
                      </TouchableOpacity>
                    </View>
                    <View className="mt-2">
                      <Text className={`self-start rounded-md border px-2 py-0.5 text-[11px] font-medium ${BADGE[s.tone]}`}>● {s.label}</Text>
                      {s.category === 'unserviceable' ? <Text className="mt-0.5 text-[10px] font-medium text-rose-600">{s.sublabel || 'QA Test Failed'}</Text> : null}
                    </View>
                    <View className="mt-2 border-t border-slate-100 pt-2">
                      <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Previous Service History</Text>
                      {!b.last_repaired_at ? (
                        <Text className="text-xs font-medium text-slate-400">First Time Intake</Text>
                      ) : (
                        <>
                          <View className="flex-row items-center gap-1.5">
                            <Text className={recent ? 'text-xs font-bold text-rose-600' : 'text-xs font-medium text-slate-700'}>
                              {recent ? '⚠ ' : ''}{ukDate(b.last_repaired_at)}
                            </Text>
                            {recent ? <Text className="rounded-sm bg-rose-100 px-1 text-[9px] font-black uppercase text-rose-800">Recent</Text> : null}
                          </View>
                          {b.last_repaired_parts ? (
                            <Text className="text-[11px] text-slate-500" numberOfLines={2}>Parts: <Text className="font-semibold text-slate-700">{b.last_repaired_parts}</Text></Text>
                          ) : null}
                        </>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      <TruckVerifyModal
        visible={verifyOpen}
        intakeId={id}
        initialData={verifyOpen ? data : null}
        onClose={() => setVerifyOpen(false)}
        onSuccess={() => {
          setVerifyOpen(false);
          load();
        }}
        onInspect={(code) => {
          setVerifyOpen(false);
          openBattery(code);
        }}
      />
    </View>
  );
}
