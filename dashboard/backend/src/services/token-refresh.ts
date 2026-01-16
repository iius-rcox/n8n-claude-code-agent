import { v4 as uuidv4 } from 'uuid';
import { Config } from '../config.js';
import { KubernetesService } from './kubernetes.js';
import { ClaudeAgentService } from './claude-agent.js';
import {
  TokenRefreshOperation,
  TokenRefreshStep,
  StepStatus,
  CredentialsPush,
  REMEDIATION_MESSAGES,
  ALL_STEPS,
} from '../types/token-refresh.js';

interface CredentialsJson {
  claudeAiOauth?: {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: string;
  };
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class TokenRefreshService {
  private operations: Map<string, TokenRefreshOperation> = new Map();
  private readonly OPERATION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
  private readonly SECRET_NAME = 'claude-session';
  private readonly DEPLOYMENT_NAME = 'claude-agent';

  constructor(
    _config: Config,
    private k8sService: KubernetesService,
    private claudeService: ClaudeAgentService
  ) {
    // Clean up expired operations periodically
    setInterval(() => this.cleanupExpiredOperations(), 60000);
  }

  private cleanupExpiredOperations(): void {
    const now = Date.now();
    for (const [id, op] of this.operations.entries()) {
      const startTime = new Date(op.startTime).getTime();
      if (now - startTime > this.OPERATION_TIMEOUT_MS && op.status === 'pending') {
        this.operations.delete(id);
      }
    }
  }

  createOperation(_dashboardUrl: string): TokenRefreshOperation {
    const id = uuidv4();
    const now = new Date().toISOString();

    const steps: StepStatus[] = ALL_STEPS.map((step) => ({
      step,
      status: step === 'waiting_credentials' ? 'in_progress' : 'pending',
    }));

    const operation: TokenRefreshOperation = {
      id,
      status: 'pending',
      startTime: now,
      currentStep: 'waiting_credentials',
      steps,
    };

    this.operations.set(id, operation);
    return operation;
  }

  getOperation(id: string): TokenRefreshOperation | undefined {
    return this.operations.get(id);
  }

  getPendingOperation(): TokenRefreshOperation | undefined {
    for (const op of this.operations.values()) {
      if (op.status === 'pending' && op.currentStep === 'waiting_credentials') {
        return op;
      }
    }
    return undefined;
  }

  validateCredentials(push: CredentialsPush): ValidationResult {
    const errors: string[] = [];

    // Parse credentials JSON
    let creds: CredentialsJson;
    try {
      creds = JSON.parse(push.credentials) as CredentialsJson;
    } catch {
      errors.push('Invalid credentials JSON format');
      return { valid: false, errors };
    }

    // Check required fields
    if (!creds.claudeAiOauth) {
      errors.push('Missing claudeAiOauth in credentials');
    } else if (!creds.claudeAiOauth.accessToken) {
      errors.push('Missing accessToken in claudeAiOauth');
    }

    // Parse settings JSON
    try {
      JSON.parse(push.settings);
    } catch {
      errors.push('Invalid settings JSON format');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async executeRefresh(
    operationId: string,
    credentials: CredentialsPush
  ): Promise<TokenRefreshOperation> {
    const operation = this.operations.get(operationId);
    if (!operation) {
      throw new Error('Operation not found');
    }

    operation.status = 'in_progress';

    try {
      // Step 1: Mark credentials received
      await this.advanceStep(operation, 'waiting_credentials', 'Credentials received');

      // Step 2: Delete existing secret
      await this.advanceStep(operation, 'deleting_secret', 'Deleting old secret...');
      await this.k8sService.deleteSecret(this.SECRET_NAME);
      this.completeStep(operation, 'deleting_secret', 'Old secret deleted');

      // Step 3: Create new secret
      await this.advanceStep(operation, 'creating_secret', 'Creating new secret...');
      await this.k8sService.createSecret(this.SECRET_NAME, {
        'credentials.json': credentials.credentials,
        'settings.json': credentials.settings,
      });
      this.completeStep(operation, 'creating_secret', 'New secret created');

      // Step 4: Restart deployment
      await this.advanceStep(operation, 'restarting_deployment', 'Restarting deployment...');
      await this.k8sService.restartDeployment(this.DEPLOYMENT_NAME);
      this.completeStep(operation, 'restarting_deployment', 'Deployment restarted');

      // Step 5: Verify auth (with retry)
      await this.advanceStep(operation, 'verifying_auth', 'Verifying authentication...');
      const authResult = await this.verifyAuthWithRetry(3, 10000);

      if (!authResult.authenticated) {
        throw new Error(`Authentication verification failed: ${authResult.message}`);
      }
      this.completeStep(operation, 'verifying_auth', 'Authentication verified');

      // Step 6: Complete
      await this.advanceStep(operation, 'complete', 'Token refresh completed successfully');
      operation.status = 'completed';
      operation.endTime = new Date().toISOString();
    } catch (error) {
      this.failOperation(operation, error instanceof Error ? error.message : 'Unknown error');
    }

    return operation;
  }

  private async verifyAuthWithRetry(
    maxAttempts: number,
    delayMs: number
  ): Promise<{ authenticated: boolean; message?: string }> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Wait before checking (give deployment time to restart)
      await new Promise((resolve) => setTimeout(resolve, delayMs));

      const result = await this.claudeService.checkAuth();
      if (result.authenticated) {
        return { authenticated: true };
      }

      if (attempt === maxAttempts) {
        return { authenticated: false, message: result.message };
      }
    }

    return { authenticated: false, message: 'Max retry attempts reached' };
  }

  private async advanceStep(
    operation: TokenRefreshOperation,
    step: TokenRefreshStep,
    message: string
  ): Promise<void> {
    operation.currentStep = step;

    const stepStatus = operation.steps.find((s) => s.step === step);
    if (stepStatus) {
      stepStatus.status = 'in_progress';
      stepStatus.startTime = new Date().toISOString();
      stepStatus.message = message;
    }
  }

  private completeStep(
    operation: TokenRefreshOperation,
    step: TokenRefreshStep,
    message: string
  ): void {
    const stepStatus = operation.steps.find((s) => s.step === step);
    if (stepStatus) {
      stepStatus.status = 'completed';
      stepStatus.endTime = new Date().toISOString();
      stepStatus.message = message;
    }
  }

  private failOperation(operation: TokenRefreshOperation, message: string): void {
    operation.status = 'failed';
    operation.endTime = new Date().toISOString();

    const currentStepStatus = operation.steps.find((s) => s.step === operation.currentStep);
    if (currentStepStatus) {
      currentStepStatus.status = 'failed';
      currentStepStatus.endTime = new Date().toISOString();
      currentStepStatus.message = message;
    }

    operation.error = {
      step: operation.currentStep,
      message,
      remediation: REMEDIATION_MESSAGES[operation.currentStep],
    };
  }

  generateCliCommand(_operationId: string, dashboardUrl: string, sessionToken: string): string {
    return `.\\push-credentials.ps1 -DashboardUrl "${dashboardUrl}" -SessionToken "${sessionToken}"`;
  }
}
