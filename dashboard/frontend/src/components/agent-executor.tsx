import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { executePrompt, ExecutionResponse, ExecutionStatus } from '@/services/api';
import { Play, Loader2, Terminal, Clock, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';

const MAX_PROMPT_SIZE = 100 * 1024; // 100KB

function getStatusBadgeVariant(status: ExecutionStatus): 'success' | 'destructive' | 'warning' | 'secondary' {
  switch (status) {
    case 'success':
      return 'success';
    case 'error':
    case 'auth_failure':
      return 'destructive';
    case 'timeout':
      return 'warning';
    case 'running':
    default:
      return 'secondary';
  }
}

function getStatusIcon(status: ExecutionStatus) {
  switch (status) {
    case 'success':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'error':
    case 'auth_failure':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'timeout':
      return <Clock className="h-4 w-4 text-yellow-500" />;
    case 'running':
      return <Loader2 className="h-4 w-4 animate-spin" />;
    default:
      return <AlertCircle className="h-4 w-4" />;
  }
}

function formatDuration(ms: number): string {
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

export function AgentExecutor() {
  const [prompt, setPrompt] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<ExecutionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const promptLength = prompt.length;
  const isOverLimit = promptLength > MAX_PROMPT_SIZE;
  const canExecute = prompt.trim().length > 0 && !isOverLimit && !isExecuting;

  const handleExecute = async () => {
    if (!canExecute) return;

    setIsExecuting(true);
    setResult(null);
    setError(null);

    try {
      const response = await executePrompt({ prompt });
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Execution failed');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl/Cmd + Enter to execute
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleExecute();
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Terminal className="h-5 w-5" />
          <CardTitle>Execute Prompt</CardTitle>
        </div>
        <CardDescription>
          Run an ad-hoc prompt against the Claude agent
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Textarea
            placeholder="Enter your prompt here..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isExecuting}
            className="min-h-[120px] font-mono text-sm"
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className={isOverLimit ? 'text-destructive' : ''}>
              {promptLength.toLocaleString()} / {MAX_PROMPT_SIZE.toLocaleString()} characters
            </span>
            <span>Ctrl+Enter to run</span>
          </div>
        </div>

        <Button
          onClick={handleExecute}
          disabled={!canExecute}
          className="w-full"
        >
          {isExecuting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Run
            </>
          )}
        </Button>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {result && (
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getStatusIcon(result.status)}
                <span className="font-medium capitalize">{result.status.replace('_', ' ')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={getStatusBadgeVariant(result.status)}>
                  Exit: {result.exitCode ?? 'N/A'}
                </Badge>
                {result.durationMs !== undefined && (
                  <Badge variant="outline">
                    <Clock className="mr-1 h-3 w-3" />
                    {formatDuration(result.durationMs)}
                  </Badge>
                )}
              </div>
            </div>

            {result.output && (
              <div className="space-y-1">
                <label className="text-sm font-medium">Output</label>
                <pre className="p-3 bg-muted rounded-md text-sm font-mono whitespace-pre-wrap max-h-[300px] overflow-auto">
                  {result.output}
                </pre>
              </div>
            )}

            {result.errorMessage && (
              <div className="space-y-1">
                <label className="text-sm font-medium text-destructive">Error</label>
                <pre className="p-3 bg-destructive/10 rounded-md text-sm font-mono whitespace-pre-wrap text-destructive">
                  {result.errorMessage}
                </pre>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
