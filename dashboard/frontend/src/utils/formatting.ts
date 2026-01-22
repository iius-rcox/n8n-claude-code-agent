/**
 * Utility functions for formatting and parsing
 */

/**
 * Format duration in milliseconds to human-readable string
 * @param ms Duration in milliseconds
 * @returns Formatted string like "45m", "3h 20m", "2d"
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d`;
  }

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return `${seconds}s`;
}

/**
 * Parse component ID into constituent parts
 * @param componentId Component ID in format "namespace/resource-type/name"
 * @returns Object with namespace, resourceType, and name
 */
export function parseComponentId(componentId: string): {
  namespace: string;
  resourceType: string;
  name: string;
} {
  const parts = componentId.split('/');

  if (parts.length !== 3) {
    throw new Error(`Invalid component ID format: ${componentId}. Expected "namespace/resource-type/name"`);
  }

  const [namespace, resourceType, name] = parts;
  return { namespace, resourceType, name };
}

/**
 * Highlight matched text in a string
 * @param text Full text to search in
 * @param query Search query
 * @returns Object with before, match, and after segments
 */
export function highlightMatch(text: string, query: string): {
  before: string;
  match: string;
  after: string;
} {
  if (!query.trim()) {
    return { before: text, match: '', after: '' };
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) {
    return { before: text, match: '', after: '' };
  }

  return {
    before: text.slice(0, index),
    match: text.slice(index, index + query.length),
    after: text.slice(index + query.length),
  };
}

/**
 * Format ISO 8601 timestamp to local date/time string
 * @param isoString ISO 8601 timestamp string
 * @returns Formatted local date/time string
 */
export function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleString();
  } catch {
    return isoString;
  }
}

/**
 * Calculate remaining time in milliseconds from expiration timestamp
 * @param expiresAt Expiration date
 * @returns Remaining milliseconds, or 0 if expired
 */
export function getRemainingMs(expiresAt: Date): number {
  const now = Date.now();
  const remaining = expiresAt.getTime() - now;
  return Math.max(0, remaining);
}
