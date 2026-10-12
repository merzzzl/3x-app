# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json client-groups.json ./
COPY src ./src
COPY public ./public
COPY scripts ./scripts
RUN npm run check && npm run build
RUN npm prune --omit=dev && npm cache clean --force

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=8081 APPROVALS_FILE=/app/data/approvals.json
WORKDIR /app
COPY --from=build /app/package.json /app/client-groups.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
RUN mkdir /app/data && chown node:node /app/data
USER node
EXPOSE 8081
VOLUME ["/app/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node dist/healthcheck.js
CMD ["node", "dist/index.js"]
