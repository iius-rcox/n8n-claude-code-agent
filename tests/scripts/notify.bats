#!/usr/bin/env bats
#
# BATS Tests for notify.sh
#
# Tests cover:
# - Success path (webhook URL set, HTTP 200 response)
# - Missing webhook URL handling
# - Webhook failure handling
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

    # Rename curl mock for PATH override
    cp "$MOCK_DIR/curl-mock.sh" "$MOCK_DIR/curl"
    chmod +x "$MOCK_DIR/curl"

    # Default environment
    export POD_NAME="test-pod-123"
    export MOCK_CURL_LOG_FILE="$TEST_TEMP_DIR/curl.log"

    # Clear mock settings
    unset MOCK_CURL_EXIT_CODE
    unset MOCK_CURL_HTTP_CODE
    unset MOCK_CURL_OUTPUT
    unset MOCK_CURL_STDERR
}

# Teardown - runs after each test
teardown() {
    # Clean up temp directory
    rm -rf "$TEST_TEMP_DIR"

    # Clean up mock
    rm -f "$MOCK_DIR/curl"
}

# ============================================================================
# Success Path Tests
# ============================================================================

@test "notify.sh sends POST request when TEAMS_WEBHOOK_URL is set" {
    export TEAMS_WEBHOOK_URL="https://mock.webhook.url"
    export MOCK_CURL_HTTP_CODE=200

    run bash "$SCRIPT_DIR/notify.sh" "Test Title" "Test message body"

    [ "$status" -eq 0 ]
    # Verify curl was called
    [ -f "$TEST_TEMP_DIR/curl.log" ]
}

@test "notify.sh reports success on HTTP 200" {
    export TEAMS_WEBHOOK_URL="https://mock.webhook.url"
    export MOCK_CURL_HTTP_CODE=200

    run bash "$SCRIPT_DIR/notify.sh" "Test Title" "Test message"

    [ "$status" -eq 0 ]
    [[ "$output" == *"success"* ]] || [[ "$output" == *"200"* ]]
}

# ============================================================================
# Missing Webhook URL Tests
# ============================================================================

@test "notify.sh exits 1 when TEAMS_WEBHOOK_URL is missing" {
    unset TEAMS_WEBHOOK_URL

    run bash "$SCRIPT_DIR/notify.sh" "Test Title" "Test message"

    # Exits with error when webhook URL not set
    [ "$status" -eq 1 ]
    [[ "$output" == *"Error"* ]] || [[ "$output" == *"TEAMS_WEBHOOK_URL"* ]]
}

@test "notify.sh does not call curl when webhook URL is missing" {
    unset TEAMS_WEBHOOK_URL

    run bash "$SCRIPT_DIR/notify.sh" "Test Title" "Test message"

    # Should exit with error
    [ "$status" -eq 1 ]
    # curl should not have been called
    [ ! -f "$TEST_TEMP_DIR/curl.log" ] || [ ! -s "$TEST_TEMP_DIR/curl.log" ]
}

# ============================================================================
# Webhook Failure Tests
# ============================================================================

@test "notify.sh exits 1 on webhook failure" {
    export TEAMS_WEBHOOK_URL="https://mock.webhook.url"
    export MOCK_CURL_HTTP_CODE=400
    export MOCK_CURL_EXIT_CODE=0

    run bash "$SCRIPT_DIR/notify.sh" "Test Title" "Test message"

    # Exits with error on non-200 response
    [ "$status" -eq 1 ]
    [[ "$output" == *"Failed"* ]]
}

@test "notify.sh exits on network error" {
    export TEAMS_WEBHOOK_URL="https://mock.webhook.url"
    export MOCK_CURL_EXIT_CODE=7  # Connection refused
    export MOCK_CURL_STDERR="curl: (7) Failed to connect"

    run bash "$SCRIPT_DIR/notify.sh" "Test Title" "Test message"

    # Non-zero exit on network error
    [ "$status" -ne 0 ]
}

# ============================================================================
# Default Arguments Tests
# ============================================================================

@test "notify.sh uses default values when arguments omitted" {
    export TEAMS_WEBHOOK_URL="https://mock.webhook.url"
    export MOCK_CURL_HTTP_CODE=200

    run bash "$SCRIPT_DIR/notify.sh"

    # Should succeed when called without arguments (uses defaults)
    [ "$status" -eq 0 ]
    [[ "$output" == *"success"* ]]
}
