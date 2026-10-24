import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const generated = path.resolve('.generated')

// Fills the title and link-preview tags from the trip.
function tripMeta() {
  return {
    name: 'trip-meta',
    transformIndexHtml(html) {
      const trip = JSON.parse(readFileSync(path.join(generated, 'trip.json'), 'utf8'))
      const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
      const title = `${trip.title} ${trip.year ?? ''}`.trim()
      const origin = trip.subdomain ? `https://${trip.subdomain}` : ''
      return html
        .replaceAll('%TRIP_TITLE%', esc(title))
        .replaceAll('%TRIP_DESC%', esc(trip.summary))
        .replaceAll('%TRIP_IMAGE%', `${origin}/og.jpg`)
        .replaceAll('%TRIP_URL%', origin ? `${origin}/` : '/')
    },
  }
}

export default defineConfig({
  plugins: [svelte(), tripMeta()],
  publicDir: path.join(generated, 'public'),
  resolve: { alias: { 'virtual:trip': path.join(generated, 'trip.json') } },
  build: { outDir: 'dist', emptyOutDir: true },
})
