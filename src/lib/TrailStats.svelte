<script>
  // A hike's stats as a card pinned beside the trail while the footsteps
  // draw: the headline figures, then each mile's pace as a bar.
  // low (phones): the hike's page is up and the trail sits in a band at the
  // top, so the card moves down into the open map between them.
  let { stats, name, wide, low = false } = $props()

  const secs = (pace) => pace.split(':').reduce((a, n) => a * 60 + Number(n), 0)
  const slowest = Math.max(...(stats.splits ?? []).map((s) => secs(s[1])))
</script>

<figure class="stats" class:wide class:low>
  <p class="title lettering">{name}</p>
  <dl class="figures">
    {#each stats.figures as [label, value]}
      <div>
        <dd class="lettering">{value}</dd>
        <dt>{label}</dt>
      </div>
    {/each}
  </dl>
  {#if stats.splits?.length}
    <table class="splits">
      <caption class="lettering">Splits</caption>
      <thead class="lettering"><tr><th>Mi</th><th>Pace</th><th></th><th>Gain</th></tr></thead>
      <tbody>
        {#each stats.splits as [mile, pace, ft]}
          <tr>
            <td class="lettering mile">{mile}</td>
            <td class="lettering">{pace}</td>
            <td class="bar"><span style:width="{(secs(pace) / slowest) * 100}%"></span></td>
            <td class="lettering gain">{ft} ft</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
  {#if stats.source}<figcaption class="lettering">Recorded with {stats.source}</figcaption>{/if}
</figure>

<style>
  /* A card tipped onto the map, like the prints. */
  .stats {
    position: fixed;
    z-index: 2;
    margin: 0;
    width: 186px;
    left: 12px;
    top: calc(130px + env(safe-area-inset-top));
    padding: 0.55rem 0.65rem 0.45rem;
    background: var(--paper);
    transform: rotate(-2deg);
    box-shadow:
      0 0 0 1px rgb(29 31 26 / 0.12),
      0 18px 30px -14px rgb(40 36 20 / 0.55);
    pointer-events: none;
    animation: drop 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
    transition: top 0.5s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .stats.low:not(.wide) {
    top: calc(26svh + env(safe-area-inset-top));
  }

  .stats.wide {
    width: 300px;
    left: auto;
    top: auto;
    right: calc(var(--edge) + 40px);
    bottom: calc(var(--edge) + 40px);
    padding: 0.9rem 1rem 0.7rem;
    transform: rotate(2deg);
  }

  .title {
    margin: 0 0 0.5rem;
    padding-bottom: 0.4rem;
    border-bottom: 1px solid var(--rule);
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--route-deep);
  }

  .figures {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.45rem 0.6rem;
    margin: 0;
  }

  .wide .figures {
    grid-template-columns: repeat(3, 1fr);
  }

  dd {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    line-height: 1.1;
    color: var(--ink);
  }

  .wide dd {
    font-size: 1.25rem;
  }

  dt {
    font-size: 0.66rem;
    color: var(--ink-faint);
  }

  .splits {
    width: 100%;
    margin-top: 0.55rem;
    border-collapse: collapse;
    font-size: 0.6rem;
  }

  .wide .splits {
    font-size: 0.74rem;
  }

  caption {
    text-align: left;
    padding: 0.4rem 0 0.25rem;
    border-top: 1px solid var(--rule);
    font-weight: 600;
    font-size: 0.72rem;
  }

  th {
    text-align: left;
    font-weight: 500;
    color: var(--ink-faint);
    padding-bottom: 0.15rem;
  }

  td {
    padding: 0.08rem 0;
    white-space: nowrap;
  }

  .mile {
    width: 2.8em;
    color: var(--ink-faint);
  }

  .bar {
    width: 100%;
    padding: 0 0.35rem;
  }

  .wide .bar {
    padding: 0 0.45rem;
  }

  .wide .bar span {
    height: 0.42rem;
  }

  .bar span {
    display: block;
    height: 0.36rem;
    border-radius: 0.21rem;
    background: var(--route);
    opacity: 0.85;
  }

  .gain {
    text-align: right;
    color: var(--ink-soft);
  }

  /* On a phone there isn't room for the splits: just the figures. */
  .stats:not(.wide) .splits {
    display: none;
  }

  figcaption {
    margin-top: 0.5rem;
    font-size: 0.6rem;
    color: var(--ink-faint);
  }

  @keyframes drop {
    from {
      opacity: 0;
      transform: translateY(-24px) rotate(6deg) scale(1.04);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .stats {
      animation: none;
      transition: none;
    }
  }
</style>
