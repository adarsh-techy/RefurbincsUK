import { useState, useMemo } from 'react';

// Generic table for rendering an array of flat objects with column sorting.
// columns: [{ key: 'name', label: 'Name', sortable?: boolean, sortValue?: (row) => any }]
// showRowNumber: prepends a "#" column numbering rows 1, 2, 3…
// bordered: set false to drop the outer border and all row/column dividers
// headerColor: 'green' (default) or 'blue' — tints the thead background/divider.
const HEADER_COLORS = {
  green: {
    thead: 'bg-slate-100 dark:bg-surface-800',
    divide: 'divide-slate-200 dark:divide-surface-700',
    body: 'bg-white dark:bg-surface-900',
    headText: 'text-slate-800 dark:text-neutral-200',
    hover: 'hover:bg-slate-50 dark:hover:bg-surface-800/60',
    outerBorder: 'border-slate-200 dark:border-surface-700',
    tableDivide: 'divide-slate-200 dark:divide-surface-700',
    tbodyDivide: 'divide-slate-100 dark:divide-surface-800',
    tbodyRowDivide: 'divide-slate-100 dark:divide-surface-800',
  },
  blue: {
    thead: 'bg-slate-100 dark:bg-surface-800',
    divide: 'divide-slate-200 dark:divide-surface-700',
    body: 'bg-white dark:bg-surface-900',
    headText: 'text-slate-800 dark:text-neutral-200',
    hover: 'hover:bg-slate-50 dark:hover:bg-surface-800/60',
    outerBorder: 'border-slate-200 dark:border-surface-700',
    tableDivide: 'divide-slate-200 dark:divide-surface-700',
    tbodyDivide: 'divide-slate-100 dark:divide-surface-800',
    tbodyRowDivide: 'divide-slate-100 dark:divide-surface-800',
  },
};

function DataTable({
  columns = [],
  rows = [],
  emptyMessage = 'No records yet.',
  showRowNumber = false,
  bordered = true,
  headerColor = 'green',
  defaultSortKey = null,
  defaultSortDirection = null,
  tableLayout = 'auto', // 'auto' | 'fixed'
  className = '',
  maxHeight = null,
  stickyHeader = true,
  onScrollBottom = null,
}) {
  const [sortKey, setSortKey] = useState(defaultSortKey);
  const [sortDirection, setSortDirection] = useState(defaultSortDirection); // 'asc' | 'desc' | null

  const header = HEADER_COLORS[headerColor] || HEADER_COLORS.green;

  function handleTableScroll(e) {
    if (!onScrollBottom) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - (scrollTop + clientHeight) < 160) {
      onScrollBottom();
    }
  }

  function handleSort(key, isSortable = true) {
    if (isSortable === false) return;
    if (sortKey === key) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortKey(null);
        setSortDirection(null);
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  }

  const sortedRows = useMemo(() => {
    if (!sortKey || !sortDirection || !rows?.length) return rows;

    const col = columns.find((c) => c.key === sortKey);

    return [...rows].sort((a, b) => {
      let aVal = col?.sortValue ? col.sortValue(a) : a[sortKey];
      let bVal = col?.sortValue ? col.sortValue(b) : b[sortKey];

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      const cmp = aStr.localeCompare(bStr, undefined, { numeric: true, sensitivity: 'base' });
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDirection, columns]);

  if (!rows?.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white py-14 text-center dark:border-surface-700 dark:bg-surface-900">
        <p className="text-sm text-slate-500 dark:text-neutral-400">{emptyMessage}</p>
      </div>
    );
  }

  const isFixed = tableLayout === 'fixed';

  return (
    <div
      onScroll={handleTableScroll}
      style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}
      className={`table-responsive-container rounded-xl shadow-xs ${header.body} ${
        bordered ? `border ${header.outerBorder}` : ''
      } ${className}`}
    >
      <table
        className={`w-full text-xs sm:text-sm ${isFixed ? 'table-fixed' : 'min-w-full'} ${
          bordered ? `divide-y ${header.tableDivide}` : ''
        }`}
      >
        <thead className={`${header.thead} ${stickyHeader ? 'sticky top-0 z-10 shadow-xs' : ''}`}>
          <tr className={bordered ? `divide-x ${header.divide}` : ''}>
            {showRowNumber && (
              <th
                style={{ width: '40px' }}
                className={`w-10 sm:w-12 shrink-0 whitespace-nowrap px-2.5 py-2.5 sm:px-4 sm:py-3.5 text-left text-xs sm:text-sm font-bold uppercase tracking-wide ${header.thead} ${header.headText}`}
              >
                #
              </th>
            )}
            {columns.map((col) => {
              const isSortable = col.sortable !== false;
              const isSorted = sortKey === col.key;
              return (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={() => handleSort(col.key, isSortable)}
                  className={`px-3 py-2.5 sm:px-5 sm:py-3.5 text-left text-xs sm:text-sm font-bold uppercase tracking-wide transition-colors ${
                    isFixed ? 'truncate' : 'whitespace-nowrap'
                  } ${header.thead} ${header.headText} ${
                    isSortable ? 'cursor-pointer select-none hover:bg-black/5 dark:hover:bg-white/5' : ''
                  } ${col.className || ''}`}
                >
                  <div className="inline-flex items-center gap-1.5 max-w-full truncate">
                    <span className="truncate">{col.label}</span>
                    {isSortable && (
                      <span className="inline-flex flex-col text-[10px] sm:text-[11px] leading-none shrink-0">
                        {isSorted ? (
                          sortDirection === 'asc' ? (
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">▲</span>
                          ) : (
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">▼</span>
                          )
                        ) : (
                          <span className="opacity-30 hover:opacity-75">⇅</span>
                        )}
                      </span>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className={bordered ? `divide-y ${header.tbodyDivide}` : ''}>
          {sortedRows.map((row, i) => (
            <tr
              key={row.id ?? i}
              className={`transition-colors ${header.hover} ${header.body} ${
                bordered ? `divide-x ${header.tbodyRowDivide}` : ''
              }`}
            >
              {showRowNumber && (
                <td className="w-10 sm:w-12 whitespace-nowrap px-2.5 py-2.5 sm:px-4 sm:py-3.5 text-slate-500 dark:text-neutral-400 font-mono text-xs">{i + 1}</td>
              )}
              {columns.map((col) => (
                <td
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  className={`px-3 py-2.5 sm:px-5 sm:py-3.5 text-slate-700 dark:text-neutral-200 ${
                    isFixed ? 'overflow-hidden truncate' : 'whitespace-nowrap'
                  } ${col.className || ''}`}
                >
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;
