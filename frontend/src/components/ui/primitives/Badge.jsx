const TONES = {
  info: 'border border-blue-200/90 bg-blue-50/80 text-blue-800 shadow-2xs dark:border-blue-800/50 dark:bg-blue-950/40 dark:text-blue-300',
  warning: 'border border-amber-200/90 bg-amber-50/80 text-amber-800 shadow-2xs dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-300',
  good: 'border border-emerald-200/90 bg-emerald-50/80 text-emerald-800 shadow-2xs dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300',
  critical: 'border border-rose-200/90 bg-rose-50/80 text-rose-800 shadow-2xs dark:border-rose-800/50 dark:bg-rose-950/40 dark:text-rose-300',
  testing: 'border border-purple-200/90 bg-purple-50/80 text-purple-800 shadow-2xs dark:border-purple-800/50 dark:bg-purple-950/40 dark:text-purple-300',
  neutral: 'border border-slate-200/90 bg-slate-50/80 text-slate-700 shadow-2xs dark:border-white/10 dark:bg-surface-700 dark:text-neutral-300',
  black: 'border border-slate-800 bg-slate-900 text-white shadow-2xs dark:border-neutral-700 dark:bg-black dark:text-neutral-200',
};

// battery/status strings from the API (snake_case) mapped to a tone +
// professional display label and status dot indicator.
const STATUS_MAP = {
  registered: { tone: 'neutral', label: 'Registered', dot: 'bg-slate-400' },
  with_client: { tone: 'info', label: 'With Client', dot: 'bg-blue-500 shadow-xs' },
  new: { tone: 'neutral', label: 'Registered', dot: 'bg-slate-400' },
  in_repair: { tone: 'warning', label: 'Awaiting Repair', dot: 'bg-amber-500 ring-2 ring-amber-400/30' },
  in_progress: { tone: 'critical', label: 'Repair In Progress', dot: 'bg-rose-500 animate-pulse ring-2 ring-rose-400/30' },
  in_testing: { tone: 'testing', label: 'In Testing', dot: 'bg-purple-500 animate-pulse ring-2 ring-purple-400/30' },
  testing: { tone: 'testing', label: 'In Testing', dot: 'bg-purple-500 animate-pulse ring-2 ring-purple-400/30' },
  repair_testing: { tone: 'testing', label: 'Repair Testing', dot: 'bg-purple-500 animate-pulse ring-2 ring-purple-400/30' },
  repaired: { tone: 'good', label: 'Repair Completed', dot: 'bg-emerald-500 ring-2 ring-emerald-400/30 shadow-xs' },
  returned: { tone: 'info', label: 'Returned to Client', dot: 'bg-blue-500 shadow-xs' },
  unserviceable: { tone: 'critical', label: 'Unserviceable', dot: 'bg-rose-500 ring-2 ring-rose-400/30' },
  tested_parts_removed: { tone: 'critical', label: 'Unserviceable', subLabel: 'Test Failed', dot: 'bg-rose-500' },
  unserviceable_parts_removed: { tone: 'critical', label: 'Unserviceable', subLabel: 'Test Failed', dot: 'bg-rose-500' },
  passed_to_remove: { tone: 'warning', label: 'Passed to Remove Parts', dot: 'bg-amber-500 ring-2 ring-amber-400/30' },
  passed_for_part_removal: { tone: 'warning', label: 'Passed to Remove Parts', dot: 'bg-amber-500 ring-2 ring-amber-400/30' },
  recycled: { tone: 'black', label: 'Recycled', dot: 'bg-emerald-400 shadow-xs' },
};

function Badge({ tone = 'neutral', status, children }) {
  if (status) {
    return <StatusBadge status={status} />;
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[tone] || TONES.neutral}`}
    >
      {children}
    </span>
  );
}

// Convenience wrapper for the battery status enum specifically, since it
// shows up on the Batteries table, the lookup panel, and the Repair form.
export function StatusBadge({ status, hasPendingParts, isPassedBack }) {
  if (isPassedBack || hasPendingParts || status === 'passed_to_remove' || status === 'passed_for_part_removal') {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-900 shadow-2xs dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500 ring-2 ring-amber-400/30"></span>
        <span>Passed to Remove Parts</span>
      </span>
    );
  }
  if (!status || status === 'null' || status === 'undefined') {
    return (
      <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${TONES.neutral}`}>
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400"></span>
        <span>Registered</span>
      </span>
    );
  }
  const meta = STATUS_MAP[status] || {
    tone: 'neutral',
    label: status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    dot: 'bg-slate-400',
  };

  const toneClass = TONES[meta.tone] || TONES.neutral;

  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${toneClass}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta.dot || 'bg-slate-400'}`}></span>
      <span>{meta.label}</span>
      {meta.subLabel && (
        <>
          <span className="opacity-40">·</span>
          <span className="text-[10px] font-bold opacity-90">{meta.subLabel}</span>
        </>
      )}
    </span>
  );
}

// Same statuses as StatusBadge, but worded for the client portal instead of
// staff — "Pending" / "In Progress" / "Completed" read as internal workshop
// shorthand to someone who isn't in the shop day to day. These names mirror
// the client sidebar's own bucket labels (Packed, In Service, Received) so
// the wording is consistent everywhere a client sees it.
const CLIENT_STATUS_MAP = {
  registered: { tone: 'neutral', label: 'Registered' },
  with_client: { tone: 'info', label: 'With Client' },
  in_repair: { tone: 'warning', label: 'In Service (Awaiting Repair)' },
  in_progress: { tone: 'warning', label: 'In Service (Repairing)' },
  in_testing: { tone: 'testing', label: 'In Testing & QA' },
  testing: { tone: 'testing', label: 'In Testing & QA' },
  repair_testing: { tone: 'testing', label: 'In Testing & QA' },
  repaired: { tone: 'good', label: 'Service Completed' },
  returned: { tone: 'info', label: 'Returned' },
  unserviceable: { tone: 'critical', label: 'Unserviceable' },
  tested_parts_removed: { tone: 'critical', label: 'Unserviceable', subLabel: 'Test Failed' },
  unserviceable_parts_removed: { tone: 'critical', label: 'Unserviceable', subLabel: 'Test Failed' },
  recycled: { tone: 'black', label: 'Recycled' },
};

export function ClientStatusBadge({ status, isVerified, returnStatus }) {
  if (!status || status === 'null' || status === 'undefined') {
    return <Badge tone="neutral">Registered</Badge>;
  }
  let meta = CLIENT_STATUS_MAP[status];
  if (status === 'returned') {
    const verified = isVerified === true || returnStatus === 'verified';
    if (verified) {
      meta = { tone: 'good', label: 'Received Back' };
    } else {
      meta = { tone: 'info', label: 'Returned' };
    }
  }
  meta = meta || {
    tone: 'neutral',
    label: status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
  };
  if (meta.subLabel) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-red-200/90 bg-red-50/90 px-2.5 py-0.5 text-xs font-semibold text-red-700 shadow-2xs dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500 ring-2 ring-red-400/30"></span>
        <span>{meta.label}</span>
        <span className="font-normal text-red-300 dark:text-red-600">·</span>
        <span className="text-[11px] font-bold text-red-600 dark:text-red-400">{meta.subLabel}</span>
      </span>
    );
  }
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export default Badge;
