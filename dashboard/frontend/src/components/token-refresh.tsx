import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { initiateRefresh, getRefreshStatus, pushCredentials, pushOAuthToken, TokenRefreshOperation, RefreshInitResponse } from '@/services/api';
import { RefreshCw, AlertCircle, CheckCircle2, Copy, Key, Shield, ChevronDown, ChevronRight } from 'lucide-react';

const STEP_LABELS: Record<string, string> = {
  waiting_credentials: 'Waiting for credentials',
  deleting_secret: 'Deleting old secret',
  creating_secret: 'Creating new secret',
  restarting_deployment: 'Restarting deployment',
  verifying_auth: 'Verifying authentication',
  complete: 'Complete',
};

interface TokenRefreshProps {
  isAuthenticated?: boolean;
}

export function TokenRefresh({ isAuthenticated = false }: TokenRefreshProps) {
  const [isCollapsed, setIsCollapsed] = useState(isAuthenticated);
  const [isLoading, setIsLoading] = useState(false);
  const [initResponse, setInitResponse] = useState<RefreshInitResponse | null>(null);
  const [operation, setOperation] = useState<TokenRefreshOperation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Long-lived token state
  const [oauthToken, setOauthToken] = useState('');
  const [isPushingToken, setIsPushingToken] = useState(false);

  // Legacy credentials state
  const [credentialsJson, setCredentialsJson] = useState('');
  const [isPushing, setIsPushing] = useState(false);

  // Collapse when authenticated, expand when not
  useEffect(() => {
    setIsCollapsed(isAuthenticated);
  }, [isAuthenticated]);

  const handleInitiateRefresh = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);
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

  const pollStatus = useCallback(async () => {
    if (!initResponse?.operationId) return;

    try {
      const status = await getRefreshStatus(initResponse.operationId);
      setOperation(status);

      if (status.status === 'completed' || status.status === 'failed') {
        return true;
      }
    } catch (err) {
      console.error('Failed to poll status:', err);
    }
    return false;
  }, [initResponse?.operationId]);

  useEffect(() => {
    if (!initResponse?.operationId) return;

    const pollInterval = setInterval(async () => {
      const shouldStop = await pollStatus();
      if (shouldStop) {
        clearInterval(pollInterval);
      }
    }, 2000);

    pollStatus();
    return () => clearInterval(pollInterval);
  }, [initResponse?.operationId, pollStatus]);

  const calculateProgress = (): number => {
    if (!operation) return 0;
    const completedSteps = operation.steps.filter((s) => s.status === 'completed').length;
    return Math.round((completedSteps / operation.steps.length) * 100);
  };

  const handleReset = () => {
    setInitResponse(null);
    setOperation(null);
    setError(null);
    setSuccess(null);
    setOauthToken('');
    setCredentialsJson('');
  };

  // Handle long-lived OAuth token push
  const handlePushOAuthToken = async () => {
    const token = oauthToken.trim();
    if (!token) {
      setError('OAuth token is required');
      return;
    }

    // Basic validation - token should start with expected prefix
    if (!token.startsWith('sk-ant-') && !token.includes('oauth')) {
      setError('Invalid token format. Token should be the output from "claude setup-token"');
      return;
    }

    setIsPushingToken(true);
    setError(null);

    try {
      await pushOAuthToken({ token });
      setSuccess('Long-lived token configured successfully! The agent will restart automatically.');
      setOauthToken('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to push OAuth token');
    } finally {
      setIsPushingToken(false);
    }
  };

  // Handle legacy credentials push
  const handleManualPush = async () => {
    if (!credentialsJson.trim()) {
      setError('Credentials JSON is required');
      return;
    }

    try {
      const creds = JSON.parse(credentialsJson);
      if (!creds.claudeAiOauth?.accessToken) {
        setError('Invalid credentials: missing claudeAiOauth.accessToken');
        return;
      }
    } catch {
      setError('Invalid credentials JSON format');
      return;
    }

    setIsPushing(true);
    setError(null);

    try {
      await pushCredentials({
        credentials: credentialsJson,
        settings: '{}',
      });
      setSuccess('Session credentials updated. Refresh in progress...');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to push credentials');
    } finally {
      setIsPushing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <Card>
      <CardHeader
        className={isAuthenticated ? 'cursor-pointer select-none' : ''}
        onClick={() => isAuthenticated && setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Authentication
            {isAuthenticated && (
              <Badge variant="success" className="ml-2">Configured</Badge>
            )}
          </CardTitle>
          {isAuthenticated && (
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
        <CardDescription>
          {isCollapsed && isAuthenticated
            ? 'Click to expand and reconfigure authentication'
            : 'Configure Claude authentication for the agent'
          }
        </CardDescription>
      </CardHeader>
      {!isCollapsed && (
      <CardContent className="space-y-4">
        {/* Error State */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Success State */}
        {success && (
          <Alert variant="success">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
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
                  {step.status === 'completed' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                  {step.status === 'in_progress' && <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />}
                  {step.status === 'pending' && <div className="h-4 w-4 rounded-full border-2 border-muted" />}
                  {step.status === 'failed' && <AlertCircle className="h-4 w-4 text-red-500" />}
                  <span className={step.status === 'in_progress' ? 'font-medium' : step.status === 'completed' ? 'text-muted-foreground' : ''}>
                    {STEP_LABELS[step.step]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completed State */}
        {operation?.status === 'completed' && (
          <div className="space-y-4">
            <Alert variant="success">
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Authentication Updated</AlertTitle>
              <AlertDescription>
                Claude agent is now authenticated.
                {operation.endTime && (
                  <span className="block text-xs text-muted-foreground mt-1">
                    Completed at {new Date(operation.endTime).toLocaleString()}
                  </span>
                )}
              </AlertDescription>
            </Alert>
            <Button onClick={handleReset} className="w-full">Done</Button>
          </div>
        )}

        {/* Failed State */}
        {operation?.status === 'failed' && operation.error && (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Authentication Failed</AlertTitle>
              <AlertDescription>
                <p className="font-medium">{operation.error.message}</p>
                {operation.error.remediation && <p className="mt-2 text-sm">{operation.error.remediation}</p>}
              </AlertDescription>
            </Alert>
            <Badge variant="destructive">Failed at: {STEP_LABELS[operation.error.step]}</Badge>
            <Button onClick={handleReset} className="w-full">Try Again</Button>
          </div>
        )}

        {/* Main Auth Configuration UI */}
        {!operation && !success && (
          <Tabs defaultValue="long-lived" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="long-lived" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Long-Lived Token
              </TabsTrigger>
              <TabsTrigger value="session" className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Session Refresh
              </TabsTrigger>
            </TabsList>

            {/* Long-Lived Token Tab (Recommended) */}
            <TabsContent value="long-lived" className="space-y-4 mt-4">
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertTitle>Recommended: Long-Lived Token</AlertTitle>
                <AlertDescription className="text-sm">
                  One-time setup. Token doesn't expire and requires no refresh.
                </AlertDescription>
              </Alert>

              <div className="space-y-4 p-4 border rounded-lg">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Step 1: Generate token (run locally)</label>
                  <div className="relative">
                    <pre className="bg-muted p-3 rounded text-sm font-mono">claude setup-token</pre>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard('claude setup-token')}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This will open your browser. After authorizing, the token will be displayed.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Step 2: Paste the token</label>
                  <textarea
                    className="w-full h-24 p-3 text-xs font-mono bg-background border rounded resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Paste the token from setup-token output..."
                    value={oauthToken}
                    onChange={(e) => setOauthToken(e.target.value)}
                  />
                </div>

                <Button
                  onClick={handlePushOAuthToken}
                  disabled={isPushingToken || !oauthToken.trim()}
                  className="w-full"
                >
                  {isPushingToken ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Configuring...
                    </>
                  ) : (
                    <>
                      <Key className="mr-2 h-4 w-4" />
                      Configure Token
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>

            {/* Session Refresh Tab (Legacy) */}
            <TabsContent value="session" className="space-y-4 mt-4">
              <Alert>
                <RefreshCw className="h-4 w-4" />
                <AlertTitle>Session Credentials</AlertTitle>
                <AlertDescription className="text-sm">
                  Use this if setup-token doesn't work. Requires periodic refresh.
                </AlertDescription>
              </Alert>

              {!initResponse ? (
                <Button onClick={handleInitiateRefresh} disabled={isLoading} className="w-full">
                  {isLoading ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Initiating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Start Session Refresh
                    </>
                  )}
                </Button>
              ) : (
                <div className="space-y-4 p-4 border rounded-lg">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Step 1: Login to Claude</label>
                    <div className="relative">
                      <pre className="bg-muted p-3 rounded text-sm font-mono">claude /login</pre>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard('claude /login')}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Step 2: Export and paste credentials</label>
                    <div className="relative">
                      <pre className="bg-muted p-2 rounded text-xs font-mono overflow-x-auto">
                        {navigator.platform.toLowerCase().includes('mac')
                          ? 'security find-generic-password -s "Claude Code-credentials" -w'
                          : navigator.platform.toLowerCase().includes('win')
                          ? 'type "%USERPROFILE%\\.claude\\.credentials.json"'
                          : 'cat ~/.claude/.credentials.json'}
                      </pre>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute top-1 right-1"
                        onClick={() => copyToClipboard(
                          navigator.platform.toLowerCase().includes('mac')
                            ? 'security find-generic-password -s "Claude Code-credentials" -w'
                            : navigator.platform.toLowerCase().includes('win')
                            ? 'type "%USERPROFILE%\\.claude\\.credentials.json"'
                            : 'cat ~/.claude/.credentials.json'
                        )}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <textarea
                      className="w-full h-24 p-3 text-xs font-mono bg-background border rounded resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder='{"claudeAiOauth":{"accessToken":"..."}}'
                      value={credentialsJson}
                      onChange={(e) => setCredentialsJson(e.target.value)}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleManualPush}
                      disabled={isPushing || !credentialsJson.trim()}
                      className="flex-1"
                    >
                      {isPushing ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Pushing...
                        </>
                      ) : (
                        'Push Credentials'
                      )}
                    </Button>
                    <Button variant="outline" onClick={handleReset}>
                      Cancel
                    </Button>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      Waiting...
                    </span>
                    <span>Expires: {new Date(initResponse.expiresAt).toLocaleTimeString()}</span>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        {success && (
          <Button onClick={handleReset} variant="outline" className="w-full">
            Configure Another Token
          </Button>
        )}
      </CardContent>
      )}
    </Card>
  );
}
