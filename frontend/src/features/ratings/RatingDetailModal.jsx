import { FiStar, FiCheck, FiX, FiCalendar, FiUser, FiPackage, FiTruck, FiExternalLink, FiClock, FiShield, FiTag } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import Modal from '../../components/ui/overlays/Modal';
import { getLogoUrl } from '../../utils/logo-url';
import { StatusBadge } from '../../components/ui/primitives/Badge';

const RATING_SENTIMENT = {
  5: { title: '5.0 · Excellent Service', tone: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30' },
  4: { title: '4.0 · Very Good Quality', tone: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
  3: { title: '3.0 · Satisfactory', tone: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30' },
  2: { title: '2.0 · Fair / Needs Attention', tone: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30' },
  1: { title: '1.0 · Unsatisfactory', tone: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30' },
};

function RatingDetailModal({ ratingItem, onClose }) {
  if (!ratingItem) return null;

  const logo = getLogoUrl(ratingItem.client_logo_path);
  const tags = Array.isArray(ratingItem.preset_tags)
    ? ratingItem.preset_tags
    : typeof ratingItem.preset_tags === 'string'
    ? JSON.parse(ratingItem.preset_tags || '[]')
    : [];

  const sentiment = RATING_SENTIMENT[ratingItem.rating] || RATING_SENTIMENT[5];
  const dateFormatted = ratingItem.created_at
    ? new Date(ratingItem.created_at).toLocaleDateString('en-GB', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  return (
    <Modal
      title="Client Rating & Service Feedback Details"
      description={`Submission ID #${ratingItem.id} · Recorded on ${dateFormatted}`}
      size="2xl"
      onClose={onClose}
    >
      <div className="space-y-5 py-1">
        {/* ── Client & Score Hero Card ──────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4.5 dark:border-white/10 dark:bg-surface-850">
          <div className="flex items-center gap-3.5 min-w-0">
            {logo ? (
              <img
                src={logo}
                alt={ratingItem.client_name || 'Client'}
                className="h-12 w-12 rounded-2xl object-contain bg-white border border-slate-200 p-1 dark:bg-surface-800 dark:border-white/10 shrink-0 shadow-xs"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white font-extrabold text-base shrink-0 shadow-xs">
                {(ratingItem.client_name || 'C')[0]}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                  {ratingItem.client_name || 'Client Review'}
                </span>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
                  Verified Client
                </span>
              </div>
              <span className="text-xs text-slate-500 dark:text-neutral-400 block mt-0.5">
                Submitted by: {ratingItem.user_name || ratingItem.user_email || 'Portal User'}
              </span>
            </div>
          </div>

          {/* Star Rating Badge */}
          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1.5 shrink-0 bg-white sm:bg-transparent p-3 sm:p-0 rounded-xl border sm:border-0 border-slate-200 dark:border-white/10 dark:bg-surface-900 sm:dark:bg-transparent">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <FiStar
                  key={s}
                  className={`w-5 h-5 ${
                    s <= ratingItem.rating
                      ? 'fill-amber-400 text-amber-400 filter drop-shadow-xs'
                      : 'text-slate-200 dark:text-neutral-700'
                  }`}
                />
              ))}
            </div>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${sentiment.tone}`}>
              {sentiment.title}
            </span>
          </div>
        </div>

        {/* ── Battery Information Card ──────────────────────────────────── */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4.5 dark:border-white/10 dark:bg-surface-850 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-base">🔋</span>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
                Associated Battery Unit
              </span>
            </div>
            {ratingItem.battery_code && (
              <Link
                to={`/batteries/${encodeURIComponent(ratingItem.battery_code)}`}
                onClick={onClose}
                className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                <span>Inspect Battery Page</span>
                <FiExternalLink className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-3.5">
            <div>
              <span className="text-[10.5px] uppercase font-bold text-slate-400 dark:text-neutral-500 block">
                Battery Code
              </span>
              <span className="font-mono text-xs font-extrabold text-blue-700 dark:text-blue-400 mt-0.5 block">
                {ratingItem.battery_code || '—'}
              </span>
            </div>

            <div>
              <span className="text-[10.5px] uppercase font-bold text-slate-400 dark:text-neutral-500 block">
                Model / Brand
              </span>
              <span className="text-xs font-semibold text-slate-800 dark:text-neutral-200 mt-0.5 block truncate">
                {ratingItem.battery_model_name || ratingItem.battery_brand || 'Standard Fleet Unit'}
              </span>
            </div>

            <div>
              <span className="text-[10.5px] uppercase font-bold text-slate-400 dark:text-neutral-500 block">
                Serial Number
              </span>
              <span className="font-mono text-xs font-medium text-slate-700 dark:text-neutral-300 mt-0.5 block truncate">
                {ratingItem.battery_serial_number || 'None assigned'}
              </span>
            </div>

            <div>
              <span className="text-[10.5px] uppercase font-bold text-slate-400 dark:text-neutral-500 block">
                Dispatch Return ID
              </span>
              <span className="font-mono text-xs font-medium text-slate-700 dark:text-neutral-300 mt-0.5 block">
                {ratingItem.return_id ? `#RET-${ratingItem.return_id}` : 'Direct Service'}
              </span>
            </div>
          </div>
        </div>

        {/* ── Selected Quick Feedback Tags ──────────────────────────────── */}
        {tags.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400 block">
              Client Selected Tags ({tags.length})
            </span>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag, idx) => (
                <div
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/40"
                >
                  <FiCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 stroke-[3]" />
                  <span>{tag}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Written Feedback Note ─────────────────────────────────────── */}
        <div className="space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400 block">
            Written Client Comments & Observations
          </span>
          {ratingItem.custom_feedback ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-xs sm:text-sm text-slate-800 dark:border-white/10 dark:bg-surface-900 dark:text-neutral-200 leading-relaxed font-sans italic">
              "{ratingItem.custom_feedback}"
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 p-4 text-xs text-slate-400 dark:border-white/5 dark:bg-surface-900/50">
              No written notes were attached to this review rating.
            </div>
          )}
        </div>

        {/* ── Modal Footer ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-white/10">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-neutral-500">
            <FiClock className="w-3.5 h-3.5" />
            <span>Logged {dateFormatted}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-100 px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-surface-800 dark:text-neutral-200 dark:hover:bg-white/10 cursor-pointer transition-colors"
          >
            Close Details
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default RatingDetailModal;
