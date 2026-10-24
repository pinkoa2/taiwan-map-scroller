// The survey sheet's printing inks. The CSS tokens in app.css mirror these.

export const colours = {
  margin: '#f2f3ec',
  paper: '#fbfbf7',
  halo: '#f7f8f1',
  ink: '#1d1f1a',
  inkSoft: '#474b40',
  sea: '#d3e5ec',
  land: '#e3eacf',
  seaLine: '#5c97b8',
  coast: '#2f6e9a',
  river: '#3f84b8',
  rail: '#22231f',
  contour: '#93602f',
  contourText: '#6e4520',
  route: '#e2401c',
  routeDeep: '#a92c0e',
}

// Hypsometric tints by elevation (metres): lowland green to high buff.
const stops = [
  [0, [221, 231, 204]],
  [200, [211, 224, 189]],
  [500, [224, 224, 181]],
  [1000, [229, 211, 163]],
  [1500, [218, 190, 145]],
  [2000, [205, 168, 128]],
  [2500, [190, 149, 117]],
  [3000, [172, 131, 106]],
  [3500, [156, 118, 100]],
]

const cache = new Map()
export function tint(level) {
  if (cache.has(level)) return cache.get(level)
  let rgb = stops.at(-1)[1]
  for (let i = 1; i < stops.length; i++) {
    if (level < stops[i][0]) {
      const [a, ca] = stops[i - 1]
      const [b, cb] = stops[i]
      const t = (level - a) / (b - a)
      rgb = ca.map((c, k) => Math.round(c + (cb[k] - c) * t))
      break
    }
  }
  const out = `rgb(${rgb.join(',')})`
  cache.set(level, out)
  return out
}
