import { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import apiClient from '../../services/api-client';
import { Badge } from '../ui/Badge';
import Icon from '../ui/Icon';
import {
  ClientStatusBadge,
  Notice,
  formatDate,
  resolveBatchIntakeId,
  toLocalDateValue,
} from './batteries/common';
import SerialNumberModal from './batteries/SerialNumberModal';
import RatingModal from './batteries/RatingModal';
import ReturnVerifyModal from './batteries/ReturnVerifyModal';
import { AddMoreModal, ConfirmDialog, EditBatchModal, EditBatteryModal } from './batteries/BatchModals';

// Truck-batch view for the client's Packed and Received buckets — the same
// grouping, list, batch page and popups as the web ClientBatteriesPage:
//   packed    one batch per truck intake (plus a "Client Packed Batch" for
//             batteries packed without a truck). Until the workshop verifies
//             the truck: Edit (truck/driver, add/remove batteries), "+ Add
//             Batteries" and "Cancel Batch".
//   received  one batch per return dispatch: "Scan to Verify Receipt"
//             (ReturnVerifyModal) → then the rating form opens; "Rate" /
//             "Rated" once confirmed.
// The batch page has the seven tappable status cards (Total … Recycled),
// "Filtered by" + Clear filter, a search box, and per battery: code →
// history, "+ Add Serial", status and defect notes.
// props: bucket, rows (GET /clients/me/batteries?bucket=), fleet (the whole
// fleet, unfiltered), search + date (list filters from the screen), viewMode
// ('batch_table' | 'cards'), onChanged() re-fetches, refreshing/onRefresh.

const EMPTY = {
  packed: 'No truck intake batches found.',
  received: 'No batteries have been returned to you yet.',
};

const PAGE = 20;

const IN_SERVICE = ['in_progress', 'in_testing', 'testing', 'repair_testing'];
const UNSERVICEABLE = ['unserviceable', 'tested_parts_removed', 'unserviceable_parts_removed'];
const HANDLED = [...IN_SERVICE, 'repaired', ...UNSERVICEABLE, 'returned', 'recycled'];

// Same grouping as the web page's rawBatches
export function groupBatches(rows, bucket) {
  const isReceived = bucket === 'received';
  const map = new Map();
  for (const item of rows || []) {
    const key = isReceived
      ? item.return_id ? `return_${item.return_id}` : item.return_truck ? `return_trk_${item.return_truck}` : 'returned_batch'
      : item.intake_id ? `truck_${item.intake_id}` : item.truck_number ? `truck_num_${item.truck_number}` : 'awaiting_pickup';
    if (!map.has(key)) {
      const intakeAt = isReceived ? item.return_date || item.last_repaired_at || item.created_at : item.intake_at || item.created_at;
      const intakeStatus = isReceived ? item.return_status || 'verified' : item.intake_status || 'pending_arrival';
      map.set(key, {
        key,
        intakeId: isReceived ? item.return_id : item.intake_id || item.truck_intake_id || null,
        returnId: item.return_id || null,
        truckNumber: isReceived ? item.return_truck || 'Return Dispatch' : item.truck_number || null,
        driverName: isReceived ? item.return_driver || 'Workshop Driver' : item.driver_name || null,
        intakeAt,
        at: intakeAt,
        intakeStatus,
        status: intakeStatus,
        verifiedAt: isReceived ? item.return_verified_at || null : item.verified_at || null,
        isAwaitingPickup: !isReceived && !item.truck_number && !item.intake_id && !item.truck_intake_id,
        isReturnDispatch: isReceived,
        batteries: [],
      });
    }
    const g = map.get(key);
    if (!g.batteries.some((b) => b.id === item.id)) g.batteries.push(item);
  }
  return Array.from(map.values()).sort((a, b) => new Date(b.intakeAt || 0) - new Date(a.intakeAt || 0));
}

const isBatchVerified = (b) => b.intakeStatus === 'verified' || Boolean(b.verifiedAt);

function BatchStatus({ batch }) {
  if (batch.isReturnDispatch) {
    return batch.intakeStatus === 'pending_verification'
      ? <Badge tone="warning">● Pending Verification</Badge>
      : <Badge tone="good">✓ Received & Verified</Badge>;
  }
  return batch.intakeStatus === 'pending_arrival'
    ? <Badge tone="warning">● Waiting for Verify</Badge>
    : <Badge tone="good">✓ Verified</Badge>;
}

// Status of one battery on a packed truck (web detailTableColumns, packed)
function PackedRowStatus({ row, verified }) {
  if (!verified) return <Badge tone="warning">● Waiting for Verify</Badge>;
  if (UNSERVICEABLE.includes(row.status)) {
    return row.status === 'unserviceable' ? <Badge tone="critical">Unserviceable</Badge> : <ClientStatusBadge row={row} />;
  }
  if (IN_SERVICE.includes(row.status)) return <Badge tone="testing">In Service</Badge>;
  if (row.status === 'repaired') return <Badge tone="good">Service Completed</Badge>;
  if (row.status === 'returned') return <Badge tone="info">Returned</Badge>;
  if (row.status === 'recycled') return <Badge tone="black">Recycled</Badge>;
  return <Badge tone="warning">Waiting for Service</Badge>;
}

const METRIC_CARDS = [
  { id: 'all', label: 'Total Units', sub: 'All in truck', key: 'total', cls: 'border-blue-200 bg-blue-50', on: 'border-blue-500 bg-blue-100', text: 'text-blue-700' },
  { id: 'reached_workshop', label: 'Waiting for Service', sub: 'At workshop', key: 'reachedWorkshop', cls: 'border-amber-200 bg-amber-50', on: 'border-amber-500 bg-amber-100', text: 'text-amber-700' },
  { id: 'in_service', label: 'In Service', sub: 'Repairing / Testing', key: 'inService', cls: 'border-indigo-200 bg-indigo-50', on: 'border-indigo-500 bg-indigo-100', text: 'text-indigo-700' },
  { id: 'serviced', label: 'Completed', sub: 'Repaired & ready', key: 'serviced', cls: 'border-emerald-200 bg-emerald-50', on: 'border-teal-500 bg-teal-100', text: 'text-emerald-700' },
  { id: 'unserviceable', label: 'Unserviceable', sub: 'Cannot service', key: 'unserviceable', cls: 'border-rose-200 bg-rose-50', on: 'border-rose-500 bg-rose-100', text: 'text-rose-700' },
  { id: 'returned', label: 'Returned', sub: 'Delivered back', key: 'returned', cls: 'border-sky-200 bg-sky-50', on: 'border-sky-500 bg-sky-100', text: 'text-sky-700' },
  { id: 'recycled', label: 'Recycled', sub: 'Decommissioned', key: 'recycled', cls: 'border-neutral-200 bg-neutral-100', on: 'border-neutral-800 bg-neutral-200', text: 'text-neutral-700' },
];

export default function ClientTruckBatches({
  bucket,
  rows,
  fleet = [],
  search = '',
  date = '',
  viewMode = 'batch_table',
  onChanged,
  refreshing = false,
  onRefresh,
}) {
  const navigation = useNavigation();
  const user = useSelector((state) => state.auth.user);
  const isReceived = bucket === 'received';
  const rawBatches = useMemo(() => groupBatches(rows, bucket), [rows, bucket]);

  const batches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rawBatches.filter((b) => {
      const matchesSearch =
        !q ||
        (b.driverName && b.driverName.toLowerCase().includes(q)) ||
        (b.truckNumber && b.truckNumber.toLowerCase().includes(q)) ||
        (b.isAwaitingPickup && 'client packed batch'.includes(q));
      const matchesDate = !date || toLocalDateValue(b.intakeAt) === date;
      return matchesSearch && matchesDate;
    });
  }, [rawBatches, search, date]);

  const [visible, setVisible] = useState(PAGE);
  useEffect(() => setVisible(PAGE), [bucket, search, date]);

  const [selectedKey, setSelectedKey] = useState(null);
  const [batchSearch, setBatchSearch] = useState('');
  const [batchFilter, setBatchFilter] = useState('all');
  const [notice, setNotice] = useState(null);

  useEffect(() => setSelectedKey(null), [bucket]);

  // Packed already returns every battery ever on each truck; other buckets
  // take the batch's batteries from the whole fleet (web selectedBatch).
  const selected = useMemo(() => {
    if (!selectedKey) return null;
    const batch = rawBatches.find((b) => b.key === selectedKey);
    if (!batch) return null;
    if (bucket === 'packed' || !fleet.length) return batch;
    const all = fleet.filter((item) => {
      if (isReceived) {
        if (batch.returnId && item.return_id) return String(item.return_id) === String(batch.returnId);
        if (batch.truckNumber && item.return_truck) return String(item.return_truck) === String(batch.truckNumber);
      } else {
        if (batch.intakeId && item.intake_id) return String(item.intake_id) === String(batch.intakeId);
        if (batch.truckNumber && item.truck_number) return String(item.truck_number) === String(batch.truckNumber);
      }
      return false;
    });
    return all.length ? { ...batch, batteries: all } : batch;
  }, [selectedKey, rawBatches, fleet, bucket, isReceived]);

  // popups
  const [serialTarget, setSerialTarget] = useState(null);
  const [editBatch, setEditBatch] = useState(null);
  const [addMoreBatch, setAddMoreBatch] = useState(null);
  const [editBattery, setEditBattery] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [verifyBatch, setVerifyBatch] = useState(null);
  const [rateTarget, setRateTarget] = useState(null);

  const [ratedReturns, setRatedReturns] = useState(new Set());
  function loadRated() {
    apiClient
      .get('/ratings/my')
      .then(({ data }) => setRatedReturns(new Set((data?.data || []).map((r) => r.return_id).filter((v) => v !== null && v !== undefined).map(String))))
      .catch(() => {});
  }
  useEffect(() => {
    if (isReceived) loadRated();
  }, [isReceived]);
  const isRated = (id) => id !== null && id !== undefined && ratedReturns.has(String(id));

  const openRating = (batch, list) => {
    const codes = (list || batch.batteries || []).map((b) => b.battery_code).filter(Boolean);
    setRateTarget({ batteryCodes: codes, truckNumber: batch.truckNumber || '', driverName: batch.driverName || '', returnId: batch.intakeId || batch.returnId || null });
  };

  const goHistory = (row) => navigation.navigate('BatteryDetail', { code: row.battery_code, fromScan: false });

  function removeBatteryConfirm(row) {
    setConfirm({
      title: 'Remove Battery from Batch?',
      description: `Are you sure you want to remove ${row.battery_code} from this truck intake?`,
      body: `The battery ${row.battery_code} will be unlinked from this truck dispatch and returned to your available fleet inventory.`,
      keepLabel: 'Keep in Batch',
      goLabel: 'Remove from Batch',
      busyLabel: 'Removing…',
      run: async () => {
        const target = resolveBatchIntakeId(selected, row) || 'awaiting_pickup';
        await apiClient.delete(`/clients/me/truck-intakes/${target}/batteries/${row.id || row.battery_code}`);
        setNotice({ ok: true, text: `${row.battery_code} removed from the batch.` });
        await onChanged?.();
      },
    });
  }

  function cancelBatchConfirm(batch) {
    const intakeId = resolveBatchIntakeId(batch);
    setConfirm({
      title: 'Cancel Truck Intake Batch?',
      description: `Are you sure you want to cancel and delete Truck ${batch.truckNumber || 'Batch'}?`,
      body: `This will completely cancel the intake batch. All ${batch.batteries?.length || 0} batteries in this batch will be automatically unlinked and safely returned to your active fleet inventory.`,
      keepLabel: 'Go Back',
      goLabel: 'Cancel & Delete Batch',
      busyLabel: 'Cancelling…',
      run: async () => {
        await apiClient.delete(`/clients/me/truck-intakes/${intakeId}`);
        setSelectedKey(null);
        await onChanged?.();
      },
    });
  }

  const modals = (
    <>
      <SerialNumberModal battery={serialTarget} onClose={() => setSerialTarget(null)} onSaved={onChanged} />
      <EditBatchModal batch={editBatch} fleet={fleet} onClose={() => setEditBatch(null)} onChanged={onChanged} />
      <AddMoreModal batch={addMoreBatch} fleet={fleet} onClose={() => setAddMoreBatch(null)} onChanged={onChanged} />
      <EditBatteryModal battery={editBattery} onClose={() => setEditBattery(null)} onChanged={onChanged} />
      <ConfirmDialog confirm={confirm} onClose={() => setConfirm(null)} />
      <ReturnVerifyModal
        batch={verifyBatch}
        onClose={() => setVerifyBatch(null)}
        onSuccess={(list) => {
          const batch = verifyBatch;
          onChanged?.();
          if (batch) openRating(batch, list);
        }}
      />
      <RatingModal
        target={rateTarget}
        clientId={user?.client_id || user?.id}
        onClose={() => setRateTarget(null)}
        onSuccess={() => {
          onChanged?.();
          loadRated();
        }}
      />
    </>
  );

  // the list's per-batch action buttons (web intakeTableColumns "actions")
  function BatchActions({ batch }) {
    const canEdit = bucket === 'packed' && !isBatchVerified(batch);
    return (
      <View className="flex-row flex-wrap items-center gap-2">
        {canEdit && (
          <TouchableOpacity onPress={() => setEditBatch({ ...batch, intakeId: resolveBatchIntakeId(batch) })} className="flex-row items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
            <Icon name="settings" color="#334155" size={12} />
            <Text className="text-[11px] font-bold text-slate-700">Edit</Text>
          </TouchableOpacity>
        )}
        {isReceived && (
          batch.intakeStatus === 'pending_verification' ? (
            <TouchableOpacity onPress={() => setVerifyBatch(batch)} className="flex-row items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 shadow-2xs">
              <Icon name="camera" color="#ffffff" size={12} />
              <Text className="text-[11px] font-bold text-white">Scan to Verify</Text>
            </TouchableOpacity>
          ) : isRated(batch.intakeId || batch.returnId) ? (
            <View className="flex-row items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800">
              <Icon name="star" color="#f59e0b" size={12} />
              <Text className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Rated</Text>
            </View>
          ) : (
            <TouchableOpacity onPress={() => openRating(batch)} className="flex-row items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 dark:border-amber-700 dark:bg-amber-950/40">
              <Icon name="star" color="#d97706" size={12} />
              <Text className="text-[11px] font-bold text-amber-800 dark:text-amber-300">Rate Delivery</Text>
            </TouchableOpacity>
          )
        )}
      </View>
    );
  }

  // ── batch page ───────────────────────────────────────────────────────
  if (selected) {
    const verified = isBatchVerified(selected);
    const bats = selected.batteries || [];
    const reached = (b) => (verified || Boolean(b.verified_at)) && !HANDLED.includes(b.status);
    const metrics = {
      total: bats.length,
      reachedWorkshop: bats.filter(reached).length,
      inService: bats.filter((b) => IN_SERVICE.includes(b.status)).length,
      serviced: bats.filter((b) => b.status === 'repaired').length,
      unserviceable: bats.filter((b) => UNSERVICEABLE.includes(b.status)).length,
      returned: bats.filter((b) => b.status === 'returned').length,
      recycled: bats.filter((b) => b.status === 'recycled').length,
    };
    let list = bats;
    if (batchFilter === 'reached_workshop') list = list.filter(reached);
    else if (batchFilter === 'in_service') list = list.filter((b) => IN_SERVICE.includes(b.status));
    else if (batchFilter === 'serviced') list = list.filter((b) => b.status === 'repaired');
    else if (batchFilter === 'unserviceable') list = list.filter((b) => UNSERVICEABLE.includes(b.status));
    else if (batchFilter === 'returned') list = list.filter((b) => b.status === 'returned');
    else if (batchFilter === 'recycled') list = list.filter((b) => b.status === 'recycled');
    const q = batchSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((b) =>
        (b.battery_code && b.battery_code.toLowerCase().includes(q)) ||
        (b.serial_number && b.serial_number.toLowerCase().includes(q)) ||
        (b.status && b.status.toLowerCase().includes(q)) ||
        (b.notes && b.notes.toLowerCase().includes(q))
      );
    }
    const canEdit = bucket === 'packed' && !verified;
    const intakeId = resolveBatchIntakeId(selected);

    return (
      <>
        <FlatList
          data={list}
          keyExtractor={(row, i) => `${row.id}-${row.intake_id ?? row.return_id ?? i}`}
          contentContainerClassName="p-3 gap-2 pb-16"
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
          ListHeaderComponent={
            <View className="gap-2.5 pb-1">
              <TouchableOpacity onPress={() => { setSelectedKey(null); setBatchSearch(''); setBatchFilter('all'); setNotice(null); }} className="flex-row items-center gap-1">
                <Icon name="arrowLeft" color="#2563eb" size={14} />
                <Text className="text-xs font-bold text-blue-700">{isReceived ? 'Back to Received Batches' : 'Back to Intake List'}</Text>
              </TouchableOpacity>

              <View className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
                <Text className="text-base font-extrabold text-slate-900 dark:text-white">
                  {selected.isReturnDispatch
                    ? (selected.truckNumber ? `Return Dispatch • ${selected.truckNumber}` : 'Return Dispatch')
                    : selected.isAwaitingPickup
                    ? 'Client Packed Batch'
                    : `Truck ${selected.truckNumber}`}
                </Text>
                <Text className="text-[11px] text-slate-500">
                  {selected.isReturnDispatch
                    ? `Driver: ${selected.driverName || 'Workshop Driver'} • Delivered on ${formatDate(selected.intakeAt)}`
                    : selected.isAwaitingPickup
                    ? 'Scheduled for workshop truck intake pickup'
                    : `Driver: ${selected.driverName || '—'} • Intaked on ${formatDate(selected.intakeAt)}`}
                </Text>
                <View className="mt-2.5 flex-row flex-wrap items-center gap-1.5">
                  {selected.isReturnDispatch ? (
                    selected.intakeStatus === 'pending_verification' ? (
                      <>
                        <Badge tone="warning">● Pending Verification</Badge>
                        <TouchableOpacity onPress={() => setVerifyBatch(selected)} className="rounded-lg bg-emerald-600 px-2.5 py-1.5">
                          <Text className="text-[11px] font-bold text-white">📷 Scan to Verify Receipt</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <Badge tone="good">Received & Verified</Badge>
                        {isRated(selected.intakeId || selected.returnId) ? (
                          <Badge tone="warning">★ Rated — Thank You!</Badge>
                        ) : (
                          <TouchableOpacity onPress={() => openRating(selected)} className="rounded-lg bg-amber-500 px-2.5 py-1.5">
                            <Text className="text-[11px] font-bold text-white">★ Rate Delivery Batch</Text>
                          </TouchableOpacity>
                        )}
                      </>
                    )
                  ) : selected.intakeStatus === 'pending_arrival' ? (
                    <>
                      <Badge tone="warning">● Waiting for Verify</Badge>
                      {canEdit && (
                        <>
                          <TouchableOpacity onPress={() => setEditBatch({ ...selected, intakeId })} className="rounded-lg bg-slate-800 px-2.5 py-1.5">
                            <Text className="text-[11px] font-bold text-white">Edit Batch</Text>
                          </TouchableOpacity>
                          {selected.intakeId ? (
                            <TouchableOpacity onPress={() => setAddMoreBatch(selected)} className="rounded-lg bg-blue-600 px-2.5 py-1.5">
                              <Text className="text-[11px] font-bold text-white">+ Add Batteries</Text>
                            </TouchableOpacity>
                          ) : null}
                          {intakeId ? (
                            <TouchableOpacity onPress={() => cancelBatchConfirm(selected)} className="rounded-lg bg-red-600 px-2.5 py-1.5">
                              <Text className="text-[11px] font-bold text-white">Cancel Batch</Text>
                            </TouchableOpacity>
                          ) : null}
                        </>
                      )}
                    </>
                  ) : (
                    <Badge tone="info">Waiting for Service</Badge>
                  )}
                  <Badge tone="neutral">{bats.length} Batteries</Badge>
                </View>
              </View>

              {notice ? <Notice tone={notice.ok ? 'good' : 'bad'}>{notice.text}</Notice> : null}

              <View className="flex-row flex-wrap gap-1.5">
                {METRIC_CARDS.map((c) => {
                  const on = batchFilter === c.id;
                  return (
                    <TouchableOpacity key={c.id} onPress={() => setBatchFilter(c.id)} className={`w-[31.8%] rounded-xl border p-2 ${on ? c.on : c.cls}`}>
                      <Text className={`text-[9px] font-bold uppercase ${c.text}`} numberOfLines={1}>{c.label}</Text>
                      <Text className="mt-0.5 text-base font-extrabold text-slate-900">{metrics[c.key]}</Text>
                      <Text className="text-[9px] text-slate-500" numberOfLines={1}>{c.sub}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {batchFilter !== 'all' ? (
                <View className="flex-row items-center justify-between">
                  <Text className="text-[11px] text-slate-600">
                    Filtered by:{' '}
                    <Text className="font-bold capitalize text-slate-900">
                      {batchFilter === 'reached_workshop' ? 'Waiting for Service' : batchFilter.replace(/_/g, ' ')}
                    </Text>
                  </Text>
                  <TouchableOpacity onPress={() => setBatchFilter('all')}>
                    <Text className="text-[11px] font-bold text-blue-700">Clear filter</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              <View className="flex-row items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-900">
                <Icon name="search" color="#64748b" size={13} />
                <TextInput
                  value={batchSearch}
                  onChangeText={setBatchSearch}
                  placeholder="Search Battery ID, Serial, Status…"
                  placeholderTextColor="#94a3b8"
                  className="min-w-0 flex-1 text-xs text-slate-900 dark:text-white py-0"
                />
              </View>
            </View>
          }
          ListEmptyComponent={
            <Text className="py-8 text-center text-xs text-slate-400">No batteries match your selected status filter or search in this truck batch.</Text>
          }
          renderItem={({ item: row, index }) => (
            <View className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
              <View className="flex-row items-start justify-between gap-2">
                <TouchableOpacity onPress={() => goHistory(row)} className="flex-1">
                  <Text className="text-xs font-black font-mono text-emerald-700 dark:text-emerald-400">
                    <Text className="text-[10px] font-semibold text-slate-400">{index + 1}. </Text>
                    {row.battery_code}
                  </Text>
                </TouchableOpacity>
                {bucket === 'packed' ? (
                  <PackedRowStatus row={row} verified={verified || Boolean(row.verified_at)} />
                ) : (
                  <ClientStatusBadge
                    row={row}
                    isVerified={isReceived ? verified || row.return_status === 'verified' || Boolean(row.return_verified_at) : undefined}
                  />
                )}
              </View>
              <View className="mt-1 flex-row items-center justify-between gap-1.5">
                <Text className="text-[9px] font-bold uppercase text-slate-400">SN:</Text>
                {row.serial_number ? (
                  <Text className="text-[10px] font-semibold text-slate-800 dark:text-slate-100">{row.serial_number}</Text>
                ) : (
                  <TouchableOpacity onPress={() => setSerialTarget(row)} hitSlop={6}>
                    <Text className="text-[9.5px] font-bold text-blue-600 dark:text-blue-400">+ Add Serial</Text>
                  </TouchableOpacity>
                )}
              </View>
              {row.notes ? (
                <View className="mt-1 flex-row items-start justify-between gap-1.5">
                  <Text className="text-[9px] font-bold uppercase text-slate-400">Notes:</Text>
                  <Text className="flex-1 text-right text-[10px] text-slate-600 dark:text-slate-300" numberOfLines={2}>{row.notes}</Text>
                </View>
              ) : null}
              <View className="mt-1.5 flex-row justify-end gap-1.5 border-t border-slate-100 pt-1.5 dark:border-slate-800">
                {canEdit && (
                  <>
                    <TouchableOpacity onPress={() => setEditBattery(row)} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5">
                      <Text className="text-[10px] font-bold text-slate-700">Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removeBatteryConfirm(row)} className="rounded-md border border-red-200 bg-red-50 px-2 py-0.5">
                      <Text className="text-[10px] font-bold text-red-700">Remove</Text>
                    </TouchableOpacity>
                  </>
                )}
                <TouchableOpacity onPress={() => goHistory(row)} className="rounded-md bg-slate-100 px-2 py-0.5 dark:bg-slate-800">
                  <Text className="text-[10px] font-bold text-slate-700 dark:text-slate-200">History →</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
        {modals}
      </>
    );
  }

  // ── batch list ───────────────────────────────────────────────────────
  const shown = batches.slice(0, visible);
  return (
    <>
      <FlatList
        data={shown}
        keyExtractor={(b) => b.key}
        contentContainerClassName="p-3 gap-2 pb-16"
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
        onEndReached={() => visible < batches.length && setVisible((v) => v + PAGE)}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          <View className="items-center rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <Icon name="truck" color="#94a3b8" size={22} />
            <Text className="mt-2 text-xs font-semibold text-slate-800 dark:text-slate-100">{EMPTY[bucket]}</Text>
            {bucket === 'packed' ? <Text className="mt-0.5 text-center text-[11px] text-slate-400">Tap &apos;+ Add Intake&apos; to scan or enter batteries.</Text> : null}
          </View>
        }
        ListFooterComponent={
          batches.length > PAGE ? (
            <Text className="pt-2 text-center text-[10px] text-slate-400">
              Showing {shown.length} of {batches.length} batches • Scroll down to load more
            </Text>
          ) : null
        }
        renderItem={({ item: b, index }) =>
          viewMode === 'cards' ? (
            <TouchableOpacity onPress={() => { setNotice(null); setSelectedKey(b.key); }} className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
              <View className="flex-row items-start justify-between gap-2">
                <View className="flex-1">
                  <Text className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{b.isAwaitingPickup ? 'Client Shipment' : isReceived ? 'Return Dispatch' : 'Truck Intake'}</Text>
                  <Text className="text-sm font-extrabold text-slate-900 dark:text-white">{b.isAwaitingPickup ? 'Client Packed Batch' : b.truckNumber}</Text>
                </View>
                <Badge tone="info">{`${b.batteries.length} ${b.batteries.length === 1 ? 'Battery' : 'Batteries'}`}</Badge>
              </View>
              <View className="mt-2 gap-0.5">
                <Text className="text-[11px] text-slate-500">Driver: <Text className="font-bold text-slate-800 dark:text-slate-100">{b.driverName || '—'}</Text></Text>
                <Text className="text-[11px] text-slate-500">Date: <Text className="text-slate-700 dark:text-slate-200">{formatDate(b.intakeAt)}</Text></Text>
                <View className="flex-row items-center gap-1"><Text className="text-[11px] text-slate-500">Status:</Text><BatchStatus batch={b} /></View>
              </View>
              <View className="mt-2 flex-row items-center justify-between border-t border-slate-100 pt-2 dark:border-slate-800">
                <BatchActions batch={b} />
                <Text className="text-[11px] font-bold text-blue-700">View Details →</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => { setNotice(null); setSelectedKey(b.key); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
              <View className="flex-row items-center justify-between gap-2">
                <Text className="flex-1 text-xs font-extrabold text-blue-700" numberOfLines={1}>
                  <Text className="text-[11px] font-semibold text-slate-400">{index + 1}. </Text>
                  {b.isAwaitingPickup ? 'Client Packed Batch' : b.truckNumber}
                </Text>
                <BatchStatus batch={b} />
              </View>
              <View className="mt-1 flex-row flex-wrap gap-x-2.5">
                <Text className="text-[10px] text-slate-500">Driver: {b.driverName || '—'}</Text>
                <Text className="text-[10px] text-slate-500">Batteries: <Text className="font-bold text-slate-800 dark:text-slate-100">{b.batteries.length}</Text></Text>
                <Text className="text-[10px] text-slate-500">{formatDate(b.intakeAt)}</Text>
              </View>
              <View className="mt-1.5 flex-row items-center justify-between border-t border-slate-100 pt-1.5 dark:border-slate-800">
                <BatchActions batch={b} />
                <Text className="text-[11px] font-bold text-blue-700">View Details →</Text>
              </View>
            </TouchableOpacity>
          )
        }
      />
      {modals}
    </>
  );
}
