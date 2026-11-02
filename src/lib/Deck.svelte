<script>
  // A place's photos as a deck of prints (photoLayout 'deck', wide screens
  // beside the place and phones under it). One print at a time sits on top,
  // big enough to enjoy, with the next two peeking out beneath. Swipe or drag
  // the top print sideways (or use the arrows, the ticks or ← →) to flip
  // through; it loops, so past the last comes the first and back from the
  // first comes the last. Scrolling simply carries on past. The deck lands as a whole on
  // reaching the place and lifts away before the next one.
  import Onward from './Onward.svelte'
  import PlaceCard from './PlaceCard.svelte'
  import { deckArea, printSize, printSizes } from './deck.js'

  // at: the print on top; flip(k) puts print k on top (App remembers it per place).
  // hint: 'swipe' (nudge to show how to flip) or null.
  // next: the stop scrolling on takes you to ({ name, zh }), and onward() skips there.
  // place: the deck's step key, naming the ↓ button it's dealt from.
  let { prints, at, flip, w, h, edge, open, wide = true, active = true, hint = null, next = null, onward, back = null, place: dealFrom = '' } = $props()

  const still = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

  // A slight turn per print, so the pile reads as handled, not stacked by
  // machine, yet stays a neat pile (the user asked for neater).
  const TURNS = [-0.5, 0.35, -0.2, 0.55, -0.4, 0.2, 0.45, -0.3]
  // Where the prints under the top one sit, by depth: squared up beneath it,
  // their edges just showing.
  const UNDER = [
    { x: 0, y: 0, r: 0 },
    { x: 5, y: 7, r: 1.1 },
    { x: -4, y: 13, r: -0.9 },
  ]

  const n = $derived(prints.length)
  const area = $derived(deckArea(w, h, edge, wide))
  // The place's words ride on top of its pile as a card (PlaceCard.svelte, a
  // map sheet's label; the user asked,
  // Nov 2, 2026, to go straight to the photos: each place is one stop, its
  // pile, instead of a page of words and then the photos), or several when
  // the words are long. Photos count from the first one beneath them. A card
  // is as big as the biggest print in the pile
  // (the user asked: the same size if not bigger than the photos), so it
  // covers the pile and the photos' edges peek out from under it.
  const noted = $derived(prints.findIndex((print) => !print.note) < 0 ? n : prints.findIndex((print) => !print.note))
  const photoCount = $derived(n - noted)
  const sized = $derived.by(() => {
    const list = prints.map((print) => (print.note ? null : printSize(print.photo, area, wide)))
    const photos = list.filter(Boolean)
    const pw = photos.length ? Math.max(...photos.map((s) => s.pw)) : Math.min(area.right - area.left - 40, 520)
    const ph = photos.length ? Math.max(...photos.map((s) => s.ph)) : pw * 0.7
    return list.map((s) => s ?? { iw: pw - 20, ih: ph - 56, pw, ph, note: true })
  })
  // The pile rests on a shelf just above the controls: every print's foot
  // sits on it, and the shelf is as low as the deck's tallest print needs
  // (centred in the deck's ground). So the ‹ › and the ↓ sit right under the
  // photo however short it is, and stay put as you flip (the user, Nov 2,
  // 2026: on an iPad the buttons were so far below a wide photo they missed
  // them).
  const shelf = $derived(Math.min(area.bottom, area.cy + Math.max(...sized.filter((s) => !s.note).map((s) => s.ph), 0) / 2))
  const controlsY = $derived(shelf + (area.controls - area.bottom))
  const skipY = $derived(shelf + (area.skip - area.bottom))

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

  // Which photos have been on top here. Once every one has, the ↓ under the
  // deck calls out (the way on), since swipes on the photo no longer leave.
  let seen = $state(new Set())
  $effect(() => {
    if (!seen.has(at)) seen = new Set([...seen, at])
  })
  const seenAll = $derived(n > 1 && seen.size >= n)

  // The swipe hint, without words: the top print slides aside by itself to
  // show the one beneath, then settles back. Once as the deck lands, and once
  // more if it's left alone; never after the first flip.
  $effect(() => {
    if (shownHint !== 'swipe' || still || n < 2) return
    const timers = [950, 6500].map((t) => setTimeout(nudge, t))
    return () => timers.forEach(clearTimeout)
  })
  function nudge() {
    if (flipped || dragging || start) return
    drag = -Math.min(96, sized[at].pw * 0.22)
    setTimeout(() => {
      if (!dragging) drag = 0
    }, 420)
  }

  // Dragging the top print: it follows the finger or mouse sideways, and past
  // a short distance it flips on release. A swipe on the photo is the
  // photo's, whatever its angle (the user asked, Nov 2, 2026: a slightly
  // steep swipe used to scroll the page on, and Ting kept leaving the photos
  // by mistake): anything short of nearly straight up or down flips, and a
  // straight one just nudges the print, so it's clear it was felt. Leaving
  // is the ↓, or a swipe on the map around the pile (glide.js leaves touches
  // that start on [data-own-swipe] alone).
  const SIDEWAYS = 0.45

  // The page never scrolls under a finger on the photo (touch-action: none
  // on the print too, but iPhones need the touchmove held as well).
  function holdPhoto(node) {
    let on = false
    const start = (e) => {
      on = e.touches.length === 1 && !!e.target.closest?.('.print.top')
    }
    const moveTouch = (e) => {
      if (on && e.cancelable) e.preventDefault()
    }
    node.addEventListener('touchstart', start, { passive: true })
    node.addEventListener('touchmove', moveTouch, { passive: false })
    return () => {
      node.removeEventListener('touchstart', start)
      node.removeEventListener('touchmove', moveTouch)
    }
  }
  let drag = $state(0)
  // A straight up-or-down drag on the photo: the print gives a little, then
  // springs back on release.
  let give = $state(0)
  let dragging = $state(false)
  let start = null
  let moved = false
  function down(e) {
    if (e.button > 0) return
    start = { x: e.clientX, y: e.clientY, id: e.pointerId, way: null }
    moved = false
  }
  function move(e) {
    if (!start || e.pointerId !== start.id) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (!start.way) {
      if (Math.hypot(dx, dy) < 8) return
      start.way = Math.abs(dx) >= Math.abs(dy) * SIDEWAYS ? 'side' : 'up'
      moved = true
      e.currentTarget.setPointerCapture?.(e.pointerId)
      if (start.way === 'side') dragging = true
    }
    if (start.way === 'side') drag = n < 2 ? dx * 0.25 : dx
    // Only a finger nudges it; a mouse dragged up or down does nothing.
    else if (e.pointerType !== 'mouse') give = Math.max(-22, Math.min(22, dy * 0.18))
  }
  function up() {
    if (dragging) go(drag < -60 ? at + 1 : drag > 60 ? at - 1 : at)
    dragging = false
    drag = 0
    give = 0
    start = null
  }
  // A photo opened by a click or tap shouldn't come back from the viewer
  // wearing the keyboard focus ring (the browser shows it after the viewer's
  // keys); one opened from the keyboard keeps it.
  let byPointer = false
  function click(e, print) {
    if (moved) return
    if (print.note) {
      if (!e.target.closest('a')) go(at + 1)
      return
    }
    byPointer = e.detail > 0
    open(print.number)
  }
  $effect(() => {
    if (!active || !byPointer) return
    byPointer = false
    // A frame later: the closing viewer hands focus back to the print first.
    requestAnimationFrame(() => {
      if (document.activeElement?.closest?.('.print')) document.activeElement.blur()
    })
  })

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
    if (d === n - 1 && n > 2) return { transform: `translate(calc(-50% - ${sized[i].pw * 0.85 + 40}px), calc(-100% + 30px)) rotate(${turn - 14}deg)`, opacity: 0, z: n + 1 }
    if (d === 0 && sized[i].note) return { transform: `translate(calc(-50% + ${drag}px), calc(-100% + ${give}px)) rotate(${-0.8 + drag * 0.03}deg)`, opacity: 1, z: n }
    if (d === 0 && (drag || give)) return { transform: `translate(calc(-50% + ${drag}px), calc(-100% + ${give}px)) rotate(${turn + drag * 0.03}deg)`, opacity: 1, z: n }
    const u = UNDER[Math.min(d, 2)]
    // A print beneath is shrunk to tuck in behind the one on top, so a wide
    // photo under a tall one doesn't stick out past it on both sides.
    const top = sized[at]
    const fit = d === 0 || !top || top.note ? 1 : Math.min(1, (top.pw + 8) / sized[i].pw, (top.ph + 10) / sized[i].ph)
    return {
      transform: `translate(calc(-50% + ${u.x}px), calc(-100% + ${u.y}px)) rotate(${turn + u.r}deg) scale(${fit})`,
      opacity: d > 2 ? 0 : 1,
      z: n - d,
    }
  }

  // Dealt from the card (the user picked it, Oct 30, 2026): as the deck
  // lands, the top three prints fly out of the place's "↓ 14 photos" button,
  // small at first, bottom one first and the top one last so it lands on
  // top, each lifted (a deeper shadow) in flight and turning as it settles.
  // The button has usually just gone off the top on a phone, so they come
  // down from there; with no button to be found, from just above the pile.
  const DEAL_MS = 640
  const DEAL_GAP = 110
  const origin = (() => {
    const el = dealFrom && document.querySelector(`[data-deal="${dealFrom}"] .down`)
    const r = el?.getBoundingClientRect()
    if (!r) return null
    return { x: Math.min(Math.max(r.left + r.width / 2, -60), w + 60), y: Math.min(Math.max(r.top + r.height / 2, -90), h + 90) }
  })()
  function deal(node, { i }) {
    const d = depth(i)
    if (d > 2 || still) return { duration: 0 }
    const mid = shelf - sized[i].ph / 2
    const dx = (origin?.x ?? area.cx) - area.cx
    const dy = (origin?.y ?? mid - 40) - mid
    const final = node.style.transform
    const spin = (i % 2 ? 1 : -1) * 9
    return {
      delay: (2 - d) * DEAL_GAP,
      duration: DEAL_MS,
      easing: (t) => 1 - Math.pow(1 - t, 3),
      css: (t, u) =>
        `opacity: ${Math.min(1, t * 4)};` +
        `transform: translate(${dx * u}px, ${dy * u}px) ${final} rotate(${spin * u}deg) scale(${1 - 0.72 * u});` +
        `filter: drop-shadow(0 ${30 * Math.sin(Math.PI * t)}px ${24 * Math.sin(Math.PI * t)}px rgb(40 36 20 / ${0.3 * Math.sin(Math.PI * t)}))`,
    }
  }
  // The controls and the ↓ under them come in as the prints land.
  function settle() {
    return { delay: still ? 0 : DEAL_GAP, duration: still ? 0 : 320, css: (t) => `opacity: ${t}` }
  }
  // Quick, so skipping on clears the photos at once.
  function lift() {
    return {
      duration: still ? 0 : 220,
      easing: (t) => t * t,
      css: (t, u) => `opacity: ${t}; transform: translateY(${-u * 18}px) scale(${1 + u * 0.03})`,
    }
  }
</script>

<svelte:window onkeydown={key} />

<div class="deck" aria-label="Photos" out:lift|global {@attach holdPhoto}>
  {#each prints as print, i (print.key ?? print.number)}
    {@const s = sized[i]}
    {@const pos = place(i)}
    {@const near = loaded.has(i) || i === at}
    {#if print.note}
    {@const note = print.note}
    <!-- The place's words, as a map sheet's label (or several) on top of the pile. A
         tap anywhere on it (but the map link) flips on. -->
    <div
      class="print note"
      class:top={i === at}
      class:dragging={i === at && (dragging || give !== 0)}
      data-own-swipe={i === at ? '' : undefined}
      style:left="{area.cx}px"
      style:top="{shelf}px"
      style:width="{s.pw}px"
      style:height="{s.ph}px"
      style:transform={pos.transform}
      style:opacity={pos.opacity}
      style:z-index={pos.z}
      role="group"
      aria-roledescription="card"
      aria-label={print.parts > 1 ? `${note.name}, card ${print.part + 1} of ${print.parts}` : note.name}
      aria-hidden={i !== at}
      onpointerdown={down}
      onpointermove={move}
      onpointerup={up}
      onpointercancel={up}
      onclick={(e) => click(e, print)}
      onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget && (e.preventDefault(), go(at + 1))}
      tabindex={i === at ? 0 : -1}
      in:deal|global={{ i }}
    >
      <PlaceCard note={print.note} part={print.part} parts={print.parts} photos={photoCount} live={i === at} />
    </div>
    {:else}
    <button
      class="print"
      class:top={i === at}
      class:dragging={i === at && (dragging || give !== 0)}
      data-own-swipe={i === at ? '' : undefined}
      style:left="{area.cx}px"
      style:top="{shelf}px"
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
      onclick={(e) => click(e, print)}
      ondragstart={(e) => e.preventDefault()}
      aria-label={print.photo.video ? `Play video` : `Open photo full screen`}
      in:deal|global={{ i }}
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
        <span class="count lettering"><b>{i + 1 - noted}</b> / {photoCount}</span>
      </span>
    </button>
    {/if}
  {/each}

  <!-- Back, one tick per photo (the lit one is on top), forward. -->
  {#if n > 1}
    <nav class="controls" in:settle|global style:left="{area.cx}px" style:top="{controlsY}px" aria-label="Photos at this stop">
      <button class="arrow" onclick={() => go(at - 1)} aria-label="Previous photo">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M14.5 5.5 8 12l6.5 6.5" /></svg>
      </button>
      <span class="ticks" style:width="{Math.min(n * 23, area.right - area.left - 110)}px">
        {#each prints as print, i (print.key ?? print.number)}
          <button class="tick" class:note={!!print.note} class:lit={i === at} class:seen={seen.has(i) && i !== at} onclick={() => go(i)} aria-label={print.note ? `About ${print.note.name}${print.parts > 1 ? `, card ${print.part + 1}` : ''}` : `Photo ${i + 1 - noted} of ${photoCount}`} aria-current={i === at ? 'true' : undefined}></button>
        {/each}
      </span>
      <button class="arrow" onclick={() => go(at + 1)} aria-label="Next photo">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9.5 5.5 16 12l-6.5 6.5" /></svg>
      </button>
    </nav>
  {/if}

  <!-- Skip the photos: the ↓ on to the next stop, in its own row under the controls. -->
  {#if next}
    <div class="onward-in" in:settle|global>
    <Onward label={next.name} zh={next.zh} at={[area.cx, skipY]} call={seenAll} onclick={onward} onback={back} aria="Skip the photos, on to {next.name}" />
    </div>
  {/if}
</div>

<style>
  .deck {
    position: fixed;
    inset: 0;
    z-index: 2;
    pointer-events: none;
  }

  /* Holds the ↓ under the deck (placed absolutely within it) while it fades in. */
  .onward-in {
    position: absolute;
    inset: 0;
    pointer-events: none;
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

  /* The top print takes every drag on it (flips; the page never scrolls
     from the photo). It rests on the shelf: turns and tucks pivot at its foot. */
  .print {
    transform-origin: 50% 100%;
  }

  .print.top {
    cursor: grab;
    pointer-events: auto;
    touch-action: none;
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

  /* A narrow print (a phone on its side) cuts the name short, never wraps it. */
  .foot > .lettering:first-child {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .count {
    flex: none;
    white-space: nowrap;
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

  /* A place card on the pile (PlaceCard.svelte draws it): no paper mount of
     its own, the card is its own paper. */
  .note {
    padding: 0;
  }

  .note:focus-visible {
    outline: 2px solid var(--route);
    outline-offset: 4px;
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

  /* The note's tick: a short square, set a little apart from the photos'. */
  .tick.note {
    max-width: 10px;
    margin-right: 4px;
  }

  .tick.note::before {
    height: 7px;
  }

  .tick.note.lit::before {
    transform: scaleY(1.2);
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
