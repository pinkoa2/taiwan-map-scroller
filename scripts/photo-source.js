// Where photos come from: the Drive zip (photos/photos.zip, from
// `npm run photos:download`), found by each entry's `original` name
// (e.g. IMG_0517.HEIC). Shared by prepare-trip.js and the picker.
//
// Without a zip, or for an entry the zip doesn't have (a screenshot added by
// hand), the old copy in content/media/<folder>/<file> is used if it's there.
//
// iPhone HEIC needs its own decoder (sharp's can only read AVIF); videos are
// read by ffmpeg, so they're copied out of the zip to a temporary file first.

import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { buffer } from 'node:stream/consumers'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import yauzl from 'yauzl'
import decodeHeic from 'heic-decode'
import sharp from 'sharp'

const run = promisify(execFile)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const mediaDir = path.join(root, 'content', 'media')
export const zipFile = path.join(root, 'photos', 'photos.zip')
export const VIDEO = /\.(mp4|mov|webm|m4v)$/i

let zip = null

// The zip's files by name (folders inside it don't matter), or null without one.
export async function openZip() {
  if (zip !== null) return zip.byName ? zip : null
  if (!existsSync(zipFile)) return (zip = {}), null
  const file = await yauzl.openPromise(zipFile, { lazyEntries: true, autoClose: false })
  const byName = new Map()
  for await (const entry of file.eachEntry()) {
    if (entry.fileName.endsWith('/')) continue
    const name = path.posix.basename(entry.fileName)
    // macOS zips carry ._ shadow files; Drive's duplicate downloads end in "(1)".
    if (name.startsWith('._') || /\(\d+\)\.[^.]+$/.test(name)) continue
    byName.set(name.toUpperCase(), entry)
  }
  zip = { file, byName }
  return zip
}

// iPhone Live Photos come out of Drive as IMG_1234.HEIC plus a short
// IMG_1234.MP4. The MP4 is the moving part of the photo, not a video to show.
export function isLivePart(name, names) {
  if (!VIDEO.test(name)) return false
  const stem = name.replace(/\.[^.]+$/, '').toUpperCase()
  return ['HEIC', 'JPG', 'JPEG'].some((ext) => names.has(`${stem}.${ext}`))
}

// Where an entry's file is: { zip entry } or { local path }, plus a key that
// changes whenever the file does (the zip's checksum, or the file's size and time).
export async function locate(folder, p) {
  const z = await openZip()
  const entry = p.original && z?.byName.get(p.original.toUpperCase())
  if (entry) return { entry, name: p.original, key: `${entry.crc32.toString(16)}-${entry.uncompressedSize}` }
  const local = path.join(mediaDir, folder, p.file)
  if (existsSync(local)) {
    const s = await fs.stat(local)
    return { local, name: p.file, key: `${Math.round(s.mtimeMs).toString(16)}-${s.size}` }
  }
  return null
}

export async function readBytes(src) {
  if (src.local) return fs.readFile(src.local)
  return buffer(await zip.file.openReadStreamPromise(src.entry))
}

// A sharp image of the photo, upright. HEIC is decoded to raw pixels first
// (already turned upright by the decoder, and with no metadata to carry over).
export async function still(src) {
  const bytes = await readBytes(src)
  if (/\.hei[cf]$/i.test(src.name)) {
    const { width, height, data } = await decodeHeic({ buffer: bytes })
    return sharp(Buffer.from(data.buffer, data.byteOffset, data.byteLength), { raw: { width, height, channels: 4 } })
  }
  return sharp(bytes).rotate()
}

// Copies a video to a temporary file, for ffmpeg. Call done() after.
export async function videoFile(src) {
  if (src.local) return { file: src.local, done: async () => {} }
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'taiwan-video-'))
  const file = path.join(dir, src.name)
  await pipeline(await zip.file.openReadStreamPromise(src.entry), (await fs.open(file, 'w')).createWriteStream())
  return { file, done: () => fs.rm(dir, { recursive: true, force: true }) }
}

// A web copy of a video: H.264, at most 1280px, sound kept, metadata stripped.
export async function encodeVideo(inFile, outFile) {
  await run('ffmpeg', ['-v', 'error', '-y', '-i', inFile, '-map_metadata', '-1',
    '-vf', "scale='if(gt(iw,ih),min(1280,iw),-2)':'if(gt(iw,ih),-2,min(1280,ih))'",
    '-c:v', 'libx264', '-crf', '27', '-preset', 'medium', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', outFile], { maxBuffer: 1 << 24 })
}

// A video's poster: its frame half a second in, as JPEG.
export async function videoPoster(inFile, outFile) {
  await run('ffmpeg', ['-v', 'error', '-y', '-ss', '0.5', '-i', inFile, '-frames:v', '1', '-q:v', '3', outFile])
}
