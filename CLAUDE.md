# Taiwan Scroller

A single-page, scroll-driven travelogue of our month in Taiwan (October 2026). A map of Taiwan follows the trip's route as you scroll, and photos and short write-ups appear along the way. It should look good, show where we are in the trip at every point, and work well on desktop and on phones.

The sibling project `/home/alex/projects/iceland-postcards` is the reference for setup and workflow. This one is **not** postcards: it has its own design, and nothing is shared with Iceland.

## Read first

- `PRODUCT.md`: who it's for, what it must do, constraints.
- `DESIGN.md`: the design system ("Survey Sheet"), with tokens, components and rules. Keep it true to the code.
- `README.md`: just the live link and one line (the user asked, Oct 23, 2026). The working notes (how to run, build, edit content, add photos and deploy) moved to `docs/how-it-works.md`; keep that file current.
- `docs/hosting-plan.md`: **planned, not built (Oct 30, 2026).** Photos out of git (Google Drive is the source of truth). A stateless build on a Linode downloads a zip from a Drive folder through a service account (never a public link), only when needed, builds picks only (`?display=all` to be removed), deletes the zip and serves the site with Caddy. The repo goes private once off Pages. Theorised with the user; build it only when asked.
- `.env` (gitignored; `.env.example` is committed): `PHOTOS_ZIP_URL`, the photos zip's public Google Drive link (Oct 30, 2026, temporary until the service account). Never commit it or prefix it `VITE_`.
- `npm run photos:download` (`scripts/download-photos.js`): downloads that zip to `photos/photos.zip` (gitignored) with a progress bar.
- **Photos come from the zip (Oct 30, 2026, the user asked).** `scripts/photo-source.js` finds each entry by its `original` name in the zip (HEIC via `heic-decode`, since sharp can't read iPhone HEIC; videos via `ffmpeg`), or from `content/media/<place>/<file>` when the zip lacks it (only `mianyue-line/alltrails-mianyue-line.jpg` now: the other 286 copies were deleted on Oct 30, 2026 at the user's request; they're in git history). Without a zip the build throws. **The GitHub Actions workflow was removed (Oct 30, 2026, the user asked)**; GitHub Pages keeps serving its last deploy, so the live site is frozen until the Linode is up. Don't turn Pages off before then. **Only picks are built; `?display=all` was removed.** Built files are fingerprinted and cached in `.cache/photos.json`. The picker makes previews from the zip (`.cache/previews/`) and lists unknown zip files under Unsorted (`content/media/unsorted/photos.json`).
- `.impeccable/surfaces/src-app-svelte.md`: the page's design plan (direction contract).
- `content/trip.js`: the itinerary. Its header comment lists every field.
- `content/media/<place>/photos.json`: each place's photos, in order, with captions and comments.

## Layout of the repo

- **`content/trip.js`**: legs in order. Fields: `id`, `name`, `zh`, `at` [lat, lng], `when` (dates), `by` (transport segments, `{ mode, to, toName, from, fromName }`), `dayTrip`, `returnTo`, `arrive`, `text`, `view` (zoom width in km), `hang: 'lanterns'`, `walk` (a hike with its own `folder`, `osmName`, `track`, `outAndBack`, `miles`, `hours`, `text`, `by`). Also `cover` (the link-preview photo) and `continues` (the "To be continued" line; set to null when the trip is over).
- **`content/media/<place>/`**: the photos and videos for each leg (folder = the leg's `id`; the hike uses `walk.folder` = `mianyue-line`). Each folder's `photos.json` lists the files in display order (chronological to start with). Each entry has:
  - `file`: the descriptive filename.
  - `caption`: a short line under the photo.
  - `comment`: a longer note, shown when the photo is opened full screen.
  - `taken`: date and time.
  - `show`: false hides it from the page but keeps it.
  - `original`: its iPhone name, e.g. `IMG_0517.HEIC`.
  - `poster`: videos only.
- **`content/geo/`**: cached map data (commit it).
  - `routes.json`: every leg's route.
  - `base.json`: OSM cities, peaks, the Mianyue trail and its features.
  - `sheets/*.json`: the island outline.
  - `.cache/` holds raw downloads (gitignored).
- **`scripts/prepare-trip.js`** (with `terrain.js` and `osm.js`) builds `.generated/`: `trip.json`, `public/geo/*` and `public/m/*` (WebP sizes 640/960/1400/2000 at quality 74 of the **picked** photos only, read from the zip, plus H.264 copies of picked videos). It runs before `npm run dev` and `npm run build`.
- **`src/App.svelte`** runs the scroll story.
  - `src/lib/story.js` turns legs into steps; each step changes either the camera or the ink.
  - `src/lib/map/sheet.js` draws the canvas map, and `palette.js` holds its colours (mirrored as CSS tokens in `src/app.css`).
  - `Story.svelte` is the mosaic layout (phones always; wide screens when `photoLayout: 'mosaic'`). `Leg.svelte` is one leg of the over-map layout. Both place `.mark` step elements.
  - `Scatter.svelte` is the desktop prints, `PrintStack.svelte` the phone prints, `Stops.svelte` the badge and stop list, `Plate.svelte` one photo or video (`tile` = a mosaic cell), `Viewer.svelte` the full-screen viewer, and `LanternString.svelte` the Jiufen lanterns.

## Layout

`photoLayout` in `content/trip.js` has two parts. The user picked these on Oct 23, 2026, from Claude's recommendation. On desktop they first called scatter "a clear winner", then replaced it with the deck once they saw it with lots of photos.

- **Desktop `wide: 'deck'` (default since Oct 23, 2026):** `Leg.svelte` plus `Deck.svelte`. The user found the scatter didn't look good with many photos (it buried the map, every print was the same size, and there was no reading order). From four options (flip-through deck, lead print with contact strip, facing album page, capped scatter) they picked the deck.
  - **Flipped by hand, not by scroll** (the user asked, Oct 23, 2026: swipe left and right, free to skip past by scrolling, but encouraged to flip through). Drag or swipe the top print sideways (past 60px flips), or use the ‹ › buttons and the ticks under the deck, or ← → keys while the viewer is closed. Vertical swipes still scroll the page (`touch-action: pan-y`). A flipped print is thrown off to the left, the way a swipe sends it. **It loops** (the user asked): › on the last photo goes to the first, ‹ on the first to the last, and swipes wrap the same way. Pile depth is counted round the loop, and stacking follows depth.
  - **Loading (Oct 23, 2026, the user kept waiting for photos):**
    - The deck loads its images from the top print outward (the top one, the one before it and the next three), with `fetchpriority` high for the top one. Once loaded, an image stays.
    - While no deck is up, App quietly fetches the **next place's first 3 photos** in a hidden `.warm` block, during the route drawing and, on phones, while its page is read. They're fetched at exactly the size the deck will ask for (shared geometry in `src/lib/deck.js`), so the cache hits.
    - Print `sizes` cap the density at 2× (`printSizes`), so a 3× phone fetches the 960 file (about 200 KB) instead of the 1200 (about 325 KB).
  - **The viewer moves the deck too** (the user asked): moving through photos full screen updates the place's `flips`, so closing the viewer leaves the photo you ended on at the top of the pile.
  - The deck opens on the place's **favourite** if one is starred in the picker (see Photo picker), else on the first photo.
  - App keeps the print on top per place (`flips`), so coming back to a place shows where you left off (until reload).
  - The place sits in the left half of the sheet (`focus` middle box at 0.25w); the deck sits in the right half.
  - One big print on top (the photo as large as fits, max 660px wide; paper mount, foot with caption or place name and a "3 / 12" count). The next two peek out beneath with blank feet. Only prints near the top one load their image.
  - **Neater pile (the user asked, Oct 30, 2026):** turns are small (±0.5° per print, ±1° for the two beneath, offset 4–13px), and a print beneath is shrunk to tuck in behind the top one, so a wide photo under a tall one no longer sticks out on both sides (`fit` in `place()`).
  - **Print style: polaroid.** The user tried a disposable-camera print on Oct 30, 2026 (thin glossy border, orange date stamp in the corner), kept the polaroid and had the disposable option removed from the code.
  - The deck is up from 4% to 72% of the place's step, landing as a whole and lifting away, as the scatter did. Each place gets a fixed `110svh` of scroll (`room` in Leg.svelte). The camera **holds** on the place until 74% of the step (`hold` in `viewAt`).
  - **Hints (squiggles):** first a "swipe" squiggle above the deck: a sideways sweep with "Drag for more photos" (desktop) or "Swipe for more photos" (phone). It goes after the first flip and never returns (`localStorage` `taiwan-swipe-hint-seen`). After that, the next place shows the old "Click/Tap a photo to open it" squiggle by the top print's corner, until a photo is opened (`taiwan-photo-hint-seen`). `Squiggle.svelte` has `toward="swipe"` for the sweep.
- **Desktop `wide: 'scatter'` (the previous default):** `Leg.svelte` plus `Scatter.svelte`.
  - Cards sit in a left column while the route draws, then the camera centres the place.
  - The place's picked photos **all drop onto the map at once** as prints: a paper mount with a label foot, slightly turned. They **all lift away together** before the next card arrives (visible between 4% and 72% of the place's step, in `App.svelte`). Both behaviours were the user's request.
  - **Placement uses best-candidate sampling** (the user asked for an even, random spread away from the edges). Each print tries 40 random spots inside the safe area (36px inside the frame) and keeps the one with the least overlap with prints already placed, then the most room around it. Keep-clear zones, which count 12× as overlap: the place's dot and name at screen centre, the badge, and the key map and scale bar at bottom-centre. Each landing gets a fresh random seed (the user asked for random every time), so prints fall differently on every visit but hold still within one, resizes included. Prints shrink for big sets (`sqrt(6/n)`, at least 0.5×), and a turn of up to ±4° is random.
  - **Motion:**
    - Drop: settles from 26px above, about 4° of turn and 5% scale, over 560ms, with the prints staggered 26ms apart.
    - Lift-off: rises 18px and fades over 360ms.
    - Both are `|global` transitions and are skipped under reduced motion.
  - Hover straightens and lifts a print; click opens the viewer. Each place gets `70 + 7·n svh` of scroll (`room` in Leg.svelte).
- **Phone `phone: 'deck'` (default since Oct 23, 2026; the user asked for the phone to "behave the same" as the desktop deck):** `Story.svelte` plus `Deck.svelte` (`wide={false}`).
  - Map stretch, then the paper page with the words, unchanged. After the page, Story leaves an empty `.deck-room` (`data-deck="<step key>"`, `140svh`) and an 80svh `.deck-tail`.
  - App measures each room (`rooms`). The deck is up while the room scrolls past the top of the screen (`ROOM_AT = 0.02`, so it lands just as the page has gone). Flipping is by swipe, the same as desktop, with the ‹ › buttons and ticks under it.
  - **Centred vertically** (the user asked): the place is framed in a slim band across the top (to 20% of the screen), and the deck fills 21%–84% with the controls under it (above the pile, `z-index: 150`, clear of the turned prints beneath). The map is clear, not blurred.
  - **Stray scrolls (the user kept scrolling the deck away mid-swipe, Oct 23, 2026):**
    - A swipe on the top print counts as sideways unless it's clearly up-and-down (`|dx| ≥ 0.7·|dy|`, `SIDEWAYS` in Deck.svelte). A sideways swipe is claimed on its first touch move (a non-passive `touchmove` that calls `preventDefault`), so the page holds still.
    - The room is 140svh, so a small scroll doesn't carry the deck off.
    - A snap point 40svh into each room (`.snap`) with `html.deck-snap { scroll-snap-type: y proximity }` (set by App on phones) settles the page back onto the deck after a small scroll, while a real scroll goes straight past.
  - The camera holds on the place until the room has passed (`holds`, per step, passed to `viewAt` as a function), then moves on during the tail.
- **Phone `phone: 'prints'` (the previous default):** `Story.svelte` plus `PrintStack.svelte`.
  - Map stretch, then a paper page with just the words.
  - Then the photos scroll **vertically** as prints: paper mount, label foot, alternating slight turns. Behind them the map shows through blurred (7px) and dimmed. The user asked for vertical, not horizontal, and liked the blurred map behind.
  - A sideways filmstrip was tried and removed.
- **Other values still work:** `wide: 'scatter'`, `wide: 'mosaic'` (paper page with a 3-across grid via Story) or `'over-map'` (two columns down the edges); `phone: 'prints'` (vertical prints over the blurred map) or `phone: 'mosaic'` (2-across grid).
- **History:** over-map (single alternating column) → paper-page mosaic → back to over-map with bigger plates and two columns → back to mosaic ("I don't know how best to display the photos") → scatter (desktop) and filmstrip (phone) → deck (desktop, Oct 23, 2026; scatter looked messy with 12–20 photos) → deck on phones too (same day), the current choice. On phones, before the mosaic: full-width photos one after another, and earlier a split window and a docked-card layout.
- **Jiufen lanterns: removed (Oct 23, 2026; the user found them tacky).** `hang: 'lanterns'` is off in trip.js; the code (`LanternString.svelte`) is still there. What they were:
  - Mosaic layout: Jiufen's page has lantern strings hanging **in the background** behind its photos (the user's request; `LanternString` `mode="backdrop"`). The first string runs along the top above the heading; on desktop more strings cross every ~340px and show in the side margins. On phones only the top string, since further strings only showed as stray cord bits between photos.
  - Over-map layout: the old version, a single zig-zag of photos with a string from each to the next (`mode="between"`).

## Title card, closing map, no distances (Oct 23, 2026)

- **No distances anywhere** (the user asked): the map's scale bar is gone. **Exception:** the Mianyue hike shows "10 miles · 6 hours" under its title (the user asked for it back).
- **Title card:** just "Taiwan 臺灣" and a description; the user didn't want names, year or stop count. The description is edited in the photo picker's **Title card** section and saved as `"intro"` in `content/descriptions.json` (it overrides `summary` in trip.js). A blank line makes paragraphs. The "Scroll to follow the route" cue stays.
- **Closing map:** a long stretch at the very bottom (60svh desktop; 115svh on phones, so the grey photo backdrop has fully scrolled away) showing the whole island with every route drawn, every stop marked alike (`story.end` drops the "current place" emphasis), and no photos. Bottom-left is a closing card that mirrors the title card: "Taiwan 臺灣", "To be continued" and Sources. The badge reads "Taiwan" there.

## Photo picker (`npm run curate`, http://localhost:4318)

A small local app the user asked for (Oct 23, 2026) to choose photos and write text. It lives in `tools/curate/`: `server.js` is plain Node with no dependencies, and `index.html`, `app.js` and `app.css` are the page.

- Places are listed down the left with "picked/total" for each; the hike is its own section.
- **Photo order: always by time taken unless set otherwise.** The user asked for this on Oct 23, 2026, for the site and the picker. Photos with no time go last. A place can be switched to **Custom** order: the ‹ › arrows on a picked card do this automatically, and the "By time taken" button switches back. Custom places are listed in `content/order.json` (`{ "<folder>": "custom" }`), where photos.json's own order is used. prepare-trip.js applies the same rule.
- **Click a photo to pick it**, and again to drop it; numbers show its place among the picks. "Picked only" and "Clear picks" are there too.
- **Favourite (the user asked, Oct 23, 2026):** a star at the top-right of each picked card (shows on hover, stays lit when set). Starring one makes it the place's favourite and un-stars any other there; dropping the pick drops the star. Saved as `"favorite": true` on that entry in photos.json (only on a pick). The site's deck for that place **opens on the favourite** (`start` in App's `prints`), and the warm-up fetches from it onward. Photo order doesn't change: swiping carries on from the favourite and loops round. No favourite: the deck opens on the first photo.
- **Each card's time is editable** (a datetime field; it's red when missing), for screenshots or anything added later. Changing it re-sorts the place.
- **Move to another place:** each card's "Move to…" menu moves the entry to that place's photos.json, with its caption, note, time and pick (and the old local copy in content/media, if any). The zip is never touched. Name clashes get -2, -3….
- **New files:** files in the zip that no place lists go to an **Unsorted** section (marked new, no time) when the picker loads; move each to its place and set its time. Live Photo `.MP4` parts are skipped. A file dropped into a place's folder by hand is still picked up too.
- **New photos (the user asked, Oct 23, 2026, ahead of a big second import):** entries carry `"new": true` until seen.
  - The places list shows "12 new" under a place's name. A place has a **New N** filter showing just those, and each card wears a red "New" tag.
  - **Mark all seen** clears them for that place (the field is removed from photos.json).
  - The import sets `new: true` on everything it adds. prepare-trip ignores the field.
- Each card has a **caption** (under the photo on the site) and an optional **note** (`comment`, shown full screen).
- Each place has a **description** box. Its placeholder shows the current one-liner from trip.js. A **Title card** section at the top edits the opening description (`intro`).
- **Everything autosaves to JSON in the repo**, so it's committed with the site:
  - `content/media/<place>/photos.json`: picks first in pick order, then the rest by time taken; `pick`, `caption`, `comment`, `favorite`. Other fields are kept.
  - `content/descriptions.json`: `{ "<place id or walk folder>": "text" }`. prepare-trip.js prefers it over `text` in trip.js.
- **"Update site"** runs `node scripts/prepare-trip.js && npx vite build`, so the preview (`vite preview` on :4317) shows the changes after a reload.
- Grid previews are made from the zip on first view (about 1.5 s per HEIC) and cached in `.cache/previews/`.

## Getting around (the user picked this, Oct 23, 2026)

- **Stop list:** the place badge (`Stops.svelte`) is a button that opens a list of every stop with its number, Chinese name and dates. The Mianyue Line is listed under Alishan, and the current stop is highlighted. Choosing one jumps straight there, landing where that stop's first step begins. Escape or a tap outside closes it.
  - Desktop: the full badge ("06/08 Taipei → Yunlin 雲林"), top-right.
  - Phone: just "03/10 ⌄", top-right, so it doesn't cover the left-aligned page headings. The key map moved to the top-left with the scale under it.
- **Shareable links:** each stop has its own address: `#taipei`, `#tamsui`, …, `#mianyue-line` (the walk's `folder`). The address updates as you scroll, so copying it shares where you are; a stop counts as soon as its route starts drawing. Opening a link jumps there on load.

## No photo numbers

Photos used to be labelled "Plate 14" (old atlas style). The user didn't know the term and asked to drop it (Oct 23, 2026), so photos now show only the place name or caption. Plates are still numbered internally for the viewer.

## "Click a photo" hint (Oct 23, 2026)

The user asked for a fun squiggly arrow to show the photos can be opened. `Squiggle.svelte` is a hand-drawn route-red arrow (a loop, then a swoop to an arrowhead) that draws itself in, with an italic note: "Click a photo to open it" on desktop, "Tap a photo to open it" on a phone.

- **Desktop:** it sits by a print's top corner, on whichever side and print leaves the note clear of the other prints, or on the clear ground just under the place's name, swooping toward the nearest print. If nothing is readable it waits for the next place.
- **Phone:** it sits above the first photo of the first place with photos, pointing down.
- It disappears for good once any photo is opened (`localStorage` key `taiwan-photo-hint-seen`). To see it again, clear that key.

## Hike stats print and print spacing (Oct 23, 2026)

- **Hike stats card:** the user asked for the AllTrails stats "in a similar format, but not a photo". `walk.stats` in trip.js holds the figures copied from the screenshot (`source`, `figures: [[label, value]]`, `splits: [[mile, pace, ft]]`). `TrailStats.svelte` draws them as a slightly turned paper card beside the trail while the footsteps draw (the '-walk' step).
  - Desktop: bottom-right, with six figures in 3 columns and the mile splits as red pace bars.
  - Phone: top-left under the key map, figures only. The user tried splits on mobile and agreed there isn't room.
  - The screenshot itself (`mianyue-line/alltrails-mianyue-line.jpg`, time 2026-10-21 13:48, set by hand) is back in the hike's photos, unpicked, for the user to choose in the picker.
- **Print overlap (desktop scatter):** placement treats any overlap (plus 10px breathing room) as worse than none, tries 120 spots per print with the biggest placed first, and up to 6 tosses per size. If the prints can't be kept apart, they shrink 6% at a time down to 80% of the starting size (`sqrt(8/n)`, at least 0.55). Past that, the least-overlap toss wins, since the user prefers a little overlap to prints too small to enjoy (Claude's call; at 60% there was zero overlap but prints were tiny).

## Photo viewer

Opening a photo lets you move only through that place's photos, wrapping at the ends; the hike's photos are their own group. The user asked for this on Oct 23, 2026. Each plate carries a `group` (the leg id, or `<leg id>-walk`) set in App.svelte, and the viewer shows "3 / 5" within the group. Prev and next are hidden when a place has a single photo.

**Instant open (Oct 23, 2026, the user asked):** the viewer shows the copy of the photo the page already loaded (a deck print's `currentSrc`, found by matching `srcset`) at once, or else the blurred 20px stand-in. The full-size file fades in over it in the same box once loaded. The "slow" message and spinner only show when there's no loaded copy. The photos either side of the open one are fetched ahead (hidden `.ahead` images, same `sizes="100vw"`), so prev and next are instant too.

## Decisions (all from the user)

- **Structure:** chapters by place or leg, not one per day.
- **Stack:** same as Iceland. Svelte 5 + Vite, fully static, no backend, no map API keys. Deployed to GitHub Pages at https://taiwan.pinkoa2.lol/ (`subdomain` in trip.js).
- **Audience:** Alex and Ting keep it as a keepsake. Friends and family open a shared link, mostly on phones.
- **Keepsake, no live tracker:** only completed legs show. Kaohsiung and Tainan were added on Oct 30, 2026, once Tainan was done.
- **Units:** miles in trip.js, but **no distances are shown anywhere** (the user asked).
- **Visual direction: Survey Sheet**, the map as a printed survey sheet (`.impeccable/surfaces/`, seed 232636eb). It was picked over Night Market Lights and a Tear-off Day Calendar.
- **Minimal map:** the first build had full terrain (elevation tints, contours, rivers, rail, close-up sheets). The user found it laggy and asked for "much simpler, lower quality, no elevation, just a minimal Taiwan map". The map is now a flat land tint plus the coastline, route, places, a few cities, the locator, the frame ticks and the scale bar.
  - The terrain code still exists (contour levels, the `CLOSE_UPS` flag in prepare-trip.js) but is off.
  - The graticule "+" crosses were removed at the user's request.
- **No legend and no miles travelled:** removed at the user's request from the title block, leg cards and closing. The hike's "10 mi · 6 hours" stays because those are the user's own words.
- **Descriptions:** the user writes the card text (`text` in trip.js). The current one-liners are placeholders.

## Route animation

- Each transport mode draws differently: train and metro as hatched rail, bus dashed, car solid, walking as footprints, flight dashed and arced.
- An emoji vehicle rides the head of the route while a leg draws: 🚃 train, 🚈 metro (the user picked light rail over 🚇), 🚌 bus, 🚗 car, ✈️ flight. The user asked for emoji instead of drawn badges. Vehicles flip to face their direction, and the plane rotates along its path.
- **Opening:** the island starts with no place marked. A ✈️ flies in from just off-screen to the east ("from the US"; `from: [24.4, 123.95]` on the Taipei leg), and Taipei's marker and label appear only once it lands (intro step `leg: -1` in story.js).
- **One continuous route, no teleporting (the user asked, Oct 30, 2026, after trying it both ways):** wherever we went out and came back, the way back is drawn too.
  - **Day trips** (`dayTrip: true`): the route draws out to the place; after its photos (and its hike), the vehicle rides back to the base, and the next leg leaves from there. The base is the last leg that isn't a day trip, so day trips in a row (Sun Moon Lake, then Alishan) share it. Day trips: Tamsui (from Taipei), Sun Moon Lake and Alishan (from Yunlin; Alishan was three days but counts, the user asked), Tainan (from Kaohsiung; the user is back in Kaohsiung on Oct 30).
  - **`returnTo: '<leg id>'`**: we went back to that place after this leg; drawn the same way. Shuinandong has `returnTo: 'taipei'`.
  - **`back`** (segments like `by`): how we went back. Without it the way out is retraced. Shuinandong: bus to Ruifang, then train (the tickets in the photos). Alishan: car via Chiayi city. Tainan: retraced by car (assumed; the user said car for the way there).
  - **How it's built:** prepare-trip.js gives such a leg `returns: { to, toIndex, segments, camera }` (`baseOf` and `returnOf`). story.js adds `<id>-return` and `<id>-returned` steps after the place (marks in Leg.svelte and Story.svelte, over open map, no card). Steps carry `at` (the place we're at) besides `leg` (how far through the trip), so after the way back the base is the highlighted place and the badge reads it, while places already visited stay drawn. While riding back the badge reads "08/10 Alishan → Yunlin" (`story.back`).
  - **Desktop card timing (the user reported, Oct 30, 2026: the next title card showed up before we'd left):** a leg's card is in the page flow, so it used to scroll into view about half a screen before its route set off, which showed while the trip back was drawing. A 46svh `.lead` spacer after the `-travel` mark in Leg.svelte now brings the card up from the foot of the screen as the route starts. Phones were fine (the page comes after the route there).
  - **History:** day trips first drew one way and the next leg left from the base ("teleport"). Claude then tried drawing the way back as the start of the next leg; the user dropped it ("we did not spend the night in Tamsui"), then asked for it back as a continuous scroll. It now belongs to the day trip itself.
- **No return sections:** a return visit gets no leg of its own; its photos go in the first visit's folder (the user's call, Oct 30, 2026: "those are Yunlin photos").
  - Yunlin: the second leg (`yunlin-again`, Oct 22) was removed and its 8 photos merged in. Its favourite star was dropped (Yunlin's rice fields stays the favourite). Its description, "Took our time coming back to Yunlin. Visited a mosaic museum", was removed; the user may fold it into Yunlin's.
  - Taipei: the second leg (`taipei-again`, Oct 16–17) was removed and its 4 photos (2 picked) merged in. Its favourite (Ximending at night) was dropped; Liberty Square gate stays. Its description, "Back in Taipei for a single night. Ate some street food and went shopping for cute EasyCard", was removed; the user may fold it into Taipei's.
  - Kaohsiung: the Oct 30 return is in Kaohsiung's dates and folder.
- **Mianyue Line:**
  - A close-up of the trail, drawn as a deliberately childlike railway track (one line with short ties; the user asked for super minimal).
  - Red footprints walk beside the track, starting from the Shizifendao end.
  - **Out and back** (`walk.outAndBack: true`, the user said it was "a go and come back kind of trail", Oct 30, 2026): the footprints walk to the far end and back the same way. Footprints keep to the walker's side, so the way back runs along the other side of the track.
  - Bridge numbers were removed at the user's request; only the trail name and Shizifendao 十字分道 are labelled.
- **Jiufen:** photos hang on strings of cute red lanterns, the user's idea (`hang: 'lanterns'`).
  - The lanterns sway and carry lucky characters (福 喜 樂 春 安 吉 壽 和).
  - About two in five glow yellow and gently flicker.
  - Cords run from under one photo to the top of the next.

## Itinerary (confirmed with the user, dates from photo timestamps)

| Leg | Dates | How we got there |
|---|---|---|
| Taipei 臺北 | Oct 12–14, 16–17 | ✈️ landed at Taoyuan (Oct 12, ~05:45); the Oct 16–17 return's photos are merged in here |
| Tamsui 淡水 | Oct 14 | metro, day trip from Taipei |
| Shifen 十分 | Oct 15 | train (via Ruifang, Pingxi) |
| Jiufen 九份 | Oct 15 (night) | train |
| Shuinandong 水湳洞 | Oct 16 | bus; then back to Taipei by bus + train via Ruifang (tickets in the photos), not drawn |
| Yunlin 雲林 (Dounan) | Oct 17–19, 22–24 | train (the Oct 22 return's photos are merged in here) |
| Sun Moon Lake 日月潭 | Oct 18 | car, day trip from Yunlin |
| Alishan 阿里山 | Oct 20–22 | car, treated as a day trip from Yunlin; via Chiayi and Fenqihu on the way up, tea hills (Shizhuo area) on the way down. All folded into Alishan |
| ↳ Mianyue Line 眠月線 | Oct 21 | on foot: Zhushan sunrise, then about 10 mi / 6 h, a little dangerous, the highlight for Alex |
| Kaohsiung 高雄 | Oct 25–27, 30 | car from Yunlin. Includes Fo Guang Shan and the pineapple fields (Oct 26) and Lotus Pond (Oct 27), folded in (the user's call). Pin from the hotel-window photo's GPS (inferred) |
| Tainan 臺南 | Oct 28–30 | car; treated as a day trip from Kaohsiung (back there by Oct 30). Includes Anping (Oct 30) |

- Yunlin's pin is at Dounan (the user confirmed). "Oct 17" for Yunlin is inferred (no photos that day). Tamsui photos are the Oct 14 afternoon.
- Train legs follow OSM rail between the nearest stations. Bus and car legs use OSRM. Metro is a straight line.

## Photos (imported Oct 23, 2026)

- **Source:** `/home/alex/Downloads/Taiwan 2026 Photos-20261023T071837Z-1-001/Taiwan 2026 Photos`, from Google Drive.
  - 329 files: 107 were exact duplicate "(1)" copies and were skipped.
  - 215 photos (mostly iPhone HEIC) and 7 videos.
- **Sorted** to legs by capture time and GPS. Every photo was looked at and given a descriptive lowercase-hyphenated filename (e.g. `jiufen/red-lantern-alley.jpg`, `mianyue-line/ting-on-the-chain-traverse.jpg`).
- **Compressed:**
  - Photos: max 2000px, JPEG q82, upright.
  - Videos: H.264, max 1280px, CRF 27, with a `-poster.jpg`.
  - **All metadata, including GPS, is stripped.** In total about 158 MB in `content/media/`, to be committed to the repo as with Iceland.
- **Tools:**
  - HEIC needed `pillow-heif` (ImageMagick on this machine can't read iPhone HEIC); it was installed in a throwaway venv in the session scratchpad.
  - The import scripts (scan, convert, copy) also lived in the scratchpad and aren't in the repo. For new photos, ask for a folder and repeat: read EXIF time/GPS → assign to a leg → convert → descriptive name → append to that leg's `photos.json`.
- **Second download (Oct 30, 2026):** `~/Downloads/Taiwan 2026-Google.zip` (2.8 GB, 491 files, one folder, one phone: IMG_0380–0971). 215 photos and 7 videos were already imported; 219 MP4/MOV were Live Photo companions (skipped). New: 43 photos and 7 videos, all `new: true`, unpicked:
  - 7 hike videos (Oct 21 morning) → `mianyue-line`. They're long (18s–1m51s), so they were encoded smaller than the first ones: max 960px, CRF 28 capped at 1.2 Mbps (47 MB together). The first try at CRF 27/1280px was 158 MB.
  - The AllTrails splits screenshot → `mianyue-line/alltrails-splits.jpg`; a café photo (Oct 24) → `yunlin`; 20 → `kaohsiung`; 21 → `tainan`.
  - The conversion scripts are in the session scratchpad (`tools/scan.py`, `convert.py`), not in the repo. `dist` is 366 MB after this.
  - Ting's photos and the camera's may still come; the plan below still applies.
- **Second import (planned, Oct 23, 2026):** many more photos from Alex and Ting, from both iPhones and a camera.
  - The user will make one folder with a subfolder per device (e.g. `alex-iphone/`, `ting-iphone/`, `camera/`), exporting unmodified originals.
  - **No photographer credit** on the site (the user's answer), so don't record or show who took a photo.
  - **Camera clock:** it has no GPS and its clock may be off. Use a photo of a phone's clock taken with the camera, or a moment both shot, to work out the offset, then place camera photos by corrected time only.
  - **Dedupe:** skip exact duplicates (by hash) across devices and "(1)" copies; skip Live Photo `.MOV` companions; take JPEG over RAW.
  - **New places:** the batch includes new stops (Tainan, Kaohsiung, maybe more). Ask the user for the dates and how they travelled, add the legs to trip.js, and fetch their routes.
  - Everything goes in unpicked with `new: true`, sorted by time, for the user to review in the picker's New filter.
  - **Size limit to keep in mind:** a published GitHub Pages site is capped at 1 GB. The built site is about 1.25 MB per photo (four WebP sizes; `dist` was 279 MB for 223 photos on Oct 23, 2026), so the cap is reached at roughly 800 photos. The user expects to stay under 800. After the import, check `du -sh dist`. Since Oct 30, 2026 only picks are built (92 picks: `dist` 130 MB), so this is far off.
- **Picks (Oct 23, 2026):** by default the page shows only `pick: true` photos. Claude made a first pick of 53, about 3–6 per stop and 12 for the hike (the user asked for "only the absolute necessary" by default). `?display=all` used to show every photo; the user dropped it on Oct 30, 2026 (unpicked photos shouldn't be public), and prepare-trip.js now builds picks only. `show: false` hides even a pick.
- **Captions and comments are all empty.** The user will write them in the photo picker (`npm run curate`).
- Stand-in Wikimedia photos and `scripts/mock-photos.js` were removed.

## Where we are

1. [x] Brief, questions, `PRODUCT.md`.
2. [x] Visual direction (Survey Sheet), first build, finish review (two rounds), `DESIGN.md`.
3. [x] User-requested changes:
   - Minimal map.
   - Vehicles, footprints and track.
   - Phone layout (now alternating).
   - No legend or miles.
   - Lantern strings.
   - Plane fly-in.
   - Graticule crosses removed.
   - Taipei appears only once the plane lands.
   - Pointer cursor on photos.
   - Photo layout went back and forth; now the mosaic by default, with a `photoLayout` switch to over-map. Jiufen lanterns are in the page background.
4. [x] Real photos imported and named, with dates, day trips, the metro mode and video playback (Oct 23, 2026).
5. [ ] **Next:** the user uses the photo picker (`npm run curate`) to review the 53 picks, write captions and notes, and write the place descriptions. Captions were first planned as one-by-one sessions with Claude; the picker now covers that, but offer to help draft captions if asked.
6. [x] Kaohsiung and Tainan added (Oct 30, 2026), from the second download. Their photos are all unpicked and marked new, so their decks are empty on the default page until the user picks in the photo picker.
7. [x] **Deployed (Oct 23, 2026).** The user set up git and pushed to `pinkoa2/taiwan-map-scroller` (public; SSH remote `git@github.com:pinkoa2/taiwan-map-scroller.git`). Pages is enabled with "GitHub Actions" as its source and the custom domain `taiwan.pinkoa2.lol` (Porkbun CNAME → `pinkoa2.github.io`), with HTTPS enforced. Pushes used to redeploy through `.github/workflows/deploy.yml`; that workflow was removed on Oct 30, 2026 (no zip on GitHub), so pushes no longer change the live site. **The user does their own pushes**; commit or push only when asked.
8. [ ] **Move hosting to a Linode** per `docs/hosting-plan.md` (not started).

## Known leftovers

- On phones it takes a lot of scrolling to draw each route. Offer to shorten it if the user mentions it.
- On phones the "Mianyue Line" label can sit over some footprints.
- The coastline is coarse when zoomed in close (it comes from a z9 terrain grid).
- `DESIGN.md` predates several changes (minimal map, emoji vehicles, phone layout, lanterns). Its notes section mentions some of them; refresh with `/impeccable document` when asked.

## Working with the user

- Plan and check in before big design changes, and show options (AskUserQuestion with previews works well).
- Never invent places, dates or claims. Use what the user said or what photo metadata shows, and say when something is inferred.
- The user mostly views on a phone. Check both phone (390px) and desktop widths with screenshots (puppeteer-core with `/usr/bin/google-chrome` lives in the scratchpad).
- To show the user: `npx vite preview --host --port 4317` (run detached), or `npm run dev -- --host --port 5173` for live edits. Phones on the wifi use the LAN address (`hostname -I`; it was 192.168.1.105 on Oct 30, 2026, earlier .114).
- If `prepare-trip.js` is re-run while `npm run dev` is up, restart the dev server: the script deletes and recreates `.generated/public/geo`, and Vite then serves the page instead of the map file, so the map comes up blank.
- The user wants everything documented here. Keep this file current after every change.
