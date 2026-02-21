import { useState, useCallback } from 'react';
import { localSearchMedications } from '../lib/local-db';
import type { MedicationSearchResult } from '@medstock/shared';

/**
 * Hook for searching the local SQLite medication cache.
 * Uses FTS5 on native (Android/iOS) and LIKE fallback on web.
 */
export function useLocalSearch() {
  const [results, setResults] = useState<MedicationSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const rows = await localSearchMedications(query);
      setResults(rows);
    } catch {
      setResults([]);
    }
    setLoading(false);
  }, []);

  const clearResults = useCallback(() => setResults([]), []);

  return { results, loading, search, clearResults };
}
