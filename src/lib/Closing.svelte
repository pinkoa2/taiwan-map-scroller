<script>
  // The end of the sheet (wide screens): the whole route back in view, and
  // the sources the map was drawn from.
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
    <details class="sources">
      <summary class="lettering">Sources</summary>
      <p>
        Map outline from the AWS Terrain Tiles. Routes, cities and the trail ©
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors; road
        routes by OSRM.
      </p>
    </details>
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

  .sources {
    font-size: 0.85rem;
    color: var(--ink-soft);
  }

  summary {
    cursor: pointer;
    font-size: 0.8rem;
    list-style: none;
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  /* A drawn chevron in place of the browser's triangle. */
  summary::before {
    content: '';
    width: 6px;
    height: 6px;
    border-right: 1.5px solid currentColor;
    border-bottom: 1.5px solid currentColor;
    transform: rotate(-45deg);
    transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  details[open] summary::before {
    transform: rotate(45deg);
  }
</style>
