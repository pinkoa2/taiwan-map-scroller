# Building with Docker

The site's build runs in a container, so a server (the Linode, [hosting-plan.md](hosting-plan.md)) needs only Docker and a copy of the repo: no Node, ffmpeg or image libraries to install.

| File | What it does |
|---|---|
| `Dockerfile` | Node 24 (Debian slim) with ffmpeg and the project's npm dependencies. |
| `docker/build.sh` | One build: download the zip if needed, build, swap the site in. |
| `docker-compose.yml` | Runs it with the volumes and the output folder wired up. |

## Run a build

```bash
git clone git@github.com:pinkoa2/taiwan-map-scroller.git taiwan && cd taiwan
cp .env.example .env        # add PHOTOS_ZIP_URL
mkdir -p site
docker compose run --rm --build build
```

The finished site is in `site/current/`. Point the web server there (Caddy: `root * /path/to/taiwan/site/current` with `file_server`). Each build replaces `current` in one move, so visitors never see a half-copied site.

For later builds: `git pull`, then the same `docker compose run --rm --build build`. `--build` rebuilds the image with the new content; dependencies are only reinstalled when `package-lock.json` changes.

## What's kept between builds

Three Docker volumes:

- **`photos`**: the downloaded zip (about 2.8 GB). It's downloaded only when missing, so a build after a caption or pick change starts at once.
- **`cache`** and **`generated`**: the converted photos and their fingerprints. Only new or changed picks are converted: a first build of about 90 picks takes a few minutes, a rebuild with nothing new a few seconds.

Options (set them on the command line, e.g. `REFRESH_PHOTOS=1 docker compose run --rm build`):

- `REFRESH_PHOTOS=1`: download the zip again (after replacing it in Drive).
- `DELETE_ZIP=1`: delete the zip after the build. Nothing photo-related is then kept between builds, as the hosting plan prefers, but every build downloads the zip again (about 6 minutes).
- `SITE_DIR=/srv/taiwan`: put the site somewhere other than `./site`.

To start completely fresh: `docker compose down -v` removes the volumes.

## Notes

- The container runs as the image's `node` user (uid 1000). The output folder must be writable by uid 1000; on a server where the deploy user isn't uid 1000, `sudo chown 1000 site` once.
- **Rootless Docker or Podman** (the laptop runs rootless Docker): there the container's root is you and its uid 1000 is some other unprivileged id, so run with `BUILD_USER=0`, e.g. `BUILD_USER=0 docker compose run --rm --build build`. The build script says so if the output folder isn't writable.
- Memory: decoding iPhone HEIC photos is the heavy part. 2 GB of RAM (or 1 GB plus swap) is comfortable.
- The zip still comes from the public Drive link in `.env` for now; the service account in the hosting plan replaces it later.
- Locally, to reuse the zip you already have instead of downloading it into the volume: `docker compose run --rm --build -v "$PWD/photos:/app/photos" build`.
