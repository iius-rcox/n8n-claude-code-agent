import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { executePrompt, ExecutionResponse, ExecutionStatus } from '@/services/api';
import { Loader2, Terminal, Clock, AlertCircle, CheckCircle2, XCircle, ChevronDown, ChevronUp, Command, Sparkles, Zap } from 'lucide-react';

const MAX_PROMPT_SIZE = 100 * 1024; // 100KB

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

// Quick command suggestions
const QUICK_COMMANDS = [
  { label: 'Health check', prompt: 'Reply: ok', icon: <Zap className="h-3 w-3" /> },
  { label: 'List files', prompt: 'List all files in the current directory', icon: <Terminal className="h-3 w-3" /> },
  { label: 'Git status', prompt: 'Show git status for this repository', icon: <Command className="h-3 w-3" /> },
];

interface AgentExecutorProps {
  forceState?: 'expanded' | 'collapsed' | null;
}

export function AgentExecutor({ forceState }: AgentExecutorProps) {
  const [prompt, setPrompt] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<ExecutionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(true);

  // Handle force state from parent (global toggle)
  useEffect(() => {
    if (forceState === 'expanded') {
      setIsCollapsed(false);
    } else if (forceState === 'collapsed') {
      setIsCollapsed(true);
    }
  }, [forceState]);

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
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleExecute();
    }
  };

  const handleQuickCommand = (cmd: string) => {
    setPrompt(cmd);
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
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            )}
            <div className="relative">
              <Terminal className="h-5 w-5 text-purple-400" />
              {isExecuting && (
                <motion.div
                  className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-cyan-500 rounded-full"
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                />
              )}
            </div>
            <div>
              <CardTitle className="flex items-center gap-3 text-base">
                <span>Command Palette</span>
                {isCollapsed && isExecuting && (
                  <motion.span
                    className="px-2 py-0.5 rounded-full text-xs font-mono bg-cyan-500/20 text-cyan-400"
                    animate={{ opacity: [1, 0.7, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    Executing...
                  </motion.span>
                )}
                {isCollapsed && result && (
                  <span className={`
                    px-2 py-0.5 rounded-full text-xs font-mono
                    ${result.status === 'success' ? 'bg-green-500/20 text-green-400' : ''}
                    ${result.status === 'error' || result.status === 'auth_failure' ? 'bg-red-500/20 text-red-400' : ''}
                    ${result.status === 'timeout' ? 'bg-yellow-500/20 text-yellow-400' : ''}
                  `}>
                    {result.status.replace('_', ' ')}
                  </span>
                )}
              </CardTitle>
              {!isCollapsed && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Execute ad-hoc prompts against Claude agent
                </p>
              )}
            </div>
          </div>
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
            <CardContent className="pt-4 space-y-4">
              {/* Command input area */}
              <div className="relative">
                <div className="absolute left-3 top-3 flex items-center gap-2 text-muted-foreground pointer-events-none">
                  <Command className="h-4 w-4" />
                  <span className="text-xs font-mono">$</span>
                </div>
                <Textarea
                  placeholder="Enter your prompt..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isExecuting}
                  className={`
                    min-h-[100px] pl-14 font-mono text-sm
                    bg-background/50 border-border/50
                    focus:border-cyan-500/50 focus:ring-cyan-500/20
                    transition-all
                    ${isExecuting ? 'opacity-50' : ''}
                  `}
                />
                {isExecuting && (
                  <motion.div
                    className="absolute inset-0 rounded-md border border-cyan-500/30 pointer-events-none"
                    animate={{ opacity: [0.3, 0.7, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                )}
              </div>

              {/* Quick commands */}
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-muted-foreground py-1">Quick:</span>
                {QUICK_COMMANDS.map((cmd) => (
                  <motion.button
                    key={cmd.label}
                    onClick={() => handleQuickCommand(cmd.prompt)}
                    disabled={isExecuting}
                    className={`
                      flex items-center gap-1.5 px-2.5 py-1 rounded-full
                      text-xs font-medium
                      bg-muted/50 text-muted-foreground
                      hover:bg-purple-500/10 hover:text-purple-400
                      border border-transparent hover:border-purple-500/30
                      transition-all cursor-pointer
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {cmd.icon}
                    {cmd.label}
                  </motion.button>
                ))}
              </div>

              {/* Character count and shortcut hint */}
              <div className="flex items-center justify-between text-xs">
                <span className={`font-mono ${isOverLimit ? 'text-red-400' : 'text-muted-foreground'}`}>
                  {promptLength.toLocaleString()} / {MAX_PROMPT_SIZE.toLocaleString()}
                </span>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">⌘</kbd>
                  <span>+</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">↵</kbd>
                  <span>to run</span>
                </div>
              </div>

              {/* Execute button */}
              <motion.button
                onClick={handleExecute}
                disabled={!canExecute}
                className={`
                  w-full py-3 rounded-lg font-medium text-sm
                  flex items-center justify-center gap-2
                  transition-all
                  ${canExecute
                    ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:from-cyan-400 hover:to-purple-400 shadow-lg shadow-cyan-500/20'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                  }
                `}
                whileHover={canExecute ? { scale: 1.01 } : {}}
                whileTap={canExecute ? { scale: 0.99 } : {}}
              >
                {isExecuting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Executing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Execute</span>
                  </>
                )}
              </motion.button>

              {/* Error display */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400"
                >
                  <div className="flex items-center gap-2 text-sm">
                    <AlertCircle className="h-4 w-4" />
                    <span>{error}</span>
                  </div>
                </motion.div>
              )}

              {/* Result display */}
              <AnimatePresence>
                {result && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-3 pt-4 border-t border-border/30"
                  >
                    {/* Result header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(result.status)}
                        <span className="font-medium text-sm capitalize">
                          {result.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`
                          px-2 py-0.5 rounded text-xs font-mono
                          ${result.exitCode === 0 ? 'bg-green-500/10 text-green-400' : 'bg-muted text-muted-foreground'}
                        `}>
                          Exit: {result.exitCode ?? 'N/A'}
                        </span>
                        {result.durationMs !== undefined && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono bg-muted text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatDuration(result.durationMs)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Output */}
                    {result.output && (
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Output</label>
                        <pre className="p-4 rounded-lg bg-background/80 border border-border/50 text-sm font-mono whitespace-pre-wrap max-h-[300px] overflow-auto text-foreground">
                          {result.output}
                        </pre>
                      </div>
                    )}

                    {/* Error message */}
                    {result.errorMessage && (
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-red-400">Error</label>
                        <pre className="p-4 rounded-lg bg-red-500/5 border border-red-500/30 text-sm font-mono whitespace-pre-wrap max-h-[200px] overflow-auto text-red-400">
                          {result.errorMessage}
                        </pre>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
