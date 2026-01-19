import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';

export interface PipelineUpdateEvent {
  type: 'task_created' | 'task_updated' | 'task_cancelled' | 'pipeline_refresh';
  taskId?: string;
  timestamp: string;
}

export class WebSocketService {
  private io: Server | null = null;

  /**
   * Initialize Socket.IO with the HTTP server
   */
  initialize(httpServer: HttpServer): void {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST'],
      },
      // Path matches frontend expectations
      path: '/socket.io',
    });

    this.io.on('connection', (socket: Socket) => {
      console.log(`[WebSocket] Client connected: ${socket.id}`);

      // Join the pipeline room for updates
      socket.join('pipeline');

      socket.on('disconnect', () => {
        console.log(`[WebSocket] Client disconnected: ${socket.id}`);
      });

      // Clients can request a refresh
      socket.on('request_refresh', () => {
        console.log(`[WebSocket] Refresh requested by: ${socket.id}`);
        this.emitPipelineUpdate({
          type: 'pipeline_refresh',
          timestamp: new Date().toISOString(),
        });
      });
    });

    console.log('[WebSocket] Server initialized');
  }

  /**
   * Emit a pipeline update to all connected clients
   */
  emitPipelineUpdate(event: PipelineUpdateEvent): void {
    if (!this.io) {
      console.warn('[WebSocket] Server not initialized, cannot emit event');
      return;
    }
    this.io.to('pipeline').emit('pipeline_update', event);
    console.log(`[WebSocket] Emitted ${event.type} event`);
  }

  /**
   * Emit task cancelled event
   */
  emitTaskCancelled(taskId: string): void {
    this.emitPipelineUpdate({
      type: 'task_cancelled',
      taskId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit task updated event
   */
  emitTaskUpdated(taskId: string): void {
    this.emitPipelineUpdate({
      type: 'task_updated',
      taskId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit task created event
   */
  emitTaskCreated(taskId: string): void {
    this.emitPipelineUpdate({
      type: 'task_created',
      taskId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get number of connected clients
   */
  getConnectedClients(): number {
    if (!this.io) return 0;
    return this.io.engine.clientsCount;
  }
}

// Singleton instance
export const websocketService = new WebSocketService();
