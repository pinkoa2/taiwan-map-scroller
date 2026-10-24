// The scroll story: an ordered list of stops ("steps") the map moves through.
// Between two steps only one thing changes, the camera or the ink, so the
// reader sees a route draw, then the sheet move to where it arrived.

import { interpolateZoom } from 'd3-interpolate'
import { buildLine } from './map/sheet.js'

const ROUTE_Q = 5

// Every route segment and trail on the trip, in the order they were travelled.
export function buildRoute(trip) {
  const lines = []
  trip.legs.forEach((leg, i) => {
    leg.segments.forEach((s) => lines.push({ leg: i, mode: s.mode, line: buildLine(s.line, ROUTE_Q) }))
    if (leg.walk) lines.push({ leg: i, mode: 'walk', walk: true, track: leg.walk.track, line: buildLine(leg.walk.line, ROUTE_Q) })
  })
  return lines
}

// Steps carry: key (DOM marker), camera box, ink (number of route lines fully
// drawn), leg (index of the place we're at, -1 before Taipei).
export function buildSteps(trip) {
  const steps = []
  let ink = 0
  // The sheet opens empty: Taipei appears once the plane lands.
  steps.push({ key: 'intro', camera: trip.island, ink, leg: -1, card: { type: 'intro' } })
  trip.legs.forEach((leg, i) => {
    if (leg.segments.length) {
      // Arriving from off the map, the whole island stays in view as the plane comes in.
      const camera = i === 0 ? trip.island : leg.travelCamera
      steps.push({ key: `${leg.id}-travel`, camera, ink, leg: i - 1, card: { type: 'leg', leg: i } })
      ink += leg.segments.length
      steps.push({ key: `${leg.id}-travelled`, camera, ink, leg: i, card: { type: 'leg', leg: i } })
    }
    // While a place's photos are up, the camera centres between them.
    steps.push({ key: `${leg.id}-here`, camera: leg.camera, ink, leg: i, centre: true, card: { type: 'leg', leg: i } })
    if (leg.walk) {
      steps.push({ key: `${leg.id}-walk`, camera: leg.walk.camera, ink, leg: i, card: { type: 'walk', leg: i } })
      ink += 1
      steps.push({ key: `${leg.id}-walked`, camera: leg.walk.camera, ink, leg: i, centre: true, card: { type: 'walk', leg: i } })
    }
  })
  steps.push({ key: 'end', camera: trip.island, ink, leg: trip.legs.length - 1, end: true, card: { type: 'end' } })
  return steps
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const clamp01 = (t) => Math.min(Math.max(t, 0), 1)

// Metres per pixel a camera box needs to fit the focus rectangle.
function mppFor(box, focus) {
  return Math.max(box.w / focus.w, box.h / focus.h)
}

// p is a continuous step position (2.4 = 40% of the way from step 2 to 3).
// focusFor(step) gives the screen rectangle that step's camera frames.
// hold: on a place's photo step, the camera stays put until this far through
// (the deck of prints is up until then), and only then moves on. A number, or
// a function of the step's index.
export function viewAt(steps, p, focusFor, hold = 0) {
  const i = Math.min(Math.max(Math.floor(p), 0), steps.length - 1)
  const j = Math.min(i + 1, steps.length - 1)
  const t = clamp01(p - i)
  const a = steps[i]
  const b = steps[j]
  const fa = focusFor(a)
  const fb = focusFor(b)
  const held = typeof hold === 'function' ? hold(i) : hold
  const camT = a.centre && held ? ease(clamp01((t - held) / (1 - held))) : ease(clamp01((t - 0.12) / 0.76))
  const focus = {
    x: fa.x + (fb.x - fa.x) * camT,
    y: fa.y + (fb.y - fa.y) * camT,
    w: fa.w + (fb.w - fa.w) * camT,
    h: fa.h + (fb.h - fa.h) * camT,
  }
  const fx = focus.x + focus.w / 2
  const fy = focus.y + focus.h / 2
  let cam
  if (a.camera === b.camera) {
    cam = [a.camera.x, a.camera.y, mppFor(a.camera, focus)]
  } else {
    // Flying between boxes: zoom out, pan, zoom in, as one smooth move.
    const za = [a.camera.x, a.camera.y, mppFor(a.camera, fa) * fa.w]
    const zb = [b.camera.x, b.camera.y, mppFor(b.camera, fb) * fa.w]
    const z = interpolateZoom(za, zb)(camT)
    cam = [z[0], z[1], z[2] / fa.w]
  }
  const inkT = a.ink === b.ink ? 0 : ease(clamp01((t - 0.08) / 0.84))
  return {
    view: { cx: cam[0], cy: cam[1], mpp: cam[2], fx, fy },
    ink: a.ink + (b.ink - a.ink) * inkT,
    // The place we're at flips to the next one once its route lands.
    leg: t > 0.92 ? b.leg : a.leg,
    // The closing map: every stop drawn alike, none singled out.
    end: !!(t > 0.5 ? b.end : a.end),
    // Between leaving one place and reaching the next.
    travel: a.key.endsWith('-travel') && t <= 0.92 ? b.leg : null,
    step: t > 0.5 ? j : i,
  }
}
