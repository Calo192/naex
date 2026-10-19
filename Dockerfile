# NA EX! — server + webový klient v jednom kontajneri.
#   docker build -t naex .
#   docker run -p 8787:8787 -v naex-data:/data -e NAEX_ADMIN_HESLO=<heslo> naex

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.json tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY packages/tvorba/package.json packages/tvorba/
COPY packages/server/package.json packages/server/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY packages packages
COPY apps apps
RUN npm run build --workspace=@naex/web

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8787 NAEX_DATA=/data
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/tvorba/package.json packages/tvorba/
COPY packages/server/package.json packages/server/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev && npm cache clean --force
COPY packages/core/src packages/core/src
COPY packages/core/data packages/core/data
COPY packages/tvorba/src packages/tvorba/src
COPY packages/server/src packages/server/src
COPY packages/server/seed packages/server/seed
# Reporty playtestov — v administrácii (Tvorba → Playtesty) pre admina a subadminov.
COPY docs/playtesty docs/playtesty
COPY --from=build /app/apps/web/dist apps/web/dist
# Nový zväzok preberie vlastníka z obrazu — server beží ako node, nie root.
RUN mkdir -p /data && chown node:node /data
VOLUME /data
EXPOSE 8787
USER node
CMD ["node", "--experimental-strip-types", "packages/server/src/index.ts"]
