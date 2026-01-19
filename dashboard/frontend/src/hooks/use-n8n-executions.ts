import { useState, useEffect, useCallback } from 'react';
import {
  getN8nExecutions,
  getN8nExecution,
  getN8nWorkflows,
  N8nExecutionListResponse,
  N8nExecutionDetailResponse,
  N8nWorkflow,
  N8nExecutionFilters,
} from '@/services/api';

const POLL_INTERVAL = 10000; // 10 seconds

interface UseN8nExecutionsReturn {
  executions: N8nExecutionListResponse | null;
  workflows: N8nWorkflow[];
  isLoading: boolean;
  error: string | null;
  filters: N8nExecutionFilters;
  setFilters: (filters: N8nExecutionFilters) => void;
  refresh: () => void;
  selectedExecution: N8nExecutionDetailResponse | null;
  selectExecution: (executionId: string | null, includeData?: boolean) => void;
  isLoadingExecution: boolean;
  loadMore: () => void;
}

export function useN8nExecutions(): UseN8nExecutionsReturn {
  const [executions, setExecutions] = useState<N8nExecutionListResponse | null>(null);
  const [workflows, setWorkflows] = useState<N8nWorkflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<N8nExecutionFilters>({ limit: 20 });
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);
  const [selectedExecution, setSelectedExecution] = useState<N8nExecutionDetailResponse | null>(
    null
  );
  const [isLoadingExecution, setIsLoadingExecution] = useState(false);
  const [includeDataOnSelect, setIncludeDataOnSelect] = useState(false);

  const fetchExecutions = useCallback(async () => {
    try {
      const data = await getN8nExecutions(filters);
      setExecutions(data);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch executions';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  const fetchWorkflows = useCallback(async () => {
    try {
      const data = await getN8nWorkflows();
      setWorkflows(data.workflows);
    } catch {
      // Workflows are optional - don't set error
      console.error('Failed to fetch workflows');
    }
  }, []);

  const fetchExecutionDetail = useCallback(
    async (executionId: string, includeData: boolean) => {
      setIsLoadingExecution(true);
      try {
        const data = await getN8nExecution(executionId, includeData);
        setSelectedExecution(data);
      } catch (err) {
        console.error('Failed to fetch execution detail:', err);
        setSelectedExecution(null);
      } finally {
        setIsLoadingExecution(false);
      }
    },
    []
  );

  // Initial fetch and polling
  useEffect(() => {
    fetchExecutions();
    fetchWorkflows();

    const interval = setInterval(fetchExecutions, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchExecutions, fetchWorkflows]);

  // Fetch execution detail when selected
  useEffect(() => {
    if (selectedExecutionId) {
      fetchExecutionDetail(selectedExecutionId, includeDataOnSelect);
    } else {
      setSelectedExecution(null);
    }
  }, [selectedExecutionId, includeDataOnSelect, fetchExecutionDetail]);

  const selectExecution = useCallback((executionId: string | null, includeData: boolean = true) => {
    setSelectedExecutionId(executionId);
    setIncludeDataOnSelect(includeData);
  }, []);

  const refresh = useCallback(() => {
    setIsLoading(true);
    fetchExecutions();
  }, [fetchExecutions]);

  const loadMore = useCallback(() => {
    if (executions?.hasMore && executions.cursor) {
      setFilters((prev) => ({ ...prev, cursor: executions.cursor }));
    }
  }, [executions]);

  const updateFilters = useCallback((newFilters: N8nExecutionFilters) => {
    // Reset cursor when filters change
    setFilters({ ...newFilters, cursor: undefined });
  }, []);

  return {
    executions,
    workflows,
    isLoading,
    error,
    filters,
    setFilters: updateFilters,
    refresh,
    selectedExecution,
    selectExecution,
    isLoadingExecution,
    loadMore,
  };
}
