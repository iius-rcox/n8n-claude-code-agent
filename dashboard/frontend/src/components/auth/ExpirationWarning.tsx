import { TokenUrgencyLevel } from '../../types/auth';
import styles from './ExpirationWarning.module.css';

export interface ExpirationWarningProps {
  urgencyLevel: TokenUrgencyLevel;
  remainingMs: number;
  onRefreshNow?: () => void;
}

/**
 * Warning component for critical token expiration thresholds
 * Shows actionable warnings when token is approaching expiration
 */
export function ExpirationWarning({
  urgencyLevel,
  remainingMs,
  onRefreshNow,
}: ExpirationWarningProps): JSX.Element | null {
  // Only show warnings for warning and critical levels
  if (urgencyLevel === 'safe') {
    return null;
  }

  const isCritical = urgencyLevel === 'critical';
  const minutes = Math.floor(remainingMs / 60000);

  return (
    <div className={`${styles.warning} ${styles[urgencyLevel]}`}>
      <div className={styles.content}>
        <span className={styles.icon}>
          {isCritical ? '🚨' : '⚠️'}
        </span>
        <div className={styles.message}>
          <p className={styles.title}>
            {isCritical
              ? 'Token Expiring Soon!'
              : 'Token Expiration Warning'}
          </p>
          <p className={styles.description}>
            {isCritical
              ? `Your session token will expire in less than ${minutes} minute${minutes !== 1 ? 's' : ''}. Operations may fail soon.`
              : `Your session token will expire in ${minutes} minutes. Consider refreshing or using a long-lived token.`}
          </p>
        </div>
      </div>

      {onRefreshNow && (
        <div className={styles.actions}>
          <button
            className={styles.refreshButton}
            onClick={onRefreshNow}
          >
            🔄 Refresh Now
          </button>
        </div>
      )}
    </div>
  );
}
