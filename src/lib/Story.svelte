<script>
  // The story in turns (phones, and wide screens with photoLayout 'mosaic'):
  // a stretch of open map where scrolling draws the route (a caption names
  // the leg), then a paper page with the place's words and a mosaic of its
  // photos slides up over the map, then the map returns for the next leg.
  // The empty .mark elements are the story's steps.
  import Plate from './Plate.svelte'
  import PrintStack from './PrintStack.svelte'
  import Symbol from './Symbol.svelte'
  import LanternString from './LanternString.svelte'
  import Onward from './Onward.svelte'
  import { howWeGotThere } from './modes.js'

  // film: photos as a stack of prints after each page (phones) instead of a mosaic in it.
  // deck: after each page, open map where a deck of prints (Deck.svelte, drawn
  // by App) flips as you scroll; this only leaves the room for it.
  // onward(): glide on to the next stop; nextAfter(step key) names it.
  // step: the key of the step the map is on.
  let { trip, plates, plateStart, open, film = false, deck = false, hint = false, onward, back, nextAfter, step = '' } = $props()
  // A stretch to scroll past the deck (it's flipped by hand), then one for it
  // to lift and the map to move on before the next route. The room is long
  // enough that a stray scroll mid-swipe doesn't carry the deck away, and a
  // snap point inside it settles the page back onto the deck after a small one.
  const room = () => '140svh'
  // The "tap a photo" hint goes on the first place that has photos.
  const firstWithPhotos = trip.legs.findIndex((l) => l.photos.length)

  const zhName = (l) => `${l.name}${l.zh ? ' ' + l.zh : ''}`
  // A page's ↓: on to its photos, or (none picked yet) the next stop.
  const ahead = (list, key) => {
    if (list.length) return { label: `${list.length} photo${list.length === 1 ? '' : 's'}` }
    const next = nextAfter(key)
    return next ? { label: next.name, zh: next.zh } : null
  }
  let pageEls = $state({})
</script>

<!-- Opening: the whole island, with the title card at the foot of the screen. -->
<section class="map-run intro">
  <div class="mark" data-step="intro"></div>
  <div class="caption title inset">
    <h1>
      <span class="name">{trip.title}</span>
      {#if trip.titleZh}<span class="zh" lang="zh-Hant">{trip.titleZh}</span>{/if}
    </h1>
    {#each trip.summary.split(/\n\s*\n/).filter(Boolean) as line}<p class="summary">{line}</p>{/each}
    <div class="cue">
      <Onward label="Follow the route" note="Tap, or just scroll" onclick={onward} />
    </div>
  </div>
</section>

{#each trip.legs as leg, i}
  <!-- Open map: the route draws, then the sheet closes in on the place. -->
  <section class="map-run" class:short={!leg.segments.length} aria-label="Route to {leg.name}">
    {#if leg.segments.length}
      <!-- No caption here: the route speaks for itself, and the place's page follows. -->
      <div class="mark" data-step="{leg.id}-travel"></div>
      <div class="gap"></div>
      <div class="gap long"></div>
      <div class="mark" data-step="{leg.id}-travelled"></div>
      <div class="gap"></div>
    {/if}
    <div class="mark" data-step="{leg.id}-here"></div>
    <div class="gap"></div>
  </section>

  <!-- Paper: the place itself, its words and photos, over the map. -->
  <!-- data-stop: the page rests here, the words on screen with the place above. -->
  <article class="page" class:night={leg.hang === 'lanterns'} aria-labelledby="m-{leg.id}" bind:this={pageEls[leg.id]} data-stop="">
    {#if leg.hang === 'lanterns' && pageEls[leg.id]}<LanternString container={pageEls[leg.id]} mode="backdrop" />{/if}
    <h2 id="m-{leg.id}">
      <span class="name">{leg.name}</span>
      {#if leg.zh}<span class="zh" lang="zh-Hant">{leg.zh}</span>{/if}
    </h2>
    <p class="how lettering">
      {#if leg.segments.length}
        <span class="symbols">{#each leg.segments as s}<Symbol mode={s.mode} width={28} />{/each}</span>
        <span>{howWeGotThere(leg.segments)} from {leg.from}</span>
      {:else if leg.arrive}
        <span>{leg.arrive}</span>
      {/if}
    </p>
    {#if leg.when || leg.stay}
      <p class="stay lettering">{#if leg.when}<span>{leg.when}</span>{/if}{#if leg.stay}<span>{leg.stay}</span>{/if}</p>
    {/if}
    {#each leg.text.split(/\n\s*\n/).filter(Boolean) as p}<p class="text">{p}</p>{/each}
    <div class="foot">
      <a class="lettering maps" href={leg.gmaps} target="_blank" rel="noopener">Open in Google Maps</a>
      {#if deck && ahead(leg.photos, `${leg.id}-here`)}<Onward {...ahead(leg.photos, `${leg.id}-here`)} onclick={onward} onback={back} />{/if}
    </div>
    {#if leg.photos.length}
      {#if !film && !deck}{@render photoList(leg.photos, plateStart[i], zhName(leg))}{/if}
    {/if}
  </article>
  {#if deck && leg.photos.length}
    <div class="deck-room" data-deck="{leg.id}-here" style:height={room(leg.photos.length)}><span class="snap"></span></div>
    <div class="deck-tail"></div>
  {:else if film && leg.photos.length}
    <PrintStack photos={leg.photos} first={plateStart[i]} place={zhName(leg)} {open} hint={hint && i === firstWithPhotos} />
  {/if}

  {#if leg.walk}
    {@const walk = leg.walk}
    <!-- Open map again: the hike, drawn on its own close-up. -->
    <section class="map-run" aria-label="The {walk.name} hike">
      <div class="mark" data-step="{leg.id}-walk"></div>
      <!-- Only while the footsteps draw: the hike's page says the same once it's up. -->
      <div class="caption inset" class:gone={step !== `${leg.id}-walk`}>
        <p class="count lettering">On foot</p>
        <p class="to">
          <span class="lettering place">{walk.name}</span>
          {#if walk.zh}<span class="zh" lang="zh-Hant">{walk.zh}</span>{/if}
        </p>
        <p class="how lettering">
          <span class="symbols"><Symbol mode="walk" width={34} /></span>
          {#if walk.miles}<span>{walk.miles} miles</span>{/if}
        {#if walk.hours}<span>{walk.hours} hours</span>{/if}
        </p>
      </div>
      <div class="gap long"></div>
      <div class="mark" data-step="{leg.id}-walked"></div>
      <div class="gap"></div>
    </section>
    <article class="page" aria-labelledby="m-{leg.id}-walk" data-stop="">
      <h2 id="m-{leg.id}-walk">
        <span class="name">{walk.name}</span>
        {#if walk.zh}<span class="zh" lang="zh-Hant">{walk.zh}</span>{/if}
      </h2>
      <p class="how lettering">
        <span class="symbols"><Symbol mode="walk" width={34} /></span>
        <span>On foot</span>
        {#if walk.miles}<span>{walk.miles} miles</span>{/if}
        {#if walk.hours}<span>{walk.hours} hours</span>{/if}
      </p>
      {#if walk.text}
        <blockquote>
          <p>{walk.text}</p>
          {#if walk.by}<footer class="lettering">{walk.by}</footer>{/if}
        </blockquote>
      {/if}
      {#if deck && ahead(walk.photos, `${leg.id}-walked`)}
        <div class="foot"><Onward {...ahead(walk.photos, `${leg.id}-walked`)} onclick={onward} onback={back} /></div>
      {/if}
      {#if !film && !deck}{@render photoList(walk.photos, plateStart[i] + leg.photos.length, walk.name)}{/if}
    </article>
    {#if deck && walk.photos.length}
      <div class="deck-room" data-deck="{leg.id}-walked" style:height={room(walk.photos.length)}><span class="snap"></span></div>
      <div class="deck-tail"></div>
    {:else if film && walk.photos.length}
      <PrintStack photos={walk.photos} first={plateStart[i] + leg.photos.length} place={walk.name} {open} />
    {/if}
  {/if}
  {#if leg.returns}
    <!-- Back to where we were staying: the route draws over open map. -->
    <section class="map-run" aria-label="Back to {leg.returns.to}">
      <div class="mark" data-step="{leg.id}-return"></div>
      <div class="gap"></div>
      <div class="gap long"></div>
      <div class="mark" data-step="{leg.id}-returned"></div>
      <div class="gap"></div>
    </section>
  {/if}
{/each}

<!-- A place's photos: the first one large, the rest in a tight grid. -->
{#snippet photoList(list, first, place)}
  {#if list.length}
    <div class="mosaic">
      {#each list as photo, k}
        <div class="cell" class:lead={k === 0}>
          <Plate
            {photo}
            tile
            number={first + k}
            {place}
            sizes={k === 0 ? '(min-width: 900px) 1000px, 100vw' : '(min-width: 900px) 340px, 50vw'}
            onopen={() => open(first + k)}
          />
        </div>
      {/each}
    </div>
  {/if}
{/snippet}

<!-- The close: the whole route back in view. -->
<section class="map-run end">
  <div class="mark" data-step="end"></div>
  <div class="gap"></div>
  <div class="caption closing inset">
    <h2 class="closing-title">
      <span class="name">{trip.title}</span>
      {#if trip.titleZh}<span class="zh" lang="zh-Hant">{trip.titleZh}</span>{/if}
    </h2>
    {#if trip.continues}<p class="summary">{trip.continues}</p>{/if}
    <p class="sources">
      Map © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors, AWS Terrain
      Tiles.
    </p>
  </div>
</section>

<style>
  .mark {
    height: 0;
  }

  .deck-room {
    position: relative;
  }

  /* Where the page settles while the deck is up (html.deck-snap, App). */
  .snap {
    position: absolute;
    top: 40svh;
    height: 1px;
    scroll-snap-align: start;
  }

  .deck-tail {
    height: 80svh;
  }

  /* A stretch of open map: transparent, so the fixed sheet shows through. */
  .map-run {
    position: relative;
    padding: 0 12px;
  }

  .map-run.intro {
    min-height: 100svh;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    padding-bottom: calc(14px + env(safe-area-inset-bottom));
  }

  .gap {
    height: 45svh;
  }

  /* The closing map gets a long stretch with nothing over it: more than a
     full screen, so the last photos have scrolled well away before the end. */
  .end .gap {
    height: 115svh;
  }

  .closing-title .name {
    font-size: 3.2rem;
    letter-spacing: 0.04em;
  }

  .gap.long {
    height: 80svh;
  }

  .short .gap {
    height: 60svh;
  }

  /* The leg's caption rides at the foot of the screen while its route draws. */
  .caption {
    position: sticky;
    top: calc(100svh - 118px - env(safe-area-inset-bottom));
    z-index: 2;
    padding: 0.7rem 0.9rem 0.75rem;
  }

  .caption {
    transition: opacity 0.3s;
  }

  .caption.gone {
    opacity: 0;
    pointer-events: none;
  }

  .intro .caption,
  .end .caption {
    position: static;
    margin-top: 0;
  }

  .end {
    padding-bottom: calc(14px + env(safe-area-inset-bottom));
  }

  .count {
    margin: 0;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--route-deep);
  }

  .count span {
    color: var(--ink-faint);
    font-weight: 500;
  }

  .to {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.2rem 0.5rem;
    margin: 0.15rem 0 0;
  }

  .to svg {
    color: var(--route-deep);
  }

  .from {
    font-size: 1.05rem;
    color: var(--ink-faint);
  }

  .place {
    font-size: 1.5rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: var(--ink);
  }

  .to .zh {
    font-size: 1.1rem;
    color: var(--route-deep);
  }

  /* Paper over the map: the place's own page. */
  /* With prints after it, the page is just the words. */
  .page {
    position: relative;
    z-index: 1;
    background: var(--paper);
    border-top: 1px solid var(--rule);
    box-shadow:
      0 -3px 0 var(--paper),
      0 -3.6px 0 var(--rule),
      0 -18px 34px -16px rgb(40 36 20 / 0.45);
    padding: 1.6rem 16px 3.5rem;
  }

  h1,
  h2 {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0 0.4em;
    line-height: 0.95;
  }

  .name {
    font-family: var(--font-label);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    font-size: 2.6rem;
  }

  h1 .name {
    font-size: 3.2rem;
    letter-spacing: 0.04em;
  }

  h1 .zh,
  h2 .zh {
    font-size: 1.5rem;
    color: var(--route-deep);
  }

  .summary {
    margin: 0.5rem 0 0.7rem;
    font-style: italic;
    color: var(--ink-soft);
  }

  .cue {
    margin: 0.8rem 0 0;
    padding-top: 0.8rem;
    border-top: 1px solid var(--rule);
  }

  .how {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.3rem 0.6rem;
    margin: 0.5rem 0 0;
    font-size: 0.82rem;
    letter-spacing: 0.08em;
  }

  .symbols {
    display: inline-flex;
    gap: 4px;
  }

  .dist {
    margin-left: auto;
    font-weight: 600;
  }

  .stay {
    display: flex;
    gap: 1rem;
    margin: 0.15rem 0 0;
    font-size: 0.75rem;
    color: var(--ink-faint);
  }

  .text {
    margin: 0.8rem 0 0;
  }

  /* The page's foot: the map link, and the ↓ on to what's next. */
  .foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.8rem 1rem;
    margin-top: 1rem;
  }

  .maps {
    font-size: 0.78rem;
  }

  .plates {
    position: relative;
    display: grid;
    gap: 2.4rem;
    margin-top: 1.8rem;
    padding: 0 6px;
  }

  .mosaic {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 1.6rem;
  }

  .cell {
    aspect-ratio: 4 / 5;
    min-width: 0;
  }

  .cell.lead {
    grid-column: 1 / -1;
    aspect-ratio: 4 / 3;
  }

  /* Jiufen's page: the old street by night, lantern strings behind the photos. */
  .page.night {
    overflow: hidden;
    padding-top: 4.4rem;
  }

  .page > :global(:not(.lanterns)) {
    position: relative;
    z-index: 1;
  }

  blockquote {
    margin: 0.9rem 0 0;
    padding-top: 0.8rem;
    border-top: 1px solid var(--rule);
  }

  blockquote p {
    margin: 0;
    font-style: italic;
    font-size: 1.15rem;
    line-height: 1.45;
  }

  blockquote footer {
    margin-top: 0.4rem;
    font-size: 0.8rem;
    color: var(--route-deep);
  }

  blockquote footer::before {
    content: '— ';
  }

  .sources {
    margin: 0.7rem 0 0;
    font-size: 0.75rem;
    color: var(--ink-soft);
  }

  /* Wide screens: the paper page is a broad sheet with a centred column,
     the mosaic runs three across, captions sit at the sheet's foot-left. */
  @media (min-width: 900px) {
    .map-run {
      padding: 0 calc(var(--edge) + 34px);
    }

    .map-run.intro,
    .end {
      padding-bottom: calc(var(--edge) + 34px);
    }

    .caption,
    .intro .caption,
    .end .caption {
      width: min(30rem, 100%);
    }

    .caption {
      top: calc(100svh - 150px - var(--edge));
    }

    .page {
      padding: 3.2rem max(calc(var(--edge) + 34px), calc((100vw - 1080px) / 2)) 5rem;
    }

    .page > :not(.mosaic):not(:global(.lanterns)) {
      max-width: 44rem;
    }

    .name {
      font-size: 3.6rem;
    }

    h1 .name {
      font-size: 4.4rem;
    }

    .text {
      font-size: 1.1rem;
    }

    .mosaic {
      grid-template-columns: repeat(3, 1fr);
      gap: 14px;
      margin-top: 2.2rem;
    }

    .cell.lead {
      aspect-ratio: 16 / 9;
    }
  }
</style>
