import { useState, useEffect, useRef } from 'react';
import {
  TOKEN_WARNING_THRESHOLD_MS,
  TOKEN_CRITICAL_THRESHOLD_MS,
} from '../constants/thresholds';
import { TokenUrgencyLevel } from '../types/auth';

export interface UseCountdownResult {
  remainingMs: number;
  remainingFormatted: string;
  urgencyLevel: TokenUrgencyLevel;
  isExpired: boolean;
}

/**
 * Hook for real-time countdown calculation with urgency levels
 * Updates every second to provide live countdown timer
 */
export function useCountdown(expiresAt: Date | undefined | null): UseCountdownResult {
  const [now, setNow] = useState(Date.now());
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    // Update `now` every second for live countdown
    intervalRef.current = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  if (!expiresAt) {
    return {
      remainingMs: 0,
      remainingFormatted: '∞', // Infinity symbol for long-lived tokens
      urgencyLevel: 'safe',
      isExpired: false,
    };
  }

  const expiryTime = new Date(expiresAt).getTime();
  const remainingMs = Math.max(0, expiryTime - now);
  const isExpired = remainingMs === 0;

  // Determine urgency level
  let urgencyLevel: TokenUrgencyLevel;
  if (remainingMs > TOKEN_WARNING_THRESHOLD_MS) {
    urgencyLevel = 'safe';
  } else if (remainingMs > TOKEN_CRITICAL_THRESHOLD_MS) {
    urgencyLevel = 'warning';
  } else {
    urgencyLevel = 'critical';
  }

  // Format remaining time
  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  let remainingFormatted: string;
  if (hours > 0) {
    remainingFormatted = `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    remainingFormatted = `${minutes}m ${seconds}s`;
  } else {
    remainingFormatted = `${seconds}s`;
  }

  return {
    remainingMs,
    remainingFormatted,
    urgencyLevel,
    isExpired,
  };
}
