// Downloads the photos zip from Google Drive into photos/ (not committed).
//
// The link is PHOTOS_ZIP_URL in .env, a Drive share link
// (https://drive.google.com/file/d/<id>/view?...). The zip is saved as
// photos/photos.zip, replacing any earlier one only once the new one has
// fully arrived. See docs/hosting-plan.md.
//
// Usage: npm run photos:download

import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'photos')
const outFile = path.join(outDir, 'photos.zip')
const partFile = outFile + '.part'

try { process.loadEnvFile(path.join(root, '.env')) } catch {}
const link = process.env.PHOTOS_ZIP_URL
if (!link) fail('PHOTOS_ZIP_URL is not set. Copy .env.example to .env and add the Drive link.')
const id = link.match(/\/d\/([\w-]+)/)?.[1] ?? link.match(/[?&]id=([\w-]+)/)?.[1]
if (!id) fail(`Can't find a Drive file ID in ${link}`)

// Large files skip Drive's "can't scan for viruses" page with confirm=t. If
// Drive still answers with that page, its form holds the real download link.
let url = `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`
let res = await fetch(url)
if (res.ok && res.headers.get('content-type')?.includes('text/html')) {
  const html = await res.text()
  const action = html.match(/<form[^>]+action="([^"]+)"/)?.[1]
  if (!action) fail("Drive sent a web page instead of the zip. Is the link shared as \"Anyone with the link\"?")
  const params = new URLSearchParams()
  for (const [, name, value] of html.matchAll(/<input[^>]+name="([^"]+)"[^>]+value="([^"]*)"/g)) params.set(name, value)
  url = `${action.replaceAll('&amp;', '&')}?${params}`
  res = await fetch(url)
}
if (!res.ok) fail(`Download failed: ${res.status} ${res.statusText}`)

const total = Number(res.headers.get('content-length')) || 0
const name = res.headers.get('content-disposition')?.match(/filename="?([^";]+)"?/)?.[1]
console.log(`Downloading ${name ?? 'the zip'}${total ? ` (${size(total)})` : ''} → ${path.relative(root, outFile)}`)

fs.mkdirSync(outDir, { recursive: true })
let got = 0
const start = Date.now()
const timer = setInterval(bar, 250)
const body = Readable.fromWeb(res.body)
body.on('data', (chunk) => { got += chunk.length })
try {
  await pipeline(body, fs.createWriteStream(partFile))
} catch (err) {
  clearInterval(timer)
  process.stdout.write('\n')
  fail(`Download stopped: ${err.message}. Run it again to start over.`)
}
clearInterval(timer)
bar()
process.stdout.write('\n')
fs.renameSync(partFile, outFile)
console.log(`Done: ${size(got)} in ${Math.round((Date.now() - start) / 1000)}s`)

function bar() {
  const secs = (Date.now() - start) / 1000
  const speed = got / Math.max(secs, 0.001)
  if (!total) return process.stdout.write(`\r  ${size(got)}  ${size(speed)}/s   `)
  const frac = Math.min(got / total, 1)
  const width = 30
  const filled = Math.round(frac * width)
  const eta = speed > 0 ? Math.round((total - got) / speed) : 0
  process.stdout.write(
    `\r  [${'#'.repeat(filled)}${'-'.repeat(width - filled)}] ${String(Math.floor(frac * 100)).padStart(3)}%` +
    `  ${size(got)} / ${size(total)}  ${size(speed)}/s  ${clock(eta)} left   `
  )
}

function size(bytes) {
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(2) + ' GB'
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + ' MB'
  return Math.round(bytes / 1e3) + ' KB'
}

function clock(secs) {
  const m = Math.floor(secs / 60)
  return m ? `${m}m ${String(secs % 60).padStart(2, '0')}s` : `${secs}s`
}

function fail(message) {
  console.error(message)
  process.exit(1)
}
