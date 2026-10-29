# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20 AS web
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=secret,id=proxy_ca \
    if [ -s /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm ci --strict-ssl=true --no-audit --no-fund
COPY frontend/ ./
COPY shared/ /shared/
RUN npm run build

FROM node:24-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20
WORKDIR /app/backend
COPY services/campus/package.json services/campus/package-lock.json ./
RUN --mount=type=secret,id=proxy_ca \
    if [ -s /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm ci --omit=dev --strict-ssl=true --no-audit --no-fund
COPY --chown=node:node services/campus/ ./
COPY --chown=node:node shared/ /shared/
COPY --from=web --chown=node:node /build/dist /app/web
RUN mkdir -p /app/downloads /app/media && chown node:node /app/media
ENV CAMPUS_HOST=0.0.0.0 CAMPUS_PORT=4100 CAMPUS_WEB_DIST=/app/web CAMPUS_DOWNLOAD_DIR=/app/downloads CAMPUS_MEDIA_DIR=/app/media
USER node
EXPOSE 4100
CMD ["node", "campus/server.js"]
