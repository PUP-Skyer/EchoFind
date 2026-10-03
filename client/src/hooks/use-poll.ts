import { useEffect, useRef } from 'react';

interface UsePollOptions {
  intervalMs?: number;
  enabled?: boolean;
  pauseOnHidden?: boolean;
}

export function usePoll(
  fetchFn: () => Promise<void> | void,
  deps: React.DependencyList,
  options: UsePollOptions = {},
): void {
  const {
    intervalMs = 8000,
    enabled = true,
    pauseOnHidden = true,
  } = options;

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetchRef = useRef(fetchFn);
  fetchRef.current = fetchFn;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let stopped = false;

    const start = (): void => {
      if (timerRef.current) return;
      timerRef.current = setInterval(() => {
        void fetchRef.current();
      }, intervalMs);
    };

    const stop = (): void => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };

    const onVisibilityChange = (): void => {
      if (!pauseOnHidden) return;
      if (document.hidden) {
        stop();
      } else {
        void fetchRef.current();
        start();
      }
    };

    start();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      stopped = true;
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, enabled, pauseOnHidden, ...deps]);
}
