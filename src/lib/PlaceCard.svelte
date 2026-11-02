<script>
  // A place's words as a map sheet's label, on top of its pile of photos
  // (Deck.svelte). The user picked it on Nov 2, 2026, over a plain print, a
  // field-book page and a quieter postcard, after finding the airmail
  // postcard too distracting and off theme. It's drawn like the corner
  // block of a survey sheet: the map's own double frame with ticks, the sheet
  // number and the place's coordinates across the head, the place marker
  // (the map's red ring) by the name, then the facts, then the words.
  //
  // A long description breaks over several cards: a line of just --- in it
  // starts the next (App's noteFor). The rest carry on the words under a
  // running head, "cont. 2 / 3". If a card's words still don't fit, they
  // shrink a little (down to 78%) rather than be cut off.
  import Symbol from './Symbol.svelte'
  import { howWeGotThere } from './modes.js'

  // note: { name, zh, sheet, of, inset, lonlat, segments, from, arrive, when,
  // stay, text: [paragraphs], quote, by, gmaps, walk: { miles, hours } }.
  // part, parts: which card of how many. photos: how many photos lie
  // beneath. live: it's on top (its link takes the keyboard). final: the last
  // card before the photos. note.stats: a hike's AllTrails figures and splits,
  // on a card of their own (the user asked, Nov 2, 2026, moving them off the
  // map now there are no hike cards; the splits fit on phones there too).
  let { note, part = 0, parts = 1, final = true, photos = 0, live = false } = $props()

  const stats = $derived(note.stats ?? null)
  const front = $derived(part === 0 && !stats)
  const last = $derived(part === parts - 1)
  const secs = (pace) => pace.split(':').reduce((a, n) => a * 60 + Number(n), 0)
  const slowest = $derived(Math.max(...(stats?.splits ?? []).map((sp) => secs(sp[1])), 1))
  const pad2 = (n) => String(n).padStart(2, '0')
  // Degrees and minutes, the way the frame's ticks are lettered.
  const dm = (v, pos, neg) => {
    const a = Math.abs(v)
    let d = Math.floor(a)
    let m = Math.round((a - d) * 60)
    if (m === 60) [d, m] = [d + 1, 0]
    return `${d}°${pad2(m)}′${v >= 0 ? pos : neg}`
  }
  const coords = $derived(note.lonlat ? `${dm(note.lonlat[1], 'N', 'S')}  ${dm(note.lonlat[0], 'E', 'W')}` : '')

  // Shrink the words to fit the card, if they must.
  let fit = $state(1)
  function fitWords(face) {
    const check = () => {
      let f = 1
      // The words (or stats) box can overflow into the foot without the
      // card itself overflowing, so both are checked. Stats may shrink a
      // little further than words.
      const body = face.querySelector('.message, .stats')
      const over = () => face.scrollHeight > face.clientHeight + 1 || (body && body.scrollHeight > body.clientHeight + 1)
      const floor = stats ? 0.66 : 0.78
      face.style.setProperty('--fit', f)
      while (over() && f > floor) {
        f = Math.round((f - 0.04) * 100) / 100
        face.style.setProperty('--fit', f)
      }
      fit = f
    }
    const ro = new ResizeObserver(check)
    ro.observe(face)
    document.fonts?.ready.then(check)
    return () => ro.disconnect()
  }
</script>

<div class="card">
  <div class="face" style:--fit={fit} {@attach fitWords}>
    <!-- The sheet's head: its number and where it lies. -->
    <p class="head lettering">
      <span class="sheet">
        {note.inset ? 'Inset\u2002·\u2002' : ''}Sheet <b>{pad2(note.sheet)}</b>&thinsp;/&thinsp;{pad2(note.of)}
        {#if !front && !stats}<span class="cont">· cont. {part + 1}&thinsp;/&thinsp;{parts}</span>{/if}
      </span>
      {#if coords}<span class="coords">{coords}</span>{/if}
    </p>

    {#if front}
      <h2 class="title">
        <svg class="marker" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" /><circle class="dot" cx="12" cy="12" r="5.5" /></svg>
        <span class="name">{note.name}</span>
        {#if note.zh}<span class="zh" lang="zh-Hant">{note.zh}</span>{/if}
      </h2>

      <div class="facts lettering">
        {#if note.walk}
          <p><span class="symbols"><Symbol mode="walk" width={28} /></span>On foot{#if note.walk.miles}&ensp;·&ensp;{note.walk.miles} miles{/if}{#if note.walk.hours}&ensp;·&ensp;{note.walk.hours} hours{/if}</p>
        {:else if note.segments?.length}
          <p><span class="symbols">{#each note.segments as seg}<Symbol mode={seg.mode} width={28} />{/each}</span>{howWeGotThere(note.segments)} from {note.from}</p>
        {:else if note.arrive}
          <p>{note.arrive}</p>
        {/if}
        {#if note.when || note.stay}
          <p class="when">{[note.when, note.stay].filter(Boolean).join('  ·  ')}</p>
        {/if}
      </div>
    {:else}
      <p class="carry">
        <span class="carry-name lettering">{note.name}</span>
        {#if note.zh}<span class="zh" lang="zh-Hant">{note.zh}</span>{/if}
        {#if stats?.source}<span class="source lettering">{stats.source}</span>{/if}
      </p>
    {/if}

    {#if stats}
      <div class="stats">
        <dl class="figures">
          {#each stats.figures as [label, value]}
            <div>
              <dd class="lettering">{value}</dd>
              <dt class="lettering">{label}</dt>
            </div>
          {/each}
        </dl>
        {#if stats.splits?.length}
          <table class="splits">
            <thead class="lettering"><tr><th>Mile</th><th>Pace</th><th class="bar-h"></th><th class="gain">Gain</th></tr></thead>
            <tbody>
              {#each stats.splits as [mile, pace, ft]}
                <tr>
                  <td class="lettering mile">{mile}</td>
                  <td class="lettering pace">{pace}</td>
                  <td class="bar"><span style:width="{(secs(pace) / slowest) * 100}%"></span></td>
                  <td class="lettering gain">{ft} ft</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>
    {:else}
    <div class="message">
      {#if note.quote}
        <blockquote>
          {#each note.quote as para}<p>{para}</p>{/each}
          {#if note.by && last}<footer class="lettering">{note.by}</footer>{/if}
        </blockquote>
      {/if}
      {#each note.text ?? [] as para}<p>{para}</p>{/each}
    </div>
    {/if}

    <div class="foot lettering">
      {#if front && note.gmaps}
        <a class="maps" href={note.gmaps} target="_blank" rel="noopener" tabindex={live ? 0 : -1}>Google Maps</a>
      {:else}
        <span></span>
      {/if}
      <span class="more">
        {final ? `${photos} photo${photos === 1 ? '' : 's'}` : stats || !last ? 'Next' : 'The stats'}
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M9.5 5.5 16 12l-6.5 6.5" /></svg>
      </span>
    </div>
  </div>
</div>

<style>
  /* The map's frame: a fine outer line, then the neat line with ticks. */
  .card {
    height: 100%;
    padding: 4px;
    background: var(--paper);
    border: 0.6px solid var(--rule);
    container-type: inline-size;
    text-align: left;
    color: var(--ink);
  }

  .face {
    --pad: clamp(16px, 6cqi, 32px);
    --tick: 7px;
    --hair: rgb(29 31 26 / 0.3);
    position: relative;
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    padding: calc(var(--pad) * 0.7) var(--pad) 0;
    border: 1.25px solid var(--rule);
    /* Graticule ticks on the neat line: three along the top and foot, two
       down each side. */
    background:
      linear-gradient(var(--rule), var(--rule)) 25% 0 / 1px var(--tick) no-repeat,
      linear-gradient(var(--rule), var(--rule)) 50% 0 / 1px var(--tick) no-repeat,
      linear-gradient(var(--rule), var(--rule)) 75% 0 / 1px var(--tick) no-repeat,
      linear-gradient(var(--rule), var(--rule)) 25% 100% / 1px var(--tick) no-repeat,
      linear-gradient(var(--rule), var(--rule)) 50% 100% / 1px var(--tick) no-repeat,
      linear-gradient(var(--rule), var(--rule)) 75% 100% / 1px var(--tick) no-repeat,
      linear-gradient(var(--rule), var(--rule)) 0 33% / var(--tick) 1px no-repeat,
      linear-gradient(var(--rule), var(--rule)) 0 67% / var(--tick) 1px no-repeat,
      linear-gradient(var(--rule), var(--rule)) 100% 33% / var(--tick) 1px no-repeat,
      linear-gradient(var(--rule), var(--rule)) 100% 67% / var(--tick) 1px no-repeat,
      var(--paper);
  }

  /* Sheet number and coordinates, ruled off like a map's title block. */
  .head {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.2rem 1rem;
    margin: 0;
    padding: 0.35rem 0 0.55rem;
    border-bottom: 1px solid var(--rule);
    font-size: clamp(0.68rem, 3cqi, 0.8rem);
    letter-spacing: 0.12em;
    color: var(--ink-soft);
  }

  .head b {
    font-weight: 600;
    color: var(--route-deep);
  }

  .cont {
    color: var(--ink-faint);
  }

  .coords {
    color: var(--ink-faint);
    font-variant-numeric: tabular-nums;
    white-space: pre;
  }

  .title {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0 0.4em;
    margin: clamp(0.9rem, 4.5cqi, 1.5rem) 0 0;
    line-height: 0.95;
  }

  /* The place marker, as the map draws it. */
  .marker {
    align-self: center;
    flex: none;
    width: clamp(18px, 5.5cqi, 26px);
    height: auto;
    margin-right: 0.1em;
    fill: var(--paper);
    stroke: var(--route-deep);
    stroke-width: 1.6;
  }

  .marker .dot {
    fill: var(--route);
    stroke: none;
  }

  .name {
    font-family: var(--font-label);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    font-size: clamp(1.8rem, 10cqi, 3.1rem);
  }

  .title .zh {
    font-size: clamp(1.1rem, 5.4cqi, 1.65rem);
    color: var(--route-deep);
  }

  .facts {
    margin-top: 0.75rem;
    padding-bottom: 0.8rem;
    border-bottom: 1px solid var(--hair);
    font-size: clamp(0.74rem, 3.3cqi, 0.88rem);
    letter-spacing: 0.08em;
  }

  .facts p {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 0;
  }

  .facts .when {
    margin-top: 0.3rem;
    color: var(--ink-faint);
  }

  .symbols {
    display: inline-flex;
    gap: 3px;
    flex: none;
  }

  .carry {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0.2rem 0.5rem;
    margin: 0.9rem 0 0;
    padding-bottom: 0.6rem;
    border-bottom: 1px solid var(--hair);
  }

  .carry-name {
    font-weight: 600;
    font-size: 1.15rem;
    letter-spacing: 0.08em;
  }

  .carry .zh {
    color: var(--route-deep);
  }

  /* The stats card's running head: tighter, to leave the splits room. */
  .face:has(.stats) .carry {
    margin-top: 0.6rem;
    padding-bottom: 0.45rem;
  }

  .source {
    margin-left: auto;
    font-size: 0.72rem;
    letter-spacing: 0.12em;
    color: var(--ink-faint);
  }

  /* A hike's stats: the headline figures, then each mile's pace as a red
     bar with its climb. Sized with the card (and --fit, if it must). */
  .stats {
    flex: 1;
    min-height: 0;
    padding: 0.7em 0 0.5em;
    font-size: calc(clamp(0.8rem, 3.6cqi, 1rem) * var(--fit, 1));
    overflow: hidden;
  }

  .figures {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.6em 0.8em;
    margin: 0 0 0.9em;
  }

  .figures dd {
    margin: 0;
    font-size: 1.45em;
    font-weight: 600;
    letter-spacing: 0.02em;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
  }

  .figures dt {
    font-size: 0.72em;
    letter-spacing: 0.1em;
    color: var(--ink-faint);
  }

  .splits {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.86em;
    font-variant-numeric: tabular-nums;
  }

  .splits th {
    padding: 0 0 0.25em;
    border-bottom: 1px solid var(--hair);
    font-weight: 500;
    font-size: 0.85em;
    letter-spacing: 0.1em;
    text-align: left;
    color: var(--ink-faint);
  }

  .splits td {
    padding: 0.1em 0;
    line-height: 1.25;
    white-space: nowrap;
  }

  .splits .mile {
    width: 3.4em;
    padding-right: 0.6em;
    color: var(--ink-faint);
  }

  .splits .pace {
    width: 3.6em;
  }

  .splits .bar {
    width: 100%;
    padding: 0 0.6em;
  }

  .splits .bar span {
    display: block;
    height: 0.42em;
    border-radius: 0.21em;
    background: var(--route);
    opacity: 0.85;
  }

  .splits .gain {
    text-align: right;
    color: var(--ink-soft);
  }

  /* The words, in the serif, as large as the card allows. */
  .message {
    flex: 1;
    min-height: 0;
    /* The card's full width: about 60 characters a line at most on a
       desktop card (44ch left half the card empty; the user asked). */
    max-width: 66ch;
    padding: 0.95rem 0 0.9rem;
    font-size: calc(clamp(0.95rem, 4.2cqi, 1.2rem) * var(--fit, 1));
    line-height: 1.5;
  }

  .message p {
    margin: 0 0 0.6em;
  }

  .message p:last-child {
    margin-bottom: 0;
  }

  blockquote {
    margin: 0;
  }

  blockquote p {
    font-style: italic;
  }

  blockquote footer {
    margin-top: 0.4rem;
    font-size: 0.8rem;
    color: var(--route-deep);
  }

  blockquote footer::before {
    content: '— ';
  }

  .foot {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    height: 46px;
    border-top: 1px solid var(--rule);
    font-size: 0.78rem;
    letter-spacing: 0.1em;
  }

  .maps {
    color: var(--ink-soft);
  }

  /* On to the photos (or the next card): the way the pile goes. */
  .more {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    color: var(--route-deep);
    font-weight: 600;
  }

  .more svg {
    fill: none;
    stroke: currentColor;
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
