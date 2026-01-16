import { useState, useEffect, useCallback } from 'react';
import { getHealth, HealthResponse } from '@/services/api';

// Default poll interval from environment or 30 seconds
const POLL_INTERVAL_MS = parseInt(
  import.meta.env.VITE_HEALTH_POLL_INTERVAL_MS || '30000',
  10
);

export function useHealth(pollIntervalMs: number = POLL_INTERVAL_MS) {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const data = await getHealth();
      setHealth(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health status');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchHealth();

    // Set up polling
    const intervalId = setInterval(fetchHealth, pollIntervalMs);

    return () => clearInterval(intervalId);
  }, [fetchHealth, pollIntervalMs]);

  const refresh = useCallback(() => {
    setIsLoading(true);
    fetchHealth();
  }, [fetchHealth]);

  return { health, isLoading, error, refresh };
}
