#!/usr/bin/env node
/**
 * Claude Code Agent HTTP Server
 *
 * Provides HTTP endpoints for n8n integration:
 * - GET /health - Health check endpoint
 * - POST /run - Execute Claude prompt
 *
 * Features:
 * - Graceful shutdown on SIGTERM
 * - Active request tracking
 * - Exit code propagation (0=success, 57=auth failure, 124=timeout)
 */

const http = require('http');
const { spawn } = require('child_process');

// Server configuration
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DEFAULT_TIMEOUT = 300000; // 5 minutes
const MAX_TIMEOUT = 600000; // 10 minutes
const MAX_PROMPT_LENGTH = 100000;
const SHUTDOWN_GRACE_PERIOD = 120000; // 120 seconds

// Server state
let activeRequests = 0;
let isShuttingDown = false;

// Test mode - disable process.exit calls
const isTestMode = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

/**
 * Parse JSON request body
 */
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      // Prevent memory exhaustion
      if (body.length > MAX_PROMPT_LENGTH + 1000) {
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Send JSON response
 */
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

/**
 * Handle GET /health
 */
function handleHealth(req, res) {
  const status = isShuttingDown ? 'shutting_down' : 'healthy';
  const statusCode = isShuttingDown ? 503 : 200;

  sendJson(res, statusCode, {
    status,
    timestamp: new Date().toISOString(),
    activeRequests
  });
}

/**
 * Handle POST /run
 * Uses async spawn to avoid blocking the event loop (allows health checks during execution)
 */
async function handleRun(req, res) {
  const startTime = Date.now();

  // Parse request body
  let body;
  try {
    body = await parseBody(req);
  } catch (e) {
    sendJson(res, 400, { error: e.message });
    return;
  }

  // Validate prompt
  if (!body.prompt || typeof body.prompt !== 'string') {
    sendJson(res, 400, { error: 'prompt is required' });
    return;
  }

  if (body.prompt.length > MAX_PROMPT_LENGTH) {
    sendJson(res, 400, { error: 'prompt exceeds maximum length' });
    return;
  }

  // Validate timeout
  let timeout = DEFAULT_TIMEOUT;
  if (body.timeout !== undefined) {
    if (typeof body.timeout !== 'number' || body.timeout <= 0) {
      sendJson(res, 400, { error: 'timeout must be positive integer' });
      return;
    }
    if (body.timeout > MAX_TIMEOUT) {
      sendJson(res, 400, { error: 'timeout exceeds maximum' });
      return;
    }
    timeout = body.timeout;
  }

  // Validate workdir
  if (body.workdir !== undefined) {
    if (typeof body.workdir !== 'string' || !body.workdir.startsWith('/')) {
      sendJson(res, 400, { error: 'workdir must be absolute path' });
      return;
    }
  }

  // Execute Claude CLI using async spawn (non-blocking, allows health checks)
  const cwd = body.workdir || process.env.HOME || '/home/claude-agent';

  console.log(`[${new Date().toISOString()}] Starting Claude CLI for prompt: "${body.prompt.substring(0, 50)}..."`);

  try {
    const result = await new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      let killed = false;

      const child = spawn('claude', ['--dangerously-skip-permissions', '-p', body.prompt], {
        cwd,
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe']  // Close stdin immediately
      });

      console.log(`[${new Date().toISOString()}] Spawned Claude process PID: ${child.pid}`);

      // Set up timeout
      const timeoutId = setTimeout(() => {
        timedOut = true;
        killed = true;
        child.kill('SIGTERM');
        // Force kill after 5 seconds if still running
        setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
        }, 5000);
      }, timeout);

      // Collect stdout
      child.stdout.on('data', (data) => {
        console.log(`[${new Date().toISOString()}] stdout data: ${data.toString().length} bytes`);
        stdout += data.toString();
      });

      // Collect stderr
      child.stderr.on('data', (data) => {
        console.log(`[${new Date().toISOString()}] stderr data: ${data.toString().length} bytes`);
        stderr += data.toString();
      });

      // Handle process exit
      child.on('close', (code, signal) => {
        console.log(`[${new Date().toISOString()}] Process closed with code: ${code}, signal: ${signal}`);
        clearTimeout(timeoutId);
        resolve({
          status: code,
          signal,
          stdout,
          stderr,
          timedOut,
          killed
        });
      });

      // Handle spawn errors
      child.on('error', (err) => {
        console.log(`[${new Date().toISOString()}] Spawn error: ${err.message}`);
        clearTimeout(timeoutId);
        reject(err);
      });
    });

    const duration = Date.now() - startTime;
    const exitCode = result.status !== null ? result.status : 1;
    const success = exitCode === 0;

    // Handle timeout
    if (result.timedOut) {
      sendJson(res, 200, {
        success: false,
        output: result.stdout || '',
        exitCode: 124,
        duration,
        error: `Execution timed out after ${timeout}ms`
      });
      return;
    }

    // Build response
    const response = {
      success,
      output: result.stdout || '',
      exitCode,
      duration
    };

    // Add error message for failures
    if (!success) {
      if (exitCode === 57) {
        response.error = 'Authentication failed - session tokens expired';
      } else {
        response.error = result.stderr || `Process exited with code ${exitCode}`;
      }
    }

    sendJson(res, 200, response);
  } catch (e) {
    const duration = Date.now() - startTime;
    sendJson(res, 500, {
      success: false,
      output: '',
      exitCode: 1,
      duration,
      error: `Failed to spawn Claude process: ${e.message}`
    });
  }
}

/**
 * Request handler
 */
async function handleRequest(req, res) {
  // Check if shutting down
  if (isShuttingDown && req.url !== '/health') {
    sendJson(res, 503, { error: 'Server is shutting down' });
    return;
  }

  // Track active requests
  activeRequests++;

  try {
    if (req.method === 'GET' && req.url === '/health') {
      handleHealth(req, res);
    } else if (req.method === 'POST' && req.url === '/run') {
      await handleRun(req, res);
    } else {
      sendJson(res, 404, { error: 'Not found' });
    }
  } finally {
    activeRequests--;

    // Check if we can exit during shutdown
    if (isShuttingDown && activeRequests === 0 && !isTestMode) {
      console.log('All requests completed, exiting');
      process.exit(0);
    }
  }
}

// Create HTTP server
const server = http.createServer(handleRequest);

// Graceful shutdown handler
function gracefulShutdown(signal) {
  console.log(`Received ${signal}, starting graceful shutdown`);
  isShuttingDown = true;

  // Stop accepting new connections
  server.close(() => {
    console.log('HTTP server closed');
  });

  // Exit immediately if no active requests
  if (activeRequests === 0 && !isTestMode) {
    console.log('No active requests, exiting immediately');
    process.exit(0);
  }

  console.log(`Waiting for ${activeRequests} active request(s) to complete...`);

  // Force exit after grace period (skip in test mode)
  if (!isTestMode) {
    setTimeout(() => {
      console.log('Grace period expired, forcing exit');
      process.exit(1);
    }, SHUTDOWN_GRACE_PERIOD);
  }
}

// Register signal handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server only when run directly (not when imported for testing)
if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`Claude Code Agent HTTP server listening on ${HOST}:${PORT}`);
    console.log('Endpoints:');
    console.log('  GET  /health - Health check');
    console.log('  POST /run    - Execute Claude prompt');
  });
}

// Export for testing
module.exports = {
  server,
  handleRequest,
  handleHealth,
  handleRun,
  parseBody,
  sendJson,
  gracefulShutdown,
  // Export state accessors for testing
  getServerState: () => ({ activeRequests, isShuttingDown }),
  setShuttingDown: (value) => { isShuttingDown = value; },
  resetState: () => { activeRequests = 0; isShuttingDown = false; },
  // Export constants for testing
  constants: {
    PORT,
    HOST,
    DEFAULT_TIMEOUT,
    MAX_TIMEOUT,
    MAX_PROMPT_LENGTH,
    SHUTDOWN_GRACE_PERIOD
  }
};
