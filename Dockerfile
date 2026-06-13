# syntax=docker/dockerfile:1

# GRANDFORD — image de production de la PWA Next.js (Serwist).
# Multi-étapes : deps -> build -> runner minimal non-root, via la sortie « standalone »
# de Next (cf. next.config.mjs). Orchestration locale : voir docker-compose.yml.

ARG NODE_VERSION=22

# --- Base commune : Node + pnpm (version épinglée par le champ packageManager) ---
FROM node:${NODE_VERSION}-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# corepack active le pnpm épinglé dans package.json — pas d'install globale divergente.
RUN corepack enable
WORKDIR /app

# --- Déps : couche cachée tant que le lockfile ne bouge pas ---
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# --- Build : compile Next en production (génère aussi le service worker Serwist) ---
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Clés publiques par design (la sécurité repose sur la RLS, pas sur leur secret —
# securite-secrets.md). Placeholders pour un build déterministe sans secret réel.
# NEXT_PUBLIC_* est INLINÉ au build : pour viser une vraie instance, reconstruire avec
# --build-arg NEXT_PUBLIC_SUPABASE_URL=... etc.
ARG NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY=placeholder-vapid-public-key
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production
RUN pnpm build

# --- Runner : image finale, surface minimale, utilisateur non-root ---
FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# La sortie standalone embarque un node_modules minimal + server.js ; public/ et
# .next/static doivent être copiés à part (non inclus par le traçage Next).
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
# Liveness : le serveur accepte-t-il des connexions TCP ? (sans dépendre de Supabase)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('net').connect(Number(process.env.PORT||3000),'127.0.0.1').on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))"
# server.js : point d'entrée généré par la sortie standalone de Next.
CMD ["node", "server.js"]
