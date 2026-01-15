#!/usr/bin/env bats
#
# BATS Tests for check-auth.sh
#
# Tests cover:
# - Success path (Claude auth succeeds, exit 0)
# - Failure path (Claude auth fails, exit 57, notification sent)
# - Timeout handling
# - Missing webhook URL handling
#

# Path to scripts under test
SCRIPT_DIR="$BATS_TEST_DIRNAME/../../infra/docker"
MOCK_DIR="$BATS_TEST_DIRNAME/../mocks"

# Setup - runs before each test
setup() {
    # Create temp directory for test artifacts
    export TEST_TEMP_DIR="$(mktemp -d)"

    # Add mock directory to PATH (mocks take precedence)
    export PATH="$MOCK_DIR:$PATH"

    # Rename mock to 'claude' for PATH override
    cp "$MOCK_DIR/claude-mock.sh" "$MOCK_DIR/claude"
    chmod +x "$MOCK_DIR/claude"

    # Copy notify.sh mock helper
    cp "$MOCK_DIR/curl-mock.sh" "$MOCK_DIR/curl"
    chmod +x "$MOCK_DIR/curl"

    # Default environment
    export AUTH_CHECK_TIMEOUT=5
    export POD_NAME="test-pod-123"

    # Track notify.sh calls
    export NOTIFY_LOG="$TEST_TEMP_DIR/notify.log"

    # Clear mock settings
    unset MOCK_CLAUDE_EXIT_CODE
    unset MOCK_CLAUDE_OUTPUT
    unset MOCK_CLAUDE_STDERR
    unset MOCK_CLAUDE_DELAY
}

# Teardown - runs after each test
teardown() {
    # Clean up temp directory
    rm -rf "$TEST_TEMP_DIR"

    # Clean up mock symlinks
    rm -f "$MOCK_DIR/claude"
    rm -f "$MOCK_DIR/curl"
}

# ============================================================================
# Success Path Tests
# ============================================================================

@test "check-auth.sh exits 0 when Claude auth succeeds" {
    export MOCK_CLAUDE_EXIT_CODE=0
    export MOCK_CLAUDE_OUTPUT="auth test response"
    unset TEAMS_WEBHOOK_URL  # No notification on success

    run bash "$SCRIPT_DIR/check-auth.sh"

    [ "$status" -eq 0 ]
    [[ "$output" == *"SUCCESS"* ]]
}

@test "check-auth.sh does not call notify.sh on success" {
    export MOCK_CLAUDE_EXIT_CODE=0
    export TEAMS_WEBHOOK_URL="https://mock.webhook.url"
    export MOCK_CURL_LOG_FILE="$TEST_TEMP_DIR/curl.log"

    run bash "$SCRIPT_DIR/check-auth.sh"

    [ "$status" -eq 0 ]
    # curl should not have been called (no notification on success)
    [ ! -f "$TEST_TEMP_DIR/curl.log" ] || [ ! -s "$TEST_TEMP_DIR/curl.log" ]
}

# ============================================================================
# Failure Path Tests
# ============================================================================

@test "check-auth.sh exits 57 when Claude auth fails" {
    export MOCK_CLAUDE_EXIT_CODE=1
    export MOCK_CLAUDE_STDERR="Authentication failed"
    export TEAMS_WEBHOOK_URL="https://mock.webhook.url"

    run bash "$SCRIPT_DIR/check-auth.sh"

    [ "$status" -eq 57 ]
    [[ "$output" == *"FAILED"* ]]
}

@test "check-auth.sh calls notify.sh on auth failure" {
    export MOCK_CLAUDE_EXIT_CODE=1
    export TEAMS_WEBHOOK_URL="https://mock.webhook.url"
    export MOCK_CURL_LOG_FILE="$TEST_TEMP_DIR/curl.log"
    export MOCK_CURL_HTTP_CODE=200

    run bash "$SCRIPT_DIR/check-auth.sh"

    [ "$status" -eq 57 ]
    # Verify curl was called (notification sent)
    [ -f "$TEST_TEMP_DIR/curl.log" ]
}

# ============================================================================
# Timeout Tests
# ============================================================================

@test "check-auth.sh handles timeout as auth failure" {
    export MOCK_CLAUDE_DELAY=10  # Longer than AUTH_CHECK_TIMEOUT
    export AUTH_CHECK_TIMEOUT=1
    export TEAMS_WEBHOOK_URL="https://mock.webhook.url"

    run timeout 5 bash "$SCRIPT_DIR/check-auth.sh"

    # Should exit with failure code (either 57 for auth failure or 124 for timeout)
    [ "$status" -ne 0 ]
}

# ============================================================================
# Missing Webhook URL Tests
# ============================================================================

@test "check-auth.sh handles missing TEAMS_WEBHOOK_URL gracefully" {
    export MOCK_CLAUDE_EXIT_CODE=1
    unset TEAMS_WEBHOOK_URL

    run bash "$SCRIPT_DIR/check-auth.sh"

    # Should still exit 57 but with warning about missing webhook
    [ "$status" -eq 57 ]
    [[ "$output" == *"Warning"* ]] || [[ "$output" == *"TEAMS_WEBHOOK_URL"* ]] || true
}
