<script>
  // A place's photos on a phone (photoLayout.phone 'prints'): prints stacked
  // one under another, each slightly turned, scrolling normally over the map,
  // which shows through blurred and dimmed behind them.
  import Squiggle from './Squiggle.svelte'

  // hint: the squiggly "tap a photo" note above the first print.
  let { photos, first, place, open, hint = false } = $props()

  // A gentle alternating turn, so the stack reads as prints, not a feed.
  const TURNS = [-1.6, 1.2, -0.8, 1.8, -1.3, 0.9]
</script>

<section class="stack" aria-label="{place}: photos">
  <p class="head lettering"><span>{place}</span><span class="count">{photos.length} photos</span></p>
  {#if hint}
    <div class="hint"><Squiggle text="Tap a photo to open it" toward="down" /></div>
  {/if}
  {#each photos as photo, k}
    <figure style:--turn="{TURNS[k % TURNS.length]}deg">
      <button onclick={() => open(first + k)} aria-label={photo.video ? `Play video` : `Open photo full screen`}>
        <img
          src={photo.src}
          srcset={photo.srcset}
          sizes="90vw"
          width={photo.w}
          height={photo.h}
          alt={photo.alt}
          loading="lazy"
          decoding="async"
          style:background-image="url({photo.placeholder})"
        />
        {#if photo.video}
          <span class="play" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M8 5.5v13l11-6.5z" /></svg></span>
        {/if}
      </button>
      <figcaption class="lettering">
        {#if photo.caption}<span class="caption">{photo.caption}</span>{:else}<span>{place}</span>{/if}
      </figcaption>
    </figure>
  {/each}
</section>

<style>
  /* The map behind, blurred and dimmed; the prints on top. */
  .stack {
    position: relative;
    padding: 2.2rem 22px 3.5rem;
    background: rgb(29 31 26 / 0.42);
    -webkit-backdrop-filter: blur(7px) saturate(0.8);
    backdrop-filter: blur(7px) saturate(0.8);
  }

  .head {
    display: flex;
    justify-content: space-between;
    margin: 0 0 1.6rem;
    font-size: 0.8rem;
    color: #f2f3ec;
  }

  .count {
    color: #ffb59c;
    font-weight: 600;
  }

  .hint {
    display: flex;
    justify-content: center;
    margin: -0.6rem 0 -0.4rem;
    position: relative;
    z-index: 1;
  }

  .hint :global(.note) {
    color: #f2f3ec;
    text-shadow: none;
  }

  /* A print: paper mount, a wider foot for its label, a slight turn. */
  figure {
    margin: 0 0 2rem;
    padding: 6px 6px 0;
    background: var(--paper);
    transform: rotate(var(--turn));
    box-shadow:
      0 1px 2px rgb(0 0 0 / 0.25),
      0 20px 34px -16px rgb(0 0 0 / 0.6);
  }

  button {
    position: relative;
    display: block;
    width: 100%;
    padding: 0;
    border: 0;
    background: none;
    cursor: pointer;
  }

  img {
    display: block;
    width: 100%;
    height: auto;
    max-height: 78svh;
    object-fit: cover;
    background-size: cover;
    background-position: center;
  }

  figcaption {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.8rem;
    padding: 0.5rem 0.15rem 0.6rem;
    font-size: 0.72rem;
    color: var(--ink-soft);
  }

  .caption {
    font-family: var(--font-text);
    font-style: italic;
    text-transform: none;
    letter-spacing: 0;
    font-size: 0.92rem;
    color: var(--ink);
  }


  .play {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 52px;
    height: 52px;
    margin: -26px 0 0 -26px;
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
</style>
