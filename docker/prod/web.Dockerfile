# Production image for the Next.js app (IM-65). Build context is the repo root: the build
# reads fixtures from docs/ (next.config.ts).
FROM node:22-slim AS build
WORKDIR /repo/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY docs/ /repo/docs/
COPY frontend/ ./
# Rewrites to the API are fixed at build time, so the API address is a build argument
ARG API_URL=http://api:8000
ENV API_URL=$API_URL NEXT_TELEMETRY_DISABLED=1
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
WORKDIR /repo/frontend
COPY --from=build --chown=node:node /repo/frontend ./
USER node
EXPOSE 3000
CMD ["node_modules/.bin/next", "start", "-p", "3000"]
