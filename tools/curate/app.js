// The photo picker. One place at a time: click photos to pick them, write a
// caption and an optional note on any card, set or fix a photo's time, move
// a photo to another place, and write a description for the place.
//
// Photos run in the order they were taken. A place can be switched to a
// custom order: moving a picked photo earlier or later does that, and
// "By time taken" switches back. Everything saves by itself into the
// project's JSON files; "Update site" rebuilds the preview.

const $ = (sel, el = document) => el.querySelector(sel)

const state = {
  sections: [],
  at: 0,
  filter: 'all', // 'all' | 'picked' | 'new'
}

// ---------- tiny DOM helper ----------

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue
    if (k === 'class') el.className = v
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v)
    else if (k === 'html') el.innerHTML = v
    else el.setAttribute(k, v === true ? '' : v)
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : document.createTextNode(kid))
  return el
}

// The longest caption the picker takes (see the caption field).
const CAPTION_MAX = 48

const ICON_UP = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M10 3.5 5.5 8l4.5 4.5"/></svg>'
const ICON_STAR = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 3.2l2.6 5.5 6 .8-4.4 4.1 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.5l6-.8z"/></svg>'
const ICON_DOWN = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5"/></svg>'

// ---------- order ----------

// By time taken; photos with no time yet go last, in the order they were added.
const byTaken = (a, b) => (a.taken ? (b.taken ? a.taken.localeCompare(b.taken) : -1) : b.taken ? 1 : 0)

// The order photos show in, here and on the site.
const ordered = (s) => (s.order === 'custom' ? s.list : [...s.list].sort(byTaken))
const picks = (s) => ordered(s).filter((p) => p.pick)
// Photos added since the last import, until marked seen.
const fresh = (s) => ordered(s).filter((p) => p.new)

// 'YYYY-MM-DD HH:MM' ⇄ the time input's 'YYYY-MM-DDTHH:MM'.
const toInput = (t) => (t ? t.replace(' ', 'T').slice(0, 16) : '')
const fromInput = (v) => (v ? v.replace('T', ' ') : '')

// ---------- status ----------

function status(text, bad = false) {
  const el = $('#status')
  el.textContent = text
  el.classList.toggle('bad', bad)
}

// ---------- saving ----------

// Two people can use the picker at once (it's on the wifi), so a save sends
// only what was changed here, field by field, and the server merges it into
// the file as it is now. Nothing someone else changed is written back.
let saveTimer = null
// section → { photos: Map(file → { p, fields: Set }), description, order, arrangement }
const dirty = new Map()

function edits(s) {
  if (!dirty.has(s)) dirty.set(s, { photos: new Map(), description: false, order: false, arrangement: false })
  return dirty.get(s)
}

function schedule() {
  status('Saving…')
  clearTimeout(saveTimer)
  saveTimer = setTimeout(flush, 500)
}

// A photo's fields changed: 'pick', 'favorite', 'caption', 'comment', 'taken', 'new'.
function changed(s, p, ...fields) {
  const e = edits(s).photos
  if (!e.has(p.file)) e.set(p.file, { p, fields: new Set() })
  for (const f of fields) e.get(p.file).fields.add(f)
  schedule()
}

// The place's description, its order setting, or its custom arrangement changed.
function changedPlace(s, what) {
  edits(s)[what] = true
  schedule()
}

function payload(s, e) {
  const out = { id: s.id, folder: s.folder }
  if (e.description) out.description = s.description
  if (e.order) out.order = s.order
  if (e.arrangement && s.order === 'custom') out.arrangement = s.list.map((p) => p.file)
  out.changes = [...e.photos.values()].map(({ p, fields }) => {
    const c = { file: p.file }
    for (const f of fields) c[f] = f === 'pick' || f === 'favorite' || f === 'new' ? !!p[f] : (p[f] ?? '')
    return c
  })
  return out
}

// Put unsent edits back after a failed save (newer edits made meanwhile win).
function merge(s, e) {
  const now = edits(s)
  for (const [file, x] of e.photos) {
    if (!now.photos.has(file)) now.photos.set(file, { p: x.p, fields: new Set() })
    for (const f of x.fields) now.photos.get(file).fields.add(f)
  }
  for (const k of ['description', 'order', 'arrangement']) now[k] ||= e[k]
}

async function flush() {
  const list = [...dirty]
  dirty.clear()
  for (let i = 0; i < list.length; i++) {
    const [s, e] = list[i]
    try {
      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload(s, e)),
      })
      if (!res.ok) throw new Error(await res.text())
    } catch (err) {
      status(`Couldn't save ${s.name}: ${err.message}. Retrying…`, true)
      for (const [s2, e2] of list.slice(i)) merge(s2, e2)
      clearTimeout(saveTimer)
      saveTimer = setTimeout(flush, 3000)
      return
    }
  }
  status(`Saved · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`)
}

addEventListener('beforeunload', (e) => {
  if (dirty.size) {
    flush()
    e.preventDefault()
  }
})

// ---------- the list of places ----------

const countText = (s) => (s.kind === 'intro' ? '' : `${picks(s).length}/${s.list.length}`)

function renderPlaces() {
  $('#places').replaceChildren(
    ...state.sections.map((s, i) =>
      h(
        'li',
        { class: s.kind === 'walk' ? 'walk' : s.kind === 'intro' ? 'intro' : null },
        h(
          'button',
          { 'aria-current': i === state.at ? 'true' : 'false', onclick: () => go(i) },
          h(
            'span',
            {},
            h('span', { class: 'lettering name' }, s.name),
            s.zh ? h('span', { class: 'zh' }, s.zh) : null,
            h('span', { class: 'lettering fresh', 'data-fresh': i, hidden: !s.list?.some((p) => p.new) }, newText(s)),
          ),
          h('span', { class: 'lettering count', 'data-count': i }, countText(s)),
          h('span', { class: 'lettering when' }, s.when || ' '),
        ),
      ),
    ),
  )
}

const newText = (s) => (s.list ? `${fresh(s).length} new` : '')

function refreshCount(s) {
  const el = document.querySelector(`[data-count="${state.sections.indexOf(s)}"]`)
  if (el) el.textContent = countText(s)
  const nw = document.querySelector(`[data-fresh="${state.sections.indexOf(s)}"]`)
  if (nw) {
    nw.textContent = newText(s)
    nw.hidden = !fresh(s).length
  }
  const meta = $('#picked-count')
  if (meta && state.sections[state.at] === s) meta.textContent = picks(s).length
}

function go(i) {
  state.at = i
  state.filter = 'all'
  history.replaceState(null, '', `#${state.sections[i].id}`)
  renderPlaces()
  renderSection()
  $('#section').focus()
  scrollTo({ top: 0 })
  refresh()
}

// ---------- one place ----------

function descriptionBox(s, rows, fallback) {
  const box = h('textarea', {
    rows,
    placeholder: s.placeholder ? `Now on the site: “${s.placeholder}”` : fallback,
    oninput: (e) => {
      s.description = e.target.value
      changedPlace(s, 'description')
    },
  })
  box.value = s.description
  return box
}

function renderSection() {
  const s = state.sections[state.at]
  const main = $('#section')
  if (s.kind === 'intro') return renderIntro(s, main)

  const pill = (label, pressed, onclick) => h('button', { class: 'lettering', 'aria-pressed': pressed ? 'true' : 'false', onclick }, label)

  main.replaceChildren(
    h(
      'section',
      { class: 'head' },
      h(
        'div',
        {},
        h('h2', {}, s.name, s.zh ? h('span', { class: 'zh' }, s.zh) : null),
        h(
          'p',
          { class: 'meta lettering' },
          s.when ? h('span', {}, s.when) : null,
          h('span', {}, h('strong', { id: 'picked-count' }, String(picks(s).length)), ` picked of ${s.list.length}`),
        ),
        h(
          'p',
          { class: 'hint' },
          'Click a photo to pick it. Star one pick as the favourite: the place’s photos open on it. Photos run in the order they were taken; use the arrows on a picked photo to order them yourself.',
        ),
      ),
      h('label', { class: 'field description' }, h('span', { class: 'lettering' }, s.kind === 'walk' ? 'About the hike' : 'About this place'), descriptionBox(s, 5, 'A few lines about this place…')),
      h(
        'div',
        { class: 'filter' },
        pill(`All ${s.list.length}`, state.filter === 'all', () => {
          state.filter = 'all'
          renderSection()
        }),
        pill('Picked only', state.filter === 'picked', () => {
          state.filter = 'picked'
          renderSection()
        }),
        fresh(s).length
          ? pill(`New ${fresh(s).length}`, state.filter === 'new', () => {
              state.filter = 'new'
              renderSection()
            })
          : null,
        fresh(s).length
          ? h(
              'button',
              {
                class: 'lettering clear seen',
                title: 'Clear the New marks on this place’s photos',
                onclick: () => {
                  for (const p of s.list)
                    if (p.new) {
                      p.new = false
                      changed(s, p, 'new')
                    }
                  if (state.filter === 'new') state.filter = 'all'
                  renderSection()
                  refreshCount(s)
                },
              },
              'Mark all seen',
            )
          : null,
        h('span', { class: 'gap' }),
        h('span', { class: 'lettering label' }, 'Order'),
        pill('By time taken', s.order !== 'custom', () => {
          if (s.order === 'custom') {
            s.order = 'taken'
            changedPlace(s, 'order')
            renderSection()
          }
        }),
        pill('Custom', s.order === 'custom', () => {
          if (s.order !== 'custom') setCustom(s)
          renderSection()
        }),
        h(
          'button',
          {
            class: 'lettering clear',
            onclick: () => {
              const n = picks(s).length
              if (!n || !confirm(`Drop all ${n} picks for ${s.name}?`)) return
              for (const p of s.list)
                if (p.pick) {
                  p.pick = false
                  p.favorite = false
                  changed(s, p, 'pick', 'favorite')
                }
              renderSection()
              refreshCount(s)
            },
          },
          'Clear picks',
        ),
      ),
    ),
    grid(s),
  )
}

// The title card: Taiwan and a short description, nothing else.
function renderIntro(s, main) {
  main.replaceChildren(
    h(
      'section',
      { class: 'head intro' },
      h(
        'div',
        {},
        h('h2', {}, s.name, s.zh ? h('span', { class: 'zh' }, s.zh) : null),
        h('p', { class: 'meta lettering' }, h('span', {}, 'Title card · the first thing on the page')),
        h('p', { class: 'hint' }, 'Write a short description of the trip. It sits under the title on the opening map. A blank line starts a new paragraph.'),
      ),
      h('label', { class: 'field description' }, h('span', { class: 'lettering' }, 'Description'), descriptionBox(s, 6, 'A line or two about the trip…')),
    ),
  )
}

// Freeze the current order as the custom one, so it can be rearranged.
function setCustom(s) {
  s.list = ordered(s)
  s.order = 'custom'
  changedPlace(s, 'order')
  changedPlace(s, 'arrangement')
}

function grid(s) {
  const list = state.filter === 'picked' ? picks(s) : state.filter === 'new' ? fresh(s) : ordered(s)
  if (!list.length) return h('p', { class: 'empty-note lettering' }, state.filter === 'picked' ? 'Nothing picked yet. Switch to All and click the photos you want.' : state.filter === 'new' ? 'No new photos here.' : 'No photos here yet.')
  const wrap = h('div', { class: 'grid' })
  for (const p of list) wrap.append(card(s, p))
  return wrap
}

function card(s, p) {
  const badge = h('span', { class: 'badge' })
  // The favourite: the photo this place's deck opens on. One per place.
  const star = h('button', {
    class: 'star',
    html: ICON_STAR,
    onclick: () => {
      const on = !p.favorite
      for (const o of s.list)
        if (o.favorite && o !== p) {
          o.favorite = false
          changed(s, o, 'favorite')
        }
      p.favorite = on
      changed(s, p, 'favorite')
      repaintAll()
    },
  })
  const up = h('button', { 'aria-label': 'Move earlier', title: 'Move earlier', html: ICON_UP })
  const down = h('button', { 'aria-label': 'Move later', title: 'Move later', html: ICON_DOWN })
  const move = h('span', { class: 'move' }, up, down)
  const el = h('article', { class: 'card' })

  function paint() {
    const list = picks(s)
    const n = list.indexOf(p)
    el.classList.toggle('picked', n >= 0)
    badge.classList.toggle('empty', n < 0)
    badge.textContent = n >= 0 ? String(n + 1) : 'Pick'
    up.disabled = n <= 0
    down.disabled = n < 0 || n === list.length - 1
    move.hidden = n < 0
    if (n < 0) p.favorite = false
    star.hidden = n < 0
    star.classList.toggle('on', !!p.favorite)
    star.setAttribute('aria-pressed', p.favorite ? 'true' : 'false')
    star.setAttribute('aria-label', p.favorite ? 'Favourite: the place opens on this photo' : 'Make this the favourite')
    star.title = p.favorite ? 'Favourite: the place opens on this photo' : 'Make this the favourite'
    el.classList.toggle('favorite', !!p.favorite)
  }
  el.paint = paint

  const repaintAll = () => {
    for (const c of document.querySelectorAll('.card')) c.paint?.()
    refreshCount(s)
  }

  // Swap with the neighbouring pick; this makes the place's order custom.
  const shift = (d) => {
    if (s.order !== 'custom') setCustom(s)
    const list = picks(s)
    const n = list.indexOf(p)
    const other = list[n + d]
    if (!other) return
    const a = s.list.indexOf(p)
    const b = s.list.indexOf(other)
    ;[s.list[a], s.list[b]] = [s.list[b], s.list[a]]
    changedPlace(s, 'arrangement')
    renderSection()
  }
  up.addEventListener('click', () => shift(-1))
  down.addEventListener('click', () => shift(1))

  const toggle = () => {
    p.pick = !p.pick
    if (!p.pick) p.favorite = false
    changed(s, p, 'pick', 'favorite')
    if (state.filter === 'picked') renderSection()
    else repaintAll()
  }

  // The caption: capped at CAPTION_MAX characters, about two lines under a
  // phone's photo (the user asked, Nov 3, 2026: long captions wrap to a
  // second line on the site, and no further). A count shows as it nears
  // the cap. Older captions over it are kept as they are until edited.
  const count = h('span', { class: 'cap-count lettering', 'aria-live': 'polite' })
  const showCount = () => {
    const n = [...(p.caption ?? '')].length
    count.textContent = n >= CAPTION_MAX - 12 ? `${n} / ${CAPTION_MAX}` : ''
    count.classList.toggle('full', n >= CAPTION_MAX)
  }
  const captionInput = h('input', {
    type: 'text',
    maxlength: CAPTION_MAX,
    placeholder: 'Caption, shown under the photo',
    oninput: (e) => {
      p.caption = e.target.value
      changed(s, p, 'caption')
      showCount()
    },
  })
  captionInput.value = p.caption ?? ''
  showCount()
  const caption = h('div', { class: 'cap' }, captionInput, count)

  const note = h('textarea', {
    rows: 2,
    placeholder: 'Note, on the back of the print (optional)',
    oninput: (e) => {
      p.comment = e.target.value
      changed(s, p, 'comment')
    },
  })
  note.value = p.comment ?? ''

  // The time it was taken: editable, for screenshots or anything without one.
  const time = h('input', {
    type: 'datetime-local',
    class: p.taken ? null : 'missing',
    title: p.taken ? 'When it was taken' : 'No time yet: set one to place it in order',
    onchange: (e) => {
      p.taken = fromInput(e.target.value)
      changed(s, p, 'taken')
      renderSection()
    },
  })
  time.value = toInput(p.taken)

  // Send it to another place: the file moves folders with its words and pick.
  const others = state.sections.filter((o) => o.folder && o !== s && o.folder !== 'unsorted')
  const moveTo = h(
    'select',
    {
      class: 'lettering',
      'aria-label': 'Move to another place',
      onchange: async (e) => {
        const to = others.find((o) => o.folder === e.target.value)
        if (!to) return
        await flush()
        status(`Moving to ${to.name}…`)
        const res = await fetch('/api/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: s.folder, to: to.folder, file: p.file }),
        })
        if (!res.ok) return status(`Couldn't move it: ${await res.text()}`, true)
        await reload()
        status(`Moved to ${to.name}${to.when ? ` (${to.when})` : ''}.`)
      },
    },
    h('option', { value: '' }, 'Move to…'),
    others.map((o) => h('option', { value: o.folder }, `${o.kind === 'walk' ? '↳ ' : ''}${o.name}${o.when ? ` · ${o.when}` : ''}`)),
  )

  el.append(
    h(
      'button',
      { class: 'photo', onclick: toggle, 'aria-label': `${p.file}: pick or drop` },
      // Previews are made from the zip one at a time on first view, so a wheel
      // turns until each arrives (or says so if it can't be made).
      h('span', { class: 'loading', 'aria-hidden': 'true' }),
      h('span', { class: 'failed lettering' }, 'No preview'),
      h('img', {
        src: p.thumb,
        alt: p.file.replace(/\.[^.]+$/, '').replace(/-/g, ' '),
        loading: 'lazy',
        decoding: 'async',
        onload: (e) => e.target.parentElement.classList.add('loaded'),
        onerror: (e) => e.target.parentElement.classList.add('failed'),
      }),
      badge,
      p.video ? h('span', { class: 'kind lettering' }, 'Video') : null,
      p.new ? h('span', { class: 'new-tag lettering' }, 'New') : null,
    ),
    star,
    p.video
      ? h(
          'div',
          { class: 'play-spot' },
          h('button', { class: 'play lettering', 'aria-label': `Play ${p.file}`, title: 'Play the video', onclick: () => play(p) }, h('span', { 'aria-hidden': 'true' }, '▶'), ' Play'),
        )
      : '',
    h('div', { class: 'body' }, h('div', { class: 'when-row' }, time, move), caption, note, moveTo),
  )
  paint()
  return el
}

// ---------- watch a video ----------

// The player: a small copy made from the zip on first play (a long clip takes
// a little while), then kept. Escape, the Close button or a click outside closes it.
let player
function play(p) {
  player?.remove()
  const video = h('video', { controls: true, autoplay: true, playsinline: true, preload: 'auto' })
  const wait = h('p', { class: 'wait lettering' }, 'Getting the video ready… a long one can take a minute the first time.')
  const close = () => {
    video.pause()
    video.removeAttribute('src')
    video.load()
    player.close()
    player.remove()
    player = null
  }
  video.addEventListener('loadeddata', () => wait.remove())
  video.addEventListener('error', () => {
    if (video.getAttribute('src')) wait.textContent = 'This video couldn’t be played.'
  })
  player = h(
    'dialog',
    { class: 'player', 'aria-label': p.file, onclose: () => player && close(), onclick: (e) => e.target === player && close() },
    h(
      'div',
      { class: 'player-box' },
      h('div', { class: 'player-head' }, h('span', { class: 'lettering' }, p.caption || p.file), h('button', { class: 'lettering', onclick: close }, 'Close')),
      h('div', { class: 'player-stage' }, wait, video),
    ),
  )
  document.body.append(player)
  player.showModal()
  video.src = p.clip
}

// ---------- update site ----------

async function pollBuild() {
  const btn = $('#build')
  const b = await (await fetch('/api/build')).json()
  if (b.state === 'running') {
    btn.disabled = true
    btn.textContent = 'Updating…'
    setTimeout(pollBuild, 1000)
    return
  }
  btn.disabled = false
  btn.textContent = 'Update site'
  if (b.state === 'done') status('Site updated. Reload it to see your picks.')
  if (b.state === 'failed') status(`Update failed: ${b.log.split('\n').filter(Boolean).slice(-2).join(' ')}`, true)
}

$('#build').addEventListener('click', async () => {
  if (dirty.size) await flush()
  await fetch('/api/build', { method: 'POST' })
  pollBuild()
})

// ---------- start ----------

async function reload() {
  const sections = await (await fetch('/api/trip')).json()
  // s.list keeps photos.json's order (what a custom order uses).
  for (const s of sections) s.list = s.photos
  const current = state.sections[state.at]?.id ?? location.hash.slice(1)
  state.sections = sections
  const i = sections.findIndex((s) => s.id === current)
  state.at = i >= 0 ? i : 0
  renderPlaces()
  renderSection()
}

// Pick up what someone else changed: on opening a place and on coming back
// to this tab. Our own edits are sent first; not while typing in a field.
let refreshing = false
async function refresh() {
  if (refreshing) return
  refreshing = true
  try {
    if (dirty.size) await flush()
    if (dirty.size || document.activeElement?.matches('input, textarea, select')) return
    const y = scrollY
    await reload()
    scrollTo({ top: y })
  } catch {
    // Offline for a moment: the next refresh will catch up.
  } finally {
    refreshing = false
  }
}
addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refresh()
})

reload()
  .then(() => status('All changes save by themselves.'))
  .catch((e) => status(`Couldn't load the trip: ${e.message}`, true))
