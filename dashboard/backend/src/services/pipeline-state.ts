import { parse } from 'yaml';
import { BlobStorageService } from './blob-storage.js';
import {
  TaskEnvelope,
  PipelinePhase,
  PipelineTask,
  PipelineResponse,
  TaskDetailResponse,
  PhaseColumn,
  PHASE_INFO,
  STUCK_THRESHOLD_MS,
} from '../types/observability.js';

export class PipelineStateService {
  private blobStorageService: BlobStorageService;

  constructor(blobStorageService: BlobStorageService) {
    this.blobStorageService = blobStorageService;
  }

  /**
   * Get all task envelopes from agent-state container
   */
  async getTaskEnvelopes(): Promise<TaskEnvelope[]> {
    const envelopes: TaskEnvelope[] = [];

    try {
      // List blobs in agent-state container
      const blobList = await this.blobStorageService.listBlobs('agent-state', '', 100);

      // Each task has a folder with task-envelope.yml
      for (const folder of blobList.folders) {
        try {
          const envelopePath = `${folder}/task-envelope.yml`;
          const content = await this.blobStorageService.getBlobContent('agent-state', envelopePath);

          if (content.content) {
            const envelope = parse(content.content) as TaskEnvelope;
            // Ensure task_id is set from folder name if not in envelope
            if (!envelope.task_id) {
              envelope.task_id = folder;
            }
            envelopes.push(envelope);
          }
        } catch {
          // Skip folders without valid envelopes
          continue;
        }
      }

      // Also check for any direct blob files that might be task envelopes
      for (const blob of blobList.blobs) {
        if (blob.name === 'task-envelope.yml') {
          try {
            const content = await this.blobStorageService.getBlobContent('agent-state', blob.path);
            if (content.content) {
              const envelope = parse(content.content) as TaskEnvelope;
              envelopes.push(envelope);
            }
          } catch {
            continue;
          }
        }
      }
    } catch (error) {
      console.error('Failed to get task envelopes:', error);
    }

    return envelopes;
  }

  /**
   * Calculate how long a task has been in its current phase
   */
  calculateTimeInPhase(envelope: TaskEnvelope): number {
    const phaseStartTime = envelope.phase_started_at || envelope.created_at;
    if (!phaseStartTime) {
      return 0;
    }
    return Date.now() - new Date(phaseStartTime).getTime();
  }

  /**
   * Check if a task is stuck (in phase longer than threshold)
   */
  isStuck(envelope: TaskEnvelope, thresholdMs: number = STUCK_THRESHOLD_MS): boolean {
    // Completed or failed tasks are not stuck
    if (envelope.status === 'completed' || envelope.status === 'failed') {
      return false;
    }

    // Tasks waiting for human input have their own threshold
    if (envelope.status === 'waiting_human') {
      // Waiting tasks have a longer threshold (4 hours)
      return this.calculateTimeInPhase(envelope) > thresholdMs * 8;
    }

    return this.calculateTimeInPhase(envelope) > thresholdMs;
  }

  /**
   * Transform a task envelope into a pipeline task for display
   */
  private transformToPipelineTask(envelope: TaskEnvelope): PipelineTask {
    const timeInPhase = this.calculateTimeInPhase(envelope);
    const isStuck = this.isStuck(envelope);

    return {
      taskId: envelope.task_id,
      title: envelope.title || envelope.task_id,
      phase: envelope.phase,
      status: envelope.status,
      agent: envelope.current_agent,
      timeInPhase,
      isStuck,
      priority: envelope.priority,
      repository: envelope.repository,
      createdAt: envelope.created_at,
      updatedAt: envelope.updated_at,
      phaseStartedAt: envelope.phase_started_at,
      retryCount: envelope.error_history?.length || 0,
    };
  }

  /**
   * Get the full pipeline state with tasks grouped by phase
   */
  async getPipelineState(): Promise<PipelineResponse> {
    const envelopes = await this.getTaskEnvelopes();

    // Initialize columns for each phase
    const phases: PipelinePhase[] = [
      'intake',
      'planning',
      'implementation',
      'verification',
      'review',
      'release',
    ];

    const columns: PhaseColumn[] = phases.map((phase) => ({
      phase,
      displayName: PHASE_INFO[phase]?.displayName || phase,
      agent: PHASE_INFO[phase]?.agent || 'unknown',
      tasks: [],
    }));

    // Group tasks by phase
    for (const envelope of envelopes) {
      const task = this.transformToPipelineTask(envelope);
      const column = columns.find((c) => c.phase === envelope.phase);
      if (column) {
        column.tasks.push(task);
      }
    }

    // Sort tasks within each column (stuck first, then by time in phase)
    for (const column of columns) {
      column.tasks.sort((a, b) => {
        // Stuck tasks first
        if (a.isStuck !== b.isStuck) {
          return a.isStuck ? -1 : 1;
        }
        // Then by time in phase (longest first)
        return b.timeInPhase - a.timeInPhase;
      });
    }

    // Calculate summary stats
    const allTasks = columns.flatMap((c) => c.tasks);
    const stuckCount = allTasks.filter((t) => t.isStuck).length;
    const activeCount = allTasks.filter(
      (t) => t.status !== 'completed' && t.status !== 'failed'
    ).length;

    return {
      columns,
      summary: {
        totalTasks: allTasks.length,
        activeTasks: activeCount,
        stuckTasks: stuckCount,
        tasksByPhase: Object.fromEntries(columns.map((c) => [c.phase, c.tasks.length])) as Record<
          PipelinePhase,
          number
        >,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get detailed information about a specific task
   */
  async getTaskDetail(taskId: string): Promise<TaskDetailResponse | null> {
    try {
      const envelopePath = `${taskId}/task-envelope.yml`;
      const content = await this.blobStorageService.getBlobContent('agent-state', envelopePath);

      if (!content.content) {
        return null;
      }

      const envelope = parse(content.content) as TaskEnvelope;
      if (!envelope.task_id) {
        envelope.task_id = taskId;
      }

      const task = this.transformToPipelineTask(envelope);

      // Try to get related artifacts
      const artifacts: TaskDetailResponse['artifacts'] = {};

      // Check for spec
      try {
        const specContent = await this.blobStorageService.getBlobContent(
          'agent-spec',
          `${taskId}/spec.md`
        );
        if (specContent.content) {
          artifacts.spec = {
            path: `${taskId}/spec.md`,
            lastModified: specContent.blob.lastModified,
          };
        }
      } catch {
        // No spec file
      }

      // Check for plan
      try {
        const planContent = await this.blobStorageService.getBlobContent(
          'agent-plan',
          `${taskId}/plan.md`
        );
        if (planContent.content) {
          artifacts.plan = {
            path: `${taskId}/plan.md`,
            lastModified: planContent.blob.lastModified,
          };
        }
      } catch {
        // No plan file
      }

      return {
        task,
        envelope,
        artifacts,
        phaseHistory: envelope.phase_history || [],
        errorHistory: envelope.error_history || [],
      };
    } catch {
      return null;
    }
  }
}
