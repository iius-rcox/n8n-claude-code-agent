export interface Config {
  port: number;
  azureAd: {
    tenantId: string;
    clientId: string;
    authorizedGroupId: string;
  };
  claudeAgent: {
    namespace: string;
    serviceUrl: string;
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
      authorizedGroupId: getEnvOrThrow('AUTHORIZED_GROUP_ID'),
    },
    claudeAgent: {
      namespace: getEnvOrDefault('CLAUDE_AGENT_NAMESPACE', 'claude-agent'),
      serviceUrl: getEnvOrDefault(
        'CLAUDE_AGENT_SERVICE',
        'http://claude-agent.claude-agent.svc.cluster.local'
      ),
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
