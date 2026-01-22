import { useQuery } from '@tanstack/react-query';

export interface Task {
  id: string;
  title?: string;
  status: 'pending' | 'in_progress' | 'running' | 'completed' | 'failed';
  currentPhase?: string;
  startedAt?: string;
  lastError?: {
    message?: string;
    code?: string;
    timestamp?: string;
    stackTrace?: string;
  };
  retryCount?: number;
  escalationStatus?: 'none' | 'escalated' | 'resolved';
}

export interface UseTasksResult {
  tasks: Task[] | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook to fetch all tasks from the pipeline API
 * Provides task list for stuck task detection and monitoring
 */
export function useTasks(): UseTasksResult {
  const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['tasks'],
    queryFn: async (): Promise<Task[]> => {
      const response = await fetch(`${API_BASE_URL}/pipeline/tasks`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch tasks');
      }

      const data = await response.json();
      return data.tasks || [];
    },
    staleTime: 10000, // 10 seconds - tasks update relatively frequently
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
  });

  return {
    tasks: data || null,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}
