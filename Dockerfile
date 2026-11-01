# Builds the site in a container, so a server (the Linode) needs only Docker.
# See docs/docker.md. The build itself is docker/build.sh.

FROM node:24-bookworm-slim

# ffmpeg converts the picked videos; everything else (sharp, the HEIC
# decoder) comes from npm with its own binaries.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# The whole app belongs to the unprivileged user that runs the build: Vite,
# for one, writes a temporary file next to its config, so the build needs to
# write anywhere in /app, not just the folders it fills. The volumes mounted
# on photos/, .cache/ and .generated/ (docker-compose.yml) start out with
# these owners too.
WORKDIR /app
RUN chown node:node /app
USER node

# Dependencies first, so a change to the content doesn't reinstall them.
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY --chown=node:node . .
RUN mkdir -p photos .cache .generated dist && chmod +x docker/build.sh

ENTRYPOINT ["docker/build.sh"]
