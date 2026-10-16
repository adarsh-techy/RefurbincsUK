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

// Overlay dialog. Closes on Escape or backdrop click.
// size: 'md' (default) through '4xl', for forms that need more room.
// Phones get a full-width bottom sheet; from sm up it's a centred card.
// Either way it never exceeds the viewport — the body scrolls inside.
function Modal({ open = true, title, description, onClose, size = 'md', className = '', centered = false, children }) {
  if (open === false) return null;

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // keep the page behind from scrolling while the dialog is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      className={`fixed inset-0 z-50 flex ${
        centered ? 'items-center p-3 sm:p-4' : 'items-end sm:items-center sm:p-4'
      } justify-center bg-slate-900/60 backdrop-blur-xs touch-scroll`}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[85vh] supports-[height:100dvh]:max-h-[85dvh] w-full min-w-0 flex-col ${
          centered ? 'rounded-2xl' : 'rounded-t-2xl sm:rounded-2xl'
        } border-[0.25px] border-blue-200 bg-white pb-2 sm:pb-0 shadow-2xl dark:border-blue-700 dark:bg-surface-900 ${SIZES[size] || SIZES.md} ${className}`}
      >
        <div className="flex shrink-0 items-start justify-between border-b border-slate-100 px-4 py-3 sm:px-6 sm:py-4 dark:border-surface-700">
          <div className="min-w-0 pr-2">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-neutral-100 line-clamp-2 break-words sm:truncate">{title}</h2>
            {description && (
              <p className="mt-0.5 text-xs sm:text-sm text-slate-500 dark:text-neutral-400 line-clamp-2">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 -mt-1.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-neutral-500 dark:hover:bg-surface-800 dark:hover:text-neutral-300 transition-colors"
          >
            ✕
          </button>
        </div>
        <div className="custom-scrollbar overflow-y-auto overflow-x-hidden flex-1 min-h-0 min-w-0 flex flex-col px-4 py-3 sm:px-6 sm:py-4">{children}</div>
      </div>
    </div>
  );
}

export default Modal;
