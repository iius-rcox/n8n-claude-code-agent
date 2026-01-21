import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Key,
  Server,
  Play,
  Workflow,
  Shield,
} from 'lucide-react';

// Activity types
type ActivityType = 'health' | 'auth' | 'cronjob' | 'execution' | 'pipeline';
type ActivityStatus = 'success' | 'error' | 'warning' | 'info';

interface ActivityEvent {
  id: string;
  type: ActivityType;
  status: ActivityStatus;
  title: string;
  description: string;
  timestamp: Date;
  metadata?: Record<string, string | number>;
}

// Get icon and colors for activity type
function getActivityConfig(type: ActivityType, status: ActivityStatus) {
  const icons: Record<ActivityType, React.ReactNode> = {
    health: <Server className="h-4 w-4" />,
    auth: <Key className="h-4 w-4" />,
    cronjob: <Clock className="h-4 w-4" />,
    execution: <Play className="h-4 w-4" />,
    pipeline: <Workflow className="h-4 w-4" />,
  };

  const statusColors: Record<ActivityStatus, { bg: string; text: string; border: string; statusIcon: React.ReactNode }> = {
    success: {
      bg: 'bg-green-500/10',
      text: 'text-green-400',
      border: 'border-green-500/30',
      statusIcon: <CheckCircle2 className="h-3 w-3 text-green-500" />,
    },
    error: {
      bg: 'bg-red-500/10',
      text: 'text-red-400',
      border: 'border-red-500/30',
      statusIcon: <XCircle className="h-3 w-3 text-red-500" />,
    },
    warning: {
      bg: 'bg-yellow-500/10',
      text: 'text-yellow-400',
      border: 'border-yellow-500/30',
      statusIcon: <AlertTriangle className="h-3 w-3 text-yellow-500" />,
    },
    info: {
      bg: 'bg-cyan-500/10',
      text: 'text-cyan-400',
      border: 'border-cyan-500/30',
      statusIcon: <Shield className="h-3 w-3 text-cyan-500" />,
    },
  };

  return {
    typeIcon: icons[type],
    ...statusColors[status],
  };
}

// Format relative time
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// Activity Event Component
function ActivityEventRow({ event }: { event: ActivityEvent }) {
  const config = getActivityConfig(event.type, event.status);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={`
        flex items-start gap-3 p-3 rounded-lg border
        ${config.bg} ${config.border}
        hover:bg-opacity-20 transition-colors
      `}
    >
      {/* Icon */}
      <div className={`mt-0.5 ${config.text}`}>
        {config.typeIcon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm truncate">{event.title}</span>
          {config.statusIcon}
        </div>
        <p className="text-xs text-muted-foreground">{event.description}</p>
        {event.metadata && (
          <div className="flex flex-wrap gap-1 mt-2">
            {Object.entries(event.metadata).map(([key, value]) => (
              <Badge key={key} variant="outline" className="text-[10px] px-1.5 py-0">
                {key}: {value}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Timestamp */}
      <div className="text-xs text-muted-foreground whitespace-nowrap">
        {formatRelativeTime(event.timestamp)}
      </div>
    </motion.div>
  );
}

interface ActivityTimelineProps {
  forceState?: 'expanded' | 'collapsed' | null;
}

export function ActivityTimeline({ forceState }: ActivityTimelineProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Handle force state from parent (global toggle)
  useEffect(() => {
    if (forceState === 'expanded') {
      setIsCollapsed(false);
    } else if (forceState === 'collapsed') {
      setIsCollapsed(true);
    }
  }, [forceState]);

  // Generate mock activities from system events (in production, this would come from an API)
  const generateActivities = useCallback(() => {
    const now = new Date();
    const mockActivities: ActivityEvent[] = [
      {
        id: '1',
        type: 'health',
        status: 'success',
        title: 'System Health Check',
        description: 'All components operational',
        timestamp: new Date(now.getTime() - 2 * 60 * 1000),
        metadata: { components: 5, healthy: 5 },
      },
      {
        id: '2',
        type: 'auth',
        status: 'success',
        title: 'Authentication Verified',
        description: 'Claude session tokens validated',
        timestamp: new Date(now.getTime() - 15 * 60 * 1000),
      },
      {
        id: '3',
        type: 'cronjob',
        status: 'success',
        title: 'Auth Watchdog Completed',
        description: 'Scheduled job executed successfully',
        timestamp: new Date(now.getTime() - 30 * 60 * 1000),
        metadata: { duration: '2.3s' },
      },
      {
        id: '4',
        type: 'execution',
        status: 'success',
        title: 'Agent Execution',
        description: 'Health check prompt completed',
        timestamp: new Date(now.getTime() - 45 * 60 * 1000),
        metadata: { exitCode: 0 },
      },
      {
        id: '5',
        type: 'pipeline',
        status: 'info',
        title: 'Pipeline Updated',
        description: 'Task moved to implementation phase',
        timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        metadata: { taskId: 'TASK-001' },
      },
    ];
    return mockActivities;
  }, []);

  const refresh = useCallback(() => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setActivities(generateActivities());
      setIsLoading(false);
    }, 500);
  }, [generateActivities]);

  // Initial load
  useEffect(() => {
    setActivities(generateActivities());
  }, [generateActivities]);

  // Count activities by status
  const statusCounts = activities.reduce((acc, activity) => {
    acc[activity.status] = (acc[activity.status] || 0) + 1;
    return acc;
  }, {} as Record<ActivityStatus, number>);

  return (
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
              <Activity className="h-5 w-5 text-indigo-400" />
              {activities.length > 0 && (
                <motion.div
                  className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-indigo-500 rounded-full"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
            </div>
            <div>
              <CardTitle className="flex items-center gap-3 text-base">
                <span>Activity Timeline</span>
                {isCollapsed && (
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-muted text-muted-foreground">
                      {activities.length} events
                    </span>
                    {statusCounts.error > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-red-500/20 text-red-400">
                        {statusCounts.error} errors
                      </span>
                    )}
                    {statusCounts.warning > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-yellow-500/20 text-yellow-400">
                        {statusCounts.warning} warnings
                      </span>
                    )}
                  </div>
                )}
              </CardTitle>
              {!isCollapsed && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Recent system events and changes
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isCollapsed && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCollapsed(true);
                }}
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

      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent className="pt-4">
              {activities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Activity className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm">No recent activity</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <AnimatePresence>
                    {activities.map((activity) => (
                      <ActivityEventRow key={activity.id} event={activity} />
                    ))}
                  </AnimatePresence>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/30 text-xs text-muted-foreground">
                <span>
                  Showing <span className="font-mono">{activities.length}</span> recent events
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  Last updated just now
                </span>
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
