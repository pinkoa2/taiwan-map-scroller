// OpenStreetMap lookups (Overpass) and routing: road routes from the public
// OSRM server, rail routes and trails by shortest path over OSM ways.
// © OpenStreetMap contributors, ODbL.

const UA = 'taiwan-scroller/1.0 (personal trip site)'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function overpass(query) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
      })
      if (res.ok) return (await res.json()).elements
    } catch {}
    await sleep(10000 * (attempt + 1))
  }
  throw new Error('Overpass did not answer')
}

// Ways (with geometry) → lines of [lon, lat].
export const waysToLines = (elements) =>
  elements.filter((e) => e.type === 'way' && e.geometry).map((e) => e.geometry.map((p) => [p.lon, p.lat]))

export function haversineKm([lon1, lat1], [lon2, lat2]) {
  const R = 6371.0088
  const r = Math.PI / 180
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export const lineKm = (coords) => coords.slice(1).reduce((s, c, i) => s + haversineKm(coords[i], c), 0)

// A graph over lines whose vertices meet at identical coordinates.
export function graph(lines) {
  const key = ([x, y]) => `${x.toFixed(7)},${y.toFixed(7)}`
  const nodes = new Map()
  const node = (c) => {
    const k = key(c)
    if (!nodes.has(k)) nodes.set(k, { c, adj: [] })
    return nodes.get(k)
  }
  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      const a = node(line[i - 1])
      const b = node(line[i])
      const w = haversineKm(a.c, b.c)
      a.adj.push([b, w])
      b.adj.push([a, w])
    }
  }
  return [...nodes.values()]
}

// Labels every node with its connected component; returns component sizes.
export function components(nodes) {
  const sizes = []
  for (const n of nodes) {
    if (n.comp != null) continue
    const id = sizes.length
    let count = 0
    const stack = [n]
    n.comp = id
    while (stack.length) {
      const m = stack.pop()
      count++
      for (const [o] of m.adj) if (o.comp == null) ((o.comp = id), stack.push(o))
    }
    sizes.push(count)
  }
  return sizes
}

// Joins dead ends to the nearest other vertex within `km`: OSM often draws a
// tunnel or bridge as a separate way whose ends don't share a node.
export function bridgeGaps(nodes, km) {
  // Bucket vertices on a grid about `km` wide so each dead end only checks its neighbourhood.
  const cell = km / 111
  const bucket = new Map()
  const at = (c) => `${Math.floor(c[0] / cell)},${Math.floor(c[1] / cell)}`
  for (const n of nodes) {
    const k = at(n.c)
    if (!bucket.has(k)) bucket.set(k, [])
    bucket.get(k).push(n)
  }
  for (const a of nodes) {
    if (a.adj.length !== 1) continue
    let best = null
    let bd = km
    const [cx, cy] = at(a.c).split(',').map(Number)
    const near = []
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) near.push(...(bucket.get(`${cx + dx},${cy + dy}`) ?? []))
    for (const b of near) {
      if (b === a || a.adj.some(([o]) => o === b)) continue
      const d = haversineKm(a.c, b.c)
      if (d < bd) [best, bd] = [b, d]
    }
    if (best) {
      a.adj.push([best, bd])
      best.adj.push([a, bd])
    }
  }
}

export function nearest(nodes, [lon, lat], filter = () => true) {
  let best = null
  let bd = Infinity
  for (const n of nodes) {
    if (!filter(n)) continue
    const d = haversineKm(n.c, [lon, lat])
    if (d < bd) [best, bd] = [n, d]
  }
  return best
}

// Dijkstra with a binary heap; returns the coordinates along the path.
export function shortestPath(from, to) {
  const dist = new Map([[from, 0]])
  const prev = new Map()
  const heap = [[0, from]]
  const push = (item) => {
    heap.push(item)
    let i = heap.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (heap[p][0] <= heap[i][0]) break
      ;[heap[p], heap[i]] = [heap[i], heap[p]]
      i = p
    }
  }
  const pop = () => {
    const top = heap[0]
    const last = heap.pop()
    if (heap.length) {
      heap[0] = last
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        const r = l + 1
        let m = i
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r
        if (m === i) break
        ;[heap[m], heap[i]] = [heap[i], heap[m]]
        i = m
      }
    }
    return top
  }
  while (heap.length) {
    const [d, n] = pop()
    if (n === to) break
    if (d > (dist.get(n) ?? Infinity)) continue
    for (const [m, w] of n.adj) {
      const nd = d + w
      if (nd < (dist.get(m) ?? Infinity)) {
        dist.set(m, nd)
        prev.set(m, n)
        push([nd, m])
      }
    }
  }
  if (!dist.has(to)) return null
  const out = [to.c]
  for (let n = to; prev.has(n); n = prev.get(n)) out.push(prev.get(n).c)
  return out.reverse()
}

export async function osrm(points) {
  const key = points.map(([lon, lat]) => `${lon.toFixed(5)},${lat.toFixed(5)}`).join(';')
  const url = `https://router.project-osrm.org/route/v1/driving/${key}?overview=full&geometries=geojson`
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const json = await (await fetch(url, { headers: { 'User-Agent': UA } })).json()
      if (json.code === 'Ok') return json.routes[0].geometry.coordinates
    } catch {}
    await sleep(3000 * (attempt + 1))
  }
  return null
}
