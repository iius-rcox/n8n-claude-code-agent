import { useMsal } from '@azure/msal-react';
import { useEffect } from 'react';
import { setMsalInstance } from '@/services/api';
import { Button } from '@/components/ui/button';
import { HealthPanel } from '@/components/health-panel';
import { AuthStatusPanel } from '@/components/auth-status';
import { TokenRefresh } from '@/components/token-refresh';
import { AgentExecutor } from '@/components/agent-executor';
import { ExecutionHistory } from '@/components/execution-history';
import { CronJobPanel } from '@/components/cronjob-panel';

export function Dashboard() {
  const { instance, accounts } = useMsal();
  const account = accounts[0];

  useEffect(() => {
    setMsalInstance(instance);
  }, [instance]);

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
        {/* Top Row: Health + Auth Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <HealthPanel />
          <AuthStatusPanel />
        </div>

        {/* Middle Row: Token Refresh + CronJob */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <TokenRefresh />
          <CronJobPanel />
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
