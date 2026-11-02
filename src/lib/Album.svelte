<script>
  // The way out to the full album, on the closing card: the ↓ buttons' round
  // paper button, with an arrow pointing out of the page instead of on.
  let { href } = $props()
</script>

<a class="album" {href} target="_blank" rel="noopener">
  <span class="out" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M7 17 17 7M9 7h8v8" /></svg></span>
  <span class="to lettering">
    <span class="what">All the photos</span>
    <span class="note">Google Photos album</span>
  </span>
</a>

<style>
  .album {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding-right: 6px;
    color: var(--ink);
    text-decoration: none;
  }

  .out {
    display: grid;
    place-items: center;
    flex: none;
    width: 40px;
    height: 40px;
    border: 1px solid var(--rule);
    border-radius: 50%;
    background: var(--paper);
    color: var(--route-deep);
    box-shadow: 0 6px 14px -8px rgb(40 36 20 / 0.5);
    transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .out svg {
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .to {
    display: grid;
    gap: 2px;
    font-size: 0.8rem;
    letter-spacing: 0.14em;
  }

  .note {
    font-size: 0.68rem;
    letter-spacing: 0.12em;
    color: var(--ink-faint);
  }

  .album:hover .out {
    transform: scale(1.06);
  }

  /* The arrow leans a little further out, toward where it leads. */
  .album:hover .out svg {
    transform: translate(1.5px, -1.5px);
  }

  .album:hover .what {
    color: var(--route-deep);
  }

  .album:active .out {
    transform: scale(0.9);
    background: var(--margin);
    box-shadow: 0 2px 5px -3px rgb(40 36 20 / 0.5);
    transition-duration: 0.08s;
  }

  .album:focus-visible {
    outline: 2px solid var(--route);
    outline-offset: 4px;
    border-radius: 22px;
  }

  @media (prefers-reduced-motion: reduce) {
    .out,
    .out svg {
      transition: none;
    }
  }
</style>
