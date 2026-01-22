/**
 * Timing thresholds and constants for dashboard UX features
 */

// Stuck task detection
export const STUCK_TASK_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

// Token expiration warnings
export const TOKEN_WARNING_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
export const TOKEN_CRITICAL_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes
export const TOKEN_POLL_INTERVAL_MS = 60 * 1000; // 60 seconds
export const TOKEN_URGENT_NOTIFICATION_MS = 5 * 60 * 1000; // 5 minutes

// Task age heat map thresholds
export const TASK_AGE_THRESHOLDS = {
  new: 0, // 0-1 hour - green
  normal: 60 * 60 * 1000, // 1-4 hours - yellow
  aging: 4 * 60 * 60 * 1000, // 4-12 hours - orange
  stale: 12 * 60 * 60 * 1000, // 12+ hours - red
} as const;

// Performance targets
export const SEARCH_PERFORMANCE_TARGET_MS = 50;
export const AGE_CALCULATION_TARGET_MS = 10;

// Operation limits
export const MAX_BULK_RESTART_COMPONENTS = 50;
export const MAX_BULK_LOGS_COMPONENTS = 10;
export const MAX_LOG_LINES = 1000;
export const MAX_SEARCH_RESULTS = 1000;

// Debounce intervals
export const SEARCH_DEBOUNCE_MS = 150;
export const AGE_UPDATE_INTERVAL_MS = 10000; // Update task ages every 10 seconds
