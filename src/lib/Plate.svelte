<script>
  // A photograph tipped onto the sheet as a numbered plate, with
  // registration marks at its corners. Opens full screen.
  let { photo, number, place, sizes = '(min-width: 900px) 440px, 100vw', wide = false, tile = false, onopen } = $props()

  let loaded = $state(false)
</script>

<figure class="plate" class:wide class:tile>
  <button class="frame" onclick={onopen} aria-label={photo.video ? `Play video` : `Open photo full screen`}>
    <span class="tick tl"></span><span class="tick tr"></span><span class="tick bl"></span><span class="tick br"></span>
    <img
      src={photo.src}
      srcset={photo.srcset}
      {sizes}
      width={photo.w}
      height={photo.h}
      alt={photo.alt}
      loading="lazy"
      decoding="async"
      class:loaded
      onload={() => (loaded = true)}
      style:background-image="url({photo.placeholder})"
    />
    {#if photo.video}
      <span class="play" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22"><path d="M8 5.5v13l11-6.5z" /></svg>
      </span>
    {/if}
  </button>
  {#if !tile || photo.caption}
  <figcaption>
    <span class="text">
      {#if photo.caption}{photo.caption}{:else}<span class="lettering">{place}</span>{/if}
    </span>
    {#if photo.video}<span class="lettering kind">Video</span>{/if}
  </figcaption>
  {/if}
</figure>

<style>
  .plate {
    margin: 0;
  }

  .frame {
    position: relative;
    display: block;
    width: 100%;
    padding: 8px;
    border: 0;
    background: var(--paper);
    cursor: pointer;
    box-shadow:
      0 0 0 1px var(--rule),
      0 22px 40px -22px rgb(40 36 20 / 0.55);
    transition: box-shadow 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .frame:hover {
    box-shadow:
      0 0 0 1px var(--rule),
      0 28px 48px -20px rgb(40 36 20 / 0.6);
  }

  img {
    width: 100%;
    height: auto;
    background-size: cover;
    background-position: center;
    filter: saturate(0.92);
  }

  /* The blurred placeholder shows until the photo arrives. */
  img:not(.loaded) {
    color: transparent;
  }

  .wide .frame {
    padding: 10px;
  }

  .wide img {
    max-height: 84svh;
    object-fit: cover;
  }

  /* A mosaic tile: the photo fills its cell, cropped, with a slim mount. */
  .tile {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .tile .frame {
    flex: 1;
    min-height: 0;
    padding: 4px;
    box-shadow:
      0 0 0 1px var(--rule),
      0 12px 22px -16px rgb(40 36 20 / 0.55);
  }

  .tile img {
    height: 100%;
    object-fit: cover;
  }

  .tile .tick {
    display: none;
  }

  .tile figcaption {
    margin-top: 0.4rem;
    font-size: 0.85rem;
  }

  .tick {
    position: absolute;
    width: 14px;
    height: 14px;
    pointer-events: none;
  }

  .tick::before,
  .tick::after {
    content: '';
    position: absolute;
    background: var(--ink);
  }

  .tick::before {
    width: 14px;
    height: 1px;
    top: 7px;
  }

  .tick::after {
    width: 1px;
    height: 14px;
    left: 7px;
  }

  .tl {
    top: -11px;
    left: -11px;
  }
  .tr {
    top: -11px;
    right: -11px;
  }
  .bl {
    bottom: -11px;
    left: -11px;
  }
  .br {
    bottom: -11px;
    right: -11px;
  }

  figcaption {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.2rem 0.75rem;
    margin-top: 0.85rem;
    padding: 0.35rem 0.6rem;
    background: var(--paper);
    border: 1px solid var(--rule);
    font-size: 0.95rem;
    line-height: 1.35;
  }


  .text .lettering {
    font-size: 0.85rem;
  }

  .play {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 56px;
    height: 56px;
    margin: -28px 0 0 -28px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: rgb(251 251 247 / 0.92);
    box-shadow: 0 6px 18px -6px rgb(40 36 20 / 0.6);
    color: var(--route-deep);
    transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .play svg {
    fill: currentColor;
    margin-left: 3px;
  }

  .frame:hover .play {
    transform: scale(1.08);
  }

  .kind {
    margin-left: auto;
    font-size: 0.72rem;
    color: var(--ink-faint);
  }
</style>
