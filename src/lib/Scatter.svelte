<script>
  // A place's photos as prints dropped onto the map around it (wide screens,
  // photoLayout.wide 'scatter'). They land together and leave together.
  //
  // Placement is best-candidate sampling: each print tries ~40 random spots
  // inside the safe area and keeps the one that overlaps the prints already
  // down the least, and sits furthest from them. That gives an even but
  // natural-looking spread. Spots under the place's dot and label, the badge,
  // the key map and the scale bar count as overlap too, so prints keep clear
  // of them. Every landing gets a fresh random seed, so the prints fall
  // differently each visit (the user's choice) but hold still within one.
  import Squiggle from './Squiggle.svelte'

  // hint: show the squiggly "click a photo" note beside one of the prints.
  let { prints, shown, w, h, edge, seed, open, hint = false } = $props()

  // A new toss each time this layer appears (it's rebuilt per place visit).
  const toss = Math.random().toString(36).slice(2)

  const still = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

  // A small seeded random generator (mulberry32).
  function random(text) {
    let a = 2166136261
    for (const c of text) a = Math.imul(a ^ c.charCodeAt(0), 16777619)
    return () => {
      a = (a + 0x6d2b79f5) | 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  const overlap = (a, b) =>
    Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]))

  // One attempt at a layout at a given size: best-candidate placement, where
  // overlap always loses to no overlap, and among clear spots the one with
  // the most room around it wins. Biggest prints are placed first (they're
  // hardest to fit), but the result keeps the photos' own order.
  function attempt(rand, scale, avoid) {
    const margin = 36
    const placed = []
    const out = new Array(prints.length)
    const sized = prints.map((print, i) => {
      const aspect = print.photo.w / print.photo.h
      const width = Math.min(380, w * 0.25, h * 0.4 * aspect) * scale
      return { i, width, pw: width + 14, ph: width / aspect + 7 + 34 }
    })
    let total = 0
    for (const { i, width, pw, ph } of [...sized].sort((a, b) => b.pw * b.ph - a.pw * a.ph)) {
      const x0 = edge + margin + pw / 2
      const x1 = w - edge - margin - pw / 2
      const y0 = edge + margin + ph / 2
      const y1 = h - edge - margin - ph / 2
      let best = null
      for (let k = 0; k < 120; k++) {
        const cx = x0 + rand() * Math.max(x1 - x0, 0)
        const cy = y0 + rand() * Math.max(y1 - y0, 0)
        // A little breathing room counts as overlap too, so prints don't kiss.
        const box = [cx - pw / 2, cy - ph / 2, cx + pw / 2, cy + ph / 2]
        const pad = [box[0] - 10, box[1] - 10, box[2] + 10, box[3] + 10]
        let covered = 0
        let near = Infinity
        for (const p of placed) {
          covered += overlap(pad, p.box)
          near = Math.min(near, Math.hypot(cx - p.x, cy - p.y))
        }
        for (const z of avoid) covered += overlap(box, z) * 12
        if (!best || covered < best.covered - 1 || (Math.abs(covered - best.covered) <= 1 && near > best.near)) best = { covered, near, x: cx, y: cy, box }
      }
      total += best.covered
      const at = { x: best.x, y: best.y, box: best.box, width, turn: (rand() - 0.5) * 8 }
      placed.push(at)
      out[i] = at
    }
    return { total, out }
  }

  // Try a few tosses at full size; if the prints can't all be kept apart,
  // shrink them a step at a time until they can (no smaller than 80%: past
  // that, a little overlap beats prints too small to enjoy).
  // If nothing gets them fully clear, the toss with the least overlap wins.
  const layout = $derived.by(() => {
    const rand = random(seed + toss)
    const n = prints.length
    const start = Math.min(1, Math.max(0.55, Math.sqrt(8 / n)))
    // Keep-clear zones: the place's dot and label, the badge and the key map.
    const avoid = [
      [w / 2 - 80, h / 2 - 50, w / 2 + 210, h / 2 + 50],
      [w - edge - 340, 0, w, edge + 70],
      [w / 2 - 150, h - edge - 160, w / 2 + 230, h],
    ]
    let best = null
    for (let scale = start; scale >= start * 0.8 - 1e-9; scale *= 0.94) {
      for (let tries = 0; tries < 6; tries++) {
        const r = attempt(rand, scale, avoid)
        if (!best || r.total < best.total) best = r
        if (r.total < 1) return r.out
      }
    }
    return best.out
  })

  // Where the hint goes: by the first print with room above its top corner,
  // on the side facing the middle of the screen, its arrow tip just inside
  // that corner. (The note and arrow make a box about 220 × 112 px with the
  // tip ~105 px in from its inner side and ~108 px down.)
  const hintAt = $derived.by(() => {
    if (!hint) return null
    const W = 220
    const H = 112
    let best = null
    layout.forEach((at, i) => {
      for (const toward of ['left', 'right']) {
        const cornerX = toward === 'left' ? at.box[2] - 18 : at.box[0] + 18
        const cornerY = at.box[1] + 14
        const left = toward === 'left' ? cornerX - 115 : cornerX - 105
        const top = cornerY - 110
        if (top < edge + 70 || left < edge + 10 || left + W > w - edge - 10) continue
        // The note must sit clear of every other print; only its tip may touch its own.
        const box = [left, top, left + W, top + H - 18]
        const hit = layout.reduce((sum, o, k) => sum + (k === i ? overlap(box, [o.box[0], o.box[1] + 20, o.box[2], o.box[3]]) : overlap(box, o.box)), 0)
        if (!best || hit < best.hit) best = { hit, left, top, toward }
      }
    })
    // Also try the clear ground just under the place's name, which the prints
    // keep away from, with the arrow swooping toward the nearest print.
    {
      const below = layout
        .map((o) => ({ o, d: Math.hypot((o.box[0] + o.box[2]) / 2 - w / 2, o.box[1] - (h / 2 + 140)) }))
        .sort((a, b) => a.d - b.d)[0]?.o
      const toward = below && (below.box[0] + below.box[2]) / 2 > w / 2 ? 'right' : 'left'
      const left = toward === 'left' ? w / 2 - 20 : w / 2 - 200
      const top = h / 2 + 34
      const box = [left, top, left + W, top + H - 18]
      const hit = layout.reduce((sum, o) => sum + overlap(box, o.box), 0)
      if (!best || hit < best.hit - 200) best = { hit, left, top, toward }
    }
    // Still nowhere readable: it waits for the next place.
    return best && best.hit < 2500 ? best : null
  })

  // Drop: settles from just above, turning a touch into place.
  function drop(node, { turn, i }) {
    return {
      delay: still ? 0 : Math.min(i, 10) * 26,
      duration: still ? 0 : 560,
      easing: (t) => 1 - Math.pow(1 - t, 3),
      css: (t, u) =>
        `opacity: ${Math.min(1, t * 1.8)}; transform: translate(-50%, calc(-50% - ${u * 26}px)) rotate(${turn + u * 4}deg) scale(${1 + u * 0.05})`,
    }
  }

  // Lift-off: rises a little and fades, as if picked up.
  function lift(node, { turn, i }) {
    return {
      delay: still ? 0 : Math.min(i, 10) * 14,
      duration: still ? 0 : 360,
      easing: (t) => t * t,
      css: (t, u) =>
        `opacity: ${t}; transform: translate(-50%, calc(-50% - ${u * 18}px)) rotate(${turn - u * 2.5}deg) scale(${1 + u * 0.04})`,
    }
  }
</script>

<div class="scatter" aria-label="Photos">
  {#if hintAt}
    <div class="hint" style:left="{hintAt.left}px" style:top="{hintAt.top}px">
      <Squiggle text="Click a photo to open it" toward={hintAt.toward} />
    </div>
  {/if}
  {#each prints.slice(0, shown) as print, i (print.number)}
    {@const at = layout[i]}
    <button
      class="print"
      style:left="{at.x}px"
      style:top="{at.y}px"
      style:width="{at.width}px"
      style:--turn="{at.turn}deg"
      style:z-index={i + 1}
      in:drop|global={{ turn: at.turn, i }}
      out:lift|global={{ turn: at.turn, i }}
      onclick={() => open(print.number)}
      aria-label={print.photo.video ? `Play video` : `Open photo full screen`}
    >
      <img
        src={print.photo.src}
        srcset={print.photo.srcset}
        sizes="{Math.round(at.width)}px"
        width={print.photo.w}
        height={print.photo.h}
        alt={print.photo.alt}
        style:background-image="url({print.photo.placeholder})"
      />
      {#if print.photo.video}
        <span class="play" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20"><path d="M8 5.5v13l11-6.5z" /></svg></span>
      {/if}
      <span class="label lettering">
        {#if print.photo.caption}<span class="caption">{print.photo.caption}</span>{:else}{print.place}{/if}
      </span>
    </button>
  {/each}
</div>

<style>
  /* Above the prints, after they've landed. */
  .hint {
    position: absolute;
    z-index: 200;
    width: 220px;
    animation: appear 0.3s ease-out 0.55s both;
  }

  @keyframes appear {
    from {
      opacity: 0;
    }
  }

  .scatter {
    position: fixed;
    inset: 0;
    z-index: 2;
    pointer-events: none;
  }

  /* A print: the photo on a paper mount with a wider foot for its label. */
  .print {
    position: absolute;
    display: block;
    padding: 7px 7px 0;
    border: 0;
    background: var(--paper);
    transform: translate(-50%, -50%) rotate(var(--turn));
    box-shadow:
      0 1px 2px rgb(40 36 20 / 0.25),
      0 18px 34px -14px rgb(40 36 20 / 0.55);
    cursor: pointer;
    pointer-events: auto;
    transition:
      transform 0.35s cubic-bezier(0.16, 1, 0.3, 1),
      box-shadow 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  }

  /* Picked up: straightened, lifted, on top of the pile. */
  .print:hover,
  .print:focus-visible {
    z-index: 99 !important;
    transform: translate(-50%, -50%) rotate(0deg) scale(1.04);
    box-shadow:
      0 2px 4px rgb(40 36 20 / 0.2),
      0 30px 50px -18px rgb(40 36 20 / 0.6);
  }

  img {
    display: block;
    width: 100%;
    height: auto;
    background-size: cover;
    background-position: center;
  }

  .label {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.8rem;
    padding: 0.5rem 0.15rem 0.55rem;
    font-size: 0.72rem;
    color: var(--ink-soft);
    text-align: left;
  }

  .caption {
    font-family: var(--font-text);
    font-style: italic;
    text-transform: none;
    letter-spacing: 0;
    font-size: 0.88rem;
    color: var(--ink);
  }


  .play {
    position: absolute;
    left: 50%;
    top: 42%;
    width: 48px;
    height: 48px;
    margin: -24px 0 0 -24px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: rgb(251 251 247 / 0.92);
    color: var(--route-deep);
  }

  .play svg {
    fill: currentColor;
    margin-left: 3px;
  }

  @media (prefers-reduced-motion: reduce) {
    .print {
      transition: none;
    }
  }
</style>
