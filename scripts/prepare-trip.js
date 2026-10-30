// Turns content/ into everything the page needs at build time:
//   .generated/trip.json      the manifest the Svelte app imports
//   .generated/public/m/      responsive WebP sizes of the picked photos
//   .generated/public/geo/    the island outline
//
// Network is only touched when something isn't cached yet. The results are
// cached in content/geo/ (commit it), so CI builds never hit the network:
//   routes.json     every leg's route, by mode
//   base.json       trails, cities and peaks from OSM
//   sheets/*.json   the island outline, from terrain tiles at sea level
// Raw downloads (terrain tiles, the full rail network for routing) sit in .cache/.
//
// Usage: npm run prepare-trip (dev and build run it first)

import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { pathToFileURL, fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { geoTransverseMercator } from 'd3-geo'
import { openZip, locate, still, videoFile, encodeVideo, videoPoster, VIDEO, mediaDir } from './photo-source.js'
import { contourSheet, tileCount, simplify, encode } from './terrain.js'
import { overpass, waysToLines, graph, nearest, shortestPath, osrm, lineKm, haversineKm, components, bridgeGaps } from './osm.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const contentDir = path.join(root, 'content')
const geoDir = path.join(contentDir, 'geo')
const cacheDir = path.join(root, '.cache')
const outDir = path.join(root, '.generated')
const pubDir = path.join(outDir, 'public')
const trip = (await import(pathToFileURL(path.join(contentDir, 'trip.js')).href + `?t=${Date.now()}`)).default

// Without the zip there's nothing to build photos from (content/media keeps
// only files the zip doesn't have), so stop before touching anything rather
// than publish a site without photos.
if (!(await openZip())) throw new Error('No photos/photos.zip. Run `npm run photos:download` first.')

await fs.rm(path.join(pubDir, 'geo'), { recursive: true, force: true })
await fs.mkdir(path.join(pubDir, 'geo'), { recursive: true })
await fs.mkdir(path.join(geoDir, 'sheets'), { recursive: true })

const readJSON = async (file, fallback) => (existsSync(file) ? JSON.parse(await fs.readFile(file, 'utf8')) : fallback)
const writeJSON = (file, data) => fs.writeFile(file, JSON.stringify(data) + '\n')

// The island's own grid: Transverse Mercator on 121°E (TWD97 / TM2), in metres.
const projection = geoTransverseMercator().rotate([-121, 0]).scale(6378137).translate([0, 0])
const P = ([lon, lat]) => projection([lon, lat])
const ll = ([lat, lng]) => [lng, lat]

// Main island, for the whole-sheet view; the terrain sheet adds Penghu.
const ISLAND = [120.03, 21.89, 122.01, 25.31]
const SHEET = [119.3, 21.85, 122.05, 25.35]

console.log('Preparing the trip')

// ---------- photos ----------
// Only picked photos are built. Each is read from the Drive zip by its
// `original` name (scripts/photo-source.js), or from content/media when the
// zip doesn't have it. Built files carry a short fingerprint of the source,
// so a photo is only converted again when it changes; what each one needs
// (size, placeholder) is remembered in .cache/photos.json.

// 960 is what a phone's deck print needs (its density capped at 2×), 1400 a
// desktop print, 2000 the full-screen viewer.
const WIDTHS = [640, 960, 1400, 2000]
const QUALITY = 74
const builtFile = path.join(cacheDir, 'photos.json')
const built = await readJSON(builtFile, {})
const written = new Set()
let converted = 0


// A still in responsive WebP sizes, named <base>.<print>-<width>.webp.
async function webps(img, base, print) {
  const meta = await img.metadata()
  const turned = (meta.orientation ?? 1) >= 5
  const w = turned ? meta.height : meta.width
  const h = turned ? meta.width : meta.height
  const widths = WIDTHS.filter((x) => x < w).concat(w <= WIDTHS.at(-1) ? [w] : []).slice(0, WIDTHS.length)
  const files = []
  for (const width of widths) {
    const name = `m/${base}.${print}-${width}.webp`
    await fs.mkdir(path.dirname(path.join(pubDir, name)), { recursive: true })
    await img.clone().resize({ width }).webp({ quality: QUALITY }).toFile(path.join(pubDir, name))
    files.push([name, width])
  }
  const tiny = await img.clone().resize(20).blur(1.5).webp({ quality: 40 }).toBuffer()
  return { w, h, files, placeholder: `data:image/webp;base64,${tiny.toString('base64')}` }
}

// A photo, or a video and its poster frame, built unless already there.
async function build(folder, p, src) {
  const base = `${folder}/${p.file.replace(/\.[^.]+$/, '')}`
  const print = crypto.createHash('sha1').update(src.key).digest('hex').slice(0, 8)
  const id = `${base}.${print}`
  const have = built[id]
  if (have && [...have.files.map(([f]) => f), have.video].filter(Boolean).every((f) => existsSync(path.join(pubDir, f)))) return have
  converted++
  let out
  if (VIDEO.test(p.file)) {
    const video = await videoFile(src)
    try {
      const name = `m/${id}.mp4`
      await fs.mkdir(path.dirname(path.join(pubDir, name)), { recursive: true })
      // A local copy is already a web copy (from the first import); one from the zip is the original.
      if (src.local) await fs.copyFile(video.file, path.join(pubDir, name))
      else await encodeVideo(video.file, path.join(pubDir, name))
      // An old local copy has its poster beside it, so no ffmpeg is needed (CI).
      const kept = src.local && p.poster && path.join(mediaDir, folder, p.poster)
      if (kept && existsSync(kept)) out = { ...(await webps(sharp(kept).rotate(), base, print)), video: name }
      else {
        const poster = path.join(cacheDir, `${print}-poster.jpg`)
        await fs.mkdir(cacheDir, { recursive: true })
        await videoPoster(video.file, poster)
        out = { ...(await webps(sharp(poster), base, print)), video: name }
        await fs.rm(poster)
      }
    } finally {
      await video.done()
    }
  } else {
    out = await webps(await still(src), base, print)
  }
  built[id] = out
  await writeJSON(builtFile, built)
  return out
}

// One entry from a folder's photos.json → what the page needs.
async function photo(folder, p) {
  const src = await locate(folder, p)
  if (!src) {
    console.warn(`  ! ${folder}/${p.file} (${p.original ?? 'no original'}) is in neither the zip nor content/media; skipped`)
    return null
  }
  const b = await build(folder, p, src)
  for (const f of [...b.files.map(([f]) => f), b.video].filter(Boolean)) written.add(f)
  return {
    w: b.w,
    h: b.h,
    src: '/' + b.files.at(-1)[0],
    srcset: b.files.map(([f, w]) => `/${f} ${w}w`).join(', '),
    placeholder: b.placeholder,
    file: p.file,
    video: b.video ? '/' + b.video : null,
    caption: p.caption || null,
    comment: p.comment || null,
    taken: p.taken ?? null,
    pick: true,
    // The place's favourite: its deck of prints opens on it.
    favorite: p.favorite === true,
    alt: p.alt || p.caption || p.file.replace(/\.[^.]+$/, '').replace(/-/g, ' '),
  }
}

// Photos go in the order they were taken, unless the place is set to a
// custom order (content/order.json: { "<folder>": "custom" }), in which case
// photos.json's own order is kept. Photos with no time yet go last.
const orders = await readJSON(path.join(contentDir, 'order.json'), {})
const byTaken = (a, b) => (a.taken ? (b.taken ? a.taken.localeCompare(b.taken) : -1) : b.taken ? 1 : 0)

// A place's picked photos (`pick: true`; `show: false` still hides one).
async function photosIn(folder) {
  let list = await readJSON(path.join(mediaDir, folder, 'photos.json'), [])
  if (orders[folder] !== 'custom') list = [...list].sort(byTaken)
  const out = []
  for (const p of list) if (p.pick === true && p.show !== false) out.push(await photo(folder, p))
  return out.filter(Boolean)
}

// A place's description: content/descriptions.json ({ "<id>": "text" },
// written by the curator or by hand) wins over the `text` line in trip.js.
const descriptions = await readJSON(path.join(contentDir, 'descriptions.json'), {})
async function textFor(id, fallback) {
  return descriptions[id]?.trim() || fallback || ''
}

// ---------- OSM: rail (for routing), trails, cities, peaks ----------

const baseFile = path.join(geoDir, 'base.json')
const base = await readJSON(baseFile, {})
let baseDirty = false
const bboxQ = `(${SHEET[1]},${SHEET[0]},${SHEET[3]},${SHEET[2]})`

async function railLines() {
  const raw = path.join(cacheDir, 'rail.json')
  if (!existsSync(raw)) {
    console.log('  fetching the rail network from OpenStreetMap…')
    const els = await overpass(`[out:json][timeout:180];way["railway"~"^(rail|narrow_gauge)$"]["service"!~"."]${bboxQ};out geom;`)
    await fs.mkdir(cacheDir, { recursive: true })
    await writeJSON(raw, waysToLines(els).map((l) => l.map(([x, y]) => [+x.toFixed(7), +y.toFixed(7)])))
  }
  return JSON.parse(await fs.readFile(raw, 'utf8'))
}

const lonlatSimplify = (line, tolDeg) => simplify(line, tolDeg).map(([x, y]) => [+x.toFixed(5), +y.toFixed(5)])

if (!base.cities) {
  console.log('  fetching cities and peaks…')
  const cities = await overpass(`[out:json][timeout:90];node["place"="city"]${bboxQ};out;`)
  base.cities = cities
    .filter((n) => n.tags['name:en'])
    .map((n) => ({ name: n.tags['name:en'].replace(/ City$/, ''), zh: n.tags['name:zh'] ?? n.tags.name, at: [+n.lon.toFixed(4), +n.lat.toFixed(4)] }))
  const peaks = await overpass(`[out:json][timeout:90];node["natural"="peak"]["ele"]${bboxQ};out;`)
  const ranked = peaks
    .map((n) => ({ name: n.tags['name:en'] ?? null, zh: n.tags['name:zh'] ?? n.tags.name ?? null, ele: parseFloat(n.tags.ele), at: [+n.lon.toFixed(4), +n.lat.toFixed(4)] }))
    .filter((p) => p.ele > 0 && p.name)
    .sort((a, b) => b.ele - a.ele)
  // The highest peaks, kept at least 25 km apart so they spread along the range.
  base.peaks = []
  for (const p of ranked) {
    if (base.peaks.length >= 7) break
    if (base.peaks.every((q) => haversineKm(q.at, p.at) > 25)) base.peaks.push({ ...p, ele: Math.round(p.ele) })
  }
  baseDirty = true
}
base.trails ??= {}
base.trailMarks ??= {}
if (baseDirty) await writeJSON(baseFile, base)

async function trail(osmName, near) {
  if (base.trails[osmName]) return base.trails[osmName]
  console.log(`  fetching the ${osmName} trail…`)
  const [lon, lat] = near
  const els = await overpass(`[out:json][timeout:90];way["name"="${osmName}"](${lat - 0.25},${lon - 0.25},${lat + 0.25},${lon + 0.25});out geom;`)
  const nodes = graph(waysToLines(els))
  const deadEnds = nodes.filter((n) => n.adj.length === 1)
  bridgeGaps(nodes, 0.08)
  components(nodes)
  // The trail runs between its two farthest-apart dead ends.
  let pair = null
  let far = -1
  for (const a of deadEnds) for (const b of deadEnds) {
    if (a.comp !== b.comp) continue
    const d = haversineKm(a.c, b.c)
    if (d > far) [far, pair] = [d, [a, b]]
  }
  const coords = pair ? shortestPath(pair[0], pair[1]) : null
  if (!coords) throw new Error(`No trail named ${osmName} found near ${near}`)
  base.trails[osmName] = coords.map(([x, y]) => [+x.toFixed(6), +y.toFixed(6)])
  await writeJSON(baseFile, base)
  return base.trails[osmName]
}

// Named features along a trail, for its close-up: halts and stations,
// and its numbered bridges (OSM names them like "13號橋36,3m").
async function trailMarks(osmName, near) {
  if (base.trailMarks[osmName]) return base.trailMarks[osmName]
  const [lon, lat] = near
  const box = `(${lat - 0.25},${lon - 0.25},${lat + 0.25},${lon + 0.25})`
  const els = await overpass(
    `[out:json][timeout:90];way["name"="${osmName}"]${box}->.t;(node(around.t:150)["name"]["railway"~"^(station|halt)$"];way(around.t:30)["name"~"號橋"];);out center;`,
  )
  base.trailMarks[osmName] = els.map((e) => {
    const c = e.center ?? e
    const at = [+c.lon.toFixed(6), +c.lat.toFixed(6)]
    const bridge = e.tags.name.match(/^(\d+)號橋/)
    return bridge
      ? { kind: 'bridge', name: bridge[1], at }
      : { kind: 'halt', name: e.tags['name:en'] ?? e.tags.name, zh: e.tags.name, at }
  })
  await writeJSON(baseFile, base)
  return base.trailMarks[osmName]
}

// ---------- routes ----------

const routesFile = path.join(geoDir, 'routes.json')
const routes = await readJSON(routesFile, {})
let railGraph = null

// A gentle arc for flights and ferries, so they read as crossings rather than roads.
function arc(a, b) {
  const [pa, pb] = [P(a), P(b)]
  const mx = (pa[0] + pb[0]) / 2
  const my = (pa[1] + pb[1]) / 2
  const dx = pb[0] - pa[0]
  const dy = pb[1] - pa[1]
  const cx = mx - dy * 0.18
  const cy = my + dx * 0.18
  const pts = []
  for (let i = 0; i <= 32; i++) {
    const t = i / 32
    const x = (1 - t) ** 2 * pa[0] + 2 * (1 - t) * t * cx + t ** 2 * pb[0]
    const y = (1 - t) ** 2 * pa[1] + 2 * (1 - t) * t * cy + t ** 2 * pb[1]
    pts.push(projection.invert([x, y]).map((n) => +n.toFixed(5)))
  }
  return pts
}

async function route(mode, a, b) {
  const key = `${mode}:${a.map((n) => n.toFixed(4))}>${b.map((n) => n.toFixed(4))}`
  if (routes[key]) return routes[key]
  let coords = null
  if (mode === 'train') {
    if (!railGraph) {
      railGraph = graph(await railLines())
      bridgeGaps(railGraph, 0.06)
      components(railGraph)
    }
    // Both ends must land on the same connected piece of track.
    const na = nearest(railGraph, a)
    const nb = nearest(railGraph, b, (n) => n.comp === na.comp)
    const path_ = na && nb ? shortestPath(na, nb) : null
    if (path_) {
      coords = path_
      // Stations sit beside the tracks; join the real places on.
      if (haversineKm(a, coords[0]) > 0.15) coords.unshift(a)
      if (haversineKm(b, coords.at(-1)) > 0.15) coords.push(b)
    }
  } else if (mode === 'bus' || mode === 'car') {
    coords = await osrm([a, b])
  } else if (mode === 'flight' || mode === 'ferry') {
    coords = arc(a, b)
  } else if (mode === 'metro') {
    // The metro isn't in the rail data used for routing; a straight run reads fine.
    coords = [a, b]
  }
  if (!coords) {
    console.warn(`  ! no ${mode} route ${key}; drawing a straight line`)
    return { coords: [a, b], km: haversineKm(a, b) }
  }
  coords = lonlatSimplify(coords, 0.00004)
  routes[key] = { coords, km: +lineKm(coords).toFixed(2) }
  await writeJSON(routesFile, routes)
  console.log(`  routed ${key}`)
  return routes[key]
}

// ---------- cameras ----------
// A camera is a box in sheet metres: centre x, y and width w, height h.

function boxOf(points, pad, minSize) {
  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])
  let [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const w = Math.max((x1 - x0) * (1 + pad), minSize)
  const h = Math.max((y1 - y0) * (1 + pad), minSize)
  return { x: Math.round((x0 + x1) / 2), y: Math.round((y0 + y1) / 2), w: Math.round(w), h: Math.round(h) }
}
const around = (lonlat, km) => {
  const [x, y] = P(lonlat)
  return { x: Math.round(x), y: Math.round(y), w: km * 1000, h: km * 1000 * 0.75 }
}

// ---------- legs ----------

const unit = trip.units === 'km' ? 'km' : 'mi'
const toUnit = (km) => (unit === 'mi' ? km * 0.621371 : km)
const Q_ROUTE = 5

// The place a leg's trip leaves from: the leg before it, skipping back over
// day trips (Sun Moon Lake, then Alishan, both leave from Yunlin), or the
// place a leg went back to (`returnTo`).
function baseOf(i) {
  if (i === 0) return null
  let b = i - 1
  while (b > 0 && trip.legs[b].dayTrip) b--
  return returnOf(b) ?? trip.legs[b]
}
// Where we went back to after a leg: a day trip's base, or its `returnTo`.
function returnOf(i) {
  const leg = trip.legs[i]
  if (leg.returnTo) {
    const to = trip.legs.find((l) => l.id === leg.returnTo)
    if (!to) throw new Error(`${leg.id}: returnTo '${leg.returnTo}' is not a leg id`)
    return to
  }
  return leg.dayTrip ? baseOf(i) : null
}

// A run of segments from one place to another, as `by` lists them.
async function segmentsFor(by, from, at) {
  const out = []
  for (const seg of by) {
    const to = seg.to ? ll(seg.to) : at
    const r = await route(seg.mode, from, to)
    out.push({
      mode: seg.mode,
      toName: seg.to ? seg.toName ?? null : null,
      km: r.km,
      dist: +toUnit(r.km).toFixed(1),
      line: encode(r.coords.map(P), Q_ROUTE),
      _pts: r.coords.map(P),
    })
    from = to
  }
  return out
}

const legs = []
for (const [i, leg] of trip.legs.entries()) {
  const at = ll(leg.at)
  // Where this leg set out from: the leg before it, or, after a day trip,
  // the place the day trip left from. The first leg can arrive from off the
  // map (`from` on its first segment).
  const base = baseOf(i)
  const prev = base ? ll(base.at) : leg.by?.[0]?.from ? ll(leg.by[0].from) : null
  const segments = prev ? await segmentsFor(leg.by?.length ? leg.by : [{ mode: 'car' }], prev, at) : []

  // The way back, drawn after the place's photos so the route never breaks:
  // `back` if given, else the way out, retraced.
  let returns = null
  const home = returnOf(i)
  if (home) {
    const back = leg.back?.length
      ? await segmentsFor(leg.back, at, ll(home.at))
      : [...segments].reverse().map((s, k) => {
          const pts = [...s._pts].reverse()
          // Retraced, each segment reaches where its outbound one set off from.
          const toName = k < segments.length - 1 ? segments[segments.length - 2 - k].toName : null
          return { ...s, toName, line: encode(pts, Q_ROUTE), _pts: pts }
        })
    returns = {
      to: home.name,
      toIndex: trip.legs.indexOf(home),
      segments: back.map(({ _pts, ...s }) => s),
      camera: boxOf(back.flatMap((s) => s._pts), 0.45, 9000),
    }
  }

  let walk = null
  if (leg.walk) {
    let coords = await trail(leg.walk.osmName, at)
    // Walk it from the end nearer the place we set out from.
    if (haversineKm(coords.at(-1), at) < haversineKm(coords[0], at)) coords = [...coords].reverse()
    // An out-and-back trail: to the far end and back the same way. Footprints
    // keep to the walker's side, so the way back runs on the track's other side.
    if (leg.walk.outAndBack) coords = [...coords, ...[...coords].reverse().slice(1)]
    const pts = coords.map(P)
    walk = {
      name: leg.walk.name,
      zh: leg.walk.zh ?? null,
      folder: leg.walk.folder ?? `${leg.id}-walk`,
      miles: leg.walk.miles ?? null,
      hours: leg.walk.hours ?? null,
      text: await textFor(leg.walk.folder ?? `${leg.id}-walk`, leg.walk.text),
      by: leg.walk.by ?? null,
      track: !!leg.walk.track,
      line: encode(pts, Q_ROUTE),
      camera: boxOf(pts, 0.35, 4000),
      start: pts[0].map(Math.round),
      end: pts.at(-1).map(Math.round),
      when: leg.walk.when ?? null,
      photos: await photosIn(leg.walk.folder ?? `${leg.id}-walk`),
      // Hike stats (e.g. from AllTrails), shown as a card beside the trail as it draws.
      stats: leg.walk.stats ?? null,
      marks: (await trailMarks(leg.walk.osmName, at)).map((m) => ({ ...m, at: P(m.at).map(Math.round) })),
    }
  }

  const routePts = segments.flatMap((s) => s._pts)
  legs.push({
    id: leg.id,
    name: leg.name,
    zh: leg.zh ?? null,
    at: P(at).map(Math.round),
    stay: leg.stay ?? null,
    when: leg.when ?? null,
    arrive: leg.arrive ?? null,
    text: await textFor(leg.id, leg.text),
    from: base ? base.name : leg.by?.[0]?.fromName ?? null,
    dayTrip: !!leg.dayTrip,
    hang: leg.hang ?? null,
    segments: segments.map(({ _pts, ...s }) => s),
    dist: +segments.reduce((s, g) => s + toUnit(g.km), 0).toFixed(1),
    travelCamera: routePts.length ? boxOf(routePts, 0.45, 9000) : null,
    camera: around(at, leg.view ?? 16),
    walk,
    returns,
    photos: await photosIn(leg.folder ?? leg.id),
    gmaps: `https://www.google.com/maps/search/?api=1&query=${leg.at[0]},${leg.at[1]}`,
  })
}

// ---------- the island ----------
// A minimal map: the island's outline only, no elevation, so it stays light
// and fast. Contoured from terrain tiles at sea level and cached in content/geo/sheets/.

const Q_ISLAND = 20
const islandSpec = { bbox: SHEET, z: 9, levels: [0], q: Q_ISLAND, interval: 200, mask: 'mainland' }
// The sheet is Taiwan's: the Fujian coast at its north-west corner is left as sea.
const MASKS = { mainland: (lon, lat) => lon < 120.0 && lat > 24.0 }

async function sheet(spec, name) {
  const hash = crypto.createHash('sha1').update(JSON.stringify(spec)).digest('hex').slice(0, 10)
  const file = path.join(geoDir, 'sheets', `${hash}.json`)
  if (!existsSync(file)) {
    console.log(`  outlining ${name} (z${spec.z}, ${tileCount(spec.bbox, spec.z)} tiles)…`)
    const out = await contourSheet({ ...spec, mask: MASKS[spec.mask] ?? null, project: P, cacheDir: path.join(cacheDir, 'dem') })
    out.bands = out.bands.filter((b) => b.polys.length)
    out.interval = spec.interval
    await writeJSON(file, out)
  }
  await fs.copyFile(file, path.join(pubDir, 'geo', `${hash}.json`))
  return hash
}

const islandSheet = await sheet(islandSpec, 'the island')
const sheets = []
// Keep only the sheets this trip still uses.
for (const f of await fs.readdir(path.join(geoDir, 'sheets'))) if (f !== `${islandSheet}.json`) await fs.rm(path.join(geoDir, 'sheets', f))

if (baseDirty) await writeJSON(baseFile, base)

// ---------- totals, cover, meta ----------

const byMode = {}
for (const l of legs) for (const s of l.segments) byMode[s.mode] = (byMode[s.mode] ?? 0) + toUnit(s.km)
for (const l of legs) if (l.walk?.miles) byMode.walk = (byMode.walk ?? 0) + (unit === 'mi' ? l.walk.miles : l.walk.miles * 1.609)
for (const k in byMode) byMode[k] = Math.round(byMode[k])

// The link-preview photo: `cover` is "<folder>/<file>", as listed in that folder's photos.json.
const [coverFolder, coverName] = trip.cover.split('/')
const coverEntry = (await readJSON(path.join(mediaDir, coverFolder, 'photos.json'), [])).find((p) => p.file === coverName) ?? { file: coverName }
const coverSrc = await locate(coverFolder, coverEntry)
if (!coverSrc) throw new Error(`Missing cover photo ${trip.cover}`)
await (await still(coverSrc)).resize(1200, 630, { fit: 'cover', position: 'attention' }).jpeg({ quality: 82 }).toFile(path.join(pubDir, 'og.jpg'))

// Built photos no longer picked (or replaced by a newer version) are removed.
async function prune(dir) {
  for (const d of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const f = path.join(dir, d.name)
    if (d.isDirectory()) await prune(f)
    else if (!written.has(path.relative(pubDir, f).split(path.sep).join('/'))) await fs.rm(f)
  }
}
await prune(path.join(pubDir, 'm'))
for (const id of Object.keys(built)) if (!built[id].files.every(([f]) => written.has(f))) delete built[id]
await writeJSON(builtFile, built)
if (trip.subdomain) await fs.writeFile(path.join(pubDir, 'CNAME'), trip.subdomain + '\n')
await fs.writeFile(
  path.join(pubDir, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="6" fill="#dfe6d2"/><path d="M38 6c6 8 9 18 8 30-1 9-5 17-11 22-4-6-9-12-11-21-2-10 2-22 14-31z" fill="#cdb98f" stroke="#8a5a2b" stroke-width="2"/><path d="M14 50 30 26l8 8 12-20" fill="none" stroke="#e2401c" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>\n`,
)

const manifest = {
  title: trip.title,
  titleZh: trip.titleZh ?? null,
  year: trip.year ?? null,
  travellers: trip.travellers ?? [],
  // The title card's line: from the photo picker (descriptions.json "intro"), else trip.js.
  summary: descriptions.intro?.trim() || trip.summary || '',
  continues: trip.continues ?? null,
  photoLayout: { wide: 'scatter', phone: 'prints', ...(trip.photoLayout ?? {}) },
  unit,
  subdomain: trip.subdomain ?? null,
  island: boxOf([P([ISLAND[0], ISLAND[1]]), P([ISLAND[2], ISLAND[3]])], 0.06, 0),
  geo: { island: islandSheet, sheets },
  cities: base.cities.map((c) => ({ ...c, at: P(c.at).map(Math.round) })),
  peaks: base.peaks.map((p) => ({ ...p, at: P(p.at).map(Math.round) })),
  byMode,
  places: new Set(trip.legs.map((l) => l.name)).size,
  legs,
}
await writeJSON(path.join(outDir, 'trip.json'), manifest)
const nPhotos = legs.reduce((a, l) => a + l.photos.length + (l.walk?.photos.length ?? 0), 0)
console.log(`  ${legs.length} legs · ${nPhotos} picked photos (${converted} converted) · ${Object.entries(byMode).map(([k, v]) => `${v} ${unit} ${k}`).join(' · ')}`)
