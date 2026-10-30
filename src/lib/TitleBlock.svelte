<script>
  // The title card (wide screens): Taiwan, and a line about the trip. The
  // line is written in the photo picker (Title card).
  import Onward from './Onward.svelte'

  let { trip, onward } = $props()
</script>

<header class="block inset">
  <h1>
    <span class="name">{trip.title}</span>
    {#if trip.titleZh}<span class="zh" lang="zh-Hant">{trip.titleZh}</span>{/if}
  </h1>
  {#each trip.summary.split(/\n\s*\n/).filter(Boolean) as line}<p class="summary">{line}</p>{/each}

  <div class="cue">
    <Onward label="Follow the route" note="Click, or just scroll" onclick={onward} />
  </div>
</header>

<style>
  .block {
    width: min(100%, 25rem);
    padding: 1.4rem 1.5rem 1.2rem;
  }

  h1 {
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
    font-size: clamp(3.6rem, 9vw, 5.6rem);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  h1 .zh {
    font-size: clamp(1.9rem, 4.4vw, 2.6rem);
    color: var(--route-deep);
  }

  .summary {
    margin: 0.8rem 0 0;
    max-width: 34ch;
    font-size: 1.05rem;
    font-style: italic;
    color: var(--ink-soft);
  }

  .cue {
    margin: 1.2rem 0 0;
    padding-top: 0.9rem;
    border-top: 1px solid var(--rule);
  }
</style>
