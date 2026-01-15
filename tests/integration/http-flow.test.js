/**
 * Integration Tests for Claude Code Agent HTTP Server
 *
 * Tests verify the complete HTTP → CLI flow with realistic mocks.
 *
 * Tests cover:
 * - Full request/response cycle
 * - Graceful shutdown behavior (SIGTERM handling)
 * - Concurrent request handling
 */

jest.mock('child_process');

const http = require('http');
const { spawnSync } = require('child_process');
const request = require('supertest');
const {
  mockSuccess,
  mockAuthFailure,
  mockTimeout
} = require('../mocks/spawnSync');

// Import server after mocking
const {
  server,
  resetState,
  setShuttingDown,
  getServerState
} = require('../../infra/docker/server');

describe('Integration Tests - HTTP Flow', () => {
  beforeEach(() => {
    resetState();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await new Promise((resolve) => {
      server.close(() => resolve());
    });
  });

  // ============================================================================
  // Full Request/Response Cycle Tests
  // ============================================================================

  describe('Full Request/Response Cycle', () => {
    it('processes prompt and returns Claude response', async () => {
      mockSuccess(spawnSync, 'This is a response from Claude CLI');

      const response = await request(server)
        .post('/run')
        .send({ prompt: 'Hello, Claude!' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.output).toBe('This is a response from Claude CLI');
      expect(response.body.exitCode).toBe(0);
      expect(response.body.duration).toBeGreaterThanOrEqual(0);
    });

    it('correctly passes all parameters to Claude CLI', async () => {
      mockSuccess(spawnSync, 'response');

      await request(server)
        .post('/run')
        .send({
          prompt: 'Generate code for feature X',
          workdir: '/workspace/project',
          timeout: 120000
        })
        .expect(200);

      expect(spawnSync).toHaveBeenCalledWith(
        'claude',
        ['-p', 'Generate code for feature X'],
        expect.objectContaining({
          cwd: '/workspace/project',
          timeout: 120000,
          encoding: 'utf-8'
        })
      );
    });

    it('handles auth failure response correctly', async () => {
      mockAuthFailure(spawnSync);

      const response = await request(server)
        .post('/run')
        .send({ prompt: 'test' })
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.exitCode).toBe(57);
      expect(response.body.error).toContain('session tokens expired');
    });

    it('handles timeout response correctly', async () => {
      mockTimeout(spawnSync);

      const response = await request(server)
        .post('/run')
        .send({ prompt: 'test', timeout: 1000 })
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.exitCode).toBe(124);
      expect(response.body.error).toContain('timed out');
    });
  });

  // ============================================================================
  // Graceful Shutdown Tests
  // ============================================================================

  describe('Graceful Shutdown Behavior', () => {
    it('rejects new /run requests during shutdown', async () => {
      setShuttingDown(true);

      const response = await request(server)
        .post('/run')
        .send({ prompt: 'test' })
        .expect(503);

      expect(response.body.error).toBe('Server is shutting down');
    });

    it('still serves /health during shutdown', async () => {
      setShuttingDown(true);

      const response = await request(server)
        .get('/health')
        .expect(503);

      expect(response.body.status).toBe('shutting_down');
      expect(response.body.timestamp).toBeDefined();
    });

    it('tracks activeRequests state', () => {
      const state = getServerState();
      expect(state.activeRequests).toBeDefined();
      expect(typeof state.activeRequests).toBe('number');
    });
  });

  // ============================================================================
  // Concurrent Request Handling Tests
  // ============================================================================

  describe('Concurrent Request Handling', () => {
    it('handles multiple sequential requests', async () => {
      mockSuccess(spawnSync, 'response 1');
      const response1 = await request(server)
        .post('/run')
        .send({ prompt: 'request 1' })
        .expect(200);
      expect(response1.body.success).toBe(true);

      mockSuccess(spawnSync, 'response 2');
      const response2 = await request(server)
        .post('/run')
        .send({ prompt: 'request 2' })
        .expect(200);
      expect(response2.body.success).toBe(true);

      mockSuccess(spawnSync, 'response 3');
      const response3 = await request(server)
        .post('/run')
        .send({ prompt: 'request 3' })
        .expect(200);
      expect(response3.body.success).toBe(true);
    });

    it('handles concurrent health checks', async () => {
      // Launch multiple health checks in parallel
      const promises = [
        request(server).get('/health'),
        request(server).get('/health'),
        request(server).get('/health')
      ];

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('healthy');
      });
    });

    it('handles mixed concurrent requests', async () => {
      mockSuccess(spawnSync, 'Claude response');

      // Mix of health checks and run requests
      const promises = [
        request(server).get('/health'),
        request(server).post('/run').send({ prompt: 'test 1' }),
        request(server).get('/health'),
        request(server).post('/run').send({ prompt: 'test 2' })
      ];

      const responses = await Promise.all(promises);

      // Health checks should return 200
      expect(responses[0].status).toBe(200);
      expect(responses[0].body.status).toBe('healthy');
      expect(responses[2].status).toBe(200);

      // Run requests should return 200
      expect(responses[1].status).toBe(200);
      expect(responses[1].body.success).toBe(true);
      expect(responses[3].status).toBe(200);
      expect(responses[3].body.success).toBe(true);
    });
  });

  // ============================================================================
  // Error Recovery Tests
  // ============================================================================

  describe('Error Recovery', () => {
    it('recovers from validation errors', async () => {
      // First request with invalid data
      const response1 = await request(server)
        .post('/run')
        .send({})
        .expect(400);
      expect(response1.body.error).toBe('prompt is required');

      // Second request with valid data should work
      mockSuccess(spawnSync, 'success');
      const response2 = await request(server)
        .post('/run')
        .send({ prompt: 'valid prompt' })
        .expect(200);
      expect(response2.body.success).toBe(true);
    });

    it('recovers from Claude CLI errors', async () => {
      // First request causes CLI error
      mockAuthFailure(spawnSync);
      const response1 = await request(server)
        .post('/run')
        .send({ prompt: 'test' })
        .expect(200);
      expect(response1.body.exitCode).toBe(57);

      // Second request should work
      mockSuccess(spawnSync, 'success');
      const response2 = await request(server)
        .post('/run')
        .send({ prompt: 'test' })
        .expect(200);
      expect(response2.body.success).toBe(true);
    });
  });
});
