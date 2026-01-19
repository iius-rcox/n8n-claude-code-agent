import { useMsal } from '@azure/msal-react';
import { useEffect, useState, useCallback } from 'react';
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Claude Agent Operations
              </h1>
              <p className="text-sm text-gray-500">
                Manage and monitor your Claude agent deployment
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                {account?.name || account?.username}
              </span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Top Row: Health + Authentication */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <HealthPanel />
          <TokenRefresh isAuthenticated={isAuthenticated} />
        </div>

        {/* CronJob Panel */}
        <div className="mb-6">
          <CronJobPanel />
        </div>

        {/* Task Pipeline - Kanban view of agent tasks */}
        <div className="mb-6">
          <PipelineBoard />
        </div>

        {/* n8n Execution Feed - Real-time workflow executions */}
        <div className="mb-6">
          <ExecutionFeed />
        </div>

        {/* Storage Browser - Azure Blob Storage */}
        <div className="mb-6">
          <StorageBrowser />
        </div>

        {/* Full Width: Agent Executor */}
        <div className="mb-6">
          <AgentExecutor />
        </div>

        {/* Full Width: Execution History */}
        <div>
          <ExecutionHistory />
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <p className="text-sm text-gray-500 text-center">
            Operations Dashboard v1.0.0 | II-US Operations Team
          </p>
        </div>
      </footer>
    </div>
  );
}
