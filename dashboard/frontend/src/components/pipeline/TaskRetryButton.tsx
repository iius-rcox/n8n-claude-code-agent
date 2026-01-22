import { useMutation } from '@tanstack/react-query';
import { tasksApi } from '../../services/tasksApi';
import styles from './TaskRetryButton.module.css';

export interface TaskRetryButtonProps {
  taskId: string;
  taskTitle?: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  variant?: 'primary' | 'secondary';
}

/**
 * Standalone retry button for tasks
 * Can be used independently or as part of StuckTaskActions
 */
export function TaskRetryButton({
  taskId,
  taskTitle,
  onSuccess,
  onError,
  variant = 'primary',
}: TaskRetryButtonProps): JSX.Element {
  const retryMutation = useMutation({
    mutationFn: () => tasksApi.retryTask(taskId),
    onSuccess: (result) => {
      if (result.success) {
        onSuccess?.();
      } else {
        const error = new Error(result.error || 'Retry failed');
        onError?.(error);
      }
    },
    onError: (error: Error) => {
      onError?.(error);
    },
  });

  const handleClick = (): void => {
    const title = taskTitle || taskId;
    if (confirm(`Retry task "${title}"? This will restart the entire workflow.`)) {
      retryMutation.mutate();
    }
  };

  return (
    <button
      className={`${styles.button} ${styles[variant]}`}
      onClick={handleClick}
      disabled={retryMutation.isPending}
    >
      {retryMutation.isPending ? (
        <>
          <span className={styles.spinner} />
          Retrying...
        </>
      ) : (
        <>
          <span className={styles.icon}>🔄</span>
          Retry
        </>
      )}
    </button>
  );
}
