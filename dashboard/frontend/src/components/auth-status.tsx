import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getAuthStatus, AuthStatus } from '@/services/api';
import { Shield, RefreshCw, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';

export function AuthStatusPanel() {
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAuthStatus = useCallback(async () => {
    try {
      const data = await getAuthStatus();
      setAuthStatus(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch auth status');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuthStatus();
    const intervalId = setInterval(fetchAuthStatus, 30000);
    return () => clearInterval(intervalId);
  }, [fetchAuthStatus]);

  const handleRefresh = () => {
    setIsLoading(true);
    fetchAuthStatus();
  };

  if (isLoading && !authStatus) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48 mt-1" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle>Authentication Status</CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <CardDescription>
          Claude session token authentication state
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="flex items-center gap-2 text-destructive mb-4">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {authStatus && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {authStatus.authenticated ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <span className="font-medium">
                  {authStatus.authenticated ? 'Authenticated' : 'Not Authenticated'}
                </span>
              </div>
              <Badge variant={authStatus.authenticated ? 'success' : 'destructive'}>
                Exit Code: {authStatus.exitCode ?? 'N/A'}
              </Badge>
            </div>

            {authStatus.authenticated && authStatus.expiryEstimate && (
              <div className="text-sm">
                <span className="text-muted-foreground">Estimated Expiry: </span>
                <span>{new Date(authStatus.expiryEstimate).toLocaleString()}</span>
              </div>
            )}

            {!authStatus.authenticated && authStatus.lastFailureTime && (
              <div className="text-sm text-destructive">
                <span className="text-muted-foreground">Last Failure: </span>
                <span>{new Date(authStatus.lastFailureTime).toLocaleString()}</span>
              </div>
            )}

            {authStatus.message && (
              <div className="text-sm text-muted-foreground">
                {authStatus.message}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Last checked: {new Date(authStatus.lastChecked).toLocaleTimeString()}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
