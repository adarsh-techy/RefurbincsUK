import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import apiClient from '../../../services/api-client';
import ScanBatteryInput from '../../scan/ScanBatteryInput';
import { resolveBatteryInput, UNASSIGNED_TAG_MESSAGE, scanThen } from '../../../utils/scan-input';
import { Btn, Notice, Sheet } from './common';

// "Scan to Verify Receipt" — the web ClientReturnVerifyModal. Loads the
// return (GET /returns/:id, falling back to the batch's own rows), lets the
// client scan (RFID / QR / code / serial) or tap each battery off the truck,
// shows progress, verified (with time + undo) and awaiting lists, and
// confirms with PATCH /returns/:id/verify-receipt once at least one battery
// is verified. onSuccess(batteries) then opens the rating form.

const timeText = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export default function ReturnVerifyModal({ batch, onClose, onSuccess }) {
  const returnId = batch ? batch.intakeId || batch.returnId : null;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scanned, setScanned] = useState([]); // codes, in scan order
  const [scannedAt, setScannedAt] = useState({});
  const [feedback, setFeedback] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState(null);

  useEffect(() => {
    if (!batch) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setScanned([]);
    setScannedAt({});
    setFeedback(null);
    setConfirmError(null);
    const fallback = {
      returnRecord: {
        id: returnId || batch.key,
        truck_number: batch.truckNumber,
        driver_name: batch.driverName,
        returned_at: batch.intakeAt,
        status: batch.intakeStatus,
      },
      batteries: batch.batteries || [],
    };
    if (!returnId) {
      setData(fallback);
      setLoading(false);
      return undefined;
    }
    apiClient
      .get(`/returns/${returnId}`)
      .then((res) => !cancelled && setData(res.data))
      .catch(() => !cancelled && setData(fallback))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [batch, returnId]);

  const list = useMemo(() => data?.batteries || [], [data]);
  const expected = useMemo(() => list.map((b) => b.battery_code.toUpperCase()), [list]);
  const scannedSet = useMemo(() => new Set(scanned), [scanned]);
  const allScanned = expected.length > 0 && expected.every((c) => scannedSet.has(c));
  const remaining = list.filter((b) => !scannedSet.has(b.battery_code.toUpperCase()));
  const pct = expected.length ? Math.round((scanned.length / expected.length) * 100) : 0;

  function handleScan(raw) {
    const resolved = resolveBatteryInput(raw, list);
    if (resolved.unassignedTag) return { tone: 'bad', message: `${UNASSIGNED_TAG_MESSAGE} (tag ${resolved.code})` };
    const value = (resolved.code || '').trim();
    if (!value) return undefined;
    const q = value.toUpperCase();
    const match = list.find((b) => b.battery_code.toUpperCase() === q || (b.serial_number && b.serial_number.toUpperCase() === q));
    const code = match ? match.battery_code.toUpperCase() : q;
    if (scannedSet.has(code)) return { tone: 'warn', message: `${code} was already verified.` };
    if (!expected.includes(code)) return { tone: 'bad', message: `"${value}" is not in this return shipment.` };
    const now = new Date();
    setScanned((prev) => [...prev, code]);
    setScannedAt((prev) => ({ ...prev, [code]: now }));
    return { tone: 'good', message: `✓ ${code}${match?.serial_number ? ` (SN: ${match.serial_number})` : ''} verified at ${timeText(now)}.` };
  }

  function tap(code) {
    const res = handleScan(code);
    setFeedback(res || null);
  }

  function undo(code) {
    setScanned((prev) => prev.filter((c) => c !== code));
    setScannedAt((prev) => {
      const next = { ...prev };
      delete next[code];
      return next;
    });
    setFeedback({ tone: 'warn', message: `${code} verification undone.` });
  }

  async function confirmReceipt() {
    setConfirming(true);
    setConfirmError(null);
    try {
      const id = returnId || data?.returnRecord?.id;
      await apiClient.patch(`/returns/${id}/verify-receipt`);
      onSuccess?.(data?.batteries?.length ? data.batteries : batch?.batteries || []);
      onClose();
    } catch (err) {
      setConfirmError(err.response?.data?.message || err.message);
    } finally {
      setConfirming(false);
    }
  }

  const rec = data?.returnRecord;
  return (
    <Sheet
      visible={Boolean(batch)}
      title="Scan to Verify Battery Receipt"
      description={
        rec
          ? `Truck: ${rec.truck_number || 'Return Dispatch'} · Driver: ${rec.driver_name || 'Workshop Driver'} · Dispatched on ${rec.returned_at ? new Date(rec.returned_at).toLocaleDateString() : '—'}`
          : 'Verifying return shipment batteries'
      }
      onClose={onClose}
      footer={
        loading || error ? null : (
          <View>
            <Text className="mb-2 text-center text-[11px] font-semibold text-slate-500">
              {scanned.length > 0 ? `${scanned.length} of ${expected.length} verified` : 'Scan batteries off the truck to verify'}
            </Text>
            {confirmError ? <Text className="mb-2 text-center text-xs font-semibold text-red-600">{confirmError}</Text> : null}
            <View className="flex-row gap-2">
              <Btn label="Cancel" tone="ghost" onPress={onClose} className="flex-1" />
              <Btn
                label={confirming ? 'Saving Receipt…' : `✓ Confirm Receipt (${scanned.length}/${expected.length})`}
                onPress={confirmReceipt}
                disabled={scanned.length === 0 || confirming}
                className="flex-[2]"
              />
            </View>
          </View>
        )
      }
    >
      {loading ? (
        <View className="items-center py-10">
          <ActivityIndicator color="#2563eb" />
          <Text className="mt-2 text-xs text-slate-500">Loading return shipment details…</Text>
        </View>
      ) : error ? (
        <Notice tone="bad">{error}</Notice>
      ) : (
        <>
          <View className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
            <View className="flex-row items-center justify-between gap-2">
              <View className="flex-1">
                <Text className="text-xs font-bold text-slate-800 dark:text-slate-100">Verification Progress</Text>
                <Text className="text-[11px] text-slate-500">
                  {scanned.length} of {expected.length} batteries verified ({pct}%)
                </Text>
              </View>
              <Text className={`text-[11px] font-bold ${allScanned ? 'text-emerald-700' : 'text-amber-700'}`}>
                {allScanned ? '✓ All Batteries Verified' : `${expected.length - scanned.length} remaining to scan`}
              </Text>
            </View>
            <View className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <View className={`h-2 rounded-full ${allScanned ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${pct}%` }} />
            </View>
          </View>

          <ScanBatteryInput
            onSubmit={(raw) => scanThen(raw, list, handleScan)}
            feedback={feedback}
            submitLabel="Verify"
            placeholder="Scan QR / RFID or type battery code"
            startInRfidMode
          />

          <View>
            <View className="mb-1.5 flex-row items-center justify-between">
              <Text className="text-xs font-bold text-emerald-700">✓ Verified ({scanned.length})</Text>
              <Text className="text-[10px] font-semibold text-slate-400">Ready to receive</Text>
            </View>
            {scanned.length === 0 ? (
              <Text className="rounded-xl border border-dashed border-slate-300 p-3 text-center text-[11px] text-slate-400">
                No batteries verified yet. Scan or type codes above.
              </Text>
            ) : (
              [...scanned].reverse().map((code) => {
                const match = list.find((b) => b.battery_code.toUpperCase() === code);
                return (
                  <View key={code} className="mb-1.5 flex-row items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-800/50 dark:bg-emerald-950/30">
                    <Text className="flex-1 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                      {code}
                      {match?.serial_number ? <Text className="font-normal text-emerald-700"> (SN: {match.serial_number})</Text> : null}
                      {scannedAt[code] ? <Text className="font-normal text-slate-500">  {timeText(scannedAt[code])}</Text> : null}
                    </Text>
                    <TouchableOpacity onPress={() => undo(code)} hitSlop={8}>
                      <Text className="text-xs font-bold text-slate-500">✕</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </View>

          <View>
            <View className="mb-1.5 flex-row items-center justify-between">
              <Text className="text-xs font-bold text-slate-700 dark:text-slate-200">Awaiting Scan ({remaining.length})</Text>
              <Text className="text-[10px] font-semibold text-slate-400">Off truck list</Text>
            </View>
            {remaining.length === 0 ? (
              <Text className="rounded-xl border border-dashed border-emerald-300 p-3 text-center text-[11px] font-semibold text-emerald-700">
                🎉 All shipment batteries have been scanned!
              </Text>
            ) : (
              remaining.map((b) => (
                <TouchableOpacity
                  key={b.id || b.battery_code}
                  onPress={() => tap(b.battery_code)}
                  className="mb-1.5 flex-row items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900"
                >
                  <Text className="text-xs font-bold text-slate-800 dark:text-slate-100">{b.battery_code}</Text>
                  {b.serial_number ? <Text className="text-[11px] text-slate-500">SN: {b.serial_number}</Text> : null}
                </TouchableOpacity>
              ))
            )}
          </View>
        </>
      )}
    </Sheet>
  );
}
