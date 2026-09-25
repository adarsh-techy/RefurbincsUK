import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSelector } from 'react-redux';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute } from '@react-navigation/native';
import apiClient from '../../services/api-client';
import { StatusBadge } from '../../components/ui/Badge';
import Icon from '../../components/ui/Icon';
import ImageViewerModal from '../../components/ui/ImageViewerModal';
import formatDuration from '../../utils/format-duration';
import { resolveImageUrl } from '../../utils/imageUrl';

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
                    isDone ? (isDanger ? 'bg-red-500' : 'bg-emerald-500') : 'bg-slate-200'
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
                        : 'bg-slate-200'
                }`}
              >
                {isDone ? (
                  <Icon name="check" color="#ffffff" size={12} strokeWidth={3} />
                ) : (
                  <Text className={`text-[10px] font-bold ${isCurrent || isDanger ? 'text-white' : 'text-slate-500'}`}>
                    {i + 1}
                  </Text>
                )}
              </View>
              {i < steps.length - 1 && (
                <View
                  className={`h-0.5 flex-1 ${
                    i < threshold ? (isDanger ? 'bg-red-500' : 'bg-emerald-500') : 'bg-slate-200'
                  }`}
                />
              )}
            </View>
            <Text
              numberOfLines={1}
              className={`mt-1 text-[10px] font-semibold ${
                isDone || isCurrent ? 'text-slate-800 font-bold' : 'text-slate-400'
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

function buildEvents(visits = [], history = [], returns = [], issues = [], services = []) {
  const events = [];

  visits.forEach((v) => {
    events.push({
      key: `intake-${v.visit_id || v.id}`,
      type: 'intake',
      label: 'Intake Received',
      icon: 'truck',
      date: v.intake_at,
      primary: `Truck ${v.truck_number || '—'} · Driver ${v.driver_name || '—'}`,
    });
  });

  history.forEach((h) => {
    const isRemoved = !!h.removed_at;
    const partCost = Number(h.price || 0) + Number(h.labor_charge || 0);

    events.push({
      key: `repair-${h.id}`,
      type: 'repair',
      label: isRemoved ? 'Part Fitted (Removed)' : 'Repair Logged',
      icon: 'wrench',
      date: h.repaired_at,
      primary: `${h.part_name} · by ${h.staff_name || 'Technician'}${isRemoved ? ' (Removed)' : ''}`,
      price: isRemoved ? 0 : partCost,
      originalPrice: partCost,
      notes: h.notes,
      isRemoved,
    });

    if (h.removed_at) {
      events.push({
        key: `removed-${h.id}`,
        type: 'part_removed',
        label: 'Part Removed & Restocked',
        icon: 'package',
        date: h.removed_at,
        primary: `Removed: ${h.part_name} · by ${h.removed_by_staff_name || 'Workshop Staff'}`,
        notes: `Restocked to inventory (-£${partCost.toFixed(2)})`,
        price: 0,
        deductedPrice: partCost,
        isDeduction: true,
        removedByStaffName: h.removed_by_staff_name,
      });
    }
  });

  services.forEach((s) => {
    const isDiagFee =
      !s.service_name ||
      s.service_name.toLowerCase().includes('diagnostic') ||
      s.service_name.toLowerCase().includes('fee') ||
      s.is_mandatory;

    events.push({
      key: `service-${s.id}`,
      type: 'service',
      label: isDiagFee ? 'Diagnostic Fee' : 'Testing Service',
      icon: 'flask',
      date: s.completed_at,
      primary: `${s.service_name}${s.staff_name ? ` · by ${s.staff_name}` : ''}`,
      price: Number(s.rate || 0),
      notes: s.notes,
    });
  });

  returns.forEach((r) => {
    events.push({
      key: `return-${r.id}`,
      type: 'return',
      label: 'Returned to Client',
      icon: 'package',
      date: r.returned_at,
      primary: `Truck ${r.truck_number || '—'} · Driver ${r.driver_name || '—'}`,
    });
  });

  issues.forEach((iss) => {
    events.push({
      key: `issue-${iss.id}`,
      type: 'issue',
      label: 'Reported Issue',
      icon: 'alertTriangle',
      date: iss.reported_at,
      primary: `${iss.reason_label || 'Unserviceable'} · by ${iss.staff_name || 'Technician'}`,
      notes: iss.note,
      photos: iss.photo_urls || [],
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
  const isStaff = !isClient;
  const staffRole = (currentUser?.staff_role || currentUser?.role || '').toLowerCase();
  const canTest =
    currentUser?.role === 'super_admin' ||
    currentUser?.role === 'admin' ||
    staffRole === 'supervisor';
  const isTechnicianOnly = isStaff && !canTest;

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
  const [showRepairedByModal, setShowRepairedByModal] = useState(false);
  const [repairedByInfo, setRepairedByInfo] = useState(null);
  const [showTestChoiceModal, setShowTestChoiceModal] = useState(false);
  const [showCompletedModal, setShowCompletedModal] = useState(false);
  const [showSubmittedModal, setShowSubmittedModal] = useState(false);
  const [showUnserviceableSuccessModal, setShowUnserviceableSuccessModal] = useState(false);
  const [showTestingDecisionModal, setShowTestingDecisionModal] = useState(false);
  const [showPassToTechSuccessModal, setShowPassToTechSuccessModal] = useState(false);
  const [passToTechSubmitting, setPassToTechSubmitting] = useState(false);
  const [showCantServiceAlertModal, setShowCantServiceAlertModal] = useState(false);
  const [cantServiceAlertData, setCantServiceAlertData] = useState(null);
  const [showRemovePartsSuccessModal, setShowRemovePartsSuccessModal] = useState(false);
  const [showUnverifiedIntakeModal, setShowUnverifiedIntakeModal] = useState(false);
  const [unverifiedIntakeData, setUnverifiedIntakeData] = useState(null);

  const [availableServices, setAvailableServices] = useState([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);
  const [testingNotes, setTestingNotes] = useState('');
  const [issueReasons, setIssueReasons] = useState([]);
  const [showIssueForm, setShowIssueForm] = useState(false);
  // Fully separate from showIssueForm on purpose — the testing-time
  // "mark unserviceable" flow (notes + optional photo, no reason picker)
  // has its own toggle so it can never share render state with the
  // mid-repair reason-picker flow above.
  const [showTestingUnserviceableForm, setShowTestingUnserviceableForm] = useState(false);
  const [selectedReasonId, setSelectedReasonId] = useState(null);
  const [issueNote, setIssueNote] = useState('');
  const [issuePhotos, setIssuePhotos] = useState([]);

  // Parts-reclaim state (unserviceable battery whose parts were fitted
  // during repair before it failed testing) — see renderIssueReportSection
  // and reportIssue on the backend.
  const [selectedRemovalIds, setSelectedRemovalIds] = useState([]);
  const [removingParts, setRemovingParts] = useState(false);
  const [removePartsError, setRemovePartsError] = useState(null);

  // Battery Number assign/edit modal state
  const [showSerialModal, setShowSerialModal] = useState(false);
  const [serialInput, setSerialInput] = useState('');
  const [serialSaving, setSerialSaving] = useState(false);
  const [serialError, setSerialError] = useState(null);

  // Scan / Active work exit confirmation popup state
  const [showExitConfirmModal, setShowExitConfirmModal] = useState(false);
  const pendingExitActionRef = useRef(null);
  const allowExitRef = useRef(false);

  // Fullscreen photo lightbox viewer state
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxImages, setLightboxImages] = useState([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxTitle, setLightboxTitle] = useState('Battery Photo');

  function openPhotoViewer(images, index = 0, title = 'Battery Photo') {
    if (!images || images.length === 0) return;
    setLightboxImages(images);
    setLightboxIndex(index);
    setLightboxTitle(title);
    setLightboxVisible(true);
  }

  const isInitialLoad = useRef(true);

  // Intercept back navigation when a battery is scanned or active in repair
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (allowExitRef.current || isClient) {
        return;
      }

      // Check if user came from scanning or has an active session/unsaved repair progress
      const isScanOrWorkSession =
        fromScan ||
        result?.battery?.status === 'in_progress' ||
        result?.battery?.status === 'in_testing' ||
        selectedPartIds.length > 0 ||
        selectedServiceIds.length > 0 ||
        notes.trim().length > 0 ||
        issuePhotos.length > 0;

      if (!isScanOrWorkSession) {
        return;
      }

      // Prevent leaving immediately and show confirm popup
      e.preventDefault();
      pendingExitActionRef.current = e.data.action;
      setShowExitConfirmModal(true);
    });

    return unsubscribe;
  }, [
    navigation,
    isClient,
    fromScan,
    result?.battery?.status,
    selectedPartIds.length,
    selectedServiceIds.length,
    notes,
    issuePhotos.length,
  ]);

  function handleConfirmExit() {
    setShowExitConfirmModal(false);
    allowExitRef.current = true;
    if (pendingExitActionRef.current) {
      navigation.dispatch(pendingExitActionRef.current);
    } else {
      navigation.goBack();
    }
  }

  function handleCancelExit() {
    setShowExitConfirmModal(false);
    pendingExitActionRef.current = null;
  }

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
        const canTestInTesting =
          canTest &&
          ['in_testing', 'testing', 'repair_testing'].includes(data.battery?.status);
        const hasPendingPartsRemoval = (data.pendingPartsRemoval?.length || 0) > 0;
        const latestPassBack = (data.services || []).find(
          (s) => s.service_name === 'Passed back to Technician'
        );
        const isPassedBack = data.battery?.status === 'in_repair' && !!latestPassBack;
        const isTestedPartsRemoved =
          data.battery?.status === 'tested_parts_removed' ||
          (data.battery?.status === 'unserviceable' && !hasPendingPartsRemoval && (data.history || []).some((h) => h.removed_at));
        const isUnserviceableTerminal =
          data.battery?.status === 'unserviceable' ||
          data.battery?.status === 'tested_parts_removed' ||
          data.battery?.status === 'recycled';

        const isIntakeUnverified = Boolean(
          data.battery?.truck_intake_id &&
          (data.battery?.intake_status === 'pending_arrival' ||
            data.battery?.intake_status !== 'verified' ||
            !data.battery?.intake_verified_at)
        );

        if (fromScan && isIntakeUnverified) {
          setUnverifiedIntakeData({
            batteryCode: data.battery.battery_code,
            truckNumber: data.battery.intake_truck_number,
            driverName: data.battery.intake_driver_name,
            intakeId: data.battery.truck_intake_id,
          });
          setShowUnverifiedIntakeModal(true);
        } else if (fromScan && isTestedPartsRemoved) {
          const removedParts = (data.history || []).filter((h) => h.removed_at);
          const fittedParts = data.history || [];
          setCantServiceAlertData({
            mode: 'already_reclaimed',
            batteryCode: data.battery.battery_code,
            status: data.battery.status,
            fittedBy: fittedParts[0]?.staff_name || 'Technician',
            fittedAt: fittedParts[0]?.repaired_at || null,
            fittedParts,
            testedBy: data.issues?.[0]?.staff_name || latestPassBack?.staff_name || 'Supervisor',
            testedAt: data.issues?.[0]?.reported_at || latestPassBack?.completed_at || null,
            issueReason: data.issues?.[0]?.reason_label || data.issues?.[0]?.reason || (latestPassBack ? 'Failed Testing Diagnostics' : 'Unserviceable Unit'),
            issueNote: data.issues?.[0]?.note || latestPassBack?.notes || null,
            passBackStaff: latestPassBack?.staff_name || null,
            passBackAt: latestPassBack?.completed_at || null,
            passBackNote: latestPassBack?.notes || null,
            removedBy: removedParts[0]?.removed_by_staff_name || 'Technician',
            removedAt: removedParts[0]?.removed_at || null,
            removedParts,
          });
          setShowCantServiceAlertModal(true);
        } else if (
          fromScan &&
          (isPassedBack ||
            (data.battery?.status === 'unserviceable' && hasPendingPartsRemoval))
        ) {
          const fittedParts = hasPendingPartsRemoval
            ? data.pendingPartsRemoval
            : (data.history || []).filter((h) => !h.removed_at);

          setCantServiceAlertData({
            mode: 'pending_removal',
            batteryCode: data.battery.battery_code,
            status: data.battery.status,
            staffName:
              latestPassBack?.staff_name ||
              data.issues?.[0]?.staff_name ||
              'Supervisor',
            note: latestPassBack?.notes || data.issues?.[0]?.note || null,
            date:
              latestPassBack?.completed_at ||
              data.issues?.[0]?.reported_at ||
              null,
            parts: fittedParts,
            isPassedBack,
            isUnserviceable: data.battery?.status === 'unserviceable',
            fittedBy: (data.history || [])[0]?.staff_name || 'Technician',
            fittedAt: (data.history || [])[0]?.repaired_at || null,
          });
          setShowCantServiceAlertModal(true);
        } else if (
          fromScan &&
          data.battery?.status !== 'in_repair' &&
          data.battery?.status !== 'tested_parts_removed' &&
          !isOwnInProgress &&
          !canTestInTesting &&
          !hasPendingPartsRemoval
        ) {
          setBlockedStatus(data.battery.status);
          return;
        } else if (fromScan && canTestInTesting) {
          setRepairedByInfo(data.history?.[0] || null);
          setShowRepairedByModal(true);
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
    if (result?.pendingPartsRemoval && result.pendingPartsRemoval.length > 0) {
      setSelectedRemovalIds(result.pendingPartsRemoval.map((p) => p.id));
    }
  }, [result?.pendingPartsRemoval]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (result?.battery?.status !== 'in_progress' || isClient) return;
    apiClient
      .get('/parts')
      .then(({ data }) => setParts(data))
      .catch(() => setParts([]));
  }, [result?.battery?.status, isClient]);

  // Issue reasons are needed both mid-repair (in_progress) and by a tester
  // during testing (in_testing) who finds the battery can't be serviced.
  useEffect(() => {
    const status = result?.battery?.status;
    if (isClient || (status !== 'in_progress' && status !== 'in_testing')) return;
    apiClient
      .get('/issue-reasons', { params: { activeOnly: true } })
      .then(({ data }) => setIssueReasons(data))
      .catch(() => setIssueReasons([]));
  }, [result?.battery?.status, isClient]);

  useEffect(() => {
    if (result?.battery?.status !== 'in_testing' || isClient) return;
    apiClient
      .get('/services', { params: { activeOnly: true } })
      .then(({ data }) => setAvailableServices((data || []).filter((s) => !s.is_mandatory)))
      .catch(() => setAvailableServices([]));
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
    const isIntakeUnverified = Boolean(
      result?.battery?.truck_intake_id &&
      (result?.battery?.intake_status === 'pending_arrival' ||
        result?.battery?.intake_status !== 'verified' ||
        !result?.battery?.intake_verified_at)
    );
    if (isIntakeUnverified) {
      setActionError(`Cannot start work: Truck #${result?.battery?.intake_truck_number || ''} arrival has not been verified yet.`);
      return;
    }
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

  function toggleService(serviceId) {
    setSelectedServiceIds((prev) =>
      prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId]
    );
  }

  async function handleStartTesting() {
    setSubmitting(true);
    setActionError(null);
    try {
      const { data: updatedBattery } = await apiClient.patch(`/batteries/${result.battery.id}/start-testing`);
      setResult((prev) => (prev ? { ...prev, battery: updatedBattery } : prev));
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
      if (!result.battery.testing_started_at) {
        await apiClient.patch(`/batteries/${result.battery.id}/start-testing`);
      }
      await apiClient.patch(`/batteries/${result.battery.id}/complete-testing`, {
        serviceIds: selectedServiceIds,
        notes: testingNotes || undefined,
      });
      setSelectedServiceIds([]);
      setTestingNotes('');
      await load();
      setShowCompletedModal(true);
    } catch (err) {
      setActionError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const handleTakePhoto = async () => {
    if (issuePhotos.length >= 3) return;
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setActionError('Camera permission is required to capture battery photos.');
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      });
      if (!res.canceled && res.assets && res.assets[0]) {
        const asset = res.assets[0];
        const dataUri = asset.base64
          ? `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`
          : asset.uri;
        setIssuePhotos((prev) => [...prev, { uri: asset.uri, dataUri }].slice(0, 3));
      }
    } catch (e) {
      setActionError(e.message || 'Failed to open camera');
    }
  };

  const handlePickGallery = async () => {
    if (issuePhotos.length >= 3) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setActionError('Gallery permission is required to select battery photos.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 3 - issuePhotos.length,
        quality: 0.7,
        base64: true,
      });
      if (!res.canceled && res.assets) {
        const newItems = res.assets.map((asset) => ({
          uri: asset.uri,
          dataUri: asset.base64
            ? `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`
            : asset.uri,
        }));
        setIssuePhotos((prev) => [...prev, ...newItems].slice(0, 3));
      }
    } catch (e) {
      setActionError(e.message || 'Failed to open gallery');
    }
  };

  const handleRemovePhoto = (idx) => {
    setIssuePhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  async function handleReportIssue() {
    // The mid-repair flow (showIssueForm) requires picking a reason; the
    // testing-time flow (showTestingUnserviceableForm) has no picker at
    // all and submits without one — see renderTestingUnserviceableSection.
    if (showIssueForm && !selectedReasonId) {
      setActionError('Select a reason');
      return;
    }
    setSubmitting(true);
    setActionError(null);
    try {
      const photosPayload = issuePhotos.map((p) => p.dataUri);
      await apiClient.patch(`/batteries/${result.battery.id}/report-issue`, {
        reasonId: selectedReasonId,
        note: issueNote || undefined,
        photos: photosPayload.length > 0 ? photosPayload : undefined,
      });
      setShowIssueForm(false);
      setShowTestingUnserviceableForm(false);
      setSelectedReasonId(null);
      setIssueNote('');
      setIssuePhotos([]);
      await load();
      setShowUnserviceableSuccessModal(true);
    } catch (err) {
      setActionError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePassToTech() {
    setPassToTechSubmitting(true);
    setActionError(null);
    try {
      await apiClient.patch(`/batteries/${result.battery.id}/pass-to-tech`, {
        note: issueNote || undefined,
      });
      setShowTestingDecisionModal(false);
      setShowTestingUnserviceableForm(false);
      setIssueNote('');
      setIssuePhotos([]);
      await load();
      setShowPassToTechSuccessModal(true);
    } catch (err) {
      setActionError(err.response?.data?.message || err.message);
    } finally {
      setPassToTechSubmitting(false);
    }
  }

  async function handleConfirmTestingUnserviceable() {
    setShowTestingDecisionModal(false);
    await handleReportIssue();
  }

  function toggleRemovalId(repairId) {
    setSelectedRemovalIds((prev) =>
      prev.includes(repairId) ? prev.filter((id) => id !== repairId) : [...prev, repairId]
    );
  }

  async function handleRemoveParts() {
    if (selectedRemovalIds.length === 0) {
      setRemovePartsError('Select at least one part to remove');
      return;
    }
    setRemovingParts(true);
    setRemovePartsError(null);
    try {
      await apiClient.patch(`/batteries/${result.battery.id}/remove-parts`, {
        repairIds: selectedRemovalIds,
      });
      setSelectedRemovalIds([]);
      await load();
      setShowRemovePartsSuccessModal(true);
    } catch (err) {
      setRemovePartsError(err.response?.data?.message || err.message);
    } finally {
      setRemovingParts(false);
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
      // A technician who can't test just gets a done confirmation. A
      // supervisor doing their own repair gets a choice: test this
      // battery right now, or step away and leave it queued for testing.
      if (canTest) {
        setShowTestChoiceModal(true);
      } else {
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

  // Mid-repair (in_progress) "Can't service this battery?" toggle + report
  // form — full reason picker. Testing-time reporting is a totally separate
  // function below (renderTestingUnserviceableSection), on purpose, so the
  // two flows can never share render state or logic.
  function renderIssueReportSection() {
    return (
      <View className={showIssueForm ? 'pt-0' : 'mt-4 border-t border-slate-200 pt-3'}>
        {!showIssueForm ? (
          <TouchableOpacity
            onPress={() => setShowIssueForm(true)}
            className="items-center rounded-xl border border-red-200 bg-red-50 py-3"
          >
            <Text className="text-xs font-bold text-red-600">
              Can't service this battery?
            </Text>
          </TouchableOpacity>
        ) : (
          <View>
            <Text className="text-xs font-bold text-slate-900">Report Issue</Text>
            <View className="mt-2 gap-1.5">
              {issueReasons.map((reason) => (
                <TouchableOpacity
                  key={reason.id}
                  onPress={() => setSelectedReasonId(reason.id)}
                  className={`rounded-xl border p-2.5 ${
                    selectedReasonId === reason.id
                      ? 'border-red-500 bg-red-50'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <Text className="text-xs font-medium text-slate-900">{reason.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              value={issueNote}
              onChangeText={setIssueNote}
              placeholder="Notes (optional)"
              placeholderTextColor="#94a3b8"
              className="mt-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
            />

            {/* Photo Upload Options (Max 3) */}
            <View className="mt-3">
              <View className="flex-row items-center justify-between mb-1.5">
                <Text className="text-xs font-bold text-slate-800">
                  Upload Photos ({issuePhotos.length}/3)
                </Text>
                <Text className="text-[11px] text-slate-500">Max 3 photos</Text>
              </View>

              {/* Photo Previews */}
              {issuePhotos.length > 0 && (
                <View className="flex-row items-center gap-2 mb-2">
                  {issuePhotos.map((p, idx) => (
                    <View key={idx} className="relative rounded-xl border border-slate-200 bg-slate-100 overflow-hidden">
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() =>
                          openPhotoViewer(
                            issuePhotos.map((item) => item.uri),
                            idx,
                            `Upload Preview ${idx + 1} of ${issuePhotos.length}`
                          )
                        }
                      >
                        <Image source={{ uri: p.uri }} className="w-16 h-16 rounded-xl" resizeMode="cover" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleRemovePhoto(idx)}
                        className="absolute top-1 right-1 h-5 w-5 rounded-full bg-slate-900/80 items-center justify-center"
                      >
                        <Icon name="close" color="#ffffff" size={11} strokeWidth={2.5} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Upload Buttons */}
              {issuePhotos.length < 3 && (
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={handleTakePhoto}
                    className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 py-2.5"
                  >
                    <Icon name="camera" color="#1d4ed8" size={14} />
                    <Text className="text-xs font-semibold text-blue-700">Take Photo</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handlePickGallery}
                    className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-2.5"
                  >
                    <Icon name="photo" color="#334155" size={14} />
                    <Text className="text-xs font-semibold text-slate-700">Choose Gallery</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View className="mt-3 flex-row gap-2">
              <TouchableOpacity
                onPress={() => {
                  setShowIssueForm(false);
                  setIssuePhotos([]);
                }}
                className="flex-1 items-center rounded-xl bg-slate-100 py-2.5 border border-slate-200"
              >
                <Text className="text-xs font-medium text-slate-600">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleReportIssue}
                disabled={submitting}
                className="flex-1 items-center rounded-xl bg-red-600 py-2.5 disabled:opacity-50"
              >
                <Text className="text-xs font-bold text-white">Report Issue</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  }

  // Testing-time (in_testing) "Can't service this battery?" — deliberately
  // has NO reason picker, ever: just notes + an optional photo. reason_id
  // is nullable (see migration 045), so this submits without one at all —
  // no dependency on any pre-seeded/admin-managed reason existing.
  function renderTestingUnserviceableSection() {
    return (
      <View className="mt-4 border-t border-slate-200 pt-3">
        {!showTestingUnserviceableForm ? (
          <TouchableOpacity
            onPress={() => {
              setSelectedReasonId(null);
              setShowTestingUnserviceableForm(true);
            }}
            className="items-center rounded-xl border border-red-200 bg-red-50 py-3"
          >
            <Text className="text-xs font-bold text-red-600">
              Can't service this battery?
            </Text>
          </TouchableOpacity>
        ) : (
          <View>
            <Text className="text-xs font-bold text-slate-900">Mark Unserviceable</Text>
            <TextInput
              value={issueNote}
              onChangeText={setIssueNote}
              placeholder="Notes (optional)"
              placeholderTextColor="#94a3b8"
              className="mt-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
            />

            {/* Photo Upload Options (Max 3) */}
            <View className="mt-3">
              <View className="flex-row items-center justify-between mb-1.5">
                <Text className="text-xs font-bold text-slate-800">
                  Upload Photos ({issuePhotos.length}/3)
                </Text>
                <Text className="text-[11px] text-slate-500">Optional, max 3 photos</Text>
              </View>

              {issuePhotos.length > 0 && (
                <View className="flex-row items-center gap-2 mb-2">
                  {issuePhotos.map((p, idx) => (
                    <View key={idx} className="relative rounded-xl border border-slate-200 bg-slate-100 overflow-hidden">
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() =>
                          openPhotoViewer(
                            issuePhotos.map((item) => item.uri),
                            idx,
                            `Upload Preview ${idx + 1} of ${issuePhotos.length}`
                          )
                        }
                      >
                        <Image source={{ uri: p.uri }} className="w-16 h-16 rounded-xl" resizeMode="cover" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleRemovePhoto(idx)}
                        className="absolute top-1 right-1 h-5 w-5 rounded-full bg-slate-900/80 items-center justify-center"
                      >
                        <Icon name="close" color="#ffffff" size={11} strokeWidth={2.5} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {issuePhotos.length < 3 && (
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={handleTakePhoto}
                    className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 py-2.5"
                  >
                    <Icon name="camera" color="#1d4ed8" size={14} />
                    <Text className="text-xs font-semibold text-blue-700">Take Photo</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handlePickGallery}
                    className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-2.5"
                  >
                    <Icon name="photo" color="#334155" size={14} />
                    <Text className="text-xs font-semibold text-slate-700">Choose Gallery</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View className="mt-3 flex-row gap-2">
              <TouchableOpacity
                onPress={() => {
                  setShowTestingUnserviceableForm(false);
                  setIssuePhotos([]);
                }}
                className="flex-1 items-center rounded-xl bg-slate-100 py-2.5 border border-slate-200"
              >
                <Text className="text-xs font-medium text-slate-600">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowTestingDecisionModal(true)}
                disabled={submitting}
                className="flex-1 items-center rounded-xl bg-red-600 py-2.5 disabled:opacity-50"
              >
                <Text className="text-xs font-bold text-white">Report &amp; Proceed</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator color="#2563eb" />
        <Text className="mt-2 text-xs text-slate-500 font-medium">Loading battery lifecycle…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 px-6">
        <Text className="mb-4 text-center text-sm text-red-600 font-medium">{error}</Text>
        <TouchableOpacity
          onPress={() => {
            allowExitRef.current = true;
            navigation.goBack();
          }}
          className="rounded-xl bg-slate-200 px-5 py-2.5"
        >
          <Text className="text-sm font-semibold text-slate-800">Back</Text>
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
        onRequestClose={() => {
          allowExitRef.current = true;
          navigation.goBack();
        }}
      >
        <View className="flex-1 items-center justify-center bg-black/60 px-6">
          <View className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <View className="mb-4 h-12 w-12 items-center justify-center rounded-2xl bg-red-50 border border-red-200">
              <Text className="text-2xl">⏳</Text>
            </View>
            <Text className="mb-1.5 text-lg font-bold text-slate-900">Not Available</Text>
            <Text className="mb-5 text-xs text-slate-500 leading-relaxed">
              {BLOCKED_STATUS_MESSAGES[blockedStatus] || 'This battery is not available to start work on.'}
            </Text>
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => {
                  allowExitRef.current = true;
                  navigation.goBack();
                }}
                className="flex-1 items-center rounded-xl bg-slate-100 py-3.5 border border-slate-200"
              >
                <Text className="text-xs font-bold text-slate-700">Go Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setBlockedStatus(null);
                  allowExitRef.current = true;
                  navigation.navigate('Main', {
                    screen: 'Service',
                    params: { autoScan: Date.now() },
                  });
                }}
                className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-3.5 shadow-md"
              >
                <Icon name="camera" color="#ffffff" size={16} />
                <Text className="text-xs font-bold text-white">Scan Next</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  const {
    battery,
    history = [],
    returns = [],
    visits = [],
    issues = [],
    services = [],
    recycleBatch,
    pendingPartsRemoval = [],
  } = result || {};
  const cycles = buildCycles(buildEvents(visits, history, returns, issues, services));
  const isClientLocked = battery.serial_number_added_by_role === 'client';
  const totalSpent =
    history.reduce((sum, h) => {
      if (h.removed_at) return sum;
      return sum + Number(h.price || 0) + Number(h.labor_charge || 0);
    }, 0) +
    services.reduce((sum, s) => sum + Number(s.rate || 0), 0);

  return (
    <ScrollView className="flex-1 bg-slate-50" contentContainerClassName="p-5 pb-16">
      {/* ── Executive Header ─────────────────────────────────────────────── */}
      <View className="mb-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-black text-slate-900">{battery.battery_code}</Text>
          <StatusBadge status={battery.status} />
        </View>
        <Text className="mt-1 text-xs text-slate-500">
          {isClient && battery.client_name ? (
            <>
              Client: <Text className="font-semibold text-slate-800">{battery.client_name}</Text> ·{' '}
            </>
          ) : null}
          Tracked since {battery.created_at ? new Date(battery.created_at).toLocaleDateString() : '—'}
        </Text>
      </View>

      {/* ── Unserviceable Banner (if unserviceable or recycled) ─────────── */}
      {(battery.status === 'unserviceable' || battery.status === 'recycled') && issues?.[0] && (
        <View className="mb-5 rounded-2xl border border-red-200 bg-red-50/80 p-4 shadow-sm">
          <View className="flex-row items-center gap-2 mb-1">
            <Icon name="alertTriangle" color="#991b1b" size={16} />
            <Text className="text-sm font-bold text-red-800">
              {issues[0].reason_label || 'Unserviceable Battery'}
            </Text>
          </View>
          {issues[0].note ? (
            <Text className="text-xs text-slate-700 mt-1 mb-2 leading-relaxed">{issues[0].note}</Text>
          ) : null}
          <Text className="text-[10px] text-slate-500">
            Reported by {issues[0].staff_name || 'Technician'} on{' '}
            {issues[0].reported_at ? new Date(issues[0].reported_at).toLocaleString() : '—'}
          </Text>

          {issues[0].photo_urls && issues[0].photo_urls.length > 0 && (
            <View className="mt-3 border-t border-red-200/60 pt-2.5">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-[11px] font-bold text-red-800">
                  Attached Photos ({issues[0].photo_urls.length})
                </Text>
                <Text className="text-[10px] text-red-700/80 font-semibold">Tap to enlarge</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {issues[0].photo_urls.map((photo, pIdx) => {
                  const imgUri = resolveImageUrl(photo);
                  return (
                    <TouchableOpacity
                      key={pIdx}
                      activeOpacity={0.8}
                      onPress={() =>
                        openPhotoViewer(
                          issues[0].photo_urls,
                          pIdx,
                          `${battery.battery_code} · Unserviceable Photo ${pIdx + 1}`
                        )
                      }
                      className="h-20 w-20 rounded-2xl border-2 border-red-200 overflow-hidden bg-slate-900 shadow-2xs relative active:scale-95"
                    >
                      <Image source={{ uri: imgUri }} className="h-full w-full" resizeMode="cover" />
                      <View className="absolute bottom-1 right-1 rounded-md bg-black/60 px-1 py-0.5">
                        <Icon name="zoomIn" color="#ffffff" size={10} />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>
      )}

      {/* ── Passed Back To Technician Banner (if in_repair and was passed back from testing) ─────────── */}
      {!isClient &&
        battery.status === 'in_repair' &&
        (() => {
          const passBack = services.find((s) => s.service_name === 'Passed back to Technician');
          if (!passBack) return null;
          return (
            <View className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm">
              <View className="flex-row items-center gap-2 mb-1">
                <Icon name="alertTriangle" color="#b45309" size={18} />
                <Text className="text-sm font-bold text-amber-900">
                  Marked Can't Service · Passed to Technician
                </Text>
              </View>
              <Text className="text-xs text-amber-800 mt-1 mb-2 leading-relaxed">
                Marked by{' '}
                <Text className="font-bold text-amber-950">
                  {passBack.staff_name || 'Supervisor'}
                </Text>
                {passBack.completed_at
                  ? ` on ${new Date(passBack.completed_at).toLocaleString()}`
                  : ''}
              </Text>
              {passBack.notes ? (
                <View className="rounded-xl bg-white/80 border border-amber-200 p-2.5 mb-2">
                  <Text className="text-xs text-amber-900 italic font-medium">"{passBack.notes}"</Text>
                </View>
              ) : null}
              <View className="flex-row items-center gap-1.5 pt-1 border-t border-amber-200/60">
                <Icon name="wrench" color="#b45309" size={13} />
                <Text className="text-[11px] font-bold text-amber-900">
                  Action: Please remove any fitted parts below before restarting rework.
                </Text>
              </View>
            </View>
          );
        })()}

      {/* ── Parts Pending Removal (unserviceable or in_repair battery, parts fitted during
           repair before it failed testing — technician or
           supervisor reclaims them here before it can proceed) ────── */}
      {!isClient &&
        (battery.status === 'unserviceable' || battery.status === 'in_repair') &&
        pendingPartsRemoval.length > 0 && (
          <View className="mb-5 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
            <View className="mb-1 flex-row items-center gap-2">
              <Icon name="wrench" color="#b45309" size={16} />
              <Text className="text-sm font-bold text-amber-900">Mandatory: Remove All Fitted Parts</Text>
            </View>
            <Text className="mb-3 text-[11px] text-amber-800/80 leading-relaxed">
              {fromScan
                ? 'This battery failed testing. All previously fitted parts must be physically removed and restocked into inventory:'
                : 'This battery failed testing and has fitted parts pending removal. To remove parts, the battery must be scanned with the camera:'}
            </Text>

          <View className="gap-2">
            {pendingPartsRemoval.map((p) => {
              const isChecked = selectedRemovalIds.includes(p.id);
              return (
                <TouchableOpacity
                  key={p.id}
                  disabled={!fromScan}
                  onPress={() => toggleRemovalId(p.id)}
                  className={`flex-row items-center justify-between rounded-xl border p-3 ${
                    isChecked ? 'border-amber-500 bg-amber-100/70' : 'border-amber-200 bg-white'
                  } ${!fromScan ? 'opacity-90' : ''}`}
                >
                  <View className="flex-row items-center gap-2.5 flex-1 pr-2">
                    <View
                      className={`h-5 w-5 rounded-md border items-center justify-center ${
                        isChecked ? 'border-amber-600 bg-amber-600' : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isChecked && <Icon name="check" color="#ffffff" size={12} strokeWidth={3} />}
                    </View>
                    <Text className="text-xs font-bold text-slate-900">{p.part_name}</Text>
                  </View>
                  <Text className="text-[10px] text-slate-500 font-semibold">Qty {p.quantity_used}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {removePartsError && (
            <Text className="mt-2 text-xs font-medium text-red-600">{removePartsError}</Text>
          )}

          {fromScan ? (
            <TouchableOpacity
              onPress={handleRemoveParts}
              disabled={removingParts || selectedRemovalIds.length === 0}
              className="mt-3 items-center rounded-xl bg-amber-600 py-3.5 shadow-md disabled:opacity-50 active:bg-amber-700"
            >
              {removingParts ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-xs font-bold text-white">
                  Confirm Removal &amp; Restock All Parts ({pendingPartsRemoval.length})
                </Text>
              )}
            </TouchableOpacity>
          ) : (
            <View className="mt-3 gap-2">
              <TouchableOpacity
                onPress={() => {
                  allowExitRef.current = true;
                  navigation.navigate('Main', {
                    screen: 'Service',
                    params: { autoScan: Date.now() },
                  });
                }}
                className="flex-row items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 shadow-md active:bg-blue-700"
              >
                <Icon name="camera" color="#ffffff" size={15} />
                <Text className="text-xs font-bold text-white">
                  Scan Battery with Camera to Remove Parts
                </Text>
              </TouchableOpacity>
              <Text className="text-center text-[10px] font-medium text-amber-700/80">
                🔒 View mode only — physical QR scan required to process parts removal.
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ── Physical Battery Number Card ─────────────────────────────────── */}
      <View className="mb-5 flex-row items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <View className="flex-1 mr-2">
          <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Physical Battery Number
          </Text>
          {battery.serial_number ? (
            <View className="mt-1 flex-row items-center gap-2 flex-wrap">
              <Text className="text-sm font-bold text-slate-900">{battery.serial_number}</Text>
              <View
                className={`rounded-full px-2.5 py-0.5 border ${
                  isClientLocked
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-slate-100 border-slate-200'
                }`}
              >
                <Text
                  className={`text-[10px] font-bold ${
                    isClientLocked ? 'text-amber-700' : 'text-slate-600'
                  }`}
                >
                  {isClientLocked ? 'Set by you' : 'Admin set'}
                </Text>
              </View>
            </View>
          ) : (
            <Text className="mt-1 text-xs text-slate-400 italic">No serial number assigned</Text>
          )}
        </View>
        {isClient && !battery.serial_number && (
          <TouchableOpacity
            onPress={openSerialModal}
            className="rounded-xl bg-blue-50 px-3.5 py-2 border border-blue-200 active:bg-blue-100"
          >
            <Text className="text-xs font-bold text-blue-600">+ Assign Number</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Workshop Staff Action Panels ─────────────────────────────────── */}
      {isStaff && (
        <>
          {actionError && <Text className="mb-3 text-xs text-red-600 font-medium">{actionError}</Text>}

          {(battery.status === 'in_repair' || battery.status === 'tested_parts_removed') && pendingPartsRemoval.length === 0 && (
            Boolean(
              battery?.truck_intake_id &&
              (battery?.intake_status === 'pending_arrival' ||
                battery?.intake_status !== 'verified' ||
                !battery?.intake_verified_at)
            ) ? (
              <View className="mb-5 rounded-2xl border border-amber-300 bg-amber-50/80 p-5 items-center">
                <View className="mb-3 h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 border border-amber-200">
                  <Icon name="alertTriangle" color="#d97706" size={24} />
                </View>
                <Text className="text-sm font-bold text-amber-900">
                  Battery Not Verified at Intake
                </Text>
                <Text className="mt-1 mb-4 text-xs text-amber-800 text-center leading-relaxed">
                  This battery arrived on Truck #{battery.intake_truck_number || 'N/A'}, but shipment arrival has not been verified yet by workshop intake. Work cannot begin until verified.
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    navigation.navigate('Main', {
                      screen: 'Service',
                      params: { autoScan: Date.now() },
                    });
                  }}
                  className="flex-row items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 shadow-md"
                >
                  <Icon name="camera" color="#ffffff" size={16} />
                  <Text className="text-sm font-bold text-white">Scan Another Battery</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View className="mb-5 rounded-2xl border border-blue-200 bg-blue-50/70 p-4">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-sm font-bold text-slate-900">
                    {battery.status === 'tested_parts_removed'
                      ? 'Parts Removed · Ready for Rework'
                      : 'Ready to start?'}
                  </Text>
                  <View className="rounded-full bg-blue-100 px-2.5 py-0.5">
                    <Text className="text-[10px] font-bold text-blue-700">
                      {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
                <Text className="mt-0.5 mb-3 text-xs text-slate-400">
                  {battery.status === 'tested_parts_removed'
                    ? 'All fitted parts have been reclaimed. Tap Start Work to begin rework on this battery and record your start time.'
                    : "This battery hasn't been touched yet. Starting work marks it as in progress."}
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
            )
          )}

          {battery.status === 'in_progress' && (
            <View className="mb-5 rounded-2xl border border-blue-200 bg-blue-50/70 p-4">
              <View className="mb-3 flex-row items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5">
                <Text className="text-xs font-bold text-emerald-800">Time on repair</Text>
                <Text className="text-base font-extrabold text-emerald-700">
                  {formatDuration(elapsedSeconds)}
                </Text>
              </View>

              {!showIssueForm && (
                <>
                  <Text className="mb-2 text-xs font-bold text-slate-900">
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
                              ? 'border-blue-500 bg-blue-100/70'
                              : 'border-slate-200 bg-white'
                          } ${disabled ? 'opacity-40' : ''}`}
                        >
                          <Text className="text-xs font-bold text-slate-900">{p.name}</Text>
                          <Text className="text-[10px] text-slate-500">{p.quantity} in stock</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <TextInput
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Notes (optional)"
                    placeholderTextColor="#94a3b8"
                    className="mt-3 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900"
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

              {renderIssueReportSection()}
            </View>
          )}

          {battery.status === 'in_testing' && (
            <View className="mb-5 rounded-2xl border border-blue-200 bg-blue-50/70 p-4">
              {canTest ? (
                <>
                  {!battery.testing_started_at ? (
                    <View className="rounded-2xl border border-blue-200 bg-white p-4 shadow-sm">
                      <View className="flex-row items-center gap-2 mb-1">
                        <Icon name="clock" color="#2563eb" size={16} />
                        <Text className="text-sm font-bold text-slate-900">Ready to Begin Testing?</Text>
                      </View>
                      <Text className="mt-0.5 mb-3 text-xs text-slate-500">
                        Tap below to start testing this battery and begin the timer.
                      </Text>
                      <TouchableOpacity
                        onPress={handleStartTesting}
                        disabled={submitting}
                        className="items-center rounded-xl bg-blue-600 py-3 shadow-md active:bg-blue-700"
                      >
                        <Text className="text-xs font-bold text-white">Start Testing Timer</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      <View className="mb-3 flex-row items-center justify-between rounded-xl bg-blue-100/70 border border-blue-200 px-3.5 py-2.5">
                        <Text className="text-xs font-bold text-blue-800">Time in testing</Text>
                        <Text className="text-base font-extrabold text-blue-700 font-mono">
                          {formatDuration(testingElapsedSeconds)}
                        </Text>
                      </View>
                      {availableServices.length > 0 && (
                        <View className="mb-3">
                          <View className="flex-row items-center justify-between mb-2">
                            <Text className="text-xs font-bold text-slate-900">
                              Services Performed ({selectedServiceIds.length})
                            </Text>
                            {availableServices
                              .filter((s) => selectedServiceIds.includes(s.id))
                              .reduce((sum, s) => sum + Number(s.rate || 0), 0) > 0 && (
                              <Text className="text-xs font-extrabold text-emerald-600">
                                +£
                                {availableServices
                                  .filter((s) => selectedServiceIds.includes(s.id))
                                  .reduce((sum, s) => sum + Number(s.rate || 0), 0)
                                  .toFixed(2)}
                              </Text>
                            )}
                          </View>
                          <View className="gap-2">
                            {availableServices.map((s) => {
                              const isChecked = selectedServiceIds.includes(s.id);
                              return (
                                <TouchableOpacity
                                  key={s.id}
                                  onPress={() => toggleService(s.id)}
                                  className={`flex-row items-center justify-between rounded-xl border p-3 ${
                                    isChecked
                                      ? 'border-blue-500 bg-blue-100/70'
                                      : 'border-slate-200 bg-white'
                                  }`}
                                >
                                  <View className="flex-row items-center gap-2.5 flex-1 pr-2">
                                    <View
                                      className={`h-5 w-5 rounded-md border items-center justify-center ${
                                        isChecked
                                          ? 'border-blue-600 bg-blue-600'
                                          : 'border-slate-300 bg-white'
                                      }`}
                                    >
                                      {isChecked && <Icon name="check" color="#ffffff" size={12} strokeWidth={3} />}
                                    </View>
                                    <View className="flex-1">
                                      <Text className="text-xs font-bold text-slate-900">{s.name}</Text>
                                      {s.description ? (
                                        <Text className="text-[10px] text-slate-500" numberOfLines={1}>
                                          {s.description}
                                        </Text>
                                      ) : null}
                                    </View>
                                  </View>
                                  <Text className="text-xs font-bold text-emerald-600">
                                    +£{Number(s.rate || 0).toFixed(2)}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>
                      )}

                      <TextInput
                        value={testingNotes}
                        onChangeText={setTestingNotes}
                        placeholder="Testing notes (optional)"
                        placeholderTextColor="#94a3b8"
                        className="mb-3 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900"
                      />

                      <TouchableOpacity
                        onPress={handleCompleteTesting}
                        disabled={submitting}
                        className="items-center rounded-xl bg-blue-600 py-3.5 shadow-md disabled:opacity-50"
                      >
                        {submitting ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text className="text-sm font-bold text-white">
                            Complete Testing{' '}
                            {availableServices
                              .filter((s) => selectedServiceIds.includes(s.id))
                              .reduce((sum, s) => sum + Number(s.rate || 0), 0) > 0
                              ? `(+£${availableServices
                                  .filter((s) => selectedServiceIds.includes(s.id))
                                  .reduce((sum, s) => sum + Number(s.rate || 0), 0)
                                  .toFixed(2)})`
                              : ''}
                          </Text>
                        )}
                      </TouchableOpacity>

                      {renderTestingUnserviceableSection()}
                    </>
                  )}
                </>
              ) : (
                <View className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5">
                  <View className="flex-row items-center gap-2 mb-1.5">
                    <Icon name="check" color="#047857" size={14} strokeWidth={3} />
                    <Text className="text-xs font-bold text-emerald-800">
                      Repair Completed · In Testing Queue
                    </Text>
                  </View>
                  <Text className="text-[11px] text-slate-600 mb-3 leading-relaxed">
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
                    <Icon name="camera" color="#ffffff" size={16} />
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
        <View className="flex-1 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Repairs</Text>
          <Text className="mt-0.5 text-lg font-black text-slate-900">{history.length}</Text>
        </View>
        <View className="flex-1 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Returns</Text>
          <Text className="mt-0.5 text-lg font-black text-slate-900">{returns.length}</Text>
        </View>
        {isClient && (
          <View className="flex-1 rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 shadow-sm">
            <Text className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Total Spent</Text>
            <Text className="mt-0.5 text-lg font-black text-amber-900">£{totalSpent.toFixed(2)}</Text>
          </View>
        )}
      </View>

      {/* ── Complete Lifecycle Cycles (Client only) ────────────────────────── */}
      {isClient && (
        <>
          <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
            Lifecycle & Repair Timeline
          </Text>

          {cycles.length === 0 ? (
            <View className="rounded-3xl border border-slate-200 bg-white p-8 items-center shadow-xs">
              <Text className="text-xs text-slate-500 font-medium">No events recorded for this battery yet.</Text>
            </View>
          ) : (
            <View className="gap-4">
              {cycles.map((cycle, i) => {
                const isOngoing = i === cycles.length - 1 && !cycle.some((e) => e.type === 'return');
                const isUnserviceableCycle =
                  cycle.some((e) => e.type === 'issue' || e.type === 'recycle') ||
                  (isOngoing && ['unserviceable', 'tested_parts_removed', 'recycled'].includes(battery.status));

                const cycleRepairs = cycle.filter((e) => e.type === 'repair');
                const cycleServices = cycle.filter((e) => e.type === 'service');
                const cyclePartsTotal = cycleRepairs
                  .filter((r) => !r.isRemoved)
                  .reduce((sum, r) => sum + (Number(r.price) || 0), 0);
                const cycleServicesTotal = cycleServices.reduce(
                  (sum, s) => sum + (Number(s.price) || 0),
                  0
                );
                const cycleTotal = Math.max(0, cyclePartsTotal + cycleServicesTotal);

                return (
                  <View
                    key={`cycle-${i}`}
                    className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
                  >
                    <View className="flex-row items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
                      <Text className="text-xs font-black tracking-widest text-slate-700">CYCLE {i + 1}</Text>
                      <View className="flex-row items-center gap-2">
                        {cycleTotal > 0 ? (
                          <View className="flex-row items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5">
                            <Text className="text-[10px] font-extrabold text-blue-700">
                              Total: £{cycleTotal.toFixed(2)}
                            </Text>
                            {isUnserviceableCycle && cycleServicesTotal > 0 && cyclePartsTotal === 0 && (
                              <Text className="text-[9px] font-bold text-red-600">
                                (Diagnostic)
                              </Text>
                            )}
                          </View>
                        ) : (
                          <View className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5">
                            <Text className="text-[10px] font-medium text-slate-500">
                              No Charge
                            </Text>
                          </View>
                        )}
                        <View className={`rounded-full px-2.5 py-0.5 border ${
                          isUnserviceableCycle
                            ? 'bg-rose-50 border-rose-200'
                            : isOngoing
                              ? 'bg-amber-50 border-amber-200'
                              : 'bg-emerald-50 border-emerald-200'
                        }`}>
                          <Text className={`text-[10px] font-extrabold ${
                            isUnserviceableCycle
                              ? 'text-rose-700'
                              : isOngoing
                                ? 'text-amber-700'
                                : 'text-emerald-700'
                          }`}>
                            {isUnserviceableCycle ? 'Unserviceable' : isOngoing ? 'With Shop' : 'Completed'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View className="border-b border-slate-100 p-3.5 bg-slate-50/50">
                      <ProcessStepper isOngoing={isOngoing} batteryStatus={battery.status} />
                    </View>

                    <View className="p-4 gap-4">
                      {cycle.map((event) => (
                        <View key={event.key} className="flex-row gap-3">
                          <View className="h-9 w-9 items-center justify-center rounded-2xl bg-slate-100 border border-slate-200">
                            <Icon name={event.icon} color="#475569" size={16} />
                          </View>
                          <View className="flex-1">
                            <View className="flex-row items-center justify-between">
                              <Text className="text-xs font-bold text-slate-900">{event.label}</Text>
                              <Text className="text-[10px] text-slate-400 font-medium">
                                {event.date ? new Date(event.date).toLocaleDateString() : ''}
                              </Text>
                            </View>
                            <Text className="mt-0.5 text-xs text-slate-600">{event.primary}</Text>
                            {event.notes && (
                              <Text className="mt-1 text-[11px] text-slate-500 italic">
                                "{event.notes}"
                              </Text>
                            )}
                            {event.photos && event.photos.length > 0 && (
                              <View className="mt-2.5 pt-2 border-t border-slate-100">
                                <View className="flex-row items-center justify-between mb-1.5">
                                  <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    Defect Photos ({event.photos.length})
                                  </Text>
                                  <Text className="text-[9px] text-sky-600 font-semibold">Tap to enlarge</Text>
                                </View>
                                <View className="flex-row flex-wrap gap-2">
                                  {event.photos.map((photo, pIdx) => {
                                    const imgUri = resolveImageUrl(photo);
                                    return (
                                      <TouchableOpacity
                                        key={pIdx}
                                        activeOpacity={0.8}
                                        onPress={() =>
                                          openPhotoViewer(
                                            event.photos,
                                            pIdx,
                                            `${battery.battery_code} · Issue Photo ${pIdx + 1}`
                                          )
                                        }
                                        className="h-16 w-16 rounded-xl border border-slate-200 overflow-hidden bg-slate-900 shadow-2xs relative active:scale-95"
                                      >
                                        <Image source={{ uri: imgUri }} className="h-full w-full" resizeMode="cover" />
                                        <View className="absolute bottom-1 right-1 rounded bg-black/60 px-1 py-0.5">
                                          <Icon name="zoomIn" color="#ffffff" size={8} />
                                        </View>
                                      </TouchableOpacity>
                                    );
                                  })}
                                </View>
                              </View>
                            )}
                            {event.price !== undefined && event.price > 0 && (
                              <Text className="mt-1 text-[10px] font-bold text-emerald-600">
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
        </>
      )}

      {/* ── Serial Number Modal (Light Executive) ──────────────────────────── */}
      {showSerialModal && (
        <Modal
          visible={showSerialModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowSerialModal(false)}
        >
          <View className="flex-1 items-center justify-center bg-black/60 px-6">
            <View className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
              <Text className="text-base font-extrabold text-slate-900">
                Physical Battery Number
              </Text>
              <Text className="mt-1 text-xs text-slate-500">
                Enter manufacturer serial printed on the battery.
              </Text>

              <TextInput
                value={serialInput}
                onChangeText={setSerialInput}
                placeholder="e.g. SN-88213"
                placeholderTextColor="#94a3b8"
                autoFocus
                className="mt-4 rounded-2xl border border-slate-300 bg-slate-50 p-3.5 text-sm text-slate-900 focus:border-blue-500"
              />

              {serialError && (
                <Text className="mt-2 text-xs text-red-600 font-medium">{serialError}</Text>
              )}

              <View className="mt-6 flex-row justify-end gap-2.5">
                <TouchableOpacity
                  onPress={() => setShowSerialModal(false)}
                  className="rounded-xl px-4 py-2.5 bg-slate-100"
                >
                  <Text className="text-sm font-medium text-slate-600">Cancel</Text>
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

      {/* ── Repaired-By Modal (For a tester scanning a battery that's ready) ── */}
      {(() => {
        const isRepairedByMe = Boolean(
          (repairedByInfo?.user_id && repairedByInfo.user_id === currentUserId) ||
          (repairedByInfo?.staff_name &&
            currentUser?.name &&
            repairedByInfo.staff_name.trim().toLowerCase() === currentUser.name.trim().toLowerCase()) ||
          (result?.battery?.started_by_user_id && result.battery.started_by_user_id === currentUserId)
        );

        return (
          <Modal
            visible={showRepairedByModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowRepairedByModal(false)}
          >
            <View className="flex-1 items-center justify-center bg-black/60 px-5">
              <View className="w-full max-w-sm rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl">
                {/* Header with Icon & Status Badge */}
                <View className="flex-row items-center justify-between mb-4">
                  <View className={`h-12 w-12 items-center justify-center rounded-2xl border ${
                    isRepairedByMe
                      ? 'bg-emerald-500/10 border-emerald-500/20'
                      : 'bg-blue-500/10 border-blue-500/20'
                  }`}>
                    <Icon name={isRepairedByMe ? 'checkCircle' : 'flask'} color={isRepairedByMe ? '#059669' : '#2563eb'} size={22} />
                  </View>
                  <View className={`rounded-full border px-3 py-1 ${
                    isRepairedByMe
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60'
                      : 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/60'
                  }`}>
                    <Text className={`text-[11px] font-bold ${
                      isRepairedByMe
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-blue-600 dark:text-blue-400'
                    }`}>
                      {isRepairedByMe ? 'Repaired by You' : 'Ready for Testing'}
                    </Text>
                  </View>
                </View>

                <Text className="text-lg font-extrabold text-slate-900 dark:text-white">
                  Battery Inspection &amp; QA
                </Text>
                <Text className="mt-1 mb-4 text-xs text-slate-500 dark:text-slate-400">
                  {isRepairedByMe
                    ? 'You repaired this battery. Review details before proceeding with testing sign-off:'
                    : 'Repair work is completed. Review details before starting sign-off:'}
                </Text>

                {/* Structured Details Card */}
                <View className="mb-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/60 p-3.5 space-y-2.5">
                  {/* Battery Code */}
                  <View className="flex-row items-center justify-between py-1 border-b border-slate-200/60 dark:border-slate-800">
                    <Text className="text-xs font-semibold text-slate-500 dark:text-slate-400">Battery ID</Text>
                    <Text className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                      {battery?.battery_code || '—'}
                    </Text>
                  </View>

                  {/* Repaired By */}
                  <View className="flex-row items-center justify-between py-1 border-b border-slate-200/60 dark:border-slate-800">
                    <Text className="text-xs font-semibold text-slate-500 dark:text-slate-400">Repaired By</Text>
                    <View className="flex-row items-center gap-1.5">
                      <Icon name="user" color="#64748b" size={12} />
                      {isRepairedByMe ? (
                        <View className="flex-row items-center gap-1">
                          <Text className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            You
                          </Text>
                          <Text className="text-xs text-slate-500 dark:text-slate-400">
                            ({repairedByInfo?.staff_name || currentUser?.name || 'Technician'})
                          </Text>
                        </View>
                      ) : (
                        <Text className="text-xs font-bold text-slate-900 dark:text-white">
                          {repairedByInfo?.staff_name || 'Workshop Technician'}
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Repair Date & Time */}
                  <View className="flex-row items-center justify-between py-1 border-b border-slate-200/60 dark:border-slate-800">
                    <Text className="text-xs font-semibold text-slate-500 dark:text-slate-400">Repair Date &amp; Time</Text>
                    <Text className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      {repairedByInfo?.repaired_at
                        ? new Date(repairedByInfo.repaired_at).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          }) +
                          ' · ' +
                          new Date(repairedByInfo.repaired_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </Text>
                  </View>

                  {/* Parts Changed (if available) */}
                  {repairedByInfo?.part_name && (
                    <View className="flex-row items-center justify-between py-1 border-b border-slate-200/60 dark:border-slate-800">
                      <Text className="text-xs font-semibold text-slate-500 dark:text-slate-400">Part Serviced</Text>
                      <View className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5">
                        <Text className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          {repairedByInfo.part_name}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Notes (if available) */}
                  {repairedByInfo?.notes && (
                    <View className="pt-1">
                      <Text className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                        Repair Note:
                      </Text>
                      <Text className="text-xs text-slate-700 dark:text-slate-300 italic">
                        "{repairedByInfo.notes}"
                      </Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  onPress={() => setShowRepairedByModal(false)}
                  className="items-center rounded-2xl bg-blue-600 py-3.5 shadow-md active:bg-blue-700"
                >
                  <Text className="text-sm font-bold text-white">Start Testing</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        );
      })()}

      {/* ── Test Now / Exit Choice Modal (For a supervisor who just
           repaired a battery themselves and can also test it) ──────────── */}
      <Modal
        visible={showTestChoiceModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTestChoiceModal(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/60 px-5">
          <View className="w-full max-w-sm rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl">
            <View className="flex-row items-center justify-between mb-4">
              <View className="h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                <Icon name="wrench" color="#059669" size={22} />
              </View>
              <View className="rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 px-3 py-1">
                <Text className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  Repair Complete
                </Text>
              </View>
            </View>

            <Text className="text-lg font-extrabold text-slate-900 dark:text-white">
              Repair Submitted
            </Text>
            <Text className="mt-1 mb-4 text-xs text-slate-500 dark:text-slate-400">
              Battery is ready for testing. Choose an action:
            </Text>

            {/* Battery Summary Box */}
            <View className="mb-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/60 p-3 flex-row items-center justify-between">
              <Text className="text-xs font-semibold text-slate-500 dark:text-slate-400">Battery ID</Text>
              <Text className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {battery?.battery_code || '—'}
              </Text>
            </View>

            <View className="gap-2.5">
              <TouchableOpacity
                onPress={() => setShowTestChoiceModal(false)}
                className="items-center rounded-2xl bg-blue-600 py-3.5 shadow-md active:bg-blue-700"
              >
                <Text className="text-sm font-bold text-white">Test Now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setShowTestChoiceModal(false);
                  allowExitRef.current = true;
                  navigation.navigate('Main', {
                    screen: 'Service',
                    params: { autoScan: Date.now() },
                  });
                }}
                className="flex-row items-center justify-center gap-2 rounded-2xl bg-slate-100 dark:bg-slate-800 py-3 border border-slate-200 dark:border-slate-700 active:bg-slate-200"
              >
                <Icon name="camera" color="#ffffff" size={16} />
                <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200">Exit &amp; Scan Next</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setShowTestChoiceModal(false);
                  allowExitRef.current = true;
                  navigation.goBack();
                }}
                className="items-center rounded-2xl py-2.5"
              >
                <Text className="text-xs font-semibold text-slate-500 dark:text-slate-400">Exit to Service List</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Submitted for Testing Modal (For Technician) ─────────────────── */}
      <Modal
        visible={showSubmittedModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowSubmittedModal(false);
          allowExitRef.current = true;
          navigation.goBack();
        }}
      >
        <View className="flex-1 items-center justify-center bg-black/60 px-6">
          <View className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <View className="mb-4 h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 border border-emerald-200">
              <Icon name="zap" color="#059669" size={22} />
            </View>
            <Text className="mb-1.5 text-lg font-bold text-slate-900">Work Submitted!</Text>
            <Text className="mb-5 text-xs text-slate-500 leading-relaxed">
              <Text className="font-bold text-slate-800">{battery?.battery_code}</Text> has been submitted for testing. Your repair work on this battery is done.
            </Text>
            <View className="gap-2.5">
              <TouchableOpacity
                onPress={() => {
                  setShowSubmittedModal(false);
                  allowExitRef.current = true;
                  navigation.navigate('Main', {
                    screen: 'Service',
                    params: { autoScan: Date.now() },
                  });
                }}
                className="flex-row items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 shadow-md"
              >
                <Icon name="camera" color="#ffffff" size={16} />
                <Text className="text-sm font-bold text-white">Scan Next Battery</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setShowSubmittedModal(false);
                  allowExitRef.current = true;
                  navigation.goBack();
                }}
                className="items-center rounded-xl bg-slate-100 py-3 border border-slate-200"
              >
                <Text className="text-xs font-semibold text-slate-700">Back to Service List</Text>
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
        onRequestClose={() => {
          setShowCompletedModal(false);
          allowExitRef.current = true;
          navigation.goBack();
        }}
      >
        <View className="flex-1 items-center justify-center bg-black/60 px-6">
          <View className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <View className="mb-4 h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 border border-emerald-200">
              <Icon name="checkCircle" color="#059669" size={22} />
            </View>
            <Text className="mb-1.5 text-lg font-bold text-slate-900">Completed!</Text>
            <Text className="mb-5 text-xs text-slate-500 leading-relaxed">
              <Text className="font-bold text-slate-800">{battery?.battery_code}</Text> has been tested and marked as repaired.
            </Text>
            <View className="gap-2.5">
              <TouchableOpacity
                onPress={() => {
                  setShowCompletedModal(false);
                  allowExitRef.current = true;
                  navigation.navigate('Main', {
                    screen: 'Service',
                    params: { autoScan: Date.now() },
                  });
                }}
                className="flex-row items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 shadow-md"
              >
                <Icon name="camera" color="#ffffff" size={16} />
                <Text className="text-sm font-bold text-white">Scan Next Battery</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setShowCompletedModal(false);
                  allowExitRef.current = true;
                  navigation.goBack();
                }}
                className="items-center rounded-xl bg-slate-100 py-3 border border-slate-200"
              >
                <Text className="text-xs font-semibold text-slate-700">Back to Service List</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Testing Decision Modal (Remove fitted parts vs Pass back to tech) ── */}
      <Modal
        visible={showTestingDecisionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTestingDecisionModal(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/60 px-5">
          <View className="w-full max-w-sm rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl">
            <View className="flex-row items-center justify-between mb-4">
              <View className="h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20">
                <Icon name="alertTriangle" color="#d97706" size={22} />
              </View>
              <View className="rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-3 py-1">
                <Text className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                  Testing Decision
                </Text>
              </View>
            </View>

            <Text className="text-lg font-extrabold text-slate-900 dark:text-white">
              Choose Next Action
            </Text>
            <Text className="mt-1 mb-4 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Choose how you would like to proceed with this battery:
            </Text>

            <View className="mb-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/60 p-3 flex-row items-center justify-between">
              <Text className="text-xs font-semibold text-slate-500 dark:text-slate-400">Battery ID</Text>
              <Text className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                {battery?.battery_code || '—'}
              </Text>
            </View>

            <View className="gap-2.5">
              <TouchableOpacity
                onPress={handleConfirmTestingUnserviceable}
                disabled={submitting || passToTechSubmitting}
                className="items-center rounded-2xl bg-amber-600 py-3.5 shadow-md active:bg-amber-700 disabled:opacity-50"
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-xs font-bold text-white">Continue to Remove Fitted Parts</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handlePassToTech}
                disabled={submitting || passToTechSubmitting}
                className="items-center rounded-2xl bg-blue-600 py-3.5 shadow-md active:bg-blue-700 disabled:opacity-50"
              >
                {passToTechSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-xs font-bold text-white">Pass Back to Technician</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowTestingDecisionModal(false)}
                className="items-center rounded-2xl py-2.5 mt-1"
              >
                <Text className="text-xs font-semibold text-slate-500 dark:text-slate-400">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Pass Back to Tech Success Modal ─────────────────────────────── */}
      <Modal
        visible={showPassToTechSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPassToTechSuccessModal(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/60 px-6">
          <View className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <View className="mb-4 h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 border border-blue-200">
              <Icon name="checkCircle" color="#2563eb" size={22} />
            </View>
            <Text className="mb-1.5 text-lg font-bold text-slate-900">Passed to Technician</Text>
            <Text className="mb-5 text-xs text-slate-500 leading-relaxed">
              <Text className="font-bold text-slate-800">{battery?.battery_code}</Text> has been returned to the repair queue for technician rework.
            </Text>
            <View className="gap-2.5">
              <TouchableOpacity
                onPress={() => {
                  setShowPassToTechSuccessModal(false);
                  allowExitRef.current = true;
                  navigation.navigate('Main', {
                    screen: 'Service',
                    params: { autoScan: Date.now() },
                  });
                }}
                className="flex-row items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 shadow-md"
              >
                <Icon name="camera" color="#ffffff" size={16} />
                <Text className="text-sm font-bold text-white">Scan Next Battery</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowPassToTechSuccessModal(false)}
                className="items-center rounded-xl bg-slate-100 py-3 border border-slate-200"
              >
                <Text className="text-xs font-semibold text-slate-700">View Battery Details</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Unserviceable Reported Success Modal ──────────────────────────── */}
      <Modal
        visible={showUnserviceableSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUnserviceableSuccessModal(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/60 px-6">
          <View className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <View className="mb-4 h-12 w-12 items-center justify-center rounded-2xl bg-red-50 border border-red-200">
              <Icon name="alertTriangle" color="#dc2626" size={22} />
            </View>
            <Text className="mb-1.5 text-lg font-bold text-slate-900">Marked Unserviceable</Text>
            <Text className="mb-5 text-xs text-slate-500 leading-relaxed">
              <Text className="font-bold text-slate-800">{battery?.battery_code}</Text> has been declared unserviceable with attached photos and moved to the recycling queue.
            </Text>
            <View className="gap-2.5">
              <TouchableOpacity
                onPress={() => {
                  setShowUnserviceableSuccessModal(false);
                  allowExitRef.current = true;
                  navigation.navigate('Main', {
                    screen: 'Service',
                    params: { autoScan: Date.now() },
                  });
                }}
                className="flex-row items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 shadow-md"
              >
                <Icon name="camera" color="#ffffff" size={16} />
                <Text className="text-sm font-bold text-white">Scan Next Battery</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowUnserviceableSuccessModal(false)}
                className="items-center rounded-xl bg-slate-100 py-3 border border-slate-200"
              >
                <Text className="text-xs font-semibold text-slate-700">View Battery Details</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Unverified Intake Alert Modal ────────────────────────────── */}
      <Modal
        visible={showUnverifiedIntakeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUnverifiedIntakeModal(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/60 px-5">
          <View className="w-full max-w-sm rounded-3xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 p-6 shadow-2xl">
            {/* Top Icon & Badge */}
            <View className="flex-row items-center justify-between mb-3">
              <View className="h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20">
                <Icon name="alertTriangle" color="#d97706" size={24} />
              </View>
              <View className="rounded-full px-3 py-1 border bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60">
                <Text className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
                  Intake Not Verified
                </Text>
              </View>
            </View>

            <Text className="text-lg font-extrabold text-slate-900 dark:text-white">
              Battery Not Verified at Intake
            </Text>
            <Text className="mt-0.5 mb-3 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              This battery has not been verified at truck intake yet. Work or testing cannot begin until the workshop verifies arrival.
            </Text>

            <View className="mb-4 rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/70 dark:bg-slate-950/60 p-3.5 space-y-2">
              <View className="flex-row justify-between items-center pb-1.5 border-b border-amber-200/60 dark:border-slate-800">
                <Text className="text-xs text-slate-500 dark:text-slate-400">Battery ID</Text>
                <Text className="text-xs font-bold text-amber-800 dark:text-amber-300">{unverifiedIntakeData?.batteryCode || code}</Text>
              </View>
              <View className="flex-row justify-between items-center pb-1.5 border-b border-amber-200/60 dark:border-slate-800">
                <Text className="text-xs text-slate-500 dark:text-slate-400">Truck Number</Text>
                <Text className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {unverifiedIntakeData?.truckNumber ? `Truck #${unverifiedIntakeData.truckNumber}` : 'N/A'}
                </Text>
              </View>
              {unverifiedIntakeData?.driverName ? (
                <View className="flex-row justify-between items-center pb-1.5 border-b border-amber-200/60 dark:border-slate-800">
                  <Text className="text-xs text-slate-500 dark:text-slate-400">Driver</Text>
                  <Text className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    {unverifiedIntakeData.driverName}
                  </Text>
                </View>
              ) : null}
              <View className="flex-row justify-between items-center">
                <Text className="text-xs text-slate-500 dark:text-slate-400">Shipment Status</Text>
                <Text className="text-xs font-bold text-amber-700 dark:text-amber-400">Pending Arrival</Text>
              </View>
            </View>

            <View className="gap-2.5">
              <TouchableOpacity
                onPress={() => {
                  setShowUnverifiedIntakeModal(false);
                  navigation.navigate('Main', {
                    screen: 'Service',
                    params: { autoScan: Date.now() },
                  });
                }}
                className="flex-row items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 shadow-md shadow-blue-600/30"
              >
                <Icon name="camera" color="#ffffff" size={16} />
                <Text className="text-sm font-bold text-white">Scan Another Battery</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowUnverifiedIntakeModal(false)}
                className="items-center rounded-xl bg-slate-100 dark:bg-slate-800 py-3 border border-slate-200 dark:border-slate-700"
              >
                <Text className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  View Battery Details
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Can't Service / Passed to Tech Alert Modal ───────────────────── */}
      <Modal
        visible={showCantServiceAlertModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCantServiceAlertModal(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/60 px-5">
          <View className={`w-full max-w-sm rounded-3xl border p-6 shadow-2xl ${
            cantServiceAlertData?.mode === 'already_reclaimed'
              ? 'border-red-300 dark:border-red-800 bg-white dark:bg-slate-900'
              : 'border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900'
          }`}>
            {/* Top Icon & Badge */}
            <View className="flex-row items-center justify-between mb-3">
              <View className={`h-12 w-12 items-center justify-center rounded-2xl ${
                cantServiceAlertData?.mode === 'already_reclaimed'
                  ? 'bg-red-500/10 border border-red-500/20'
                  : 'bg-amber-500/10 border border-amber-500/20'
              }`}>
                <Icon
                  name={cantServiceAlertData?.mode === 'already_reclaimed' ? 'slash' : 'alertTriangle'}
                  color={cantServiceAlertData?.mode === 'already_reclaimed' ? '#dc2626' : '#d97706'}
                  size={24}
                />
              </View>
              <View className={`rounded-full px-3 py-1 border ${
                cantServiceAlertData?.mode === 'already_reclaimed'
                  ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/60'
                  : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60'
              }`}>
                <Text className={`text-[11px] font-bold ${
                  cantServiceAlertData?.mode === 'already_reclaimed'
                    ? 'text-red-700 dark:text-red-400'
                    : 'text-amber-700 dark:text-amber-400'
                }`}>
                  {cantServiceAlertData?.mode === 'already_reclaimed'
                    ? 'Tested - Parts Removed'
                    : 'Can\'t Service · Mandatory Removal'}
                </Text>
              </View>
            </View>

            <Text className="text-lg font-extrabold text-slate-900 dark:text-white">
              {cantServiceAlertData?.mode === 'already_reclaimed'
                ? 'Battery Cannot Be Serviced'
                : 'Battery Can\'t Service'}
            </Text>
            <Text className="mt-0.5 mb-3 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {cantServiceAlertData?.mode === 'already_reclaimed'
                ? 'This battery failed testing diagnostics and all fitted parts were already removed and restocked:'
                : 'This battery failed testing and requires mandatory removal of all fitted parts before closing:'}
            </Text>

            {cantServiceAlertData?.mode === 'already_reclaimed' ? (
              /* Full 4-Step Audit Trail for Tested & Parts Removed */
              <ScrollView nestedScrollEnabled className="mb-4 max-h-72 space-y-2.5">
                {/* 1. Fitted By */}
                <View className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3">
                  <View className="flex-row items-center gap-1.5 mb-1">
                    <Icon name="wrench" color="#2563eb" size={13} />
                    <Text className="text-[11px] font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wider">
                      1. Parts Fitted By
                    </Text>
                  </View>
                  <Text className="text-xs font-bold text-slate-900 dark:text-white">
                    {cantServiceAlertData.fittedBy}
                  </Text>
                  {cantServiceAlertData.fittedAt && (
                    <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {new Date(cantServiceAlertData.fittedAt).toLocaleString()}
                    </Text>
                  )}
                  {cantServiceAlertData.fittedParts && cantServiceAlertData.fittedParts.length > 0 && (
                    <Text className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 font-medium">
                      Fitted: {cantServiceAlertData.fittedParts.map((p) => p.part_name).filter(Boolean).join(', ')}
                    </Text>
                  )}
                </View>

                {/* 2. Tested & Reported By */}
                <View className="rounded-2xl border border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/30 p-3">
                  <View className="flex-row items-center gap-1.5 mb-1">
                    <Icon name="alertCircle" color="#dc2626" size={13} />
                    <Text className="text-[11px] font-bold text-red-900 dark:text-red-300 uppercase tracking-wider">
                      2. Tested &amp; Reported Can't Service
                    </Text>
                  </View>
                  <Text className="text-xs font-bold text-red-950 dark:text-red-100">
                    {cantServiceAlertData.testedBy}
                  </Text>
                  {cantServiceAlertData.testedAt && (
                    <Text className="text-[10px] text-red-800/80 dark:text-red-300/80 mt-0.5">
                      {new Date(cantServiceAlertData.testedAt).toLocaleString()}
                    </Text>
                  )}
                  <View className="mt-1 rounded-lg bg-white/90 dark:bg-slate-900 p-2 border border-red-200/80 dark:border-red-900/40">
                    <Text className="text-xs font-bold text-red-900 dark:text-red-200">
                      {cantServiceAlertData.issueReason}
                    </Text>
                    {cantServiceAlertData.issueNote && (
                      <Text className="text-[11px] text-red-700 dark:text-red-300 italic mt-0.5">
                        "{cantServiceAlertData.issueNote}"
                      </Text>
                    )}
                  </View>
                </View>

                {/* 3. Parts Removed By */}
                <View className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30 p-3">
                  <View className="flex-row items-center gap-1.5 mb-1">
                    <Icon name="checkCircle" color="#b45309" size={13} />
                    <Text className="text-[11px] font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider">
                      3. All Fitted Parts Reclaimed
                    </Text>
                  </View>
                  <Text className="text-xs font-bold text-amber-950 dark:text-amber-100">
                    Removed by {cantServiceAlertData.removedBy || 'Technician'}
                  </Text>
                  {cantServiceAlertData.removedAt && (
                    <Text className="text-[10px] text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                      {new Date(cantServiceAlertData.removedAt).toLocaleString()}
                    </Text>
                  )}
                  {cantServiceAlertData.removedParts && cantServiceAlertData.removedParts.length > 0 && (
                    <Text className="text-[11px] text-amber-900 dark:text-amber-200 mt-1 font-semibold">
                      Reclaimed to Stock: {cantServiceAlertData.removedParts.map((p) => p.part_name).filter(Boolean).join(', ')}
                    </Text>
                  )}
                </View>
              </ScrollView>
            ) : (
              /* Pending Removal Breakdown */
              <>
                <View className="mb-3 rounded-2xl border border-amber-200 dark:border-amber-800/80 bg-amber-50/50 dark:bg-amber-950/30 p-3 space-y-1.5">
                  <View className="flex-row items-center justify-between py-0.5 border-b border-amber-200/60 dark:border-amber-800/60">
                    <Text className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Battery ID</Text>
                    <Text className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                      {battery?.battery_code || code}
                    </Text>
                  </View>
                  <View className="flex-row items-center justify-between py-0.5 border-b border-amber-200/60 dark:border-amber-800/60">
                    <Text className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Fitted By</Text>
                    <Text className="text-xs font-bold text-slate-900 dark:text-white">
                      {cantServiceAlertData?.fittedBy || 'Technician'}
                    </Text>
                  </View>
                  <View className="flex-row items-center justify-between py-0.5 border-b border-amber-200/60 dark:border-amber-800/60">
                    <Text className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Tested &amp; Reported By</Text>
                    <Text className="text-xs font-bold text-amber-900 dark:text-amber-200">
                      {cantServiceAlertData?.staffName || 'Supervisor'}
                    </Text>
                  </View>
                  {cantServiceAlertData?.note && (
                    <View className="pt-0.5">
                      <Text className="text-[11px] text-amber-900 dark:text-amber-200 italic">
                        "{cantServiceAlertData.note}"
                      </Text>
                    </View>
                  )}
                </View>

                <View className="mb-4 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-100/70 dark:bg-amber-900/40 p-2.5 flex-row items-start gap-2">
                  <Icon name="wrench" color="#b45309" size={15} />
                  <View className="flex-1">
                    <Text className="text-xs font-bold text-amber-900 dark:text-amber-200">
                      Mandatory: Remove All Fitted Parts
                    </Text>
                    <Text className="text-[11px] text-amber-800 dark:text-amber-300 leading-snug">
                      All parts must be physically removed and restocked into inventory.
                    </Text>
                  </View>
                </View>

                {/* Fitted Parts List */}
                <View className="mb-4 max-h-28">
                  {cantServiceAlertData?.parts && cantServiceAlertData.parts.length > 0 && (
                    <ScrollView nestedScrollEnabled className="space-y-1">
                      {cantServiceAlertData.parts.map((p, pIdx) => (
                        <View
                          key={p.id || pIdx}
                          className="flex-row items-center justify-between rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 px-2.5 py-1.5"
                        >
                          <Text className="text-xs font-bold text-slate-800 dark:text-slate-200" numberOfLines={1}>
                            {p.part_name}
                          </Text>
                          <Text className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                            Qty {p.quantity_used || 1}
                          </Text>
                        </View>
                      ))}
                    </ScrollView>
                  )}
                </View>
              </>
            )}

            {/* Modal Actions */}
            <View className="gap-2">
              {cantServiceAlertData?.mode === 'already_reclaimed' ? (
                <>
                  <View className="flex-row items-center justify-between rounded-xl bg-slate-100 dark:bg-slate-800 px-3.5 py-2 mb-1 border border-slate-200 dark:border-slate-700">
                    <Text className="text-xs font-semibold text-slate-500 dark:text-slate-400">Scan Time</Text>
                    <Text className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={async () => {
                      setShowCantServiceAlertModal(false);
                      await handleStartWork();
                    }}
                    disabled={submitting}
                    className="flex-row items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3.5 shadow-md active:bg-blue-700"
                  >
                    <Icon name="play" color="#ffffff" size={16} />
                    <Text className="text-sm font-bold text-white">Start Work Now</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      setShowCantServiceAlertModal(false);
                      allowExitRef.current = true;
                      navigation.navigate('Main', {
                        screen: 'Service',
                        params: { autoScan: Date.now() },
                      });
                    }}
                    className="flex-row items-center justify-center gap-2 rounded-2xl bg-slate-100 dark:bg-slate-800 py-3 border border-slate-200 dark:border-slate-700"
                  >
                    <Icon name="camera" color="#64748b" size={16} />
                    <Text className="text-xs font-bold text-slate-700 dark:text-slate-300">Scan Next Battery</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setShowCantServiceAlertModal(false)}
                    className="items-center rounded-2xl py-2"
                  >
                    <Text className="text-xs font-semibold text-slate-500 dark:text-slate-400">View Battery Record</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View className="flex-row items-center justify-between rounded-xl bg-amber-50 dark:bg-amber-950/40 px-3.5 py-2 mb-1 border border-amber-200 dark:border-amber-800">
                    <Text className="text-xs font-semibold text-slate-500 dark:text-slate-400">Scan Time</Text>
                    <Text className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => setShowCantServiceAlertModal(false)}
                    className="flex-row items-center justify-center gap-2 rounded-2xl bg-amber-600 py-3.5 shadow-md active:bg-amber-700"
                  >
                    <Icon name="play" color="#ffffff" size={16} />
                    <Text className="text-sm font-bold text-white">Start Work</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      setShowCantServiceAlertModal(false);
                      allowExitRef.current = true;
                      navigation.navigate('Main', {
                        screen: 'Service',
                        params: { autoScan: Date.now() },
                      });
                    }}
                    className="flex-row items-center justify-center gap-2 rounded-2xl bg-slate-100 dark:bg-slate-800 py-2.5 border border-slate-200 dark:border-slate-700"
                  >
                    <Icon name="camera" color="#64748b" size={14} />
                    <Text className="text-xs font-semibold text-slate-700 dark:text-slate-300">Scan Next Battery</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Parts Removed & Restocked Success Modal ───────────────────────── */}
      <Modal
        visible={showRemovePartsSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRemovePartsSuccessModal(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/60 px-6">
          <View className="w-full max-w-sm rounded-3xl border border-emerald-200 bg-white dark:bg-slate-900 p-6 shadow-2xl">
            <View className="mb-4 h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
              <Icon name="checkCircle" color="#059669" size={24} />
            </View>
            <Text className="mb-1.5 text-lg font-bold text-slate-900 dark:text-white">
              Parts Removed &amp; Restocked
            </Text>
            <Text className="mb-5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              The parts have been successfully removed from{' '}
              <Text className="font-bold text-slate-800 dark:text-slate-200">{battery?.battery_code}</Text> and
              restocked back into inventory.
            </Text>
            <View className="gap-2.5">
              <TouchableOpacity
                onPress={() => {
                  setShowRemovePartsSuccessModal(false);
                  allowExitRef.current = true;
                  navigation.navigate('Main', {
                    screen: 'Service',
                    params: { autoScan: Date.now() },
                  });
                }}
                className="flex-row items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 shadow-md"
              >
                <Icon name="camera" color="#ffffff" size={16} />
                <Text className="text-sm font-bold text-white">Scan Next Battery</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowRemovePartsSuccessModal(false)}
                className="items-center rounded-xl bg-slate-100 dark:bg-slate-800 py-3 border border-slate-200 dark:border-slate-700"
              >
                <Text className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  View Battery Details
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Exit Confirmation Modal (When user scans battery & tries to go back) ────────────────── */}
      <Modal
        visible={showExitConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={handleCancelExit}
      >
        <View className="flex-1 items-center justify-center bg-black/60 px-6">
          <View className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <View className="mb-4 h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 border border-amber-200">
              <Icon name="alertTriangle" color="#d97706" size={22} />
            </View>
            <Text className="mb-1.5 text-lg font-bold text-slate-900">Exit Battery Service?</Text>
            <Text className="mb-3 text-xs text-slate-500 leading-relaxed">
              You scanned <Text className="font-bold text-slate-800">{code}</Text> for servicing. Leaving now will exit this active repair session.
            </Text>
            <View className="mb-5 rounded-xl bg-amber-50/80 p-3 border border-amber-200/80">
              <Text className="text-[11px] font-semibold text-amber-800">
                Any running timer or unsubmitted repair notes may be lost.
              </Text>
            </View>
            <View className="gap-2.5">
              <TouchableOpacity
                onPress={handleCancelExit}
                className="items-center rounded-xl bg-blue-600 py-3.5 shadow-md shadow-blue-600/30"
              >
                <Text className="text-sm font-bold text-white">Continue Repair Work</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirmExit}
                className="items-center rounded-xl bg-slate-100 py-3 border border-slate-200"
              >
                <Text className="text-xs font-semibold text-slate-700">Yes, Exit Session</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Fullscreen Photo Lightbox Modal ────────────────────────────────────── */}
      <ImageViewerModal
        visible={lightboxVisible}
        images={lightboxImages}
        initialIndex={lightboxIndex}
        title={lightboxTitle}
        onClose={() => setLightboxVisible(false)}
      />
    </ScrollView>
  );
}
