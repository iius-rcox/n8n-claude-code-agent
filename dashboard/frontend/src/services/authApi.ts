import { TokenExpiration, TokenMethod, TokenUrgencyLevel } from '../types/auth';
import {
  TOKEN_WARNING_THRESHOLD_MS,
  TOKEN_CRITICAL_THRESHOLD_MS,
} from '../constants/thresholds';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Auth API client for token status and expiration tracking
 */
export const authApi = {
  /**
   * Get current token expiration status
   * Calculates remaining time and urgency level
   */
  async getTokenStatus(): Promise<TokenExpiration> {
    const response = await fetch(`${API_BASE_URL}/auth/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies for authentication
    });

    if (!response.ok) {
      throw new Error('Failed to fetch token status');
    }

    const data = await response.json();

    // Determine token method based on expiry presence
    const method: TokenMethod = data.expiryEstimate ? 'session' : 'long-lived';

    // Calculate remaining time if expiry is available
    let expiresAt: Date | undefined;
    let remainingMs: number | undefined;
    let urgencyLevel: TokenUrgencyLevel;

    if (data.expiryEstimate) {
      expiresAt = new Date(data.expiryEstimate);
      const now = Date.now();
      remainingMs = Math.max(0, expiresAt.getTime() - now);

      // Determine urgency level
      if (remainingMs > TOKEN_WARNING_THRESHOLD_MS) {
        urgencyLevel = 'safe';
      } else if (remainingMs > TOKEN_CRITICAL_THRESHOLD_MS) {
        urgencyLevel = 'warning';
      } else {
        urgencyLevel = 'critical';
      }
    } else {
      // Long-lived token - no expiration
      urgencyLevel = 'safe';
    }

    return {
      method,
      expiresAt,
      remainingMs,
      urgencyLevel,
      lastRefreshed: data.lastChecked ? new Date(data.lastChecked) : undefined,
    };
  },
};
