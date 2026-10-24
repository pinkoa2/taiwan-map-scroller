# How it works

Working notes for the site: running it, editing the trip, photos, the picker and deploying.

Our month in Taiwan (2026) as one scrolling page, plotted on a minimal survey-sheet map of the island (a flat outline, no elevation). As you scroll, the route is inked in vermilion leg by leg and the map moves to each place, where its photos land as a deck of prints to swipe through. At Alishan the map drops to a close-up of the Mianyue Line and draws the hike on foot.

```
content/
  trip.js        the content: legs, how we travelled, words, photos
  media/<leg>/   photos and videos, plus photos.json (order, captions, comments)
  geo/           cached map data (generated, commit it)
src/             the page (Svelte 5); the map is drawn on canvas in src/lib/map/
scripts/         prepare-trip.js, the build-time map and photo step
```

## Run it

```bash
npm install
npm run dev -- --host   # dev server, with a LAN URL for phones
npm run build           # → dist/
```

`npm run dev` and `npm run build` first run `scripts/prepare-trip.js`, which:

- resizes every photo into WebP sizes (640/960/1400/2000) with blurred placeholders
- routes each leg by its mode: trains along OpenStreetMap rail lines, buses and cars by OSRM, flights and ferries as arcs; a hike is drawn from the OSM trail of that name
- outlines the island from the AWS Terrain Tiles at sea level (the map is kept minimal and fast; `CLOSE_UPS` in the script and the old contour code in `scripts/terrain.js` can bring terrain back)
- fetches cities, the trail and its features from OpenStreetMap
- writes the link-preview image (`og.jpg`), the `CNAME` and the page title

Anything fetched is cached in `content/geo/` so later builds (and CI) don't touch the network. Raw downloads sit in `.cache/` (not committed). To refetch something, delete its entry: a route in `routes.json`, a sheet in `sheets/`, or a key in `base.json`.

## Editing the content

Everything on the page comes from `content/trip.js`; the comment at its top lists every field.

- **A new leg:** add it to `legs` in order, with `at: [lat, lng]` (right-click in Google Maps to copy) and `by: [{ mode: 'train' }]`. Modes: `train`, `bus`, `car`, `walk`, `flight`, `ferry`. Split a journey with a midpoint: `by: [{ mode: 'bus', to: [lat, lng], toName: 'Ruifang' }, { mode: 'train' }]`.
- **Dates:** add `when: 'Oct 3–6'` to a leg; it shows on the leg's inset.
- **How close the map zooms:** `view: 16` is the width of the view in km.
- **A hike:** `walk: { name, zh, osmName, miles, hours, text, by, photos }`, where `osmName` is the trail's name in OpenStreetMap.
- **When the trip is finished:** set `continues: null`.

## Photos

Each place has a folder, `content/media/<leg id>/` (the hike's is `mianyue-line/`), holding its photos and videos and a `photos.json` that lists them in display order:

```json
{ "file": "red-lantern-alley.jpg", "caption": "", "comment": "", "taken": "2026-10-15 19:02", "show": true, "original": "IMG_0523.HEIC" }
```

- `caption` shows under the photo; `comment` shows when it's opened full screen.
- `pick: true` marks the few photos shown by default. Add `?display=all` to the page's address to see every photo.
- `favorite: true` (one per place, on a pick) is the photo that place's deck of prints opens on.
- `show: false` hides a photo even from `?display=all`, but keeps the file. Reorder entries to reorder the page.
- Videos are `.mp4` with a `poster` frame; they play in the full-screen viewer.
- Adding photos: compress first (max 2000px, metadata/GPS stripped), drop the file in the folder and add an entry to `photos.json`.

## Photo picker

```bash
npm run curate   # → http://localhost:4318
```

A small local app for choosing each place's photos and writing the words:
- Click photos to pick them; the order you click is the order on the site.
- Click the star on a picked photo to make it the place's favourite: the site opens that place's photos on it.
- Each photo card has a caption and an optional note.
- Each place has a description box.

Photos run in the order they were taken. A place can be set to its own order with the arrows on a picked photo. Each card's time can be changed, and its "Move to…" menu sends the photo to another place. Photos dropped into a place's folder later show up by themselves, ready for a time.

Everything saves by itself into `content/media/<place>/photos.json`, `content/order.json` and `content/descriptions.json`, which are part of the repo, so commit them as usual. "Update site" rebuilds the preview.

## Getting around

Tap the place badge in the corner for the list of stops. Every stop has its own link to share: `/#jiufen`, `/#mianyue-line`, and so on. The address follows you as you scroll.

## Deploying

Live at https://taiwan.pinkoa2.lol/ (repo `pinkoa2/taiwan-map-scroller`). `.github/workflows/deploy.yml` builds the site and publishes `dist/` to GitHub Pages on every push to `main`; a build takes about 5 minutes, most of it resizing the photos. Pages uses "GitHub Actions" as its source, with HTTPS enforced. The `CNAME` comes from `subdomain` in `trip.js` (`taiwan.pinkoa2.lol`), which points at `pinkoa2.github.io` at Porkbun.

Map data © OpenStreetMap contributors (ODbL); terrain from the AWS Terrain Tiles.
