import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useHealth } from '@/hooks/use-health';
import { HealthStatus } from '@/services/api';
import { Activity, RefreshCw, Server, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';

function getStatusBadgeVariant(status: HealthStatus['status']): 'success' | 'destructive' | 'warning' | 'secondary' {
  switch (status) {
    case 'healthy':
      return 'success';
    case 'unhealthy':
      return 'destructive';
    case 'pending':
      return 'warning';
    default:
      return 'secondary';
  }
}

function formatStatus(status: HealthStatus['status']): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function PodStatusItem({ pod }: { pod: HealthStatus }) {
  const details = pod.details || {};

  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <div className="flex items-center gap-2">
        <Server className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{pod.name}</span>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={getStatusBadgeVariant(pod.status)}>
          {formatStatus(pod.status)}
        </Badge>
        {details.readyContainers !== undefined && details.totalContainers !== undefined && (
          <span className="text-xs text-muted-foreground">
            {details.readyContainers}/{details.totalContainers}
          </span>
        )}
        {details.restartCount !== undefined && details.restartCount > 0 && (
          <span className="text-xs text-muted-foreground">
            ({details.restartCount} restarts)
          </span>
        )}
      </div>
    </div>
  );
}

export function HealthPanel() {
  const { health, isLoading, error, refresh } = useHealth();
  const hasIssue = error || (health && health.overall !== 'healthy');
  const [isCollapsed, setIsCollapsed] = useState(!hasIssue);

  // Auto-expand when there's an issue, collapse when healthy
  useEffect(() => {
    setIsCollapsed(!hasIssue);
  }, [hasIssue]);

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

  const pods = health?.components.filter((c) => c.component === 'pod') || [];

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
                <Badge variant={getStatusBadgeVariant(health.overall === 'degraded' ? 'pending' : health.overall)}>
                  {health.overall.charAt(0).toUpperCase() + health.overall.slice(1)}
                </Badge>
              )}
            </CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); refresh(); }} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <CardDescription>
          {isCollapsed ? 'Click to expand details' : 'Real-time status of Claude agent components'}
        </CardDescription>
      </CardHeader>
      {!isCollapsed && <CardContent>
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
              <Badge variant={getStatusBadgeVariant(health.overall === 'degraded' ? 'pending' : health.overall)}>
                {health.overall.charAt(0).toUpperCase() + health.overall.slice(1)}
              </Badge>
            </div>

            <div className="space-y-1">
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Pods</h4>
              {pods.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pods found</p>
              ) : (
                pods.map((pod) => <PodStatusItem key={pod.name} pod={pod} />)
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
      </CardContent>}
    </Card>
  );
}
