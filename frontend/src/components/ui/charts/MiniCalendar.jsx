import { useState } from 'react';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Builds a Mon-start 6-row grid for the given month, including the
// leading/trailing days of the adjacent months so every week is full.
function buildMonthGrid(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7; // 0 = Monday
  const gridStart = new Date(year, month, 1 - startOffset);

  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    return date;
  });
}

// selectedDate/onSelectDate: controlled from the parent (the dashboard uses
// the picked day to scope "Today's Repairs" and the hourly chart) — clicking
// a day calls onSelectDate with a plain Date. Both are optional so the
// calendar still works as pure navigation if a caller doesn't need selection.
function MiniCalendar({ selectedDate, onSelectDate }) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const days = buildMonthGrid(viewDate.getFullYear(), viewDate.getMonth());
  const isCurrentMonthView =
    viewDate.getFullYear() === today.getFullYear() && viewDate.getMonth() === today.getMonth();

  function changeMonth(delta) {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => changeMonth(-1)}
          aria-label="Previous month"
          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-neutral-500 dark:hover:bg-surface-800 dark:hover:text-neutral-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path
              fillRule="evenodd"
              d="M12.79 5.23a.75.75 0 0 1 0 1.06L9.06 10l3.73 3.71a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => setViewDate(new Date(today.getFullYear(), today.getMonth(), 1))}
          className="text-sm font-semibold text-slate-800 hover:text-brand-700 dark:text-neutral-100 dark:hover:text-emerald-400"
          title="Jump to current month"
        >
          {MONTH_NAMES[viewDate.getMonth()]} {viewDate.getFullYear()}
        </button>

        <button
          type="button"
          onClick={() => changeMonth(1)}
          aria-label="Next month"
          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-neutral-500 dark:hover:bg-surface-800 dark:hover:text-neutral-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path
              fillRule="evenodd"
              d="M7.21 14.77a.75.75 0 0 1 0-1.06L10.94 10 7.21 6.29a.75.75 0 1 1 1.06-1.06l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0Z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {WEEKDAYS.map((day) => (
          <span key={day} className="py-1 font-medium text-slate-400 dark:text-neutral-500">
            {day}
          </span>
        ))}

        {days.map((date) => {
          const isToday = isCurrentMonthView && date.toDateString() === today.toDateString();
          const isCurrentMonth = date.getMonth() === viewDate.getMonth();
          const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();

          return (
            <button
              key={date.toISOString()}
              type="button"
              onClick={() => onSelectDate?.(date)}
              className={`rounded py-1 transition-colors ${
                isSelected
                  ? 'bg-brand-700 font-semibold text-white dark:bg-emerald-600'
                  : isToday
                    ? 'font-semibold text-brand-700 ring-1 ring-inset ring-brand-500 dark:text-emerald-400 dark:ring-emerald-500'
                    : isCurrentMonth
                      ? 'text-slate-700 hover:bg-slate-100 dark:text-neutral-200 dark:hover:bg-surface-800'
                      : 'text-slate-300 hover:bg-slate-100 dark:text-neutral-700 dark:hover:bg-surface-800'
              }`}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default MiniCalendar;
