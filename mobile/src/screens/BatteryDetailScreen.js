import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import apiClient from '../services/api-client';
import { StatusBadge } from '../components/Badge';
import formatDuration from '../utils/format-duration';

function generateBatchId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const BLOCKED_STATUS_MESSAGES = {
  in_progress: 'This battery is already being worked on by another technician.',
  in_testing: 'This battery is currently in testing.',
  repaired: 'This battery has already been repaired.',
  returned: 'This battery has already been returned to the client.',
  unserviceable: 'This battery has been marked unserviceable.',
};

const PROCESS_STEPS = ['Intake', 'Started', 'Tested', 'Repaired', 'Returned'];
const STATUS_STEP_INDEX = { in_repair: 0, in_progress: 1, in_testing: 2, repaired: 3, returned: 4 };

const UNSERVICEABLE_STEPS = ['Intake', 'Started', 'Unserviceable', 'Recycled'];
const UNSERVICEABLE_STATUS_STEP_INDEX = { in_repair: 0, in_progress: 1, unserviceable: 2, recycled: 3 };

function ProcessStepper({ isOngoing, batteryStatus }) {
  const isUnserviceableFlow =
    isOngoing && (batteryStatus === 'unserviceable' || batteryStatus === 'recycled');
  const steps = isUnserviceableFlow ? UNSERVICEABLE_STEPS : PROCESS_STEPS;
  const stepIndex = isUnserviceableFlow ? UNSERVICEABLE_STATUS_STEP_INDEX : STATUS_STEP_INDEX;

  const threshold = isOngoing ? stepIndex[batteryStatus] ?? 0 : steps.length - 1;

  return (
    <View className="flex-row items-center justify-between py-2">
      {steps.map((label, i) => {
        const isDone = i <= threshold;
        const isCurrent = i === threshold + 1;
        const isDanger = isUnserviceableFlow && i >= 2 && isDone;

        return (
          <View key={label} className="flex-1 items-center">
            <View className="flex-row items-center w-full">
              {i > 0 && (
                <View
                  className={`h-0.5 flex-1 ${
                    isDone ? (isDanger ? 'bg-red-500' : 'bg-emerald-500') : 'bg-slate-800'
                  }`}
                />
              )}
              <View
                className={`h-6 w-6 items-center justify-center rounded-full ${
                  isDanger
                    ? 'bg-red-600'
                    : isDone
                      ? 'bg-emerald-600'
                      : isCurrent
                        ? 'bg-blue-600'
                        : 'bg-slate-800'
                }`}
              >
                <Text className="text-[10px] font-bold text-white">
                  {isDone ? '✓' : i + 1}
                </Text>
              </View>
              {i < steps.length - 1 && (
                <View
                  className={`h-0.5 flex-1 ${
                    i < threshold ? (isDanger ? 'bg-red-500' : 'bg-emerald-500') : 'bg-slate-800'
                  }`}
                />
              )}
            </View>
            <Text
              numberOfLines={1}
              className={`mt-1 text-[10px] font-semibold ${
                isDone ? 'text-slate-200' : 'text-slate-600'
              }`}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function buildEvents(visits = [], history = [], returns = [], issues = []) {
  const events = [];

  visits.forEach((v) => {
    events.push({
      key: `intake-${v.visit_id || v.id}`,
      type: 'intake',
      label: 'Intake Received',
      icon: '🚚',
      date: v.intake_at,
      primary: `Truck ${v.truck_number || '—'} · Driver ${v.driver_name || '—'}`,
    });
  });

  history.forEach((h) => {
    events.push({
      key: `repair-${h.id}`,
      type: 'repair',
      label: 'Repair Logged',
      icon: '🔧',
      date: h.repaired_at,
      primary: `${h.part_name} · by ${h.staff_name || 'Technician'}`,
      price: Number(h.price || 0) + Number(h.labor_charge || 0),
      notes: h.notes,
    });
  });

  returns.forEach((r) => {
    events.push({
      key: `return-${r.id}`,
      type: 'return',
      label: 'Returned to Client',
      icon: '📦',
      date: r.returned_at,
      primary: `Truck ${r.truck_number || '—'} · Driver ${r.driver_name || '—'}`,
    });
  });

  issues.forEach((iss) => {
    events.push({
      key: `issue-${iss.id}`,
      type: 'issue',
      label: 'Reported Issue',
      icon: '⚠️',
      date: iss.reported_at,
      primary: `${iss.reason_label} · by ${iss.staff_name || 'Technician'}`,
      notes: iss.note,
    });
  });

  return events.sort((a, b) => new Date(a.date) - new Date(b.date));
}

function buildCycles(events) {
  const cycles = [];
  let current = [];

  for (const event of events) {
    current.push(event);
    if (event.type === 'return') {
      cycles.push(current);
      current = [];
    }
  }
  if (current.length > 0) cycles.push(current);

  return cycles;
}

export default function BatteryDetailScreen() {
  const { code, fromScan } = useRoute().params || {};
  const navigation = useNavigation();
  const currentUser = useSelector((state) => state.auth.user);
  const currentUserId = currentUser?.id;
  const isClient = currentUser?.role === 'client';
  const isTechnician = currentUser?.role === 'technician';
  const staffRole = (currentUser?.staff_role || '').toLowerCase();
  const canTest =
    currentUser?.role === 'super_admin' ||
    currentUser?.role === 'admin' ||
    staffRole === 'supervisor' ||
    staffRole === 'manager' ||
    staffRole === 'tester' ||
    staffRole === 'qa';

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Technician state
  const [parts, setParts] = useState([]);
  const [selectedPartIds, setSelectedPartIds] = useState([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [testingElapsedSeconds, setTestingElapsedSeconds] = useState(0);

  const [blockedStatus, setBlockedStatus] = useState(null);
  const [showCompletedModal, setShowCompletedModal] = useState(false);
  const [showSubmittedModal, setShowSubmittedModal] = useState(false);

  const [issueReasons, setIssueReasons] = useState([]);
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [selectedReasonId, setSelectedReasonId] = useState(null);
  const [issueNote, setIssueNote] = useState('');

  // Battery Number assign/edit modal state
  const [showSerialModal, setShowSerialModal] = useState(false);
  const [serialInput, setSerialInput] = useState('');
  const [serialSaving, setSerialSaving] = useState(false);
  const [serialError, setSerialError] = useState(null);

  const isInitialLoad = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get(`/batteries/${encodeURIComponent(code)}`);
      if (isInitialLoad.current && !isClient) {
        isInitialLoad.current = false;
        const isOwnInProgress =
          data.battery?.status === 'in_progress' &&
          data.battery?.started_by_user_id === currentUserId;
        const canTestInTesting = canTest && data.battery?.status === 'in_testing';
        if (fromScan && data.battery?.status !== 'in_repair' && !isOwnInProgress && !canTestInTesting) {
          setBlockedStatus(data.battery.status);
          return;
        }
      }
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [code, fromScan, currentUserId, isClient, canTest]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (result?.battery?.status !== 'in_progress' || isClient) return;
    apiClient
      .get('/parts')
      .then(({ data }) => setParts(data))
      .catch(() => setParts([]));
    apiClient
      .get('/issue-reasons', { params: { activeOnly: true } })
      .then(({ data }) => setIssueReasons(data))
      .catch(() => setIssueReasons([]));
  }, [result?.battery?.status, isClient]);

  const workStartedAt = result?.battery?.work_started_at;
  useEffect(() => {
    if (result?.battery?.status !== 'in_progress' || !workStartedAt || isClient) return;
    const startMs = new Date(workStartedAt).getTime();
    function tick() {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [result?.battery?.status, workStartedAt, isClient]);

  const testingStartedAt = result?.battery?.testing_started_at;
  useEffect(() => {
    if (result?.battery?.status !== 'in_testing' || !testingStartedAt || isClient) return;
    const startMs = new Date(testingStartedAt).getTime();
    function tick() {
      setTestingElapsedSeconds(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [result?.battery?.status, testingStartedAt, isClient]);

  async function handleStartWork() {
    setSubmitting(true);
    setActionError(null);
    try {
      await apiClient.patch(`/batteries/${result.battery.id}/start-work`);
      await load();
    } catch (err) {
      setActionError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCompleteTesting() {
    setSubmitting(true);
    setActionError(null);
    try {
      await apiClient.patch(`/batteries/${result.battery.id}/complete-testing`);
      await load();
      setShowCompletedModal(true);
    } catch (err) {
      setActionError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReportIssue() {
    if (!selectedReasonId) {
      setActionError('Select a reason');
      return;
    }
    setSubmitting(true);
    setActionError(null);
    try {
      await apiClient.patch(`/batteries/${result.battery.id}/report-issue`, {
        reasonId: selectedReasonId,
        note: issueNote || undefined,
      });
      setShowIssueForm(false);
      setSelectedReasonId(null);
      setIssueNote('');
      await load();
    } catch (err) {
      setActionError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function togglePart(id) {
    setSelectedPartIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  async function handleComplete() {
    if (selectedPartIds.length === 0) {
      setActionError('Select at least one part');
      return;
    }
    setSubmitting(true);
    setActionError(null);
    try {
      const batchId = generateBatchId();
      for (const partId of selectedPartIds) {
        await apiClient.post('/repairs', {
          batteryId: result.battery.id,
          partId,
          notes: notes || undefined,
          batchId,
        });
      }
      setSelectedPartIds([]);
      setNotes('');
      await load();
      if (!canTest) {
        setShowSubmittedModal(true);
      }
    } catch (err) {
      setActionError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function openSerialModal() {
    setSerialInput(result?.battery?.serial_number || '');
    setSerialError(null);
    setShowSerialModal(true);
  }

  async function handleSerialSave() {
    setSerialSaving(true);
    setSerialError(null);
    try {
      await apiClient.patch(`/batteries/${result.battery.id}/serial-number`, {
        serialNumber: serialInput.trim(),
      });
      setShowSerialModal(false);
      await load();
    } catch (err) {
      setSerialError(err.response?.data?.message || err.message);
    } finally {
      setSerialSaving(false);
    }
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-950">
        <ActivityIndicator color="#38bdf8" />
        <Text className="mt-2 text-xs text-slate-400 font-medium">Loading battery lifecycle…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-950 px-6">
        <Text className="mb-4 text-center text-sm text-red-400 font-medium">{error}</Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="rounded-xl bg-slate-800 px-5 py-2.5"
        >
          <Text className="text-sm font-semibold text-white">Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!result && blockedStatus) {
    return (
      <Modal
        visible={!!blockedStatus}
        transparent
        animationType="fade"
        onRequestClose={() => navigation.goBack()}
      >
        <View className="flex-1 items-center justify-center bg-slate-950/80 px-6 backdrop-blur-md">
          <View className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <View className="mb-4 h-12 w-12 items-center justify-center rounded-2xl bg-red-950/80 border border-red-800/50">
              <Text className="text-2xl">⏳</Text>
            </View>
            <Text className="mb-1.5 text-lg font-bold text-white">Not Available</Text>
            <Text className="mb-5 text-xs text-slate-400 leading-relaxed">
              {BLOCKED_STATUS_MESSAGES[blockedStatus] || 'This battery is not available to start work on.'}
            </Text>
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                className="flex-1 items-center rounded-xl bg-slate-800 py-3.5"
              >
                <Text className="text-xs font-bold text-slate-300">Go Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setBlockedStatus(null);
                  navigation.navigate('Main', {
                    screen: 'Service',
                    params: { autoScan: Date.now() },
                  });
                }}
                className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-3.5 shadow-md"
              >
                <Text className="text-sm">📷</Text>
                <Text className="text-xs font-bold text-white">Scan Next</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  const { battery, history = [], returns = [], visits = [], issues = [], recycleBatch } = result || {};
  const cycles = buildCycles(buildEvents(visits, history, returns, issues));
  const isClientLocked = battery.serial_number_added_by_role === 'client';
  const totalSpent = history.reduce(
    (sum, h) => sum + Number(h.price || 0) + Number(h.labor_charge || 0),
    0
  );

  return (
    <ScrollView className="flex-1 bg-slate-950" contentContainerClassName="p-5 pb-16">
      {/* ── Executive Header ─────────────────────────────────────────────── */}
      <View className="mb-5 rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-black text-white">{battery.battery_code}</Text>
          <StatusBadge status={battery.status} />
        </View>
        <Text className="mt-1 text-xs text-slate-400">
          Client: <Text className="font-semibold text-slate-200">{battery.client_name || '—'}</Text> · Tracked since{' '}
          {battery.created_at ? new Date(battery.created_at).toLocaleDateString() : '—'}
        </Text>
      </View>

      {/* ── Physical Battery Number Card ─────────────────────────────────── */}
      <View className="mb-5 flex-row items-center justify-between rounded-2xl border border-slate-800/80 bg-slate-900 p-4 shadow-sm">
        <View className="flex-1 mr-2">
          <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Physical Battery Number
          </Text>
          {battery.serial_number ? (
            <View className="mt-1 flex-row items-center gap-2 flex-wrap">
              <Text className="text-sm font-bold text-white">{battery.serial_number}</Text>
              <View
                className={`rounded-full px-2.5 py-0.5 border ${
                  isClientLocked
                    ? 'bg-amber-950/60 border-amber-800/40'
                    : 'bg-slate-800 border-slate-700'
                }`}
              >
                <Text
                  className={`text-[10px] font-bold ${
                    isClientLocked ? 'text-amber-400' : 'text-slate-400'
                  }`}
                >
                  {isClientLocked ? '🔒 Set by you' : 'Admin set'}
                </Text>
              </View>
            </View>
          ) : (
            <Text className="mt-1 text-xs text-slate-500 italic">No serial number assigned</Text>
          )}
        </View>
        {(isClient || (!isClientLocked && !isTechnician)) && (
          <TouchableOpacity
            onPress={openSerialModal}
            className="rounded-xl bg-blue-600/20 px-3.5 py-2 border border-blue-500/30 active:bg-blue-600/30"
          >
            <Text className="text-xs font-bold text-blue-400">
              {battery.serial_number ? 'Edit' : '+ Assign Number'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Technician Action Panels (if technician) ─────────────────────── */}
      {isTechnician && (
        <>
          {actionError && <Text className="mb-3 text-xs text-red-400 font-medium">{actionError}</Text>}

          {battery.status === 'in_repair' && (
            <View className="mb-5 rounded-2xl border border-blue-800/40 bg-blue-950/30 p-4">
              <Text className="text-sm font-bold text-white">Ready to start?</Text>
              <Text className="mt-0.5 mb-3 text-xs text-slate-400">
                This battery hasn't been touched yet. Starting work marks it as in progress.
              </Text>
              <TouchableOpacity
                onPress={handleStartWork}
                disabled={submitting}
                className="items-center rounded-xl bg-blue-600 py-3.5 shadow-md disabled:opacity-50"
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-sm font-bold text-white">Start Work</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {battery.status === 'in_progress' && (
            <View className="mb-5 rounded-2xl border border-blue-800/40 bg-blue-950/30 p-4">
              <View className="mb-3 flex-row items-center justify-between rounded-xl bg-emerald-950/40 border border-emerald-800/40 px-3.5 py-2.5">
                <Text className="text-xs font-bold text-emerald-400">Time on repair</Text>
                <Text className="text-base font-extrabold text-emerald-300">
                  {formatDuration(elapsedSeconds)}
                </Text>
              </View>

              {!showIssueForm && (
                <>
                  <Text className="mb-2 text-xs font-bold text-white">
                    Select Parts Changed ({selectedPartIds.length})
                  </Text>
                  <View className="gap-2">
                    {parts.map((p) => {
                      const selected = selectedPartIds.includes(p.id);
                      const disabled = p.quantity <= 0;
                      return (
                        <TouchableOpacity
                          key={p.id}
                          disabled={disabled}
                          onPress={() => togglePart(p.id)}
                          className={`flex-row items-center justify-between rounded-xl border p-3 ${
                            selected
                              ? 'border-blue-500 bg-blue-500/20'
                              : 'border-slate-800 bg-slate-900'
                          } ${disabled ? 'opacity-40' : ''}`}
                        >
                          <Text className="text-xs font-bold text-white">{p.name}</Text>
                          <Text className="text-[10px] text-slate-400">{p.quantity} in stock</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <TextInput
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Notes (optional)"
                    placeholderTextColor="#64748b"
                    className="mt-3 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs text-white"
                  />

                  <TouchableOpacity
                    onPress={handleComplete}
                    disabled={submitting}
                    className="mt-3 items-center rounded-xl bg-blue-600 py-3.5 shadow-md disabled:opacity-50"
                  >
                    {submitting ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text className="text-sm font-bold text-white">Submit for Testing</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}

              <View className={showIssueForm ? 'pt-0' : 'mt-4 border-t border-slate-800 pt-3'}>
                {!showIssueForm ? (
                  <TouchableOpacity
                    onPress={() => setShowIssueForm(true)}
                    className="items-center rounded-xl border border-red-800/60 bg-red-950/20 py-3"
                  >
                    <Text className="text-xs font-bold text-red-400">
                      Can't service this battery?
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View>
                    <Text className="text-xs font-bold text-white">Report Issue</Text>
                    <View className="mt-2 gap-1.5">
                      {issueReasons.map((reason) => (
                        <TouchableOpacity
                          key={reason.id}
                          onPress={() => setSelectedReasonId(reason.id)}
                          className={`rounded-xl border p-2.5 ${
                            selectedReasonId === reason.id
                              ? 'border-red-500 bg-red-500/20'
                              : 'border-slate-800 bg-slate-900'
                          }`}
                        >
                          <Text className="text-xs font-medium text-white">{reason.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TextInput
                      value={issueNote}
                      onChangeText={setIssueNote}
                      placeholder="Note (optional)"
                      placeholderTextColor="#64748b"
                      className="mt-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                    />
                    <View className="mt-3 flex-row gap-2">
                      <TouchableOpacity
                        onPress={() => setShowIssueForm(false)}
                        className="flex-1 items-center rounded-xl bg-slate-800 py-2.5"
                      >
                        <Text className="text-xs font-medium text-slate-400">Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleReportIssue}
                        disabled={submitting}
                        className="flex-1 items-center rounded-xl bg-red-600 py-2.5"
                      >
                        <Text className="text-xs font-bold text-white">Report Issue</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            </View>
          )}

          {battery.status === 'in_testing' && (
            <View className="mb-5 rounded-2xl border border-blue-800/40 bg-blue-950/30 p-4">
              <View className="mb-3 flex-row items-center justify-between rounded-xl bg-blue-950/60 border border-blue-800/40 px-3.5 py-2.5">
                <Text className="text-xs font-bold text-blue-400">Time in testing</Text>
                <Text className="text-base font-extrabold text-blue-300">
                  {formatDuration(testingElapsedSeconds)}
                </Text>
              </View>
              {canTest ? (
                <TouchableOpacity
                  onPress={handleCompleteTesting}
                  disabled={submitting}
                  className="items-center rounded-xl bg-blue-600 py-3.5 shadow-md disabled:opacity-50"
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-sm font-bold text-white">Complete Testing</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <View className="rounded-xl border border-emerald-800/30 bg-emerald-950/20 p-3.5">
                  <View className="flex-row items-center gap-2 mb-1.5">
                    <Text className="text-emerald-400 text-sm font-bold">✓</Text>
                    <Text className="text-xs font-bold text-emerald-400">
                      Repair Completed · In Testing Queue
                    </Text>
                  </View>
                  <Text className="text-[11px] text-slate-400 mb-3 leading-relaxed">
                    Your repair work on this battery is finished. QA / Supervisors will test and approve.
                  </Text>
                  <TouchableOpacity
                    onPress={() =>
                      navigation.navigate('Main', {
                        screen: 'Service',
                        params: { autoScan: Date.now() },
                      })
                    }
                    className="flex-row items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 shadow-md shadow-blue-600/30"
                  >
                    <Text className="text-base">📷</Text>
                    <Text className="text-xs font-bold text-white">Scan Next Battery</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </>
      )}

      {/* ── Summary Stats ────────────────────────────────────────────────── */}
      <View className="mb-5 flex-row gap-3">
        <View className="flex-1 rounded-2xl border border-slate-800 bg-slate-900 p-3.5 shadow-sm">
          <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Repairs</Text>
          <Text className="mt-0.5 text-lg font-black text-white">{history.length}</Text>
        </View>
        <View className="flex-1 rounded-2xl border border-slate-800 bg-slate-900 p-3.5 shadow-sm">
          <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Returns</Text>
          <Text className="mt-0.5 text-lg font-black text-white">{returns.length}</Text>
        </View>
        {isClient && (
          <View className="flex-1 rounded-2xl border border-amber-500/30 bg-amber-950/20 p-3.5 shadow-sm">
            <Text className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Total Spent</Text>
            <Text className="mt-0.5 text-lg font-black text-amber-300">£{totalSpent.toFixed(2)}</Text>
          </View>
        )}
      </View>

      {/* ── Complete Lifecycle Cycles ────────────────────────────────────── */}
      <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
        Lifecycle & Repair Timeline
      </Text>

      {cycles.length === 0 ? (
        <View className="rounded-3xl border border-slate-800 bg-slate-900 p-8 items-center">
          <Text className="text-xs text-slate-500 font-medium">No events recorded for this battery yet.</Text>
        </View>
      ) : (
        <View className="gap-4">
          {cycles.map((cycle, i) => {
            const isOngoing = i === cycles.length - 1 && !cycle.some((e) => e.type === 'return');
            return (
              <View
                key={`cycle-${i}`}
                className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-xl"
              >
                <View className="flex-row items-center justify-between border-b border-slate-800/80 bg-slate-950 px-4 py-3">
                  <Text className="text-xs font-black tracking-widest text-slate-300">CYCLE {i + 1}</Text>
                  <View className={`rounded-full px-2.5 py-0.5 border ${
                    isOngoing ? 'bg-amber-950/60 border-amber-800/50' : 'bg-emerald-950/60 border-emerald-800/50'
                  }`}>
                    <Text className={`text-[10px] font-extrabold ${
                      isOngoing ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      {isOngoing ? 'With Shop' : 'Completed'}
                    </Text>
                  </View>
                </View>

                <View className="border-b border-slate-800/60 p-3.5 bg-slate-950/40">
                  <ProcessStepper isOngoing={isOngoing} batteryStatus={battery.status} />
                </View>

                <View className="p-4 gap-4">
                  {cycle.map((event) => (
                    <View key={event.key} className="flex-row gap-3">
                      <View className="h-9 w-9 items-center justify-center rounded-2xl bg-slate-800 border border-slate-700">
                        <Text className="text-base">{event.icon}</Text>
                      </View>
                      <View className="flex-1">
                        <View className="flex-row items-center justify-between">
                          <Text className="text-xs font-bold text-white">{event.label}</Text>
                          <Text className="text-[10px] text-slate-500 font-medium">
                            {event.date ? new Date(event.date).toLocaleDateString() : ''}
                          </Text>
                        </View>
                        <Text className="mt-0.5 text-xs text-slate-300">{event.primary}</Text>
                        {event.notes && (
                          <Text className="mt-1 text-[11px] text-slate-400 italic">
                            "{event.notes}"
                          </Text>
                        )}
                        {isClient && event.price !== undefined && event.price > 0 && (
                          <Text className="mt-1 text-[10px] font-bold text-emerald-400">
                            Service Cost: £{Number(event.price).toFixed(2)}
                          </Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* ── Serial Number Modal (Dark Executive) ──────────────────────────── */}
      {showSerialModal && (
        <Modal
          visible={showSerialModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowSerialModal(false)}
        >
          <View className="flex-1 items-center justify-center bg-slate-950/80 px-6 backdrop-blur-md">
            <View className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
              <Text className="text-base font-extrabold text-white">
                Physical Battery Number
              </Text>
              <Text className="mt-1 text-xs text-slate-400">
                Enter manufacturer serial printed on the battery.
              </Text>

              <TextInput
                value={serialInput}
                onChangeText={setSerialInput}
                placeholder="e.g. SN-88213"
                placeholderTextColor="#64748b"
                autoFocus
                className="mt-4 rounded-2xl border border-slate-700 bg-slate-950 p-3.5 text-sm text-white focus:border-blue-500"
              />

              {serialError && (
                <Text className="mt-2 text-xs text-red-400 font-medium">{serialError}</Text>
              )}

              <View className="mt-6 flex-row justify-end gap-2.5">
                <TouchableOpacity
                  onPress={() => setShowSerialModal(false)}
                  className="rounded-xl px-4 py-2.5"
                >
                  <Text className="text-sm font-medium text-slate-400">Cancel</Text>
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

      {/* ── Submitted for Testing Modal (For Technician) ─────────────────── */}
      <Modal
        visible={showSubmittedModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowSubmittedModal(false);
          navigation.goBack();
        }}
      >
        <View className="flex-1 items-center justify-center bg-slate-950/80 px-6 backdrop-blur-md">
          <View className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <View className="mb-4 h-12 w-12 items-center justify-center rounded-2xl bg-emerald-950 border border-emerald-800/40">
              <Text className="text-2xl">⚡</Text>
            </View>
            <Text className="mb-1.5 text-lg font-bold text-white">Work Submitted!</Text>
            <Text className="mb-5 text-xs text-slate-400 leading-relaxed">
              <Text className="font-bold text-slate-200">{battery?.battery_code}</Text> has been submitted for testing. Your repair work on this battery is done.
            </Text>
            <View className="gap-2.5">
              <TouchableOpacity
                onPress={() => {
                  setShowSubmittedModal(false);
                  navigation.navigate('Main', {
                    screen: 'Service',
                    params: { autoScan: Date.now() },
                  });
                }}
                className="flex-row items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 shadow-md"
              >
                <Text className="text-base">📷</Text>
                <Text className="text-sm font-bold text-white">Scan Next Battery</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setShowSubmittedModal(false);
                  navigation.goBack();
                }}
                className="items-center rounded-xl bg-slate-800 py-3"
              >
                <Text className="text-xs font-semibold text-slate-300">Back to Service List</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Completed Modal ──────────────────────────────────────────────── */}
      <Modal
        visible={showCompletedModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCompletedModal(false)}
      >
        <View className="flex-1 items-center justify-center bg-slate-950/80 px-6 backdrop-blur-md">
          <View className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <View className="mb-4 h-12 w-12 items-center justify-center rounded-2xl bg-emerald-950 border border-emerald-800/40">
              <Text className="text-2xl">✅</Text>
            </View>
            <Text className="mb-1.5 text-lg font-bold text-white">Completed!</Text>
            <Text className="mb-5 text-xs text-slate-400 leading-relaxed">
              {battery.battery_code} has been tested and marked as repaired.
            </Text>
            <TouchableOpacity
              onPress={() => {
                setShowCompletedModal(false);
                navigation.goBack();
              }}
              className="items-center rounded-xl bg-blue-600 py-3.5 shadow-md"
            >
              <Text className="text-sm font-bold text-white">Back to List</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
