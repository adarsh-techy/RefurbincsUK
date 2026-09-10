import { useEffect, useRef } from 'react';
import { ACCENT_COLORS, PAGE_BG_COLORS, useTheme } from '../../context/ThemeContext';

export default function ThemeCustomizerModal({ onClose }) {
  const {
    customTheme,
    setAccent,
    setCustomAccent,
    setPageBg,
    setCustomPageBg,
    toggleApplyToHeader,
    toggleApplyToSidebar,
  } = useTheme();

  const popoverRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose();
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const activeAccent = customTheme?.accentColor || '#10b981';

  return (
    <div className="fixed inset-0 z-50 flex justify-end p-4 pt-16 sm:p-6 sm:pt-20 pointer-events-none">
      <div
        ref={popoverRef}
        className="pointer-events-auto w-full max-w-[340px] rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-surface-900 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* ── ACCENT COLOR SECTION ────────────────────────────────────────── */}
        <div className="mb-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
              Accent Color
            </span>
            <span className="text-xs font-semibold text-slate-800 dark:text-neutral-200">
              {customTheme.accentName}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-y-3 gap-x-2 text-center">
            {ACCENT_COLORS.map((item) => {
              const isSelected = customTheme.accentId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setAccent(item)}
                  className={`group flex flex-col items-center gap-1.5 rounded-xl p-1.5 transition-all ${
                    isSelected ? 'bg-slate-100 dark:bg-white/5' : 'hover:bg-slate-50 dark:hover:bg-white/5'
                  }`}
                >
                  <div
                    className="relative flex h-9 w-9 items-center justify-center rounded-full shadow-xs transition-transform group-hover:scale-105"
                    style={{ backgroundColor: item.color }}
                  >
                    {isSelected && (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-white">
                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span className="truncate text-[10px] font-medium text-slate-600 dark:text-neutral-300 w-full">
                    {item.name.split(' ')[0]}
                  </span>
                </button>
              );
            })}

            {/* Custom Accent Color */}
            <label
              className={`group flex cursor-pointer flex-col items-center gap-1.5 rounded-xl p-1.5 transition-all ${
                customTheme.accentId === 'custom' ? 'bg-slate-100 dark:bg-white/5' : 'hover:bg-slate-50 dark:hover:bg-white/5'
              }`}
            >
              <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-500 shadow-xs transition-transform group-hover:scale-105">
                <input
                  type="color"
                  value={customTheme.customAccent || '#10b981'}
                  onChange={(e) => setCustomAccent(e.target.value)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
                {customTheme.accentId === 'custom' && (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-white">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <span className="truncate text-[10px] font-medium text-slate-600 dark:text-neutral-300 w-full">
                Custom
              </span>
            </label>
          </div>
        </div>

        {/* ── PAGE BACKGROUND COLOR SECTION ──────────────────────────────── */}
        <div className="mb-5 border-t border-slate-100 pt-4 dark:border-white/5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
              Page Background Color
            </span>
            <span className="text-xs font-semibold text-slate-800 dark:text-neutral-200">
              {customTheme.pageBgName}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-y-3 gap-x-2 text-center">
            {PAGE_BG_COLORS.map((item) => {
              const isSelected = customTheme.pageBgId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPageBg(item)}
                  className={`group flex flex-col items-center gap-1.5 rounded-xl p-1.5 transition-all ${
                    isSelected ? 'bg-slate-100 dark:bg-white/5' : 'hover:bg-slate-50 dark:hover:bg-white/5'
                  }`}
                >
                  <div
                    className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 shadow-2xs transition-transform group-hover:scale-105 dark:border-white/20"
                    style={{ backgroundColor: item.color }}
                  >
                    {isSelected && (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-slate-800">
                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span className="truncate text-[10px] font-medium text-slate-600 dark:text-neutral-300 w-full">
                    {item.name.split(' ')[0]}
                  </span>
                </button>
              );
            })}

            {/* Custom Page Background Color */}
            <label
              className={`group flex cursor-pointer flex-col items-center gap-1.5 rounded-xl p-1.5 transition-all ${
                customTheme.pageBgId === 'custom' ? 'bg-slate-100 dark:bg-white/5' : 'hover:bg-slate-50 dark:hover:bg-white/5'
              }`}
            >
              <div className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-gradient-to-tr from-slate-200 via-sky-100 to-emerald-100 shadow-2xs transition-transform group-hover:scale-105 dark:border-white/20">
                <input
                  type="color"
                  value={customTheme.customPageBg || '#ffffff'}
                  onChange={(e) => setCustomPageBg(e.target.value)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
                {customTheme.pageBgId === 'custom' && (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-slate-800">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <span className="truncate text-[10px] font-medium text-slate-600 dark:text-neutral-300 w-full">
                Custom
              </span>
            </label>
          </div>
        </div>

        {/* ── APPLY BACKGROUND COLOR TO SECTION ──────────────────────────── */}
        <div className="border-t border-slate-100 pt-4 dark:border-white/5">
          <span className="mb-2.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
            Apply Accent Color To
          </span>

          <div className="space-y-2">
            {/* Header Section Toggle Button */}
            <button
              type="button"
              onClick={toggleApplyToHeader}
              className={`flex w-full cursor-pointer items-center justify-between rounded-xl border p-3 text-left transition-all ${
                customTheme.applyToHeader
                  ? 'border-emerald-500 bg-emerald-50/50 dark:border-emerald-500/50 dark:bg-emerald-950/20'
                  : 'border-slate-200/80 bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-surface-900 dark:hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="h-4 w-4 rounded-full border border-black/15 shadow-2xs"
                  style={{
                    backgroundColor: customTheme.applyToHeader
                      ? activeAccent
                      : '#ffffff',
                  }}
                />
                <span className="text-xs font-semibold text-slate-800 dark:text-neutral-200">
                  Header Section
                </span>
              </div>
              <div
                className={`flex h-5 w-5 items-center justify-center rounded-md border transition-colors ${
                  customTheme.applyToHeader
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-slate-300 bg-white dark:border-surface-700 dark:bg-surface-800'
                }`}
              >
                {customTheme.applyToHeader && (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            </button>

            {/* Side Menu Toggle Button */}
            <button
              type="button"
              onClick={toggleApplyToSidebar}
              className={`flex w-full cursor-pointer items-center justify-between rounded-xl border p-3 text-left transition-all ${
                customTheme.applyToSidebar
                  ? 'border-emerald-500 bg-emerald-50/50 dark:border-emerald-500/50 dark:bg-emerald-950/20'
                  : 'border-slate-200/80 bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-surface-900 dark:hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="h-4 w-4 rounded-full border border-black/15 shadow-2xs"
                  style={{
                    backgroundColor: customTheme.applyToSidebar
                      ? activeAccent
                      : '#ffffff',
                  }}
                />
                <span className="text-xs font-semibold text-slate-800 dark:text-neutral-200">
                  Side Menu
                </span>
              </div>
              <div
                className={`flex h-5 w-5 items-center justify-center rounded-md border transition-colors ${
                  customTheme.applyToSidebar
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-slate-300 bg-white dark:border-surface-700 dark:bg-surface-800'
                }`}
              >
                {customTheme.applyToSidebar && (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
