# Hosting plan: photos out of the repo, site on a Linode

**Status: partly built (Oct 30, 2026).** Done: the zip download, the build and picker reading the zip, picks only, the old photo copies removed, and the GitHub Actions workflow removed. GitHub Pages still serves the last version it published. Not done yet: the Linode, the service account and `deploy`. Command names not yet built are proposals.

## Why

- Committing every photo makes the repo large (158 MB for the first 222), and the second import is bigger than 2 GB.
- GitHub's limits get in the way: Pages is capped at 1 GB for the published site, and a release file at 2 GB.
- Only chosen photos should be public. Today every photo is built and published so that `?display=all` works.

## Decisions (Oct 30, 2026)

- **Google Drive is the source of truth** for the photos (originals). Nothing photo-related is stored in git.
- **The photos reach the build as a zip in Drive.** The build downloads it, takes what it needs and throws it away.
- **Picks only.** Only `pick: true` photos are built and published. **`?display=all` goes away.** After the switch, run the picker again to review picks and redeploy.
- **Nothing is public but the site.** The build reads the zip through a Google service account, not a public link.
- **Off GitHub Actions and Pages.** The site is built and hosted on a private Linode (or a similar VPS), which can host other sites too.
- **The repo goes private** once Pages is no longer used.

## How it fits together

```
Google Drive (private)
├─ Taiwan 2026/          originals, the source of truth
└─ Taiwan site/          the zip(s) the build reads, shared read-only with the service account
        │
        │ download (only when needed), via the service account
        ▼
Linode build ── temp folder: zip → picked files only → WebP / H.264 → deleted
        │
        ▼
/srv/taiwan   live site (picks only) ──Caddy──▶ taiwan.pinkoa2.lol
        ▲
        │ git pull
GitHub, private repo: code + JSON (picks, captions, order, descriptions)
```

## One build

`npm run deploy` (from the laptop, over ssh) or the picker's "Update site" button runs the build script on the Linode:

1. `git pull` for the latest JSON.
2. Ask Drive for the zips in `Taiwan site/` and their checksums (a cheap API call, no download).
3. **Decide whether to download.** Download only if a zip's checksum differs from the last build, or a picked photo has no built files yet. Otherwise skip to step 6. Caption, description, order and favourite changes never download anything.
4. Download the zips into a temporary folder.
5. Extract **only the picked files** (a zip's table of contents allows pulling single entries). For each one: strip all metadata including GPS (the originals have it), make the 640/960/1400/2000 WebP sizes and the blurred placeholder, or convert a video to H.264 with its poster.
6. Build the site and swap it in.
7. Delete the temporary folder, zips included, and delete built files for photos that are no longer picked.

Built photos are named by a fingerprint of the original's contents. An unchanged photo is never converted twice, and an edited one is reconverted automatically. Browsers can cache them forever.

**What the Linode keeps:** only the live site, built photos included. No zips and no originals between builds.

## Adding photos (the routine)

**1. Make the zip.** Either:
- Download `Taiwan 2026/` from Drive (Select folder, then Download). For more than about 2 GB, Drive splits it into several zips (`…-001.zip`, `-002.zip`, …).
- Or zip the folder yourself, from Drive for Desktop or a local copy. That gives one zip of any size.

**2. Put it in `Taiwan site/` on Drive,** replacing what was there.
- To keep a file's ID, right-click it, choose **Manage versions**, then **Upload new version**.
- Drive's split parts are fine: the build treats every zip in the folder as one set.

**3. Load the same zips into the picker on the laptop:**

```bash
npm run photos:import ~/Downloads/Taiwan*.zip
```

- Unpacks locally, into a folder that isn't committed.
- Skips Drive's "(1)" duplicates, exact copies (by hash) and Live Photo `.MOV` companions; takes JPEG over RAW.
- Adds anything new with `new: true`, sorted by time taken.
- Prints a summary such as `412 photos, 37 new, 0 missing`. "Missing" means a photo the JSON lists isn't in the zips. Drive occasionally leaves a file out, so download again.

**4. Pick and write** in the picker (`npm run curate`). Commit and push.

**5. Deploy** (`npm run deploy` or "Update site").

Without new photos, the routine is just steps 4 and 5.

## The picker

The picker only ever runs on the laptop, on the downloaded zip, and shows **every** photo and video in it, picked or not. Only picks are ever published.

- It reads the folder `photos:import` unpacked, not `content/media/`.
- Originals can't all be shown in a browser: Chrome can't show HEIC, no browser shows RAW, and 4K video is too heavy for a grid. So `photos:import` also makes a **preview** of each file: a 640px JPEG for a photo, and a poster plus a light 720p clip for a video. They're kept in the same local folder, and only new or changed files get one on later imports.
- The picker shows the previews. The build always works from the originals.
- Disk: the unpacked originals take as much room as the zip, and the previews add about 5–10%. If space gets tight, the picker could read straight from the zip instead.
- "Update site" runs the same picks-only build locally, so `vite preview` shows what will go live before deploying.

## How the JSON finds a photo

Each entry points at the original's path inside the zip and gives the site's descriptive name:

```json
{ "source": "Taiwan 2026/alex-iphone/IMG_0517.HEIC",
  "name": "red-lantern-alley",
  "caption": "", "taken": "2026-10-12 19:40", "pick": true, "favorite": true }
```

- Files in Drive are never renamed or moved by the tools.
- "Move to…" in the picker only moves the entry in the JSON.
- `name` is used for the published WebP files.
- `content/media.json` holds the Drive ID of the `Taiwan site/` folder. That's harmless in a private repo, and the ID alone gives no access without the service account.

## Google access: the service account

A service account is a robot Google account with a key file. It sees only what you share with it.

1. In Google Cloud Console, create a project, enable the **Drive API**, create a service account and download its JSON key.
2. In Drive, share **only** `Taiwan site/` with the service account's address, as **Viewer**.
3. Put the key on the Linode (e.g. `~/.config/taiwan/drive-key.json`, readable only by the deploy user). Never commit it.

This also avoids the "can't scan for viruses" page and the download quota that public links run into.

**For now (Oct 30, 2026):** the zip is a single file shared as "Anyone with the link", and the link is in `.env` as `PHOTOS_ZIP_URL` (`.env` is gitignored; `.env.example` shows the name). It has no `VITE_` prefix, so Vite never puts it in the page. A script can get the file ID from the link and download it from `drive.usercontent.google.com/download?id=<id>&export=download&confirm=t`. Move to the service account before the build runs on its own.

**Built so far (Oct 30, 2026):**

- `npm run photos:download` (`scripts/download-photos.js`) downloads that zip to `photos/photos.zip` (gitignored), with a progress bar (percent, size, speed, time left). It writes to `photos.zip.part` and renames it only once complete, so a stopped download never leaves a half zip in place; run it again to start over. No dependencies. Measured Oct 30, 2026: 2.81 GB at about 7.5 MB/s, about 6 minutes.
- **The build and the picker read the zip** (`scripts/photo-source.js`). Entries are matched by their existing `original` field (the file's name in the zip), so no `source` field was needed: the zip is one flat folder. Only picks are built; `?display=all` is gone. Built files are fingerprinted and cached (`.cache/photos.json`); a first build of 92 picks took about 4.5 minutes, a rebuild with nothing new about 2 seconds. The picker makes its grid previews from the zip on demand, lists unknown zip files under Unsorted, and "Move to…" only edits JSON. See [how-it-works.md](how-it-works.md#photos).
- The old copies in `content/media/` were removed (Oct 30, 2026, the user asked); only the AllTrails screenshot, which isn't in the zip, stays. Without a zip the build now stops with an error, so **the live site stays as it was** until the build moves to the Linode. The GitHub Actions workflow (`.github/workflows/deploy.yml`) was removed the same day, since it couldn't build without the zip.
- The zip as downloaded: 491 files in `Taiwan 2026/`: 251 HEIC, 219 MP4 (all Live Photo parts of a HEIC), 14 MOV (the real videos), 7 JPEG/PNG. 272 of 273 entries were found; the AllTrails screenshot isn't in the zip and is read from `content/media/`.

**Fallbacks** if the service account is ever a problem:
- Share the zip as "Anyone with the link" just for the build, then unshare. The link opens every original, GPS included, to anyone who has it, so don't leave it on.
- Upload the zips straight to the Linode with `rsync --partial` (resumable), and point the build at that folder instead of Drive.

## Server

A $5 plan (1 shared CPU, 1 GB RAM, 25 GB disk, 1 TB transfer a month) is enough. The temporary folder needs room for the zips plus the extracted picks during a build, and the live site with picks only is a few hundred MB. A first build with videos is slow; later ones only convert what's new.

A separate page should let the Linode be rebuilt from scratch:

- OS, a non-root deploy user, ssh keys, automatic security updates, firewall (ssh, 80, 443).
- Node, libvips with HEIC support (for `sharp`), ffmpeg, `unzip`.
- Caddy, with a site block per domain (HTTPS is automatic).
- A read-only deploy key for the private repo, and the Drive service-account key.
- The build script, and the site folder `/srv/taiwan`.
- DNS at Porkbun: `taiwan.pinkoa2.lol` → the Linode's address (replacing the CNAME to `pinkoa2.github.io`).
- Optional, later: Cloudflare's free CDN in front.

## Moving over (to-do when built)

1. Set up the Linode, the service account and `Taiwan site/` in Drive; point a test subdomain at the Linode.
2. Add `deploy`. ~~Switch `prepare-trip.js` to picks only and fingerprinted names~~ (done; `photos:import` turned out unnecessary: the picker reads the zip directly).
3. ~~Map the existing entries to the zip~~ (done: `original` already matches).
4. ~~Remove `?display=all` from `App.svelte`~~ (done); review picks in the picker.
5. Switch DNS, then turn off Pages in the repo's settings. (~~Remove `.github/workflows/deploy.yml`~~: done Oct 30, 2026. Pages still serves the last published version; don't turn it off before DNS points at the Linode.)
6. Stop committing `content/media/` photos (keep the JSON) and make the repo private. Optionally rewrite git history to drop the 158 MB already committed.
7. Update `how-it-works.md` and `CLAUDE.md`.

## Options considered and set aside

- **Zip on GitHub Releases, built by Actions:** 2 GB per file, and the release is public with a public repo.
- **Git LFS:** the free tier is 1 GB storage and 1 GB of downloads a month, and every deploy downloads all photos.
- **Opening the zip in the browser:** phones would download full-size originals instead of the small WebPs, and Drive doesn't let other sites fetch its downloads.
- **Photos on Cloudflare R2 or Bunny.net, site on Pages:** works with no real limits, but the user chose to move off GitHub hosting entirely.
- **A server cache of the originals, fed by uploads to the Linode:** the first version of this plan. The stateless build keeps less on the server and drops the manual upload. The upload remains as a fallback.
- **The service account reading `Taiwan 2026/` directly, without a zip:** would download only the picks. Set aside because the user prefers working with a zip; worth revisiting if the zip grows unwieldy.
- **Google Photos (the library app) as the source:** since 2025 its API only lets apps read photos they uploaded themselves, so a build can't read it.
