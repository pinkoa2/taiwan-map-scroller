# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Same as the sibling project `iceland-postcards`: Svelte 5 + Vite, fully static output, no backend, no API keys. Deploys to GitHub Pages under `pinkoa2.lol` (subdomain to be confirmed, likely `taiwan.pinkoa2.lol`).

## Users

Two audiences, weighted equally (same as Iceland):

- **Friends and family**, opening a shared link, mostly on a phone (group chat, social). They skim the trip in a few minutes.
- **The travellers themselves** (Alex and Ting), who keep the site as a keepsake to relive the trip later, so completeness matters.

Phone and desktop are weighted equally, and each gets a deliberately designed layout. The link preview (title, image, description) is part of the product.

## Product Purpose

A single scroll-driven page that tells our month in Taiwan (2026) as a journey. A map of Taiwan follows the route as you scroll. Photos and short write-ups appear at each place, so the reader always knows where on the island and where in the trip they are. Success means a friend scrolls to the end and feels the trip, and the travellers want to come back to it.

## Positioning

A personal, journey-shaped record of this one trip. The map and route lead, told in the order it happened through our own photos. It is not a photo dump, a feed, a blog template, or a reuse of the Iceland postcards design.

## Operating Context

- **Taiwan only.** It has its own design. Nothing needs to be shared with or reusable from Iceland.
- **A keepsake, not a live tracker.** No "we are here now" state. Only completed legs appear. The trip is still ongoing, so legs are added as they happen, and adding a leg must be easy.
- **Content lives apart from the code** (as in Iceland: one content data file plus per-leg media folders).
- **Mock-up photos first.** Real photos come later from the user. Placeholders must be obviously replaceable and never presented as real.

## Capabilities and Constraints

- Organised **by place/leg** (chapters per city or region), with days inside each leg.
- The map draws the route between legs **in the transport mode actually used**: train/HSR, scooter/car, flights/ferries, walking/hiking. Each mode must read differently.
- Hikes can be drawn as trails at a closer zoom (e.g. the Mianyue Line).
- Desktop and mobile both supported.
- Fast on a phone: responsive image sizes, no loading the whole trip's media up front.
- Never invent places, dates or claims. Captions and descriptions come from the user.
- Distances in miles (the user's units).

## Evidence on Hand

Itinerary so far, as given by the user (dates not yet provided):

1. Landed in **Taipei**, 4 days exploring the city.
2. **Shifen**, then the night in **Jiufen** (user wrote "Jeifen").
3. **Shuinandong**, then back to **Taipei** for the night.
4. To **Yunlin**.
5. **Alishan**: hiked the **Mianyue Line** trail. About 10 miles, "a little dangerous", 6 hours, a highlight of the trip for Alex.
6. Back to **Yunlin**.
7. Not done yet: **Tainan** and **Kaohsiung** are planned.

Transport: Taipei → Shifen train; Shifen → Jiufen train; Jiufen → Shuinandong bus; Shuinandong → Taipei bus + train; Taipei → Yunlin train; everything since by car; Mianyue Line on foot.

Real photos imported Oct 23, 2026: 215 photos and 7 videos, sorted per place in `content/media/`, GPS stripped; dates come from their timestamps (Oct 12–22). Tamsui and Sun Moon Lake added as day trips; Yunlin is Dounan. Captions not yet written.

## Product Principles

1. **The trip is the interface.** The map, route and photos lead, and UI chrome recedes.
2. **Always show where we are.** At any scroll position the reader knows the place, the leg and the point in the month.
3. **A journey, not a list.** Progression through space and time, at the island's scale and at a trail's.
4. **Easy to grow.** Adding a leg or photos means editing content, never components.
5. **Fast on a phone over cellular.**
