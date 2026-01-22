/**
 * Microsoft Teams webhook service for task escalation notifications
 */

import { Config } from '../config.js';

export interface EscalationPayload {
  taskId: string;
  title: string;
  currentPhase: string;
  stuckDuration: string;
  lastError?: string;
  dashboardUrl: string;
  escalatedBy?: string;
  reason?: string;
}

export interface TeamsWebhookResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class TeamsWebhookService {
  private webhookUrl: string;

  constructor(config: Config) {
    this.webhookUrl = config.teams?.webhookUrl || '';
  }

  /**
   * Check if Teams webhook is configured
   */
  isConfigured(): boolean {
    return !!this.webhookUrl && this.webhookUrl.startsWith('https://');
  }

  /**
   * Send task escalation notification to Teams channel
   */
  async sendEscalation(payload: EscalationPayload): Promise<TeamsWebhookResponse> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Teams webhook not configured',
      };
    }

    try {
      const adaptiveCard = this.buildEscalationCard(payload);

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(adaptiveCard),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Teams webhook error: ${response.status} - ${errorText}`,
        };
      }

      // Teams webhook returns 200 OK with no body on success
      // Generate a message ID from task ID and timestamp
      const messageId = `${payload.taskId}-${Date.now()}`;

      return {
        success: true,
        messageId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Build Microsoft Teams Adaptive Card for task escalation
   */
  private buildEscalationCard(payload: EscalationPayload): object {
    return {
      type: 'message',
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: {
            type: 'AdaptiveCard',
            version: '1.4',
            body: [
              {
                type: 'TextBlock',
                text: '🚨 Stuck Task Escalation',
                weight: 'Bolder',
                size: 'Large',
                color: 'Attention',
              },
              {
                type: 'TextBlock',
                text: `Task **${payload.taskId}** has been escalated and requires human intervention.`,
                wrap: true,
              },
              {
                type: 'FactSet',
                facts: [
                  {
                    title: 'Task:',
                    value: payload.title,
                  },
                  {
                    title: 'Current Phase:',
                    value: payload.currentPhase,
                  },
                  {
                    title: 'Stuck Duration:',
                    value: payload.stuckDuration,
                  },
                  ...(payload.lastError
                    ? [
                        {
                          title: 'Last Error:',
                          value: payload.lastError,
                        },
                      ]
                    : []),
                  ...(payload.escalatedBy
                    ? [
                        {
                          title: 'Escalated By:',
                          value: payload.escalatedBy,
                        },
                      ]
                    : []),
                  ...(payload.reason
                    ? [
                        {
                          title: 'Reason:',
                          value: payload.reason,
                        },
                      ]
                    : []),
                ],
              },
            ],
            actions: [
              {
                type: 'Action.OpenUrl',
                title: 'View in Dashboard',
                url: payload.dashboardUrl,
              },
            ],
          },
        },
      ],
    };
  }

  /**
   * Test webhook connectivity
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Teams webhook not configured' };
    }

    try {
      const testPayload = {
        type: 'message',
        text: 'Dashboard Teams integration test - connection successful ✅',
      };

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testPayload),
      });

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
