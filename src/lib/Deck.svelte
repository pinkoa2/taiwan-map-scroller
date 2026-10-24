<script>
  // A place's photos as a deck of prints (photoLayout 'deck', wide screens
  // beside the place and phones under it). One print at a time sits on top,
  // big enough to enjoy, with the next two peeking out beneath. Swipe or drag
  // the top print sideways (or use the arrows, the ticks or ← →) to flip
  // through; it loops, so past the last comes the first and back from the
  // first comes the last. Scrolling simply carries on past. The deck lands as a whole on
  // reaching the place and lifts away before the next one.
  import Squiggle from './Squiggle.svelte'
  import { deckArea, printSize, printSizes } from './deck.js'

  // at: the print on top; flip(k) puts print k on top (App remembers it per place).
  // hint: 'swipe' (how to flip), 'open' (tap to open) or null.
  let { prints, at, flip, w, h, edge, open, wide = true, active = true, hint = null } = $props()

  const still = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

  // A small turn per print, so the pile reads as handled, not stacked by machine.
  const TURNS = [-1.4, 0.9, -0.6, 1.5, -1.1, 0.5, 1.2, -0.9]
  // Where the prints under the top one sit, by depth.
  const UNDER = [
    { x: 0, y: 0, r: 0 },
    { x: 16, y: 10, r: 2.8 },
    { x: -14, y: 16, r: -2.6 },
  ]

  const n = $derived(prints.length)
  const area = $derived(deckArea(w, h, edge, wide))
  const sized = $derived(prints.map((print) => printSize(print.photo, area, wide)))

  // Images load from the top print outward, and stay once loaded, so flipping
  // back never waits. The top one asks for its file first.
  let loaded = $state(new Set())
  const depth = (i) => (i - at + n) % n
  const wanted = (i) => depth(i) <= 3 || depth(i) === n - 1
  $effect(() => {
    const add = prints.map((_, i) => i).filter((i) => wanted(i) && !loaded.has(i))
    if (add.length) loaded = new Set([...loaded, ...add])
  })

  // The hint shows from when the deck lands; the swipe hint goes once you flip.
  const shownHint = hint
  let flipped = $state(false)
  function go(k) {
    if (n < 2) return
    k = (k + n) % n
    if (k === at) return
    flipped = true
    flip(k)
  }

  // Dragging the top print: it follows the finger or mouse sideways, and past
  // a short distance it flips on release. Vertical moves stay page scrolls.
  // A swipe counts as sideways unless it's clearly more up-and-down
  // (|dx| ≥ 0.7·|dy|), since thumbs swipe in an arc.
  const SIDEWAYS = 0.7

  // On a touch screen the browser would take a slightly diagonal swipe as a
  // scroll (and the deck would slide away). So on the swipe's first move,
  // a sideways one is claimed for the deck and the page holds still; an
  // up-and-down one is left to scroll as normal.
  function holdSideways(node) {
    let t0 = null
    let claimed = null
    const start = (e) => {
      const t = e.touches[0]
      t0 = e.touches.length === 1 && e.target.closest?.('.print.top') ? { x: t.clientX, y: t.clientY } : null
      claimed = null
    }
    const moveTouch = (e) => {
      if (!t0) return
      const t = e.touches[0]
      const dx = t.clientX - t0.x
      const dy = t.clientY - t0.y
      if (claimed == null) {
        if (dx === 0 && dy === 0) return
        claimed = Math.abs(dx) >= Math.abs(dy) * SIDEWAYS
      }
      if (claimed && e.cancelable) e.preventDefault()
    }
    node.addEventListener('touchstart', start, { passive: true })
    node.addEventListener('touchmove', moveTouch, { passive: false })
    return () => {
      node.removeEventListener('touchstart', start)
      node.removeEventListener('touchmove', moveTouch)
    }
  }
  let drag = $state(0)
  let dragging = $state(false)
  let start = null
  let moved = false
  function down(e) {
    if (e.button > 0) return
    start = { x: e.clientX, y: e.clientY, id: e.pointerId }
    moved = false
  }
  function move(e) {
    if (!start || e.pointerId !== start.id) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (!dragging) {
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy) * SIDEWAYS) return
      dragging = true
      moved = true
      e.currentTarget.setPointerCapture?.(e.pointerId)
    }
    drag = n < 2 ? dx * 0.25 : dx
  }
  function up() {
    if (dragging) go(drag < -60 ? at + 1 : drag > 60 ? at - 1 : at)
    dragging = false
    drag = 0
    start = null
  }
  function click(print) {
    if (moved) return
    open(print.number)
  }

  function key(e) {
    if (!active || e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey) return
    if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, dialog')) return
    if (e.key === 'ArrowRight') go(at + 1)
    else if (e.key === 'ArrowLeft') go(at - 1)
  }

  // Depth in the pile, counted round the loop: 0 on top, then the ones
  // beneath. The one just flipped past (last in the loop) waits off to the
  // left, where a swipe threw it, so flipping back brings it in from there.
  // Stacking follows the depth; a print flying off (or back) stays on top.
  function place(i) {
    const d = depth(i)
    const turn = TURNS[i % TURNS.length]
    if (d === n - 1 && n > 2) return { transform: `translate(calc(-50% - ${sized[i].pw * 0.85 + 40}px), calc(-50% + 30px)) rotate(${turn - 14}deg)`, opacity: 0, z: n + 1 }
    if (d === 0 && drag) return { transform: `translate(calc(-50% + ${drag}px), -50%) rotate(${turn + drag * 0.03}deg)`, opacity: 1, z: n }
    const u = UNDER[Math.min(d, 2)]
    return {
      transform: `translate(calc(-50% + ${u.x}px), calc(-50% + ${u.y}px)) rotate(${turn + u.r}deg)`,
      opacity: d > 2 ? 0 : 1,
      z: n - d,
    }
  }

  // Where the hint goes. Swipe: just above the top print, the sweep showing
  // the gesture. Open: above the top print's top-left corner, swooping onto
  // it (a box about 220 × 112 px with its tip ~105 px in and ~108 px down).
  const hintAt = $derived.by(() => {
    const s = sized[at]
    if (!s || !shownHint) return null
    const printTop = area.cy - s.ph / 2
    if (shownHint === 'swipe') {
      if (flipped || n < 2) return null
      return { kind: 'swipe', left: area.cx - 110, top: Math.max(printTop - 76, edge + 6) }
    }
    const cornerX = area.cx - s.pw / 2 + 22
    return { kind: 'open', left: Math.max(cornerX - 105, 4), top: Math.max(printTop + 16 - 110, edge + 8) }
  })

  // The whole deck lands from just above, and lifts away the same way.
  function drop() {
    return {
      duration: still ? 0 : 560,
      easing: (t) => 1 - Math.pow(1 - t, 3),
      css: (t, u) => `opacity: ${Math.min(1, t * 1.8)}; transform: translateY(${-u * 26}px) scale(${1 + u * 0.04})`,
    }
  }
  function lift() {
    return {
      duration: still ? 0 : 360,
      easing: (t) => t * t,
      css: (t, u) => `opacity: ${t}; transform: translateY(${-u * 18}px) scale(${1 + u * 0.03})`,
    }
  }
</script>

<svelte:window onkeydown={key} />

<div class="deck" aria-label="Photos" in:drop|global out:lift|global {@attach holdSideways}>
  {#if hintAt}
    <div class="hint" style:left="{hintAt.left}px" style:top="{hintAt.top}px">
      {#if hintAt.kind === 'swipe'}
        <Squiggle text={wide ? 'Drag for more photos' : 'Swipe for more photos'} toward="swipe" />
      {:else}
        <Squiggle text={wide ? 'Click a photo to open it' : 'Tap a photo to open it'} toward="right" />
      {/if}
    </div>
  {/if}

  {#each prints as print, i (print.number)}
    {@const s = sized[i]}
    {@const pos = place(i)}
    {@const near = loaded.has(i) || i === at}
    <button
      class="print"
      class:top={i === at}
      class:dragging={i === at && dragging}
      style:left="{area.cx}px"
      style:top="{area.cy}px"
      style:width="{s.pw}px"
      style:transform={pos.transform}
      style:opacity={pos.opacity}
      style:z-index={pos.z}
      tabindex={i === at ? 0 : -1}
      aria-hidden={i !== at}
      onpointerdown={down}
      onpointermove={move}
      onpointerup={up}
      onpointercancel={up}
      onclick={() => click(print)}
      ondragstart={(e) => e.preventDefault()}
      aria-label={print.photo.video ? `Play video` : `Open photo full screen`}
    >
      <img
        src={near ? print.photo.src : undefined}
        srcset={near ? print.photo.srcset : undefined}
        sizes={printSizes(s.iw)}
        fetchpriority={i === at ? 'high' : 'low'}
        width={print.photo.w}
        height={print.photo.h}
        alt={print.photo.alt}
        draggable="false"
        style:height="{s.ih}px"
        style:background-image="url({print.photo.placeholder})"
      />
      {#if print.photo.video}
        <span class="play" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M8 5.5v13l11-6.5z" /></svg></span>
      {/if}
      <span class="foot">
        {#if print.photo.caption}<span class="caption">{print.photo.caption}</span>{:else}<span class="lettering">{print.place}</span>{/if}
        <span class="count lettering"><b>{i + 1}</b> / {n}</span>
      </span>
    </button>
  {/each}

  <!-- Back, one tick per photo (the lit one is on top), forward. -->
  {#if n > 1}
    <nav class="controls" style:left="{area.cx}px" style:top="{area.bottom + 50}px" aria-label="Photos at this stop">
      <button class="arrow" onclick={() => go(at - 1)} aria-label="Previous photo">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M14.5 5.5 8 12l6.5 6.5" /></svg>
      </button>
      <span class="ticks" style:width="{Math.min(n * 23, area.right - area.left - 110)}px">
        {#each prints as print, i (print.number)}
          <button class="tick" class:lit={i === at} class:seen={i < at} onclick={() => go(i)} aria-label="Photo {i + 1} of {n}" aria-current={i === at ? 'true' : undefined}></button>
        {/each}
      </span>
      <button class="arrow" onclick={() => go(at + 1)} aria-label="Next photo">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9.5 5.5 16 12l-6.5 6.5" /></svg>
      </button>
    </nav>
  {/if}
</div>

<style>
  .deck {
    position: fixed;
    inset: 0;
    z-index: 2;
    pointer-events: none;
  }

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

  /* A print: the photo on a paper mount with a wider foot for its caption. */
  .print {
    position: absolute;
    display: block;
    padding: 10px 10px 0;
    border: 0;
    background: var(--paper);
    box-shadow:
      0 1px 2px rgb(40 36 20 / 0.22),
      0 10px 22px -12px rgb(40 36 20 / 0.45);
    transition:
      transform 0.62s cubic-bezier(0.16, 1, 0.3, 1),
      opacity 0.42s cubic-bezier(0.16, 1, 0.3, 1),
      box-shadow 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    user-select: none;
    -webkit-user-select: none;
  }

  /* The top print takes sideways drags; up and down still scroll the page. */
  .print.top {
    cursor: grab;
    pointer-events: auto;
    touch-action: pan-y;
    box-shadow:
      0 2px 3px rgb(40 36 20 / 0.22),
      0 26px 46px -18px rgb(40 36 20 / 0.6);
  }

  .print.top:hover,
  .print.top:focus-visible {
    box-shadow:
      0 2px 4px rgb(40 36 20 / 0.2),
      0 34px 56px -18px rgb(40 36 20 / 0.62);
  }

  .print.dragging {
    cursor: grabbing;
    transition: none;
  }

  .print:focus-visible {
    outline: 2px solid var(--route);
    outline-offset: 4px;
  }

  img {
    display: block;
    width: 100%;
    object-fit: cover;
    background-color: var(--land);
    background-size: cover;
    background-position: center;
    pointer-events: none;
  }

  .foot {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 1rem;
    height: 46px;
    padding: 0.85rem 0.2rem 0;
    font-size: 0.78rem;
    color: var(--ink-soft);
    text-align: left;
  }

  /* Only the top print's foot is read; the ones beneath stay blank paper. */
  .print:not(.top) .foot > * {
    opacity: 0;
  }

  .caption {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--font-text);
    font-style: italic;
    text-transform: none;
    letter-spacing: 0;
    font-size: 1rem;
    color: var(--ink);
  }

  .count {
    flex: none;
    font-variant-numeric: tabular-nums;
    color: var(--ink-faint);
  }

  .count b {
    font-weight: 600;
    color: var(--route-deep);
  }

  .play {
    position: absolute;
    left: 50%;
    top: 45%;
    width: 56px;
    height: 56px;
    margin: -28px 0 0 -28px;
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

  /* Under the deck, clear of the turned prints beneath and always above them:
     ‹ ticks ›. */
  .controls {
    position: absolute;
    z-index: 150;
    display: flex;
    align-items: center;
    gap: 12px;
    transform: translate(-50%, -50%);
    pointer-events: auto;
  }

  .arrow {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    padding: 0;
    border: 1px solid var(--rule);
    border-radius: 50%;
    background: var(--paper);
    color: var(--ink);
    cursor: pointer;
    box-shadow: 0 6px 14px -8px rgb(40 36 20 / 0.5);
    transition:
      color 0.2s,
      opacity 0.2s,
      transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .arrow svg {
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .arrow:hover {
    color: var(--route-deep);
    transform: scale(1.06);
  }

  .arrow:focus-visible,
  .tick:focus-visible {
    outline: 2px solid var(--route);
    outline-offset: 2px;
  }

  .ticks {
    display: flex;
    justify-content: center;
    gap: 5px;
  }

  .tick {
    flex: 1;
    max-width: 18px;
    height: 22px;
    padding: 0;
    border: 0;
    background: none;
    cursor: pointer;
  }

  .tick::before {
    content: '';
    display: block;
    height: 3px;
    background: var(--ink-faint);
    opacity: 0.45;
    transition:
      background-color 0.3s,
      opacity 0.3s,
      transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .tick.seen::before {
    opacity: 0.8;
  }

  .tick.lit::before {
    background: var(--route);
    opacity: 1;
    transform: scaleY(1.7);
  }

  .tick:hover::before {
    opacity: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    .print,
    .arrow,
    .tick::before {
      transition: none;
    }
  }
</style>
