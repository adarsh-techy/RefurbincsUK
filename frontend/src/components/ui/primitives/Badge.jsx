const TONES = {
  info: 'border border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-300',
  warning: 'bg-warning-50 text-warning-700 dark:bg-amber-500/15 dark:text-amber-300',
  good: 'bg-brand-50 text-brand-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  critical: 'bg-critical-50 text-critical-700 dark:bg-red-500/15 dark:text-red-300',
  testing: 'border border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-500/40 dark:bg-purple-500/15 dark:text-purple-300',
  neutral: 'bg-slate-100 text-slate-700 dark:bg-surface-700 dark:text-neutral-300',
  black: 'bg-black text-white dark:bg-black dark:text-white border border-neutral-900 shadow-2xs',
};

// battery/status strings from the API (snake_case) mapped to a tone +
// professional display label.
const STATUS_MAP = {
  registered: { tone: 'neutral', label: 'Registered' },
  with_client: { tone: 'info', label: 'With Client' },
  new: { tone: 'neutral', label: 'Registered' },
  in_repair: { tone: 'warning', label: 'Awaiting Repair' },
  in_progress: { tone: 'critical', label: 'Repair In Progress' },
  in_testing: { tone: 'testing', label: 'In Testing' },
  testing: { tone: 'testing', label: 'In Testing' },
  repair_testing: { tone: 'testing', label: 'Repair Testing' },
  repaired: { tone: 'good', label: 'Repair Completed' },
  returned: { tone: 'info', label: 'Returned to Client' },
  unserviceable: { tone: 'critical', label: 'Unserviceable' },
  tested_parts_removed: { tone: 'critical', label: 'Unserviceable', subLabel: 'Test Failed' },
  unserviceable_parts_removed: { tone: 'critical', label: 'Unserviceable', subLabel: 'Test Failed' },
  passed_to_remove: { tone: 'warning', label: 'Passed to Remove Parts' },
  passed_for_part_removal: { tone: 'warning', label: 'Passed to Remove Parts' },
  recycled: { tone: 'black', label: 'Recycled' },
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
    return <Badge tone="neutral">Registered</Badge>;
  }
  const meta = STATUS_MAP[status] || {
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
