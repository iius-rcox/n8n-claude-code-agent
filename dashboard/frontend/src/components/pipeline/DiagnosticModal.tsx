import { useTaskDiagnostics } from '../../hooks/useTaskDiagnostics';
import { formatDuration } from '../../utils/formatting';
import styles from './DiagnosticModal.module.css';

export interface DiagnosticModalProps {
  taskId: string;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal displaying detailed diagnostic information for a stuck task
 * Shows error history, execution logs, and system health status
 */
export function DiagnosticModal({
  taskId,
  isOpen,
  onClose,
}: DiagnosticModalProps): JSX.Element | null {
  const { diagnostics, isLoading, error } = useTaskDiagnostics(isOpen ? taskId : null);

  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>🔍 Task Diagnostics: {taskId}</h2>
          <button className={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.content}>
          {isLoading && (
            <div className={styles.loading}>Loading diagnostics...</div>
          )}

          {error && (
            <div className={styles.error}>
              Failed to load diagnostics: {error.message}
            </div>
          )}

          {diagnostics && (
            <>
              {/* Basic Info */}
              <section className={styles.section}>
                <h3>Basic Information</h3>
                <div className={styles.infoGrid}>
                  <div className={styles.infoItem}>
                    <span className={styles.label}>Current Phase:</span>
                    <span className={styles.value}>{diagnostics.currentPhase}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.label}>Stuck Duration:</span>
                    <span className={styles.value}>
                      {formatDuration(diagnostics.stuckDuration)}
                    </span>
                  </div>
                  {diagnostics.executionId && (
                    <div className={styles.infoItem}>
                      <span className={styles.label}>Execution ID:</span>
                      <span className={styles.value}>{diagnostics.executionId}</span>
                    </div>
                  )}
                </div>
              </section>

              {/* Last Error */}
              {diagnostics.lastError && (
                <section className={styles.section}>
                  <h3>Last Error</h3>
                  <div className={styles.errorBox}>
                    <div className={styles.errorMessage}>
                      {diagnostics.lastError.message}
                    </div>
                    {diagnostics.lastError.stackTrace && (
                      <details className={styles.stackTrace}>
                        <summary>Stack Trace</summary>
                        <pre>{diagnostics.lastError.stackTrace}</pre>
                      </details>
                    )}
                  </div>
                </section>
              )}

              {/* Diagnostic Logs */}
              {diagnostics.diagnosticLogs && diagnostics.diagnosticLogs.length > 0 && (
                <section className={styles.section}>
                  <h3>Execution Logs</h3>
                  <div className={styles.logBox}>
                    {diagnostics.diagnosticLogs.map((log, index) => (
                      <div key={index} className={styles.logLine}>
                        {log}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Agent Health */}
              {diagnostics.agentHealth && (
                <section className={styles.section}>
                  <h3>Agent Health</h3>
                  <div className={styles.healthBox}>
                    <span
                      className={`${styles.healthIndicator} ${
                        diagnostics.agentHealth.status === 'healthy'
                          ? styles.healthy
                          : styles.unhealthy
                      }`}
                    />
                    <span>{diagnostics.agentHealth.message}</span>
                  </div>
                </section>
              )}

              {/* Retry History */}
              {diagnostics.retryHistory && diagnostics.retryHistory.length > 0 && (
                <section className={styles.section}>
                  <h3>Retry History</h3>
                  <div className={styles.retryList}>
                    {diagnostics.retryHistory.map((retry, index) => (
                      <div key={index} className={styles.retryItem}>
                        <span className={styles.retryTimestamp}>
                          {new Date(retry.timestamp).toLocaleString()}
                        </span>
                        <span
                          className={`${styles.retryResult} ${
                            retry.result === 'success'
                              ? styles.success
                              : styles.failure
                          }`}
                        >
                          {retry.result}
                        </span>
                        <span className={styles.retryMessage}>{retry.message}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.closeFooterButton} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
