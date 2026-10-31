<script>
  // On to the next stop: a round ↓ with where it leads ("12 photos",
  // "Shifen 十分"). The same button everywhere the page rests: the title card,
  // each place's words and under each deck (skip the photos). Tapping it
  // glides there; so does just scrolling on (App, glide.js).
  // at: [x, y] to centre it there (over the map), else it sits in the flow.
  // onback: a smaller round ↑ before it, back to the stop before (the user
  // asked for one to match).
  // deal: the step key of the deck this ↓ leads to; the deck's prints are
  // dealt out of this button as it lands (Deck.svelte).
  let { label, zh = null, note = null, at = null, onclick, onback = null, aria = null, deal = null } = $props()
</script>

<div class="row" class:placed={at} data-deal={deal} style:left={at ? `${at[0]}px` : null} style:top={at ? `${at[1]}px` : null}>
  {#if onback}
    <button class="up" onclick={onback} aria-label="Back to the stop before" title="Back">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 19V6M6 11.5l6-6 6 6" /></svg>
    </button>
  {/if}
  <button class="onward" {onclick} aria-label={aria}>
    <span class="down" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 5v13M6 12.5l6 6 6-6" /></svg></span>
    <span class="to lettering">
      <span class="what">{label}{#if zh}<span class="zh" lang="zh-Hant">{zh}</span>{/if}</span>
      {#if note}<span class="note">{note}</span>{/if}
    </span>
  </button>
</div>

<style>
  .row {
    display: inline-flex;
    align-items: center;
    gap: 10px;
  }

  .onward {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    margin: 0;
    padding: 0 6px 0 0;
    border: 0;
    background: none;
    color: var(--ink);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  /* Over the map (under a deck): centred on its spot. */
  .placed {
    position: absolute;
    z-index: 150;
    transform: translate(-50%, -50%);
    pointer-events: auto;
  }

  /* Back: the same round paper button, smaller and quieter. */
  .up {
    display: grid;
    place-items: center;
    flex: none;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 1px solid var(--rule);
    border-radius: 50%;
    background: var(--paper);
    color: var(--ink-soft);
    box-shadow: 0 5px 12px -8px rgb(40 36 20 / 0.5);
    cursor: pointer;
    transition:
      transform 0.3s cubic-bezier(0.16, 1, 0.3, 1),
      color 0.2s;
  }

  .up svg {
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .up:hover {
    color: var(--route-deep);
    transform: scale(1.06);
  }

  .up:focus-visible {
    outline: 2px solid var(--route);
    outline-offset: 3px;
  }

  .down {
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

  .down svg {
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    animation: bob 2.6s cubic-bezier(0.45, 0, 0.55, 1) 2s infinite;
  }

  /* Two small dips, then a rest. */
  @keyframes bob {
    0%,
    40%,
    100% {
      transform: translateY(0);
    }
    10%,
    30% {
      transform: translateY(3px);
    }
    20% {
      transform: translateY(0);
    }
  }

  .to {
    display: grid;
    gap: 2px;
    font-size: 0.8rem;
    letter-spacing: 0.14em;
  }

  .placed .to {
    text-shadow:
      0 0 3px var(--paper),
      0 0 3px var(--paper),
      0 0 6px var(--paper);
  }

  .what {
    display: flex;
    align-items: baseline;
    gap: 0.45em;
  }

  .zh {
    letter-spacing: 0.04em;
    color: var(--route-deep);
  }

  .note {
    font-size: 0.68rem;
    letter-spacing: 0.12em;
    color: var(--ink-faint);
  }

  .onward:hover .down {
    transform: scale(1.06);
  }

  /* Pressed: the button sinks under the finger, so a tap is felt at once. */
  .onward:active .down {
    transform: scale(0.9);
    background: var(--margin);
    box-shadow: 0 2px 5px -3px rgb(40 36 20 / 0.5);
    transition-duration: 0.08s;
  }

  .up:active {
    transform: scale(0.9);
    background: var(--margin);
    transition-duration: 0.08s;
  }

  .onward:hover .what {
    color: var(--route-deep);
  }

  .onward:focus-visible {
    outline: 2px solid var(--route);
    outline-offset: 4px;
    border-radius: 22px;
  }

  @media (prefers-reduced-motion: reduce) {
    .down svg {
      animation: none;
    }
  }
</style>
