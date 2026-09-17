import { useState } from 'react';
import { useSelector } from 'react-redux';
import apiClient from '../../../services/api-client';
import useFetchList from '../../../utils/use-fetch-list';

const inputClasses =
  'w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-100 dark:placeholder:text-neutral-500';

// A technician's scan-and-repair flow for one battery: start work (flips
// in_repair -> in_progress), pick which part(s) were changed (same
// one-row-per-part + shared batchId pattern as RepairForm.jsx, minus the
// battery lookup and staff picker — both are already known here: this
// battery, and the technician's own linked staff record, resolved
// server-side in repair.controller.js) — which auto-advances the battery to
// in_testing — then confirm it tested working to mark it repaired.
function TechnicianRepairPanel({ battery, pendingPartsRemoval = [], onUpdated }) {
  const user = useSelector((state) => state.auth.user);
  const staffRole = (user?.staff_role || '').toLowerCase();
  const canTest =
    user?.role === 'super_admin' ||
    user?.role === 'admin' ||
    staffRole === 'supervisor' ||
    staffRole === 'manager';

  const { data: parts } = useFetchList('/parts');
  // Admin-configured "can't service" reasons for the Report Issue picker
  // below — activeOnly so a disabled reason never shows up here.
  const { data: issueReasons } = useFetchList('/issue-reasons?activeOnly=true');
  // Admin-configured dynamic services & pricing
  const { data: availableServices } = useFetchList('/services?activeOnly=true');
  const [partIds, setPartIds] = useState(['']);
  const [notes, setNotes] = useState('');
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);
  const [testingNotes, setTestingNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [showIssueForm, setShowIssueForm] = useState(false);
  // Tracks which variant of the (shared) issue form is open — the
  // mid-repair one requires a reason, the testing-time one never does —
  // since showIssueForm itself is shared between both call sites.
  const [issueFormSimpleMode, setIssueFormSimpleMode] = useState(false);
  const [selectedReasonId, setSelectedReasonId] = useState('');
  const [issueNote, setIssueNote] = useState('');
  const [issuePhotos, setIssuePhotos] = useState([]);

  // Parts-reclaim state (unserviceable battery whose parts were fitted
  // during repair before it failed testing) — technician or tester can
  // both reclaim, matching who can report the issue itself.
  const [selectedRemovalIds, setSelectedRemovalIds] = useState([]);
  const [removingParts, setRemovingParts] = useState(false);
  const [removePartsError, setRemovePartsError] = useState(null);

  function toggleService(serviceId) {
    setSelectedServiceIds((prev) =>
      prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId]
    );
  }

  function updatePartRow(index, value) {
    setPartIds((prev) => prev.map((id, i) => (i === index ? value : id)));
  }

  function addPartRow() {
    setPartIds((prev) => [...prev, '']);
  }

  function removePartRow(index) {
    setPartIds((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleStartWork() {
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.patch(`/batteries/${battery.id}/start-work`);
      onUpdated();
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
      await apiClient.patch(`/batteries/${battery.id}/complete-testing`, {
        serviceIds: selectedServiceIds,
        notes: testingNotes || undefined,
      });
      onUpdated();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleComplete(e) {
    e.preventDefault();
    const chosenPartIds = partIds.filter(Boolean);
    if (chosenPartIds.length === 0) {
      setError('Select at least one part');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const batchId = crypto.randomUUID();
      for (const partId of chosenPartIds) {
        await apiClient.post('/repairs', {
          batteryId: battery.id,
          partId: Number(partId),
          notes: notes || undefined,
          batchId,
        });
      }
      onUpdated();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      setSubmitting(false);
    }
  }

  async function handleReportIssue() {
    if (!issueFormSimpleMode && !selectedReasonId) {
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
      setShowIssueForm(false);
      setSelectedReasonId('');
      setIssueNote('');
      setIssuePhotos([]);
      onUpdated();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
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
      await apiClient.patch(`/batteries/${battery.id}/remove-parts`, {
        repairIds: selectedRemovalIds,
      });
      setSelectedRemovalIds([]);
      onUpdated();
    } catch (err) {
      setRemovePartsError(err.response?.data?.message || err.message);
    } finally {
      setRemovingParts(false);
    }
  }

  // Shared "Can't service this battery?" toggle + report form — used both
  // mid-repair (in_progress, full reason picker) and by a tester during
  // testing (in_testing, simpleMode: no reason list, just notes + optional
  // photos — reason_id is nullable and simply omitted for this flow).
  function renderIssueReportSection(simpleMode = false) {
    return (
      <div className={showIssueForm ? 'pt-0' : 'mt-5 border-t border-blue-100 dark:border-white/10 pt-4'}>
        {!showIssueForm ? (
          <button
            type="button"
            onClick={() => {
              setIssueFormSimpleMode(simpleMode);
              setSelectedReasonId('');
              setShowIssueForm(true);
            }}
            className="w-full rounded-lg border border-red-300 py-3 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800/60 dark:text-red-400 dark:hover:bg-red-950/30 cursor-pointer"
          >
            Can't service this battery?
          </button>
        ) : (
          <div>
            <h3 className="mb-1 text-sm font-semibold text-slate-900 dark:text-white">
              {simpleMode ? 'Mark Unserviceable' : 'Report an Issue'}
            </h3>
            {!simpleMode && (
              <p className="mb-3 text-sm text-slate-500 dark:text-neutral-400">
                Pick a reason — this marks the battery as unserviceable.
              </p>
            )}

            {!simpleMode && (
              <select
                value={selectedReasonId}
                onChange={(e) => setSelectedReasonId(e.target.value)}
                className={inputClasses}
              >
                <option value="" disabled>
                  Select reason
                </option>
                {issueReasons.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            )}

            <textarea
              value={issueNote}
              onChange={(e) => setIssueNote(e.target.value)}
              placeholder="Notes (optional)"
              rows={2}
              className={`${inputClasses} ${simpleMode ? '' : 'mt-3'}`}
            />

            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-neutral-300">
                  Photos ({issuePhotos.length}/3)
                </span>
                <span className="text-[11px] text-slate-500 dark:text-neutral-400">Optional, max 3</span>
              </div>
              {issuePhotos.length > 0 && (
                <div className="mb-2 flex items-center gap-2">
                  {issuePhotos.map((src, idx) => (
                    <div key={idx} className="relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
                      <img src={src} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(idx)}
                        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900/80 text-white cursor-pointer"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                          <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {issuePhotos.length < 3 && (
                <label className="flex w-full cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-slate-300 py-2.5 text-xs font-medium text-slate-500 hover:border-blue-400 hover:text-blue-600 dark:border-white/20 dark:text-neutral-400">
                  + Add Photo
                  <input type="file" accept="image/*" multiple onChange={handlePhotoSelect} className="hidden" />
                </label>
              )}
            </div>

            {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowIssueForm(false);
                  setSelectedReasonId('');
                  setIssueNote('');
                  setIssuePhotos([]);
                }}
                className="flex-1 rounded-lg bg-slate-100 py-3 text-sm font-medium text-slate-700 hover:bg-slate-200 dark:bg-surface-800 dark:text-neutral-200 dark:hover:bg-surface-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReportIssue}
                disabled={submitting}
                className="flex-1 rounded-lg bg-red-600 py-3 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50 cursor-pointer"
              >
                {submitting ? 'Reporting…' : simpleMode ? 'Mark Unserviceable' : 'Report Issue'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (battery.status === 'unserviceable' && pendingPartsRemoval.length > 0) {
    return (
      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/20">
        <h2 className="mb-1 text-sm font-semibold text-amber-900 dark:text-amber-200">Parts Pending Removal</h2>
        <p className="mb-4 text-sm text-amber-700 dark:text-amber-300">
          These parts were fitted before this battery failed testing. Check off what you've
          physically removed to restock it — the rest stay flagged until they're pulled too.
        </p>

        <div className="space-y-2">
          {pendingPartsRemoval.map((p) => {
            const isChecked = selectedRemovalIds.includes(p.id);
            return (
              <label
                key={p.id}
                className={`flex items-center justify-between gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                  isChecked
                    ? 'border-amber-400 bg-amber-100/70 dark:border-amber-700 dark:bg-amber-900/30'
                    : 'border-slate-200 bg-white dark:border-white/10 dark:bg-surface-800'
                }`}
              >
                <span className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleRemovalId(p.id)}
                    className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500/30 dark:border-surface-600"
                  />
                  <span className="text-sm font-medium text-slate-900 dark:text-neutral-100">{p.part_name}</span>
                </span>
                <span className="text-xs text-slate-500 dark:text-neutral-400">Qty {p.quantity_used}</span>
              </label>
            );
          })}
        </div>

        {removePartsError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{removePartsError}</p>}

        <button
          type="button"
          onClick={handleRemoveParts}
          disabled={removingParts || selectedRemovalIds.length === 0}
          className="mt-4 w-full rounded-lg bg-amber-600 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-amber-500 disabled:opacity-50 cursor-pointer"
        >
          {removingParts
            ? 'Removing…'
            : `Confirm Removal & Restock (${selectedRemovalIds.length})`}
        </button>
      </div>
    );
  }

  if (battery.status === 'in_repair') {
    return (
      <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 p-5 shadow-sm dark:border-white/10 dark:bg-surface-900">
        <h2 className="mb-1 text-sm font-semibold text-slate-900 dark:text-white">Ready to start?</h2>
        <p className="mb-4 text-sm text-slate-500 dark:text-neutral-400">
          This battery hasn't been touched yet. Starting work marks it as in progress.
        </p>
        {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="button"
          onClick={handleStartWork}
          disabled={submitting}
          className="w-full rounded-lg bg-emerald-600 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
        >
          {submitting ? 'Starting…' : 'Start Work'}
        </button>
      </div>
    );
  }

  if (battery.status === 'in_testing') {
    const workshopServices = (availableServices || []).filter((s) => !s.is_mandatory);
    const selectedServicesTotal = workshopServices
      .filter((s) => selectedServiceIds.includes(s.id))
      .reduce((sum, s) => sum + Number(s.rate || 0), 0);

    return (
      <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 p-5 shadow-sm dark:border-white/10 dark:bg-surface-900">
        <h2 className="mb-1 text-sm font-semibold text-slate-900 dark:text-white">
          {canTest ? 'Testing & Quality Assurance' : 'Testing In Progress'}
        </h2>
        <p className="mb-4 text-sm text-slate-500 dark:text-neutral-400">
          {canTest
            ? 'Verify battery diagnostics, select applicable testing services, then confirm completion.'
            : 'Parts have been changed. This battery is currently in the testing queue.'}
        </p>

        {canTest ? (
          <div className="space-y-4">
            {workshopServices.length > 0 && (
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300">
                  Select Completed Services & Diagnostics
                </label>
                <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-surface-800 max-h-56 overflow-y-auto">
                  {workshopServices.map((service) => {
                    const isChecked = selectedServiceIds.includes(service.id);
                    return (
                      <label
                        key={service.id}
                        className={`flex items-start gap-3 rounded-md p-2 cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-blue-50/80 dark:bg-blue-950/30'
                            : 'hover:bg-slate-50 dark:hover:bg-surface-700/50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleService(service.id)}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30 dark:border-surface-600"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-slate-900 dark:text-neutral-100">
                              {service.name}
                            </span>
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                              £{Number(service.rate || 0).toFixed(2)}
                            </span>
                          </div>
                          {service.description && (
                            <p className="text-xs text-slate-500 dark:text-neutral-400 line-clamp-1 mt-0.5">
                              {service.description}
                            </p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
                {selectedServiceIds.length > 0 && (
                  <div className="mt-2 flex items-center justify-between text-xs px-1">
                    <span className="text-slate-500 dark:text-neutral-400">
                      {selectedServiceIds.length} service{selectedServiceIds.length === 1 ? '' : 's'} selected
                    </span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      Total: £{selectedServicesTotal.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300">
                Testing Notes (Optional)
              </label>
              <input
                type="text"
                value={testingNotes}
                onChange={(e) => setTestingNotes(e.target.value)}
                placeholder="Enter any testing observations or diagnostic results..."
                className={inputClasses}
              />
            </div>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <button
              type="button"
              onClick={handleCompleteTesting}
              disabled={submitting}
              className="w-full rounded-lg bg-blue-600 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Completing…' : 'Complete Testing & Approve'}
            </button>

            {renderIssueReportSection(true)}
          </div>
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Testing Permission Required</p>
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
              Technicians do not have testing permissions. Only Supervisors and Managers can complete testing.
            </p>
          </div>
        )}
      </div>
    );
  }

  if (battery.status !== 'in_progress') {
    return null;
  }

  const selectedParts = partIds.map((id) => parts.find((p) => String(p.id) === id)).filter(Boolean);

  return (
    <form
      onSubmit={handleComplete}
      className="mb-6 rounded-xl border border-blue-100 bg-blue-50 p-5 shadow-sm dark:border-white/10 dark:bg-surface-900"
    >
      {!showIssueForm && (
        <>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Parts Changed</h2>
            <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-surface-800 dark:text-neutral-300">
              {selectedParts.length} part{selectedParts.length === 1 ? '' : 's'} selected
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {partIds.map((partId, index) => (
              <div
                key={index}
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-surface-800"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  {index + 1}
                </span>
                <select
                  value={partId}
                  onChange={(e) => updatePartRow(index, e.target.value)}
                  className={`${inputClasses} flex-1`}
                  required
                >
                  <option value="" disabled>
                    Select part
                  </option>
                  {parts.map((p) => (
                    <option key={p.id} value={p.id} disabled={p.quantity <= 0}>
                      {p.name} ({p.quantity} in stock)
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removePartRow(index)}
                  disabled={partIds.length === 1}
                  aria-label="Remove part"
                  className="shrink-0 rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-red-950/30 dark:hover:text-red-400 cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.36-9.36a.75.75 0 0 0-1.06-1.06L10 9.94 7.7 7.64a.75.75 0 0 0-1.06 1.06L8.94 11l-2.3 2.3a.75.75 0 1 0 1.06 1.06L10 12.06l2.3 2.3a.75.75 0 0 0 1.06-1.06L11.06 11l2.3-2.3Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {partIds[partIds.length - 1] && (
            <button
              type="button"
              onClick={addPartRow}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-slate-300 py-3 text-sm font-medium text-slate-500 hover:border-emerald-500/50 hover:bg-emerald-500/5 hover:text-emerald-700 dark:border-white/20 dark:text-neutral-300 dark:hover:border-emerald-500/50 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-400 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
              </svg>
              Add Another Part
            </button>
          )}

          <div className="mt-4">
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes (optional)"
              className={inputClasses}
            />
          </div>

          {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-4 w-full rounded-lg bg-emerald-600 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
          >
            {submitting ? 'Submitting…' : 'Submit for Testing'}
          </button>
        </>
      )}

      {renderIssueReportSection()}
    </form>
  );
}

export default TechnicianRepairPanel;
