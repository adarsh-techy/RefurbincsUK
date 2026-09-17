import { useState } from 'react';
import { FiStar, FiCheck, FiSend, FiAward, FiBatteryCharging, FiShield, FiTruck, FiTool } from 'react-icons/fi';
import Modal from '../ui/overlays/Modal';
import apiClient from '../../services/api-client';

const PRESET_FEEDBACK_OPTIONS = [
  '⚡ Fast & On-Time Turnaround',
  '🔋 Battery Health & Range Fully Restored',
  '🔧 Technical Fault Completely Resolved',
  '📦 Secure & High-Quality Workshop Packaging',
  '🚚 Smooth Delivery & Return Dispatch',
  '✨ Exceptional Refurbishment Workmanship',
  '💬 Transparent & Prompt Communication',
  '🛡️ Comprehensive Safety & BMS Calibration',
  '📊 Accurate Testing & Diagnostic Accuracy',
  '🌱 High Environmental & Eco-Impact Standards',
];

const RATING_LABELS = {
  5: { title: '5 / 5 · Excellent Service & Quality!', color: 'text-amber-500 dark:text-amber-400 bg-amber-500/10 border-amber-500/20' },
  4: { title: '4 / 5 · Very Good Experience', color: 'text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  3: { title: '3 / 5 · Satisfactory / Standard', color: 'text-blue-500 dark:text-blue-400 bg-blue-500/10 border-blue-500/20' },
  2: { title: '2 / 5 · Fair / Needs Improvement', color: 'text-orange-500 dark:text-orange-400 bg-orange-500/10 border-orange-500/20' },
  1: { title: '1 / 5 · Unsatisfactory Experience', color: 'text-rose-500 dark:text-rose-400 bg-rose-500/10 border-rose-500/20' },
};

function RatingModal({ batteryCode, batteryCodes = [], truckNumber, driverName, returnId, clientId, onClose, onSuccess }) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState([
    '🔋 Battery Health & Range Fully Restored',
    '⚡ Fast & On-Time Turnaround',
  ]);
  const [customFeedback, setCustomFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const allCodes = Array.from(
    new Set(
      [
        ...(Array.isArray(batteryCodes) ? batteryCodes : []),
        ...(batteryCode ? [batteryCode] : []),
      ].filter(Boolean)
    )
  );

  function toggleTag(tag) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  async function handleSubmit(e) {
    if (e) e.preventDefault();
    if (!rating) return;

    setSubmitting(true);
    try {
      if (allCodes.length > 0) {
        for (const code of allCodes) {
          await apiClient.post('/ratings', {
            batteryCode: code,
            returnId,
            clientId,
            rating,
            presetTags: selectedTags,
            customFeedback,
          });
        }
      } else {
        await apiClient.post('/ratings', {
          returnId,
          clientId,
          rating,
          presetTags: selectedTags,
          customFeedback,
        });
      }
      setSubmitted(true);
      setTimeout(() => {
        if (onSuccess) onSuccess();
        if (onClose) onClose();
      }, 1500);
    } catch (err) {
      console.error('Failed to submit rating:', err);
    } finally {
      setSubmitting(false);
    }
  }

  const activeScore = hoverRating || rating;
  const ratingInfo = RATING_LABELS[activeScore] || RATING_LABELS[5];

  return (
    <Modal
      title={
        truckNumber
          ? `Rate Delivery — Truck ${truckNumber}`
          : allCodes.length > 1
          ? `Rate Batch (${allCodes.length} Batteries)`
          : 'Battery Service Rating & Feedback'
      }
      description={
        allCodes.length > 1
          ? `Review and rate your received delivery containing ${allCodes.length} refurbished batteries.`
          : 'Help our engineering team continually optimize battery longevity, safety, and turnaround.'
      }
      size="xl"
      onClose={onClose}
    >
      {submitted ? (
        <div className="py-12 text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 shadow-sm dark:bg-emerald-950/60 dark:text-emerald-400">
            <FiCheck className="h-8 w-8 stroke-[2.5]" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
              Thank You for Your Review!
            </h3>
            <p className="text-xs text-slate-500 dark:text-neutral-400 max-w-sm mx-auto leading-relaxed">
              Your feedback has been logged directly with our workshop operations team for all{' '}
              {allCodes.length > 0 ? `${allCodes.length} batteries` : 'units'} in this shipment.
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5 py-1">
          {/* Truck / Batch Reference Banner */}
          {truckNumber || allCodes.length > 0 ? (
            <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200/80 dark:bg-surface-850 dark:border-white/10 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                    <FiTruck className="w-4 h-4" />
                  </span>
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {truckNumber ? `Truck ${truckNumber}` : 'Return Shipment'}
                    </span>
                    {driverName && (
                      <span className="text-xs text-slate-500 dark:text-neutral-400 ml-1.5">
                        · Driver: {driverName}
                      </span>
                    )}
                  </div>
                </div>
                <span className="rounded-full bg-blue-100 px-3 py-0.5 text-xs font-bold text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                  {allCodes.length} {allCodes.length === 1 ? 'Battery' : 'Batteries'} Received
                </span>
              </div>

              {allCodes.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1 max-h-24 overflow-y-auto">
                  {allCodes.map((code) => (
                    <span
                      key={code}
                      className="font-mono text-[11px] font-bold text-blue-700 dark:text-blue-400 bg-white dark:bg-surface-900 px-2.5 py-0.5 rounded-md border border-blue-200/60 dark:border-blue-800/40"
                    >
                      {code}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {/* Star Rating Interactive Bar */}
          <div className="text-center py-4 px-3 bg-slate-50/70 rounded-2xl border border-slate-200/60 dark:bg-surface-850/60 dark:border-white/5">
            <span className="text-[11px] font-bold text-slate-400 dark:text-neutral-400 uppercase tracking-wider block mb-2.5">
              Select Your Rating
            </span>

            <div className="flex items-center justify-center gap-3">
              {[1, 2, 3, 4, 5].map((star) => {
                const filled = star <= (hoverRating || rating);
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1.5 transition-all hover:scale-125 active:scale-95 focus:outline-hidden cursor-pointer"
                    title={`${star} Star${star > 1 ? 's' : ''}`}
                  >
                    <FiStar
                      className={`w-9 h-9 sm:w-10 sm:h-10 transition-colors ${
                        filled
                          ? 'text-amber-400 fill-amber-400 filter drop-shadow-md'
                          : 'text-slate-300 dark:text-neutral-600'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex justify-center">
              <span className={`inline-flex items-center px-3.5 py-1 rounded-full text-xs font-bold border ${ratingInfo.color}`}>
                {ratingInfo.title}
              </span>
            </div>
          </div>

          {/* Quick Preset Feedback Chips */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-neutral-300 uppercase tracking-wider block">
                Quick Service Tags (Select all that apply)
              </span>
              <span className="text-[11px] font-medium text-slate-400 dark:text-neutral-400">
                {selectedTags.length} selected
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {PRESET_FEEDBACK_OPTIONS.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-500/30 dark:bg-blue-500'
                        : 'bg-slate-100/90 text-slate-700 hover:bg-slate-200 dark:bg-surface-800 dark:text-neutral-200 dark:hover:bg-white/10 border border-slate-200/80 dark:border-white/5'
                    }`}
                  >
                    {isSelected ? (
                      <FiCheck className="w-3.5 h-3.5 shrink-0 text-white stroke-[3]" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-neutral-500 shrink-0" />
                    )}
                    <span>{tag}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Feedback Text Area */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-neutral-300 uppercase tracking-wider block">
              Additional Notes, Feedback, or Special Requests (Optional)
            </label>
            <textarea
              rows={4}
              value={customFeedback}
              onChange={(e) => setCustomFeedback(e.target.value)}
              placeholder="Share any specific details about the battery performance, fleet deployment status, packaging, or communication..."
              className="w-full rounded-2xl border border-slate-300 bg-slate-50/70 p-3.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 dark:border-surface-700 dark:bg-surface-800 dark:text-neutral-100 leading-relaxed"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:text-neutral-400 dark:hover:bg-white/5 cursor-pointer transition-colors"
            >
              Skip / Dismiss
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md shadow-blue-600/30 hover:bg-blue-700 active:scale-95 disabled:opacity-50 cursor-pointer transition-all"
            >
              <FiSend className="w-3.5 h-3.5" />
              <span>{submitting ? 'Submitting…' : 'Submit Feedback'}</span>
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export default RatingModal;
