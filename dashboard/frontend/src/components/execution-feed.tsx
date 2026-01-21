import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Zap,
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

// Timeline connector component
function TimelineConnector({ isLast, status }: { isLast: boolean; status: N8nExecutionStatus }) {
  const getConnectorColor = () => {
    switch (status) {
      case 'running': return 'bg-cyan-500';
      case 'success': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-muted-foreground/30';
    }
  };

  return (
    <div className="flex flex-col items-center w-8">
      {/* Dot */}
      <div className="relative">
        <div className={`w-3 h-3 rounded-full ${getConnectorColor()} z-10`} />
        {status === 'running' && (
          <motion.div
            className="absolute inset-0 rounded-full bg-cyan-500"
            animate={{ scale: [1, 1.8, 1], opacity: [0.8, 0, 0.8] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
      </div>
      {/* Line */}
      {!isLast && (
        <div className="w-px flex-1 bg-border/50 min-h-[40px]" />
      )}
    </div>
  );
}

// Execution Row Component
function ExecutionRow({
  execution,
  onClick,
  isLast,
}: {
  execution: N8nExecution;
  onClick: () => void;
  isLast?: boolean;
}) {
  const statusInfo = getStatusBadge(execution.status);

  return (
    <motion.div
      className="flex items-stretch gap-3 group"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Timeline connector */}
      <TimelineConnector isLast={!!isLast} status={execution.status} />

      {/* Execution card */}
      <motion.div
        className={`
          flex-1 p-3 rounded-lg border cursor-pointer mb-2
          bg-card/50 backdrop-blur-sm
          hover:bg-card hover:shadow-md
          transition-all duration-200
          ${execution.status === 'running' ? 'border-cyan-500/30 ring-1 ring-cyan-500/20' : 'border-border/50'}
          ${execution.status === 'error' ? 'border-red-500/30' : ''}
        `}
        onClick={onClick}
        whileHover={{ scale: 1.01, x: 4 }}
        whileTap={{ scale: 0.99 }}
      >
        <div className="flex items-center gap-4">
          {/* Workflow info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Workflow className="h-4 w-4 text-cyan-400" />
              <span className="font-medium truncate">{execution.workflowName}</span>
              {execution.status === 'running' && (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                >
                  <Zap className="h-3 w-3 text-cyan-400" />
                </motion.div>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {execution.taskId && (
                <span className="font-mono bg-muted/50 px-1.5 py-0.5 rounded">
                  {execution.taskId}
                </span>
              )}
              {execution.phase && (
                <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">
                  {execution.phase}
                </span>
              )}
            </div>
          </div>

          {/* Status indicator */}
          <div className={`
            flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
            ${execution.status === 'running' ? 'bg-cyan-500/10 text-cyan-400' : ''}
            ${execution.status === 'success' ? 'bg-green-500/10 text-green-400' : ''}
            ${execution.status === 'error' ? 'bg-red-500/10 text-red-400' : ''}
            ${execution.status === 'waiting' ? 'bg-yellow-500/10 text-yellow-400' : ''}
            ${execution.status === 'canceled' ? 'bg-muted text-muted-foreground' : ''}
          `}>
            {statusInfo.icon}
            {statusInfo.label}
          </div>

          {/* Duration */}
          <div className="text-xs font-mono text-muted-foreground w-16 text-right">
            {formatDuration(execution.durationMs)}
          </div>

          {/* Time */}
          <div className="text-xs text-muted-foreground w-20 text-right">
            {formatRelativeTime(execution.startedAt)}
          </div>

          {/* Expand indicator */}
          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </motion.div>
    </motion.div>
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

interface ExecutionFeedProps {
  forceState?: 'expanded' | 'collapsed' | null;
}

// Main Execution Feed Component
export function ExecutionFeed({ forceState }: ExecutionFeedProps) {
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

  // Handle force state from parent (global toggle)
  useEffect(() => {
    if (forceState === 'expanded') {
      setIsCollapsed(false);
    } else if (forceState === 'collapsed') {
      setIsCollapsed(true);
    }
  }, [forceState]);

  // Count running executions
  const runningCount = executions?.executions.filter(e => e.status === 'running').length || 0;

  if (isLoading && !executions) {
    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
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
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardHeader
          className={`${isCollapsed ? 'cursor-pointer hover:bg-muted/50' : ''} border-b border-border/30`}
          onClick={() => isCollapsed && setIsCollapsed(false)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
              <div className="relative">
                <Play className="h-5 w-5 text-orange-400" />
                {runningCount > 0 && (
                  <motion.div
                    className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-cyan-500 rounded-full"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                )}
              </div>
              <div>
                <CardTitle className="flex items-center gap-3 text-base">
                  <span>n8n Executions</span>
                  {isCollapsed && executions && (
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-muted text-muted-foreground">
                        {executions.total}
                      </span>
                      {runningCount > 0 && (
                        <motion.span
                          className="px-2 py-0.5 rounded-full text-xs font-mono bg-cyan-500/20 text-cyan-400"
                          animate={{ opacity: [1, 0.7, 1] }}
                          transition={{ duration: 1, repeat: Infinity }}
                        >
                          {runningCount} running
                        </motion.span>
                      )}
                    </div>
                  )}
                </CardTitle>
                {!isCollapsed && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Real-time timeline of workflow executions
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Auto-refresh indicator */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <motion.div
                  className="w-1.5 h-1.5 rounded-full bg-green-500"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <span className="hidden sm:inline">Auto-refresh</span>
              </div>
              {!isCollapsed && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsCollapsed(true)}
                  className="text-xs hover:bg-muted"
                >
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
                className="hover:bg-muted"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>

        {!isCollapsed && (
          <CardContent>
            {error && (
              <div className="border border-amber-200 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-2">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">
                    {error.toLowerCase().includes('not configured')
                      ? 'n8n Integration Not Configured'
                      : 'Error Loading Executions'}
                  </span>
                </div>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {error.toLowerCase().includes('not configured')
                    ? 'An n8n API key is required to display workflow executions. Generate an API key in n8n Settings → API, then add it to the ops-dashboard configuration.'
                    : error}
                </p>
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

                {/* Timeline Execution List */}
                <div className="py-4">
                  {executions.executions.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center justify-center py-12 text-muted-foreground"
                    >
                      <Play className="h-12 w-12 mb-3 opacity-20" />
                      <p className="text-sm">No executions found</p>
                      <p className="text-xs mt-1">Workflows will appear here when they run</p>
                    </motion.div>
                  ) : (
                    <AnimatePresence mode="popLayout">
                      {executions.executions.map((execution, index) => (
                        <ExecutionRow
                          key={execution.id}
                          execution={execution}
                          onClick={() => selectExecution(execution.id)}
                          isLast={index === executions.executions.length - 1}
                        />
                      ))}
                    </AnimatePresence>
                  )}
                </div>

                {/* Load More */}
                {executions.hasMore && (
                  <div className="text-center py-4 border-t border-border/30">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadMore}
                      className="border-border/50 hover:bg-muted"
                    >
                      Load more executions
                    </Button>
                  </div>
                )}

                {/* Footer Stats */}
                <div className="flex items-center justify-between px-2 py-3 border-t border-border/30 text-xs text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <span>
                      Showing <span className="font-mono">{executions.executions.length}</span> of <span className="font-mono">{executions.total}</span>
                    </span>
                    {runningCount > 0 && (
                      <span className="text-cyan-400">
                        <span className="font-mono">{runningCount}</span> running
                      </span>
                    )}
                  </div>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    10s refresh
                  </span>
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
