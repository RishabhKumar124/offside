import { useEffect, useRef, useState } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';

const PULL_THRESHOLD = 78;
const PULL_START_DISTANCE = 14;
const MAX_PULL = 120;

export default function PullToRefresh({ onRefresh, children }) {
  const startYRef = useRef(null);
  const pullingRef = useRef(false);
  const pullDistanceRef = useRef(0);
  const refreshingRef = useRef(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const handleTouchStart = (event) => {
      if (window.scrollY > 0 || refreshingRef.current) return;
      startYRef.current = event.touches[0]?.clientY ?? null;
      pullingRef.current = false;
    };

    const handleTouchMove = (event) => {
      if (startYRef.current == null || window.scrollY > 0 || refreshingRef.current) return;

      const currentY = event.touches[0]?.clientY ?? 0;
      const delta = currentY - startYRef.current;

      if (delta <= PULL_START_DISTANCE) {
        if (pullingRef.current) {
          pullingRef.current = false;
          pullDistanceRef.current = 0;
          setPullDistance(0);
        }
        return;
      }

      pullingRef.current = true;
      const nextDistance = Math.min((delta - PULL_START_DISTANCE) * 0.45, MAX_PULL);
      pullDistanceRef.current = nextDistance;
      setPullDistance(nextDistance);
      event.preventDefault();
    };

    const handleTouchEnd = async () => {
      if (!pullingRef.current) {
        startYRef.current = null;
        return;
      }

      const shouldRefresh = pullDistanceRef.current >= PULL_THRESHOLD;
      startYRef.current = null;
      pullingRef.current = false;

      if (!shouldRefresh) {
        pullDistanceRef.current = 0;
        setPullDistance(0);
        return;
      }

      refreshingRef.current = true;
      pullDistanceRef.current = PULL_THRESHOLD;
      setPullDistance(PULL_THRESHOLD);
      setRefreshing(true);
      try {
        await onRefresh?.();
      } finally {
        refreshingRef.current = false;
        pullDistanceRef.current = 0;
        setRefreshing(false);
        setPullDistance(0);
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [onRefresh]);

  const visible = refreshing || pullDistance > 0;
  const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);
  const isReady = pullDistance >= PULL_THRESHOLD;
  const indicatorOffset = refreshing ? PULL_THRESHOLD : Math.min(pullDistance, MAX_PULL);
  const indicatorTransform = visible
    ? `translate3d(0, ${indicatorOffset}px, 0)`
    : 'translate3d(0, -100%, 0)';

  return (
    <div className="relative">
      <div
        className="pointer-events-none fixed left-0 right-0 top-0 z-40 flex justify-center transition-transform duration-200 md:hidden"
        style={{ transform: indicatorTransform }}
      >
        <div className="mt-2 inline-flex items-center gap-2 rounded-full border bg-card/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
          {refreshing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          ) : (
            <RotateCcw
              className={`h-3.5 w-3.5 ${isReady ? 'text-primary' : 'text-muted-foreground'}`}
              style={{ transform: `rotate(${progress * 180}deg)` }}
            />
          )}
          <span className="font-medium text-foreground">
            {refreshing ? 'Refreshing...' : isReady ? 'Release to refresh' : 'Pull to refresh'}
          </span>
        </div>
      </div>
      {children}
    </div>
  );
}
