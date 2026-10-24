// Elevation → survey-sheet contours.
// Terrain comes from the public AWS Terrain Tiles (Terrarium PNG encoding),
// downloaded once into .cache/dem/ and turned into banded contour polygons.

import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { contours } from 'd3-contour'

const TILE = 256
const UA = 'taiwan-scroller/1.0 (personal trip site)'

const lon2x = (lon, z) => ((lon + 180) / 360) * 2 ** z
const lat2y = (lat, z) => {
  const r = (lat * Math.PI) / 180
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z
}
const x2lon = (x, z) => (x / 2 ** z) * 360 - 180
const y2lat = (y, z) => {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
}

export function tileRange([w, s, e, n], z) {
  return {
    x0: Math.floor(lon2x(w, z)),
    x1: Math.floor(lon2x(e, z)),
    y0: Math.floor(lat2y(n, z)),
    y1: Math.floor(lat2y(s, z)),
  }
}

export function tileCount(bbox, z) {
  const r = tileRange(bbox, z)
  return (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1)
}

async function tile(cacheDir, z, x, y) {
  const file = path.join(cacheDir, `${z}-${x}-${y}.png`)
  if (!existsSync(file)) {
    const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(url, { headers: { 'User-Agent': UA } })
      if (res.ok) {
        await fs.mkdir(cacheDir, { recursive: true })
        await fs.writeFile(file, Buffer.from(await res.arrayBuffer()))
        break
      }
      if (attempt > 3) throw new Error(`terrain tile ${z}/${x}/${y}: HTTP ${res.status}`)
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
    }
  }
  const { data } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  return data
}

// Box blur, a few passes: smooths 1-pixel stair-steps out of the contours
// without moving the coast or the ridges.
function blur(grid, W, H, passes) {
  let a = grid
  let b = new Float32Array(a.length)
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let sum = 0
        let n = 0
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy
          if (yy < 0 || yy >= H) continue
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx
            if (xx < 0 || xx >= W) continue
            sum += a[yy * W + xx]
            n++
          }
        }
        b[y * W + x] = sum / n
      }
    }
    ;[a, b] = [b, a]
  }
  return a
}

// Douglas–Peucker on projected points.
export function simplify(pts, tol) {
  if (pts.length < 3) return pts
  const keep = new Uint8Array(pts.length)
  keep[0] = keep[pts.length - 1] = 1
  const stack = [[0, pts.length - 1]]
  while (stack.length) {
    const [i, j] = stack.pop()
    const [ax, ay] = pts[i]
    const [bx, by] = pts[j]
    const dx = bx - ax
    const dy = by - ay
    const len = Math.hypot(dx, dy) || 1
    let max = 0
    let at = -1
    for (let k = i + 1; k < j; k++) {
      const d = Math.abs(dy * pts[k][0] - dx * pts[k][1] + bx * ay - by * ax) / len
      if (d > max) [max, at] = [d, k]
    }
    if (max > tol && at > 0) {
      keep[at] = 1
      stack.push([i, at], [at, j])
    }
  }
  return pts.filter((_, k) => keep[k])
}

// A closed ring starts and ends on the same point, which Douglas–Peucker
// can't measure against; split it at the vertex farthest from the start.
export function simplifyRing(pts, tol) {
  if (pts.length < 4) return pts
  const [x0, y0] = pts[0]
  let far = 0
  let k = 1
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.hypot(pts[i][0] - x0, pts[i][1] - y0)
    if (d > far) [far, k] = [d, i]
  }
  return simplify(pts.slice(0, k + 1), tol).slice(0, -1).concat(simplify(pts.slice(k), tol))
}

const ringArea = (pts) => {
  let a = 0
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1])
  return Math.abs(a / 2)
}

// Integer coordinates in units of `q` metres, delta-encoded: [x0, y0, dx, dy, …].
export function encode(pts, q) {
  const out = []
  let px = 0
  let py = 0
  for (const [x, y] of pts) {
    const qx = Math.round(x / q)
    const qy = Math.round(y / q)
    if (out.length && qx === px && qy === py) continue
    out.push(qx - px, qy - py)
    px = qx
    py = qy
  }
  return out
}

// One sheet: a lon/lat box at a tile zoom, contoured at `levels` (metres),
// projected with `project([lon, lat]) → [x, y]` in metres.
// The elevation grid for a lon/lat box at a tile zoom, with `sample(lon, lat)`.
export async function loadGrid({ bbox, z, cacheDir, mask = null, blurPasses = 2 }) {
  const r = tileRange(bbox, z)
  const nx = r.x1 - r.x0 + 1
  const ny = r.y1 - r.y0 + 1
  const W = nx * TILE
  const H = ny * TILE
  let grid = new Float32Array(W * H)
  for (let ty = 0; ty < ny; ty++) {
    for (let tx = 0; tx < nx; tx++) {
      const px = await tile(cacheDir, z, r.x0 + tx, r.y0 + ty)
      for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) {
          const i = (y * TILE + x) * 3
          const h = px[i] * 256 + px[i + 1] + px[i + 2] / 256 - 32768
          grid[(ty * TILE + y) * W + tx * TILE + x] = h
        }
      }
    }
  }
  // Sink whatever the mask rules out (land that isn't part of this map) below sea level.
  if (mask) {
    for (let y = 0; y < H; y++) {
      const lat = y2lat(r.y0 + (y + 0.5) / TILE, z)
      for (let x = 0; x < W; x++) if (mask(x2lon(r.x0 + (x + 0.5) / TILE, z), lat)) grid[y * W + x] = -50
    }
  }
  grid = blur(grid, W, H, blurPasses)
  // Bilinear, so a coarse grid still gives a smooth coastline at finer zooms.
  const sample = (lon, lat) => {
    const fx = (lon2x(lon, z) - r.x0) * TILE - 0.5
    const fy = (lat2y(lat, z) - r.y0) * TILE - 0.5
    const x0 = Math.floor(fx)
    const y0 = Math.floor(fy)
    if (x0 < 0 || y0 < 0 || x0 + 1 >= W || y0 + 1 >= H) return -1
    const tx = fx - x0
    const ty = fy - y0
    const at = (x, y) => grid[y * W + x]
    const top = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx
    const bottom = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx
    return top * (1 - ty) + bottom * ty
  }
  return { grid, W, H, r, sample }
}

// One sheet: a lon/lat box at a tile zoom, contoured at `levels` (metres),
// projected with `project([lon, lat]) → [x, y]` in metres. `coast` (another
// grid's sampler) decides land and sea near sea level, where the fine data's
// coarse sea floor would otherwise draw blocky islands or flood low basins.
export async function contourSheet({ bbox, z, levels, project, cacheDir, q, blurPasses = 2, mask = null, coast = null }) {
  const { grid, W, H, r } = await loadGrid({ bbox, z, cacheDir, mask, blurPasses })
  if (coast) {
    for (let y = 0; y < H; y++) {
      const lat = y2lat(r.y0 + (y + 0.5) / TILE, z)
      for (let x = 0; x < W; x++) {
        const i = y * W + x
        if (grid[i] > 20) continue
        const land = coast(x2lon(r.x0 + (x + 0.5) / TILE, z), lat) > 0
        grid[i] = land ? Math.max(grid[i], 1) : Math.min(grid[i], -1)
      }
    }
  }

  // Grid pixel → projected metres. Pixel centres sit at +0.5.
  const toXY = ([gx, gy]) => project([x2lon(r.x0 + gx / TILE, z), y2lat(r.y0 + gy / TILE, z)])
  const [ax, ay] = toXY([0, 0])
  const [bx, by] = toXY([1, 0])
  const pixel = Math.hypot(bx - ax, by - ay)
  const tol = pixel * 0.55
  const minArea = (pixel * 3) ** 2

  const bands = []
  for (const g of contours().size([W, H]).thresholds(levels)(grid)) {
    const polys = []
    for (const poly of g.coordinates) {
      const rings = []
      for (const ring of poly) {
        const pts = simplifyRing(ring.map(toXY), tol)
        if (pts.length < 4 || ringArea(pts) < minArea) continue
        rings.push(encode(pts, q))
      }
      if (rings.length) polys.push(rings)
    }
    bands.push({ level: g.value, polys })
  }

  // Sheet edge, inset by two grid pixels: contour rings are closed along the
  // grid border, so the page clips to this to hide those artificial edges.
  const inset = 2
  const edge = []
  const N = 24
  for (let i = 0; i <= N; i++) edge.push([inset + ((W - 2 * inset) * i) / N, inset])
  for (let i = 0; i <= N; i++) edge.push([W - inset, inset + ((H - 2 * inset) * i) / N])
  for (let i = N; i >= 0; i--) edge.push([inset + ((W - 2 * inset) * i) / N, H - inset])
  for (let i = N; i >= 0; i--) edge.push([inset, inset + ((H - 2 * inset) * i) / N])

  return { z, q, pixel: +pixel.toFixed(1), bands, clip: encode(edge.map(toXY), q) }
}
