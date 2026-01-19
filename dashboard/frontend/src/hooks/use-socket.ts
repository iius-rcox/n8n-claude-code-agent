import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface PipelineUpdateEvent {
  type: 'task_created' | 'task_updated' | 'task_cancelled' | 'pipeline_refresh';
  taskId?: string;
  timestamp: string;
}

interface UseSocketReturn {
  isConnected: boolean;
  lastEvent: PipelineUpdateEvent | null;
  requestRefresh: () => void;
}

export function useSocket(onPipelineUpdate?: (event: PipelineUpdateEvent) => void): UseSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<PipelineUpdateEvent | null>(null);
  const callbackRef = useRef(onPipelineUpdate);

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = onPipelineUpdate;
  }, [onPipelineUpdate]);

  useEffect(() => {
    // Get the API base URL or use current origin
    const baseUrl = import.meta.env.VITE_API_BASE_URL || window.location.origin;

    const socket = io(baseUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id);
      setIsConnected(true);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.warn('[Socket] Connection error:', error.message);
    });

    socket.on('pipeline_update', (event: PipelineUpdateEvent) => {
      console.log('[Socket] Pipeline update:', event);
      setLastEvent(event);
      if (callbackRef.current) {
        callbackRef.current(event);
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const requestRefresh = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('request_refresh');
    }
  }, []);

  return {
    isConnected,
    lastEvent,
    requestRefresh,
  };
}
