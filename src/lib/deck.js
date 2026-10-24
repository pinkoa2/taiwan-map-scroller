// The deck's geometry, shared by Deck.svelte and App's warm-up of the next
// place's photos (both must ask for the same image size to share the cache).

// The deck's ground. Wide: the right half of the sheet, clear of the badge
// above (the place sits in the left half). Phone: the middle of the screen,
// under the place's band at the top. The controls sit under it.
export function deckArea(w, h, edge, wide) {
  if (!wide) {
    const top = h * 0.21
    const bottom = h * 0.88 - 34
    return { left: 14, right: w - 14, top, bottom, cx: w / 2, cy: (top + bottom) / 2 }
  }
  const left = Math.max(w * 0.47, w / 2 - 40)
  const right = w - edge - 56
  const top = edge + 74
  const bottom = h - edge - 104
  return { left, right, top, bottom, cx: (left + right) / 2, cy: (top + bottom) / 2 }
}

// A print's size: the photo as large as fits, plus its paper mount (10px
// sides, a 46px foot for the caption and count).
export function printSize(photo, area, wide) {
  const aspect = photo.w / photo.h
  const maxW = Math.min(660, area.right - area.left - (wide ? 40 : 26))
  const maxH = area.bottom - area.top - 56
  const iw = Math.min(maxW, maxH * aspect)
  return { iw, ih: iw / aspect, pw: iw + 20, ph: iw / aspect + 10 + 46 }
}

// The `sizes` for a print's image. Past 2× the extra pixels don't show at
// print size, so a 3× phone is told a smaller width and fetches a lighter file.
export function printSizes(iw) {
  const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1
  return `${Math.round((iw * Math.min(dpr, 2)) / Math.max(dpr, 1))}px`
}
