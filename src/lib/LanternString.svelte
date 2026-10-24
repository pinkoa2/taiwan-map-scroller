<script>
  // Strings of red lanterns hung between a place's photos (Jiufen's old
  // street), drawn over the photo column. Each string sags from the top of
  // one plate to the top of the next.
  import { onMount } from 'svelte'

  // mode 'between': a string from each photo to the next.
  // mode 'backdrop': strings strung across the whole container, behind it.
  let { container, mode = 'between' } = $props()

  let strings = $state([])
  // Lucky characters for the lanterns, in turn.
  const CHARS = ['福', '喜', '樂', '春', '安', '吉', '壽', '和']
  // Some lanterns are lit; which ones is fixed, so it doesn't change on resize.
  const lit = (i, k) => (i * 7 + k * 13 + 3) % 5 < 2
  const uid = Math.random().toString(36).slice(2, 8)
  let size = $state({ w: 0, h: 0 })

  // A sagging string from a to b, and points along it for the lanterns.
  function string(a, b, count, sagOverride) {
    // It drapes below the straight line between its ends.
    const dx = Math.abs(b.x - a.x)
    const dy = Math.abs(b.y - a.y)
    const steep = dy > dx * 0.5
    const sag = sagOverride ?? Math.min(80, 24 + dx * 0.22)
    // A steep cord (one plate under the next, on a phone) must not dip
    // below its lower end, or it would hang across the next photo.
    const c = { x: (a.x + b.x) / 2, y: steep ? Math.min((a.y + b.y) / 2 + sag, Math.max(a.y, b.y) - 30) : (a.y + b.y) / 2 + sag }
    const at = (t) => ({
      x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t ** 2 * b.x,
      y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t ** 2 * b.y,
    })
    const n = count ?? Math.max(2, Math.min(5, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 110)))
    return {
      d: `M${a.x},${a.y} Q${c.x},${c.y} ${b.x},${b.y}`,
      // On a steep cord the lanterns keep to its upper part, clear of the next photo.
      lanterns: Array.from({ length: n }, (_, k) => at(steep ? 0.12 + (0.45 * (k + 1)) / (n + 1) : (k + 1) / (n + 1))),
      ends: [a, b],
    }
  }

  // Strings across the container every so often, each slanting a little.
  function backdrop(w, h) {
    const out = []
    const narrow = w < 600
    // The first string runs along the very top of the page, above the heading.
    // On a phone that's the only one: further down the photos fill the width,
    // so strings would only show as stray bits of cord between them.
    const gap = 340
    for (let y = 6, k = 0; y < h - 60 && (!narrow || k < 1); y += gap, k++) {
      const tilt = (k % 2 ? 1 : -1) * 18
      const s = string({ x: -20, y }, { x: w + 20, y: y + tilt }, Math.round(w / (narrow ? 62 : 95)), k === 0 ? 16 : 46)
      s.ends = []
      out.push(s)
    }
    return out
  }

  function measure() {
    if (!container) return
    const box = container.getBoundingClientRect()
    size = { w: box.width, h: box.height }
    if (mode === 'backdrop') {
      strings = backdrop(box.width, box.height)
      return
    }
    const plates = [...container.querySelectorAll('figure')].map((el) => {
      const r = el.getBoundingClientRect()
      return { x0: r.left - box.left, x1: r.right - box.left, top: r.top - box.top + 6, bottom: r.bottom - box.top - 2 }
    })
    const out = []
    for (let i = 0; i + 1 < plates.length; i++) {
      const p = plates[i]
      const q = plates[i + 1]
      // Tie on at the corners that face each other: from under one plate
      // (below its caption) to the top of the next, so no cord crosses a photo.
      const leftToRight = (q.x0 + q.x1) / 2 >= (p.x0 + p.x1) / 2
      const a = { x: leftToRight ? p.x1 - 18 : p.x0 + 18, y: p.bottom }
      const b = { x: leftToRight ? q.x0 + 18 : q.x1 - 18, y: q.top }
      out.push(string(a, b))
    }
    strings = out
  }

  onMount(() => {
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(container)
    for (const img of container.querySelectorAll('img')) img.addEventListener('load', measure)
    return () => ro.disconnect()
  })
</script>

<svg class="lanterns" class:backdrop={mode === 'backdrop'} width={size.w} height={size.h} viewBox="0 0 {size.w} {size.h}" aria-hidden="true">
  <defs>
    <radialGradient id="red-{uid}" cx="40%" cy="35%" r="70%">
      <stop offset="0" stop-color="#ee4a35" />
      <stop offset="1" stop-color="#c41f14" />
    </radialGradient>
    <radialGradient id="lit-{uid}" cx="45%" cy="40%" r="65%">
      <stop offset="0" stop-color="#fff2b8" />
      <stop offset="0.55" stop-color="#ffc552" />
      <stop offset="1" stop-color="#ef7d24" />
    </radialGradient>
    <radialGradient id="glow-{uid}">
      <stop offset="0" stop-color="#ffd76a" stop-opacity="0.75" />
      <stop offset="1" stop-color="#ffd76a" stop-opacity="0" />
    </radialGradient>
  </defs>
  {#each strings as s, i}
    <path d={s.d} class="cord" />
    {#each s.ends as e}<circle cx={e.x} cy={e.y} r="3" class="knot" />{/each}
    {#each s.lanterns as l, k}
      {@const on = lit(i, k)}
      <g transform="translate({l.x} {l.y})">
        <g class="sway" style:animation-delay="{-(i * 0.7 + k * 0.45)}s">
          <line x1="0" y1="0" x2="0" y2="6" class="cord" />
          {#if on}<circle cx="0" cy="19" r="24" fill="url(#glow-{uid})" class="halo" style:animation-delay="{-(k * 0.9 + i)}s" />{/if}
          <rect x="-5" y="5" width="10" height="3.6" rx="1.8" class="cap" />
          <ellipse cx="0" cy="19" rx="11" ry="11.5" class="body" class:on fill={on ? `url(#lit-${uid})` : `url(#red-${uid})`} />
          <path d="M-5.5 9.2Q-9 19-5.5 28.8M5.5 9.2Q9 19 5.5 28.8" class="rib" class:on />
          <ellipse cx="-5" cy="14" rx="2.2" ry="3.4" class="shine" />
          <text x="0" y="19" class="char" class:on>{CHARS[(i * 3 + k) % CHARS.length]}</text>
          <rect x="-5" y="29.6" width="10" height="3.6" rx="1.8" class="cap" />
          <circle cx="0" cy="35.4" r="1.6" class="knot-gold" />
          <path d="M-1.2 36.5L-1.8 44M0 36.8V44.6M1.2 36.5L1.8 44" class="tassel" />
        </g>
      </g>
    {/each}
  {/each}
</svg>

<style>
  .lanterns {
    position: absolute;
    inset: 0;
    z-index: 2;
    overflow: visible;
    pointer-events: none;
  }

  .backdrop {
    z-index: 0;
  }

  .cord {
    fill: none;
    stroke: var(--ink);
    stroke-width: 1.2;
  }

  .knot {
    fill: var(--ink);
  }

  .body {
    stroke: #8f1a10;
    stroke-width: 0.8;
  }

  .body.on {
    stroke: #c8601a;
  }

  .rib {
    fill: none;
    stroke: #9e1d12;
    stroke-width: 0.7;
    opacity: 0.55;
  }

  .rib.on {
    stroke: #d7782a;
  }

  .shine {
    fill: #fff;
    opacity: 0.28;
  }

  .char {
    font-family: var(--font-zh);
    font-weight: 600;
    font-size: 11px;
    text-anchor: middle;
    dominant-baseline: central;
    fill: #f6d27a;
  }

  .char.on {
    fill: #b3261b;
  }

  .cap {
    fill: #d9a636;
  }

  .knot-gold {
    fill: #d9a636;
  }

  .tassel {
    fill: none;
    stroke: #d9a636;
    stroke-width: 1.1;
    stroke-linecap: round;
  }

  /* Lit lanterns glow, breathing softly like a flame. */
  .halo {
    animation: flicker 3.2s ease-in-out infinite alternate;
  }

  @keyframes flicker {
    from {
      opacity: 0.65;
    }
    to {
      opacity: 1;
    }
  }

  /* A slow sway from the cord, each lantern a little out of step. */
  .sway {
    transform-origin: 0 0;
    animation: sway 4.2s ease-in-out infinite alternate;
  }

  @keyframes sway {
    from {
      transform: rotate(-5deg);
    }
    to {
      transform: rotate(5deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sway,
    .halo {
      animation: none;
    }
  }
</style>
