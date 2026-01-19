import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  Workflow,
  Key,
  Clock,
} from 'lucide-react';

function getStatusBadgeVariant(status: HealthStatus['status']): 'success' | 'destructive' | 'warning' | 'secondary' {
  switch (status) {
    case 'healthy':
      return 'success';
    case 'unhealthy':
      return 'destructive';
    case 'pending':
    case 'warning':
      return 'warning';
    default:
      return 'secondary';
  }
}

function formatStatus(status: HealthStatus['status']): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getComponentIcon(component: HealthStatus['component']) {
  switch (component) {
    case 'pod':
      return <Server className="h-4 w-4 text-muted-foreground" />;
    case 'auth':
      return <Key className="h-4 w-4 text-muted-foreground" />;
    case 'cronjob':
      return <Clock className="h-4 w-4 text-muted-foreground" />;
    case 'storage':
      return <Database className="h-4 w-4 text-muted-foreground" />;
    case 'n8n':
      return <Workflow className="h-4 w-4 text-muted-foreground" />;
    default:
      return <Activity className="h-4 w-4 text-muted-foreground" />;
  }
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

  return (
    <div className="py-2 border-b last:border-0">
      <div
        className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded px-1"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )}
          {getComponentIcon(item.component)}
          <span className="text-sm font-medium">{item.name}</span>
        </div>
        <Badge variant={getStatusBadgeVariant(item.status)}>{formatStatus(item.status)}</Badge>
      </div>
      {expanded && renderDetails(details, item.component)}
    </div>
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

  return (
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
            <Activity className="h-5 w-5" />
            <CardTitle className="flex items-center gap-2">
              System Health
              {isCollapsed && health && (
                <Badge
                  variant={getStatusBadgeVariant(
                    health.overall === 'degraded' ? 'warning' : health.overall
                  )}
                >
                  {health.overall.charAt(0).toUpperCase() + health.overall.slice(1)}
                </Badge>
              )}
            </CardTitle>
          </div>
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
        <CardDescription>
          {isCollapsed ? 'Click to expand details' : 'Real-time status of all system components'}
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

          {health && (
            <>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium">Overall Status</span>
                <Badge
                  variant={getStatusBadgeVariant(
                    health.overall === 'degraded' ? 'warning' : health.overall
                  )}
                >
                  {health.overall.charAt(0).toUpperCase() + health.overall.slice(1)}
                </Badge>
              </div>

              {/* Claude Agent Section */}
              <div className="space-y-1 mb-4">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Claude Agent</h4>
                {pods.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No pods found</p>
                ) : (
                  pods.map((pod) => (
                    <ComponentStatusItem
                      key={pod.name}
                      item={pod}
                      expanded={expandedItems.has(pod.name)}
                      onToggle={() => toggleItem(pod.name)}
                    />
                  ))
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
              <div className="space-y-1">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Infrastructure</h4>
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
                  <p className="text-sm text-muted-foreground">
                    Storage and n8n monitoring not configured
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-muted-foreground">
                  Last checked: {new Date(health.timestamp).toLocaleTimeString()}
                </p>
                <Button variant="ghost" size="sm" onClick={() => setIsCollapsed(true)}>
                  Collapse
                </Button>
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
