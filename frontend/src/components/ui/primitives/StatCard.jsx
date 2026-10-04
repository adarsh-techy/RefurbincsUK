import Sparkline from '../charts/Sparkline';

const TONES = {
  info: {
    bg: 'bg-sky-50/75 border-sky-200/70 dark:bg-sky-950/20 dark:border-sky-800/40',
    text: 'text-sky-700 dark:text-sky-300',
    accent: '#0284c7',
  },
  warning: {
    bg: 'bg-amber-50/75 border-amber-200/70 dark:bg-amber-950/20 dark:border-amber-800/40',
    text: 'text-amber-800 dark:text-amber-300',
    accent: '#d97706',
  },
  good: {
    bg: 'bg-emerald-50/75 border-emerald-200/70 dark:bg-emerald-950/20 dark:border-emerald-800/40',
    text: 'text-emerald-800 dark:text-emerald-300',
    accent: '#059669',
  },
  critical: {
    bg: 'bg-rose-50/75 border-rose-200/70 dark:bg-rose-950/20 dark:border-rose-800/40',
    text: 'text-rose-700 dark:text-rose-300',
    accent: '#e11d48',
  },
  neutral: {
    bg: 'bg-slate-50/80 border-slate-200/80 dark:bg-surface-800 dark:border-white/10',
    text: 'text-slate-800 dark:text-neutral-200',
    accent: '#64748b',
  },
  purple: {
    bg: 'bg-purple-50/75 border-purple-200/70 dark:bg-purple-950/20 dark:border-purple-800/40',
    text: 'text-purple-800 dark:text-purple-300',
    accent: '#9333ea',
  },
};

// Stat tile contract: label, value, optional signed delta (color = direction x
// whether up is good), optional 7-point sparkline. See dataviz skill's
// marks-and-anatomy.md "Figures" section.
function StatCard({ label, value, delta, deltaGoodDirection = 'up', trend, tone = 'info', icon, sub }) {
  const { bg, text, accent } = TONES[tone] || TONES.info;
  const hasDelta = typeof delta === 'number';
  const isUp = delta > 0;
  const isGood = hasDelta && (deltaGoodDirection === 'up' ? isUp : !isUp);

  return (
    <div className={`h-full rounded-2xl ${bg} p-3 sm:p-3.5 flex flex-col justify-between transition-all border shadow-2xs`}>
      <div>
        <div className="mb-1 flex items-center justify-between gap-1 text-[9.5px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-neutral-300">
          <span className="flex items-center gap-1.5 truncate">
            {icon && <span aria-hidden="true" className="shrink-0">{icon}</span>}
            <span className="truncate">{label}</span>
          </span>
        </div>
        <div className={`text-lg sm:text-xl font-black tracking-tight leading-tight ${text}`}>{value}</div>
      </div>

      {sub && (
        <div className="mt-1 text-[9.5px] sm:text-[10px] font-medium text-slate-500 dark:text-neutral-400 leading-tight truncate" title={sub}>
          {sub}
        </div>
      )}

      {hasDelta && (
        <div
          className={`mt-1 text-[10px] font-medium ${
            isGood ? 'text-brand-700 dark:text-emerald-400' : 'text-critical-700 dark:text-red-400'
          }`}
        >
          {isUp ? '↗' : '↘'} {Math.abs(delta)}% from last month
        </div>
      )}

      {trend && (
        <div className="mt-1.5">
          <Sparkline values={trend} color={accent} />
        </div>
      )}
    </div>
  );
}

export default StatCard;
