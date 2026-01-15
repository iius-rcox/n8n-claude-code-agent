/**
 * Unit Tests for Claude Code Agent HTTP Server
 *
 * Tests cover:
 * - GET /health endpoint (healthy and shutting down states)
 * - POST /run endpoint (success, validation errors, exit codes)
 * - Error handling (404, invalid JSON, shutdown rejection)
 * - Graceful shutdown behavior
 *
 * All tests use mocked child_process.spawnSync to avoid real Claude CLI calls.
 */

jest.mock('child_process');

const http = require('http');
const { spawnSync } = require('child_process');
const request = require('supertest');
const {
  mockSuccess,
  mockAuthFailure,
  mockTimeout,
  mockError,
  mockSpawnFailure
} = require('../mocks/spawnSync');

// Import server after mocking child_process
const {
  server,
  resetState,
  setShuttingDown,
  getServerState,
  constants
} = require('../../infra/docker/server');

describe('Claude Code Agent HTTP Server', () => {
  beforeEach(() => {
    // Reset server state and mocks before each test
    resetState();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Close server after all tests
    await new Promise((resolve) => {
      server.close(() => resolve());
    });
  });

  // ============================================================================
  // GET /health Endpoint Tests
  // ============================================================================

  describe('GET /health', () => {
    it('returns 200 with healthy status when server is healthy', async () => {
      const response = await request(server)
        .get('/health')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(response.body.status).toBe('healthy');
      expect(response.body.activeRequests).toBeGreaterThanOrEqual(0);
      expect(response.body.timestamp).toBeDefined();
    });

    it('returns 503 with shutting_down status during shutdown', async () => {
      setShuttingDown(true);

      const response = await request(server)
        .get('/health')
        .expect(503)
        .expect('Content-Type', /json/);

      expect(response.body.status).toBe('shutting_down');
    });
  });

  // ============================================================================
  // POST /run Endpoint - Success Tests
  // ============================================================================

  describe('POST /run - Success Cases', () => {
    it('returns success for valid prompt', async () => {
      mockSuccess(spawnSync, 'Claude response output');

      const response = await request(server)
        .post('/run')
        .send({ prompt: 'test prompt' })
        .expect(200)
        .expect('Content-Type', /json/);

      expect(response.body.success).toBe(true);
      expect(response.body.exitCode).toBe(0);
      expect(response.body.output).toBe('Claude response output');
      expect(response.body.duration).toBeGreaterThanOrEqual(0);
    });

    it('passes prompt to Claude CLI correctly', async () => {
      mockSuccess(spawnSync, 'response');

      await request(server)
        .post('/run')
        .send({ prompt: 'my test prompt' })
        .expect(200);

      expect(spawnSync).toHaveBeenCalledWith(
        'claude',
        ['-p', 'my test prompt'],
        expect.objectContaining({
          encoding: 'utf-8'
        })
      );
    });

    it('uses custom workdir when provided', async () => {
      mockSuccess(spawnSync, 'response');

      await request(server)
        .post('/run')
        .send({ prompt: 'test', workdir: '/custom/path' })
        .expect(200);

      expect(spawnSync).toHaveBeenCalledWith(
        'claude',
        expect.any(Array),
        expect.objectContaining({
          cwd: '/custom/path'
        })
      );
    });

    it('uses custom timeout when provided', async () => {
      mockSuccess(spawnSync, 'response');

      await request(server)
        .post('/run')
        .send({ prompt: 'test', timeout: 60000 })
        .expect(200);

      expect(spawnSync).toHaveBeenCalledWith(
        'claude',
        expect.any(Array),
        expect.objectContaining({
          timeout: 60000
        })
      );
    });
  });

  // ============================================================================
  // POST /run Endpoint - Validation Tests
  // ============================================================================

  describe('POST /run - Validation Errors', () => {
    it('returns 400 for missing prompt', async () => {
      const response = await request(server)
        .post('/run')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('prompt is required');
    });

    it('returns 400 for non-string prompt', async () => {
      const response = await request(server)
        .post('/run')
        .send({ prompt: 123 })
        .expect(400);

      expect(response.body.error).toBe('prompt is required');
    });

    it('returns 400 for oversized prompt', async () => {
      const oversizedPrompt = 'x'.repeat(constants.MAX_PROMPT_LENGTH + 1);

      const response = await request(server)
        .post('/run')
        .send({ prompt: oversizedPrompt })
        .expect(400);

      expect(response.body.error).toBe('prompt exceeds maximum length');
    });

    it('returns 400 for negative timeout', async () => {
      const response = await request(server)
        .post('/run')
        .send({ prompt: 'test', timeout: -1 })
        .expect(400);

      expect(response.body.error).toBe('timeout must be positive integer');
    });

    it('returns 400 for zero timeout', async () => {
      const response = await request(server)
        .post('/run')
        .send({ prompt: 'test', timeout: 0 })
        .expect(400);

      expect(response.body.error).toBe('timeout must be positive integer');
    });

    it('returns 400 for timeout exceeding maximum', async () => {
      const response = await request(server)
        .post('/run')
        .send({ prompt: 'test', timeout: constants.MAX_TIMEOUT + 1 })
        .expect(400);

      expect(response.body.error).toBe('timeout exceeds maximum');
    });

    it('returns 400 for non-number timeout', async () => {
      const response = await request(server)
        .post('/run')
        .send({ prompt: 'test', timeout: 'invalid' })
        .expect(400);

      expect(response.body.error).toBe('timeout must be positive integer');
    });

    it('returns 400 for relative workdir path', async () => {
      const response = await request(server)
        .post('/run')
        .send({ prompt: 'test', workdir: 'relative/path' })
        .expect(400);

      expect(response.body.error).toBe('workdir must be absolute path');
    });

    it('returns 400 for invalid JSON body', async () => {
      const response = await request(server)
        .post('/run')
        .set('Content-Type', 'application/json')
        .send('not valid json')
        .expect(400);

      expect(response.body.error).toBe('Invalid JSON');
    });
  });

  // ============================================================================
  // POST /run Endpoint - Exit Code Tests
  // ============================================================================

  describe('POST /run - Exit Code Handling', () => {
    it('returns exit code 57 for authentication failure', async () => {
      mockAuthFailure(spawnSync);

      const response = await request(server)
        .post('/run')
        .send({ prompt: 'test' })
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.exitCode).toBe(57);
      expect(response.body.error).toBe('Authentication failed - session tokens expired');
    });

    it('returns exit code 124 for timeout', async () => {
      mockTimeout(spawnSync);

      const response = await request(server)
        .post('/run')
        .send({ prompt: 'test' })
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.exitCode).toBe(124);
      expect(response.body.error).toContain('timed out');
    });

    it('returns generic error for other exit codes', async () => {
      mockError(spawnSync, 1, 'Some error');

      const response = await request(server)
        .post('/run')
        .send({ prompt: 'test' })
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.exitCode).toBe(1);
      expect(response.body.error).toBe('Some error');
    });

    it('returns 500 for spawn failure', async () => {
      mockSpawnFailure(spawnSync, 'spawn ENOENT');

      const response = await request(server)
        .post('/run')
        .send({ prompt: 'test' })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.exitCode).toBe(1);
      expect(response.body.error).toContain('Failed to spawn Claude process');
    });
  });

  // ============================================================================
  // Error Case Tests
  // ============================================================================

  describe('Error Cases', () => {
    it('returns 404 for unknown endpoint', async () => {
      const response = await request(server)
        .get('/unknown')
        .expect(404);

      expect(response.body.error).toBe('Not found');
    });

    it('returns 404 for POST to /health', async () => {
      const response = await request(server)
        .post('/health')
        .expect(404);

      expect(response.body.error).toBe('Not found');
    });

    it('returns 404 for GET to /run', async () => {
      const response = await request(server)
        .get('/run')
        .expect(404);

      expect(response.body.error).toBe('Not found');
    });

    it('returns 503 for non-health requests during shutdown', async () => {
      setShuttingDown(true);

      const response = await request(server)
        .post('/run')
        .send({ prompt: 'test' })
        .expect(503);

      expect(response.body.error).toBe('Server is shutting down');
    });
  });

  // ============================================================================
  // Graceful Shutdown Tests
  // ============================================================================

  describe('Graceful Shutdown', () => {
    it('health endpoint still accessible during shutdown', async () => {
      setShuttingDown(true);

      const response = await request(server)
        .get('/health')
        .expect(503);

      expect(response.body.status).toBe('shutting_down');
    });

    it('tracks active requests correctly', async () => {
      // This is a simple check - activeRequests should be 0 after request completes
      mockSuccess(spawnSync, 'response');

      await request(server)
        .post('/run')
        .send({ prompt: 'test' })
        .expect(200);

      const state = getServerState();
      expect(state.activeRequests).toBe(0);
    });
  });
});
