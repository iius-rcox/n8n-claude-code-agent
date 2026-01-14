#!/bin/bash
#
# Teams Notification Script
#
# Sends formatted notifications to Microsoft Teams via webhook.
# Uses Adaptive Card format for rich formatting with action buttons.
#
# Usage:
#   ./notify.sh "Title" "Message"
#
# Environment Variables:
#   TEAMS_WEBHOOK_URL - Teams webhook URL (required)
#   POD_NAME - Kubernetes pod name (optional, defaults to hostname)
#   DOCS_URL - URL to documentation (optional)
#

set -e

# Arguments
TITLE="${1:-Alert}"
MESSAGE="${2:-An alert was triggered}"

# Environment
WEBHOOK_URL="${TEAMS_WEBHOOK_URL}"
POD="${POD_NAME:-$(hostname)}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
DOCS="${DOCS_URL:-https://github.com/ii-us/n8n-claude-code-agent#token-refresh}"

# Validate webhook URL
if [ -z "$WEBHOOK_URL" ]; then
    echo "Error: TEAMS_WEBHOOK_URL environment variable not set"
    exit 1
fi

# Build notification payload (MessageCard format for Teams)
PAYLOAD=$(cat <<EOF
{
  "@type": "MessageCard",
  "@context": "http://schema.org/extensions",
  "themeColor": "FF0000",
  "summary": "${TITLE}",
  "sections": [{
    "activityTitle": "🔴 ${TITLE}",
    "facts": [
      {
        "name": "Pod",
        "value": "${POD}"
      },
      {
        "name": "Time",
        "value": "${TIMESTAMP}"
      }
    ],
    "text": "${MESSAGE}",
    "markdown": true
  }],
  "potentialAction": [{
    "@type": "OpenUri",
    "name": "View Refresh Steps",
    "targets": [{
      "os": "default",
      "uri": "${DOCS}"
    }]
  }]
}
EOF
)

echo "Sending notification to Teams..."
echo "Title: ${TITLE}"
echo "Pod: ${POD}"

# Send notification
HTTP_CODE=$(curl -s -o /tmp/teams_response.txt -w "%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "${PAYLOAD}" \
    "${WEBHOOK_URL}")

RESPONSE=$(cat /tmp/teams_response.txt 2>/dev/null || echo "No response")
rm -f /tmp/teams_response.txt

if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 202 ]; then
    echo "Notification sent successfully (HTTP ${HTTP_CODE})"
    exit 0
else
    echo "Failed to send notification (HTTP ${HTTP_CODE})"
    echo "Response: ${RESPONSE}"
    exit 1
fi
