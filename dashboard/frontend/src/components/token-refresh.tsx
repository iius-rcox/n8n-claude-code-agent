import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { initiateRefresh, getRefreshStatus, TokenRefreshOperation, RefreshInitResponse } from '@/services/api';
import { RefreshCw, Copy, Check, AlertCircle, CheckCircle2 } from 'lucide-react';

const STEP_LABELS: Record<string, string> = {
  waiting_credentials: 'Waiting for credentials',
  deleting_secret: 'Deleting old secret',
  creating_secret: 'Creating new secret',
  restarting_deployment: 'Restarting deployment',
  verifying_auth: 'Verifying authentication',
  complete: 'Complete',
};

export function TokenRefresh() {
  const [isLoading, setIsLoading] = useState(false);
  const [initResponse, setInitResponse] = useState<RefreshInitResponse | null>(null);
  const [operation, setOperation] = useState<TokenRefreshOperation | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInitiateRefresh = async () => {
    setIsLoading(true);
    setError(null);
    setInitResponse(null);
    setOperation(null);

    try {
      const response = await initiateRefresh();
      setInitResponse(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initiate refresh');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCommand = async () => {
    if (!initResponse?.cliCommand) return;

    try {
      await navigator.clipboard.writeText(initResponse.cliCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Failed to copy command to clipboard');
    }
  };

  const pollStatus = useCallback(async () => {
    if (!initResponse?.operationId) return;

    try {
      const status = await getRefreshStatus(initResponse.operationId);
      setOperation(status);

      // Stop polling if completed or failed
      if (status.status === 'completed' || status.status === 'failed') {
        return true; // Signal to stop polling
      }
    } catch (err) {
      console.error('Failed to poll status:', err);
    }
    return false;
  }, [initResponse?.operationId]);

  // Poll for operation status
  useEffect(() => {
    if (!initResponse?.operationId) return;

    const pollInterval = setInterval(async () => {
      const shouldStop = await pollStatus();
      if (shouldStop) {
        clearInterval(pollInterval);
      }
    }, 2000);

    // Initial poll
    pollStatus();

    return () => clearInterval(pollInterval);
  }, [initResponse?.operationId, pollStatus]);

  const calculateProgress = (): number => {
    if (!operation) return 0;

    const steps = operation.steps;
    const completedSteps = steps.filter((s) => s.status === 'completed').length;
    return Math.round((completedSteps / steps.length) * 100);
  };

  const handleReset = () => {
    setInitResponse(null);
    setOperation(null);
    setError(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Token Refresh
        </CardTitle>
        <CardDescription>
          Refresh Claude session tokens when they expire (exit code 57)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Error State */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Initial State - Show refresh button */}
        {!initResponse && !operation && (
          <Button onClick={handleInitiateRefresh} disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Initiating...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Tokens
              </>
            )}
          </Button>
        )}

        {/* Waiting for credentials - Show CLI command */}
        {initResponse && (!operation || operation.currentStep === 'waiting_credentials') && (
          <div className="space-y-4">
            <Alert>
              <AlertTitle>Run this command locally</AlertTitle>
              <AlertDescription className="mt-2">
                <p className="mb-2 text-sm">
                  First, run <code className="bg-muted px-1 rounded">claude /login</code> to
                  authenticate, then run this command to push your credentials:
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <code className="flex-1 bg-muted p-2 rounded text-xs font-mono overflow-x-auto">
                    {initResponse.cliCommand}
                  </code>
                  <Button variant="outline" size="icon" onClick={handleCopyCommand}>
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </AlertDescription>
            </Alert>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Waiting for credentials push...</span>
              <span>Expires: {new Date(initResponse.expiresAt).toLocaleTimeString()}</span>
            </div>

            <Button variant="outline" onClick={handleReset} className="w-full">
              Cancel
            </Button>
          </div>
        )}

        {/* In Progress - Show progress */}
        {operation && operation.status === 'in_progress' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{STEP_LABELS[operation.currentStep]}</span>
                <span>{calculateProgress()}%</span>
              </div>
              <Progress value={calculateProgress()} />
            </div>

            <div className="space-y-2">
              {operation.steps.map((step) => (
                <div key={step.step} className="flex items-center gap-2 text-sm">
                  {step.status === 'completed' && (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                  {step.status === 'in_progress' && (
                    <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
                  )}
                  {step.status === 'pending' && (
                    <div className="h-4 w-4 rounded-full border-2 border-muted" />
                  )}
                  {step.status === 'failed' && (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span
                    className={
                      step.status === 'completed'
                        ? 'text-muted-foreground'
                        : step.status === 'in_progress'
                        ? 'font-medium'
                        : ''
                    }
                  >
                    {STEP_LABELS[step.step]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completed - Show success */}
        {operation?.status === 'completed' && (
          <div className="space-y-4">
            <Alert variant="success">
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Token Refresh Complete</AlertTitle>
              <AlertDescription>
                Claude session tokens have been refreshed successfully.
                <br />
                <span className="text-xs text-muted-foreground">
                  Completed at {operation.endTime && new Date(operation.endTime).toLocaleString()}
                </span>
              </AlertDescription>
            </Alert>

            <Button onClick={handleReset} className="w-full">
              Done
            </Button>
          </div>
        )}

        {/* Failed - Show error */}
        {operation?.status === 'failed' && operation.error && (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Token Refresh Failed</AlertTitle>
              <AlertDescription>
                <p className="font-medium">{operation.error.message}</p>
                {operation.error.remediation && (
                  <p className="mt-2 text-sm">{operation.error.remediation}</p>
                )}
              </AlertDescription>
            </Alert>

            <div className="flex items-center gap-2">
              <Badge variant="destructive">
                Failed at: {STEP_LABELS[operation.error.step]}
              </Badge>
            </div>

            <Button onClick={handleReset} className="w-full">
              Try Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
