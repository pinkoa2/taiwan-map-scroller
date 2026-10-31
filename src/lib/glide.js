// Glide: the page rests at a few places (the title card, each place's words,
// each deck of photos, the close), and moves itself between them, so a route
// draws as one smooth move instead of a long drag (the user asked, Oct 30,
// 2026: a first-time reader didn't like scrolling and scrolling).
//
// Scrolling works like the ↓ ↑ buttons (the user asked): one scroll gesture
// (a wheel flick, a trackpad swipe, a swipe on a phone, an arrow or page key)
// moves exactly one stop, on or back, and the page never scrolls freely in
// between. While it glides, nothing moves it: gestures, keys and the buttons
// all wait until it lands.

// stops(): [{ top, bottom, skip }] in page order. Between top and bottom the
// page scrolls freely (a page of words taller than the screen). skip (a deck):
// where the deck has lifted away; leaving a deck forward hops straight there,
// so the route sets off at once instead of after a stretch of the deck sitting
// still (the user found the skip button so slow to get going it seemed not to
// work).
// moves(a, b): whether the map animates between two scroll positions (or a
// speed of its own there, in px per ms). The glide keeps the easy pace there
// and hurries through the rest (cards and pages sliding away).
// enabled(): false while something else owns the gestures (the photo viewer).
export function glider(stops, moves = () => true, enabled = () => true) {
  const html = document.documentElement
  const still = matchMedia('(prefers-reduced-motion: reduce)')
  // Screen heights per second while the map moves (the user found 1.1 too
  // fast, then liked 0.6), and through everything else; the shortest and
  // longest glide.
  const PACE = 0.6
  const HURRY = 3.5
  const SHORTEST = 500
  const LONGEST = 14000

  // The glide under way: { k, dir (1 down, -1 up), raf }.
  let run = null
  // Just after landing, gestures still wait a moment (a flick's tail).
  let restUntil = 0
  const REST = 400

  // A wheel gesture: one stop per gesture. A trackpad keeps sending dying
  // events after the swipe (its coast); those belong to the same gesture.
  // A new one starts after a pause, or when the wheel picks up again (a
  // second swipe while the first still coasts), or once a gesture has gone
  // on long after the glide it set off has landed (scrolling on and on to
  // leave a deck).
  const QUIET = 250
  const LONG = 1200
  const WHEEL_STEP = 24
  let lastWheel = -Infinity
  let lastDelta = 0
  let acc = 0
  let firedAt = null
  let landedAt = -Infinity

  // A touch gesture: claimed as up-and-down or sideways on its first move
  // (sideways is the deck's, to flip prints; the same rule as Deck.svelte),
  // and it moves a stop once it has gone far enough.
  const SIDEWAYS = 0.7
  const TOUCH_STEP = 50
  let touch = null

  // Sets off at once at its average speed (a tap on ↓ must show at once; the
  // user wasn't sure a click had taken) and slows gently into the stop:
  // half sine in-out, half ease-out.
  const ease = (t) => 0.5 * (0.5 - Math.cos(Math.PI * t) / 2) + 0.5 * (1 - (1 - t) ** 2)

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

  // Inside a long page of words with more of it that way: scroll it as usual.
  function reading(dir) {
    const s = stopAt(scrollY)
    if (!s || s.bottom - s.top < 4) return false
    return dir > 0 ? scrollY < s.bottom - 1 : scrollY > s.top + 1
  }

  const ready = () => !run && performance.now() >= restUntil

  // One stop on (1) or back (-1). The buttons sit on a stop, so one a few
  // pixels off (the page settling after a jump) still counts as here.
  function step(dir) {
    if (!ready()) return
    go(dir > 0 ? nextIndex(scrollY + 40) : prevIndex(scrollY - 40), dir)
  }

  function go(k, dir) {
    const list = stops()
    if (k < 0 || !list[k]) return
    end()
    if (dir > 0) {
      const here = list.findLast((s) => s.skip != null && s.top <= scrollY + 40 && s.skip > scrollY)
      if (here && here.skip < landing(list[k], dir)) scrollTo({ top: here.skip, behavior: 'instant' })
    }
    const from = scrollY
    if (still.matches) {
      scrollTo({ top: landing(list[k], dir), behavior: 'instant' })
      restUntil = performance.now() + REST
      return
    }
    const plan = timing(from, landing(list[k], dir))
    const duration = Math.min(Math.max(plan.total, SHORTEST), LONGEST)
    const t0 = performance.now()
    html.classList.add('gliding')
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
        landedAt = performance.now()
        restUntil = landedAt + REST
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
      const m = moves(Math.min(a, a + d), Math.max(a, a + d))
      return typeof m === 'number' ? m : m ? slow : fast
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
  }

  function onWheel(e) {
    if (!enabled() || e.ctrlKey) return
    // Sideways (a trackpad swipe across the deck) is left alone.
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
    const dir = Math.sign(e.deltaY)
    if (!dir) return
    const now = performance.now()
    const delta = Math.abs(e.deltaY)
    const fresh =
      now - lastWheel > QUIET ||
      delta > lastDelta * 1.5 + 4 ||
      Math.sign(acc) === -dir ||
      (firedAt != null && !run && landedAt > firedAt && now - landedAt > LONG)
    lastWheel = now
    lastDelta = delta
    if (fresh) {
      acc = 0
      firedAt = null
    }
    if (!run && firedAt == null && reading(dir)) return
    e.preventDefault()
    if (firedAt != null) return
    acc += e.deltaY
    if (Math.abs(acc) >= WHEEL_STEP && ready()) {
      firedAt = now
      step(dir)
    }
  }

  function onTouchStart(e) {
    if (e.touches.length !== 1) {
      touch = null
      return
    }
    const t = e.touches[0]
    // A touch that begins mid-glide never moves a stop.
    touch = { x: t.clientX, y: t.clientY, way: null, done: !ready() }
  }

  function onTouchMove(e) {
    if (!touch || !enabled() || e.touches.length !== 1) return
    const t = e.touches[0]
    const dx = t.clientX - touch.x
    const dy = t.clientY - touch.y
    if (touch.way == null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
      touch.way = Math.abs(dx) >= Math.abs(dy) * SIDEWAYS ? 'side' : 'up'
      // A finger moving up scrolls the page down.
      touch.reading = !run && reading(dy < 0 ? 1 : -1)
    }
    if (touch.way !== 'up' || touch.reading) return
    if (e.cancelable) e.preventDefault()
    if (!touch.done && Math.abs(dy) >= TOUCH_STEP && ready()) {
      touch.done = true
      step(dy < 0 ? 1 : -1)
    }
  }

  function onTouchEnd() {
    touch = null
  }

  function onKey(e) {
    if (!enabled() || e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey) return
    if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, button, a, dialog')) {
      if (e.key === ' ') return
    }
    const dir = { ArrowDown: 1, PageDown: 1, ArrowUp: -1, PageUp: -1, ' ': e.shiftKey ? -1 : 1 }[e.key]
    if (!dir) return
    if (!run && reading(dir)) return
    e.preventDefault()
    if (!e.repeat) step(dir)
  }

  addEventListener('wheel', onWheel, { passive: false })
  addEventListener('touchstart', onTouchStart, { passive: true })
  addEventListener('touchmove', onTouchMove, { passive: false })
  addEventListener('touchend', onTouchEnd, { passive: true })
  addEventListener('touchcancel', onTouchEnd, { passive: true })
  addEventListener('keydown', onKey)

  return {
    // The ↓ ↑ buttons.
    next() {
      step(1)
    },
    prev() {
      step(-1)
    },
    // The page was moved on purpose (a jump to a stop): rest where it is.
    rest() {
      end()
    },
    destroy() {
      end()
      removeEventListener('wheel', onWheel)
      removeEventListener('touchstart', onTouchStart)
      removeEventListener('touchmove', onTouchMove)
      removeEventListener('touchend', onTouchEnd)
      removeEventListener('touchcancel', onTouchEnd)
      removeEventListener('keydown', onKey)
    },
  }
}
