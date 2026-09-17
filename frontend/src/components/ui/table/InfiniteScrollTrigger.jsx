import { useEffect, useRef } from 'react';

// Invisible sentinel that fires onVisible when it scrolls into view, as long
// as there's more to load and nothing is already in flight. Drop it right
// after the list content.
function InfiniteScrollTrigger({ hasMore, loading, onVisible }) {
  const sentinelRef = useRef(null);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) onVisible();
      },
      { rootMargin: '200px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, onVisible]);

  if (!hasMore) return null;

  return (
    <div ref={sentinelRef} className="py-4 text-center text-xs text-slate-400 dark:text-neutral-500">
      {loading ? 'Loading more…' : ''}
    </div>
  );
}

export default InfiniteScrollTrigger;
