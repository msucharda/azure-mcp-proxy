FROM node:22-slim

WORKDIR /app

# Copy proxy source
COPY package.json ./
RUN npm install --omit=dev

# Pre-install @azure/mcp so it doesn't need to download at runtime
RUN npx -y @azure/mcp@latest --version

COPY server.mjs ./

EXPOSE 8080

# Health check
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
    CMD node -e "fetch('http://localhost:8080/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "server.mjs", "--http", "8080"]
