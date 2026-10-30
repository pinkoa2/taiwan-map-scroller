<script>
  // One stop on the trip (wide screens). The empty .mark elements are the
  // story's steps: as each crosses the reading line, the map inks the route
  // or moves. Photos are tipped onto the map at both screen edges.
  import Plate from './Plate.svelte'
  import Symbol from './Symbol.svelte'
  import LanternString from './LanternString.svelte'
  import { howWeGotThere } from './modes.js'

  // layout 'scatter': the photos are drawn by Scatter over the map; this leg
  // only gives them room to drop in as you scroll. 'over-map': two columns.
  let { leg, plates, open, layout = 'over-map' } = $props()
  // Room to linger over the prints: a little more for a bigger pile. The
  // deck is flipped by hand, so it needs only a fixed stretch to scroll past.
  const room = (n) => (layout === 'deck' ? '110svh' : `${Math.min(n, 12) * 7 + 70}svh`)

  let platesEl = $state()
  const paragraphs = leg.text.split(/\n\s*\n/).filter(Boolean)
  const placeName = `${leg.name}${leg.zh ? ' ' + leg.zh : ''}`
  const sizes = '(min-width: 900px) 34vw, 100vw'
</script>

<article class="leg" id={leg.id} aria-labelledby="{leg.id}-name">
  {#if leg.segments.length}
    <div class="mark" data-step="{leg.id}-travel"></div>
    <!-- The card comes up from the foot of the screen only once the route
         sets off, not while we're still at the last place. -->
    <div class="lead"></div>
  {/if}

  <section class="inset card">
    <h2 id="{leg.id}-name">
      <span class="name">{leg.name}</span>
      {#if leg.zh}<span class="zh" lang="zh-Hant">{leg.zh}</span>{/if}
    </h2>

    {#if leg.segments.length}
      <p class="how lettering">
        <span class="symbols">
          {#each leg.segments as s}<Symbol mode={s.mode} width={34} />{/each}
        </span>
        <span>{howWeGotThere(leg.segments)} from {leg.from}</span>
      </p>
    {:else if leg.arrive}
      <p class="how lettering"><span>{leg.arrive}</span></p>
    {/if}
    {#if leg.when || leg.stay}
      <p class="stay lettering">
        {#if leg.when}<span>{leg.when}</span>{/if}
        {#if leg.stay}<span>{leg.stay}</span>{/if}
      </p>
    {/if}

    {#each paragraphs as p}<p class="text">{p}</p>{/each}

    <a class="lettering maps" href={leg.gmaps} target="_blank" rel="noopener">Open in Google Maps</a>
  </section>

  {#if leg.segments.length}
    <div class="pause"></div>
    <div class="mark" data-step="{leg.id}-travelled"></div>
  {/if}
  <div class="pause short"></div>
  <div class="mark" data-step="{leg.id}-here"></div>

  {#if leg.photos.length && leg.hang === 'lanterns'}
    <!-- One string of photos, alternating sides, so the cords can run between them. -->
    <div class="plates hung" bind:this={platesEl}>
      {#if platesEl}<LanternString container={platesEl} />{/if}
      {#each leg.photos as photo, i}
        <Plate {photo} number={plates + i} place={placeName} {sizes} onopen={() => open(plates + i)} />
      {/each}
    </div>
  {:else if leg.photos.length && (layout === 'scatter' || layout === 'deck')}
    <div class="room" style:height={room(leg.photos.length)}></div>
  {:else if leg.photos.length}
    {@render columns(leg.photos, plates, placeName)}
  {/if}

  {#if leg.walk}
    {@const walk = leg.walk}
    <div class="pause"></div>
    <div class="mark" data-step="{leg.id}-walk"></div>
    <section class="inset card walk" aria-labelledby="{leg.id}-walk">
      <h3 id="{leg.id}-walk">
        <span class="name">{walk.name}</span>
        {#if walk.zh}<span class="zh" lang="zh-Hant">{walk.zh}</span>{/if}
      </h3>
      <dl class="stats lettering">
        {#if walk.miles}<div><dt>Distance</dt><dd>{walk.miles} miles</dd></div>{/if}
        {#if walk.hours}<div><dt>Time</dt><dd>{walk.hours} hours</dd></div>{/if}
      </dl>
      {#if walk.text}
        <blockquote>
          <p>{walk.text}</p>
          {#if walk.by}<footer class="lettering">{walk.by}</footer>{/if}
        </blockquote>
      {/if}
    </section>
    <div class="pause long"></div>
    <div class="mark" data-step="{leg.id}-walked"></div>
    <div class="pause short"></div>
    {#if layout === 'scatter' || layout === 'deck'}
      <div class="room" style:height={room(walk.photos.length)}></div>
    {:else}
      {@render columns(walk.photos, plates + leg.photos.length, walk.name)}
    {/if}
  {/if}
  {#if leg.returns}
    <!-- Back to where we were staying: the route draws over open map. -->
    <div class="pause"></div>
    <div class="mark" data-step="{leg.id}-return"></div>
    <div class="pause long"></div>
    <div class="mark" data-step="{leg.id}-returned"></div>
  {/if}
  <div class="pause"></div>
</article>

<!-- Photos down both edges of the screen at once: odd ones on the left,
     even ones on the right, the right column starting a little lower. -->
{#snippet columns(list, first, place)}
  <div class="columns">
    {#each [0, 1] as side}
      <div class="column" class:right={side === 1}>
        {#each list as photo, i}
          {#if i % 2 === side}
            <Plate {photo} number={first + i} {place} {sizes} onopen={() => open(first + i)} />
          {/if}
        {/each}
      </div>
    {/each}
  </div>
{/snippet}

<style>
  .leg {
    position: relative;
  }

  .mark {
    height: 0;
  }

  .pause {
    height: 34svh;
  }

  .pause.short {
    height: 18svh;
  }

  .pause.long {
    height: 60svh;
  }

  /* Just under the screen's foot as the route sets off (the reading line
     is at 55% of the screen). */
  .lead {
    height: 46svh;
  }

  .card {
    position: relative;
    width: var(--column);
    padding: 1.1rem 1.4rem 1.2rem;
  }

  h2,
  h3 {
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
    font-size: clamp(2.6rem, 5vw, 3.5rem);
  }

  h2 .zh,
  h3 .zh {
    font-size: 1.6rem;
    color: var(--route-deep);
  }

  .how {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem 0.7rem;
    margin: 0.8rem 0 0.2rem;
    font-size: 0.9rem;
    letter-spacing: 0.08em;
  }

  .symbols {
    display: inline-flex;
    gap: 4px;
  }

  .stay {
    display: flex;
    gap: 1rem;
    margin: 0.15rem 0 0;
    font-size: 0.82rem;
    color: var(--ink-faint);
  }

  .text {
    margin: 0.7rem 0 0;
    max-width: 62ch;
  }

  .maps {
    display: inline-block;
    margin-top: 0.9rem;
    font-size: 0.8rem;
  }

  /* Photos tipped onto the map at both edges, leaving the middle of the
     sheet clear for the place they show. */
  .plates {
    position: relative;
    display: grid;
    margin-top: 1rem;
  }

  .plates > :global(figure) {
    width: min(560px, 34vw);
    margin-bottom: 12svh;
  }

  .plates > :global(figure:nth-of-type(even)) {
    justify-self: end;
  }

  .columns {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-top: 1rem;
  }

  .column {
    width: min(560px, 34vw);
    display: grid;
    gap: 5svh;
  }

  .column.right {
    margin-top: 28svh;
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(2, auto);
    justify-content: start;
    gap: 0 2rem;
    margin: 1rem 0 0;
  }

  .stats dt {
    font-size: 0.72rem;
    color: var(--ink-faint);
  }

  .stats dd {
    margin: 0;
    font-size: 1.4rem;
    font-weight: 600;
  }

  blockquote {
    margin: 1.1rem 0 0;
    padding: 0.9rem 0 0;
    border-top: 1px solid var(--rule);
  }

  blockquote p {
    margin: 0;
    font-size: 1.2rem;
    line-height: 1.45;
    font-style: italic;
  }

  blockquote footer {
    margin-top: 0.5rem;
    font-size: 0.85rem;
    color: var(--route-deep);
  }

  blockquote footer::before {
    content: '— ';
  }
</style>
