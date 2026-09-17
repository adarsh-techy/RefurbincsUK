import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  FiArrowLeft,
  FiStar,
  FiCheck,
  FiCalendar,
  FiUser,
  FiMail,
  FiExternalLink,
  FiClock,
  FiTool,
  FiMessageSquare,
  FiAward,
} from 'react-icons/fi';
import apiClient from '../../services/api-client';
import TableState from '../../components/ui/table/TableState';
import PageHeader from '../../components/ui/primitives/PageHeader';
import { StatusBadge } from '../../components/ui/primitives/Badge';
import { getLogoUrl } from '../../utils/logo-url';

const RATING_SENTIMENT = {
  5: {
    title: '5.0 · Excellent Quality & Service',
    badge: 'bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400',
    description: 'Outstanding performance, seamless turnaround, and certified quality satisfaction.',
  },
  4: {
    title: '4.0 · Very Good Quality',
    badge: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-400',
    description: 'High-standard refurbishment meeting client expectations.',
  },
  3: {
    title: '3.0 · Satisfactory / Average',
    badge: 'bg-blue-500/15 text-blue-600 border-blue-500/30 dark:text-blue-400',
    description: 'Acceptable service delivery with standard turnaround.',
  },
  2: {
    title: '2.0 · Fair / Needs Attention',
    badge: 'bg-orange-500/15 text-orange-600 border-orange-500/30 dark:text-orange-400',
    description: 'Client experienced minor issues or delays requiring review.',
  },
  1: {
    title: '1.0 · Unsatisfactory / Critical',
    badge: 'bg-rose-500/15 text-rose-600 border-rose-500/30 dark:text-rose-400',
    description: 'Reported service or quality defect requiring investigation.',
  },
};

function RatingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [ratingItem, setRatingItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiClient
      .get(`/ratings/${id}`)
      .then((res) => setRatingItem(res.data))
      .catch((err) => setError(err.response?.data?.message || err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <TableState>Loading client rating & review statement…</TableState>;

  if (error || !ratingItem) {
    return (
      <div className="space-y-4">
        <Link
          to="/ratings"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline dark:text-blue-400"
        >
          <FiArrowLeft className="w-3.5 h-3.5" /> Back to Ratings & Feedback
        </Link>
        <TableState tone="error">{error || 'Rating record not found.'}</TableState>
      </div>
    );
  }

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

  const batteryCode = ratingItem.battery_code || ratingItem.resolved_battery_code;

  return (
    <div className="space-y-6 pb-12">
      {/* Breadcrumb Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/ratings"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
        >
          <FiArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Ratings & Feedback</span>
        </Link>

        <span className="text-xs text-slate-400 dark:text-neutral-500 font-mono">
          Feedback ID #{ratingItem.id}
        </span>
      </div>

      {/* Hero Review Banner */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 md:p-6 shadow-sm dark:border-white/10 dark:bg-surface-850">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Client & Submitter Info */}
          <div className="flex items-start md:items-center gap-4">
            {logo ? (
              <img
                src={logo}
                alt={ratingItem.client_name || 'Client'}
                className="h-16 w-16 rounded-2xl object-contain bg-white border border-slate-200 p-1.5 dark:bg-surface-800 dark:border-white/10 shrink-0 shadow-xs"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-blue-600 to-indigo-700 text-white font-black text-2xl shrink-0 shadow-xs">
                {(ratingItem.client_name || 'C')[0]?.toUpperCase()}
              </div>
            )}

            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  {ratingItem.client_name || 'Client Review'}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
                  <FiAward className="w-3.5 h-3.5" />
                  <span>Verified Service Rating</span>
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 dark:text-neutral-400">
                <span className="inline-flex items-center gap-1.5">
                  <FiUser className="w-3.5 h-3.5 text-slate-400" />
                  <span>Submitted by: <strong className="text-slate-700 dark:text-neutral-200">{ratingItem.user_name || ratingItem.user_email || 'Portal User'}</strong></span>
                </span>
                <span className="inline-flex items-center gap-1.5 font-mono">
                  <FiClock className="w-3.5 h-3.5 text-slate-400" />
                  <span>{dateFormatted}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Star Rating Score & Sentiment */}
          <div className="flex flex-col sm:items-end justify-center gap-2 p-4 rounded-xl bg-slate-50/90 dark:bg-surface-900/60 border border-slate-100 dark:border-white/5">
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <FiStar
                  key={s}
                  className={`w-6 h-6 ${
                    s <= ratingItem.rating
                      ? 'fill-amber-400 text-amber-400 filter drop-shadow-xs'
                      : 'text-slate-200 dark:text-neutral-700'
                  }`}
                />
              ))}
              <span className="ml-1 text-lg font-black text-slate-900 dark:text-white">
                {ratingItem.rating}.0
              </span>
            </div>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${sentiment.badge}`}>
              {sentiment.title}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Grid: Battery Details & Client Profile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 1. Associated Battery Card */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-surface-850 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 dark:border-white/5">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔋</span>
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
                Associated Battery Unit
              </h2>
            </div>
            {batteryCode && (
              <Link
                to={`/batteries/${encodeURIComponent(batteryCode)}`}
                className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                <span>Inspect Battery Profile</span>
                <FiExternalLink className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3.5 text-xs">
            <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100 dark:bg-surface-900/60 dark:border-white/5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Battery Code
              </span>
              <span className="font-mono font-black text-blue-700 dark:text-blue-400 text-sm mt-0.5 block">
                {batteryCode || '—'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100 dark:bg-surface-900/60 dark:border-white/5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Current Status
              </span>
              <div className="mt-1">
                <StatusBadge status={ratingItem.battery_current_status} />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100 dark:bg-surface-900/60 dark:border-white/5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Serial Number
              </span>
              <span className="font-mono font-bold text-slate-800 dark:text-neutral-200 text-xs mt-1 block">
                {ratingItem.battery_serial_number || 'None assigned'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100 dark:bg-surface-900/60 dark:border-white/5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Return Dispatch ID
              </span>
              <div className="mt-1">
                {ratingItem.return_id ? (
                  <Link
                    to={`/returns/${ratingItem.return_id}`}
                    className="font-mono font-bold text-blue-600 hover:underline dark:text-blue-400"
                  >
                    #RET-{ratingItem.return_id}
                  </Link>
                ) : (
                  <span className="text-slate-500 dark:text-neutral-400">Direct Delivery</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 2. Client Profile Card */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-surface-850 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 dark:border-white/5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                <FiUser className="w-4 h-4" />
              </div>
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
                Client Organization & Contact
              </h2>
            </div>
            {ratingItem.client_id && (
              <Link
                to={`/clients/${ratingItem.client_id}`}
                className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                <span>View Client Dashboard</span>
                <FiExternalLink className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100 dark:bg-surface-900/60 dark:border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FiUser className="w-4 h-4 text-slate-400" />
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Submitted By</span>
                  <span className="font-semibold text-slate-800 dark:text-neutral-200">{ratingItem.user_name || 'Portal User'}</span>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100 dark:bg-surface-900/60 dark:border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FiMail className="w-4 h-4 text-slate-400" />
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">User Account Email</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-neutral-200">{ratingItem.user_email || '—'}</span>
                </div>
              </div>
            </div>

            {ratingItem.client_invoice_email && (
              <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100 dark:bg-surface-900/60 dark:border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <FiMail className="w-4 h-4 text-blue-500" />
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Billing / Invoice Email</span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-neutral-200">{ratingItem.client_invoice_email}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Selected Feedback Tags & Written Commentary */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-surface-850 space-y-4">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3.5 dark:border-white/5">
          <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
            <FiMessageSquare className="w-4 h-4" />
          </div>
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
            Client Review Details & Feedback Highlights
          </h2>
        </div>

        {/* Selected Preset Tags */}
        {tags.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500 block">
              Selected Service Highlights ({tags.length})
            </span>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag, idx) => (
                <div
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/40"
                >
                  <FiCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 stroke-[3]" />
                  <span>{tag}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Written Review Text */}
        <div className="space-y-2 pt-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500 block">
            Written Client Comments
          </span>
          {ratingItem.custom_feedback ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 text-sm text-slate-800 dark:border-white/10 dark:bg-surface-900 dark:text-neutral-200 leading-relaxed italic relative">
              <span className="text-3xl text-slate-300 dark:text-neutral-600 absolute top-2 left-3 font-serif">“</span>
              <p className="relative z-10 pl-4">{ratingItem.custom_feedback}</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 p-4 text-xs text-slate-400 dark:border-white/5 dark:bg-surface-900/50">
              No written comments were attached to this rating.
            </div>
          )}
        </div>
      </div>

      {/* Battery Refurbishment History on File (If Any) */}
      {ratingItem.recent_repairs && ratingItem.recent_repairs.length > 0 && (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-surface-850 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 dark:border-white/5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                <FiTool className="w-4 h-4" />
              </div>
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
                Prior Refurbishment Services on this Battery ({ratingItem.recent_repairs.length})
              </h2>
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
            {ratingItem.recent_repairs.map((r, rIdx) => (
              <div key={r.batch_id || r.id || rIdx} className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block">
                    Parts Changed: <span className="text-emerald-600 dark:text-emerald-400">{r.part_name || 'Standard Refurbishment'}</span>
                  </span>
                  <span className="text-[11px] text-slate-400 dark:text-neutral-500">
                    Repaired by {r.staff_name || 'Technician'} · {r.notes ? `Note: ${r.notes}` : ''}
                  </span>
                </div>

                <span className="font-mono text-xs text-slate-500 dark:text-neutral-400 shrink-0">
                  {new Date(r.repaired_at).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default RatingDetailPage;
