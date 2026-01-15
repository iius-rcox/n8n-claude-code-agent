# Claude Code Agent Container Image
# Version: v4.6.4
# Base: Ubuntu 24.04 LTS
# Change: Moved server files to /opt/claude-agent/ to allow /home/claude-agent emptyDir mount

FROM ubuntu:24.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install base packages (including dos2unix for line ending conversion)
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    gnupg \
    jq \
    wget \
    lsb-release \
    dos2unix \
    && rm -rf /var/lib/apt/lists/*

# Install Azure CLI
RUN curl -sL https://aka.ms/InstallAzureCLIDeb | bash

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt-get update \
    && apt-get install -y gh \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20.x LTS
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install yq (YAML processor)
RUN wget -qO /usr/local/bin/yq https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64 \
    && chmod +x /usr/local/bin/yq

# Install Claude CLI globally
RUN npm install -g @anthropic-ai/claude-code

# Create non-root user
# Ubuntu 24.04 has ubuntu user at UID 1000, so we use a different UID
RUN groupadd -g 1001 claude-agent \
    && useradd -u 1001 -g 1001 -m -s /bin/bash claude-agent

# Create directories for session data and workspace
RUN mkdir -p /home/claude-agent/.claude \
    && mkdir -p /workspace \
    && mkdir -p /opt/claude-agent \
    && chown -R 1001:1001 /home/claude-agent \
    && chown -R 1001:1001 /workspace \
    && chown -R 1001:1001 /opt/claude-agent

# Copy HTTP server script to /opt (not /home, which will be mounted as emptyDir)
COPY server.js /opt/claude-agent/server.js

# Copy authentication monitoring scripts and ensure Unix line endings
COPY check-auth.sh /opt/claude-agent/check-auth.sh
COPY notify.sh /opt/claude-agent/notify.sh
RUN dos2unix /opt/claude-agent/check-auth.sh /opt/claude-agent/notify.sh \
    && chmod +x /opt/claude-agent/check-auth.sh /opt/claude-agent/notify.sh

# Switch to non-root user
USER claude-agent
WORKDIR /workspace

# Expose HTTP server port
EXPOSE 3000

# Start HTTP server (from /opt, not /home which is mounted as emptyDir)
ENTRYPOINT ["node", "/opt/claude-agent/server.js"]
