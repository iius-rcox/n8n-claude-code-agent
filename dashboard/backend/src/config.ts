export interface Config {
  port: number;
  azureAd: {
    tenantId: string;
    clientId: string;
    authorizedGroupId?: string;
  };
  claudeAgent: {
    namespace: string;
    serviceUrl: string;
  };
  n8n: {
    apiUrl: string;
    apiKey: string;
    workflowFilter: string; // Filter workflows by name prefix (e.g., "Agent Dev Team")
  };
  storage: {
    accountName: string;
    connectionString?: string;
  };
  healthPollIntervalMs: number;
}

function getEnvOrThrow(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvOrDefault(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

export function loadConfig(): Config {
  return {
    port: parseInt(getEnvOrDefault('PORT', '3000'), 10),
    azureAd: {
      tenantId: getEnvOrThrow('AZURE_AD_TENANT_ID'),
      clientId: getEnvOrThrow('AZURE_AD_CLIENT_ID'),
      authorizedGroupId: process.env['AZURE_AD_AUTHORIZED_GROUP_ID'],
    },
    claudeAgent: {
      namespace: getEnvOrDefault('CLAUDE_AGENT_NAMESPACE', 'claude-agent'),
      serviceUrl: getEnvOrDefault(
        'CLAUDE_AGENT_SERVICE_URL',
        'http://claude-agent.claude-agent.svc.cluster.local:80'
      ),
    },
    n8n: {
      apiUrl: getEnvOrDefault('N8N_API_URL', 'http://n8n.n8n.svc.cluster.local:5678'),
      apiKey: getEnvOrDefault('N8N_API_KEY', ''),
      workflowFilter: getEnvOrDefault('N8N_WORKFLOW_FILTER', 'Agent Dev Team'),
    },
    storage: {
      accountName: getEnvOrDefault('AZURE_STORAGE_ACCOUNT', 'iiusagentstore'),
      connectionString: process.env['AZURE_STORAGE_CONNECTION_STRING'],
    },
    healthPollIntervalMs: parseInt(
      getEnvOrDefault('HEALTH_POLL_INTERVAL_MS', '30000'),
      10
    ),
  };
}

let config: Config | null = null;

export function getConfig(): Config {
  if (!config) {
    config = loadConfig();
  }
  return config;
}
