import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useHealth } from '@/hooks/use-health';
import { HealthStatus, HealthDetails } from '@/services/api';
import {
  Activity,
  RefreshCw,
  Server,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Database,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

function formatStatus(status: HealthStatus['status']): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

// Visual status indicator with pulse animation
function StatusIndicator({ status }: { status: HealthStatus['status'] }) {
  const getStatusColor = () => {
    switch (status) {
      case 'healthy': return 'bg-green-500';
      case 'unhealthy': return 'bg-red-500';
      case 'warning': return 'bg-yellow-500';
      case 'pending': return 'bg-blue-500';
      default: return 'bg-muted-foreground';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'healthy': return <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />;
      case 'unhealthy': return <XCircle className="h-3.5 w-3.5 text-red-400" />;
      case 'warning': return <AlertTriangle className="h-3.5 w-3.5 text-yellow-400" />;
      case 'pending': return <Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin" />;
      default: return <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  return (
    <div className="relative flex items-center gap-2">
      <div className="relative">
        <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
        {status === 'healthy' && (
          <motion.div
            className={`absolute inset-0 w-2 h-2 rounded-full ${getStatusColor()}`}
            animate={{ scale: [1, 1.5, 1], opacity: [0.8, 0, 0.8] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
      </div>
      {getStatusIcon()}
    </div>
  );
}

function ComponentStatusItem({
  item,
  expanded,
  onToggle,
}: {
  item: HealthStatus;
  expanded: boolean;
  onToggle: () => void;
}) {
  const details = item.details || {};

  const renderDetails = (details: HealthDetails, component: HealthStatus['component']) => {
    switch (component) {
      case 'pod':
        return (
          <div className="text-xs text-muted-foreground space-y-1 mt-2 pl-6">
            <div>Phase: {details.phase || 'Unknown'}</div>
            {details.readyContainers !== undefined && (
              <div>
                Containers: {details.readyContainers}/{details.totalContainers}
              </div>
            )}
            {details.restartCount !== undefined && details.restartCount > 0 && (
              <div>Restarts: {details.restartCount}</div>
            )}
            {details.lastRestartTime && (
              <div>Last restart: {new Date(details.lastRestartTime).toLocaleString()}</div>
            )}
          </div>
        );
      case 'auth':
        return (
          <div className="text-xs text-muted-foreground space-y-1 mt-2 pl-6">
            <div>Authenticated: {details.authenticated ? 'Yes' : 'No'}</div>
            {details.exitCode !== undefined && <div>Exit code: {details.exitCode}</div>}
            {details.message && <div>Message: {details.message}</div>}
          </div>
        );
      case 'cronjob':
        return (
          <div className="text-xs text-muted-foreground space-y-1 mt-2 pl-6">
            {details.schedule && <div>Schedule: {details.schedule}</div>}
            {details.lastSuccessfulTime && (
              <div>Last success: {new Date(details.lastSuccessfulTime).toLocaleString()}</div>
            )}
            {details.activeJobs !== undefined && <div>Active jobs: {details.activeJobs}</div>}
          </div>
        );
      case 'storage':
        return (
          <div className="text-xs text-muted-foreground space-y-1 mt-2 pl-6">
            {details.account && <div>Account: {details.account}</div>}
            {details.containers && details.containers.length > 0 && (
              <div>
                Containers: {details.accessibleContainers}/{details.containers.length}
              </div>
            )}
            {details.containers && (
              <div className="flex flex-wrap gap-1 mt-1">
                {details.containers.slice(0, 6).map((c) => (
                  <Badge key={c} variant="outline" className="text-xs">
                    {c}
                  </Badge>
                ))}
                {details.containers.length > 6 && (
                  <Badge variant="outline" className="text-xs">
                    +{details.containers.length - 6} more
                  </Badge>
                )}
              </div>
            )}
            {details.error && <div className="text-destructive">Error: {details.error}</div>}
          </div>
        );
      case 'n8n':
        return (
          <div className="text-xs text-muted-foreground space-y-1 mt-2 pl-6">
            {details.version && <div>Version: {details.version}</div>}
            {details.activeWorkflows !== undefined && (
              <div>Active workflows: {details.activeWorkflows}</div>
            )}
            {details.recentExecutions !== undefined && (
              <div>Recent executions: {details.recentExecutions}</div>
            )}
            {details.error && <div className="text-destructive">Error: {details.error}</div>}
          </div>
        );
      default:
        return null;
    }
  };

  const getStatusStyles = () => {
    switch (item.status) {
      case 'healthy': return 'border-green-500/20 bg-green-500/5';
      case 'unhealthy': return 'border-red-500/20 bg-red-500/5';
      case 'warning': return 'border-yellow-500/20 bg-yellow-500/5';
      case 'pending': return 'border-blue-500/20 bg-blue-500/5';
      default: return 'border-border/50 bg-muted/20';
    }
  };

  return (
    <motion.div
      className={`rounded-lg border ${getStatusStyles()} overflow-hidden`}
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div
        className="flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors px-3 py-2"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          {expanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )}
          <StatusIndicator status={item.status} />
          <div>
            <span className="text-sm font-medium">{item.name}</span>
          </div>
        </div>
        <span className={`
          px-2 py-0.5 rounded-full text-xs font-medium
          ${item.status === 'healthy' ? 'bg-green-500/10 text-green-400' : ''}
          ${item.status === 'unhealthy' ? 'bg-red-500/10 text-red-400' : ''}
          ${item.status === 'warning' ? 'bg-yellow-500/10 text-yellow-400' : ''}
          ${item.status === 'pending' ? 'bg-blue-500/10 text-blue-400' : ''}
          ${item.status === 'unknown' ? 'bg-muted text-muted-foreground' : ''}
        `}>
          {formatStatus(item.status)}
        </span>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="px-3 pb-3"
          >
            {renderDetails(details, item.component)}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function HealthPanel() {
  const { health, isLoading, error, refresh } = useHealth();
  const hasIssue = error || (health && health.overall !== 'healthy');
  const [isCollapsed, setIsCollapsed] = useState(!hasIssue);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Auto-expand when there's an issue, collapse when healthy
  useEffect(() => {
    setIsCollapsed(!hasIssue);
    // Auto-expand unhealthy items
    if (health) {
      const unhealthyItems = health.components
        .filter((c) => c.status === 'unhealthy' || c.status === 'warning')
        .map((c) => c.name);
      setExpandedItems(new Set(unhealthyItems));
    }
  }, [hasIssue, health]);

  const toggleItem = (name: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  if (isLoading && !health) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48 mt-1" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-12 w-full mb-2" />
          <Skeleton className="h-12 w-full mb-2" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Group components by type
  const pods = health?.components.filter((c) => c.component === 'pod') || [];
  const auth = health?.components.find((c) => c.component === 'auth');
  const cronjob = health?.components.find((c) => c.component === 'cronjob');
  const storage = health?.components.find((c) => c.component === 'storage');
  const n8n = health?.components.find((c) => c.component === 'n8n');

  // Get overall status color
  const getOverallStatusColor = () => {
    if (!health) return 'text-muted-foreground';
    switch (health.overall) {
      case 'healthy': return 'text-green-400';
      case 'degraded': return 'text-yellow-400';
      case 'unhealthy': return 'text-red-400';
      default: return 'text-muted-foreground';
    }
  };

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
              <Activity className={`h-5 w-5 ${getOverallStatusColor()}`} />
              {health && health.overall === 'healthy' && (
                <motion.div
                  className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              )}
              {health && health.overall !== 'healthy' && (
                <motion.div
                  className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${health.overall === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'}`}
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              )}
            </div>
            <div>
              <CardTitle className="flex items-center gap-3 text-base">
                <span>System Health</span>
                {isCollapsed && health && (
                  <span className={`
                    px-2 py-0.5 rounded-full text-xs font-medium
                    ${health.overall === 'healthy' ? 'bg-green-500/10 text-green-400' : ''}
                    ${health.overall === 'degraded' ? 'bg-yellow-500/10 text-yellow-400' : ''}
                    ${health.overall === 'unhealthy' ? 'bg-red-500/10 text-red-400' : ''}
                  `}>
                    {health.overall.charAt(0).toUpperCase() + health.overall.slice(1)}
                  </span>
                )}
              </CardTitle>
              {!isCollapsed && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Real-time status of all system components
                </p>
              )}
            </div>
          </div>
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
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 text-red-400 mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg"
                >
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">{error}</span>
                </motion.div>
              )}

              {health && (
                <>
                  {/* Overall Status Card */}
                  <div className={`
                    flex items-center justify-between mb-6 p-3 rounded-lg border
                    ${health.overall === 'healthy' ? 'bg-green-500/5 border-green-500/20' : ''}
                    ${health.overall === 'degraded' ? 'bg-yellow-500/5 border-yellow-500/20' : ''}
                    ${health.overall === 'unhealthy' ? 'bg-red-500/5 border-red-500/20' : ''}
                  `}>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className={`
                          w-10 h-10 rounded-full flex items-center justify-center
                          ${health.overall === 'healthy' ? 'bg-green-500/10' : ''}
                          ${health.overall === 'degraded' ? 'bg-yellow-500/10' : ''}
                          ${health.overall === 'unhealthy' ? 'bg-red-500/10' : ''}
                        `}>
                          {health.overall === 'healthy' && <CheckCircle2 className="h-5 w-5 text-green-400" />}
                          {health.overall === 'degraded' && <AlertTriangle className="h-5 w-5 text-yellow-400" />}
                          {health.overall === 'unhealthy' && <XCircle className="h-5 w-5 text-red-400" />}
                        </div>
                        {health.overall === 'healthy' && (
                          <motion.div
                            className="absolute inset-0 rounded-full bg-green-500/20"
                            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">Overall Status</p>
                        <p className="text-xs text-muted-foreground">
                          {health.components.filter(c => c.status === 'healthy').length} / {health.components.length} healthy
                        </p>
                      </div>
                    </div>
                    <span className={`
                      px-3 py-1 rounded-full text-sm font-medium
                      ${health.overall === 'healthy' ? 'bg-green-500/10 text-green-400' : ''}
                      ${health.overall === 'degraded' ? 'bg-yellow-500/10 text-yellow-400' : ''}
                      ${health.overall === 'unhealthy' ? 'bg-red-500/10 text-red-400' : ''}
                    `}>
                      {health.overall.charAt(0).toUpperCase() + health.overall.slice(1)}
                    </span>
                  </div>

                  {/* Claude Agent Section */}
                  <div className="space-y-2 mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Server className="h-4 w-4 text-cyan-400" />
                      <h4 className="text-sm font-medium">Claude Agent</h4>
                    </div>
                    {pods.length === 0 ? (
                      <p className="text-sm text-muted-foreground pl-6">No pods found</p>
                    ) : (
                      <div className="space-y-2">
                        {pods.map((pod) => (
                          <ComponentStatusItem
                            key={pod.name}
                            item={pod}
                            expanded={expandedItems.has(pod.name)}
                            onToggle={() => toggleItem(pod.name)}
                          />
                        ))}
                      </div>
                    )}
                    {auth && (
                      <ComponentStatusItem
                        item={auth}
                        expanded={expandedItems.has(auth.name)}
                        onToggle={() => toggleItem(auth.name)}
                      />
                    )}
                    {cronjob && (
                      <ComponentStatusItem
                        item={cronjob}
                        expanded={expandedItems.has(cronjob.name)}
                        onToggle={() => toggleItem(cronjob.name)}
                      />
                    )}
                  </div>

                  {/* Infrastructure Section */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-3">
                      <Database className="h-4 w-4 text-purple-400" />
                      <h4 className="text-sm font-medium">Infrastructure</h4>
                    </div>
                    {storage && (
                      <ComponentStatusItem
                        item={storage}
                        expanded={expandedItems.has(storage.name)}
                        onToggle={() => toggleItem(storage.name)}
                      />
                    )}
                    {n8n && (
                      <ComponentStatusItem
                        item={n8n}
                        expanded={expandedItems.has(n8n.name)}
                        onToggle={() => toggleItem(n8n.name)}
                      />
                    )}
                    {!storage && !n8n && (
                      <p className="text-sm text-muted-foreground pl-6">
                        Storage and n8n monitoring not configured
                      </p>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/30">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span className="font-mono">{new Date(health.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsCollapsed(true)}
                      className="text-xs hover:bg-muted"
                    >
                      Collapse
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
