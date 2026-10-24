// The photo curator: a small local app for choosing each place's photos,
// putting them in order, and writing captions and descriptions.
//
//   npm run curate   → http://localhost:4318
//
// It reads and writes the same files the site is built from:
//   content/media/<place>/photos.json   picks, times, captions, notes
//   content/order.json                  places set to a custom photo order
//   content/descriptions.json           each place's description, and the
//                                       title card's ("intro")
// Nothing else is touched. "Update site" rebuilds the preview (dist/).
//
// No dependencies beyond Node.

import http from 'node:http'
import fs from 'node:fs/promises'
import { existsSync, createReadStream } from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const content = path.join(root, 'content')
const media = path.join(content, 'media')
const thumbs = path.join(root, '.generated/public/m')
const descFile = path.join(content, 'descriptions.json')
const orderFile = path.join(content, 'order.json')
const MEDIA = /\.(jpe?g|png|webp|mp4|mov|webm|m4v)$/i
const VIDEO = /\.(mp4|mov|webm|m4v)$/i
const PORT = Number(process.env.PORT) || 4318

const readJSON = async (file, fallback) => (existsSync(file) ? JSON.parse(await fs.readFile(file, 'utf8')) : fallback)
const writeJSON = (file, data) => fs.writeFile(file, JSON.stringify(data, null, 2) + '\n')

// Places in trip order, with the hike as its own section after its place.
async function sections() {
  const trip = (await import(pathToFileURL(path.join(content, 'trip.js')).href + `?t=${Date.now()}`)).default
  // The title card first: just its description, no photos.
  const out = [{ id: 'intro', folder: null, name: trip.title ?? 'Title card', zh: trip.titleZh ?? '', when: 'Title card', kind: 'intro', text: trip.summary ?? '' }]
  for (const leg of trip.legs) {
    out.push({ id: leg.id, folder: leg.folder ?? leg.id, name: leg.name, zh: leg.zh ?? '', when: leg.when ?? '', kind: 'place', text: leg.text ?? '' })
    if (leg.walk) {
      const f = leg.walk.folder ?? `${leg.id}-walk`
      out.push({ id: f, folder: f, name: leg.walk.name, zh: leg.walk.zh ?? '', when: leg.walk.when ?? '', kind: 'walk', text: leg.walk.text ?? '' })
    }
  }
  return out
}

// A small preview for the grid: the site's 640px WebP when it's been built,
// otherwise the file itself.
function thumb(folder, entry) {
  const still = entry.poster ?? entry.file
  const base = still.replace(/\.[^.]+$/, '')
  return existsSync(path.join(thumbs, folder, `${base}-640.webp`)) ? `/thumb/${folder}/${base}-640.webp` : `/media/${folder}/${still}`
}

// A folder's photos.json, plus any media files dropped into the folder that
// it doesn't list yet (added with no time, marked new; fill the time in later
// in the picker).
async function photosOf(folder) {
  const file = path.join(media, folder, 'photos.json')
  const list = await readJSON(file, [])
  const known = new Set(list.flatMap((p) => [p.file, p.poster].filter(Boolean)))
  const names = existsSync(path.join(media, folder)) ? await fs.readdir(path.join(media, folder)) : []
  let added = false
  for (const name of names.sort()) {
    if (!MEDIA.test(name) || known.has(name) || /-poster\.jpe?g$/i.test(name)) continue
    const poster = name.replace(/\.[^.]+$/, '-poster.jpg')
    const entry = { file: name, caption: '', comment: '', taken: '', pick: false, show: true, new: true }
    if (VIDEO.test(name) && names.includes(poster)) entry.poster = poster
    list.push(entry)
    added = true
  }
  if (added) await writeJSON(file, list)
  return list
}

async function load() {
  const desc = await readJSON(descFile, {})
  const orders = await readJSON(orderFile, {})
  const list = await sections()
  for (const s of list) {
    s.description = desc[s.id] ?? ''
    s.placeholder = s.text
    s.order = s.folder && orders[s.folder] === 'custom' ? 'custom' : 'taken'
    const photos = s.folder ? await photosOf(s.folder) : []
    s.photos = photos.map((p) => ({ ...p, thumb: thumb(s.folder, p), video: VIDEO.test(p.file) }))
  }
  return list
}

// Move a photo (and a video's poster) to another place's folder, with its
// caption, note, time and pick. A clashing name gets -2, -3….
async function move({ from, to, file }) {
  for (const f of [from, to]) if (!/^[a-z0-9-]+$/.test(f) || !existsSync(path.join(media, f))) throw new Error('bad place')
  if (from === to) return
  const src = await readJSON(path.join(media, from, 'photos.json'), [])
  const i = src.findIndex((p) => p.file === file)
  if (i < 0) throw new Error(`no ${file} in ${from}`)
  const entry = src[i]
  const free = (name) => {
    const ext = path.extname(name)
    const stem = name.slice(0, -ext.length)
    let n = 1
    let out = name
    while (existsSync(path.join(media, to, out))) out = `${stem}-${++n}${ext}`
    return out
  }
  const newFile = free(entry.file)
  await fs.rename(path.join(media, from, entry.file), path.join(media, to, newFile))
  const moved = { ...entry, file: newFile }
  if (entry.poster) {
    const newPoster = newFile.replace(/\.[^.]+$/, '-poster.jpg')
    await fs.rename(path.join(media, from, entry.poster), path.join(media, to, newPoster))
    moved.poster = newPoster
  }
  src.splice(i, 1)
  await writeJSON(path.join(media, from, 'photos.json'), src)
  const dest = await readJSON(path.join(media, to, 'photos.json'), [])
  dest.push(moved)
  await writeJSON(path.join(media, to, 'photos.json'), dest)
}

// Save one section: its photos (in the order shown, which matters only when
// the place is set to a custom order), its order setting and description.
// Fields the curator doesn't edit are kept.
async function save({ id, folder, description, photos, order }) {
  if (!/^[a-z0-9-]+$/.test(id) || (folder != null && !/^[a-z0-9-]+$/.test(folder))) throw new Error('bad section')
  if (folder) {
    await savePhotos(folder, photos ?? [])
    const orders = await readJSON(orderFile, {})
    if (order === 'custom') orders[folder] = 'custom'
    else delete orders[folder]
    await writeJSON(orderFile, orders)
  }
  const desc = await readJSON(descFile, {})
  if (description?.trim()) desc[id] = description.trim()
  else delete desc[id]
  await writeJSON(descFile, desc)
}

async function savePhotos(folder, photos) {
  const file = path.join(media, folder, 'photos.json')
  const current = await readJSON(file, [])
  const byFile = new Map(current.map((p) => [p.file, p]))
  const next = photos.map((p) => {
    const was = byFile.get(p.file)
    if (!was) throw new Error(`unknown photo ${p.file}`)
    const out = { ...was, caption: p.caption ?? '', comment: p.comment ?? '', pick: !!p.pick, taken: p.taken ?? was.taken ?? '' }
    // New since the last import: kept until marked seen in the picker.
    if (p.new) out.new = true
    else delete out.new
    // The place's favourite: its deck opens on it. Only one, and only a pick.
    if (p.favorite && p.pick) out.favorite = true
    else delete out.favorite
    return out
  })
  // Anything the page didn't send stays, at the end.
  for (const p of current) if (!next.some((n) => n.file === p.file)) next.push(p)
  await writeJSON(file, next)
}

// "Update site": rebuild the preview the site is served from.
let build = { state: 'idle', log: '' }
function rebuild() {
  if (build.state === 'running') return
  build = { state: 'running', log: '', started: Date.now() }
  const run = spawn('sh', ['-c', 'node scripts/prepare-trip.js && npx vite build'], { cwd: root })
  const add = (d) => (build.log = (build.log + d).slice(-4000))
  run.stdout.on('data', add)
  run.stderr.on('data', add)
  run.on('close', (code) => (build = { ...build, state: code === 0 ? 'done' : 'failed', finished: Date.now() }))
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.png': 'image/png', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.woff': 'font/woff' }

function serveFile(res, file) {
  if (!existsSync(file)) return send(res, 404, 'Not found')
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' })
  createReadStream(file).pipe(res)
}

function send(res, code, body, type = 'text/plain') {
  res.writeHead(code, { 'Content-Type': type })
  res.end(body)
}

// Static paths are confined to their folder.
function inside(base, rel) {
  const file = path.resolve(base, '.' + path.sep + decodeURIComponent(rel))
  return file.startsWith(base + path.sep) ? file : null
}

const body = (req) =>
  new Promise((ok, fail) => {
    let s = ''
    req.on('data', (d) => (s += d))
    req.on('end', () => {
      try {
        ok(JSON.parse(s || '{}'))
      } catch (e) {
        fail(e)
      }
    })
  })

const fonts = {
  barlow: path.join(root, 'node_modules/@fontsource/barlow-condensed'),
  serif: path.join(root, 'node_modules/@fontsource-variable/source-serif-4'),
  zh: path.join(root, 'node_modules/@fontsource/noto-serif-tc'),
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x')
    const p = url.pathname
    try {
      if (p === '/') return serveFile(res, path.join(here, 'index.html'))
      if (p === '/app.js' || p === '/app.css') return serveFile(res, path.join(here, p.slice(1)))
      if (p === '/api/trip') return send(res, 200, JSON.stringify(await load()), 'application/json')
      if (p === '/api/save' && req.method === 'POST') {
        await save(await body(req))
        return send(res, 200, '{"ok":true}', 'application/json')
      }
      if (p === '/api/move' && req.method === 'POST') {
        await move(await body(req))
        return send(res, 200, '{"ok":true}', 'application/json')
      }
      if (p === '/api/build' && req.method === 'POST') {
        rebuild()
        return send(res, 200, JSON.stringify(build), 'application/json')
      }
      if (p === '/api/build') return send(res, 200, JSON.stringify(build), 'application/json')
      for (const [prefix, base] of [
        ['/media/', media],
        ['/thumb/', thumbs],
        ...Object.entries(fonts).map(([k, v]) => [`/fonts/${k}/`, v]),
      ]) {
        if (p.startsWith(prefix)) {
          const file = inside(base, p.slice(prefix.length))
          return file ? serveFile(res, file) : send(res, 403, 'No')
        }
      }
      send(res, 404, 'Not found')
    } catch (e) {
      send(res, 500, String(e.message ?? e))
    }
  })
  .listen(PORT, () => console.log(`Photo curator: http://localhost:${PORT}`))
