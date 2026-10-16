import { useMemo, useState, useEffect } from 'react';
import DataTable from '../../../components/ui/table/DataTable';
import TableState from '../../../components/ui/table/TableState';
import useFetchList from '../../../utils/use-fetch-list';
import { useTheme } from '../../../context/ThemeContext';
import {
  FiBox,
  FiCheckCircle,
  FiAlertTriangle,
  FiXCircle,
  FiSearch,
  FiX,
  FiRefreshCw,
  FiGrid,
  FiList,
} from 'react-icons/fi';

// The client's own parts inventory: the stock the workshop holds for this
// client's repairs, with each part's minimum level. Only this client's parts
// come back from /clients/me/parts.
function stockState(p) {
  const qty = Number(p.quantity) || 0;
  const min = Number(p.min_stock) || 0;
  if (qty <= 0) {
    return {
      status: 'out',
      label: 'Out of Stock',
      badgeClass: 'bg-rose-50 text-rose-700 border border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40',
      color: 'text-rose-600 dark:text-rose-400',
      barColor: 'bg-rose-500',
      ratio: 0,
    };
  }
  if (p.is_low || (min > 0 && qty <= min)) {
    const ratio = min > 0 ? Math.min(100, Math.round((qty / min) * 100)) : 50;
    return {
      status: 'low',
      label: `Low Stock (${qty} left)`,
      badgeClass: 'bg-amber-50 text-amber-800 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40',
      color: 'text-amber-600 dark:text-amber-400',
      barColor: 'bg-amber-500',
      ratio,
    };
  }
  const ratio = min > 0 ? Math.min(100, Math.round((qty / (min * 2)) * 100)) : 100;
  return {
    status: 'in_stock',
    label: 'In Stock',
    badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40',
    color: 'text-emerald-600 dark:text-emerald-400',
    barColor: 'bg-emerald-500',
    ratio,
  };
}

function ClientPartsPage() {
  const { data, loading, error, refetch } = useFetchList('/clients/me/parts');
  const parts = useMemo(() => data?.data || [], [data]);
  const { customTheme } = useTheme();
  const accent = customTheme?.accentColor || '#10b981';

  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'in_stock' | 'low' | 'out'

  // Default to compact cards on mobile (< 768px) to eliminate horizontal table scrolling
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768 ? 'cards' : 'table';
    }
    return 'cards';
  });

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth < 768 && viewMode === 'table') {
        // keep view responsive
      }
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [viewMode]);

  // Statistics
  const stats = useMemo(() => {
    let inStock = 0;
    let low = 0;
    let out = 0;

    parts.forEach((p) => {
      const state = stockState(p);
      if (state.status === 'out') out += 1;
      else if (state.status === 'low') low += 1;
      else inStock += 1;
    });

    return {
      total: parts.length,
      inStock,
      low,
      out,
    };
  }, [parts]);

  // Filtered rows
  const rows = useMemo(() => {
    return parts.filter((p) => {
      const state = stockState(p);
      if (filterTab === 'in_stock' && state.status !== 'in_stock') return false;
      if (filterTab === 'low' && state.status !== 'low') return false;
      if (filterTab === 'out' && state.status !== 'out') return false;

      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        p.name?.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q))
      );
    });
  }, [parts, filterTab, search]);

  const columns = [
    {
      key: 'name',
      label: 'Part Name',
      render: (p) => (
        <div className="min-w-0 py-0.5">
          <p className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">{p.name}</p>
          {p.sku ? (
            <p className="font-mono text-[10px] text-slate-400 dark:text-neutral-400 mt-0.5">SKU: {p.sku}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'quantity',
      label: 'Available',
      render: (p) => {
        const state = stockState(p);
        return <span className={`font-black text-xs sm:text-sm ${state.color}`}>{p.quantity}</span>;
      },
    },
    {
      key: 'min_stock',
      label: 'Min Level',
      render: (p) => (
        <span className="font-medium text-xs sm:text-sm text-slate-600 dark:text-neutral-300">
          {p.min_stock ?? 0}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Stock Status',
      render: (p) => {
        const s = stockState(p);
        return (
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] sm:text-xs font-bold ${s.badgeClass}`}>
            {s.label}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-3 min-w-0 pb-10">
      {/* 1. Page Header - Compact & refined */}
      <div className="border-b border-slate-200/80 pb-2.5 dark:border-white/10">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <h1 className="text-base sm:text-xl font-black tracking-tight text-slate-900 dark:text-white">
              Parts Inventory
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-surface-800 dark:text-neutral-300 border border-slate-200 dark:border-white/10">
              {rows.length} {rows.length === 1 ? 'Part' : 'Parts'}
            </span>
          </div>

          <button
            type="button"
            onClick={refetch}
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 dark:hover:bg-surface-700 cursor-pointer shrink-0 transition-colors"
            title="Refresh parts list"
          >
            <FiRefreshCw className={`h-3 w-3 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
        <p className="text-[10.5px] sm:text-xs text-slate-500 dark:text-neutral-400 mt-0.5 leading-tight">
          Workshop parts stock reserved for your battery repairs, with each part&apos;s minimum threshold.
        </p>
      </div>

      {/* 2. Top Metric Overview Cards - Compact 2x2 Grid */}
      <div className="grid grid-cols-2 gap-2 sm:gap-2.5 lg:grid-cols-4">
        {/* Total Catalog */}
        <div
          onClick={() => setFilterTab('all')}
          className={`rounded-xl border p-2.5 sm:p-3 flex flex-col justify-between transition-all cursor-pointer ${
            filterTab === 'all'
              ? 'border-blue-300 bg-blue-50/40 dark:border-blue-800/60 dark:bg-blue-950/20 shadow-2xs'
              : 'border-slate-200/90 bg-white hover:border-slate-300 dark:border-surface-700 dark:bg-surface-900'
          }`}
        >
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
              Total Catalog
            </span>
            <div className="flex h-5.5 w-5.5 sm:h-6 sm:w-6 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300">
              <FiBox className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </div>
          </div>
          <div className="mt-1.5">
            <p className="text-sm sm:text-lg font-black text-slate-900 dark:text-white leading-none">
              {stats.total}
            </p>
            <p className="text-[9px] text-slate-400 dark:text-neutral-400 mt-0.5 font-medium">
              Registered SKUs
            </p>
          </div>
        </div>

        {/* In Stock */}
        <div
          onClick={() => setFilterTab(filterTab === 'in_stock' ? 'all' : 'in_stock')}
          className={`rounded-xl border p-2.5 sm:p-3 flex flex-col justify-between transition-all cursor-pointer ${
            filterTab === 'in_stock'
              ? 'border-emerald-300 bg-emerald-50/40 dark:border-emerald-800/60 dark:bg-emerald-950/20 shadow-2xs'
              : 'border-slate-200/90 bg-white hover:border-slate-300 dark:border-surface-700 dark:bg-surface-900'
          }`}
        >
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              In Stock
            </span>
            <div className="flex h-5.5 w-5.5 sm:h-6 sm:w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300">
              <FiCheckCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </div>
          </div>
          <div className="mt-1.5">
            <p className="text-sm sm:text-lg font-black text-emerald-600 dark:text-emerald-400 leading-none">
              {stats.inStock}
            </p>
            <p className="text-[9px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5 font-medium">
              Healthy Levels
            </p>
          </div>
        </div>

        {/* Low Stock */}
        <div
          onClick={() => setFilterTab(filterTab === 'low' ? 'all' : 'low')}
          className={`rounded-xl border p-2.5 sm:p-3 flex flex-col justify-between transition-all cursor-pointer ${
            filterTab === 'low'
              ? 'border-amber-300 bg-amber-50/40 dark:border-amber-800/60 dark:bg-amber-950/20 shadow-2xs'
              : 'border-slate-200/90 bg-white hover:border-slate-300 dark:border-surface-700 dark:bg-surface-900'
          }`}
        >
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
              Low Stock
            </span>
            <div className="flex h-5.5 w-5.5 sm:h-6 sm:w-6 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300">
              <FiAlertTriangle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </div>
          </div>
          <div className="mt-1.5">
            <p className="text-sm sm:text-lg font-black text-amber-600 dark:text-amber-400 leading-none">
              {stats.low}
            </p>
            <p className="text-[9px] text-amber-600/80 dark:text-amber-400/80 mt-0.5 font-medium">
              Near Minimum
            </p>
          </div>
        </div>

        {/* Out of Stock */}
        <div
          onClick={() => setFilterTab(filterTab === 'out' ? 'all' : 'out')}
          className={`rounded-xl border p-2.5 sm:p-3 flex flex-col justify-between transition-all cursor-pointer ${
            filterTab === 'out'
              ? 'border-rose-300 bg-rose-50/40 dark:border-rose-800/60 dark:bg-rose-950/20 shadow-2xs'
              : 'border-slate-200/90 bg-white hover:border-slate-300 dark:border-surface-700 dark:bg-surface-900'
          }`}
        >
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">
              Out of Stock
            </span>
            <div className="flex h-5.5 w-5.5 sm:h-6 sm:w-6 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300">
              <FiXCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </div>
          </div>
          <div className="mt-1.5">
            <p className="text-sm sm:text-lg font-black text-rose-600 dark:text-rose-400 leading-none">
              {stats.out}
            </p>
            <p className="text-[9px] text-rose-600/80 dark:text-rose-400/80 mt-0.5 font-medium">
              Zero Available
            </p>
          </div>
        </div>
      </div>

      {/* Low Stock Alert Banner */}
      {(stats.low > 0 || stats.out > 0) && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300/80 bg-amber-50/80 p-2.5 sm:p-3 text-xs text-amber-950 shadow-2xs dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          <FiAlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="min-w-0 flex-1 leading-relaxed text-[11px] sm:text-xs">
            <strong className="font-bold">
              {stats.low + stats.out} part{stats.low + stats.out === 1 ? '' : 's'} need attention.
            </strong>{' '}
            {stats.out > 0 ? `${stats.out} out of stock. ` : ''}
            {stats.low > 0 ? `${stats.low} at or below minimum threshold. ` : ''}
            Battery repair schedules may be delayed until parts are restocked.
          </div>
        </div>
      )}

      {/* 3. Search and Filters Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {/* Search Input */}
        <div className="relative flex-1 sm:max-w-xs">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-neutral-500 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search part name or SKU…"
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-7 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden dark:border-surface-700 dark:bg-surface-800 dark:text-neutral-100 shadow-2xs"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-neutral-300"
            >
              <FiX className="h-3 w-3" />
            </button>
          ) : null}
        </div>

        {/* Filter Tabs & View Switcher */}
        <div className="flex items-center justify-between sm:justify-end gap-1.5 flex-wrap">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
            {[
              { id: 'all', label: 'All', count: stats.total },
              { id: 'in_stock', label: 'In Stock', count: stats.inStock },
              { id: 'low', label: 'Low', count: stats.low },
              { id: 'out', label: 'Out', count: stats.out },
            ].map((tab) => {
              const active = filterTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterTab(tab.id)}
                  className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                    active
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-surface-700 dark:bg-surface-800 dark:text-neutral-300'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[9px] ${
                      active
                        ? 'bg-white/20 text-white dark:bg-slate-200 dark:text-slate-900'
                        : 'bg-slate-100 text-slate-500 dark:bg-surface-700 dark:text-neutral-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {(search || filterTab !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setFilterTab('all');
              }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:border-surface-700 dark:bg-surface-800 dark:text-neutral-400 cursor-pointer shadow-2xs"
              title="Clear all filters"
            >
              Clear
            </button>
          )}

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-surface-700 dark:bg-surface-800">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`rounded-md p-1 transition-colors cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white text-slate-900 shadow-2xs dark:bg-surface-700 dark:text-white'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200'
              }`}
              title="Card view"
            >
              <FiGrid className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`rounded-md p-1 transition-colors cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-2xs dark:bg-surface-700 dark:text-white'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200'
              }`}
              title="Table view"
            >
              <FiList className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Content Area */}
      {error ? (
        <TableState tone="error">{error}</TableState>
      ) : loading && !parts.length ? (
        <TableState>Loading parts inventory…</TableState>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-slate-200/90 bg-white p-6 sm:p-8 text-center dark:border-surface-700/80 dark:bg-surface-900 shadow-2xs">
          <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-surface-800 dark:text-neutral-400 mb-2">
            <FiBox className="h-5 w-5" />
          </div>
          <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-neutral-200">
            {parts.length ? 'No parts match your filter criteria' : 'No parts held in inventory yet'}
          </p>
          <p className="mt-1 text-[11px] text-slate-400 max-w-sm mx-auto">
            {search || filterTab !== 'all'
              ? 'Try adjusting your search keywords or switching filters above.'
              : 'Parts allocated for your fleet will appear here once registered by the workshop.'}
          </p>
          {(search || filterTab !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setFilterTab('all');
              }}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : viewMode === 'cards' ? (
        /* Compact Responsive Card Grid */
        <div className="grid grid-cols-1 gap-2 sm:gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map((p, idx) => {
            const state = stockState(p);
            const qty = Number(p.quantity) || 0;
            const min = Number(p.min_stock) || 0;

            return (
              <div
                key={p.id || idx}
                className="flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-2.5 sm:p-3 shadow-2xs transition-all hover:border-slate-300 dark:border-surface-700/80 dark:bg-surface-900"
              >
                <div>
                  {/* Card Header: Name + Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-neutral-100 truncate">
                        {p.name}
                      </h3>
                      <p className="font-mono text-[9.5px] text-slate-400 dark:text-neutral-400 mt-0.5 truncate">
                        {p.sku ? `SKU: ${p.sku}` : 'SKU: —'}
                      </p>
                    </div>
                    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[9.5px] font-bold ${state.badgeClass}`}>
                      {state.label}
                    </span>
                  </div>

                  {/* Stock Metrics Row */}
                  <div className="mt-2 grid grid-cols-2 gap-1.5 rounded-lg bg-slate-50 p-2 dark:bg-surface-800/80">
                    <div>
                      <p className="text-[9px] font-semibold text-slate-400 dark:text-neutral-400">Available</p>
                      <p className={`text-xs sm:text-sm font-black ${state.color} leading-tight`}>
                        {qty} <span className="text-[9px] font-medium text-slate-400">units</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold text-slate-400 dark:text-neutral-400">Min Threshold</p>
                      <p className="text-xs sm:text-sm font-black text-slate-700 dark:text-neutral-200 leading-tight">
                        {min} <span className="text-[9px] font-medium text-slate-400">units</span>
                      </p>
                    </div>
                  </div>

                  {/* Stock Level Bar */}
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-[9px] text-slate-400 dark:text-neutral-400 mb-0.5">
                      <span>Threshold Level</span>
                      <span className="font-bold text-slate-600 dark:text-neutral-300">
                        {qty <= 0 ? 'Depleted' : qty <= min ? `${qty}/${min} Min` : 'Healthy'}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-surface-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${state.barColor}`}
                        style={{ width: `${Math.max(5, Math.min(100, state.ratio))}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-2xs dark:border-surface-700/80 dark:bg-surface-900">
          <DataTable
            columns={columns}
            rows={rows}
            showRowNumber
            emptyMessage={parts.length ? 'No parts match your filter.' : 'No parts held for you yet.'}
          />
        </div>
      )}
    </div>
  );
}

export default ClientPartsPage;
