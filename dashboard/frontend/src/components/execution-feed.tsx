import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
import { useN8nExecutions } from '@/hooks/use-n8n-executions';
import {
  N8nExecution,
  N8nExecutionStatus,
  N8nExecutionDetailResponse,
  N8nWorkflow,
} from '@/services/api';
import {
  RefreshCw,
  AlertCircle,
  Clock,
  Play,
  CheckCircle2,
  XCircle,
  Loader2,
  PauseCircle,
  ChevronRight,
  ChevronDown,
  Workflow,
  Filter,
  Terminal,
  ArrowRight,
} from 'lucide-react';

// Status badge variants
function getStatusBadge(status: N8nExecutionStatus): {
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  icon: React.ReactNode;
  label: string;
  color: string;
} {
  switch (status) {
    case 'running':
      return {
        variant: 'default',
        icon: <Loader2 className="h-3 w-3 animate-spin" />,
        label: 'Running',
        color: 'bg-blue-500',
      };
    case 'success':
      return {
        variant: 'secondary',
        icon: <CheckCircle2 className="h-3 w-3" />,
        label: 'Success',
        color: 'bg-green-500',
      };
    case 'error':
      return {
        variant: 'destructive',
        icon: <XCircle className="h-3 w-3" />,
        label: 'Error',
        color: 'bg-red-500',
      };
    case 'canceled':
      return {
        variant: 'outline',
        icon: <PauseCircle className="h-3 w-3" />,
        label: 'Canceled',
        color: 'bg-gray-500',
      };
    case 'waiting':
      return {
        variant: 'outline',
        icon: <Clock className="h-3 w-3" />,
        label: 'Waiting',
        color: 'bg-yellow-500',
      };
    default:
      return {
        variant: 'outline',
        icon: <Clock className="h-3 w-3" />,
        label: status,
        color: 'bg-gray-500',
      };
  }
}

// Format duration
function formatDuration(ms?: number): string {
  if (!ms) return '-';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

// Format timestamp
function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleString();
}

// Format relative time
function formatRelativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

// Execution Row Component
function ExecutionRow({
  execution,
  onClick,
}: {
  execution: N8nExecution;
  onClick: () => void;
}) {
  const statusInfo = getStatusBadge(execution.status);

  return (
    <div
      className="flex items-center gap-4 py-3 px-4 border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      {/* Status Indicator */}
      <div className={`w-2 h-2 rounded-full ${statusInfo.color}`} />

      {/* Workflow Name */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Workflow className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium truncate">{execution.workflowName}</span>
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {execution.taskId && (
            <span className="mr-2">
              Task: <span className="font-mono">{execution.taskId}</span>
            </span>
          )}
          {execution.phase && (
            <Badge variant="outline" className="text-xs">
              {execution.phase}
            </Badge>
          )}
        </div>
      </div>

      {/* Status Badge */}
      <Badge variant={statusInfo.variant} className="gap-1">
        {statusInfo.icon}
        {statusInfo.label}
      </Badge>

      {/* Duration */}
      <div className="text-sm text-muted-foreground w-20 text-right">
        {formatDuration(execution.durationMs)}
      </div>

      {/* Time */}
      <div className="text-sm text-muted-foreground w-24 text-right">
        {formatRelativeTime(execution.startedAt)}
      </div>

      {/* Expand Arrow */}
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}

// Execution Filters Component
function ExecutionFilters({
  workflows,
  filters,
  onFiltersChange,
}: {
  workflows: N8nWorkflow[];
  filters: { workflowId?: string; status?: N8nExecutionStatus };
  onFiltersChange: (filters: { workflowId?: string; status?: N8nExecutionStatus }) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasActiveFilters = filters.workflowId || filters.status;

  return (
    <div className="mb-4">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsExpanded(!isExpanded)}
        className="mb-2"
      >
        <Filter className="h-4 w-4 mr-2" />
        Filters
        {hasActiveFilters && (
          <Badge variant="secondary" className="ml-2">
            Active
          </Badge>
        )}
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 ml-2" />
        ) : (
          <ChevronRight className="h-4 w-4 ml-2" />
        )}
      </Button>

      {isExpanded && (
        <div className="flex flex-wrap gap-4 p-4 border rounded-lg bg-muted/30">
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium mb-1 block">Workflow</label>
            <Select
              value={filters.workflowId || 'all'}
              onValueChange={(value) =>
                onFiltersChange({
                  ...filters,
                  workflowId: value === 'all' ? undefined : value,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All workflows" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All workflows</SelectItem>
                {workflows.map((workflow) => (
                  <SelectItem key={workflow.id} value={workflow.id}>
                    {workflow.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="text-sm font-medium mb-1 block">Status</label>
            <Select
              value={filters.status || 'all'}
              onValueChange={(value) =>
                onFiltersChange({
                  ...filters,
                  status: value === 'all' ? undefined : (value as N8nExecutionStatus),
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="waiting">Waiting</SelectItem>
                <SelectItem value="canceled">Canceled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {hasActiveFilters && (
            <div className="flex items-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onFiltersChange({})}
              >
                Clear filters
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Execution Detail Panel
function ExecutionDetailPanel({
  execution,
  isLoading,
}: {
  execution: N8nExecutionDetailResponse | null;
  isLoading: boolean;
}) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['overview', 'nodes'])
  );

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="p-4 text-center text-muted-foreground">Execution not found</div>
    );
  }

  const statusInfo = getStatusBadge(execution.execution.status);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Workflow className="h-5 w-5" />
          <h3 className="text-lg font-semibold">{execution.execution.workflowName}</h3>
        </div>
        <p className="text-sm text-muted-foreground font-mono">ID: {execution.execution.id}</p>
        <div className="flex flex-wrap gap-2 mt-2">
          <Badge variant={statusInfo.variant} className="gap-1">
            {statusInfo.icon}
            {statusInfo.label}
          </Badge>
          <Badge variant="outline">{execution.execution.mode}</Badge>
          {execution.execution.taskId && (
            <Badge variant="outline" className="font-mono">
              {execution.execution.taskId}
            </Badge>
          )}
        </div>
      </div>

      {/* Overview Section */}
      <CollapsibleSection
        title="Overview"
        icon={<Clock className="h-4 w-4" />}
        expanded={expandedSections.has('overview')}
        onToggle={() => toggleSection('overview')}
      >
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Started:</span>
            <div>{formatTime(execution.execution.startedAt)}</div>
          </div>
          {execution.execution.stoppedAt && (
            <div>
              <span className="text-muted-foreground">Stopped:</span>
              <div>{formatTime(execution.execution.stoppedAt)}</div>
            </div>
          )}
          <div>
            <span className="text-muted-foreground">Duration:</span>
            <div>{formatDuration(execution.execution.durationMs)}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Mode:</span>
            <div className="capitalize">{execution.execution.mode}</div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Error Section */}
      {execution.execution.error && (
        <div className="border border-red-200 bg-red-50 dark:bg-red-950/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-2">
            <AlertCircle className="h-4 w-4" />
            <span className="font-medium">Error</span>
          </div>
          <p className="text-sm text-red-700 dark:text-red-300">
            {execution.execution.error.message}
          </p>
          {execution.execution.error.node && (
            <p className="text-xs text-red-500 mt-1">Node: {execution.execution.error.node}</p>
          )}
        </div>
      )}

      {/* Node Executions Section */}
      {execution.nodeExecutions && execution.nodeExecutions.length > 0 && (
        <CollapsibleSection
          title="Node Executions"
          icon={<Terminal className="h-4 w-4" />}
          expanded={expandedSections.has('nodes')}
          onToggle={() => toggleSection('nodes')}
        >
          <div className="space-y-2">
            {execution.nodeExecutions.map((node, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 p-2 rounded border ${
                  node.status === 'error'
                    ? 'border-red-200 bg-red-50 dark:bg-red-950/30'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                {node.status === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{node.nodeName}</div>
                  <div className="text-xs text-muted-foreground">{node.nodeType}</div>
                </div>
                <div className="text-xs text-muted-foreground">{formatDuration(node.durationMs)}</div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Input Data Section */}
      {execution.inputData && Object.keys(execution.inputData).length > 0 && (
        <CollapsibleSection
          title="Input Data"
          icon={<ArrowRight className="h-4 w-4" />}
          expanded={expandedSections.has('input')}
          onToggle={() => toggleSection('input')}
        >
          <pre className="text-xs bg-muted p-3 rounded overflow-x-auto max-h-48">
            {JSON.stringify(execution.inputData, null, 2)}
          </pre>
        </CollapsibleSection>
      )}

      {/* Output Data Section */}
      {execution.outputData && Object.keys(execution.outputData).length > 0 && (
        <CollapsibleSection
          title="Output Data"
          icon={<ArrowRight className="h-4 w-4 rotate-180" />}
          expanded={expandedSections.has('output')}
          onToggle={() => toggleSection('output')}
        >
          <pre className="text-xs bg-muted p-3 rounded overflow-x-auto max-h-48">
            {JSON.stringify(execution.outputData, null, 2)}
          </pre>
        </CollapsibleSection>
      )}
    </div>
  );
}

// Collapsible Section Helper
function CollapsibleSection({
  title,
  icon,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border rounded-lg">
      <button
        className="w-full flex items-center gap-2 p-3 hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        {icon}
        <span className="font-medium text-sm">{title}</span>
      </button>
      {expanded && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

// Main Execution Feed Component
export function ExecutionFeed() {
  const {
    executions,
    workflows,
    isLoading,
    error,
    filters,
    setFilters,
    refresh,
    selectedExecution,
    selectExecution,
    isLoadingExecution,
    loadMore,
  } = useN8nExecutions();

  const [isCollapsed, setIsCollapsed] = useState(false);

  if (isLoading && !executions) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48 mt-1" />
        </CardHeader>
        <CardContent>
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full mb-2" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader
          className={isCollapsed ? 'cursor-pointer hover:bg-muted/50' : ''}
          onClick={() => isCollapsed && setIsCollapsed(false)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
              <Play className="h-5 w-5" />
              <CardTitle className="flex items-center gap-2">
                n8n Executions
                {isCollapsed && executions && (
                  <Badge variant="secondary">{executions.total} executions</Badge>
                )}
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {!isCollapsed && (
                <Button variant="ghost" size="sm" onClick={() => setIsCollapsed(true)}>
                  Collapse
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  refresh();
                }}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          <CardDescription>
            {isCollapsed
              ? 'Click to expand execution feed'
              : 'Real-time feed of n8n workflow executions'}
          </CardDescription>
        </CardHeader>

        {!isCollapsed && (
          <CardContent>
            {error && (
              <div className="flex items-center gap-2 text-destructive mb-4">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {executions && (
              <>
                {/* Filters */}
                <ExecutionFilters
                  workflows={workflows}
                  filters={filters}
                  onFiltersChange={setFilters}
                />

                {/* Execution List */}
                <div className="border rounded-lg">
                  {executions.executions.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <Play className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No executions found</p>
                    </div>
                  ) : (
                    <>
                      {executions.executions.map((execution) => (
                        <ExecutionRow
                          key={execution.id}
                          execution={execution}
                          onClick={() => selectExecution(execution.id)}
                        />
                      ))}
                    </>
                  )}
                </div>

                {/* Load More */}
                {executions.hasMore && (
                  <div className="text-center mt-4">
                    <Button variant="outline" size="sm" onClick={loadMore}>
                      Load more
                    </Button>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
                  <span>Showing {executions.executions.length} of {executions.total} executions</span>
                  <span>Auto-refreshes every 10s</span>
                </div>
              </>
            )}
          </CardContent>
        )}
      </Card>

      {/* Execution Detail Dialog */}
      <Dialog
        open={!!selectedExecution || isLoadingExecution}
        onOpenChange={() => selectExecution(null)}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Execution Details</DialogTitle>
            <DialogDescription>View detailed information about this execution</DialogDescription>
          </DialogHeader>
          <ExecutionDetailPanel execution={selectedExecution} isLoading={isLoadingExecution} />
        </DialogContent>
      </Dialog>
    </>
  );
}
