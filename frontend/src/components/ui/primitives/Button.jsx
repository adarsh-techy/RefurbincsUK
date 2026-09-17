const VARIANTS = {
  primary: 'bg-brand-600 text-white shadow-sm hover:bg-brand-700 dark:bg-emerald-600 dark:hover:bg-emerald-500',
  blue: 'bg-blue-600 text-white shadow-sm hover:bg-blue-700',
  lightBlue: 'bg-blue-400 text-white shadow-sm hover:bg-blue-500 dark:bg-blue-500 dark:hover:bg-blue-400',
  darkViolet: 'bg-violet-900 text-white shadow-sm hover:bg-violet-800',
  secondary:
    'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-200 dark:hover:bg-surface-700',
  ghost: 'text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-surface-800',
  danger: 'text-critical-600 hover:bg-critical-50 dark:text-red-400 dark:hover:bg-red-500/10',
};

// Shared button styling so every page/form/modal renders the same primary,
// secondary, danger, and ghost actions instead of each hand-rolling its own.
function Button({ variant = 'primary', className = '', ...props }) {
  return (
    <button
      className={`rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

export default Button;
