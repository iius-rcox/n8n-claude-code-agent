import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer, Server } from 'http';
import { getConfig, Config } from './config.js';
import { errorHandler } from './api/middleware/error.js';
import { createApiRouter } from './api/routes/index.js';

let server: Server | null = null;
let isShuttingDown = false;

async function startServer(): Promise<void> {
  let config: Config;

  try {
    config = getConfig();
  } catch (error) {
    console.error('Failed to load configuration:', error);
    process.exit(1);
  }

  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  // Health check endpoints (no auth required)
  app.get('/health', (_req, res) => {
    if (isShuttingDown) {
      res.status(503).json({ status: 'shutting_down' });
    } else {
      res.json({ status: 'healthy' });
    }
  });

  app.get('/ready', (_req, res) => {
    if (isShuttingDown) {
      res.status(503).json({ status: 'not_ready' });
    } else {
      res.json({ status: 'ready' });
    }
  });

  // API routes
  app.use('/api', createApiRouter(config));

  // Serve static files in combined container mode
  const staticFilesPath = process.env.STATIC_FILES_PATH;
  if (staticFilesPath) {
    console.log(`Serving static files from ${staticFilesPath}`);
    app.use(express.static(staticFilesPath));

    // SPA fallback - serve index.html for non-API routes
    app.get('*', (_req, res) => {
      res.sendFile(path.join(staticFilesPath, 'index.html'));
    });
  }

  // Error handling
  app.use(errorHandler);

  // Create HTTP server
  server = createServer(app);

  // Start listening
  server.listen(config.port, () => {
    console.log(`Operations Dashboard backend listening on port ${config.port}`);
  });

  // Track connections for graceful shutdown
  const connections = new Set<import('net').Socket>();

  server.on('connection', (conn) => {
    connections.add(conn);
    conn.on('close', () => {
      connections.delete(conn);
    });
  });

  // Graceful shutdown handler
  const shutdown = async (signal: string): Promise<void> => {
    if (isShuttingDown) {
      console.log('Shutdown already in progress...');
      return;
    }

    console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
    isShuttingDown = true;

    // Stop accepting new connections
    if (server) {
      server.close((err) => {
        if (err) {
          console.error('Error closing server:', err);
        } else {
          console.log('Server closed successfully');
        }
      });
    }

    // Give existing connections time to complete (30 second timeout)
    const shutdownTimeout = setTimeout(() => {
      console.log('Shutdown timeout reached, forcing close...');
      connections.forEach((conn) => conn.destroy());
      process.exit(0);
    }, 30000);

    // Wait for connections to drain
    const checkConnections = setInterval(() => {
      if (connections.size === 0) {
        clearInterval(checkConnections);
        clearTimeout(shutdownTimeout);
        console.log('All connections drained. Exiting.');
        process.exit(0);
      }
    }, 100);
  };

  // Register signal handlers
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
