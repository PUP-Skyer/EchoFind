import { useState, useEffect, useRef } from 'react';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { logger } from '@lark-apaas/client-toolkit/logger';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL = 60 * 1000;
const cache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

function cacheKey(url: string, params: unknown): string {
  return params ? `${url}::${JSON.stringify(params)}` : url;
}

async function cachedGet<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const key = cacheKey(url, params);
  const now = Date.now();

  const cached = cache.get(key) as CacheEntry<T> | undefined;
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const promise = (async (): Promise<T> => {
    try {
      const response = await axiosForBackend.get(url, { params });
      const data = response.data as T;
      cache.set(key, { data, timestamp: Date.now() });
      return data;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise as Promise<unknown>);
  return promise;
}

export function invalidateCache(prefix: string): void {
  let count = 0;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
      count += 1;
    }
  }
  if (count > 0) {
    logger.debug(`cache invalidated: ${prefix} (${count} entries)`);
  }
}

export function useCacheInvalidator(): (prefix: string) => void {
  const ref = useRef(invalidateCache);
  useEffect(() => {
    ref.current = invalidateCache;
  }, []);
  return (prefix: string): void => ref.current(prefix);
}

export default cachedGet;
