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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { getCronJobs, triggerCronJob, CronJobStatus, CronJobRun } from '@/services/api';
import {
  RefreshCw,
  Play,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Calendar,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

function getStatusBadgeVariant(
  status: CronJobRun['status']
): 'success' | 'destructive' | 'secondary' {
  switch (status) {
    case 'succeeded':
      return 'success';
    case 'failed':
      return 'destructive';
    case 'running':
    default:
      return 'secondary';
  }
}

function getStatusIcon(status: CronJobRun['status']) {
  switch (status) {
    case 'succeeded':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500" />;
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

function formatRelativeTime(dateString?: string): string {
  if (!dateString) return 'Never';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function CronJobPanel() {
  const [cronJob, setCronJob] = useState<CronJobStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [triggerResult, setTriggerResult] = useState<{ success: boolean; message: string } | null>(
    null
  );

  // Check if there are any recent failures (last run failed)
  const hasRecentFailure = cronJob?.recentRuns?.[0]?.status === 'failed' || cronJob?.suspended;
  const hasIssue = error || hasRecentFailure;
  const [isCollapsed, setIsCollapsed] = useState(true);

  const fetchCronJob = useCallback(async () => {
    try {
      const data = await getCronJobs();
      setCronJob(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch CronJob status');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCronJob();
    // Poll every 30 seconds
    const intervalId = setInterval(fetchCronJob, 30000);
    return () => clearInterval(intervalId);
  }, [fetchCronJob]);

  // Auto-expand when there's an issue
  useEffect(() => {
    if (hasIssue) {
      setIsCollapsed(false);
    }
  }, [hasIssue]);

  const handleTrigger = async () => {
    setShowConfirmDialog(false);
    setIsTriggering(true);
    setTriggerResult(null);

    try {
      const result = await triggerCronJob();
      setTriggerResult({
        success: result.success,
        message: result.message || `Job ${result.jobName} created successfully`,
      });
      // Refresh the CronJob status
      await fetchCronJob();
    } catch (err) {
      setTriggerResult({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to trigger job',
      });
    } finally {
      setIsTriggering(false);
    }
  };

  const handleRefresh = () => {
    setIsLoading(true);
    fetchCronJob();
  };

  if (isLoading && !cronJob) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56 mt-1" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full mb-4" />
          <Skeleton className="h-[150px] w-full" />
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
              <Calendar className="h-5 w-5" />
              <CardTitle className="flex items-center gap-2">
                Auth Watchdog CronJob
                {isCollapsed && cronJob && (
                  <Badge variant={cronJob.suspended ? 'destructive' : 'success'}>
                    {cronJob.suspended ? 'Suspended' : 'Active'}
                  </Badge>
                )}
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {!isCollapsed && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); setShowConfirmDialog(true); }}
                  disabled={isTriggering || !cronJob}
                >
                  {isTriggering ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Run Now
                    </>
                  )}
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleRefresh(); }} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          <CardDescription>
            {isCollapsed ? 'Click to expand details' : 'Periodic authentication verification and alerting'}
          </CardDescription>
        </CardHeader>
        {!isCollapsed && <CardContent className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {triggerResult && (
            <div
              className={`flex items-center gap-2 p-3 rounded-md ${
                triggerResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}
            >
              {triggerResult.success ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <span className="text-sm">{triggerResult.message}</span>
            </div>
          )}

          {cronJob && (
            <>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <span className="text-muted-foreground">Schedule</span>
                  <p className="font-mono">{cronJob.schedule}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground">Status</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={cronJob.suspended ? 'destructive' : 'success'}>
                      {cronJob.suspended ? 'Suspended' : 'Active'}
                    </Badge>
                    {cronJob.activeJobs > 0 && (
                      <Badge variant="secondary">
                        {cronJob.activeJobs} running
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground">Last Scheduled</span>
                  <p>
                    {cronJob.lastScheduleTime
                      ? formatRelativeTime(cronJob.lastScheduleTime)
                      : 'Never'}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground">Last Success</span>
                  <p>
                    {cronJob.lastSuccessfulTime
                      ? formatRelativeTime(cronJob.lastSuccessfulTime)
                      : 'Never'}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Recent Runs</h4>
                {cronJob.recentRuns.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recent runs</p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Job</TableHead>
                          <TableHead>Started</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Duration</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cronJob.recentRuns.map((run) => (
                          <TableRow key={run.name}>
                            <TableCell className="font-mono text-sm">
                              {run.name.length > 30
                                ? `...${run.name.slice(-27)}`
                                : run.name}
                            </TableCell>
                            <TableCell className="text-sm">
                              {run.startTime
                                ? new Date(run.startTime).toLocaleString()
                                : '-'}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {getStatusIcon(run.status)}
                                <Badge variant={getStatusBadgeVariant(run.status)}>
                                  {run.status}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              {formatDuration(run.durationMs)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              <div className="flex justify-end mt-4">
                <Button variant="ghost" size="sm" onClick={() => setIsCollapsed(true)}>
                  Collapse
                </Button>
              </div>
            </>
          )}
        </CardContent>}
      </Card>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Manual Run</DialogTitle>
            <DialogDescription>
              This will immediately trigger the auth watchdog job outside of its normal schedule.
              The job will check Claude authentication status and send an alert if auth has failed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleTrigger}>
              <Play className="mr-2 h-4 w-4" />
              Run Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
