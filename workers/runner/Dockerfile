FROM docker.io/cloudflare/sandbox:0.7.0

USER root

ARG CODEX_VERSION=0.144.6
RUN npm install -g "@openai/codex@${CODEX_VERSION}" \
  && npm install --prefix /opt/byoa ws@8.21.1 \
  && mkdir -p /workspace /var/lib/byoa/codex \
  && chown -R root:root /opt/byoa /var/lib/byoa

COPY supervisor.mjs /opt/byoa/supervisor.mjs

EXPOSE 8787
