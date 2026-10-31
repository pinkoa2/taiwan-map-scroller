# Builds the site in a container, so a server (the Linode) needs only Docker.
# See docs/docker.md. The build itself is docker/build.sh.

FROM node:24-bookworm-slim

# ffmpeg converts the picked videos; everything else (sharp, the HEIC
# decoder) comes from npm with its own binaries.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies first, so a change to the content doesn't reinstall them.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# The folders the build writes to, owned by the unprivileged user so the
# volumes mounted on them (docker-compose.yml) start out writable.
RUN mkdir -p photos .cache .generated dist \
  && chown -R node:node photos .cache .generated dist \
  && chmod +x docker/build.sh

USER node
ENTRYPOINT ["docker/build.sh"]
