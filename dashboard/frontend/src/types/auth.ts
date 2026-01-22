/**
 * Authentication token type
 */
export type TokenMethod = 'session' | 'long-lived';

/**
 * Token urgency level for countdown timer coloring
 * - safe: >30 minutes remaining (green)
 * - warning: 10-30 minutes remaining (yellow)
 * - critical: <10 minutes remaining (red)
 */
export type TokenUrgencyLevel = 'safe' | 'warning' | 'critical';

/**
 * Represents the current state of Claude API authentication tokens
 */
export interface TokenExpiration {
  method: TokenMethod;
  expiresAt?: Date; // undefined for long-lived tokens
  remainingMs?: number; // undefined for long-lived tokens
  urgencyLevel: TokenUrgencyLevel;
  lastRefreshed?: Date;
}

/**
 * Token status from backend API
 */
export interface TokenStatus {
  authenticated: boolean;
  method: TokenMethod;
  expiresAt?: string; // ISO 8601 timestamp
  lastRefreshed?: string; // ISO 8601 timestamp
  error?: string;
}

/**
 * Request payload for token refresh
 */
export interface RefreshTokenRequest {
  sessionToken: string;
  method: TokenMethod;
}

/**
 * Response from token refresh operation
 */
export interface RefreshTokenResponse {
  success: boolean;
  message: string;
  method: TokenMethod;
  expiresAt?: string; // ISO 8601 timestamp
  restartStatus: 'initiated' | 'completed' | 'failed';
}
