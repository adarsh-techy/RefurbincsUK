import { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import apiClient from '../../../services/api-client';
import useFetchList from '../../../utils/use-fetch-list';
import formatDuration from '../../../utils/format-duration';
import { canTestBatteries } from '../../../utils/permissions';

// A technician's scan-and-repair flow for one battery — exactly replicates mobile BatteryDetailScreen
function TechnicianRepairPanel({
  battery,
  services = [],
  pendingPartsRemoval = [],
  onUpdated,
  onDone,
}) {
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const canTest = canTestBatteries(user);

  const { data: partsList } = useFetchList('/parts');
  const parts = partsList || [];

  const { data: issueReasonsList } = useFetchList('/issue-reasons?activeOnly=true');
  const issueReasons = issueReasonsList || [];

  const { data: availableServicesList } = useFetchList('/services?activeOnly=true');
  const availableServices = (availableServicesList || []).filter((s) => !s.is_mandatory);

  // Active repair & testing state
  const [selectedPartIds, setSelectedPartIds] = useState([]);
  const [notes, setNotes] = useState('');
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);
  const [testingNotes, setTestingNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Live running timers
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [testingElapsedSeconds, setTestingElapsedSeconds] = useState(0);

  // Modals state — identical to mobile app
  const [modalType, setModalType] = useState(null); // 'submitted' | 'completed' | 'unserviceable' | 'passed_back' | 'parts_removed'
  const redirectTimerRef = useRef(null);

  const passBackService = services.find((s) => s.service_name === 'Passed back to Technician');
  const isPassedBack =
    (battery?.status === 'in_repair' && !!passBackService) ||
    (battery?.status === 'in_repair' && (pendingPartsRemoval?.length || 0) > 0) ||
    (battery?.status === 'unserviceable' && (pendingPartsRemoval?.length || 0) > 0);

  const [searchParams] = useSearchParams();
  const fromScan = searchParams.get('fromScan') === 'true';
  const [showScanStartWorkModal, setShowScanStartWorkModal] = useState(false);
  const [scanTime, setScanTime] = useState(null);
  const [showPassedBackScanModal, setShowPassedBackScanModal] = useState(false);
  const [passedBackScanTime, setPassedBackScanTime] = useState(null);

  useEffect(() => {
    if (fromScan && battery?.status === 'tested_parts_removed') {
      setScanTime(new Date());
      setShowScanStartWorkModal(true);
    }
  }, [fromScan, battery?.status]);

  useEffect(() => {
    if (fromScan && isPassedBack) {
      setPassedBackScanTime(new Date());
      setShowPassedBackScanModal(true);
    }
  }, [fromScan, isPassedBack]);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  function triggerModalAndRedirect(type) {
    setModalType(type);
    if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    // When passed to tech, or when in technician workflow, auto-redirect to scan next battery
    if (type === 'passed_back' || (user?.role === 'technician' && !canTest)) {
      redirectTimerRef.current = setTimeout(() => {
        handleScanNext();
      }, 2200);
    }
  }

  // Issue reporting state
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [showTestingUnserviceableForm, setShowTestingUnserviceableForm] = useState(false);
  const [selectedReasonId, setSelectedReasonId] = useState('');
  const [issueNote, setIssueNote] = useState('');
  const [issuePhotos, setIssuePhotos] = useState([]);

  // Parts removal state
  const [selectedRemovalIds, setSelectedRemovalIds] = useState([]);
  const [removingParts, setRemovingParts] = useState(false);
  const [removePartsError, setRemovePartsError] = useState(null);

  // Live timer for in_progress
  const workStartedAt = battery?.work_started_at;
  useEffect(() => {
    if (battery?.status !== 'in_progress' || !workStartedAt) return;
    const startMs = new Date(workStartedAt).getTime();
    function tick() {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [battery?.status, workStartedAt]);

  // Live timer for in_testing
  const testingStartedAt = battery?.testing_started_at;
  useEffect(() => {
    if (battery?.status !== 'in_testing' || !testingStartedAt) {
      setTestingElapsedSeconds(0);
      return;
    }
    const startMs = new Date(testingStartedAt).getTime();
    function tick() {
      setTestingElapsedSeconds(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [battery?.status, testingStartedAt]);

  async function handleStartTesting() {
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.patch(`/batteries/${battery.id}/start-testing`);
      if (onUpdated) onUpdated();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (pendingPartsRemoval?.length > 0) {
      setSelectedRemovalIds(pendingPartsRemoval.map((p) => p.id));
    }
  }, [pendingPartsRemoval]);

  function togglePart(id) {
    setSelectedPartIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  function toggleService(serviceId) {
    setSelectedServiceIds((prev) =>
      prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId]
    );
  }

  function toggleRemovalId(repairId) {
    setSelectedRemovalIds((prev) =>
      prev.includes(repairId) ? prev.filter((id) => id !== repairId) : [...prev, repairId]
    );
  }

  async function handleStartWork() {
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.patch(`/batteries/${battery.id}/start-work`);
      if (onUpdated) onUpdated();
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      setError(msg);
      throw err;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCompleteRepair() {
    if (selectedPartIds.length === 0) {
      setError('Select at least one part');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const batchId = crypto.randomUUID();
      for (const partId of selectedPartIds) {
        await apiClient.post('/repairs', {
          batteryId: battery.id,
          partId,
          notes: notes || undefined,
          batchId,
        });
      }
      setElapsedSeconds(0);
      setSelectedPartIds([]);
      setNotes('');
      if (onUpdated) onUpdated();
      if (canTest) {
        setModalType('supervisor_choice');
      } else {
        triggerModalAndRedirect('submitted');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCompleteTesting() {
    setSubmitting(true);
    setError(null);
    try {
      if (!battery.testing_started_at) {
        await apiClient.patch(`/batteries/${battery.id}/start-testing`);
      }
      await apiClient.patch(`/batteries/${battery.id}/complete-testing`, {
        serviceIds: selectedServiceIds,
        notes: testingNotes || undefined,
      });
      setSelectedServiceIds([]);
      setTestingNotes('');
      onUpdated();
      triggerModalAndRedirect('completed');
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePassToTech() {
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.patch(`/batteries/${battery.id}/pass-to-tech`, {
        note: issueNote || undefined,
      });
      setShowTestingUnserviceableForm(false);
      setIssueNote('');
      setIssuePhotos([]);
      onUpdated();
      triggerModalAndRedirect('passed_back');
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReportIssue(isTesting = false) {
    if (!isTesting && !selectedReasonId) {
      setError('Select a reason');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.patch(`/batteries/${battery.id}/report-issue`, {
        reasonId: selectedReasonId ? Number(selectedReasonId) : null,
        note: issueNote || undefined,
        photos: issuePhotos.length > 0 ? issuePhotos : undefined,
      });
      setElapsedSeconds(0);
      setShowIssueForm(false);
      setShowTestingUnserviceableForm(false);
      setSelectedReasonId('');
      setIssueNote('');
      setIssuePhotos([]);
      triggerModalAndRedirect('unserviceable');
      if (onUpdated) onUpdated();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleContinueToRemoveParts() {
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.patch(`/batteries/${battery.id}/report-issue`, {
        reasonId: selectedReasonId ? Number(selectedReasonId) : null,
        note: issueNote || 'Test failed - removing fitted parts',
      });
      setShowTestingUnserviceableForm(false);
      setIssueNote('');
      setIssuePhotos([]);
      if (onUpdated) onUpdated();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function handlePhotoSelect(e) {
    const files = Array.from(e.target.files || []).slice(0, 3 - issuePhotos.length);
    e.target.value = '';
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = () => {
        setIssuePhotos((prev) => (prev.length >= 3 ? prev : [...prev, reader.result]));
      };
      reader.readAsDataURL(file);
    }
  }

  function handleRemovePhoto(idx) {
    setIssuePhotos((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleRemoveParts() {
    if (selectedRemovalIds.length === 0) {
      setRemovePartsError('Please select fitted parts to remove.');
      return;
    }
    if (selectedRemovalIds.length < pendingPartsRemoval.length) {
      setRemovePartsError('Mandatory: All fitted parts must be removed before proceeding.');
      return;
    }
    setRemovingParts(true);
    setRemovePartsError(null);
    try {
      await apiClient.patch(`/batteries/${battery.id}/remove-parts`, {
        repairIds: selectedRemovalIds,
      });
      setSelectedRemovalIds([]);
      setModalType('parts_removed');
      if (onUpdated) onUpdated();
    } catch (err) {
      setRemovePartsError(err.response?.data?.message || err.message);
    } finally {
      setRemovingParts(false);
    }
  }

  function handleScanNext() {
    if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    setModalType(null);
    if (onDone) {
      onDone();
    } else {
      navigate('/');
    }
  }

  function handleCloseModal() {
    if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    setModalType(null);
    if (onUpdated) onUpdated();
  }



  return (
    <div className="mb-6">
      {/* ── Passed Back to Technician Banner ── */}
      {battery.status === 'in_repair' && passBackService && (
        <div className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/20">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-amber-800 dark:text-amber-300">⚠</span>
            <span className="text-sm font-bold text-amber-900 dark:text-amber-200">
              Marked Can't Service · Passed to Technician
            </span>
          </div>
          <p className="mt-1 mb-2 text-xs text-amber-800 leading-relaxed dark:text-amber-300">
            Marked by <span className="font-bold">{passBackService.staff_name || 'Supervisor'}</span>
            {passBackService.completed_at ? ` on ${new Date(passBackService.completed_at).toLocaleString()}` : ''}
          </p>
          {passBackService.notes && (
            <div className="mb-2 rounded-xl border border-amber-200 bg-white/80 p-2.5 dark:border-amber-900 dark:bg-surface-900">
              <p className="text-xs font-medium italic text-amber-900 dark:text-amber-200">"{passBackService.notes}"</p>
            </div>
          )}
          <div className="border-t border-amber-200/60 pt-1 text-[11px] font-bold text-amber-900 dark:text-amber-300">
            Action: Please remove any fitted parts below before restarting rework.
          </div>
        </div>
      )}

      {/* ── Status: UNSERVICEABLE (Clean state, no parts to remove) ── */}
      {battery.status === 'unserviceable' && pendingPartsRemoval.length === 0 && (
        <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50/70 p-5 text-center dark:border-rose-900/40 dark:bg-surface-900">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-xl text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
            ⚠
          </div>
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            Battery Marked Unserviceable
          </p>
          <p className="mt-1 mb-4 text-xs text-slate-500 dark:text-neutral-400 max-w-sm mx-auto leading-relaxed">
            This battery ({battery.battery_code}) was marked unserviceable and cannot be repaired.
          </p>
          <button
            type="button"
            onClick={handleScanNext}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition-colors"
          >
            <span>📷 Scan Next Battery</span>
          </button>
        </div>
      )}

      {/* ── Mandatory: Remove All Fitted Parts ── */}
      {(battery.status === 'unserviceable' || battery.status === 'in_repair') &&
        pendingPartsRemoval.length > 0 && (
          <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-amber-800">🔧</span>
              <span className="text-sm font-bold text-amber-900 dark:text-amber-200">
                Mandatory: Remove All Fitted Parts
              </span>
            </div>
            <p className="mb-3 text-[11px] leading-relaxed text-amber-800/80 dark:text-amber-300">
              This battery failed testing. All previously fitted parts must be physically removed and restocked into inventory:
            </p>

            <div className="flex flex-col gap-2">
              {pendingPartsRemoval.map((p) => {
                const isChecked = selectedRemovalIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleRemovalId(p.id)}
                    className={`flex items-center justify-between rounded-xl border p-3 transition-colors ${
                      isChecked
                        ? 'border-amber-500 bg-amber-100/70 dark:border-amber-600 dark:bg-amber-900/40'
                        : 'border-amber-200 bg-white dark:border-white/10 dark:bg-surface-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded-md border text-xs font-bold ${
                          isChecked
                            ? 'border-amber-600 bg-amber-600 text-white'
                            : 'border-slate-300 bg-white dark:border-neutral-600 dark:bg-surface-800'
                        }`}
                      >
                        {isChecked ? '✓' : ''}
                      </div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white">{p.part_name}</span>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-neutral-400">
                      Qty {p.quantity_used}
                    </span>
                  </button>
                );
              })}
            </div>

            {removePartsError && (
              <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">{removePartsError}</p>
            )}

            <button
              type="button"
              onClick={handleRemoveParts}
              disabled={removingParts || selectedRemovalIds.length < pendingPartsRemoval.length}
              className="mt-3 flex w-full items-center justify-center rounded-xl bg-amber-600 py-3.5 text-xs font-bold text-white shadow-md hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              {removingParts ? 'Restocking Parts…' : `Confirm Removal & Restock All Parts (${pendingPartsRemoval.length})`}
            </button>
          </div>
        )}

      {/* ── Status: IN_REPAIR & UNVERIFIED SHIPMENT ── */}
      {(() => {
        const isShipmentUnverified =
          battery.truck_intake_id &&
          (battery.intake_status === 'pending_arrival' || !battery.intake_verified_at) &&
          battery.intake_status !== 'verified';

        if ((battery.status !== 'in_repair' && battery.status !== 'tested_parts_removed') || pendingPartsRemoval.length > 0) return null;

        if (isShipmentUnverified) {
          return (
            <div className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800/60 dark:bg-amber-950/30">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-800 text-xs font-bold dark:bg-amber-900/60 dark:text-amber-200">
                  ⏳
                </span>
                <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
                  Shipment Arrival Pending Verification
                </p>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Truck #{battery.intake_truck_number || 'shipment'} has not been verified at the workshop yet. Workshop staff must verify arrival on the Truck Intake page before work can begin.
              </p>
            </div>
          );
        }

        return (
          <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900/40 dark:bg-surface-900">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {battery.status === 'tested_parts_removed'
                  ? 'Parts Removed · Ready for Rework'
                  : 'Ready to start?'}
              </p>
              <span className="rounded-full bg-blue-100 border border-blue-200/80 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/60 dark:text-blue-300">
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <p className="mt-0.5 mb-3 text-xs text-slate-500 dark:text-neutral-400">
              {battery.status === 'tested_parts_removed'
                ? 'All fitted parts have been reclaimed and restocked into inventory. Starting work marks this battery as in progress and records your start time.'
                : "This battery hasn't been touched yet. Starting work marks it as in progress."}
            </p>
            {error && <p className="mb-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
            <button
              type="button"
              onClick={handleStartWork}
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <span>▶</span>
              <span>{submitting ? 'Starting…' : 'Start Work'}</span>
            </button>
          </div>
        );
      })()}

      {/* ── Status: IN_PROGRESS ── */}
      {battery.status === 'in_progress' && (
        <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900/40 dark:bg-surface-900">
          {/* Live Timer Banner */}
          <div className="mb-3 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">Time on repair</span>
            <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-400">
              {formatDuration(elapsedSeconds)}
            </span>
          </div>

          {!showIssueForm && (
            <>
              <p className="mb-2 text-xs font-bold text-slate-900 dark:text-white">
                Select Parts Changed ({selectedPartIds.length})
              </p>

              <div className="flex flex-col gap-2">
                {parts.map((p) => {
                  const selected = selectedPartIds.includes(p.id);
                  const disabled = p.quantity <= 0;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => togglePart(p.id)}
                      className={`flex items-center justify-between rounded-xl border p-3 text-left transition-colors ${
                        selected
                          ? 'border-blue-500 bg-blue-100/70 dark:border-blue-500 dark:bg-blue-950/40'
                          : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-surface-800'
                      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      <span className="text-xs font-bold text-slate-900 dark:text-white">{p.name}</span>
                      <span className="text-[10px] text-slate-500 dark:text-neutral-400">
                        {p.quantity} in stock
                      </span>
                    </button>
                  );
                })}
              </div>

              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes (optional)"
                className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-surface-950 dark:text-white"
              />

              {error && <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}

              <button
                type="button"
                onClick={handleCompleteRepair}
                disabled={submitting}
                className="mt-3 flex w-full items-center justify-center rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Submitting…' : 'Submit for Testing'}
              </button>
            </>
          )}

          {/* Issue Report Section */}
          <div className={showIssueForm ? 'pt-0' : 'mt-4 border-t border-slate-200 pt-3 dark:border-white/10'}>
            {!showIssueForm ? (
              <button
                type="button"
                onClick={() => setShowIssueForm(true)}
                className="w-full rounded-xl border border-red-200 bg-red-50 py-3 text-xs font-bold text-red-600 hover:bg-red-100 transition-colors dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400"
              >
                Can't service this battery?
              </button>
            ) : (
              <div className="rounded-xl border border-red-200 bg-white p-3.5 dark:border-red-900/40 dark:bg-surface-950">
                <p className="text-xs font-bold text-slate-900 dark:text-white mb-2">Report Issue</p>
                <div className="flex flex-col gap-1.5 mb-2.5 max-h-48 overflow-y-auto">
                  {issueReasons.map((reason) => (
                    <button
                      key={reason.id}
                      type="button"
                      onClick={() => setSelectedReasonId(reason.id)}
                      className={`flex items-center justify-between rounded-xl border p-2.5 text-left text-xs transition-colors ${
                        String(selectedReasonId) === String(reason.id)
                          ? 'border-red-500 bg-red-50 font-bold text-red-700 dark:bg-red-950/40 dark:text-red-300'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-surface-900 dark:text-neutral-300'
                      }`}
                    >
                      <span>{reason.label}</span>
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  value={issueNote}
                  onChange={(e) => setIssueNote(e.target.value)}
                  placeholder="Notes (optional)"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 dark:border-neutral-700 dark:bg-surface-900 dark:text-white mb-2.5"
                />

                {/* Photo Previews & Upload */}
                <div className="mb-3">
                  <span className="text-xs font-bold text-slate-800 dark:text-neutral-200 block mb-1">
                    Upload Photos ({issuePhotos.length}/3)
                  </span>
                  {issuePhotos.length > 0 && (
                    <div className="flex items-center gap-2 mb-2">
                      {issuePhotos.map((src, idx) => (
                        <div key={idx} className="relative h-14 w-14 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                          <img src={src} alt="" className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(idx)}
                            className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-[10px] text-white"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {issuePhotos.length < 3 && (
                    <label className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 py-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors">
                      <span>📷 Choose Photos</span>
                      <input type="file" accept="image/*" multiple onChange={handlePhotoSelect} className="hidden" />
                    </label>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowIssueForm(false);
                      setIssuePhotos([]);
                    }}
                    className="flex-1 rounded-xl bg-slate-100 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReportIssue(false)}
                    disabled={submitting}
                    className="flex-1 rounded-xl bg-red-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
                  >
                    {submitting ? 'Reporting…' : 'Report Issue'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Status: IN_TESTING ── */}
      {battery.status === 'in_testing' && (
        <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900/40 dark:bg-surface-900">
          {canTest ? (
            <>
              {!battery.testing_started_at ? (
                <div className="rounded-xl border border-blue-200 bg-white p-5 text-center dark:border-blue-900/50 dark:bg-surface-950 shadow-sm">
                  <div className="mx-auto mb-2.5 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 text-xl dark:bg-blue-950/50 dark:text-blue-400">
                    ⏱
                  </div>
                  <p className="text-base font-bold text-slate-900 dark:text-white">
                    Ready to Begin Testing?
                  </p>
                  <p className="mt-1 mb-4 text-xs text-slate-500 dark:text-neutral-400 max-w-xs mx-auto leading-relaxed">
                    Click the button below to start testing this battery and begin the diagnostic timer.
                  </p>
                  {error && <p className="mb-3 text-xs text-red-600 dark:text-red-400">{error}</p>}
                  <button
                    type="button"
                    onClick={handleStartTesting}
                    disabled={submitting}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    <span>▶</span>
                    <span>{submitting ? 'Starting Timer…' : 'Start Testing Timer'}</span>
                  </button>
                </div>
              ) : (
                <>
                  {/* Live Testing Timer Banner (Supervisor only) */}
                  <div className="mb-3 flex items-center justify-between rounded-xl border border-blue-200 bg-blue-100/70 px-3.5 py-2.5 dark:border-blue-900 dark:bg-blue-950/40">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
                      </span>
                      <span className="text-xs font-bold text-blue-800 dark:text-blue-300">Time in testing</span>
                    </div>
                    <span className="text-base font-extrabold text-blue-700 dark:text-blue-400 font-mono">
                      {formatDuration(testingElapsedSeconds)}
                    </span>
                  </div>

                  {availableServices.length > 0 && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          Services Performed ({selectedServiceIds.length})
                        </span>
                        {availableServices
                          .filter((s) => selectedServiceIds.includes(s.id))
                          .reduce((sum, s) => sum + Number(s.rate || 0), 0) > 0 && (
                          <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                            +£
                            {availableServices
                              .filter((s) => selectedServiceIds.includes(s.id))
                              .reduce((sum, s) => sum + Number(s.rate || 0), 0)
                              .toFixed(2)}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col gap-2">
                        {availableServices.map((s) => {
                          const isChecked = selectedServiceIds.includes(s.id);
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => toggleService(s.id)}
                              className={`flex items-center justify-between rounded-xl border p-3 text-left transition-colors ${
                                isChecked
                                  ? 'border-blue-500 bg-blue-100/70 dark:border-blue-500 dark:bg-blue-950/40'
                                  : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-surface-800'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 flex-1 pr-2">
                                <div
                                  className={`flex h-5 w-5 items-center justify-center rounded-md border text-xs font-bold ${
                                    isChecked
                                      ? 'border-blue-600 bg-blue-600 text-white'
                                      : 'border-slate-300 bg-white dark:border-neutral-600 dark:bg-surface-900'
                                  }`}
                                >
                                  {isChecked ? '✓' : ''}
                                </div>
                                <span className="text-xs font-bold text-slate-900 dark:text-white">{s.name}</span>
                              </div>
                              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                +£{Number(s.rate || 0).toFixed(2)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <input
                    type="text"
                    value={testingNotes}
                    onChange={(e) => setTestingNotes(e.target.value)}
                    placeholder="Testing Notes (optional)"
                    className="mb-3 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-surface-950 dark:text-white"
                  />

                  {error && <p className="mb-2 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}

                  <button
                    type="button"
                    onClick={handleCompleteTesting}
                    disabled={submitting}
                    className="flex w-full items-center justify-center rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {submitting ? 'Completing…' : 'Complete Testing & Approve'}
                  </button>

                  {/* Can't Service / Pass back section */}
                  <div className="mt-4 border-t border-slate-200 pt-3 dark:border-white/10">
                    {!showTestingUnserviceableForm ? (
                      <button
                        type="button"
                        onClick={() => setShowTestingUnserviceableForm(true)}
                        className="w-full rounded-xl border border-red-200 bg-red-50 py-3 text-xs font-bold text-red-600 hover:bg-red-100 transition-colors dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400"
                      >
                        Can't service this battery?
                      </button>
                    ) : (
                      <div className="rounded-xl border border-red-200 bg-white p-3.5 dark:border-red-900/40 dark:bg-surface-950">
                        <p className="text-xs font-bold text-slate-900 dark:text-white mb-2">
                          Testing Failure Options
                        </p>
                        <input
                          type="text"
                          value={issueNote}
                          onChange={(e) => setIssueNote(e.target.value)}
                          placeholder="Notes / reason for rejection"
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 dark:border-neutral-700 dark:bg-surface-900 dark:text-white mb-3"
                        />

                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={handlePassToTech}
                            disabled={submitting}
                            className="flex w-full items-center justify-center rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
                          >
                            Pass to Tech (Parts Removed)
                          </button>
                          <button
                            type="button"
                            onClick={handleContinueToRemoveParts}
                            disabled={submitting}
                            className="flex w-full items-center justify-center rounded-xl bg-amber-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50 transition-colors"
                          >
                            Continue to Remove Parts
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowTestingUnserviceableForm(false)}
                            className="w-full rounded-xl bg-slate-100 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 dark:bg-surface-800 dark:text-neutral-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          ) : (
            /* Technician view when battery is in testing: no testing controls, scan next battery */
            <div className="rounded-xl border border-blue-200 bg-white p-5 text-center dark:border-blue-900/40 dark:bg-surface-950">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 text-2xl dark:border-blue-900/60 dark:bg-blue-950/50 dark:text-blue-300">
                ⚡
              </div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                Work Completed & Submitted for Testing
              </p>
              <p className="mt-1 mb-4 text-xs text-slate-500 dark:text-neutral-400 max-w-sm mx-auto leading-relaxed">
                Your repair work on <span className="font-semibold text-slate-800 dark:text-neutral-200">{battery.battery_code}</span> is done and your repair timer has stopped. This battery is awaiting verification by a Supervisor.
              </p>
              <button
                type="button"
                onClick={handleScanNext}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition-colors"
              >
                <span>📷 Scan Next Battery</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── MODALS (Exact replica of mobile app modals) ── */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-surface-900 text-center animate-in fade-in zoom-in-95 duration-200">
            {modalType === 'supervisor_choice' && (
              <>
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 text-2xl dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-400">
                  ⚡
                </div>
                <h3 className="mb-1 text-lg font-bold text-slate-900 dark:text-white">Repair Work Logged!</h3>
                <p className="mb-5 text-xs text-slate-500 dark:text-neutral-400 leading-relaxed">
                  <span className="font-bold text-slate-800 dark:text-white">{battery.battery_code}</span> repair is complete. As a Supervisor, you can proceed directly to testing or step away.
                </p>
                <div className="flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={async () => {
                      setModalType(null);
                      await handleStartTesting();
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition-colors cursor-pointer"
                  >
                    <span>▶</span>
                    <span>Test This Battery Now</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModalType(null);
                      if (onUpdated) onUpdated();
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-300 transition-colors cursor-pointer"
                  >
                    Stay on Battery Page
                  </button>
                  <button
                    type="button"
                    onClick={handleScanNext}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-surface-900 dark:text-neutral-300 transition-colors cursor-pointer"
                  >
                    📷 Scan Next Battery
                  </button>
                </div>
              </>
            )}

            {modalType === 'submitted' && (
              <>
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 text-2xl">
                  ⚡
                </div>
                <h3 className="mb-1 text-lg font-bold text-slate-900 dark:text-white">Work Completed & Submitted!</h3>
                <p className="mb-5 text-xs text-slate-500 dark:text-neutral-400 leading-relaxed">
                  <span className="font-bold text-slate-800 dark:text-white">{battery.battery_code}</span> repair work is completed and time is stopped. It has been submitted for testing.
                </p>
                <div className="flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={handleScanNext}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition-colors"
                  >
                    <span>📷 Scan Next Battery</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-300"
                  >
                    Back to Service List
                  </button>
                </div>
                {user?.role === 'technician' && !canTest && (
                  <p className="mt-4 text-xs font-semibold text-emerald-600 dark:text-emerald-400 animate-pulse">
                    Redirecting to scan page in 2s…
                  </p>
                )}
              </>
            )}

            {modalType === 'completed' && (
              <>
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 text-2xl">
                  ✓
                </div>
                <h3 className="mb-1 text-lg font-bold text-slate-900 dark:text-white">Completed!</h3>
                <p className="mb-5 text-xs text-slate-500 dark:text-neutral-400 leading-relaxed">
                  <span className="font-bold text-slate-800 dark:text-white">{battery.battery_code}</span> has been marked repaired and is ready for return to the client.
                </p>
                <div className="flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={handleScanNext}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition-colors"
                  >
                    <span>📷 Scan Next Battery</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-300"
                  >
                    Back to Service List
                  </button>
                </div>
                {user?.role === 'technician' && !canTest && (
                  <p className="mt-4 text-xs font-semibold text-emerald-600 dark:text-emerald-400 animate-pulse">
                    Redirecting to scan page in 2s…
                  </p>
                )}
              </>
            )}

            {modalType === 'passed_back' && (
              <>
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 text-2xl">
                  ↩
                </div>
                <h3 className="mb-1 text-lg font-bold text-slate-900 dark:text-white">Passed to Technician!</h3>
                <p className="mb-5 text-xs text-slate-500 dark:text-neutral-400 leading-relaxed">
                  <span className="font-bold text-slate-800 dark:text-white">{battery.battery_code}</span> has been moved back to in_repair for rework and parts removal.
                </p>
                <div className="flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={handleScanNext}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition-colors cursor-pointer"
                  >
                    <span>📷 Scan Next Battery</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-300 transition-colors cursor-pointer"
                  >
                    Stay on Battery Page
                  </button>
                </div>
                <p className="mt-4 text-xs font-semibold text-amber-600 dark:text-amber-400 animate-pulse">
                  Redirecting to scan next battery in 2s…
                </p>
              </>
            )}

            {modalType === 'unserviceable' && (
              <>
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 text-2xl">
                  ✓
                </div>
                <h3 className="mb-1 text-lg font-bold text-slate-900 dark:text-white">Reported Successfully!</h3>
                <p className="mb-5 text-xs text-slate-500 dark:text-neutral-400 leading-relaxed">
                  <span className="font-bold text-slate-800 dark:text-white">{battery.battery_code}</span> has been marked unserviceable. Your repair work on this battery is finished and time is stopped.
                </p>
                <div className="flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={handleScanNext}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition-colors"
                  >
                    <span>📷 Scan Next Battery</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-300"
                  >
                    Done
                  </button>
                </div>
                {user?.role === 'technician' && !canTest && (
                  <p className="mt-4 text-xs font-semibold text-emerald-600 dark:text-emerald-400 animate-pulse">
                    Redirecting to scan page in 2s…
                  </p>
                )}
              </>
            )}

            {modalType === 'parts_removed' && (
              <>
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 text-2xl dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-400">
                  ✓
                </div>
                <h3 className="mb-1 text-lg font-bold text-slate-900 dark:text-white">Parts Removed & Restocked!</h3>
                <p className="mb-5 text-xs text-slate-500 dark:text-neutral-400 leading-relaxed">
                  All fitted parts have been successfully removed from{' '}
                  <span className="font-bold text-slate-800 dark:text-white">{battery.battery_code}</span> and restocked back into inventory. The battery status is now{' '}
                  <span className="font-bold text-rose-600 dark:text-rose-400">Unserviceable · Test Failed</span>.
                </p>
                <div className="flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={handleScanNext}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition-colors"
                  >
                    <span>📷 Scan Next Battery</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
                      setModalType(null);
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-300"
                  >
                    View Battery Details
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Parts Removed Battery Scan / Start Work Modal ── */}
      {showScanStartWorkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-surface-900 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 text-2xl dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-400">
              ⚡
            </div>
            
            <div className="mb-2 flex items-center justify-center">
              <span className="rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-[11px] font-bold text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-400">
                Parts Removed · Ready for Rework
              </span>
            </div>

            <h3 className="mb-1 text-lg font-bold text-slate-900 dark:text-white">
              Start Work on Battery
            </h3>

            <p className="mb-4 text-xs text-slate-500 dark:text-neutral-400 leading-relaxed">
              This battery previously had its fitted parts removed & restocked. You can now start repair work and track your service time.
            </p>

            {/* Scan Time & Battery Info Box */}
            <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-left dark:border-neutral-800 dark:bg-surface-950 space-y-2">
              <div className="flex items-center justify-between text-xs pb-1.5 border-b border-slate-200/60 dark:border-neutral-800">
                <span className="text-slate-500 dark:text-neutral-400 font-medium">Battery ID</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                  {battery.battery_code}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs pb-1.5 border-b border-slate-200/60 dark:border-neutral-800">
                <span className="text-slate-500 dark:text-neutral-400 font-medium">Scan Time</span>
                <span className="font-semibold text-slate-800 dark:text-white">
                  {(scanTime || new Date()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-neutral-400 font-medium">Scan Date</span>
                <span className="font-medium text-slate-700 dark:text-neutral-300">
                  {(scanTime || new Date()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>

            {error && <p className="mb-3 text-xs font-semibold text-red-600 dark:text-red-400">{error}</p>}

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await handleStartWork();
                    setShowScanStartWorkModal(false);
                  } catch {}
                }}
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <span>▶</span>
                <span>{submitting ? 'Starting Work…' : 'Start Work Now'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowScanStartWorkModal(false)}
                className="w-full rounded-xl border border-slate-200 bg-slate-100 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-300 transition-colors"
              >
                View Details First
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Scan Modal: Passed Back Battery (Rework Required) ── */}
      {showPassedBackScanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-amber-200 bg-white p-6 shadow-2xl dark:border-amber-900/60 dark:bg-surface-900 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 border border-amber-300 text-amber-700 text-2xl dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-400">
              ⚠
            </div>
            
            <div className="mb-2 flex items-center justify-center">
              <span className="rounded-full bg-amber-100 border border-amber-300 px-3 py-1 text-[11px] font-bold text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                Marked Can't Service · Passed to Technician
              </span>
            </div>

            <h3 className="mb-1 text-lg font-bold text-slate-900 dark:text-white">
              Passed Back for Rework
            </h3>

            <p className="mb-4 text-xs text-slate-500 dark:text-neutral-400 leading-relaxed">
              This battery failed testing and was passed back for rework. Please remove any fitted parts before restarting repair work.
            </p>

            {/* Scan Time & Battery Info Box */}
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 text-left dark:border-amber-900/40 dark:bg-surface-950 space-y-2">
              <div className="flex items-center justify-between text-xs pb-1.5 border-b border-amber-200/60 dark:border-neutral-800">
                <span className="text-slate-500 dark:text-neutral-400 font-medium">Battery ID</span>
                <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
                  {battery.battery_code}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs pb-1.5 border-b border-amber-200/60 dark:border-neutral-800">
                <span className="text-slate-500 dark:text-neutral-400 font-medium">Scan Time</span>
                <span className="font-semibold text-slate-800 dark:text-white">
                  {(passedBackScanTime || new Date()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs pb-1.5 border-b border-amber-200/60 dark:border-neutral-800">
                <span className="text-slate-500 dark:text-neutral-400 font-medium">Scan Date</span>
                <span className="font-medium text-slate-700 dark:text-neutral-300">
                  {(passedBackScanTime || new Date()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs pb-1.5 border-b border-amber-200/60 dark:border-neutral-800">
                <span className="text-slate-500 dark:text-neutral-400 font-medium">Marked By</span>
                <span className="font-bold text-amber-900 dark:text-amber-200">
                  {passBackService?.staff_name || 'Supervisor'}
                </span>
              </div>
              {passBackService?.completed_at && (
                <div className="flex items-center justify-between text-xs pb-1.5 border-b border-amber-200/60 dark:border-neutral-800">
                  <span className="text-slate-500 dark:text-neutral-400 font-medium">Marked On</span>
                  <span className="text-slate-700 dark:text-neutral-300">
                    {new Date(passBackService.completed_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
              )}
              {passBackService?.notes && (
                <div className="pt-1">
                  <p className="text-[11px] font-medium italic text-amber-900 dark:text-amber-200">
                    "{passBackService.notes}"
                  </p>
                </div>
              )}
            </div>

            {pendingPartsRemoval.length > 0 && (
              <div className="mb-4 rounded-xl border border-amber-300 bg-amber-100/80 p-2.5 text-left dark:border-amber-800 dark:bg-amber-950/40">
                <div className="flex items-center gap-1.5 mb-1 text-xs font-bold text-amber-900 dark:text-amber-200">
                  <span>🔧</span>
                  <span>Mandatory: Remove {pendingPartsRemoval.length} Fitted {pendingPartsRemoval.length === 1 ? 'Part' : 'Parts'}</span>
                </div>
                <div className="max-h-24 overflow-y-auto space-y-1">
                  {pendingPartsRemoval.map((p) => (
                    <div key={p.id} className="flex justify-between items-center rounded-lg bg-white/70 dark:bg-surface-900 px-2 py-1 text-xs">
                      <span className="font-medium text-slate-800 dark:text-neutral-200">{p.part_name}</span>
                      <span className="font-semibold text-slate-600 dark:text-neutral-400 text-[10px]">Qty {p.quantity_used || 1}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => setShowPassedBackScanModal(false)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 py-3.5 text-sm font-bold text-white shadow-md hover:bg-amber-700 transition-colors"
              >
                <span>▶</span>
                <span>Start Work</span>
              </button>
              <button
                type="button"
                onClick={handleScanNext}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-300 transition-colors"
              >
                <span>📷 Scan Next Battery</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TechnicianRepairPanel;
