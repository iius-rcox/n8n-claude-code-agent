export type TokenRefreshStep =
  | 'waiting_credentials'
  | 'deleting_secret'
  | 'creating_secret'
  | 'restarting_deployment'
  | 'verifying_auth'
  | 'complete';

export interface StepStatus {
  step: TokenRefreshStep;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startTime?: string;
  endTime?: string;
  message?: string;
}

export interface TokenRefreshError {
  step: TokenRefreshStep;
  message: string;
  details?: string;
  remediation?: string;
}

export interface TokenRefreshOperation {
  id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startTime: string;
  endTime?: string;
  currentStep: TokenRefreshStep;
  steps: StepStatus[];
  error?: TokenRefreshError;
}

export interface CredentialsPush {
  credentials: string;
  settings: string;
}

export interface RefreshInitResponse {
  operationId: string;
  status: 'waiting_credentials';
  cliCommand: string;
  expiresAt: string;
}

export interface CredentialsPushResponse {
  success: boolean;
  operationId?: string;
  message?: string;
}

// Standard remediation messages for each step
export const REMEDIATION_MESSAGES: Record<TokenRefreshStep, string> = {
  waiting_credentials: 'Ensure you ran `claude /login` successfully before running the push script.',
  deleting_secret: 'Check RBAC permissions: service account needs delete permission on secrets in claude-agent namespace.',
  creating_secret: 'Check RBAC permissions: service account needs create permission on secrets in claude-agent namespace.',
  restarting_deployment: 'Check RBAC permissions: service account needs patch permission on deployments in claude-agent namespace.',
  verifying_auth: 'Credentials may be invalid or expired. Run `claude /login` again and retry the push.',
  complete: '',
};

export const ALL_STEPS: TokenRefreshStep[] = [
  'waiting_credentials',
  'deleting_secret',
  'creating_secret',
  'restarting_deployment',
  'verifying_auth',
  'complete',
];
