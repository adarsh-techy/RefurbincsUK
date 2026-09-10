import { useState } from 'react';
import { FiStar, FiCheck, FiSend, FiX } from 'react-icons/fi';
import Modal from '../ui/Modal';
import apiClient from '../../services/api-client';

const PRESET_FEEDBACK_OPTIONS = [
  '⚡ Fast Turnaround',
  '🔋 Battery Health Restored',
  '📦 Excellent Packaging',
  '🚚 Prompt Delivery',
  '✨ Professional Workmanship',
  '💬 Great Communication',
  '🔧 Fault Completely Resolved',
  '🌱 Great Eco Impact',
];

const RATING_LABELS = {
  5: { title: 'Excellent!', color: 'text-amber-500 dark:text-amber-400' },
  4: { title: 'Very Good', color: 'text-emerald-500 dark:text-emerald-400' },
  3: { title: 'Good / Satisfactory', color: 'text-blue-500 dark:text-blue-400' },
  2: { title: 'Fair / Needs Improvement', color: 'text-orange-500 dark:text-orange-400' },
  1: { title: 'Poor Experience', color: 'text-rose-500 dark:text-rose-400' },
};

function RatingModal({ batteryCode, returnId, clientId, onClose, onSuccess }) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState(['🔋 Battery Health Restored', '⚡ Fast Turnaround']);
  const [customFeedback, setCustomFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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
      await apiClient.post('/ratings', {
        batteryCode,
        returnId,
        clientId,
        rating,
        presetTags: selectedTags,
        customFeedback,
      });
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
      title="Battery Service Rating & Feedback"
      description="Help us maintain exceptional service quality for your battery fleet."
      size="md"
      onClose={onClose}
    >
      {submitted ? (
        <div className="py-8 text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
            <FiCheck className="h-7 w-7 stroke-[2.5]" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Thank You for Your Feedback!
          </h3>
          <p className="text-xs text-slate-500 dark:text-neutral-400 max-w-xs mx-auto">
            Your review helps our engineering team continually optimize battery longevity and service turnaround.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Battery Reference Banner */}
          {batteryCode && (
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2 text-xs border border-slate-200/70 dark:bg-surface-850 dark:border-white/10">
              <span className="text-slate-500 dark:text-neutral-400">Battery Received:</span>
              <span className="font-mono font-black text-slate-900 dark:text-white tracking-wide">
                {batteryCode}
              </span>
            </div>
          )}

          {/* Star Rating Interactive Bar */}
          <div className="text-center py-2 bg-slate-50/50 rounded-2xl border border-slate-100 dark:bg-surface-850/50 dark:border-white/5">
            <span className="text-xs font-semibold text-slate-400 dark:text-neutral-400 uppercase tracking-wider block mb-2">
              Rate Service Quality
            </span>

            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => {
                const filled = star <= (hoverRating || rating);
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1 transition-transform hover:scale-125 focus:outline-hidden"
                    title={`${star} Star${star > 1 ? 's' : ''}`}
                  >
                    <FiStar
                      className={`w-7 h-7 transition-colors ${
                        filled
                          ? 'text-amber-400 fill-amber-400 filter drop-shadow-xs'
                          : 'text-slate-300 dark:text-neutral-600'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            <div className={`mt-2 text-xs font-bold ${ratingInfo.color}`}>
              {ratingInfo.title}
            </div>
          </div>

          {/* Quick Preset Feedback Chips */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider block">
              Quick Tags (Click to select)
            </span>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_FEEDBACK_OPTIONS.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-xs dark:bg-blue-500'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-surface-800 dark:text-neutral-300 dark:hover:bg-white/10 border border-slate-200/50 dark:border-white/5'
                    }`}
                  >
                    {isSelected && <FiCheck className="w-3 h-3 shrink-0" />}
                    <span>{tag}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Feedback Text Area */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider block">
              Additional Notes or Comments (Optional)
            </label>
            <textarea
              rows={2}
              value={customFeedback}
              onChange={(e) => setCustomFeedback(e.target.value)}
              placeholder="e.g. Battery tested 100% on vehicle startup, ready for deployment..."
              className="w-full rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 dark:border-surface-700 dark:bg-surface-800 dark:text-neutral-100"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between gap-2.5 pt-2 border-t border-slate-100 dark:border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-3.5 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:text-neutral-400 dark:hover:bg-white/5"
            >
              Skip / Later
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
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
