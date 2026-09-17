import { useState } from 'react';

// Single-series column chart with a per-bar hover/focus tooltip (the mark IS
// the hit target), 4px rounded data-end, square baseline, capped bar width,
// and a 2px gap between bars. No legend needed for a single series.
function BarChart({ data, height = 160, color = '#3b82f6', activeColor = '#1d4ed8' }) {
  const [activeIndex, setActiveIndex] = useState(null);
  const max = Math.max(...data.map((d) => d.count), 1);
  const plotHeight = height - 8;

  return (
    <div>
      <div className="flex items-end gap-2 border-b border-slate-200 dark:border-surface-700" style={{ height }}>
        {data.map((d, i) => {
          const barHeight = d.count > 0 ? Math.max((d.count / max) * plotHeight, 4) : 0;
          const isActive = activeIndex === i;

          return (
            <div key={d.label} className="relative flex flex-1 flex-col items-center justify-end">
              {isActive && d.count > 0 && (
                <div className="absolute -top-8 z-10 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-xs text-white dark:bg-surface-700">
                  <span className="font-semibold">{d.count}</span> repair{d.count === 1 ? '' : 's'}
                </div>
              )}
              <button
                type="button"
                onMouseEnter={() => setActiveIndex(i)}
                onMouseLeave={() => setActiveIndex(null)}
                onFocus={() => setActiveIndex(i)}
                onBlur={() => setActiveIndex(null)}
                className="w-full max-w-[24px] rounded-t outline-none"
                style={{
                  height: barHeight,
                  backgroundColor: isActive ? activeColor : color,
                }}
                aria-label={`${d.label}: ${d.count} repair${d.count === 1 ? '' : 's'}`}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 pt-1">
        {data.map((d) => (
          <span key={d.label} className="flex-1 text-center text-[10px] text-slate-500 dark:text-neutral-500">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default BarChart;
