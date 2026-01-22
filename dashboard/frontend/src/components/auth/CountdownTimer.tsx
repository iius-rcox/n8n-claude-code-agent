import React from 'react';
import { useCountdown } from '../../hooks/useCountdown';
import { TokenUrgencyLevel } from '../../types/auth';
import styles from './CountdownTimer.module.css';

export interface CountdownTimerProps {
  expiresAt: Date | undefined | null;
  method: 'session' | 'long-lived';
}

/**
 * Real-time countdown timer for token expiration
 * Color-coded by urgency: green (safe), yellow (warning), red (critical)
 */
export function CountdownTimer({ expiresAt, method }: CountdownTimerProps): JSX.Element {
  const { remainingFormatted, urgencyLevel, isExpired } = useCountdown(expiresAt);

  if (method === 'long-lived') {
    return (
      <div className={`${styles.timer} ${styles.safe}`}>
        <span className={styles.icon}>♾️</span>
        <span className={styles.time}>Long-lived token</span>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className={`${styles.timer} ${styles.expired}`}>
        <span className={styles.icon}>⚠️</span>
        <span className={styles.time}>Expired</span>
      </div>
    );
  }

  return (
    <div className={`${styles.timer} ${styles[urgencyLevel]}`}>
      <span className={styles.icon}>{getUrgencyIcon(urgencyLevel)}</span>
      <span className={styles.time}>{remainingFormatted}</span>
      <span className={styles.label}>until expiration</span>
    </div>
  );
}

function getUrgencyIcon(level: TokenUrgencyLevel): string {
  switch (level) {
    case 'safe':
      return '✅';
    case 'warning':
      return '⚠️';
    case 'critical':
      return '🚨';
  }
}
