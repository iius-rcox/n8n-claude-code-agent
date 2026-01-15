/**
 * Jest Mock Utilities for child_process.spawnSync
 *
 * Provides helper functions to configure spawnSync mock behavior
 * for testing the Claude Code Agent server.
 *
 * Usage:
 *   jest.mock('child_process');
 *   const { spawnSync } = require('child_process');
 *   const { mockSuccess, mockAuthFailure, mockTimeout } = require('./mocks/spawnSync');
 *
 *   beforeEach(() => {
 *     jest.clearAllMocks();
 *   });
 *
 *   it('handles success', () => {
 *     mockSuccess(spawnSync, 'Claude response');
 *     // ... test code
 *   });
 */

/**
 * Mock a successful Claude CLI execution
 * @param {jest.Mock} spawnSyncMock - The mocked spawnSync function
 * @param {string} output - The stdout output to return
 */
function mockSuccess(spawnSyncMock, output = 'Mock Claude response') {
  spawnSyncMock.mockReturnValue({
    status: 0,
    stdout: output,
    stderr: '',
    signal: null,
    error: null
  });
}

/**
 * Mock a Claude CLI authentication failure (exit code 57)
 * @param {jest.Mock} spawnSyncMock - The mocked spawnSync function
 */
function mockAuthFailure(spawnSyncMock) {
  spawnSyncMock.mockReturnValue({
    status: 57,
    stdout: '',
    stderr: 'Authentication failed',
    signal: null,
    error: null
  });
}

/**
 * Mock a Claude CLI timeout (exit code 124)
 * @param {jest.Mock} spawnSyncMock - The mocked spawnSync function
 */
function mockTimeout(spawnSyncMock) {
  spawnSyncMock.mockReturnValue({
    status: null,
    stdout: '',
    stderr: '',
    signal: 'SIGTERM',
    error: { code: 'ETIMEDOUT' }
  });
}

/**
 * Mock a general Claude CLI error
 * @param {jest.Mock} spawnSyncMock - The mocked spawnSync function
 * @param {number} exitCode - The exit code to return
 * @param {string} stderr - The stderr output
 */
function mockError(spawnSyncMock, exitCode = 1, stderr = 'Error occurred') {
  spawnSyncMock.mockReturnValue({
    status: exitCode,
    stdout: '',
    stderr: stderr,
    signal: null,
    error: null
  });
}

/**
 * Mock a spawn failure (process couldn't start)
 * @param {jest.Mock} spawnSyncMock - The mocked spawnSync function
 * @param {string} errorMessage - The error message
 */
function mockSpawnFailure(spawnSyncMock, errorMessage = 'spawn ENOENT') {
  spawnSyncMock.mockImplementation(() => {
    throw new Error(errorMessage);
  });
}

/**
 * Create a custom mock response
 * @param {jest.Mock} spawnSyncMock - The mocked spawnSync function
 * @param {object} response - The response object
 */
function mockCustom(spawnSyncMock, response) {
  spawnSyncMock.mockReturnValue({
    status: response.status ?? 0,
    stdout: response.stdout ?? '',
    stderr: response.stderr ?? '',
    signal: response.signal ?? null,
    error: response.error ?? null
  });
}

module.exports = {
  mockSuccess,
  mockAuthFailure,
  mockTimeout,
  mockError,
  mockSpawnFailure,
  mockCustom
};
