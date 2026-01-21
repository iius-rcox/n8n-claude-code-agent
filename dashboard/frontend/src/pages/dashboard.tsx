import { useMsal } from '@azure/msal-react';
import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { setMsalInstance, getAuthStatus } from '@/services/api';
import { Button } from '@/components/ui/button';
import { HealthPanel } from '@/components/health-panel';
import { TokenRefresh } from '@/components/token-refresh';
import { AgentExecutor } from '@/components/agent-executor';
import { ExecutionHistory } from '@/components/execution-history';
import { CronJobPanel } from '@/components/cronjob-panel';
import { PipelineBoard } from '@/components/pipeline-board';
import { ExecutionFeed } from '@/components/execution-feed';
import { StorageBrowser } from '@/components/storage-browser';
import { useHealth } from '@/hooks/use-health';
import { Activity, LogOut, Cpu } from 'lucide-react';

// Health Ring Component for header
function HealthRing() {
  const { health, isLoading } = useHealth();

  if (isLoading || !health) {
    return (
      <div className="w-10 h-10 rounded-full border-2 border-muted animate-pulse" />
    );
  }

  const healthyCount = health.components.filter(c => c.status === 'healthy').length;
  const totalCount = health.components.length;
  const percentage = totalCount > 0 ? (healthyCount / totalCount) * 100 : 0;
  const circumference = 2 * Math.PI * 16;
  const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;

  const getColor = () => {
    if (health.overall === 'healthy') return 'stroke-green-500';
    if (health.overall === 'degraded') return 'stroke-yellow-500';
    return 'stroke-red-500';
  };

  const getGlow = () => {
    if (health.overall === 'healthy') return 'drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]';
    if (health.overall === 'degraded') return 'drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]';
    return 'drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]';
  };

  return (
    <div className="relative" title={`System Health: ${health.overall} (${healthyCount}/${totalCount})`}>
      <svg className={`w-10 h-10 -rotate-90 ${getGlow()}`} viewBox="0 0 36 36">
        {/* Background ring */}
        <circle
          cx="18"
          cy="18"
          r="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-muted"
        />
        {/* Progress ring */}
        <motion.circle
          cx="18"
          cy="18"
          r="16"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          className={getColor()}
          initial={{ strokeDasharray: `0 ${circumference}` }}
          animate={{ strokeDasharray }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      {/* Center icon */}
      <div className="absolute inset-0 flex items-center justify-center">
        <Activity className={`w-4 h-4 ${health.overall === 'healthy' ? 'text-green-500' : health.overall === 'degraded' ? 'text-yellow-500' : 'text-red-500'}`} />
      </div>
    </div>
  );
}

// Animation variants for staggered entrance
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  },
};

const headerVariants = {
  hidden: { opacity: 0, y: -20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  },
};

export function Dashboard() {
  const { instance, accounts } = useMsal();
  const account = accounts[0];
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Fetch auth status for collapse state
  const fetchAuthStatus = useCallback(async () => {
    try {
      const data = await getAuthStatus();
      setIsAuthenticated(data.authenticated);
    } catch {
      // Ignore errors - auth panel will show them
    }
  }, []);

  useEffect(() => {
    setMsalInstance(instance);
  }, [instance]);

  // Poll auth status for collapse/expand behavior
  useEffect(() => {
    fetchAuthStatus();
    const intervalId = setInterval(fetchAuthStatus, 30000);
    return () => clearInterval(intervalId);
  }, [fetchAuthStatus]);

  const handleLogout = () => {
    instance.logoutPopup();
  };

  return (
    <div className="min-h-screen bg-background bg-grid-pattern bg-noise">
      {/* Header */}
      <motion.header
        className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl"
        variants={headerVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              {/* Logo/Icon */}
              <div className="relative">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center glow-cyan">
                  <Cpu className="w-5 h-5 text-background" />
                </div>
                {/* Pulse indicator */}
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
                </span>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground tracking-tight">
                  Claude Agent <span className="text-cyan-400">Operations</span>
                </h1>
                <p className="text-xs text-muted-foreground font-mono">
                  MISSION_CONTROL // v1.0
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              {/* Health Ring */}
              <HealthRing />

              {/* User info */}
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-foreground">
                    {account?.name || account?.username}
                  </p>
                  <p className="text-xs text-muted-foreground">Operator</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="border-border/50 hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-all"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign out
                </Button>
              </div>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <motion.main
        className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Top Row: Health + Authentication */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <HealthPanel />
          <TokenRefresh isAuthenticated={isAuthenticated} />
        </motion.div>

        {/* CronJob Panel */}
        <motion.div variants={itemVariants} className="mb-6">
          <CronJobPanel />
        </motion.div>

        {/* Task Pipeline - Kanban view of agent tasks */}
        <motion.div variants={itemVariants} className="mb-6">
          <PipelineBoard />
        </motion.div>

        {/* n8n Execution Feed - Real-time workflow executions */}
        <motion.div variants={itemVariants} className="mb-6">
          <ExecutionFeed />
        </motion.div>

        {/* Storage Browser - Azure Blob Storage */}
        <motion.div variants={itemVariants} className="mb-6">
          <StorageBrowser />
        </motion.div>

        {/* Full Width: Agent Executor */}
        <motion.div variants={itemVariants} className="mb-6">
          <AgentExecutor />
        </motion.div>

        {/* Full Width: Execution History */}
        <motion.div variants={itemVariants}>
          <ExecutionHistory />
        </motion.div>
      </motion.main>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-background/50 backdrop-blur-sm mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-mono">
              OPS_DASHBOARD // v1.0.0
            </p>
            <p className="text-xs text-muted-foreground">
              II-US Operations Team
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
