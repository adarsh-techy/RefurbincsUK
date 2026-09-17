import { useEffect } from 'react';

const SIZES = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
  '7xl': 'max-w-7xl',
  full: 'max-w-[95vw]',
};

// Centered overlay dialog. Closes on Escape or backdrop click.
// size: 'md' (default) through '4xl', for forms that need more room.
function Modal({ title, description, onClose, size = 'md', className = '', children }) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 touch-scroll"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[92dvh] max-h-[92vh] w-full flex-col rounded-2xl border-[0.25px] border-blue-200 bg-white shadow-2xl dark:border-blue-700 dark:bg-surface-900 ${SIZES[size] || SIZES.md} ${className}`}
      >
        <div className="flex shrink-0 items-start justify-between border-b border-slate-100 px-4 py-3 sm:px-6 sm:py-4 dark:border-surface-700">
          <div className="min-w-0 pr-2">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-neutral-100 truncate">{title}</h2>
            {description && (
              <p className="mt-0.5 text-xs sm:text-sm text-slate-500 dark:text-neutral-400 line-clamp-2">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-neutral-500 dark:hover:bg-surface-800 dark:hover:text-neutral-300 transition-colors"
          >
            ✕
          </button>
        </div>
        <div className="no-scrollbar overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">{children}</div>
      </div>
    </div>
  );
}

export default Modal;
