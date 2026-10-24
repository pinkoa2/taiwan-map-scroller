<script>
  // The survey sheet behind the whole page. It loads the island first, then
  // the close-up sheets, and redraws whenever the story's state changes.
  import { onMount } from 'svelte'
  import { SheetRenderer, buildSheet } from './map/sheet.js'

  let { trip, route, story, focus, layout } = $props()

  let canvas
  let renderer
  let ready = $state(false)
  let frameQueued = false

  const places = trip.legs.map((l) => ({ x: l.at[0], y: l.at[1], name: l.name, zh: l.zh }))
  const walkLeg = trip.legs.find((l) => l.walk)
  const trail = walkLeg ? { name: walkLeg.walk.name, zh: walkLeg.walk.zh, marks: walkLeg.walk.marks ?? [] } : null

  function scene() {
    const { ink, leg } = story
    const segments = route.map((r, k) => ({ line: r.line, mode: r.mode, track: r.track, f: Math.min(Math.max(ink - k, 0), 1) }))
    const walkIndex = route.findIndex((r) => r.walk)
    return {
      segments,
      places: places.map((p, i) => ({ ...p, state: story.end ? 'past' : i === leg ? 'here' : i < leg ? 'past' : 'ahead' })),
      cities: trip.cities,
      peaks: [],
      trail: trail && walkIndex >= 0 ? { ...trail, line: route[walkIndex].line, f: segments[walkIndex].f } : null,
    }
  }

  // Close-up sheets load when the view first comes near them.
  function loadNearby() {
    const { cx, cy, mpp } = story.view
    const r = Math.max(layout.w, layout.h) * mpp
    for (const s of renderer.sheets) {
      if (s.loading || mpp > 400) continue
      if (cx + r < s.box[0] || cx - r > s.box[2] || cy + r < s.box[1] || cy - r > s.box[3]) continue
      s.loading = true
      load(s.id).then((json) => {
        s.data = buildSheet(json)
        renderer.changed()
        queue()
      })
    }
  }

  function draw() {
    frameQueued = false
    if (!renderer) return
    if (ready) loadNearby()
    renderer.draw(story.view, scene(), {
      margin: layout.edge,
      ticks: layout.wide,
      unit: trip.unit,
      wide: layout.wide,
      island: trip.island,
      locatorAt: layout.locatorAt,
    })
    // A scaled-up cache looks soft; repaint it sharp once scrolling pauses.
    clearTimeout(idle)
    if (renderer.stale) idle = setTimeout(() => {
      renderer.cache = null
      queue()
    }, 160)
  }
  let idle

  function queue() {
    if (frameQueued) return
    frameQueued = true
    requestAnimationFrame(draw)
  }

  $effect(() => {
    // Track every input the drawing reads.
    void story.view.cx, story.view.cy, story.view.mpp, story.ink, story.leg, story.end, layout.w, layout.h, focus
    queue()
  })

  $effect(() => {
    if (!renderer) return
    renderer.resize(layout.w, layout.h)
    queue()
  })

  const load = (id) => fetch(`/geo/${id}.json`).then((r) => r.json())

  onMount(() => {
    renderer = new SheetRenderer(canvas)
    renderer.resize(layout.w, layout.h)
    renderer.sheets = trip.geo.sheets.map((s) => ({ ...s, data: null }))
    let alive = true
    ;(async () => {
      const island = await load(trip.geo.island)
      if (!alive) return
      renderer.island = buildSheet(island)
      renderer.changed()
      ready = true
      queue()
      // Map lettering is drawn on canvas, so redraw once the faces arrive.
      document.fonts?.ready.then(() => {
        renderer.changed()
        queue()
      })
    })()
    return () => (alive = false)
  })
</script>

<canvas
  bind:this={canvas}
  class="sheet"
  class:ready
  class:window={!layout.wide}
  aria-hidden="true"
  style:width="{layout.w}px"
  style:height="{layout.h}px"
></canvas>

<style>
  .sheet {
    position: fixed;
    inset: 0;
    display: block;
    background: var(--sea);
    opacity: 0;
    transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .sheet.ready {
    opacity: 1;
  }

  .sheet.window {
    z-index: 0;
  }
</style>
