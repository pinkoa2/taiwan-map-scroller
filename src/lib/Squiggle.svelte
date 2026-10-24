<script>
  // A hand-drawn squiggly arrow with a note, pointing at the photos to say
  // they open. It draws itself in. `toward` is where the arrow's tip ends up:
  // 'left' (down and left), 'right' (down and right) or 'down'; or 'swipe',
  // a sideways sweep that shows the gesture (a loop, then a swoop to the left).
  let { text, toward = 'left' } = $props()
</script>

<div class="squiggle {toward}" role="note">
  <p class="note">{text}</p>
  {#if toward === 'swipe'}
    <svg viewBox="0 0 170 56" width="150" height="50" aria-hidden="true">
      <!-- a loop at the right, then a long sweep left to the tip -->
      <path class="line" pathLength="1" d="M158 30 C 150 8, 122 10, 128 28 C 134 46, 156 36, 144 20 C 128 2, 70 40, 12 32" />
      <path class="head" pathLength="1" d="M25 23 L12 32 L26 40" />
    </svg>
  {:else}
    <svg viewBox="0 0 120 92" width="104" height="80" aria-hidden="true">
      <!-- a loop, then a long swoop to the tip -->
      <path class="line" pathLength="1" d="M104 6 C 74 2, 62 28, 80 36 C 98 44, 96 16, 72 20 C 44 24, 36 58, 10 82" />
      <path class="head" pathLength="1" d="M23 77 L10 82 L12 68" />
    </svg>
  {/if}
</div>

<style>
  .squiggle {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    pointer-events: none;
    animation: settle 0.5s ease-out both;
  }

  .note {
    margin: 0 0 -0.2rem;
    max-width: 13rem;
    font-family: var(--font-text);
    font-style: italic;
    font-size: 1.05rem;
    line-height: 1.25;
    color: var(--ink);
    transform: rotate(-4deg);
    text-align: right;
    /* a paper halo so it reads over the map */
    text-shadow:
      0 0 3px var(--paper),
      0 0 6px var(--paper),
      0 0 10px var(--paper);
  }

  svg {
    overflow: visible;
    margin-right: 0.6rem;
  }

  path {
    fill: none;
    stroke: var(--route);
    stroke-width: 2.6;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
  }

  .line {
    animation: draw 1.1s cubic-bezier(0.45, 0, 0.25, 1) 0.35s forwards;
  }

  .head {
    animation: draw 0.25s ease-out 1.4s forwards;
  }

  /* Tip down and to the right: the same arrow, mirrored. */
  .right {
    align-items: flex-start;
  }

  .right .note {
    text-align: left;
    transform: rotate(4deg);
  }

  .right svg {
    transform: scaleX(-1);
    margin: 0 0 0 0.6rem;
  }

  /* Tip straight down, as on a phone above the first photo. */
  .down {
    align-items: center;
  }

  .down .note {
    text-align: center;
    transform: rotate(-3deg);
    margin-bottom: 1.5rem;
  }

  .down svg {
    transform: rotate(-38deg) translateX(26px);
    margin: 0;
  }

  /* The swipe gesture: the note above, the sweep under it. */
  .swipe {
    align-items: center;
  }

  .swipe .note {
    text-align: center;
    transform: rotate(-2deg);
    margin: 0;
  }

  .swipe svg {
    margin: 0 0 0 2.5rem;
  }

  @keyframes draw {
    to {
      stroke-dashoffset: 0;
    }
  }

  @keyframes settle {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .squiggle,
    .line,
    .head {
      animation: none;
    }

    path {
      stroke-dashoffset: 0;
    }
  }
</style>
