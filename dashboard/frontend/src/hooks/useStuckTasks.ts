import { useMemo } from 'react';
import { useTasks } from './useTasks';
import { StuckTask, TaskPhase } from '../types/task';
import { STUCK_TASK_THRESHOLD_MS } from '../constants/thresholds';

export interface UseStuckTasksResult {
  stuckTasks: StuckTask[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook to detect and track stuck tasks (tasks running longer than threshold)
 * Integrates with existing useTasks hook to identify stuck tasks
 */
export function useStuckTasks(): UseStuckTasksResult {
  const { tasks, isLoading, error, refetch } = useTasks();

  const stuckTasks = useMemo(() => {
    if (!tasks) return [];

    const now = Date.now();
    const stuck: StuckTask[] = [];

    for (const task of tasks) {
      // Check if task is currently running
      if (task.status !== 'in_progress' && task.status !== 'running') {
        continue;
      }

      // Calculate how long task has been running
      const startTime = task.startedAt ? new Date(task.startedAt).getTime() : now;
      const duration = now - startTime;

      // Task is stuck if running longer than threshold
      if (duration > STUCK_TASK_THRESHOLD_MS) {
        stuck.push({
          id: task.id,
          title: task.title || `Task ${task.id}`,
          currentPhase: (task.currentPhase as TaskPhase) || 'intake',
          stuckSince: new Date(startTime),
          stuckDuration: duration,
          lastError: task.lastError
            ? {
                message: task.lastError.message || 'Unknown error',
                code: task.lastError.code,
                timestamp: task.lastError.timestamp
                  ? new Date(task.lastError.timestamp)
                  : new Date(),
                stackTrace: task.lastError.stackTrace,
              }
            : undefined,
          retryCount: task.retryCount || 0,
          escalationStatus: task.escalationStatus as any, // TODO: API should return full EscalationStatus object
        });
      }
    }

    return stuck;
  }, [tasks]);

  return {
    stuckTasks,
    isLoading,
    error,
    refetch,
  };
}
