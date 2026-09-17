import { useCallback, useEffect, useRef, useState } from 'react';
import apiClient from '../services/api-client';

// Paginated version of useFetchList for endpoints that return
// { data, hasMore } and accept ?limit=&offset=. Call loadMore() again
// (e.g. from an IntersectionObserver sentinel) to fetch the next page,
// which is appended to the existing items.
//
// `params` are extra query params (e.g. { status, date }) merged into every
// request. Passing a new `params` object resets the list and re-fetches
// page 1 — callers don't need to memoize it, since changes are detected via
// a serialized key, not object identity.
function useInfiniteList(endpoint, pageSize = 15, params = {}) {
  const [items, setItems] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  // Starts true (not false) so the caller's loading UI covers the first
  // render too — otherwise an IntersectionObserver-based trigger can mount
  // on an empty, pre-fetch page, see itself already on-screen, and fire a
  // second concurrent loadMore() at offset 0 before this hook's own initial
  // fetch lands, producing duplicate rows.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const offsetRef = useRef(0);
  const loadingRef = useRef(false);
  const paramsKey = JSON.stringify(params);

  const fetchPage = useCallback(
    async (offset, replace) => {
      loadingRef.current = true;
      setLoading(true);
      try {
        const { data } = await apiClient.get(endpoint, {
          params: { limit: pageSize, offset, ...params },
        });
        setItems((prev) => (replace ? data.data : [...prev, ...data.data]));
        offsetRef.current = offset + data.data.length;
        setHasMore(data.hasMore);
        if (data.total !== undefined) {
          setTotal(Number(data.total));
        }
        setError(null);
      } catch (err) {
        setError(err.response?.data?.message || err.message);
      } finally {
        setLoading(false);
        loadingRef.current = false;
      }
    },
    // paramsKey stands in for params so this doesn't change every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [endpoint, pageSize, paramsKey]
  );

  const loadMore = useCallback(() => {
    if (loadingRef.current || !hasMore) return;
    fetchPage(offsetRef.current, false);
  }, [fetchPage, hasMore]);

  // Re-fetches from page 1, discarding whatever was already loaded — for
  // callers that just edited/deleted a row and want the list back in sync.
  const refetch = useCallback(() => {
    setHasMore(true);
    fetchPage(0, true);
  }, [fetchPage]);

  // Runs on mount, and again whenever the endpoint or filter params change —
  // resets to page 1 instead of appending, so switching a filter replaces
  // the list rather than mixing filtered/unfiltered results.
  useEffect(() => {
    setHasMore(true);
    fetchPage(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, paramsKey]);

  return { items, loading, hasMore, total, error, loadMore, refetch };
}

export default useInfiniteList;
