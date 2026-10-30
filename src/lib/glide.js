// Glide: the page rests at a few places (the title card, each place's words,
// each deck of photos, the close), and moves itself between them. Once you
// scroll on from one, it carries you to the next at an easy pace, so a route
// draws as one smooth move instead of a long drag (the user asked, Oct 30,
// 2026: a first-time reader didn't like scrolling and scrolling). It works
// both ways (the user asked): scroll back up and it glides back to the stop
// before, and scrolling the other way mid-glide turns it around.

// stops(): [{ top, bottom, snug, skip }] in page order. Between top and bottom
// the page scrolls freely (a page of words taller than the screen); snug stops
// (a phone deck) need a firmer scroll to leave, so a stray one mid-swipe
// doesn't carry the deck off. skip (a deck): where the deck has lifted away.
// Leaving a deck forward hops straight there, so the route sets off at once
// instead of after a stretch of the deck sitting still (the user found the
// skip button so slow to get going it seemed not to work).
// moves(a, b): whether the map animates between two scroll positions. The
// glide keeps the easy pace there and hurries through the rest (cards and
// pages sliding away; the user asked, Oct 30, 2026).
export function glider(stops, moves = () => true) {
  const html = document.documentElement
  const still = matchMedia('(prefers-reduced-motion: reduce)')
  // Screen heights per second while the map moves (the user found 1.1 too
  // fast, then liked 0.6), and through everything else; the shortest and
  // longest glide.
  const PACE = 0.6
  const HURRY = 3.5
  const SHORTEST = 500
  const LONGEST = 9000

  let anchor = scrollY
  // The glide under way: { k, dir (1 down, -1 up), raf }.
  let run = null
  let idle = 0
  // Wheel events still coming from the gesture that started a glide (a
  // trackpad's coast) are swallowed until the wheel goes quiet.
  let swallow = false
  let lastWheel = 0
  // A touch that began while gliding is held until the finger lifts.
  let touchY = 0
  let held = false

  const ease = (t) => 0.5 - Math.cos(Math.PI * t) / 2

  function stopAt(y) {
    return stops().find((s) => y >= s.top - 2 && y <= s.bottom + 2)
  }

  // The first stop below y, and the last one above it.
  function nextIndex(y) {
    return stops().findIndex((s) => s.top > y + 4)
  }

  function prevIndex(y) {
    return stops().findLastIndex((s) => s.bottom < y - 4)
  }

  // Going down, a stop is reached at its top; going up, at its foot (the end
  // of a long page of words, where you'd left it).
  const landing = (s, dir) => (dir > 0 ? s.top : s.bottom)

  function go(k, dir) {
    const list = stops()
    if (k < 0 || !list[k]) return
    end()
    if (dir > 0) {
      const here = stops().findLast((s) => s.skip != null && s.top <= scrollY + 4 && s.skip > scrollY)
      if (here && here.skip < landing(list[k], dir)) scrollTo({ top: here.skip, behavior: 'instant' })
    }
    const from = scrollY
    if (still.matches) {
      scrollTo({ top: landing(list[k], dir), behavior: 'instant' })
      anchor = scrollY
      return
    }
    const plan = timing(from, landing(list[k], dir))
    const duration = Math.min(Math.max(plan.total, SHORTEST), LONGEST)
    const t0 = performance.now()
    html.classList.add('gliding')
    swallow = true
    run = { k, dir, raf: 0 }
    const frame = (now) => {
      if (!run) return
      // Re-read each frame: the page can re-measure mid-glide (a phone's
      // address bar coming and going).
      const s = stops()[k]
      const target = s ? landing(s, dir) : from
      const t = Math.min((now - t0) / duration, 1)
      scrollTo({ top: from + (target - from) * plan.at(ease(t)), behavior: 'instant' })
      if (t < 1) run.raf = requestAnimationFrame(frame)
      else {
        end()
        anchor = target
      }
    }
    run.raf = requestAnimationFrame(frame)
  }

  // How the glide spends its time between two positions: slow where the
  // map moves, quick elsewhere, the speed blended over about a quarter screen
  // so it never lurches. at(s) gives how far along (0–1) the glide is once
  // s (0–1) of its time has passed.
  function timing(from, to) {
    const STEP = 8
    const n = Math.max(Math.ceil(Math.abs(to - from) / STEP), 1)
    const d = (to - from) / n
    const slow = (PACE * innerHeight) / 1000
    const fast = (HURRY * innerHeight) / 1000
    const raw = Array.from({ length: n }, (_, i) => {
      const a = from + i * d
      return moves(Math.min(a, a + d), Math.max(a, a + d)) ? slow : fast
    })
    const w = Math.max(Math.round((innerHeight * 0.25) / STEP), 1)
    const sums = [0]
    for (const v of raw) sums.push(sums[sums.length - 1] + 1 / v)
    // Time per segment from the blended (harmonic mean) speed around it.
    const times = raw.map((_, i) => {
      const lo = Math.max(i - w, 0)
      const hi = Math.min(i + w + 1, n)
      return ((sums[hi] - sums[lo]) / (hi - lo)) * Math.abs(d)
    })
    const clock = [0]
    for (const t of times) clock.push(clock[clock.length - 1] + t)
    const total = clock[n]
    return {
      total,
      at(s) {
        const t = s * total
        let lo = 0
        let hi = n
        while (hi - lo > 1) {
          const mid = (lo + hi) >> 1
          if (clock[mid] <= t) lo = mid
          else hi = mid
        }
        const span = clock[hi] - clock[lo] || 1
        return Math.min((lo + (t - clock[lo]) / span) / n, 1)
      },
    }
  }

  function end() {
    if (!run) return
    cancelAnimationFrame(run.raf)
    run = null
    html.classList.remove('gliding')
    anchor = scrollY
  }

  // Scrolled the other way mid-glide: head back the way it came.
  function turn() {
    if (!run) return
    const dir = -run.dir
    const y = scrollY
    const k = dir > 0 ? nextIndex(y) : prevIndex(y)
    if (k >= 0) go(k, dir)
    else end()
  }

  function onScroll() {
    if (run) return
    const y = scrollY
    clearTimeout(idle)
    idle = setTimeout(() => {
      if (!run) anchor = scrollY
    }, 180)
    if (still.matches) return
    // Free inside a stop that's a stretch (a long page of words).
    const s = stopAt(anchor)
    if (s && s.bottom > s.top && y >= s.top && y <= s.bottom) {
      anchor = y
      return
    }
    const dir = y > anchor ? 1 : -1
    const from = s ? landing(s, -dir) : anchor
    const needed = s?.snug ? innerHeight * 0.15 : Math.max(36, innerHeight * 0.05)
    if ((y - from) * dir <= needed) return
    // On to the stop after (or before) where we were, or past it if a flick
    // already got there.
    if (dir > 0) {
      let k = nextIndex(anchor)
      if (k >= 0 && stops()[k].top < y) k = nextIndex(y)
      if (k >= 0) go(k, 1)
    } else {
      let k = prevIndex(anchor)
      if (k >= 0 && stops()[k].bottom > y) k = prevIndex(y)
      if (k >= 0) go(k, -1)
    }
  }

  function onWheel(e) {
    const fresh = e.timeStamp - lastWheel > 160
    lastWheel = e.timeStamp
    if (run) {
      e.preventDefault()
      if (Math.abs(e.deltaY) > 2 && Math.sign(e.deltaY) !== run.dir) turn()
      return
    }
    if (swallow && !fresh) e.preventDefault()
    else swallow = false
  }

  function onTouchStart(e) {
    touchY = e.touches[0]?.clientY ?? 0
    held = !!run
  }

  function onTouchMove(e) {
    if (!held) return
    const y = e.touches[0]?.clientY ?? touchY
    // A finger moving up scrolls the page down, and the other way round.
    const dir = y < touchY ? 1 : -1
    if (run && Math.abs(y - touchY) > 14 && dir !== run.dir) {
      turn()
      touchY = y
    }
    if (e.cancelable) e.preventDefault()
  }

  function onTouchEnd() {
    held = false
  }

  function onKey(e) {
    if (!run) return
    const up = ['ArrowUp', 'PageUp', 'Home'].includes(e.key)
    const down = ['ArrowDown', 'PageDown', 'End', ' '].includes(e.key)
    if (!up && !down) return
    e.preventDefault()
    if ((up ? -1 : 1) !== run.dir) turn()
  }

  addEventListener('scroll', onScroll, { passive: true })
  addEventListener('wheel', onWheel, { passive: false })
  addEventListener('touchstart', onTouchStart, { passive: true })
  addEventListener('touchmove', onTouchMove, { passive: false })
  addEventListener('touchend', onTouchEnd, { passive: true })
  addEventListener('touchcancel', onTouchEnd, { passive: true })
  addEventListener('keydown', onKey)

  return {
    // On to the next stop (the ↓ buttons), or back to the one before (↑).
    next() {
      go(nextIndex(scrollY), 1)
    },
    prev() {
      go(prevIndex(scrollY), -1)
    },
    // The page was moved on purpose (a jump to a stop): rest where it is.
    rest() {
      end()
      anchor = scrollY
    },
    destroy() {
      end()
      clearTimeout(idle)
      removeEventListener('scroll', onScroll)
      removeEventListener('wheel', onWheel)
      removeEventListener('touchstart', onTouchStart)
      removeEventListener('touchmove', onTouchMove)
      removeEventListener('touchend', onTouchEnd)
      removeEventListener('touchcancel', onTouchEnd)
      removeEventListener('keydown', onKey)
    },
  }
}
