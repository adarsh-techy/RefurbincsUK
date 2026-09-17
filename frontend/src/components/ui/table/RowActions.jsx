// Small pencil/trash icon buttons for a table row's Edit/Delete actions.
// Shared so every table (Staff, Parts, Truck Intake, Batteries, Repairs,
// Returns, Users) uses the same icons instead of each hand-rolling text links.
// onToggleBlock + isBlocked add an optional lock/unlock icon (e.g. the
// Generate QR Code list, to hide a battery app-wide without deleting it).
function RowActions({
  onEdit,
  onDelete,
  onToggleBlock,
  isBlocked = false,
  editLabel = 'Edit',
  deleteLabel = 'Delete',
  blockLabel = 'Block',
  unblockLabel = 'Unblock',
}) {
  return (
    <div className="flex items-center gap-3">
      {onToggleBlock && (
        <button
          type="button"
          onClick={onToggleBlock}
          aria-label={isBlocked ? unblockLabel : blockLabel}
          title={isBlocked ? unblockLabel : blockLabel}
          className={
            isBlocked
              ? 'rounded-md p-1.5 text-slate-500 hover:bg-brand-50 hover:text-brand-700 dark:text-neutral-400 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300'
              : 'rounded-md p-1.5 text-slate-500 hover:bg-warning-50 hover:text-warning-700 dark:text-neutral-400 dark:hover:bg-amber-500/10 dark:hover:text-amber-300'
          }
        >
          {isBlocked ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M8 1a4 4 0 0 0-4 4v2H3a1 1 0 0 0-1 1v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8a1 1 0 0 0-1-1h-3.05A4.001 4.001 0 0 0 12 5a4 4 0 0 0-4-4Zm2.83 5H5.5V5a2.5 2.5 0 0 1 4.975-.375c.096.451.153.927.155 1.375Z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path
                fillRule="evenodd"
                d="M10 1a4 4 0 0 0-4 4v2H5a1 1 0 0 0-1 1v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8a1 1 0 0 0-1-1H7.5V5a2.5 2.5 0 0 1 5 0 .75.75 0 0 0 1.5 0A4 4 0 0 0 10 1Z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </button>
      )}
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          aria-label={editLabel}
          title={editLabel}
          className="rounded-md p-1.5 text-slate-500 hover:bg-brand-50 hover:text-brand-700 dark:text-neutral-400 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M13.586 3.586a2 2 0 1 1 2.828 2.828l-8.5 8.5a2 2 0 0 1-.878.507l-3 .75a.5.5 0 0 1-.606-.606l.75-3a2 2 0 0 1 .507-.878l8.5-8.5Z" />
          </svg>
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={deleteLabel}
          title={deleteLabel}
          className="rounded-md p-1.5 text-slate-500 hover:bg-critical-50 hover:text-critical-600 dark:text-neutral-400 dark:hover:bg-red-500/10 dark:hover:text-red-400"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path
              fillRule="evenodd"
              d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482 41.03 41.03 0 0 0-2.365-.298V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

export default RowActions;
