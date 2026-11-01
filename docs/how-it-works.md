# How it works

Working notes for the site: running it, editing the trip, photos, the picker and deploying.

Our month in Taiwan (2026) as one scrolling page, plotted on a minimal survey-sheet map of the island (a flat outline, no elevation). As you scroll, the route is inked in vermilion leg by leg and the map moves to each place, where its photos land as a deck of prints to swipe through. The page rests at each place's words and each deck; scroll on (or tap the ↓ button) and it glides itself to the next one, so each route draws in one smooth move (`src/lib/glide.js`). At Alishan the map drops to a close-up of the Mianyue Line and draws the hike on foot.

```
content/
  trip.js        the content: legs, how we travelled, words, photos
  media/<leg>/   photos and videos, plus photos.json (order, captions, comments)
  geo/           cached map data (generated, commit it)
src/             the page (Svelte 5); the map is drawn on canvas in src/lib/map/
scripts/         prepare-trip.js, the build-time map and photo step
```

## Run it

Everything runs in Docker; the laptop needs nothing else installed. See [docker.md](docker.md) for the details.

```bash
docker compose up dev              # live dev server → http://localhost:5173 (phones: http://<laptop's address>:5173)
docker compose up curate preview   # photo picker → http://localhost:4318, built site → http://localhost:4317
```

Add `--build` the first time and after a dependency changes. Ctrl+C stops them.

The dev server and every build first run `scripts/prepare-trip.js`, which:

- turns each **picked** photo into WebP sizes (640/960/1400/2000) with a blurred placeholder, and each picked video into a web copy with a poster (see Photos)
- routes each leg by its mode: trains along OpenStreetMap rail lines, buses and cars by OSRM, flights and ferries as arcs; a hike is drawn from the OSM trail of that name
- outlines the island from the AWS Terrain Tiles at sea level (the map is kept minimal and fast; `CLOSE_UPS` in the script and the old contour code in `scripts/terrain.js` can bring terrain back)
- fetches cities, the trail and its features from OpenStreetMap
- writes the link-preview image (`og.jpg`), the `CNAME` and the page title

If the picker's "Update site" (which re-runs the script) runs while the dev server is up, restart the dev server afterwards, or the map comes up blank (the script recreates `.generated/public/geo`, and Vite loses track of it).

Anything fetched is cached in `content/geo/` so later builds (and CI) don't touch the network. Raw downloads sit in `.cache/` (not committed). To refetch something, delete its entry: a route in `routes.json`, a sheet in `sheets/`, or a key in `base.json`.

## Editing the content

Everything on the page comes from `content/trip.js`; the comment at its top lists every field.

- **A new leg:** add it to `legs` in order, with `at: [lat, lng]` (right-click in Google Maps to copy) and `by: [{ mode: 'train' }]`. Modes: `train`, `bus`, `car`, `walk`, `flight`, `ferry`. Split a journey with a midpoint: `by: [{ mode: 'bus', to: [lat, lng], toName: 'Ruifang' }, { mode: 'train' }]`.
- **Going out and coming back:** `dayTrip: true` draws the way back to the base after the place's photos, and the next leg leaves from there. `returnTo: 'taipei'` does the same for a leg we went back to a particular place from. `back: [...]` (like `by`) says how we went back; without it the way out is retraced. A return visit doesn't get a leg of its own: its photos go in the first visit's folder.
- **Dates:** add `when: 'Oct 3–6'` to a leg; it shows on the leg's inset.
- **How close the map zooms:** `view: 16` is the width of the view in km.
- **A hike:** `walk: { name, zh, osmName, miles, hours, text, by, photos }`, where `osmName` is the trail's name in OpenStreetMap.
- **When the trip is finished:** set `continues: null`.

## Photos

The photos come from a zip of the Google Drive folder (the originals), downloaded once:

```bash
docker compose run --rm dev npm run photos:download   # → photos/photos.zip (not committed), with a progress bar
```

The link is `PHOTOS_ZIP_URL` in `.env` (copy `.env.example`). Run it again whenever the Drive folder has new or changed photos.

Each place has a folder, `content/media/<leg id>/` (the hike's is `mianyue-line/`), with a `photos.json` listing its photos in display order:

```json
{ "file": "red-lantern-alley.jpg", "caption": "", "comment": "", "taken": "2026-10-15 19:02", "pick": true, "show": true, "original": "IMG_0523.HEIC" }
```

- `original` is the file's name in the zip; that's how the build finds it. `file` is the photo's name on the site.
- **Only `pick: true` photos are built and published.** Everything else stays on your machine.
- `caption` shows under the photo; `comment` shows when it's opened full screen.
- `favorite: true` (one per place, on a pick) is the photo that place's deck of prints opens on.
- `show: false` hides a photo even if picked. Reorder entries to reorder the page (in a place set to custom order).
- Videos (`.MOV` in the zip) become H.264 web copies with a poster frame; they play in the full-screen viewer.
- All metadata, GPS included, is stripped from what's built.
- A photo the zip doesn't have (a screenshot added by hand, like `mianyue-line/alltrails-mianyue-line.jpg`) is kept in `content/media/<place>/<file>` and read from there. Everything else lives only in the zip: the old copies were removed on Oct 30, 2026 (they're still in git history).
- **Without the zip the build stops** with an error rather than publish a site without photos. Build on a machine that has the zip.

Building is `scripts/photo-source.js` (reading the zip, iPhone HEIC via `heic-decode`, videos via `ffmpeg`) plus the photo part of `prepare-trip.js`. Each built file carries a fingerprint of its source, so a photo is converted once (about 1.5 s each, longer for a video) and only again when it changes; `.cache/photos.json` remembers the sizes. Files for photos no longer picked are removed. `ffmpeg` must be installed.

## Photo picker

```bash
docker compose up curate preview   # picker → http://localhost:4318, built site → http://localhost:4317
```

It only ever runs on the laptop, and only on the laptop itself (not offered to the rest of the wifi: it has no password). A small local app for choosing each place's photos and writing the words:
- Click photos to pick them; the order you click is the order on the site.
- Click the star on a picked photo to make it the place's favourite: the site opens that place's photos on it.
- Each photo card has a caption and an optional note.
- Each place has a description box.

It shows every photo and video in the zip, picked or not. The grid's previews are made from the zip the first time each is shown (about 1.5 s each) and kept in `.cache/previews/`, so the first look at a place is slower.

Photos run in the order they were taken. A place can be set to its own order with the arrows on a picked photo. Each card's time can be changed, and its "Move to…" menu sends the photo to another place (only the JSON changes; the zip is never touched). Files in a newer zip that no place lists yet appear in an **Unsorted** section, marked New and with no time; move each to its place. (Live Photos' short `.MP4` parts are left out.)

Everything saves by itself into `content/media/<place>/photos.json`, `content/order.json` and `content/descriptions.json`, which are part of the repo, so commit them as usual. "Update site" rebuilds `dist/`, and the preview (http://localhost:4317) shows it on a reload.

## Getting around

Tap the place badge in the corner for the list of stops. Every stop has its own link to share: `/#jiufen`, `/#mianyue-line`, and so on. The address follows you as you scroll.

## Deploying

Live at https://taiwan.pinkoa2.lol/ (repo `pinkoa2/taiwan-map-scroller`). **Between hosts (since Oct 30, 2026):** the GitHub Actions workflow that built and published the site on every push was removed, since it can't reach the photos zip. GitHub Pages keeps serving the last version it published, so pushing no longer changes the live site. It moves to a Linode next ([hosting-plan.md](hosting-plan.md)); until then, don't turn Pages off, or the site goes down. Pages has HTTPS enforced. The `CNAME` comes from `subdomain` in `trip.js` (`taiwan.pinkoa2.lol`), which points at `pinkoa2.github.io` at Porkbun.

A move to a Linode, with the photos kept out of the repo, is planned in [hosting-plan.md](hosting-plan.md). The build already runs in Docker (`docker compose run --rm --build build` → `site/current/`), so the server needs only Docker: see [docker.md](docker.md). How the Linode itself is set up (Caddy, `/srv/taiwan`, the firewall, updating the site): [server.md](server.md).

Map data © OpenStreetMap contributors (ODbL); terrain from the AWS Terrain Tiles.
