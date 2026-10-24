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
    {:else if here}
      <span class="n">{String(story.leg + 1).padStart(2, '0')}<span class="of">/{trip.legs.length}</span></span>
      <span class="place wide-only">{here.name}</span>
      {#if here.zh}<span class="zh wide-only">{here.zh}</span>{/if}
    {:else}
      <span class="place wide-only">{trip.title}</span><span class="place narrow-only">Stops</span>
    {/if}
    <svg class="chev" class:up={open} viewBox="0 0 12 8" width="12" height="8" aria-hidden="true"><path d="M1 1.5l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.5" /></svg>
  </button>

  {#if open}
    <ol id="stop-list" class="list">
      {#each stops as stop}
        <li class:walk={stop.walk} class:current={!stop.walk && stop.leg === story.leg}>
          <button onclick={() => choose(stop)}>
            <span class="lettering n">{stop.n ? String(stop.n).padStart(2, '0') : '↳'}</span>
            <span class="lettering name">{stop.name}</span>
            {#if stop.zh}<span class="zh">{stop.zh}</span>{/if}
            {#if stop.when}<span class="lettering when">{stop.when}</span>{/if}
          </button>
        </li>
      {/each}
    </ol>
  {/if}
</nav>

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
