<script>
  // A transport mode drawn as its legend symbol, matching the map's route.
  let { mode, width = 44 } = $props()
  const h = 12
</script>

<svg class="symbol" viewBox="0 0 {width} {h}" width={width} height={h} aria-hidden="true">
  {#if mode === 'train' || mode === 'metro'}
    <line x1="2" y1="6" x2={width - 2} y2="6" stroke="var(--route)" stroke-width="5" stroke-linecap="round" />
    <line x1="2" y1="6" x2={width - 2} y2="6" stroke="var(--paper)" stroke-width="2" stroke-dasharray="6 6" stroke-dashoffset="-3" />
  {:else if mode === 'bus'}
    <line x1="2" y1="6" x2={width - 2} y2="6" stroke="var(--route)" stroke-width="3.5" stroke-dasharray="8 5" />
  {:else if mode === 'walk'}
    <!-- footprints, left and right in turn -->
    {#each Array.from({ length: Math.floor((width - 4) / 9) }, (_, i) => i) as i}
      <g transform="translate({5 + i * 9} {i % 2 ? 8.2 : 3.8})" fill="var(--route)">
        <ellipse cx="1.4" cy="0" rx="2.8" ry="1.7" />
        <ellipse cx="-2.8" cy="0" rx="1.4" ry="1.3" />
      </g>
    {/each}
  {:else if mode === 'flight' || mode === 'ferry'}
    <line x1="2" y1="6" x2={width - 2} y2="6" stroke="var(--route)" stroke-width="2" stroke-linecap="round" stroke-dasharray="3 5" />
  {:else}
    <line x1="2" y1="6" x2={width - 2} y2="6" stroke="var(--route)" stroke-width="4" stroke-linecap="round" />
  {/if}
</svg>

<style>
  .symbol {
    display: inline-block;
    flex: none;
    overflow: visible;
  }
</style>
