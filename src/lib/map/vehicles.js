// The vehicle riding the head of the route: little red stamps, solid red
// with the windows cut out in paper, like the footprints (the user picked
// these over the emoji, Oct 30, 2026). Each is drawn once as an SVG image
// and then stamped onto the canvas, facing the way it travels.
//
// Every vehicle faces right on a 64 × 32 grid (wheels near y 24–27): `body`
// is the solid shape, `ink` the bits drawn in line (pantograph, roof unit),
// `holes` the windows, `stripe` a paper line along the side, `wheels`
// circles [x, y, r].

import { colours } from './palette.js'

const SHAPES = {
  train: {
    body: 'M6 8 H49 Q55 8 57.5 13 L60 20 Q60.5 23.5 57 23.5 H6 Q4 23.5 4 21.5 V10 Q4 8 6 8 Z',
    ink: 'M25 8 L28.5 3.5 L32 8 M25.5 3.5 H31.5',
    stripe: 'M4 19.5 H60',
    holes: 'M8.5 11 h5 v5 h-5 Z M16.5 11 h5 v5 h-5 Z M24.5 11 h5 v5 h-5 Z M33 10.5 h4 v11 h-4 Z M40.5 11 h5 v5 h-5 Z M49.5 11 H54 L56.5 16 H49.5 Z',
    wheels: [[12, 25.5, 2.2], [18, 25.5, 2.2], [42, 25.5, 2.2], [48, 25.5, 2.2]],
  },
  metro: {
    body: 'M8 9 Q8 6 12 6 H45 Q56 6 59.5 14.5 L60.5 19.5 Q60.5 23 57 23 H10 Q8 23 8 21 Z',
    ink: 'M22 6 V3.8 H34 V6 M28 3.8 L26 1.5 M28 3.8 L30 1.5',
    stripe: 'M8 19.5 H60.5',
    holes: 'M12 10 h7 v6 h-7 Z M22.5 10 h7 v6 h-7 Z M33 10 h7 v6 h-7 Z M49 9 Q54.5 9 57 15.5 H49 Z',
    wheels: [[16, 25, 2.3], [21.5, 25, 2.3], [45.5, 25, 2.3], [51, 25, 2.3]],
  },
  bus: {
    body: 'M5 9 Q5 6 8.5 6 H53 Q59 6 59 11.5 V21.5 Q59 23.5 57 23.5 H7 Q5 23.5 5 21.5 Z',
    ink: 'M24 6 V4 H38 V6',
    stripe: 'M5 18.5 H59',
    holes: 'M8.5 9.5 h7 v6 h-7 Z M18.5 9.5 h7 v6 h-7 Z M28.5 9.5 h7 v6 h-7 Z M38.5 9.5 h6 v6 h-6 Z M47.5 9.5 h4 v12 h-4 Z M54 9.5 h3 v6.5 h-3 Z',
    wheels: [[15, 24, 3.4], [49, 24, 3.4]],
  },
  car: {
    body: 'M7 22 V17.5 Q7 13.8 11.5 13.2 L20 12.3 Q25 5.5 32.5 5.5 H40 Q46 5.5 50.5 12.3 L55.5 13.2 Q60 14 60 18.5 V22 Z',
    ink: '',
    holes: 'M23.5 12.3 Q27 8.3 32 8.3 V12.3 Z M35.2 8.3 H39.5 Q43.5 8.3 46.5 12.3 H35.2 Z M57 16 h1.6 v1.6 h-1.6 Z',
    wheels: [[17.5, 22.5, 3.8], [49.5, 22.5, 3.8]],
  },
  // Seen from above, so it can turn to fly along any line.
  flight: {
    body: 'M7 16 Q7 13.6 11 13.6 H49 Q57.5 13.8 60.5 16 Q57.5 18.2 49 18.4 H11 Q7 18.4 7 16 Z M29 13.6 L21.5 2.5 H26 L40 13.6 Z M29 18.4 L21.5 29.5 H26 L40 18.4 Z M11.5 13.6 L7.5 7.5 H10.5 L16.5 13.6 Z M11.5 18.4 L7.5 24.5 H10.5 L16.5 18.4 Z',
    ink: '',
    holes: 'M52 14.8 Q55.5 15 57 16 Q55.5 17 52 17.2 Z',
    wheels: [],
  },
}

// The drawing's box in grid units (with room for the paper halo),
// its width on the map in CSS px, and the point that rides the line.
const VIEW = [-8, -6, 76, 38]
export const VEHICLE_W = 62
const ANCHOR = { flight: [32, 16], other: [32, 18] }
// Drawn at 4× so it stays sharp on any screen.
const RES = 4

function svg(v) {
  const r = colours.route
  const paper = colours.paper
  const halo = 5 / (VEHICLE_W / 64)
  const w = VEHICLE_W * RES
  const ring = ([x, y, rad], fill, stroke, width) => `<circle cx="${x}" cy="${y}" r="${rad}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${(w * VIEW[3]) / VIEW[2]}" viewBox="${VIEW.join(' ')}">
    <g stroke-linejoin="round" stroke-linecap="round">
      <path d="${v.body}" fill="${colours.halo}" stroke="${colours.halo}" stroke-width="${halo}"/>
      ${v.ink ? `<path d="${v.ink}" fill="none" stroke="${colours.halo}" stroke-width="${halo}"/>` : ''}
      ${v.wheels.map((c) => ring(c, colours.halo, colours.halo, halo)).join('')}
      <path d="${v.body}" fill="${r}"/>
      <path d="${v.holes}" fill="${paper}"/>
      ${v.ink ? `<path d="${v.ink}" fill="none" stroke="${r}" stroke-width="1.6"/>` : ''}
      ${v.stripe ? `<path d="${v.stripe}" stroke="${paper}" stroke-width="0.9" opacity="0.9"/>` : ''}
      ${v.wheels.map((c) => ring(c, r, paper, 1) + ring([c[0], c[1], c[2] * 0.35], paper, 'none', 0)).join('')}
    </g>
  </svg>`
}

const images = {}
const loaded = []
if (typeof Image !== 'undefined') {
  for (const [mode, shape] of Object.entries(SHAPES)) {
    const img = new Image()
    loaded.push(new Promise((ok) => (img.onload = img.onerror = ok)))
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg(shape))}`
    images[mode] = img
  }
}
// Resolves once every drawing can be stamped (the map redraws then).
export const vehiclesReady = Promise.all(loaded)

// Stamps a vehicle centred on (x, y), facing its direction of travel.
// Returns false for a mode without a drawing.
export function stampVehicle(ctx, mode, x, y, left, angle) {
  const img = images[mode]
  if (!img?.complete || !img.naturalWidth) return false
  const w = VEHICLE_W
  const h = (w * VIEW[3]) / VIEW[2]
  const [ax, ay] = ANCHOR[mode] ?? ANCHOR.other
  ctx.save()
  ctx.translate(x, y)
  // The plane turns to fly along the line; the rest face left or right.
  if (mode === 'flight') ctx.rotate(angle)
  else if (left) ctx.scale(-1, 1)
  ctx.shadowColor = 'rgb(40 36 20 / 0.28)'
  ctx.shadowBlur = 5
  ctx.shadowOffsetY = 2
  ctx.drawImage(img, (-(ax - VIEW[0]) / VIEW[2]) * w, (-(ay - VIEW[1]) / VIEW[3]) * h, w, h)
  ctx.restore()
  return true
}
