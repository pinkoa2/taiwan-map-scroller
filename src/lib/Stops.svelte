<script>
  // The place badge in the corner: where we are on the trip. Tapping it opens
  // the list of stops, and choosing one jumps straight there.
  let { trip, story, here, shown, jump } = $props()

  let open = $state(false)
  let panel = $state()

  // Every stop, with the hike listed under the place it set out from.
  const stops = trip.legs.flatMap((l, i) => [
    { id: l.id, n: i + 1, name: l.name, zh: l.zh, when: l.when, leg: i },
    ...(l.walk ? [{ id: l.walk.folder ?? `${l.id}-walk`, n: null, name: l.walk.name, zh: l.walk.zh, when: l.walk.when, leg: i, walk: true }] : []),
  ])

  // On the title card: before the plane has landed, and not yet at the close.
  const atStart = $derived(story.leg < 0)

  function choose(stop) {
    open = false
    jump(stop)
  }

  function onkey(e) {
    if (e.key === 'Escape') open = false
  }

  // Close when tapping anywhere outside the list.
  function outside(e) {
    if (open && panel && !panel.contains(e.target)) open = false
  }
</script>

<svelte:window onkeydown={onkey} onpointerdown={outside} />

<nav class="stops" class:shown={shown || open} bind:this={panel} aria-label="Stops on the trip">
  <button class="where lettering" onclick={() => (open = !open)} aria-expanded={open} aria-controls="stop-list" aria-label="Stops on the trip">
    {#if story.end}
      <span class="place wide-only">{trip.title}</span>{#if trip.titleZh}<span class="zh wide-only">{trip.titleZh}</span>{/if}<span class="place narrow-only">Stops</span>
    {:else if story.travel != null && here}
      {@const to = trip.legs[story.travel]}
      <span class="n">{String(story.travel + 1).padStart(2, '0')}<span class="of">/{trip.legs.length}</span></span>
      <span class="place faint wide-only">{to.from}</span>
      <svg class="wide-only" viewBox="0 0 18 10" width="18" height="10" aria-hidden="true"><path d="M1 5h15M12 1l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.4" /></svg>
      <span class="place wide-only">{to.name}</span>
      {#if to.zh}<span class="zh wide-only">{to.zh}</span>{/if}
    {:else if story.back}
      {@const from = trip.legs[story.back[0]]}
      {@const to = trip.legs[story.back[1]] ?? { name: story.back[2] }}
      <span class="n">{String(story.back[0] + 1).padStart(2, '0')}<span class="of">/{trip.legs.length}</span></span>
      <span class="place faint wide-only">{from.name}</span>
      <svg class="wide-only" viewBox="0 0 18 10" width="18" height="10" aria-hidden="true"><path d="M1 5h15M12 1l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.4" /></svg>
      <span class="place wide-only">{to.name}</span>
      {#if to.zh}<span class="zh wide-only">{to.zh}</span>{/if}
    {:else if here}
      <span class="n">{String(story.at + 1).padStart(2, '0')}<span class="of">/{trip.legs.length}</span></span>
      <span class="place wide-only">{here.name}</span>
      {#if here.zh}<span class="zh wide-only">{here.zh}</span>{/if}
    {:else}
      <span class="place wide-only">{trip.title}</span><span class="place narrow-only">Stops</span>
    {/if}
    <svg class="chev" class:up={open} viewBox="0 0 12 8" width="12" height="8" aria-hidden="true"><path d="M1 1.5l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.5" /></svg>
  </button>

  {#if open}
    <ol id="stop-list" class="list" data-own-scroll>
      <li class="edge" class:current={atStart}>
        {@render edgeRow('start', 'Back to the start', atStart)}
      </li>
      {#each stops as stop}
        <li class:walk={stop.walk} class:current={!stop.walk && stop.leg === story.at}>
          <button onclick={() => choose(stop)}>
            <span class="lettering n">{stop.n ? String(stop.n).padStart(2, '0') : '↳'}</span>
            <span class="lettering name">{stop.name}</span>
            {#if stop.zh}<span class="zh">{stop.zh}</span>{/if}
            {#if stop.when}<span class="lettering when">{stop.when}</span>{/if}
          </button>
        </li>
      {/each}
      <li class="edge end" class:current={story.end}>
        {@render edgeRow('end', 'To the end', story.end)}
      </li>
      {#if trip.album}
        <li class="album">
          <a href={trip.album} target="_blank" rel="noopener">
            <span class="lettering name">All the photos</span>
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" /></svg>
          </a>
        </li>
      {/if}
    </ol>
  {/if}
</nav>

<!-- The first and last rows: the title card, or the closing map. The arrow
     sits in the number column, against a rule (to the top, to the foot). -->
{#snippet edgeRow(edge, label, here)}
  <button onclick={() => choose({ edge })} aria-current={here ? 'location' : undefined}>
    <svg class="n" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      {#if edge === 'start'}<path d="M3 2.5h10M8 14V6M4.5 9.5 8 6l3.5 3.5" />{:else}<path d="M3 13.5h10M8 2v8M4.5 6.5 8 10l3.5-3.5" />{/if}
    </svg>
    <span class="lettering name">{label}</span>
    <span></span>
    <span class="lettering when">{edge === 'start' ? 'Taiwan' : 'The whole route'}</span>
  </button>
{/snippet}

<style>
  .stops {
    position: fixed;
    z-index: 5;
    top: calc(var(--edge) + 14px);
    right: calc(var(--edge) + 14px);
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    opacity: 0;
    transform: translateY(-6px);
    transition:
      opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1),
      transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
    pointer-events: none;
  }

  .stops.shown {
    opacity: 1;
    transform: none;
    pointer-events: auto;
  }

  .where {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
    padding: 0.35rem 0.75rem 0.4rem;
    background: var(--paper);
    border: 1px solid var(--rule);
    font-size: 1rem;
    cursor: pointer;
    transition: background 0.2s;
  }

  .where:hover {
    background: #fff;
  }

  .n {
    font-weight: 600;
    color: var(--route-deep);
  }

  .of {
    color: var(--ink-faint);
    font-weight: 500;
  }

  .place {
    font-weight: 600;
    letter-spacing: 0.1em;
  }

  .faint {
    color: var(--ink-faint);
  }

  .where svg {
    align-self: center;
    color: var(--route-deep);
  }

  .chev {
    margin-left: 0.1rem;
    transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .chev.up {
    transform: rotate(180deg);
  }

  .narrow-only {
    display: none;
  }

  @media (max-width: 899px) {
    .narrow-only {
      display: inline;
    }
  }

  .zh {
    font-family: var(--font-zh);
    font-weight: 600;
    letter-spacing: 0.04em;
    font-size: 0.95rem;
  }

  /* The list: an inset on the sheet, one ruled line per stop. */
  .list {
    list-style: none;
    margin: 6px 0 0;
    padding: 0.3rem 0;
    min-width: 20rem;
    max-height: min(70svh, 34rem);
    overflow-y: auto;
    /* Its own scroll (glide.js leaves it alone), never handed on to the page. */
    overscroll-behavior: contain;
    background: var(--paper);
    border: 1px solid var(--rule);
    box-shadow: 0 18px 36px -18px rgb(40 36 20 / 0.5);
    animation: open 0.28s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes open {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
  }

  .list button {
    display: grid;
    grid-template-columns: 2rem auto 1fr auto;
    align-items: baseline;
    gap: 0.5rem;
    width: 100%;
    padding: 0.5rem 0.9rem;
    border: 0;
    border-top: 1px solid rgb(29 31 26 / 0.12);
    background: none;
    text-align: left;
    cursor: pointer;
  }

  .list li:first-child button {
    border-top: 0;
  }

  .list button:hover {
    background: rgb(226 64 28 / 0.07);
  }

  .list .name {
    font-weight: 600;
    letter-spacing: 0.08em;
    font-size: 0.95rem;
  }

  .list .zh {
    font-size: 0.85rem;
    color: var(--route-deep);
  }

  .list .when {
    font-size: 0.75rem;
    color: var(--ink-faint);
    white-space: nowrap;
  }

  .list .walk .name {
    font-weight: 500;
  }

  .list .current {
    background: rgb(226 64 28 / 0.1);
  }

  .list .current .n {
    color: var(--route);
  }

  /* Back to the start and on to the end: quieter than the stops, ruled off
     from them like the album line. */
  .list .edge .name {
    font-weight: 500;
    color: var(--route-deep);
  }

  .list .edge svg {
    align-self: center;
    fill: none;
    stroke: var(--route-deep);
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .list .edge:first-child {
    border-bottom: 1px solid var(--rule);
    margin-bottom: 0.3rem;
  }

  .list .edge.end {
    border-top: 1px solid var(--rule);
    margin-top: 0.3rem;
  }

  .list .edge.end button,
  .list .edge:first-child + li button {
    border-top: 0;
  }

  .list .edge.end + .album a {
    margin-top: 0;
  }

  /* The way out to the full album, under the stops. */
  .list .album a {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.3rem;
    padding: 0.6rem 0.9rem 0.45rem 3.4rem;
    border-top: 1px solid var(--rule);
    color: var(--route-deep);
    text-decoration: none;
  }

  .list .album a:hover {
    background: rgb(226 64 28 / 0.07);
  }

  .list .album svg {
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  @media (max-width: 899px) {
    .stops {
      right: 12px;
      top: calc(12px + env(safe-area-inset-top));
    }

    /* On a phone the badge is just the stop number: the page heading says
       where we are, and the badge would cover it. */
    .where {
      font-size: 0.9rem;
      gap: 0.4rem;
    }

    .wide-only {
      display: none;
    }

    .list {
      min-width: 0;
      width: calc(100vw - 24px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .list {
      animation: none;
    }
  }
</style>
