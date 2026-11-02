<script>
  // The end of the sheet (wide screens): the whole route back in view, and
  // the link to the full album and the map's credit (OpenStreetMap's licence
  // asks for one).
  import Album from './Album.svelte'

  let { trip } = $props()
</script>

<footer class="closing">
  <div class="mark" data-step="end"></div>
  <div class="block inset">
    <h2>
      <span class="name">{trip.title}</span>
      {#if trip.titleZh}<span class="zh" lang="zh-Hant">{trip.titleZh}</span>{/if}
    </h2>
    {#if trip.continues}<p class="continues">{trip.continues}</p>{/if}
    {#if trip.album}<p class="album"><Album href={trip.album} /></p>{/if}
    <p class="sources">Map © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a></p>
  </div>
</footer>

<style>
  .closing {
    min-height: 100svh;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    padding-bottom: calc(var(--edge) + 4.5rem);
  }

  /* A long stretch so the finished map has room to breathe. */
  .mark {
    height: 0;
    margin-bottom: 60svh;
  }

  .block {
    width: min(100%, 25rem);
    padding: 1.3rem 1.5rem 1.2rem;
  }

  /* Mirrors the title card: the same island, now with the whole route. */
  h2 {
    margin: 0;
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0.1em 0.35em;
    line-height: 0.88;
  }

  .name {
    font-family: var(--font-label);
    font-weight: 600;
    font-size: clamp(3rem, 7vw, 4.4rem);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  h2 .zh {
    font-size: clamp(1.6rem, 3.4vw, 2.2rem);
    color: var(--route-deep);
  }

  .continues {
    margin: 0.8rem 0 1rem;
    font-size: 1.05rem;
    font-style: italic;
    color: var(--ink-soft);
  }

  .album {
    margin: 0 0 1.1rem;
  }

  .sources {
    margin: 0;
    font-size: 0.72rem;
    color: var(--ink-faint);
  }

  .sources a {
    color: inherit;
  }
  /* A phone on its side: a smaller card, so the island has the room. */
  @media (orientation: landscape) and (max-height: 539px) and (min-width: 640px) {
    .closing {
      padding-bottom: calc(var(--edge) + 2rem);
    }

    .block {
      width: min(100%, 20rem);
      padding: 0.9rem 1.1rem 0.8rem;
    }

    .name {
      font-size: 2.6rem;
    }

    h2 .zh {
      font-size: 1.5rem;
    }

    .album {
      margin: 0.8rem 0 0.7rem;
    }
  }
</style>
