import Sparkline from '../charts/Sparkline';

const TONES = {
  info: { bg: 'bg-info-100 dark:bg-sky-500/10', text: 'text-info-700 dark:text-sky-300', accent: '#2a78d6' },
  warning: {
    bg: 'bg-warning-100 dark:bg-amber-500/10',
    text: 'text-warning-700 dark:text-amber-300',
    accent: '#c98500',
  },
  good: { bg: 'bg-brand-100 dark:bg-emerald-500/10', text: 'text-brand-800 dark:text-emerald-300', accent: '#16a34a' },
  critical: {
    bg: 'bg-critical-100 dark:bg-red-500/10',
    text: 'text-critical-700 dark:text-red-300',
    accent: '#b52f2f',
  },
  neutral: {
    bg: 'bg-slate-100 dark:bg-surface-800',
    text: 'text-slate-800 dark:text-neutral-200',
    accent: '#64748b',
  },
};

// Stat tile contract: label, value, optional signed delta (color = direction x
// whether up is good), optional 7-point sparkline. See dataviz skill's
// marks-and-anatomy.md "Figures" section.
function StatCard({ label, value, delta, deltaGoodDirection = 'up', trend, tone = 'info', icon }) {
  const { bg, text, accent } = TONES[tone] || TONES.info;
  const hasDelta = typeof delta === 'number';
  const isUp = delta > 0;
  const isGood = hasDelta && (deltaGoodDirection === 'up' ? isUp : !isUp);

  return (
    <div className={`h-full rounded-xl ${bg} p-4`}>
      <div className="mb-1 flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-neutral-300">
        {icon && <span aria-hidden="true">{icon}</span>}
        {label}
      </div>
      <div className={`text-3xl font-semibold ${text}`}>{value}</div>

      {hasDelta && (
        <div
          className={`mt-1 text-xs font-medium ${
            isGood ? 'text-brand-700 dark:text-emerald-400' : 'text-critical-700 dark:text-red-400'
          }`}
        >
          {isUp ? '↗' : '↘'} {Math.abs(delta)}% from last month
        </div>
      )}

      {trend && (
        <div className="mt-2">
          <Sparkline values={trend} color={accent} />
        </div>
      )}
    </div>
  );
}

export default StatCard;
