import { useState, useEffect, useCallback } from 'react';
import {
  getPipeline,
  getTaskDetail,
  PipelineResponse,
  TaskDetailResponse,
} from '@/services/api';

const POLL_INTERVAL = 30000; // 30 seconds

interface UsePipelineReturn {
  pipeline: PipelineResponse | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
  selectedTask: TaskDetailResponse | null;
  selectTask: (taskId: string | null) => void;
  isLoadingTask: boolean;
}

export function usePipeline(): UsePipelineReturn {
  const [pipeline, setPipeline] = useState<PipelineResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskDetailResponse | null>(null);
  const [isLoadingTask, setIsLoadingTask] = useState(false);

  const fetchPipeline = useCallback(async () => {
    try {
      const data = await getPipeline();
      setPipeline(data);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch pipeline';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchTaskDetail = useCallback(async (taskId: string) => {
    setIsLoadingTask(true);
    try {
      const data = await getTaskDetail(taskId);
      setSelectedTask(data);
    } catch (err) {
      console.error('Failed to fetch task detail:', err);
      setSelectedTask(null);
    } finally {
      setIsLoadingTask(false);
    }
  }, []);

  // Initial fetch and polling
  useEffect(() => {
    fetchPipeline();

    const interval = setInterval(fetchPipeline, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchPipeline]);

  // Fetch task detail when selected
  useEffect(() => {
    if (selectedTaskId) {
      fetchTaskDetail(selectedTaskId);
    } else {
      setSelectedTask(null);
    }
  }, [selectedTaskId, fetchTaskDetail]);

  const selectTask = useCallback((taskId: string | null) => {
    setSelectedTaskId(taskId);
  }, []);

  const refresh = useCallback(() => {
    setIsLoading(true);
    fetchPipeline();
  }, [fetchPipeline]);

  return {
    pipeline,
    isLoading,
    error,
    refresh,
    selectedTask,
    selectTask,
    isLoadingTask,
  };
}
