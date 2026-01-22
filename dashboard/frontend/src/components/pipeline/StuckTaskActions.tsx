import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { tasksApi } from '../../services/tasksApi';
import { StuckTask } from '../../types/task';
import styles from './StuckTaskActions.module.css';

export interface StuckTaskActionsProps {
  task: StuckTask;
  onRetrySuccess?: () => void;
  onEscalateSuccess?: () => void;
  onOpenDiagnostics?: () => void;
}

/**
 * Action buttons for stuck task resolution
 * Provides retry, diagnostics, and escalation options
 */
export function StuckTaskActions({
  task,
  onRetrySuccess,
  onEscalateSuccess,
  onOpenDiagnostics,
}: StuckTaskActionsProps): JSX.Element {
  const [escalationReason, setEscalationReason] = useState('');
  const [showEscalationInput, setShowEscalationInput] = useState(false);

  // Retry task mutation
  const retryMutation = useMutation({
    mutationFn: () => tasksApi.retryTask(task.id),
    onSuccess: (result) => {
      if (result.success) {
        alert(`Task ${task.id} retry initiated successfully`);
        onRetrySuccess?.();
      } else {
        alert(`Failed to retry task: ${result.error || 'Unknown error'}`);
      }
    },
    onError: (error) => {
      alert(`Error retrying task: ${error instanceof Error ? error.message : 'Unknown error'}`);
    },
  });

  // Escalate task mutation
  const escalateMutation = useMutation({
    mutationFn: (reason: string) =>
      tasksApi.escalateTask(task.id, {
        reason,
        escalatedBy: 'dashboard-user', // TODO: Get from auth context
      }),
    onSuccess: (result) => {
      if (result.success) {
        alert(`Task ${task.id} escalated to on-call team via Teams`);
        setShowEscalationInput(false);
        setEscalationReason('');
        onEscalateSuccess?.();
      } else {
        alert(`Failed to escalate task: ${result.error || 'Unknown error'}`);
      }
    },
    onError: (error) => {
      alert(`Error escalating task: ${error instanceof Error ? error.message : 'Unknown error'}`);
    },
  });

  const handleRetry = (): void => {
    if (confirm(`Retry task "${task.title}"? This will restart the entire workflow.`)) {
      retryMutation.mutate();
    }
  };

  const handleEscalate = (): void => {
    if (!showEscalationInput) {
      setShowEscalationInput(true);
      return;
    }

    if (!escalationReason.trim()) {
      alert('Please provide a reason for escalation');
      return;
    }

    if (confirm(`Escalate task "${task.title}" to the on-call team?`)) {
      escalateMutation.mutate(escalationReason);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.actions}>
        <button
          className={styles.retryButton}
          onClick={handleRetry}
          disabled={retryMutation.isPending}
        >
          {retryMutation.isPending ? 'Retrying...' : '🔄 Retry Task'}
        </button>

        <button
          className={styles.diagnosticsButton}
          onClick={onOpenDiagnostics}
        >
          🔍 Why Stuck?
        </button>

        <button
          className={styles.escalateButton}
          onClick={handleEscalate}
          disabled={escalateMutation.isPending}
        >
          {escalateMutation.isPending ? 'Escalating...' : '🚨 Escalate'}
        </button>
      </div>

      {showEscalationInput && (
        <div className={styles.escalationInput}>
          <input
            type="text"
            placeholder="Reason for escalation..."
            value={escalationReason}
            onChange={(e) => setEscalationReason(e.target.value)}
            className={styles.input}
          />
          <button
            className={styles.submitButton}
            onClick={handleEscalate}
            disabled={!escalationReason.trim() || escalateMutation.isPending}
          >
            Send
          </button>
          <button
            className={styles.cancelButton}
            onClick={() => {
              setShowEscalationInput(false);
              setEscalationReason('');
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
