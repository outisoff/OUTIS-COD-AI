import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const CACHE_KEY = 'whatsapp-check-cache-v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

type CacheEntry = { value: boolean | null; ts: number };
type CacheShape = Record<string, CacheEntry>;

function readCache(): CacheShape {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as CacheShape;
  } catch {
    return {};
  }
}

function writeCache(cache: CacheShape) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* ignore quota */
  }
}

function isFresh(entry: CacheEntry | undefined): entry is CacheEntry {
  return !!entry && Date.now() - entry.ts < CACHE_TTL_MS;
}

export function useCheckWhatsApp(phones: string[]) {
  // Memoize stable sorted unique set so a re-rendered parent array reference doesn't
  // create a fresh array on every render (which churns React Query's closures).
  const uniqueSorted = useMemo(() => [...new Set(phones)].sort(), [phones.join(',')]);
  const queryKey = ['check-whatsapp', uniqueSorted.join(',')];

  return useQuery({
    queryKey,
    queryFn: async () => {
      if (uniqueSorted.length === 0) return {} as Record<string, boolean | null>;

      const cache = readCache();
      const results: Record<string, boolean | null> = {};
      const toFetch: string[] = [];

      for (const phone of uniqueSorted) {
        const entry = cache[phone];
        if (isFresh(entry)) {
          results[phone] = entry.value;
        } else {
          toFetch.push(phone);
        }
      }

      // Batch uncached lookups in groups of 50
      for (let i = 0; i < toFetch.length; i += 50) {
        const batch = toFetch.slice(i, i + 50);
        try {
          const { data, error } = await supabase.functions.invoke('check-whatsapp', {
            body: { phones: batch },
          });

          if (!error && data?.results) {
            for (const [phone, value] of Object.entries(data.results as Record<string, boolean | null>)) {
              results[phone] = value;
              cache[phone] = { value, ts: Date.now() };
            }
          }
        } catch (e) {
          console.error('WhatsApp check batch error:', e);
        }
      }

      if (toFetch.length > 0) writeCache(cache);
      return results;
    },
    enabled: uniqueSorted.length > 0,
    staleTime: CACHE_TTL_MS,
    refetchOnWindowFocus: false,
  });
}
