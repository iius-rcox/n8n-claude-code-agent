import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Inbox,
  Lightbulb,
  Code2,
  TestTube,
  Eye,
  Rocket,
  ArrowRight,
} from 'lucide-react';

// Phase configuration with colors, icons, and styling
const PHASE_CONFIG: Record<PipelinePhase, {
  color: string;
  bgColor: string;
  borderColor: string;
  glowColor: string;
  icon: React.ReactNode;
  gradient: string;
}> = {
  intake: {
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    glowColor: 'shadow-blue-500/20',
    icon: <Inbox className="h-4 w-4" />,
    gradient: 'from-blue-500/20 to-blue-600/5',
  },
  planning: {
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    glowColor: 'shadow-purple-500/20',
    icon: <Lightbulb className="h-4 w-4" />,
    gradient: 'from-purple-500/20 to-purple-600/5',
  },
  implementation: {
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    glowColor: 'shadow-green-500/20',
    icon: <Code2 className="h-4 w-4" />,
    gradient: 'from-green-500/20 to-green-600/5',
  },
  verification: {
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    glowColor: 'shadow-yellow-500/20',
    icon: <TestTube className="h-4 w-4" />,
    gradient: 'from-yellow-500/20 to-yellow-600/5',
  },
  review: {
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    glowColor: 'shadow-orange-500/20',
    icon: <Eye className="h-4 w-4" />,
    gradient: 'from-orange-500/20 to-orange-600/5',
  },
  release: {
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    glowColor: 'shadow-emerald-500/20',
    icon: <Rocket className="h-4 w-4" />,
    gradient: 'from-emerald-500/20 to-emerald-600/5',
  },
};

// Animation variants
const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.3, ease: 'easeOut' as const }
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.2 }
  },
};

const pulseVariants = {
  pulse: {
    scale: [1, 1.05, 1],
    opacity: [0.7, 1, 0.7],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut' as const,
    },
  },
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

// Visual Status Indicator Component
function StatusIndicator({ status, isStuck }: { status: TaskStatus; isStuck: boolean }) {
  const getStatusColor = () => {
    if (isStuck) return 'bg-yellow-500';
    switch (status) {
      case 'in_progress':
        return 'bg-cyan-500';
      case 'completed':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      case 'paused':
        return 'bg-gray-500';
      case 'waiting_human':
        return 'bg-purple-500';
      case 'cancelled':
        return 'bg-orange-500';
      default:
        return 'bg-muted-foreground';
    }
  };

  const shouldPulse = status === 'in_progress' && !isStuck;

  return (
    <div className="relative">
      <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
      {shouldPulse && (
        <motion.div
          className={`absolute inset-0 w-2 h-2 rounded-full ${getStatusColor()}`}
          variants={pulseVariants}
          animate="pulse"
        />
      )}
    </div>
  );
}

// Task Card Component
function TaskCard({
  task,
  onClick,
  phase,
}: {
  task: PipelineTask;
  onClick: () => void;
  phase: PipelinePhase;
}) {
  const statusInfo = getStatusBadge(task.status);
  const priorityInfo = getPriorityBadge(task.priority);
  const phaseConfig = PHASE_CONFIG[phase];

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout
      className={`
        relative p-3 rounded-lg border cursor-pointer
        bg-card/80 backdrop-blur-sm
        hover:bg-card hover:shadow-lg hover:shadow-${phase === 'implementation' ? 'green' : 'cyan'}-500/10
        transition-all duration-200
        ${task.isStuck ? 'border-yellow-500/50 ring-1 ring-yellow-500/30' : 'border-border/50'}
      `}
      onClick={onClick}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Stuck warning glow */}
      {task.isStuck && (
        <div className="absolute inset-0 rounded-lg bg-yellow-500/5 animate-pulse" />
      )}

      <div className="relative">
        {/* Header with status indicator */}
        <div className="flex items-start gap-2 mb-2">
          <StatusIndicator status={task.status} isStuck={task.isStuck} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate leading-tight" title={task.title}>
              {task.title}
            </p>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{task.taskId}</p>
          </div>
          {task.isStuck && (
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
            >
              <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
            </motion.div>
          )}
        </div>

        {/* Status and priority badges */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          <div className={`
            inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
            ${phaseConfig.bgColor} ${phaseConfig.color}
          `}>
            {statusInfo.icon}
            {statusInfo.label}
          </div>
          {priorityInfo && priorityInfo.label === 'Critical' && (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
              {priorityInfo.label}
            </div>
          )}
          {priorityInfo && priorityInfo.label === 'High' && (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-500/20 text-orange-400">
              {priorityInfo.label}
            </div>
          )}
        </div>

        {/* Footer metrics */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span className="font-mono">{formatDuration(task.timeInPhase)}</span>
          </div>
          {task.agent && (
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span className="truncate max-w-[60px]">{task.agent}</span>
            </div>
          )}
          {task.retryCount > 0 && (
            <div className="flex items-center gap-1 text-yellow-500">
              <RefreshCw className="h-3 w-3" />
              <span>{task.retryCount}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// Pipeline Connector Component
function PipelineConnector({ hasActivity }: { hasActivity: boolean }) {
  return (
    <div className="flex items-center justify-center w-8 flex-shrink-0">
      <div className="relative h-full flex flex-col items-center justify-center">
        {/* Connector line */}
        <div className="w-px h-full bg-border/30 absolute" />
        {/* Arrow */}
        <div className="relative z-10 bg-background p-1">
          <ArrowRight className="h-4 w-4 text-muted-foreground/50" />
        </div>
        {/* Animated flow dot when active */}
        {hasActivity && (
          <motion.div
            className="absolute w-1.5 h-1.5 rounded-full bg-cyan-500"
            initial={{ y: -40, opacity: 0 }}
            animate={{
              y: [- 40, 40],
              opacity: [0, 1, 1, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        )}
      </div>
    </div>
  );
}

// Phase Column Component
function PhaseColumnComponent({
  column,
  onTaskClick,
  isLast,
}: {
  column: PhaseColumn;
  onTaskClick: (taskId: string) => void;
  isLast?: boolean;
}) {
  const stuckCount = column.tasks.filter((t) => t.isStuck).length;
  const activeCount = column.tasks.filter((t) => t.status === 'in_progress').length;
  const phaseConfig = PHASE_CONFIG[column.phase];

  return (
    <>
      <motion.div
        className="flex-1 min-w-[220px] max-w-[280px]"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Phase Header */}
        <div className={`
          relative rounded-t-lg px-4 py-3
          bg-gradient-to-b ${phaseConfig.gradient}
          border-t-2 ${phaseConfig.borderColor.replace('border-', 'border-t-').replace('/30', '')}
        `}>
          {/* Active indicator glow */}
          {activeCount > 0 && (
            <motion.div
              className={`absolute inset-0 rounded-t-lg ${phaseConfig.bgColor}`}
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}

          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`${phaseConfig.color}`}>
                {phaseConfig.icon}
              </div>
              <div>
                <h3 className={`text-sm font-semibold ${phaseConfig.color}`}>
                  {column.displayName}
                </h3>
                <p className="text-xs text-muted-foreground">{column.agent}</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {stuckCount > 0 && (
                <motion.div
                  className="px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-500/20 text-yellow-400"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  {stuckCount}!
                </motion.div>
              )}
              <div className={`
                px-2 py-0.5 rounded-full text-xs font-mono font-medium
                ${phaseConfig.bgColor} ${phaseConfig.color}
              `}>
                {column.tasks.length}
              </div>
            </div>
          </div>
        </div>

        {/* Tasks Container */}
        <div className={`
          rounded-b-lg border border-t-0 ${phaseConfig.borderColor}
          bg-card/30 backdrop-blur-sm
          min-h-[200px] max-h-[500px] overflow-y-auto
        `}>
          <div className="p-2 space-y-2">
            <AnimatePresence mode="popLayout">
              {column.tasks.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-8 text-muted-foreground"
                >
                  <div className={`${phaseConfig.color} opacity-20 mb-2`}>
                    {phaseConfig.icon}
                  </div>
                  <p className="text-xs">No tasks</p>
                </motion.div>
              ) : (
                column.tasks.map((task) => (
                  <TaskCard
                    key={task.taskId}
                    task={task}
                    onClick={() => onTaskClick(task.taskId)}
                    phase={column.phase}
                  />
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Connector to next phase */}
      {!isLast && (
        <PipelineConnector hasActivity={activeCount > 0} />
      )}
    </>
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
                <ClipboardList className="h-5 w-5 text-cyan-400" />
                {pipeline && pipeline.summary.activeTasks > 0 && (
                  <motion.div
                    className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                )}
              </div>
              <div>
                <CardTitle className="flex items-center gap-3 text-base">
                  <span>Task Pipeline</span>
                  {isCollapsed && pipeline && (
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-muted text-muted-foreground">
                        {pipeline.summary.totalTasks}
                      </span>
                      {pipeline.summary.stuckTasks > 0 && (
                        <motion.span
                          className="px-2 py-0.5 rounded-full text-xs font-mono bg-yellow-500/20 text-yellow-400"
                          animate={{ opacity: [1, 0.7, 1] }}
                          transition={{ duration: 1, repeat: Infinity }}
                        >
                          {pipeline.summary.stuckTasks} stuck
                        </motion.span>
                      )}
                    </div>
                  )}
                </CardTitle>
                {!isCollapsed && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Visual flow of tasks through development phases
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Real-time connection indicator */}
              <div
                className={`
                  flex items-center gap-1.5 px-2 py-1 rounded-full text-xs
                  ${isSocketConnected
                    ? 'bg-green-500/10 text-green-400'
                    : 'bg-muted text-muted-foreground'
                  }
                `}
                title={isSocketConnected ? 'Real-time updates active' : 'Connecting to real-time updates...'}
              >
                {isSocketConnected ? (
                  <>
                    <motion.div
                      className="w-1.5 h-1.5 rounded-full bg-green-500"
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                    <Wifi className="h-3 w-3" />
                    <span className="hidden sm:inline font-medium">Live</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3 w-3" />
                    <span className="hidden sm:inline">Offline</span>
                  </>
                )}
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
              <div className="flex items-center gap-2 text-destructive mb-4">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {pipeline && (
              <>
                {/* Summary Stats Bar */}
                <div className="flex items-center justify-between gap-4 mb-6 px-2">
                  <div className="flex items-center gap-4">
                    {/* Total Tasks */}
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
                        <span className="text-sm font-mono font-bold">{pipeline.summary.totalTasks}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">Total</span>
                    </div>

                    {/* Active Tasks */}
                    <div className="flex items-center gap-2">
                      <div className="relative w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                        <span className="text-sm font-mono font-bold text-cyan-400">{pipeline.summary.activeTasks}</span>
                        {pipeline.summary.activeTasks > 0 && (
                          <motion.div
                            className="absolute inset-0 rounded-lg border border-cyan-500/30"
                            animate={{ opacity: [0.3, 0.8, 0.3] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          />
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">Active</span>
                    </div>

                    {/* Stuck Tasks */}
                    {pipeline.summary.stuckTasks > 0 && (
                      <motion.div
                        className="flex items-center gap-2"
                        animate={{ x: [0, 2, 0] }}
                        transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
                      >
                        <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                          <span className="text-sm font-mono font-bold text-yellow-400">{pipeline.summary.stuckTasks}</span>
                        </div>
                        <span className="text-xs text-yellow-400">Stuck</span>
                      </motion.div>
                    )}
                  </div>

                  {/* Timestamp */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span className="font-mono">{new Date(pipeline.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>

                {/* Visual Pipeline Board */}
                <div className="flex items-stretch gap-0 overflow-x-auto pb-4 pt-2">
                  {pipeline.columns.map((column, index) => (
                    <PhaseColumnComponent
                      key={column.phase}
                      column={column}
                      onTaskClick={selectTask}
                      isLast={index === pipeline.columns.length - 1}
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
