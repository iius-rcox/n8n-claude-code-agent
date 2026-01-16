/**
 * In-memory execution store
 * Stores last 50 execution records per data-model.md
 */

import { ExecutionRecord, ExecutionFilters, ExecutionStatus } from '../types/execution.js';

const MAX_RECORDS = 50;

class ExecutionStore {
  private executions: Map<string, ExecutionRecord> = new Map();
  private orderedIds: string[] = [];

  /**
   * Add or update an execution record
   */
  upsert(record: ExecutionRecord): void {
    const isNew = !this.executions.has(record.id);
    this.executions.set(record.id, record);

    if (isNew) {
      this.orderedIds.unshift(record.id); // Add to front (most recent)

      // Trim to max records
      while (this.orderedIds.length > MAX_RECORDS) {
        const oldId = this.orderedIds.pop();
        if (oldId) {
          this.executions.delete(oldId);
        }
      }
    }
  }

  /**
   * Get execution by ID
   */
  get(id: string): ExecutionRecord | undefined {
    return this.executions.get(id);
  }

  /**
   * List executions with optional filters
   */
  list(filters?: ExecutionFilters): ExecutionRecord[] {
    let records = this.orderedIds
      .map((id) => this.executions.get(id))
      .filter((r): r is ExecutionRecord => r !== undefined);

    // Apply status filter
    if (filters?.status) {
      records = records.filter((r) => r.status === filters.status);
    }

    // Apply limit
    if (filters?.limit && filters.limit > 0) {
      records = records.slice(0, filters.limit);
    }

    return records;
  }

  /**
   * Get total count (optionally filtered by status)
   */
  count(status?: ExecutionStatus): number {
    if (!status) {
      return this.executions.size;
    }
    return this.list({ status }).length;
  }

  /**
   * Clear all records (for testing)
   */
  clear(): void {
    this.executions.clear();
    this.orderedIds = [];
  }
}

// Singleton instance
export const executionStore = new ExecutionStore();
