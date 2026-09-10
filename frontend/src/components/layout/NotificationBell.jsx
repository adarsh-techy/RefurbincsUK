import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import apiClient from '../../services/api-client';
import { socket } from '../../services/socket-client';
import { hasPermission } from '../../utils/permissions';

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function NotificationBell() {
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const canViewInventory = hasPermission(user, 'parts');
  const canViewReturns = hasPermission(user, 'returns');

  const [outOfStock, setOutOfStock] = useState([]);
  const [clientReturns, setClientReturns] = useState([]);
  const [activeTab, setActiveTab] = useState('returns'); // 'returns' | 'stock'
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  async function loadData() {
    if (canViewInventory) {
      try {
        const { data } = await apiClient.get('/parts');
        setOutOfStock(data.filter((p) => !p.in_stock));
      } catch {
        // ignore
      }
    }
    if (canViewReturns) {
      try {
        const { data } = await apiClient.get('/returns');
        setClientReturns(data.slice(0, 6));
      } catch {
        // ignore
      }
    }
  }

  useEffect(() => {
    loadData();
    socket.on('connect', loadData);
    socket.on('parts:out-of-stock', (parts) => setOutOfStock(parts));
    return () => {
      socket.off('connect', loadData);
      socket.off('parts:out-of-stock');
    };
  }, [canViewInventory, canViewReturns]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  function goToInventory() {
    setOpen(false);
    navigate('/parts');
  }

  function handleToggle() {
    if (!open) loadData();
    setOpen((prev) => !prev);
  }

  const totalCount = (outOfStock.length) + (clientReturns.length > 0 ? 1 : 0);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        aria-label="Notifications"
        className="relative rounded-xl p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-300 dark:hover:bg-white/5 dark:hover:text-white"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6">
          <path d="M10 2a6 6 0 0 0-6 6c0 1.887-.454 3.665-1.257 5.234a.75.75 0 0 0 .515 1.076c1.65.351 3.32.618 5.008.799a3 3 0 1 0 5.468 0 41.7 41.7 0 0 0 5.008-.799.75.75 0 0 0 .515-1.076A11.45 11.45 0 0 1 16 8a6 6 0 0 0-6-6ZM8.05 14.943a33.54 33.54 0 0 0 3.9 0 1.5 1.5 0 0 1-3.9 0Z" />
        </svg>
        {totalCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4.5 min-w-[1.125rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white shadow-xs">
            {outOfStock.length > 0 ? outOfStock.length : clientReturns.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 sm:w-96 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl dark:border-white/10 dark:bg-surface-900 animate-in fade-in zoom-in-95 duration-150">
          {/* Header with Switcher Tabs */}
          <div className="flex items-center justify-between border-b border-slate-100 p-3 dark:border-white/5">
            <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-white/5">
              <button
                type="button"
                onClick={() => setActiveTab('returns')}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                  activeTab === 'returns'
                    ? 'bg-white text-slate-900 shadow-2xs dark:bg-surface-800 dark:text-white'
                    : 'text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-white'
                }`}
              >
                Client Receipts {clientReturns.length > 0 && `(${clientReturns.length})`}
              </button>
              {canViewInventory && (
                <button
                  type="button"
                  onClick={() => setActiveTab('stock')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                    activeTab === 'stock'
                      ? 'bg-white text-slate-900 shadow-2xs dark:bg-surface-800 dark:text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-white'
                  }`}
                >
                  Low Stock {outOfStock.length > 0 && `(${outOfStock.length})`}
                </button>
              )}
            </div>

            <Link
              to={activeTab === 'returns' ? '/returns' : '/parts'}
              onClick={() => setOpen(false)}
              className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
            >
              View All
            </Link>
          </div>

          {/* Tab 1: Client Received Batteries */}
          {activeTab === 'returns' && (
            <div className="max-h-80 overflow-y-auto p-2 no-scrollbar">
              {clientReturns.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No recent client return dispatches.
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {clientReturns.map((ret) => (
                    <li key={ret.id}>
                      <Link
                        to={`/returns/${ret.id}`}
                        onClick={() => setOpen(false)}
                        className="flex items-start gap-2.5 rounded-xl p-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-xs font-bold text-teal-600 dark:bg-teal-950/40 dark:text-teal-400">
                          🚚
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
                              {ret.client_name || 'Client Fleet'} Received {ret.battery_count} {ret.battery_count === 1 ? 'Battery' : 'Batteries'}
                            </p>
                            <span className="shrink-0 text-[10px] text-slate-400">
                              {timeAgo(ret.returned_at)}
                            </span>
                          </div>
                          <p className="truncate text-[11px] text-slate-500 dark:text-neutral-400">
                            Dispatched on Truck {ret.truck_number || 'N/A'} {ret.driver_name ? `• Driver ${ret.driver_name}` : ''}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Tab 2: Out of Stock Inventory */}
          {activeTab === 'stock' && canViewInventory && (
            <div className="max-h-80 overflow-y-auto p-2 no-scrollbar">
              {outOfStock.length === 0 ? (
                <div className="flex flex-col items-center gap-1.5 py-8 text-center">
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">✓ All parts in stock</span>
                  <p className="text-[11px] text-slate-400">No inventory replenishment required.</p>
                </div>
              ) : (
                <ul className="space-y-1">
                  {outOfStock.map((part) => (
                    <li key={part.id}>
                      <button
                        type="button"
                        onClick={goToInventory}
                        className="group flex w-full items-center justify-between gap-2 rounded-xl p-2.5 text-left transition-colors hover:bg-red-50/70 dark:hover:bg-red-950/30"
                      >
                        <span className="truncate text-xs font-bold text-slate-800 group-hover:text-red-700 dark:text-neutral-200 dark:group-hover:text-red-300">
                          {part.name}
                        </span>
                        <span className="shrink-0 rounded-md bg-red-100 px-2 py-0.5 text-[10px] font-extrabold text-red-700 dark:bg-red-950/80 dark:text-red-300">
                          0 in stock
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-slate-100 p-2.5 text-center dark:border-white/5">
            <Link
              to={activeTab === 'returns' ? '/returns' : '/parts'}
              onClick={() => setOpen(false)}
              className="block w-full rounded-xl bg-slate-50 py-1.5 text-center text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 dark:bg-white/5 dark:text-neutral-200 dark:hover:bg-white/10"
            >
              {activeTab === 'returns' ? 'View All Client Return Dispatches →' : 'Manage Inventory Stock →'}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
