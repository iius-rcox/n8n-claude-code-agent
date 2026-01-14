# Claude Code Agent Container Image
# Version: v4.6.2
# Base: Ubuntu 24.04 LTS

FROM ubuntu:24.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install base packages
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    gnupg \
    jq \
    wget \
    lsb-release \
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
    && chown -R 1001:1001 /home/claude-agent \
    && chown -R 1001:1001 /workspace

# Copy HTTP server script
COPY server.js /home/claude-agent/server.js

# Copy authentication monitoring scripts
COPY check-auth.sh /home/claude-agent/check-auth.sh
COPY notify.sh /home/claude-agent/notify.sh
RUN chmod +x /home/claude-agent/check-auth.sh /home/claude-agent/notify.sh

# Switch to non-root user
USER claude-agent
WORKDIR /home/claude-agent

# Expose HTTP server port
EXPOSE 3000

# Start HTTP server
ENTRYPOINT ["node", "/home/claude-agent/server.js"]
