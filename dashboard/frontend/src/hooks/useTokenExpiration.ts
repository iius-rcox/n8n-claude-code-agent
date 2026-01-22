import { useQuery } from '@tanstack/react-query';
import { authApi } from '../services/authApi';
import { TokenExpiration } from '../types/auth';
import { TOKEN_POLL_INTERVAL_MS } from '../constants/thresholds';

export interface UseTokenExpirationResult {
  tokenExpiration: TokenExpiration | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook to poll auth token status and calculate expiration
 * Polls every 60 seconds to keep expiration data fresh
 */
export function useTokenExpiration(): UseTokenExpirationResult {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['token-expiration'],
    queryFn: () => authApi.getTokenStatus(),
    refetchInterval: TOKEN_POLL_INTERVAL_MS, // Poll every 60 seconds
    staleTime: TOKEN_POLL_INTERVAL_MS - 1000, // Consider stale 1 second before next poll
    retry: 3, // Retry auth failures
  });

  return {
    tokenExpiration: data || null,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}
