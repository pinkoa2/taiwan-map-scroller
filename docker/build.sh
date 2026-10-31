#!/bin/sh
# One build of the site, inside the container (Dockerfile, docker-compose.yml).
#
# 1. Downloads the photos zip (PHOTOS_ZIP_URL) unless it's already in the
#    photos volume, or REFRESH_PHOTOS=1 asks for a fresh copy.
# 2. Builds the site: picks only; photos already converted in an earlier run
#    (kept in the cache volumes) are reused.
# 3. Swaps the new site into /out/current in one move, so the server never
#    serves a half-copied site. Point the web server at /out/current.
# 4. With DELETE_ZIP=1, removes the zip afterwards (nothing photo-related
#    kept between builds; the next build downloads it again).
set -eu

if [ ! -d /out ] || [ ! -w /out ]; then
  echo "The output folder isn't mounted or isn't writable by uid $(id -u)." >&2
  echo "Create it first (mkdir -p site) and make it yours; under rootless Docker" >&2
  echo "or Podman, run with BUILD_USER=0. See docs/docker.md." >&2
  exit 1
fi

if [ "${REFRESH_PHOTOS:-0}" = 1 ] || [ ! -f photos/photos.zip ]; then
  npm run --silent photos:download
fi

npm run --silent build

rm -rf /out/.next /out/.old
cp -R dist /out/.next
if [ -d /out/current ]; then mv /out/current /out/.old; fi
mv /out/.next /out/current
rm -rf /out/.old
echo "Site ready in $(du -sh /out/current | cut -f1) → /out/current"

if [ "${DELETE_ZIP:-0}" = 1 ]; then
  rm -f photos/photos.zip
  echo "Photos zip deleted (DELETE_ZIP=1)."
fi
