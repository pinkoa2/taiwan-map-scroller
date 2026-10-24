---
name: Taiwan 臺灣
description: A month on the island, plotted on one printed topographic survey sheet.
colors:
  route: "#e2401c"
  route-deep: "#a92c0e"
  ink: "#1d1f1a"
  ink-soft: "#474b40"
  ink-faint: "#5d6155"
  margin: "#f2f3ec"
  paper: "#fbfbf7"
  halo: "#f7f8f1"
  sea: "#d3e5ec"
  sea-line: "#5c97b8"
  coast: "#2f6e9a"
  river: "#3f84b8"
  rail: "#22231f"
  land: "#dde7cc"
  contour: "#93602f"
  contour-text: "#6e4520"
  viewer-ground: "#171812"
  viewer-rule: "#3a3c33"
  viewer-text-soft: "#b9bcae"
  viewer-route: "#ff8a66"
typography:
  display:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "clamp(3.6rem, 9vw, 5.6rem)"
    fontWeight: 600
    lineHeight: 0.88
    letterSpacing: "0.04em"
  headline:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "clamp(2.6rem, 5vw, 3.5rem)"
    fontWeight: 600
    lineHeight: 0.95
    letterSpacing: "0.03em"
  title:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "clamp(2rem, 4vw, 2.6rem)"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.06em"
  body:
    fontFamily: "Source Serif 4 Variable, Source Serif 4, Georgia, serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.55
  quote:
    fontFamily: "Source Serif 4 Variable, Source Serif 4, Georgia, serif"
    fontSize: "1.2rem"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 500
    letterSpacing: "0.12em"
    fontFeature: "tnum"
  label-zh:
    fontFamily: "Noto Serif TC, Songti TC, serif"
    fontWeight: 600
    letterSpacing: "0.04em"
rounded:
  none: "0px"
spacing:
  edge: "26px"
  edge-phone: "10px"
  column: "min(440px, 38vw)"
  inset-pad: "1.1rem 1.4rem 1.2rem"
  plate-mat: "8px"
components:
  inset-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "{spacing.inset-pad}"
    width: "{spacing.column}"
  title-block:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.display}"
    rounded: "{rounded.none}"
    padding: "1.4rem 1.5rem 1.2rem"
    width: "min(100%, 25rem)"
  where-badge:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0.35rem 0.75rem 0.4rem"
  plate-frame:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.none}"
    padding: "{spacing.plate-mat}"
    width: "min(400px, 24vw)"
  plate-caption:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0.35rem 0.6rem"
  link:
    textColor: "{colors.route-deep}"
    typography: "{typography.label}"
  link-hover:
    textColor: "{colors.route}"
  viewer-button:
    backgroundColor: "{colors.viewer-ground}"
    textColor: "{colors.margin}"
    rounded: "{rounded.none}"
    size: "44px"
---

> **Minimal map (Oct 23, 2026, at the user's request):** the sheet no longer draws elevation tints, contours, rivers, rail or peaks. Land is one flat tint (`#e3eacf`, `land` in palette.js) with the coastline and a soft sea-line halo. Ink tokens below for contours, rivers and rail are kept for reference but are currently unused on the map.
>
> **Route animation (Oct 23, 2026):** while a leg draws, its vehicle rides at the head of the line on a paper badge (train, bus or car pictogram in route vermilion, flipped to face its direction; `drawVehicle` in sheet.js). Walking is drawn as alternating footprints, not dots, here and in the legend (`Symbol.svelte`). A walk with `track: true` (the Mianyue Line, an old railway) sits on a simple railway track: sleepers and two rails in ink-soft.

# Design System: Taiwan 臺灣

## Overview

**Creative North Star: "The Survey Sheet"**

The whole page is one offset-printed topographic sheet of Taiwan. Hypsometric land tints, brown contours thickening into the Central Range, water-lined coasts, blue rivers and black-and-white railway are printed as the base. The trip is a single vermilion overprint on top, inked segment by segment as the reader scrolls. The map is rendered live on a canvas behind the story. Every piece of UI is sheet-margin furniture: a neat line with graticule ticks, a title block with a legend, a live scale bar, a locator key map, numbered plates, and a sheet note.

The system is quiet and exact, like a printed map. There are only a few inks, the corners are square, the rules are hairlines, and every label is set in condensed capitals on a paper halo. The density comes from the cartography, not the chrome. Text sits in paper insets laid onto the sheet, and photographs are plates tipped onto it with registration marks at their corners. The only place the paper world goes dark is the full-screen plate viewer, which works as a darkroom for the photographs.

The build rejects the category default of a dark vector basemap beside a stack of floating photo cards. Here the base is light and printed, and the photos sit on the map.

**Key Characteristics:**
- One printed sheet behind the whole page, framed by a 26px margin and a double neat line (10px on a phone).
- A single vermilion overprint for everything that belongs to the trip.
- Transport modes are drawn as legend symbols, the same in the legend and on the map.
- Condensed uppercase lettering for all furniture, a serif for the prose, and a Song-style serif for Chinese.
- Square corners everywhere, with 1px ink rules and paper insets.

## Colors

These are the inks of an offset-printed survey sheet: a pale paper ground, cartographic blues and browns, near-black ink, and one vermilion overprint. The CSS custom properties in `src/app.css` mirror `src/lib/map/palette.js`, so canvas and DOM share one set of inks.

### Primary
- **Overprint Vermilion** (route): the trip's own ink. It draws the route line in every transport symbol, the pen nib where the ink is still running, the current place mark, the locator's view box, the selection highlight, the focus ring, and link hover. On the sheet it always sits on a paper halo.
- **Deep Vermilion** (route-deep): the text-weight form of the overprint, used where vermilion has to read as type on paper. It covers plate numbers, the leg counter, Chinese place names in headings, the scroll cue, quote attributions, the "So far" total, links, past place-mark outlines, and the trail name on the large-scale sheet.

### Secondary
- **Survey Sea** (sea): the open water and the canvas ground. It also fills the locator.
- **Water-Line Blue** (sea-line): the concentric water lining offshore of the coast.
- **Coast Blue** (coast): the coastline stroke and the locator coast.
- **River Blue** (river): rivers, which fade in as the view zooms closer.

### Tertiary
- **Lowland Survey Green** (land): the 0 m step of the hypsometric ramp. The ramp then climbs through olive and buff to a high-mountain brown at 3500 m (full ramp in the sidecar, source in `palette.js`).
- **Contour Brown** (contour): contour lines. Major contours print at 0.9px and 70% opacity, minor ones at 0.5px and 38%.
- **Spot-Height Brown** (contour-text): italic peak names and spot heights.

### Neutral
- **Sheet Ink** (ink): text, neat lines, rules, registration marks, scale-bar blocks, and the current place's label.
- **Soft Ink** (ink-soft): the italic summary, sources, labels of past places and reference cities, and graticule figures.
- **Faint Ink** (ink-faint): the smallest furniture captions, such as fact labels, the sheet note, and "Stand-in photo".
- **Sheet Margin** (margin): the page and the 26px margin outside the neat line.
- **Paper** (paper): inset, plate-mat, caption and badge grounds, plus the white breaks in the rail and train symbols.
- **Label Halo** (halo): the 4.5px paper stroke under all map lettering and the 8px halo under the route.
- **Rail Black** (rail): the railway, which carries 5px paper breaks once the view is close enough to read them.
- **Darkroom** (viewer-ground), **Darkroom Rule** (viewer-rule), **Darkroom Soft** (viewer-text-soft), **Darkroom Vermilion** (viewer-route): these belong to the full-screen plate viewer only. Its text is Sheet Margin on Darkroom. The overprint lifts to Darkroom Vermilion so plate numbers stay legible on the dark ground.

### Named Rules
**The One Overprint Rule.** Vermilion marks the trip and nothing else: our route, our places, our plate numbers, our counter, our words. Reference geography never takes it. Cities and peaks are lettered in ink and contour brown.

**The Mirrored Inks Rule.** Every colour is a named ink in `palette.js` with a CSS twin in `app.css`. Add or change an ink in both places, never as a literal in a component.

## Typography

**Display Font:** Barlow Condensed 500/600 (with Arial Narrow, sans-serif)
**Body Font:** Source Serif 4 Variable, optical sizing on (with Georgia, serif)
**Chinese Font:** Noto Serif TC 600 (with Songti TC, serif)

**Character:** Condensed capitals, set wide, are the map's lettering and the voice of every piece of furniture. The bookish serif carries the travellers' own words, and its italic is kept for the summary line and the trail quote.

### Hierarchy
- **Display** (600, clamp(3.6rem, 9vw, 5.6rem), 0.88): the title block's island name, uppercase. Only one per page.
- **Headline** (600, clamp(2.6rem, 5vw, 3.5rem), 0.95): leg and trail names in their insets, uppercase. The Chinese name follows at 1.6rem in Deep Vermilion.
- **Title** (600, clamp(2rem, 4vw, 2.6rem), 1): the closing block's heading.
- **Body** (400, 1.0625rem, 1.55): leg prose, max 62ch. The italic summary is 1.05rem.
- **Quote** (italic 400, 1.2rem, 1.45): the walker's first-person note on the trail.
- **Label** (500, 0.7–1rem, 0.12em, uppercase, tabular figures): facts, legend, how-we-got-there lines, plate numbers, the badge, links, and the scale bar. Values step up to 600. On canvas the lettering uses the same face: 600 weight at 14px for places (19px for the current place), 500 at 12px for cities, italic 500 at 11.5px for peaks, and 500 at 11px for graticule figures.

### Named Rules
**The Lettering Rule.** Anything that labels, counts or navigates is set in Barlow Condensed capitals, tracked wide. Prose is never set in it, and labels are never set in the serif.

**The Halo Rule.** Map lettering always sits on a 4.5px paper halo stroke, so contours and the route never strike through a word.

**The Bilingual Name Rule.** A place's Chinese name always follows its English name in Noto Serif TC 600, never in the condensed face.

## Layout

On a wide screen (900px and up), the canvas sheet is fixed full-bleed behind the page. A 26px margin band frames it, with a 1.25px neat line and a 0.6px outer rule 4px beyond it. Graticule ticks (7px) and figures sit in the margin, and graticule crosses fall inside the frame. The story is a single reading column (min(440px, 38vw)) inset 74px from the left edge. Plates (min(400px, 24vw)) alternate between the left and right edges, which leaves the middle of the sheet clear for the place they show. The locator and scale bar sit bottom-centre, and the leg badge sits top-right.

Below 900px the margin becomes 10px and the sheet becomes a window across the top 46% of the screen. The story scrolls underneath it at full width, so the map is never hidden behind text. The badge moves to the top-left and the locator and scale bar move inside the window.

Scroll pacing is set by empty pauses between story steps: 34svh, 18svh short and 60svh long on desktop, and 15/10/36svh on a phone. A step fires when its marker crosses the reading line, which is 55% of the viewport on desktop and the middle of the visible story area on a phone.

**The Neat Line Rule.** All content lives inside the sheet's frame. The margin band and neat line are drawn on every view, at every zoom.

## Elevation & Depth

Depth here is paper lying on paper. There are no floating surfaces and no colour layering. Insets and plates carry a printed ring (a 1px ink line, 3px of paper, then a hairline second rule) and a soft, low, downward lift. Nothing glows, and hover only deepens a plate's lift.

### Shadow Vocabulary
- **Inset double rule** (`box-shadow: 0 0 0 3px var(--paper), 0 0 0 3.6px var(--rule), 0 18px 36px -18px rgb(40 36 20 / 0.45)`): title block, leg and trail insets, closing block.
- **Plate lift** (`box-shadow: 0 0 0 1px var(--rule), 0 22px 40px -22px rgb(40 36 20 / 0.55)`): plate frames at rest. On hover it becomes `0 28px 48px -20px rgb(40 36 20 / 0.6)`.
- **Phone window** (`box-shadow: 0 1px 0 var(--rule), 0 14px 22px -14px rgb(40 36 20 / 0.5)`): the bottom edge of the map window on a phone.

### Named Rules
**The Inset Rule.** Furniture is an inset printed on the sheet: paper ground, an ink neat line, a hairline double rule, and a soft downward lift. No other card treatment exists.

## Shapes

All boxes have square corners (0px), with no exceptions in the source. Edges are 1px ink rules. The facts and stats grids are ruled tables, and the closing total sits on a 2px rule. Circles appear only as map symbols: place marks (4.5px, and 7px with a 12px outer ring for the current place) and the 5px pen nib. Plates carry four registration crosses (14px arms, 1px ink) set 11px outside their corners. Icons are drawn SVG strokes (arrows, chevrons, close) at 1.4–1.8px with round caps. The details disclosure uses a drawn 6px chevron instead of the browser triangle.

**The Square Sheet Rule.** No container, button, badge or caption is ever rounded. Roundness belongs only to map symbols.

## Components

### Transport Symbol (signature)
Transport modes are drawn as legend symbols. The legend in the title block and closing table (`Symbol.svelte`) and the route on the map (`routeStroke`) draw each mode the same way, in Overprint Vermilion:
- **Train:** a 4.5px line with 7px paper breaks (5px with 2px breaks in the legend).
- **Bus:** a 3.5px line dashed 9/6, with butt caps.
- **Car:** a 4px solid line.
- **On foot:** 4.5px round dots every 8px.
- **Flight / ferry:** a 2px fine dotted line, 3/5.

**The Legend Symbol Rule.** A mode looks the same in every place it appears. New modes get a new symbol in both drawers at once.

### Insets (cards)
- **Corner Style:** square (0px).
- **Background:** Paper, with Sheet Ink text.
- **Shadow Strategy:** the inset double rule (see Elevation).
- **Border:** 1px Sheet Ink.
- **Internal Padding:** 1.1rem 1.4rem 1.2rem (1rem 1.1rem on a phone). The title block and closing block are 25rem wide, with 1.4–1.5rem padding.

### Plates
Plates are photographs tipped onto the sheet. Each has an 8px paper mat, a 1px ink ring and the plate lift, with registration crosses at the corners and a `zoom-in` cursor. Below the plate, a separate ruled paper caption strip carries "Plate N" in Deep Vermilion label, the caption or place name, and a faint "Stand-in photo" tag flush right for placeholders. Images are slightly desaturated (`saturate(0.92)`) and show a blurred placeholder until they load.

### Leg Badge (navigation)
A fixed paper chip with a 1px ink rule shows where the reader is. It holds the leg counter "02/8" (the number in Deep Vermilion 600, the total in Faint Ink), the place name in tracked 600 capitals, and the Chinese name. While the route is moving between places, it reads "from (faint) → to". It fades and drops in over 0.5s on the standard ease.

### Links
Links are Deep Vermilion with a 1px underline offset 0.2em, and they turn Overprint Vermilion on hover. The "Open in Google Maps" link is set as label lettering. Focus is a 2px vermilion outline offset 3px.

### Plate Viewer
The plate viewer is a full-screen darkroom dialog. A Darkroom ground holds the photo, and a bar below it, separated by a 1px Darkroom Rule, carries the plate number in Darkroom Vermilion, the caption, and the credit in Darkroom Soft. Controls are square 44px buttons with a 1px rule and drawn chevrons. You can move through plates with the arrow keys or a swipe, and Escape closes the viewer. Images enter with a 0.45s fade and a scale from 0.985.

### Sheet Furniture (canvas)
- **Scale bar:** four alternating ink and paper blocks, 5px tall, on a 90% paper patch, labelled 0, a length and MILES. The length is a round number chosen to come out near 110px.
- **Locator:** an inset key map of the island with the current view outlined in vermilion.
- **Graticule:** 7px ticks on the neat line and 10px crosses at 55% ink inside the frame. Figures are shown on wide screens only.

## Do's and Don'ts

### Do:
- **Do** take every colour from the mirrored inks (`app.css` and `palette.js`), and keep vermilion for the trip (The One Overprint Rule).
- **Do** set all furniture, labels, numbers and navigation in Barlow Condensed capitals at 0.12em tracking with tabular figures.
- **Do** put map lettering on a 4.5px paper halo and the route on an 8px halo.
- **Do** build new UI as sheet furniture: a paper inset with a 1px ink rule, the double-rule ring and the soft lift.
- **Do** present photographs as numbered plates with a paper mat, registration marks and a ruled caption strip.
- **Do** draw icons as stroked SVG at 1.4–1.8px with round caps, in the current text colour.
- **Do** use the one ease, `cubic-bezier(0.16, 1, 0.3, 1)`, and drop looping motion under `prefers-reduced-motion`.

### Don't:
- **Don't** round any container, button, badge or caption corner (The Square Sheet Rule).
- **Don't** letter reference cities, peaks or rivers in vermilion.
- **Don't** draw a transport mode differently on the map and in the legend.
- **Don't** set prose in the condensed face or labels in the serif. Don't set Chinese in anything but Noto Serif TC.
- **Don't** turn the page into a dark vector basemap with floating photo cards. The sheet stays light and printed, and only the plate viewer goes dark.
- **Don't** use glows, coloured shadows or hard offset shadows. The only lift is the soft downward paper shadow.
