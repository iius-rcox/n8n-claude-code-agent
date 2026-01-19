import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { usePipeline } from '@/hooks/use-pipeline';
import {
  PipelineTask,
  PhaseColumn,
  TaskStatus,
  TaskPriority,
  PipelinePhase,
  TaskDetailResponse,
} from '@/services/api';
import {
  RefreshCw,
  AlertTriangle,
  Clock,
  User,
  GitBranch,
  ChevronRight,
  ChevronDown,
  FileText,
  ClipboardList,
  CheckCircle2,
  XCircle,
  Hourglass,
  Pause,
  Ban,
  Wifi,
  WifiOff,
} from 'lucide-react';

// Phase colors for the Kanban columns
const PHASE_COLORS: Record<PipelinePhase, string> = {
  intake: 'border-t-blue-500',
  planning: 'border-t-purple-500',
  implementation: 'border-t-green-500',
  verification: 'border-t-yellow-500',
  review: 'border-t-orange-500',
  release: 'border-t-emerald-500',
};

// Status badge variants
function getStatusBadge(status: TaskStatus): {
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  icon: React.ReactNode;
  label: string;
} {
  switch (status) {
    case 'in_progress':
      return { variant: 'default', icon: <Hourglass className="h-3 w-3" />, label: 'In Progress' };
    case 'completed':
      return { variant: 'secondary', icon: <CheckCircle2 className="h-3 w-3" />, label: 'Completed' };
    case 'failed':
      return { variant: 'destructive', icon: <XCircle className="h-3 w-3" />, label: 'Failed' };
    case 'paused':
      return { variant: 'outline', icon: <Pause className="h-3 w-3" />, label: 'Paused' };
    case 'waiting_human':
      return { variant: 'outline', icon: <User className="h-3 w-3" />, label: 'Waiting' };
    case 'cancelled':
      return { variant: 'outline', icon: <Ban className="h-3 w-3" />, label: 'Cancelled' };
    case 'stuck':
      return { variant: 'destructive', icon: <AlertTriangle className="h-3 w-3" />, label: 'Stuck' };
    default:
      return { variant: 'outline', icon: <Clock className="h-3 w-3" />, label: 'Pending' };
  }
}

// Priority badge
function getPriorityBadge(priority?: TaskPriority): {
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  label: string;
} | null {
  if (!priority || priority === 'normal') return null;
  switch (priority) {
    case 'critical':
      return { variant: 'destructive', label: 'Critical' };
    case 'high':
      return { variant: 'default', label: 'High' };
    case 'low':
      return { variant: 'outline', label: 'Low' };
    default:
      return null;
  }
}

// Format duration in human-readable form
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

// Task Card Component
function TaskCard({
  task,
  onClick,
}: {
  task: PipelineTask;
  onClick: () => void;
}) {
  const statusInfo = getStatusBadge(task.status);
  const priorityInfo = getPriorityBadge(task.priority);

  return (
    <div
      className={`p-3 bg-card rounded-lg border shadow-sm cursor-pointer hover:shadow-md transition-shadow ${
        task.isStuck ? 'border-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/20' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" title={task.title}>
            {task.title}
          </p>
          <p className="text-xs text-muted-foreground">{task.taskId}</p>
        </div>
        {task.isStuck && (
          <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
        )}
      </div>

      <div className="flex flex-wrap gap-1 mb-2">
        <Badge variant={statusInfo.variant} className="text-xs gap-1">
          {statusInfo.icon}
          {statusInfo.label}
        </Badge>
        {priorityInfo && (
          <Badge variant={priorityInfo.variant} className="text-xs">
            {priorityInfo.label}
          </Badge>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatDuration(task.timeInPhase)}
        </div>
        {task.agent && (
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {task.agent}
          </div>
        )}
        {task.retryCount > 0 && (
          <div className="flex items-center gap-1 text-yellow-500">
            <RefreshCw className="h-3 w-3" />
            {task.retryCount}
          </div>
        )}
      </div>
    </div>
  );
}

// Phase Column Component
function PhaseColumnComponent({
  column,
  onTaskClick,
}: {
  column: PhaseColumn;
  onTaskClick: (taskId: string) => void;
}) {
  const stuckCount = column.tasks.filter((t) => t.isStuck).length;

  return (
    <div className={`flex-1 min-w-[200px] max-w-[280px] border-t-4 ${PHASE_COLORS[column.phase]}`}>
      <Card className="h-full">
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">{column.displayName}</CardTitle>
            <div className="flex items-center gap-1">
              {stuckCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {stuckCount} stuck
                </Badge>
              )}
              <Badge variant="secondary" className="text-xs">
                {column.tasks.length}
              </Badge>
            </div>
          </div>
          <CardDescription className="text-xs">Agent: {column.agent}</CardDescription>
        </CardHeader>
        <CardContent className="px-3 pb-3 pt-0 space-y-2 overflow-y-auto max-h-[500px]">
          {column.tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No tasks</p>
          ) : (
            column.tasks.map((task) => (
              <TaskCard key={task.taskId} task={task} onClick={() => onTaskClick(task.taskId)} />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Task Detail Panel Component
function TaskDetailPanel({
  task,
  isLoading,
}: {
  task: TaskDetailResponse | null;
  isLoading: boolean;
}) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['info', 'history'])
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
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Task not found
      </div>
    );
  }

  const statusInfo = getStatusBadge(task.task.status);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold">{task.task.title}</h3>
        <p className="text-sm text-muted-foreground">{task.task.taskId}</p>
        <div className="flex flex-wrap gap-2 mt-2">
          <Badge variant={statusInfo.variant} className="gap-1">
            {statusInfo.icon}
            {statusInfo.label}
          </Badge>
          <Badge variant="outline">{task.task.phase}</Badge>
          {task.task.isStuck && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              Stuck
            </Badge>
          )}
        </div>
      </div>

      {/* Info Section */}
      <CollapsibleSection
        title="Task Info"
        icon={<ClipboardList className="h-4 w-4" />}
        expanded={expandedSections.has('info')}
        onToggle={() => toggleSection('info')}
      >
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Time in Phase:</span>
            <span className="ml-2">{formatDuration(task.task.timeInPhase)}</span>
          </div>
          {task.task.agent && (
            <div>
              <span className="text-muted-foreground">Agent:</span>
              <span className="ml-2">{task.task.agent}</span>
            </div>
          )}
          {task.task.repository && (
            <div className="col-span-2">
              <span className="text-muted-foreground">Repository:</span>
              <span className="ml-2 flex items-center gap-1">
                <GitBranch className="h-3 w-3" />
                {task.task.repository}
              </span>
            </div>
          )}
          <div>
            <span className="text-muted-foreground">Retry Count:</span>
            <span className="ml-2">{task.task.retryCount}</span>
          </div>
          {task.task.createdAt && (
            <div>
              <span className="text-muted-foreground">Created:</span>
              <span className="ml-2">{new Date(task.task.createdAt).toLocaleString()}</span>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* Artifacts Section */}
      {(task.artifacts.spec || task.artifacts.plan) && (
        <CollapsibleSection
          title="Artifacts"
          icon={<FileText className="h-4 w-4" />}
          expanded={expandedSections.has('artifacts')}
          onToggle={() => toggleSection('artifacts')}
        >
          <div className="space-y-2">
            {task.artifacts.spec && (
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-blue-500" />
                <span>spec.md</span>
                <span className="text-muted-foreground text-xs">
                  {new Date(task.artifacts.spec.lastModified).toLocaleString()}
                </span>
              </div>
            )}
            {task.artifacts.plan && (
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-purple-500" />
                <span>plan.md</span>
                <span className="text-muted-foreground text-xs">
                  {new Date(task.artifacts.plan.lastModified).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Phase History Section */}
      {task.phaseHistory.length > 0 && (
        <CollapsibleSection
          title="Phase History"
          icon={<Clock className="h-4 w-4" />}
          expanded={expandedSections.has('history')}
          onToggle={() => toggleSection('history')}
        >
          <div className="space-y-2">
            {task.phaseHistory.map((entry, i) => {
              const outcome = entry.outcome || entry.status;
              const dateStr = entry.ended_at || entry.started_at || entry.timestamp;
              const displayDate = dateStr ? new Date(dateStr).toLocaleString() : 'Unknown';
              return (
                <div key={i} className="flex items-start gap-2 text-sm">
                  {outcome === 'completed' ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                  ) : outcome === 'failed' ? (
                    <XCircle className="h-4 w-4 text-red-500 mt-0.5" />
                  ) : outcome === 'cancelled' ? (
                    <Ban className="h-4 w-4 text-orange-500 mt-0.5" />
                  ) : (
                    <Hourglass className="h-4 w-4 text-blue-500 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="font-medium">{entry.phase}</div>
                    <div className="text-xs text-muted-foreground">
                      {displayDate}
                      {entry.duration_ms && ` • ${formatDuration(entry.duration_ms)}`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CollapsibleSection>
      )}

      {/* Error History Section */}
      {task.errorHistory.length > 0 && (
        <CollapsibleSection
          title="Error History"
          icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
          expanded={expandedSections.has('errors')}
          onToggle={() => toggleSection('errors')}
        >
          <div className="space-y-3">
            {task.errorHistory.map((entry, i) => (
              <div key={i} className="text-sm border-l-2 border-red-500 pl-3">
                <div className="font-medium text-red-500">
                  {entry.phase} (Attempt {entry.attempt})
                </div>
                <div className="text-muted-foreground">{entry.error}</div>
                {entry.resolution && (
                  <div className="text-green-600 mt-1">✓ {entry.resolution}</div>
                )}
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(entry.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
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

// Main Pipeline Board Component
export function PipelineBoard() {
  const { pipeline, isLoading, error, refresh, selectedTask, selectTask, isLoadingTask, cancelTask, isCancelling, isSocketConnected } =
    usePipeline();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const handleCancelTask = async () => {
    if (!selectedTask) return;
    setCancelError(null);
    const result = await cancelTask(selectedTask.task.taskId);
    if (!result.success) {
      setCancelError(result.message);
    }
  };

  if (isLoading && !pipeline) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48 mt-1" />
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 overflow-x-auto">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-64 w-[220px] flex-shrink-0" />
            ))}
          </div>
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
              <ClipboardList className="h-5 w-5" />
              <CardTitle className="flex items-center gap-2">
                Task Pipeline
                {isCollapsed && pipeline && (
                  <>
                    <Badge variant="secondary">{pipeline.summary.totalTasks} tasks</Badge>
                    {pipeline.summary.stuckTasks > 0 && (
                      <Badge variant="destructive">{pipeline.summary.stuckTasks} stuck</Badge>
                    )}
                  </>
                )}
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {/* Real-time connection indicator */}
              <div
                className={`flex items-center gap-1 text-xs ${
                  isSocketConnected ? 'text-green-500' : 'text-muted-foreground'
                }`}
                title={isSocketConnected ? 'Real-time updates active' : 'Connecting to real-time updates...'}
              >
                {isSocketConnected ? (
                  <Wifi className="h-3 w-3" />
                ) : (
                  <WifiOff className="h-3 w-3" />
                )}
                <span className="hidden sm:inline">{isSocketConnected ? 'Live' : 'Offline'}</span>
              </div>
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
              ? 'Click to expand pipeline view'
              : 'Kanban view of tasks flowing through development phases'}
          </CardDescription>
        </CardHeader>

        {!isCollapsed && (
          <CardContent>
            {error && (
              <div className="flex items-center gap-2 text-destructive mb-4">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {pipeline && (
              <>
                {/* Summary Stats */}
                <div className="flex items-center gap-4 mb-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Total:</span>{' '}
                    <span className="font-medium">{pipeline.summary.totalTasks}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Active:</span>{' '}
                    <span className="font-medium">{pipeline.summary.activeTasks}</span>
                  </div>
                  {pipeline.summary.stuckTasks > 0 && (
                    <div className="text-yellow-500">
                      <span>Stuck:</span>{' '}
                      <span className="font-medium">{pipeline.summary.stuckTasks}</span>
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground ml-auto">
                    Last updated: {new Date(pipeline.timestamp).toLocaleTimeString()}
                  </div>
                </div>

                {/* Kanban Board */}
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {pipeline.columns.map((column) => (
                    <PhaseColumnComponent
                      key={column.phase}
                      column={column}
                      onTaskClick={selectTask}
                    />
                  ))}
                </div>
              </>
            )}
          </CardContent>
        )}
      </Card>

      {/* Task Detail Dialog */}
      <Dialog open={!!selectedTask || isLoadingTask} onOpenChange={() => {
        selectTask(null);
        setCancelError(null);
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Task Details</DialogTitle>
            <DialogDescription>
              View detailed information about the selected task
            </DialogDescription>
          </DialogHeader>
          <TaskDetailPanel
            task={selectedTask}
            isLoading={isLoadingTask}
          />
          {/* Cancel Button Section */}
          {selectedTask && !isLoadingTask && (
            <div className="mt-4 pt-4 border-t">
              {cancelError && (
                <div className="flex items-center gap-2 text-destructive mb-3 text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  <span>{cancelError}</span>
                </div>
              )}
              {selectedTask.task.status !== 'completed' && selectedTask.task.status !== 'cancelled' && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Cancel this task if it's no longer needed
                  </p>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleCancelTask}
                    disabled={isCancelling}
                    className="gap-2"
                  >
                    {isCancelling ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Cancelling...
                      </>
                    ) : (
                      <>
                        <Ban className="h-4 w-4" />
                        Cancel Task
                      </>
                    )}
                  </Button>
                </div>
              )}
              {(selectedTask.task.status === 'completed' || selectedTask.task.status === 'cancelled') && (
                <p className="text-sm text-muted-foreground text-center">
                  This task is {selectedTask.task.status} and cannot be modified
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
