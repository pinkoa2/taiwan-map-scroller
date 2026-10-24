// Words for each transport mode, as the page writes them.
export const modeName = {
  train: 'Train',
  metro: 'Metro',
  bus: 'Bus',
  car: 'Car',
  walk: 'On foot',
  flight: 'Flight',
  ferry: 'Ferry',
}

export const modeLegend = ['train', 'bus', 'car', 'walk']

// "Bus to Ruifang, then train" from a leg's segments.
export function howWeGotThere(segments) {
  return segments
    .map((s, i) => {
      const word = modeName[s.mode] ?? s.mode
      const lead = i === 0 ? `By ${word.toLowerCase()}` : `then ${word.toLowerCase()}`
      return s.toName ? `${lead} to ${s.toName}` : lead
    })
    .join(', ')
    .replace('By on foot', 'On foot')
}

export const fmtDist = (n, unit) => `${n < 10 ? n.toFixed(1).replace(/\.0$/, '') : Math.round(n)} ${unit}`
