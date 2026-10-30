// Draws the survey sheet onto a canvas: hypsometric bands, water-lined coast,
// contours, rivers, rail, the inked route and the places, framed by a neat
// line with graticule ticks. Everything is in sheet metres (Transverse
// Mercator on 121°E); the camera maps metres to screen pixels.

import { geoTransverseMercator } from 'd3-geo'
import { colours } from './palette.js'
import { stampVehicle } from './vehicles.js'

const projection = geoTransverseMercator().rotate([-121, 0]).scale(6378137).translate([0, 0])

// [x0, y0, dx, dy, …] in units of q → flat Float64Array of metres.
export function decode(enc, q) {
  const out = new Float64Array(enc.length)
  let x = 0
  let y = 0
  for (let i = 0; i < enc.length; i += 2) {
    x += enc[i]
    y += enc[i + 1]
    out[i] = x * q
    out[i + 1] = y * q
  }
  return out
}

function addLine(path, pts, close) {
  path.moveTo(pts[0], pts[1])
  for (let i = 2; i < pts.length; i += 2) path.lineTo(pts[i], pts[i + 1])
  if (close) path.closePath()
}

export function buildSheet(json) {
  const bands = json.bands.map((b) => {
    const path = new Path2D()
    for (const poly of b.polys) for (const ring of poly) addLine(path, decode(ring, json.q), true)
    return { level: b.level, path }
  })
  const clip = new Path2D()
  addLine(clip, decode(json.clip, json.q), true)
  return { bands, clip, interval: json.interval, pixel: json.pixel }
}

export function buildBase(json) {
  const lines = (list) => {
    const path = new Path2D()
    for (const l of list) addLine(path, decode(l, json.q), false)
    return path
  }
  return { rail: lines(json.rail), rivers: lines(json.rivers) }
}

// A route as a polyline with cumulative lengths, so it can be inked partway.
export function buildLine(enc, q) {
  const pts = decode(enc, q)
  const cum = new Float64Array(pts.length / 2)
  for (let i = 1; i < cum.length; i++) cum[i] = cum[i - 1] + Math.hypot(pts[2 * i] - pts[2 * i - 2], pts[2 * i + 1] - pts[2 * i - 1])
  return { pts, cum, length: cum[cum.length - 1] }
}

function partial(ctx, line, f) {
  const { pts, cum, length } = line
  const stop = length * Math.min(Math.max(f, 0), 1)
  ctx.moveTo(pts[0], pts[1])
  for (let i = 1; i < cum.length; i++) {
    if (cum[i] <= stop) {
      ctx.lineTo(pts[2 * i], pts[2 * i + 1])
      continue
    }
    const t = (stop - cum[i - 1]) / (cum[i] - cum[i - 1] || 1)
    ctx.lineTo(pts[2 * i - 2] + (pts[2 * i] - pts[2 * i - 2]) * t, pts[2 * i - 1] + (pts[2 * i + 1] - pts[2 * i - 1]) * t)
    break
  }
}

// The point where a partly inked line currently ends.
function tip(line, f) {
  const { pts, cum, length } = line
  const stop = length * Math.min(Math.max(f, 0), 1)
  for (let i = 1; i < cum.length; i++) {
    if (cum[i] >= stop) {
      const t = (stop - cum[i - 1]) / (cum[i] - cum[i - 1] || 1)
      return [pts[2 * i - 2] + (pts[2 * i] - pts[2 * i - 2]) * t, pts[2 * i - 1] + (pts[2 * i + 1] - pts[2 * i - 1]) * t]
    }
  }
  return [pts[pts.length - 2], pts[pts.length - 1]]
}

// Where a partly drawn line ends, and which way it's heading there.
function heading(line, f) {
  const { pts, cum, length } = line
  const stop = length * Math.min(Math.max(f, 0), 1)
  for (let i = 1; i < cum.length; i++) {
    if (cum[i] >= stop) {
      const t = (stop - cum[i - 1]) / (cum[i] - cum[i - 1] || 1)
      const ax = pts[2 * i - 2]
      const ay = pts[2 * i - 1]
      const dx = pts[2 * i] - ax
      const dy = pts[2 * i + 1] - ay
      return [ax + dx * t, ay + dy * t, dx, dy]
    }
  }
  return [pts[pts.length - 2], pts[pts.length - 1], 1, 0]
}

// A railway track as a child would draw it: one line with short ties across.
function drawTrack(ctx, line, toScreen) {
  const { pts, length } = line
  const [x0, y0] = toScreen(pts[0], pts[1])
  const [x1, y1] = toScreen(pts[0] + 1000, pts[1])
  const pxPerM = Math.hypot(x1 - x0, y1 - y0) / 1000
  if (pxPerM * length < 40) return
  ctx.strokeStyle = colours.inkSoft
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 1.6
  ctx.beginPath()
  for (let i = 0; i < pts.length; i += 2) {
    const [sx, sy] = toScreen(pts[i], pts[i + 1])
    i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy)
  }
  ctx.stroke()
  const step = 10 / pxPerM
  ctx.lineWidth = 1.4
  ctx.beginPath()
  for (let d = step / 2; d < length; d += step) {
    const [x, y, dx, dy] = heading(line, d / length)
    const [sx, sy] = toScreen(x, y)
    const n = Math.hypot(dx, dy) || 1
    const nx = (-dy / n) * 5
    const ny = (dx / n) * 5
    ctx.moveTo(sx - nx, sy - ny)
    ctx.lineTo(sx + nx, sy + ny)
  }
  ctx.stroke()
}

// Footprints along the inked part of a walk, left and right in turn, in screen pixels.
function drawFootprints(ctx, line, f, toScreen, beside = false) {
  const { pts, cum, length } = line
  const [x0, y0] = toScreen(pts[0], pts[1])
  const [x1, y1] = toScreen(pts[0] + 1000, pts[1])
  const pxPerM = Math.hypot(x1 - x0, y1 - y0) / 1000
  const stepM = 16 / pxPerM
  const stop = length * Math.min(Math.max(f, 0), 1)
  const count = Math.floor(stop / stepM)
  ctx.fillStyle = colours.route
  // Too small to read as feet: a dotted line instead.
  if (count > 600 || pxPerM * length < 40) {
    for (let d = 0; d <= stop; d += 8 / pxPerM) {
      const [x, y] = heading(line, d / length)
      const [sx, sy] = toScreen(x, y)
      ctx.beginPath()
      ctx.arc(sx, sy, 1.8, 0, Math.PI * 2)
      ctx.fill()
    }
    return
  }
  for (let n = 0; n <= count; n++) {
    const [x, y, dx, dy] = heading(line, (n * stepM) / length)
    const [sx, sy] = toScreen(x, y)
    const a = Math.atan2(dy, dx)
    const side = n % 2 ? 1 : -1
    // Walked alongside the line, clear of the track drawn on it.
    const off = (beside ? 14 : 0) + 3.6 * side
    ctx.save()
    ctx.translate(sx - Math.sin(a) * off, sy + Math.cos(a) * off)
    ctx.rotate(a)
    ctx.beginPath()
    ctx.ellipse(2, 0, 4.2, 2.5, 0, 0, Math.PI * 2)
    ctx.moveTo(-2.2, 0)
    ctx.ellipse(-4.2, 0, 2.1, 1.9, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

// The vehicle riding the route: a red doodle (vehicles.js), or an emoji for
// a mode without one (ferry). Emoji side views face left on most platforms,
// so they're flipped when heading right.
const VEHICLE_EMOJI = { train: '🚃', metro: '🚈', bus: '🚌', car: '🚗', ferry: '⛴️', flight: '✈️' }
const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'

function drawVehicle(ctx, mode, x, y, left, angle = 0) {
  if (stampVehicle(ctx, mode, x, y, left, angle)) return
  const emoji = VEHICLE_EMOJI[mode]
  if (!emoji) return
  ctx.save()
  ctx.translate(x, y)
  // ✈️ is drawn pointing up and to the right; turn it to fly along the line.
  if (mode === 'flight') ctx.rotate(angle + Math.PI / 4)
  else if (!left) ctx.scale(-1, 1)
  ctx.font = `28px ${EMOJI_FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgb(40 36 20 / 0.35)'
  ctx.shadowBlur = 6
  ctx.shadowOffsetY = 2
  ctx.fillText(emoji, 0, -2)
  ctx.restore()
}

const smooth = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1)
  return t * t * (3 - 2 * t)
}

const FONT_LABEL = '"Barlow Condensed", "Arial Narrow", sans-serif'
const FONT_ZH = '"Noto Serif TC", serif'

export class SheetRenderer {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.island = null
    this.sheets = [] // { box, z, data }
    this.base = null
    this.dpr = 1
    this.w = 0
    this.h = 0
    this.cache = null
    // Bumped whenever map data arrives, so the base cache repaints.
    this.version = 0
    this.stale = false
  }

  changed() {
    this.version++
  }

  resize(w, h) {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.w = w
    this.h = h
    this.canvas.width = Math.round(w * this.dpr)
    this.canvas.height = Math.round(h * this.dpr)
    this.version++
  }

  // view: { cx, cy, mpp, fx, fy } — the sheet point cx,cy sits at screen fx,fy,
  // at mpp metres per CSS pixel.
  // scene: { segments: [{ line, mode, f }], places: [{ x, y, name, zh, state }], cities, peaks, trail }
  draw(view, scene, frame) {
    const { ctx, dpr, w, h } = this
    const { cx, cy, mpp, fx, fy } = view
    const k = 1 / mpp // px per metre
    const px = mpp // one CSS pixel, in metres
    const toScreen = (x, y) => [(x - cx) * k + fx, (y - cy) * k + fy]

    this.drawBase(view)

    // World transform: metres → CSS px.
    const world = () => ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * (fx - cx * k), dpr * (fy - cy * k))

    // Reference places: peaks and cities, set quietly under the route and
    // kept clear of the trip's own place names.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.margin = frame.margin
    const places = this.layoutPlaces(scene, toScreen, frame.margin)

    // A trail that was once a railway is drawn as a track, whole, under the
    // footprints that walk along it.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    for (const s of scene.segments) if (s.track) drawTrack(ctx, s.line, toScreen)
    world()

    // The route: a paper halo first, then each segment in its transport symbol.
    ctx.lineCap = 'round'
    for (const s of scene.segments) {
      if (s.f <= 0 || s.mode === 'walk') continue
      ctx.beginPath()
      partial(ctx, s.line, s.f)
      ctx.strokeStyle = colours.halo
      ctx.globalAlpha = 0.85
      ctx.lineWidth = 8 * px
      ctx.stroke()
    }
    ctx.globalAlpha = 1
    for (const s of scene.segments) {
      if (s.f <= 0 || s.mode === 'walk') continue
      ctx.beginPath()
      partial(ctx, s.line, s.f)
      routeStroke(ctx, s.mode, px)
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    for (const s of scene.segments) if (s.f > 0 && s.mode === 'walk') drawFootprints(ctx, s.line, s.f, toScreen, s.track)

    // Lettering sits over the route on its paper halo, so the line never strikes through it.
    this.drawReference(scene, toScreen, mpp, places.boxes)
    this.drawTrailLabel(scene, toScreen, mpp)
    this.drawPlaces(places)

    // Whatever we were travelling on rides at the head of the line while it's drawn.
    const running = scene.segments.find((s) => s.f > 0 && s.f < 1)
    if (running && running.mode !== 'walk') {
      const [x, y, dx, dy] = heading(running.line, running.f)
      const [sx, sy] = toScreen(x, y)
      drawVehicle(ctx, running.mode, sx, sy, dx < 0, Math.atan2(dy, dx))
    }

    this.drawFrame(frame, view)
    this.drawLocator(frame, view)
  }

  // Terrain, rivers and rail for one view, into any canvas (`scale` is its
  // device pixels per CSS pixel). Fades are judged on the real screen view.
  paintBase(ctx, view, scale, screen) {
    const { cx, cy, mpp, fx, fy } = view
    const k = 1 / mpp
    const px = mpp
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = colours.sea
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

    // World transform: metres → device pixels of this canvas.
    const world = () => ctx.setTransform(scale * k, 0, 0, scale * k, scale * (fx - cx * k), scale * (fy - cy * k))

    if (this.island) {
      world()
      this.drawTerrain(ctx, this.island, px, 1, true)
    }
    for (const s of this.sheets) {
      if (!s.data) continue
      // A close-up sheet fades in once the view is finer than the island's
      // grid, and only while it covers the whole screen, so its edges never show.
      const a = this.sheetAlpha(s, screen)
      if (a <= 0.01) continue
      world()
      ctx.save()
      ctx.clip(s.data.clip)
      ctx.globalAlpha = a
      this.drawTerrain(ctx, s.data, px, a, false)
      ctx.restore()
    }

    world()
    if (this.base) {
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.strokeStyle = colours.river
      ctx.globalAlpha = smooth(900, 250, mpp) * 0.85
      ctx.lineWidth = 0.9 * px
      if (ctx.globalAlpha > 0.02) ctx.stroke(this.base.rivers)
      ctx.globalAlpha = 1
      // The standard railway symbol: a black line with white breaks, once it's legible.
      ctx.strokeStyle = colours.rail
      ctx.lineWidth = (mpp > 300 ? 0.9 : 2.2) * px
      ctx.stroke(this.base.rail)
      if (mpp < 300) {
        ctx.strokeStyle = colours.paper
        ctx.lineWidth = 1 * px
        ctx.setLineDash([5 * px, 5 * px])
        ctx.stroke(this.base.rail)
        ctx.setLineDash([])
      }
    }

  }

  sheetAlpha(s, { view, w, h }) {
    const { cx, cy, mpp, fx, fy } = view
    const x0 = (s.box[0] - cx) / mpp + fx
    const y0 = (s.box[1] - cy) / mpp + fy
    const x1 = (s.box[2] - cx) / mpp + fx
    const y1 = (s.box[3] - cy) / mpp + fy
    const cover = (Math.max(0, Math.min(x1, w) - Math.max(x0, 0)) * Math.max(0, Math.min(y1, h) - Math.max(y0, 0))) / (w * h)
    return smooth(s.data.pixel * 4, s.data.pixel * 1.6, mpp) * smooth(0.9, 0.995, cover)
  }

  // The base layers are costly, so they're painted into an oversized cache and
  // reused, scaled and shifted, while the view stays near it. A view that has
  // drifted gets a fresh paint; `stale` asks for a sharp repaint once idle.
  drawBase(view, force = false) {
    const { ctx, dpr, w, h } = this
    const { cx, cy, mpp, fx, fy } = view
    const screen = { view, w, h }
    let c = this.cache
    const fits = (c) => {
      if (!c || c.version !== this.version) return false
      const ratio = c.mpp / mpp
      if (ratio < 0.8 || ratio > 1.25) return false
      // The screen's corners, in the cache's CSS pixels.
      const sx0 = (cx - fx * mpp - c.x0) / c.mpp
      const sy0 = (cy - fy * mpp - c.y0) / c.mpp
      const sx1 = sx0 + (w * mpp) / c.mpp
      const sy1 = sy0 + (h * mpp) / c.mpp
      if (sx0 < 0 || sy0 < 0 || sx1 > c.w || sy1 > c.h) return false
      // Sheet fades must still read the same.
      return this.sheets.every((s) => !s.data || Math.abs(this.sheetAlpha(s, screen) - (c.alphas.get(s) ?? 0)) < 0.08)
    }
    if (force || !fits(c)) {
      const pad = 0.3
      const cw = Math.round(w * (1 + 2 * pad))
      const ch = Math.round(h * (1 + 2 * pad))
      c = this.cache ?? { canvas: document.createElement('canvas') }
      c.canvas.width = Math.round(cw * dpr)
      c.canvas.height = Math.round(ch * dpr)
      c.w = cw
      c.h = ch
      c.mpp = mpp
      c.x0 = cx - (fx + w * pad) * mpp
      c.y0 = cy - (fy + h * pad) * mpp
      c.version = this.version
      c.alphas = new Map(this.sheets.filter((s) => s.data).map((s) => [s, this.sheetAlpha(s, screen)]))
      const cv = { cx, cy, mpp, fx: fx + w * pad, fy: fy + h * pad }
      this.paintBase(c.canvas.getContext('2d'), cv, dpr, screen)
      this.cache = c
    }
    const r = c.mpp / mpp
    const ox = (c.x0 - cx) / mpp + fx
    const oy = (c.y0 - cy) / mpp + fy
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(c.canvas, ox * dpr, oy * dpr, c.w * r * dpr, c.h * r * dpr)
    this.stale = Math.abs(r - 1) > 0.02
  }

  // The island as a flat printed shape: one land tint and a coastline.
  drawTerrain(ctx, sheet, px, alpha) {
    const coast = sheet.bands[0]
    if (!coast) return
    ctx.globalAlpha = alpha
    ctx.lineJoin = 'round'
    ctx.strokeStyle = colours.seaLine
    ctx.globalAlpha = alpha * 0.35
    ctx.lineWidth = 7 * px
    ctx.stroke(coast.path)
    ctx.globalAlpha = alpha
    ctx.fillStyle = colours.land
    ctx.fill(coast.path, 'evenodd')
    ctx.strokeStyle = colours.coast
    ctx.lineWidth = 1.1 * px
    ctx.stroke(coast.path)
    ctx.globalAlpha = 1
  }

  // Where each visited place's mark and label go. Labels try right, left,
  // above and below; a label with no clear spot is dropped, except the
  // current place's, which always shows.
  layoutPlaces(scene, toScreen, margin) {
    const { ctx, w, h } = this
    const inside = (b) => b[0] > margin + 4 && b[2] < w - margin - 4 && b[1] > margin + 4 && b[3] < h - margin - 4
    const drawn = new Map()
    for (const p of scene.places) {
      if (p.state === 'ahead') continue
      const key = `${p.x},${p.y}`
      // A place visited twice keeps one mark; the current visit wins.
      if (drawn.has(key) && p.state !== 'here') continue
      drawn.set(key, p)
    }
    const marks = [...drawn.values()]
      .sort((a, b) => (b.state === 'here') - (a.state === 'here'))
      .map((p) => {
        const [x, y] = toScreen(p.x, p.y)
        return { p, x, y, here: p.state === 'here' }
      })
    const boxes = marks.map((m) => [m.x - 9, m.y - 9, m.x + 9, m.y + 9])
    const labels = []
    for (const m of marks) {
      const size = m.here ? 19 : 14
      ctx.font = `600 ${size}px ${FONT_LABEL}`
      const name = m.p.name.toUpperCase()
      const nw = textWidth(ctx, name, 0.1)
      ctx.font = `600 ${size - 2}px ${FONT_ZH}`
      const zw = m.p.zh ? ctx.measureText(m.p.zh).width + 6 : 0
      const width = nw + zw
      const spots = [
        [m.x + 15, m.y],
        [m.x - 15 - width, m.y],
        [m.x - width / 2, m.y - 22],
        [m.x - width / 2, m.y + 22],
      ]
      const boxAt = (s) => [s[0] - 3, s[1] - size / 2 - 3, s[0] + width + 3, s[1] + size / 2 + 3]
      const clear = (b) => boxes.every((o, k) => (k < marks.length && marks[k] === m) || b[2] < o[0] || b[0] > o[2] || b[3] < o[1] || b[1] > o[3])
      let spot = spots.find((s) => inside(boxAt(s)) && clear(boxAt(s)))
      if (!spot && m.here) spot = spots.find((s) => inside(boxAt(s))) ?? spots[0]
      if (!spot) continue
      boxes.push(boxAt(spot))
      labels.push({ name, zh: m.p.zh, x: spot[0], y: spot[1], nw, size, colour: m.here ? colours.ink : colours.inkSoft })
    }
    return { marks, labels, boxes }
  }

  drawReference(scene, toScreen, mpp, boxes) {
    const { ctx, w, h } = this
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    const visited = new Set(scene.places.map((p) => p.name))
    const m = this.margin ?? 0
    const inFrame = (b) => b[0] > m + 4 && b[2] < w - m - 4 && b[1] > m + 4 && b[3] < h - m - 4
    const free = (b) => inFrame(b) && boxes.every((o) => b[2] < o[0] || b[0] > o[2] || b[3] < o[1] || b[1] > o[3])
    const taken = [...boxes]
    const claim = (b) => {
      if (!taken.every((o) => b[2] < o[0] || b[0] > o[2] || b[3] < o[1] || b[1] > o[3])) return false
      taken.push(b)
      return true
    }
    // Cities fade out when the view closes in on one.
    const cityAlpha = smooth(30, 90, mpp)
    if (cityAlpha > 0.02) {
      ctx.globalAlpha = cityAlpha
      for (const c of scene.cities) {
        if (visited.has(c.name)) continue
        const [x, y] = toScreen(...c.at)
        if (x < -50 || y < -20 || x > w + 50 || y > h + 20) continue
        ctx.font = `500 12px ${FONT_LABEL}`
        const text = c.name.toUpperCase()
        const box = [x - 4, y - 9, x + 10 + textWidth(ctx, text, 0.12), y + 9]
        if (!free(box) || !claim(box)) continue
        ctx.fillStyle = colours.ink
        ctx.fillRect(x - 2.5, y - 2.5, 5, 5)
        label(ctx, text, x + 8, y, `500 12px ${FONT_LABEL}`, colours.inkSoft, 0.12)
      }
    }
    const peakAlpha = smooth(20, 60, mpp)
    if (peakAlpha > 0.02) {
      ctx.globalAlpha = peakAlpha
      for (const p of scene.peaks) {
        const [x, y] = toScreen(...p.at)
        if (x < -50 || y < -20 || x > w + 50 || y > h + 20) continue
        const text = `${p.name} ${p.ele}`
        ctx.font = `italic 500 11.5px ${FONT_LABEL}`
        const box = [x - 6, y - 8, x + 10 + textWidth(ctx, text, 0.04), y + 8]
        if (!inFrame(box) || !claim(box)) continue
        ctx.beginPath()
        ctx.moveTo(x, y - 5)
        ctx.lineTo(x + 4.5, y + 3)
        ctx.lineTo(x - 4.5, y + 3)
        ctx.closePath()
        ctx.fillStyle = colours.ink
        ctx.fill()
        label(ctx, text, x + 8, y, `italic 500 11.5px ${FONT_LABEL}`, colours.contourText, 0.04)
      }
    }
    ctx.globalAlpha = 1
  }

  // The trail's own lettering on its close-up: its name beside the line and
  // the halt it leaves from.
  drawTrailLabel(scene, toScreen, mpp) {
    const t = scene.trail
    if (!t || t.f < 0.05) return
    const { ctx, w, h } = this
    const a = smooth(45, 18, mpp)
    if (a < 0.02) return
    ctx.globalAlpha = a
    ctx.setLineDash([])
    for (const m of t.marks) {
      const [x, y] = toScreen(...m.at)
      if (x < 0 || y < 0 || x > w || y > h) continue
      // Bridges are left off: their numbers cluttered the trail.
      if (m.kind === 'bridge') continue
      ctx.fillStyle = colours.ink
      ctx.fillRect(x - 3, y - 3, 6, 6)
      label(ctx, m.name.toUpperCase(), x + 9, y - 1, `600 12px ${FONT_LABEL}`, colours.ink, 0.12)
      if (m.zh) label(ctx, m.zh, x + 9, y + 14, `600 12px ${FONT_ZH}`, colours.inkSoft, 0.06)
    }
    const [x, y] = toScreen(...tip(t.line, 0.38))
    ctx.globalAlpha = a * smooth(0.05, 0.3, t.f)
    // Set to the left of the line where there's room, otherwise to its right.
    ctx.font = `600 17px ${FONT_LABEL}`
    const tw = textWidth(ctx, t.name.toUpperCase(), 0.16)
    const lx = x - tw - 34 > 40 ? x - tw - 34 : x + 30
    label(ctx, t.name.toUpperCase(), lx, y - 10, `600 17px ${FONT_LABEL}`, colours.routeDeep, 0.16)
    if (t.zh) label(ctx, t.zh, lx, y + 12, `600 16px ${FONT_ZH}`, colours.routeDeep, 0.12)
    ctx.globalAlpha = 1
  }

  // A small key map in the sheet margin: the whole island, with the part
  // on screen boxed, whenever the view is zoomed in past the island.
  drawLocator(frame, view) {
    if (!this.island || !frame.island) return
    const { ctx, dpr, w, h } = this
    const { cx, cy, mpp, fx, fy } = view
    const a = smooth(260, 140, mpp)
    if (a < 0.02) return
    const isl = frame.island
    const boxH = frame.wide ? 132 : 92
    const s = boxH / isl.h
    const boxW = isl.w * s
    const [bx, by] = frame.locatorAt(boxW, boxH)
    ctx.globalAlpha = a
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = colours.sea
    ctx.fillRect(bx - 6, by - 6, boxW + 12, boxH + 12)
    ctx.strokeStyle = colours.ink
    ctx.lineWidth = 1
    ctx.strokeRect(bx - 5.5, by - 5.5, boxW + 11, boxH + 11)
    ctx.save()
    ctx.beginPath()
    ctx.rect(bx - 5, by - 5, boxW + 10, boxH + 10)
    ctx.clip()
    const k = s
    ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * (bx - (isl.x - isl.w / 2) * k), dpr * (by - (isl.y - isl.h / 2) * k))
    const coast = this.island.bands[0]
    ctx.fillStyle = colours.land
    ctx.fill(coast.path, 'evenodd')
    ctx.strokeStyle = colours.coast
    ctx.lineWidth = 0.8 / k
    ctx.stroke(coast.path)
    ctx.restore()
    // The screen's extent, in the locator.
    const toLoc = (x, y) => [bx + (x - (isl.x - isl.w / 2)) * k, by + (y - (isl.y - isl.h / 2)) * k]
    const [x0, y0] = toLoc(cx - fx * mpp, cy - fy * mpp)
    const [x1, y1] = toLoc(cx + (w - fx) * mpp, cy + (h - fy) * mpp)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.strokeStyle = colours.route
    ctx.lineWidth = 1.6
    const rw = Math.max(x1 - x0, 4)
    const rh = Math.max(y1 - y0, 4)
    ctx.strokeRect(x0 + (x1 - x0 - rw) / 2, y0 + (y1 - y0 - rh) / 2, rw, rh)
    ctx.globalAlpha = 1
  }

  drawPlaces({ marks, labels }) {
    const { ctx } = this
    for (const m of [...marks].reverse()) {
      ctx.beginPath()
      ctx.arc(m.x, m.y, m.here ? 7 : 4.5, 0, Math.PI * 2)
      ctx.fillStyle = m.here ? colours.route : colours.paper
      ctx.fill()
      ctx.lineWidth = m.here ? 2.5 : 2
      ctx.strokeStyle = m.here ? colours.paper : colours.routeDeep
      ctx.stroke()
      if (m.here) {
        ctx.beginPath()
        ctx.arc(m.x, m.y, 12, 0, Math.PI * 2)
        ctx.lineWidth = 1.2
        ctx.strokeStyle = colours.routeDeep
        ctx.stroke()
      }
    }
    for (const l of labels) {
      // Bridge the word gap so the halo runs under the whole label.
      if (l.zh) {
        ctx.fillStyle = colours.halo
        ctx.fillRect(l.x + l.nw - 3, l.y - l.size * 0.38, 12, l.size * 0.76)
      }
      label(ctx, l.name, l.x, l.y, `600 ${l.size}px ${FONT_LABEL}`, l.colour, 0.1)
      if (l.zh) label(ctx, l.zh, l.x + l.nw + 6, l.y + 1, `600 ${l.size - 2}px ${FONT_ZH}`, l.colour, 0)
    }
  }

  // Neat line, sheet margin and graticule ticks on the frame.
  drawFrame(frame, view) {
    const { ctx, w, h } = this
    const m = frame.margin
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    // Edge to edge (a phone): no sheet margin, just the scale bar.
    if (m > 0) {
      ctx.fillStyle = colours.margin
      ctx.fillRect(0, 0, w, m)
      ctx.fillRect(0, h - m, w, m)
      ctx.fillRect(0, 0, m, h)
      ctx.fillRect(w - m, 0, m, h)
      ctx.strokeStyle = colours.ink
      ctx.lineWidth = 1.25
      ctx.strokeRect(m + 0.5, m + 0.5, w - 2 * m - 1, h - 2 * m - 1)
      ctx.lineWidth = 0.6
      ctx.strokeRect(m - 3.5, m - 3.5, w - 2 * m + 7, h - 2 * m + 7)

      const { cx, cy, mpp, fx, fy } = view
      const toWorld = (x, y) => projection.invert([(x - fx) * mpp + cx, (y - fy) * mpp + cy])
      const toScreen = (lon, lat) => {
        const [x, y] = projection([lon, lat])
        return [(x - cx) / mpp + fx, (y - cy) / mpp + fy]
      }
      const [lonA, latA] = toWorld(m, h - m)
      const [lonB, latB] = toWorld(w - m, m)
      const spanDeg = Math.max(lonB - lonA, 0.0001)
      // A graticule step giving roughly 3–7 ticks across the sheet.
      const steps = [1, 1 / 2, 1 / 4, 1 / 6, 1 / 12, 1 / 30, 1 / 60, 1 / 120]
      const step = steps.find((s) => spanDeg / s >= 3) ?? steps.at(-1)
      const fmt = (v, pos, neg) => {
        const a = Math.abs(v)
        let d = Math.floor(a + 1e-9)
        let mm = Math.round((a - d) * 60)
        if (mm === 60) [d, mm] = [d + 1, 0]
        return `${d}°${mm ? String(mm).padStart(2, '0') + '′' : ''}${v >= 0 ? pos : neg}`
      }
      ctx.font = `500 11px ${FONT_LABEL}`
      ctx.fillStyle = colours.inkSoft
      ctx.strokeStyle = colours.ink
      ctx.textBaseline = 'middle'
      ctx.lineWidth = 1
      const midLat = (latA + latB) / 2
      const midLon = (lonA + lonB) / 2
      const showText = frame.ticks
      for (let lon = Math.ceil(lonA / step) * step; lon <= lonB; lon += step) {
        const [x] = toScreen(lon, midLat)
        if (x < m + 30 || x > w - m - 30) continue
        ctx.beginPath()
        ctx.moveTo(x, m)
        ctx.lineTo(x, m + 7)
        ctx.moveTo(x, h - m)
        ctx.lineTo(x, h - m - 7)
        ctx.stroke()
        if (showText) {
          ctx.textAlign = 'center'
          ctx.fillText(fmt(lon, 'E', 'W'), x, h - m / 2)
        }
      }
      for (let lat = Math.ceil(latA / step) * step; lat <= latB; lat += step) {
        const [, y] = toScreen(midLon, lat)
        if (y < m + 30 || y > h - m - 30) continue
        ctx.beginPath()
        ctx.moveTo(m, y)
        ctx.lineTo(m + 7, y)
        ctx.moveTo(w - m, y)
        ctx.lineTo(w - m - 7, y)
        ctx.stroke()
        if (showText) {
          ctx.save()
          ctx.translate(w - m / 2, y)
          ctx.rotate(Math.PI / 2)
          ctx.textAlign = 'center'
          ctx.fillText(fmt(lat, 'N', 'S'), 0, 0)
          ctx.restore()
        }
      }
    }

    // No scale bar: the user wants no distances on the page.
  }
}

function textWidth(ctx, text, tracking) {
  return ctx.measureText(text).width + text.length * tracking * parseFloat(ctx.font.match(/(\d+(\.\d+)?)px/)[1])
}

// Map lettering on a paper halo, so it reads over contours.
function label(ctx, text, x, y, font, colour, tracking) {
  ctx.font = font
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${tracking}em`
  ctx.lineWidth = 4.5
  ctx.strokeStyle = colours.halo
  ctx.strokeText(text, x, y)
  ctx.fillStyle = colour
  ctx.fillText(text, x, y)
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'
}

// Transport symbols, matching the legend: rail hatching, dashes, solid, dots.
export function routeStroke(ctx, mode, px) {
  ctx.setLineDash([])
  ctx.strokeStyle = colours.route
  if (mode === 'train' || mode === 'metro') {
    ctx.lineWidth = 4.5 * px
    ctx.stroke()
    ctx.strokeStyle = colours.paper
    ctx.lineWidth = 1.8 * px
    ctx.setLineDash([7 * px, 7 * px])
    ctx.lineCap = 'butt'
    ctx.stroke()
    ctx.lineCap = 'round'
  } else if (mode === 'bus') {
    ctx.lineWidth = 3.5 * px
    ctx.setLineDash([9 * px, 6 * px])
    ctx.lineCap = 'butt'
    ctx.stroke()
    ctx.lineCap = 'round'
  } else if (mode === 'walk') {
    ctx.lineWidth = 4.5 * px
    ctx.setLineDash([0.01, 8 * px])
    ctx.stroke()
  } else if (mode === 'flight' || mode === 'ferry') {
    ctx.lineWidth = 2 * px
    ctx.setLineDash([3 * px, 5 * px])
    ctx.stroke()
  } else {
    ctx.lineWidth = 4 * px
    ctx.stroke()
  }
  ctx.setLineDash([])
}
