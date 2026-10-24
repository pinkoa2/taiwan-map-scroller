<script>
  // Full-screen photos: arrows or swipe to move through the photos of the
  // place the opened one belongs to (not the whole trip), Escape to close.
  // Photos zoom with a pinch or a double tap (double click on desktop) and
  // can be dragged around while zoomed. Swiping works on videos too.
  let { plates, index = $bindable(null) } = $props()

  let dialog
  let stage = $state()

  const current = $derived(index == null ? null : plates[index])

  $effect(() => {
    if (!dialog) return
    if (index != null && !dialog.open) dialog.showModal()
    if (index == null && dialog.open) dialog.close()
  })

  // The opened photo's place: its photos, and where this one sits among them.
  const group = $derived(current ? plates.map((p, k) => k).filter((k) => plates[k].group === current.group) : [])
  const pos = $derived(group.indexOf(index))
  const go = (d) => (index = group[(pos + d + group.length) % group.length])

  function key(e) {
    if (e.key === 'ArrowRight') go(1)
    else if (e.key === 'ArrowLeft') go(-1)
  }

  // ---------- loading ----------

  // A friendly word while a photo is on its way; shown only if it's slow.
  const WAITS = [
    'Hosted for free and vibe-coded with love, so it takes its time.',
    'Fetching this one from Taiwan. By scooter.',
    'One very tired free web server is doing its best.',
    'Slow, like a good Alishan sunrise. Worth the wait.',
    'Free hosting: the price is right, the speed is not.',
  ]
  let loaded = $state(false)
  let slow = $state(false)
  let wait = $state(WAITS[0])
  let slowTimer

  $effect(() => {
    void index
    loaded = false
    slow = false
    wait = WAITS[Math.floor(Math.random() * WAITS.length)]
    clearTimeout(slowTimer)
    slowTimer = setTimeout(() => (slow = true), 250)
    reset()
    return () => clearTimeout(slowTimer)
  })

  function ready() {
    loaded = true
    clearTimeout(slowTimer)
  }

  // Shown at once while the full-size file arrives: the copy of this photo
  // the page has already loaded (a deck print, say), or else its blurred
  // stand-in. The full-size one fades in over it.
  function loadedCopy(photo) {
    if (typeof document === 'undefined' || photo.video) return null
    for (const el of document.querySelectorAll('img[srcset]')) {
      if (dialog?.contains(el)) continue
      if (el.getAttribute('srcset') === photo.srcset && el.complete && el.naturalWidth && el.currentSrc) return el.currentSrc
    }
    return null
  }
  const copy = $derived(current ? loadedCopy(current.photo) : null)

  // The photos either side, fetched ahead so moving through them doesn't wait.
  const around = $derived(group.length > 1 ? [...new Set([group[(pos + 1) % group.length], group[(pos - 1 + group.length) % group.length]])].filter((k) => k !== index && !plates[k].photo.video) : [])

  // An already-cached photo is complete before its load event can be heard.
  function img(node) {
    if (node.complete && node.naturalWidth) ready()
  }

  // ---------- zoom, pan and swipe ----------

  let scale = $state(1)
  let tx = $state(0)
  let ty = $state(0)
  const MAX = 4

  function reset() {
    scale = 1
    tx = 0
    ty = 0
  }

  // Keep a zoomed photo from being dragged right off the screen.
  function clampPan() {
    if (!stage) return
    const mx = (stage.clientWidth * (scale - 1)) / 2 + 40
    const my = (stage.clientHeight * (scale - 1)) / 2 + 40
    tx = Math.min(mx, Math.max(-mx, tx))
    ty = Math.min(my, Math.max(-my, ty))
  }

  // Zoom to `to`, keeping the screen point (x, y) under the finger in place.
  function zoomAt(to, x, y) {
    const r = stage.getBoundingClientRect()
    const cx = x - (r.left + r.width / 2)
    const cy = y - (r.top + r.height / 2)
    const k = to / scale
    tx = cx - (cx - tx) * k
    ty = cy - (cy - ty) * k
    scale = to
    if (scale <= 1.02) reset()
    else clampPan()
  }

  const isVideo = () => !!current?.photo.video

  function gestures(node) {
    let pinch = null
    let one = null
    let lastTap = 0
    // Phones also fire mouse-style clicks after taps; those are ignored here.
    let lastTouch = 0

    const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)

    const start = (e) => {
      lastTouch = Date.now()
      if (e.touches.length === 2 && !isVideo()) {
        const [a, b] = e.touches
        pinch = { d0: dist(e.touches), s0: scale, x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 }
        one = null
      } else if (e.touches.length === 1) {
        const t = e.touches[0]
        one = { x: t.clientX, y: t.clientY, tx0: tx, ty0: ty, t: Date.now(), moved: false }
      }
    }

    const move = (e) => {
      if (pinch && e.touches.length === 2) {
        e.preventDefault()
        zoomAt(Math.min(MAX, Math.max(1, (pinch.s0 * dist(e.touches)) / pinch.d0)), pinch.x, pinch.y)
        return
      }
      if (!one || e.touches.length !== 1) return
      const t = e.touches[0]
      const dx = t.clientX - one.x
      const dy = t.clientY - one.y
      if (Math.hypot(dx, dy) > 8) one.moved = true
      if (scale > 1) {
        e.preventDefault()
        tx = one.tx0 + dx
        ty = one.ty0 + dy
        clampPan()
      }
    }

    const end = (e) => {
      lastTouch = Date.now()
      if (pinch) {
        if (e.touches.length < 2) pinch = null
        return
      }
      if (!one) return
      const t = e.changedTouches[0]
      const dx = t.clientX - one.x
      const dy = t.clientY - one.y
      const tap = !one.moved && Date.now() - one.t < 250
      one = null
      if (scale <= 1 && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        go(dx < 0 ? 1 : -1)
        return
      }
      // Double tap: zoom in where tapped, or back out.
      if (tap && !isVideo()) {
        const now = Date.now()
        if (now - lastTap < 300) {
          zoomAt(scale > 1 ? 1 : 2.5, t.clientX, t.clientY)
          lastTap = 0
        } else lastTap = now
      }
    }

    // Mouse: drag to swipe, or to move around a zoomed photo.
    let mouse = null
    const mdown = (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || Date.now() - lastTouch < 800) return
      mouse = { x: e.clientX, y: e.clientY, tx0: tx, ty0: ty }
    }
    const mmove = (e) => {
      if (!mouse || scale <= 1) return
      tx = mouse.tx0 + e.clientX - mouse.x
      ty = mouse.ty0 + e.clientY - mouse.y
      clampPan()
    }
    const mup = (e) => {
      if (!mouse) return
      const dx = e.clientX - mouse.x
      mouse = null
      if (scale <= 1 && Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)
    }
    const dbl = (e) => {
      if (Date.now() - lastTouch < 800 || isVideo()) return
      zoomAt(scale > 1 ? 1 : 2.5, e.clientX, e.clientY)
    }

    // Touch listeners are non-passive so a pinch or pan can stop the page moving.
    node.addEventListener('touchstart', start, { passive: true })
    node.addEventListener('touchmove', move, { passive: false })
    node.addEventListener('touchend', end)
    node.addEventListener('pointerdown', mdown)
    node.addEventListener('pointermove', mmove)
    node.addEventListener('pointerup', mup)
    node.addEventListener('dblclick', dbl)
    return () => {
      node.removeEventListener('touchstart', start)
      node.removeEventListener('touchmove', move)
      node.removeEventListener('touchend', end)
      node.removeEventListener('pointerdown', mdown)
      node.removeEventListener('pointermove', mmove)
      node.removeEventListener('pointerup', mup)
      node.removeEventListener('dblclick', dbl)
    }
  }
</script>

<dialog bind:this={dialog} onclose={() => (index = null)} onkeydown={key} aria-label="Photo viewer">
  {#if current}
    <div class="stage" class:zoomed={scale > 1} bind:this={stage} {@attach gestures} role="presentation">
      {#key index}
        <div class="zoom" style:transform="translate3d({tx}px, {ty}px, 0) scale({scale})">
          {#if current.photo.video}
            <!-- svelte-ignore a11y_media_has_caption -->
            <video
              src={current.photo.video}
              poster={current.photo.src}
              controls
              autoplay
              playsinline
              preload="metadata"
              onloadeddata={ready}
              oncanplay={ready}
            ></video>
          {:else}
            <img class="stand-in" src={copy ?? current.photo.placeholder} alt="" aria-hidden="true" draggable="false" class:blurred={!copy} />
            <img
              class="full"
              class:loaded
              src={current.photo.src}
              srcset={current.photo.srcset}
              sizes="100vw"
              alt={current.photo.alt}
              onload={ready}
              {@attach img}
              draggable="false"
            />
          {/if}
        </div>
      {/key}
      {#if !loaded && slow && !copy}
        <div class="loading" role="status">
          <span class="spinner" aria-hidden="true"></span>
          <p>{wait}</p>
        </div>
      {/if}
    </div>
    {#each around as k (k)}
      <img class="ahead" src={plates[k].photo.src} srcset={plates[k].photo.srcset} sizes="100vw" alt="" aria-hidden="true" fetchpriority="low" />
    {/each}
    <div class="bar">
      <p class="caption">
        <span>{current.photo.caption ?? current.place}</span>
        {#if current.photo.taken}<span class="lettering credit">{current.photo.taken}</span>{/if}
        {#if current.photo.comment}<span class="comment">{current.photo.comment}</span>{/if}
      </p>
      <div class="controls">
        {#if group.length > 1}
        <button onclick={() => go(-1)} aria-label="Previous photo">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <span class="lettering pos">{pos + 1} / {group.length}</span>
        <!-- svelte-ignore a11y_autofocus -->
        <button onclick={() => go(1)} aria-label="Next photo" autofocus>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
        </button>
        {/if}
        <button onclick={() => (index = null)} aria-label="Close viewer">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
    </div>
  {/if}
</dialog>

<style>
  dialog {
    width: 100vw;
    height: 100dvh;
    max-width: none;
    max-height: none;
    margin: 0;
    padding: 0;
    border: 0;
    background: #171812;
    color: #f2f3ec;
    display: none;
    grid-template-rows: 1fr auto;
  }

  dialog[open] {
    display: grid;
  }

  dialog::backdrop {
    background: #171812;
  }

  video {
    background: #000;
  }

  .zoom {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    transform-origin: center;
    will-change: transform;
  }

  .stage.zoomed {
    cursor: grab;
  }

  /* While a photo is on its way: a spinning route-red ring and a word. */
  .loading {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 2rem;
    text-align: center;
    pointer-events: none;
    animation: appear 0.4s ease-out;
  }

  .loading p {
    max-width: 26ch;
    margin: 0;
    font-style: italic;
    color: #c9cbbf;
  }

  .spinner {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    border: 3px solid rgb(242 243 236 / 0.18);
    border-top-color: #ff8a66;
    animation: spin 0.9s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes appear {
    from {
      opacity: 0;
    }
  }

  .stage {
    min-height: 0;
    height: 100%;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem 1rem 0.5rem;
    position: relative;
    /* Pinch, pan and swipe are handled here, not by the browser. */
    touch-action: none;
  }

  img,
  video {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    animation: in 0.45s cubic-bezier(0.16, 1, 0.3, 1);
  }

  /* The stand-in and the full-size photo fill the same box, one over the
     other, so the sharp one simply resolves in place. */
  img.stand-in,
  img.full {
    width: 100%;
    height: 100%;
    max-width: none;
    max-height: none;
  }

  img.stand-in {
    position: absolute;
    inset: 0;
  }

  /* A 20px stand-in, softened so it reads as a photo arriving, not a mosaic. */
  img.stand-in.blurred {
    filter: blur(14px);
    transform: scale(0.96);
  }

  img.full {
    position: relative;
    opacity: 0;
    transition: opacity 0.3s ease-out;
    animation: none;
  }

  img.full.loaded {
    opacity: 1;
  }

  .ahead {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }

  @keyframes in {
    from {
      opacity: 0;
      transform: scale(0.985);
    }
  }

  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem 1.5rem;
    padding: 0.9rem max(1rem, env(safe-area-inset-left)) max(0.9rem, env(safe-area-inset-bottom));
    border-top: 1px solid #3a3c33;
  }

  .caption {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.2rem 0.8rem;
    margin: 0;
    flex: 1 1 18rem;
  }


  .credit {
    color: #b9bcae;
    font-size: 0.75rem;
    letter-spacing: 0.06em;
    text-transform: none;
  }

  .comment {
    flex-basis: 100%;
    max-width: 62ch;
    font-style: italic;
    color: #d6d8cc;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .pos {
    min-width: 4.5rem;
    text-align: center;
    font-size: 0.9rem;
  }

  button {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border: 1px solid #4b4d43;
    background: transparent;
    cursor: pointer;
    transition: background 0.2s;
  }

  button:hover {
    background: #2a2b24;
  }

  svg path {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  @media (prefers-reduced-motion: reduce) {
    img,
    video {
      animation: none;
    }
  }
</style>
