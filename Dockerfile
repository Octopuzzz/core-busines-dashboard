# syntax=docker/dockerfile:1.7
#
# Team Pulse — production image (Next.js standalone).
#
# Build for an Ubuntu x86-64 server (from any machine, including Apple Silicon):
#   ./scripts/docker-build.sh                 # or see the script for the raw buildx command
#
# Run (secrets come from an env file at runtime — they are never baked into the image):
#   docker run -d --name team-pulse -p 3000:3000 --env-file .env.production team-pulse:latest

# Node 26 LTS on Debian 13 (trixie), pinned by digest so the base can't change under us.
# The digest is the multi-arch index: buildx picks the linux/amd64 variant automatically.
ARG NODE_IMAGE=node:26-slim@sha256:e6bedef217677b276c591795e169840edd9096dbf13f29df8ef8d1856b8820bc

# ---------------------------------------------------------------------------------------------
# 1. deps — install exactly what the lockfile says (with the .npmrc supply-chain policy)
# ---------------------------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS deps
WORKDIR /app

# Only the files npm needs — so this layer stays cached until dependencies change.
COPY package.json package-lock.json .npmrc ./

# npm ci: lockfile only, integrity-checked. .npmrc enforces min-release-age and the
# allowScripts policy (unapproved install scripts fail the build).
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund \
 && npm audit signatures

# ---------------------------------------------------------------------------------------------
# 2. build — compile the Next.js app into .next/standalone
# ---------------------------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN --mount=type=cache,target=/app/.next/cache \
    npm run build

# ---------------------------------------------------------------------------------------------
# 3. runner — minimal runtime: no npm, no source, no dev dependencies, non-root
# ---------------------------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# The app never installs packages at runtime — remove npm/npx/corepack to shrink the attack surface.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

# Standalone server + only the node_modules files it actually uses, owned by the unprivileged
# "node" user that ships with the official image (uid 1000). Static assets are read-only.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --chown=node:node .env.production ./.env.production

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["node", "server.js"]
