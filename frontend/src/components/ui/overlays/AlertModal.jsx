import Modal from './Modal';

// A single-button popup for surfacing an error message, styled consistently
// with ConfirmModal instead of the browser's native window.alert.
function AlertModal({ title = 'Error', message, onClose }) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-critical-100 dark:bg-red-500/15">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5 text-critical-600 dark:text-red-400"
            >
              <path
                fillRule="evenodd"
                d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
                clipRule="evenodd"
              />
            </svg>
          </span>
          <p className="pt-1.5 text-sm text-slate-600 dark:text-neutral-300">{message}</p>
        </div>

        <div className="flex justify-end border-t border-slate-100 pt-4 dark:border-surface-700">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-critical-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-critical-700 dark:bg-red-600 dark:hover:bg-red-500"
          >
            OK
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default AlertModal;
