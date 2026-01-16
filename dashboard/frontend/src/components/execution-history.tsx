import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  getExecutions,
  getExecution,
  ExecutionRecord,
  ExecutionStatus,
} from '@/services/api';
import {
  History,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
} from 'lucide-react';

type StatusFilter = ExecutionStatus | 'all';

function getStatusBadgeVariant(
  status: ExecutionStatus
): 'success' | 'destructive' | 'warning' | 'secondary' {
  switch (status) {
    case 'success':
      return 'success';
    case 'error':
    case 'auth_failure':
      return 'destructive';
    case 'timeout':
      return 'warning';
    case 'running':
    default:
      return 'secondary';
  }
}

function getStatusIcon(status: ExecutionStatus) {
  switch (status) {
    case 'success':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'error':
    case 'auth_failure':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'timeout':
      return <Clock className="h-4 w-4 text-yellow-500" />;
    case 'running':
      return <Loader2 className="h-4 w-4 animate-spin" />;
    default:
      return <AlertCircle className="h-4 w-4" />;
  }
}

function formatDuration(ms?: number): string {
  if (ms === undefined) return '-';
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

export function ExecutionHistory() {
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedExecution, setSelectedExecution] = useState<ExecutionRecord | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const fetchExecutions = useCallback(async () => {
    try {
      setIsLoading(true);
      const status = statusFilter === 'all' ? undefined : statusFilter;
      const response = await getExecutions(status, 50);
      setExecutions(response.executions);
      setTotal(response.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch executions');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchExecutions();
  }, [fetchExecutions]);

  const handleRowClick = async (execution: ExecutionRecord) => {
    setIsDetailLoading(true);
    try {
      const fullExecution = await getExecution(execution.id);
      setSelectedExecution(fullExecution);
    } catch (err) {
      // Fallback to the list item data
      setSelectedExecution(execution);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchExecutions();
  };

  if (isLoading && executions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56 mt-1" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-full mb-4" />
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5" />
              <CardTitle>Execution History</CardTitle>
            </div>
            <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <CardDescription>Recent Claude agent execution records</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as StatusFilter)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="auth_failure">Auth Failure</SelectItem>
                <SelectItem value="timeout">Timeout</SelectItem>
                <SelectItem value="running">Running</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">
              {total} total record{total !== 1 ? 's' : ''}
            </span>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {executions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No executions found
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">Time</TableHead>
                    <TableHead>Prompt</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[80px]">Exit</TableHead>
                    <TableHead className="w-[80px]">Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {executions.map((execution) => (
                    <TableRow
                      key={execution.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRowClick(execution)}
                    >
                      <TableCell className="text-sm">
                        {new Date(execution.startedAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {truncateText(execution.prompt, 50)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {getStatusIcon(execution.status)}
                          <Badge variant={getStatusBadgeVariant(execution.status)}>
                            {execution.status.replace('_', ' ')}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {execution.exitCode ?? '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDuration(execution.durationMs)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedExecution} onOpenChange={() => setSelectedExecution(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Execution Details
              {selectedExecution && (
                <Badge variant={getStatusBadgeVariant(selectedExecution.status)}>
                  {selectedExecution.status.replace('_', ' ')}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedExecution && new Date(selectedExecution.startedAt).toLocaleString()}
            </DialogDescription>
          </DialogHeader>

          {isDetailLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : selectedExecution ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Exit Code:</span>
                  <span className="ml-2 font-medium">{selectedExecution.exitCode ?? 'N/A'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Duration:</span>
                  <span className="ml-2 font-medium">
                    {formatDuration(selectedExecution.durationMs)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Completed:</span>
                  <span className="ml-2 font-medium">
                    {selectedExecution.completedAt
                      ? new Date(selectedExecution.completedAt).toLocaleTimeString()
                      : '-'}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Prompt</label>
                <pre className="p-3 bg-muted rounded-md text-sm font-mono whitespace-pre-wrap max-h-[150px] overflow-auto">
                  {selectedExecution.prompt}
                </pre>
              </div>

              {selectedExecution.output && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output</label>
                  <pre className="p-3 bg-muted rounded-md text-sm font-mono whitespace-pre-wrap max-h-[200px] overflow-auto">
                    {selectedExecution.output}
                  </pre>
                </div>
              )}

              {selectedExecution.errorMessage && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-destructive">Error</label>
                  <pre className="p-3 bg-destructive/10 rounded-md text-sm font-mono whitespace-pre-wrap text-destructive">
                    {selectedExecution.errorMessage}
                  </pre>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
