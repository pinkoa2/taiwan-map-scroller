<script>
  import { onMount } from 'svelte'
  import allTrip from 'virtual:trip'
  import SheetMap from './lib/SheetMap.svelte'
  import Viewer from './lib/Viewer.svelte'
  import Story from './lib/Story.svelte'
  import TitleBlock from './lib/TitleBlock.svelte'
  import Leg from './lib/Leg.svelte'
  import Closing from './lib/Closing.svelte'
  import Scatter from './lib/Scatter.svelte'
  import Deck from './lib/Deck.svelte'
  import { deckArea, printSize, printSizes } from './lib/deck.js'
  import Stops from './lib/Stops.svelte'
  import TrailStats from './lib/TrailStats.svelte'
  import { buildRoute, buildSteps, viewAt } from './lib/story.js'

  // By default each place shows only its picked photos (`pick` in photos.json);
  // ?display=all shows every one.
  const showAll = typeof location !== 'undefined' && new URLSearchParams(location.search).get('display') === 'all'
  const pickOf = (list) => (showAll ? list : list.filter((p) => p.pick))
  const trip = {
    ...allTrip,
    legs: allTrip.legs.map((l) => ({ ...l, photos: pickOf(l.photos), walk: l.walk ? { ...l.walk, photos: pickOf(l.walk.photos) } : null })),
  }

  const route = buildRoute(trip)
  const steps = buildSteps(trip)

  // Every photo on the trip, numbered as plates in order.
  const plates = []
  const plateStart = trip.legs.map((leg) => {
    const start = plates.length + 1
    for (const photo of leg.photos) plates.push({ photo, place: `${leg.name}${leg.zh ? ' ' + leg.zh : ''}`, group: leg.id, number: plates.length + 1 })
    for (const photo of leg.walk?.photos ?? []) plates.push({ photo, place: leg.walk.name, group: `${leg.id}-walk`, number: plates.length + 1 })
    return start
  })

  let viewer = $state(null)

  // The squiggly "click a photo" hint shows until a photo is first opened,
  // then stays away (remembered in this browser).
  const HINT_KEY = 'taiwan-photo-hint-seen'
  let hint = $state(true)
  try {
    hint = localStorage.getItem(HINT_KEY) !== '1'
  } catch {}
  $effect(() => {
    if (viewer == null || !hint) return
    hint = false
    try {
      localStorage.setItem(HINT_KEY, '1')
    } catch {}
  })

  // Deck: the print on top at each place (kept while you're on the page), and
  // the squiggly "swipe for more" hint, shown until the first flip. The "open"
  // hint follows at the next place.
  let flips = $state({})
  const SWIPE_KEY = 'taiwan-swipe-hint-seen'
  let swipeHint = $state(true)
  try {
    swipeHint = localStorage.getItem(SWIPE_KEY) !== '1'
  } catch {}
  function flipTo(key, k) {
    flips[key] = k
    if (!swipeHint) return
    swipeHint = false
    try {
      localStorage.setItem(SWIPE_KEY, '1')
    } catch {}
  }
  const deckHint = $derived(swipeHint ? 'swipe' : hint ? 'open' : null)
  let w = $state(typeof window === 'undefined' ? 1200 : window.innerWidth)
  let h = $state(typeof window === 'undefined' ? 800 : window.innerHeight)
  let p = $state(0)

  const wide = $derived(w >= 900)
  // trip.js photoLayout: wide 'deck' | 'scatter' | 'over-map' (map pages, Leg.svelte)
  // or 'mosaic' (paper pages, Story.svelte); phone 'prints' | 'mosaic'.
  const wideLayout = trip.photoLayout?.wide ?? 'deck'
  const overMap = $derived(wide && wideLayout !== 'mosaic')
  const phoneLayout = trip.photoLayout?.phone ?? 'prints'
  // Phone deck: the prints flip over the open map after each place's page.
  const phoneDeck = $derived(!wide && phoneLayout === 'deck')
  // Where a phone deck's room starts flipping: its top at this much of the screen.
  const ROOM_AT = 0.02
  // The map is a framed sheet on a wide screen, edge to edge on a phone.
  const edge = $derived(wide ? 26 : 0)
  const mapH = $derived(h)
  // Room the leg caption takes at the foot of a phone screen.
  const capH = 132
  // Where the camera frames its subject: the sheet above the leg caption.
  const focus = $derived.by(() => {
    if (wide && !overMap) {
      // The whole sheet, above the leg caption at its foot.
      const full = { x: edge + 60, y: edge + 80, w: w - 2 * edge - 120, h: h - 2 * edge - 80 - 190 }
      return () => full
    }
    if (wide) {
      // Beside the reading column while a route draws; between the photos
      // (which sit at both edges) while a place's photos are up.
      const col = Math.min(440, w * 0.38)
      const x = edge + 48 + col + 40
      const beside = { x, y: edge + 70, w: Math.max(w - x - edge - 48, 200), h: h - 2 * edge - 140 }
      // Scatter: prints land all around, so the place sits dead centre.
      // Deck: the prints sit in the right half, the place in the left.
      const middle =
        wideLayout === 'deck'
          ? { x: w * 0.25 - w * 0.09, y: h * 0.5 - h * 0.11, w: w * 0.18, h: h * 0.22 }
          : wideLayout === 'scatter'
            ? { x: w * 0.42, y: h * 0.42, w: w * 0.16, h: h * 0.16 }
            : { x: w * 0.37, y: edge + 70, w: w * 0.26, h: h - 2 * edge - 140 }
      return (step) => (step.centre ? middle : beside)
    }
    // Above the leg caption, clear of the key map.
    const top = { x: 24, y: 60, w: w - 48, h: Math.max(h - capH - 60 - 30, 160) }
    // Phone deck: the place in a band at the top, the prints below it.
    const band = { x: 24, y: 58, w: w - 48, h: Math.max(h * 0.2 - 58 - 6, 80) }
    return (step) => (phoneDeck && step.centre ? band : top)
  })
  const layout = $derived({
    w,
    h: mapH,
    edge,
    wide,
    // Over-map: key map bottom-centre, clear of the photos at both edges.
    // Mosaic: key map top-right under the badge. Phone: key map top-left (the
    // badge is top-right, clear of the left-aligned page headings).
    locatorAt: (bw, bh) => (overMap ? [w / 2 - bw - 28, h - edge - 18 - bh] : wide ? [w - edge - 22 - bw, edge + 78] : [18, 18]),
  })
  // The reading line: a step starts as its marker crosses it.
  const line = $derived(overMap ? h * 0.55 : h * 0.5)
  const story = $derived(viewAt(steps, p, focus, overMap && wideLayout === 'deck' ? 0.74 : phoneDeck ? (i) => holds[i] ?? 0 : 0))
  const here = $derived(story.at >= 0 ? trip.legs[story.at] : null)

  // A hike's stats screenshot, shown beside the trail while its footsteps draw.
  const trailStats = $derived.by(() => {
    const s = steps[Math.floor(p)]
    if (!s || !s.key.endsWith('-walk') || p - Math.floor(p) < 0.04) return null
    const walk = trip.legs[s.leg].walk
    return walk?.stats ? walk : null
  })

  // The prints on the map: on reaching a place (its '-here' step, or a hike's
  // '-walked' step) they all drop at once, stay while you scroll, and all
  // lift away together before the next card arrives (the user's preference).
  const prints = $derived.by(() => {
    if (phoneDeck) return phonePrints()
    if (!overMap || (wideLayout !== 'scatter' && wideLayout !== 'deck')) return null
    const i = Math.floor(p)
    const s = steps[i]
    if (!s || !s.centre) return null
    const leg = trip.legs[s.leg]
    const walked = s.key.endsWith('-walked')
    const list = walked ? leg.walk?.photos ?? [] : leg.photos
    if (!list.length) return null
    const first = plateStart[s.leg] + (walked ? leg.photos.length : 0)
    const place = walked ? leg.walk.name : `${leg.name}${leg.zh ? ' ' + leg.zh : ''}`
    const t = p - i
    if (t < 0.04 || t > 0.72) return null
    return {
      key: s.key,
      list: list.map((photo, k) => ({ photo, number: first + k, place })),
      shown: list.length,
      start: Math.max(list.findIndex((photo) => photo.favorite), 0),
    }
  })

  // While no deck is up, the next place's first photos load quietly in the
  // background (at the size its deck will ask for), so they're there when
  // it lands: during the route drawing, and on a phone while its page is read.
  const WARM = 3
  const warm = $derived.by(() => {
    if (prints || (wideLayout !== 'deck' && !phoneDeck) || (wide && !overMap)) return []
    for (let j = Math.max(Math.floor(p), 0); j < steps.length; j++) {
      if (!steps[j].centre) continue
      // From the favourite (where the deck opens) onward.
      const all = photosAt(steps[j])
      if (!all.length) continue
      const from = Math.max(all.findIndex((pr) => pr.photo.favorite), 0)
      const list = [...all.slice(from), ...all.slice(0, from)].slice(0, WARM)
      const area = deckArea(w, h, edge, wide)
      return list.map(({ photo }) => ({ photo, sizes: printSizes(printSize(photo, area, wide).iw) }))
    }
    return []
  })

  // A place's photos (the leg's, or a hike's on its '-walked' step).
  function photosAt(s) {
    const leg = trip.legs[s.leg]
    const walked = s.key.endsWith('-walked')
    const list = walked ? leg.walk?.photos ?? [] : leg.photos
    const first = plateStart[s.leg] + (walked ? leg.photos.length : 0)
    const place = walked ? leg.walk.name : `${leg.name}${leg.zh ? ' ' + leg.zh : ''}`
    return list.map((photo, k) => ({ photo, number: first + k, place }))
  }

  // Phone deck: up while the place's room scrolls past the top of the screen.
  function phonePrints() {
    const i = Math.floor(p)
    const s = steps[i]
    const room = s?.centre && rooms[s.key]
    if (!room) return null
    const u = (sy + h * ROOM_AT - room.top) / room.height
    if (u < 0 || u >= 1) return null
    const list = photosAt(s)
    if (!list.length) return null
    return { key: s.key, list, shown: list.length, start: Math.max(list.findIndex((pr) => pr.photo.favorite), 0) }
  }

  // Moving through photos full screen moves the deck along with it, so
  // closing the viewer leaves the photo you ended on at the top of the pile.
  $effect(() => {
    if (viewer == null || !prints) return
    const k = prints.list.findIndex((pr) => pr.number === viewer + 1)
    if (k >= 0 && flips[prints.key] !== k) flips[prints.key] = k
  })

  // Phone deck: the page snaps gently back onto a deck after a small scroll
  // (the snap points are in Story's deck rooms; proximity, so a real scroll
  // still carries on past).
  $effect(() => {
    document.documentElement.classList.toggle('deck-snap', phoneDeck)
  })

  // Step positions in the document, measured from their marker elements.
  let marks = []
  // Phone deck: each place's room (document top and height, by step key),
  // and how far through its step the camera holds still for it.
  let rooms = $state({})
  let holds = $state([])
  let sy = $state(0)
  function measure() {
    const y = window.scrollY
    marks = steps.map((s) => {
      const el = document.querySelector(`[data-step="${s.key}"]`)
      return el ? el.getBoundingClientRect().top + y : 0
    })
    marks[0] = 0
    const found = {}
    for (const el of document.querySelectorAll('[data-deck]')) {
      const r = el.getBoundingClientRect()
      found[el.dataset.deck] = { top: r.top + y, height: r.height }
    }
    rooms = found
    // The deck lifts once the room's foot reaches ROOM_AT; the camera moves on after.
    holds = steps.map((s, i) => {
      const r = found[s.key]
      if (!r || marks[i + 1] == null) return 0
      const end = r.top + r.height - h * ROOM_AT + line
      return Math.min(Math.max((end - marks[i]) / (marks[i + 1] - marks[i]), 0), 0.9)
    })
    onScroll()
  }

  function onScroll() {
    sy = window.scrollY
    const at = window.scrollY + line
    let i = 0
    while (i < marks.length - 1 && marks[i + 1] <= at) i++
    const next = marks[i + 1]
    p = next == null ? i : i + Math.min(Math.max((at - marks[i]) / (next - marks[i]), 0), 1)
    // The first step runs from the top of the page to the first route.
    if (i === 0) p = Math.min(Math.max(window.scrollY / Math.max(next - line, 1), 0), 1)
  }

  // Jump to a stop: scroll so its first step has just begun. Each stop has
  // its own link (#jiufen, #mianyue-line) to share or bookmark.
  function jump(stop) {
    const leg = trip.legs[stop.leg]
    const keys = stop.walk ? [`${leg.id}-walk`] : [`${leg.id}-travel`, `${leg.id}-here`]
    const el = keys.map((k) => document.querySelector(`[data-step="${k}"]`)).find(Boolean)
    if (!el) return
    scrollTo({ top: el.getBoundingClientRect().top + scrollY - line + 4, behavior: 'instant' })
    history.replaceState(null, '', `#${stop.id}`)
  }

  function stopFromHash() {
    const id = decodeURIComponent(location.hash.slice(1))
    if (!id) return null
    const i = trip.legs.findIndex((l) => l.id === id)
    if (i >= 0) return { leg: i, id }
    const w = trip.legs.findIndex((l) => l.walk && (l.walk.folder ?? `${l.id}-walk`) === id)
    return w >= 0 ? { leg: w, id, walk: true } : null
  }

  // As you scroll, the address follows the place you're at, so it can be shared.
  let lastHash = ''
  $effect(() => {
    const s = steps[Math.floor(p)]
    if (!s || typeof history === 'undefined') return
    // The stop a step belongs to is in its key ('jiufen-travel' → jiufen), so a
    // route that's still drawing already counts as the place it heads for.
    const legId = s.key.replace(/-(travel|travelled|here|walk|walked|return|returned)$/, '')
    const leg = trip.legs.find((l) => l.id === legId)
    if (!leg) return
    const id = /-walke?d?$/.test(s.key) ? leg.walk.folder : leg.id
    if (id === lastHash) return
    lastHash = id
    history.replaceState(null, '', `${location.pathname}${location.search}#${id}`)
  })

  onMount(() => {
    const resize = () => {
      w = window.innerWidth
      h = window.innerHeight
      requestAnimationFrame(measure)
    }
    let ticking = false
    const scroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        ticking = false
        onScroll()
      })
    }
    const ro = new ResizeObserver(() => measure())
    ro.observe(document.body)
    window.addEventListener('resize', resize)
    window.addEventListener('scroll', scroll, { passive: true })
    measure()
    // Opened from a stop's link: go there once the page has laid out.
    const start = stopFromHash()
    if (start) requestAnimationFrame(() => requestAnimationFrame(() => jump(start)))
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', resize)
      window.removeEventListener('scroll', scroll)
    }
  })
</script>

<SheetMap {trip} {route} {story} {focus} {layout} />

{#if trailStats}
  <TrailStats stats={trailStats.stats} name={trailStats.name} {wide} />
{/if}

<!-- Where we are on the sheet; tap it for the list of stops. -->
<Stops {trip} {story} {here} shown={p > 0.6} {jump} />

{#if overMap}
  <!-- Over-map layout: the map fills the page, photos float over it. -->
  <main>
    <section class="intro" aria-label="About this map">
      <TitleBlock {trip} />
    </section>
    {#each trip.legs as leg, i}
      <Leg {leg} plates={plateStart[i]} layout={wideLayout} open={(n) => (viewer = n - 1)} />
    {/each}
    <Closing {trip} />
  </main>
  {#if prints}
    {#key prints.key}
      {#if wideLayout === 'deck'}
        <Deck prints={prints.list} at={flips[prints.key] ?? prints.start} flip={(k) => flipTo(prints.key, k)} {w} {h} {edge} {wide} active={viewer == null} hint={deckHint} open={(n) => (viewer = n - 1)} />
      {:else}
      <Scatter prints={prints.list} shown={prints.shown} {w} {h} {edge} seed={prints.key} {hint} open={(n) => (viewer = n - 1)} />
      {/if}
    {/key}
  {/if}
{:else}
  <!-- Map moments alternate with paper pages of photos. -->
  <Story {trip} {plates} {plateStart} {hint} film={!wide && phoneLayout === 'prints'} deck={phoneDeck} open={(n) => (viewer = n - 1)} />
  {#if prints}
    {#key prints.key}
      <Deck prints={prints.list} at={flips[prints.key] ?? prints.start} flip={(k) => flipTo(prints.key, k)} {w} {h} {edge} {wide} active={viewer == null} hint={deckHint} open={(n) => (viewer = n - 1)} />
    {/key}
  {/if}
{/if}

<Viewer {plates} bind:index={viewer} />

{#if warm.length}
  <div class="warm" aria-hidden="true">
    {#each warm as { photo, sizes } (photo.src)}
      <img src={photo.src} srcset={photo.srcset} {sizes} alt="" fetchpriority="low" />
    {/each}
  </div>
{/if}

<style>
  /* Off-screen, but still fetched: the next place's photos warming up. */
  .warm {
    position: fixed;
    left: 0;
    top: 0;
    width: 1px;
    height: 1px;
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
  }

  .warm img {
    width: 1px;
    height: 1px;
  }

  main {
    position: relative;
    padding: 0 calc(var(--edge) + 48px);
  }

  /* The title block sits at the foot of the first screen, over the sea. */
  .intro {
    min-height: 100svh;
    display: flex;
    align-items: flex-end;
    padding-bottom: calc(var(--edge) + 2.5rem);
  }

</style>
