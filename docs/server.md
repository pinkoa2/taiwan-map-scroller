# The server

How https://taiwan.pinkoa2.lol/ is hosted (set up Oct 31, 2026). The site is **static**: a Docker build turns the code, content and picked photos into plain files, and Caddy serves those files over HTTPS. Nothing runs per visit.

```
laptop ── git push ──▶ GitHub (the repo)
                              │ git pull
                              ▼
Linode ── docker compose run build ──▶ /srv/taiwan/current ──Caddy──▶ taiwan.pinkoa2.lol
             ▲ downloads the photos zip (Google Drive, PHOTOS_ZIP_URL)
```

## The machine

| | |
|---|---|
| Host | A Linode, shared CPU |
| System | Ubuntu 24.04 LTS |
| Disk encryption | On (Linode's, at rest) |
| User | A personal admin user (uid 1000), in the `sudo` and `docker` groups. Below it's `<user>`. |
| Login | SSH key only, through an entry in the laptop's `~/.ssh/config` |

The server also hosts other sites and experiments; this page covers what the Taiwan site needs.

## Security

- **SSH:** root login and password login are off, in `/etc/ssh/sshd_config.d/01-hardening.conf` (`PermitRootLogin no`, `PasswordAuthentication no`). The `01-` name makes it win over `50-cloud-init.conf`. Check with `sudo sshd -T | grep -E 'permitrootlogin|passwordauthentication'`.
- **Firewall:** a Linode Cloud Firewall (in the Linode dashboard, under Firewalls), attached to the server. Inbound is dropped except:

  | Rule | Protocol | Port | For |
  |---|---|---|---|
  | ssh | TCP | 22 | SSH |
  | http | TCP | 80 | Caddy: certificates and the redirect to HTTPS |
  | https | TCP | 443 | the sites |
  | https-quic | UDP | 443 | HTTP/3 |
  | wireguard | UDP | 51820 | a VPN, later |

  Outbound is open. The firewall sits outside the server, so it also covers ports Docker publishes (Docker bypasses Ubuntu's own `ufw`).
- **Updates:** `unattended-upgrades` installs security updates daily (`/etc/apt/apt.conf.d/20auto-upgrades`). Some need a reboot: `ls /var/run/reboot-required`, then `sudo reboot`.

## Docker (the build)

- Installed from Docker's own package repository (`docker-ce`, `containerd.io`, `docker-compose-plugin`). It runs as a systemd service, started on boot.
- The build is described in the repo: `Dockerfile`, `docker-compose.yml`, `docker/build.sh`; see [docker.md](docker.md).
- The repo is cloned at `~/taiwan-map-scroller` (over `https://`; it's public).
- `~/taiwan-map-scroller/.env` holds `PHOTOS_ZIP_URL`, the photos zip's Drive link (`chmod 600`, never committed).
- What Docker keeps, under `/var/lib/docker/`:
  - the image `taiwan-map-scroller-build` (Node 24, ffmpeg, the npm packages)
  - the volumes `taiwan-map-scroller_photos` (the downloaded zip, about 2.8 GB), `taiwan-map-scroller_cache` and `taiwan-map-scroller_generated` (the converted photos, so a rebuild only converts new picks). List them with `docker volume ls`.
- The build container is removed after each run (`--rm`); nothing keeps running.

## The site's files

- `/srv/taiwan/`, owned by `<user>` (the build writes there) and readable by everyone (Caddy reads it). Home folders are private on Ubuntu 24.04, which is why the site isn't under `~`.
- `/srv/taiwan/current/` is the live site. Each build replaces it in one move.

## Caddy (the web server)

- Installed from Ubuntu's packages (`sudo apt install caddy`). A systemd service: starts on boot, restarts if it crashes. It runs as its own `caddy` user.
- Config: `/etc/caddy/Caddyfile`:

  ```
  taiwan.pinkoa2.lol {
  	root * /srv/taiwan/current
  	file_server
  	encode zstd gzip
  }
  ```

- HTTPS certificates come from Let's Encrypt and renew automatically.
- Another site is another block in the same file: `root` + `file_server` for files, or `reverse_proxy 127.0.0.1:<port>` for an app.

## DNS

At the domain's registrar: an `A` record for `taiwan` pointing to the server's IPv4 address (it used to be a CNAME to GitHub Pages). Check with `dig +short taiwan.pinkoa2.lol`.

## Updating the site

On the laptop: edit, pick photos (`npm run curate`), commit and push. Then on the server:

```bash
cd ~/taiwan-map-scroller
git pull
SITE_DIR=/srv/taiwan docker compose run --rm --build build
```

It ends with `Site ready in … → /out/current`. Visitors get the new version on their next load; Caddy needs no reload.

- After replacing the zip in Drive: add `REFRESH_PHOTOS=1` in front.
- A first build (or with `REFRESH_PHOTOS=1`) downloads the zip and converts every pick: about 10–15 minutes. A rebuild with nothing new takes seconds.
- Run it inside tmux, so a dropped connection doesn't stop it.

## Day to day

| Task | Command |
|---|---|
| Is Caddy running? | `systemctl status caddy` |
| Caddy's log, live | `sudo journalctl -u caddy -f` |
| Check, then load an edited Caddyfile | `caddy validate --config /etc/caddy/Caddyfile`, then `sudo systemctl reload caddy` |
| Is a build running? | `docker ps` |
| Disk used by Docker | `docker system df` |
| Start the build volumes over | `docker compose down -v` (in the repo; the next build downloads and converts everything again) |
