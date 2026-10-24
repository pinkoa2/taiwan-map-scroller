<script>
  // The title card (wide screens): Taiwan, and a line about the trip. The
  // line is written in the photo picker (Title card).
  let { trip } = $props()
</script>

<header class="block inset">
  <h1>
    <span class="name">{trip.title}</span>
    {#if trip.titleZh}<span class="zh" lang="zh-Hant">{trip.titleZh}</span>{/if}
  </h1>
  {#each trip.summary.split(/\n\s*\n/).filter(Boolean) as line}<p class="summary">{line}</p>{/each}

  <p class="cue lettering">
    Scroll to follow the route
    <svg viewBox="0 0 12 18" width="12" height="18" aria-hidden="true">
      <path d="M6 1v15M1 11l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.5" />
    </svg>
  </p>
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
    padding-top: 0.8rem;
    border-top: 1px solid var(--rule);
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.85rem;
    color: var(--route-deep);
  }

  .cue svg {
    animation: nudge 2.4s cubic-bezier(0.16, 1, 0.3, 1) infinite;
  }

  @keyframes nudge {
    0%,
    60%,
    100% {
      transform: translateY(0);
    }
    30% {
      transform: translateY(4px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .cue svg {
      animation: none;
    }
  }
</style>
