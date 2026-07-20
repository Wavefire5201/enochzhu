# enochzhu

my personal website, built as a static SvelteKit app with a raw WebGL2 glyph-field hero.

## Development

```bash
bun install
bun run dev
```

The local site runs at `http://localhost:5173`.

## Commands

```bash
bun run check    # Svelte and TypeScript checks
bun test         # unit tests
bun run build    # production build
```

Content lives in `src/content`, application code in `src`, and public assets in `static`.

## Listening feed (Cloudflare Worker)

The now-playing chip, the widgets on `/now`, and the terminal `nowplaying` command read
from a small Last.fm proxy in `workers/listening` — separate infrastructure, so the site
itself stays fully static. It is deployed with [wrangler](https://developers.cloudflare.com/workers/wrangler/):

```bash
cd workers/listening
bun install
bunx wrangler login                      # once per machine
bunx wrangler secret put LASTFM_API_KEY  # key from https://www.last.fm/api/account/create
bun run deploy
```

Configuration:

- `LASTFM_USERNAME` and `ALLOWED_ORIGINS` live in `workers/listening/wrangler.jsonc`
  (rerun `bun run deploy` after changing them; `bun run types` regenerates the `Env` types).
- The site reads the deployed URL from `LISTENING_ENDPOINT` in
  `src/lib/listening/store.svelte.ts` — it is baked in at build time, so changing it
  requires rebuilding the site. Set it to `""` to disable the feed entirely.
- CORS is scoped to `ALLOWED_ORIGINS`; add any new origin the site serves from
  (e.g. Vercel preview domains) or the feed stays hidden there.
- Local dev: `cp .dev.vars.example .dev.vars`, fill in the key, `bun run dev`.

Every listening surface hides itself when the feed is unavailable — the site works
without the worker.

## /now page

`/now` renders from `src/content/now/now.md` (copy `now.md.example` and write it).
Until that file exists the route serves the fog 404.

## Curated Albums

Curated albums on `/` are configured in `src/content/music.ts`. The schema supports:

- `previewTrack`: Optional track name to search for on iTunes (rather than using the album name).
- `previewUrl`: Optional direct HTTPS link to a 30-second preview audio clip (skips iTunes lookup entirely).
- **turntable-spin**: Pausing the audio smoothly decelerates the disc spin to a stop like a real turntable; resuming spins it back up.
- **stateful seek**: The player stores the current playback position per-album, allowing you to resume exactly where you left off when closing and reopening a CD.

Cover images and video textures are placed in `static/music/`.
