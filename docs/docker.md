# Docker

Everything runs in Docker: the build on the server, and the dev server, photo picker and preview on the laptop. Neither machine needs Node, ffmpeg or image libraries installed.

| File | What it does |
|---|---|
| `Dockerfile` | Node 24 (Debian slim) with ffmpeg and the project's npm dependencies. |
| `docker/build.sh` | The server's build: download the zip if needed, build, swap the site in. |
| `docker-compose.yml` | The services: `build` (server), and `dev`, `curate`, `preview` (laptop). |

## On the laptop

The laptop services mount the repo itself, so code edits, picks and captions land straight in your working copy (commit them as usual). They're in the `local` profile: they start only when named, never from a bare `docker compose up`.

```bash
docker compose up dev              # live dev server → http://localhost:5173
docker compose up curate preview   # photo picker → http://localhost:4318
                                   # built site    → http://localhost:4317
docker compose run --rm dev npm run photos:download   # the photos zip → photos/photos.zip
```

- Add `--build` the first time, and after `package-lock.json` changes (with `-V` too, so the new packages replace the old ones).
- Ctrl+C stops them; `-d` runs them in the background (`docker compose stop` to stop).
- **On other devices:** the dev server and the preview are offered to the wifi, so a phone can open `http://<laptop's address>:5173` or `:4317` (`hostname -I` shows the address). The picker isn't: it has no password, so it's on the laptop only (`127.0.0.1` in the compose file).
- The picker's "Update site" rebuilds `dist/`; the preview (Caddy, as on the server) shows it on a reload.
- The picker only ever runs on the laptop.

## On the server: run a build

```bash
git clone git@github.com:pinkoa2/taiwan-map-scroller.git taiwan && cd taiwan
cp .env.example .env        # add PHOTOS_ZIP_URL
mkdir -p site
docker compose run --rm --build build
```

While it converts photos it shows a progress bar (`Photos ████░░░░ 37/92 · 12 converted · 3:05 · taipei/…`), done out of total picks and the photo being worked on. The finished site is in `site/current/`. Point the web server there (Caddy: `root * /path/to/taiwan/site/current` with `file_server`). Each build replaces `current` in one move, so visitors never see a half-copied site.

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
- **Rootless Docker or Podman** (the laptop runs rootless Docker): there the container's root is you and its uid 1000 is some other unprivileged id, which can't write your files. Put `BUILD_USER=0` in the laptop's `.env`. The build script says so if the output folder isn't writable.
- Memory: decoding iPhone HEIC photos is the heavy part. 2 GB of RAM (or 1 GB plus swap) is comfortable.
- The zip still comes from the public Drive link in `.env` for now; the service account in the hosting plan replaces it later.
- To test the server's build on the laptop with the zip you already have (instead of downloading it into the volume): `docker compose run --rm --build -v "$PWD/photos:/app/photos" build`.
