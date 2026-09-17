const TONES = {
  info: 'border border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-300',
  warning: 'bg-warning-50 text-warning-700 dark:bg-amber-500/15 dark:text-amber-300',
  good: 'bg-brand-50 text-brand-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  critical: 'bg-critical-50 text-critical-700 dark:bg-red-500/15 dark:text-red-300',
  testing: 'border border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-500/40 dark:bg-purple-500/15 dark:text-purple-300',
  neutral: 'bg-slate-100 text-slate-700 dark:bg-surface-700 dark:text-neutral-300',
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
  tested_parts_removed: { tone: 'critical', label: 'Tested - Parts Removed' },
  unserviceable_parts_removed: { tone: 'critical', label: 'Tested - Parts Removed' },
  recycled: { tone: 'neutral', label: 'Recycled' },
};

function Badge({ tone = 'neutral', children }) {
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
export function StatusBadge({ status }) {
  if (!status || status === 'null' || status === 'undefined') {
    return <Badge tone="neutral">Registered</Badge>;
  }
  const meta = STATUS_MAP[status] || {
    tone: 'neutral',
    label: status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
  };
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
  repaired: { tone: 'good', label: 'Repaired & Ready' },
  returned: { tone: 'good', label: 'Received Back' },
  unserviceable: { tone: 'critical', label: 'Unserviceable (Not Repairable)' },
  tested_parts_removed: { tone: 'critical', label: 'Unserviceable (Parts Removed)' },
  unserviceable_parts_removed: { tone: 'critical', label: 'Unserviceable (Parts Removed)' },
  recycled: { tone: 'neutral', label: 'Recycled' },
};

export function ClientStatusBadge({ status }) {
  if (!status || status === 'null' || status === 'undefined') {
    return <Badge tone="neutral">Registered</Badge>;
  }
  const meta = CLIENT_STATUS_MAP[status] || {
    tone: 'neutral',
    label: status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
  };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export default Badge;
