const STYLES = {
  muted:
    'border-dashed border-slate-200 bg-white text-slate-500 dark:border-surface-700 dark:bg-surface-900 dark:text-neutral-500',
  error:
    'border-critical-100 bg-critical-50 text-critical-700 dark:border-red-900/50 dark:bg-red-500/10 dark:text-red-300',
};

// Placeholder shown where a DataTable will render, while loading or on
// error — keeps the same visual footprint as DataTable's own empty state.
function TableState({ tone = 'muted', children }) {
  return (
    <div className={`flex items-center justify-center rounded-xl border py-14 text-sm ${STYLES[tone]}`}>
      {children}
    </div>
  );
}

export default TableState;
