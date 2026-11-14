# Build context: repository root. TypeScript runs directly on Node 22 with type stripping.
FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
RUN npm ci --omit=dev --workspace @mini-philia/api --include-workspace-root=false
COPY apps/api/src apps/api/src
USER node
WORKDIR /app/apps/api
EXPOSE 8080
CMD ["node", "src/server.ts"]
