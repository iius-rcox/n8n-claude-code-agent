import { useQuery } from '@tanstack/react-query';
import { tasksApi } from '../services/tasksApi';
import { TaskDiagnostics } from '../types/task';

export interface UseTaskDiagnosticsResult {
  diagnostics: TaskDiagnostics | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook to fetch diagnostic information for a stuck task
 * Provides error history, execution logs, and system health
 */
export function useTaskDiagnostics(taskId: string | null): UseTaskDiagnosticsResult {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['task-diagnostics', taskId],
    queryFn: () => tasksApi.getDiagnostics(taskId!),
    enabled: !!taskId, // Only fetch when taskId is provided
    staleTime: 30000, // 30 seconds - diagnostics don't change frequently
    retry: 2, // Retry twice on failure
  });

  return {
    diagnostics: data || null,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}
