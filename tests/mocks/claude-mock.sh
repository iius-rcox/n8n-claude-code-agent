#!/bin/bash
#
# Mock Claude CLI for BATS Testing
#
# This script simulates the Claude CLI behavior for testing check-auth.sh.
# Control behavior via environment variables:
#
#   MOCK_CLAUDE_EXIT_CODE - Exit code to return (default: 0)
#   MOCK_CLAUDE_OUTPUT    - stdout output (default: "mock auth test response")
#   MOCK_CLAUDE_STDERR    - stderr output (default: "")
#   MOCK_CLAUDE_DELAY     - Delay in seconds before responding (default: 0)
#
# Usage in BATS tests:
#   export PATH="$BATS_TEST_DIRNAME/../mocks:$PATH"
#   export MOCK_CLAUDE_EXIT_CODE=0
#   run check-auth.sh
#

# Apply delay if specified
if [ -n "$MOCK_CLAUDE_DELAY" ] && [ "$MOCK_CLAUDE_DELAY" -gt 0 ]; then
    sleep "$MOCK_CLAUDE_DELAY"
fi

# Output to stdout
if [ -n "$MOCK_CLAUDE_OUTPUT" ]; then
    echo "$MOCK_CLAUDE_OUTPUT"
else
    echo "mock auth test response"
fi

# Output to stderr
if [ -n "$MOCK_CLAUDE_STDERR" ]; then
    echo "$MOCK_CLAUDE_STDERR" >&2
fi

# Exit with specified code (default 0)
exit "${MOCK_CLAUDE_EXIT_CODE:-0}"
