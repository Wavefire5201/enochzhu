# listening worker

Last.fm proxy behind the site's live listening feed (chip, `/now` widgets,
terminal `nowplaying`). Standalone Cloudflare Worker — the SvelteKit build
stays 100% static (ADR 001); this is the only stateful piece and it is
deliberately removable.

- One endpoint: `GET /` → `{ nowPlaying, tracks: [{ name, artist, album, cover, url, nowPlaying, playedAt }] }`
- Upstream `user.getRecentTracks` is cached at the edge for 25s (`cf.cacheTtl`),
  so visitor traffic does not proportionally hit Last.fm.
- CORS is scoped to the origins in `ALLOWED_ORIGINS`.
- Any failure returns a non-200; the site treats that as "hidden", never an
  error state.

## setup

```sh
bun install
bun run types          # regenerate worker-configuration.d.ts after config edits
```

1. Set `LASTFM_USERNAME` in `wrangler.jsonc` (public username, not a secret).
2. `bunx wrangler secret put LASTFM_API_KEY` (create one at last.fm/api).
   For local dev: `cp .dev.vars.example .dev.vars` and fill it in.
3. `bun run deploy`, then paste the deployed URL into `LISTENING_ENDPOINT`
   in `src/lib/listening/store.svelte.ts` back in the site.

## dev / test

```sh
bun run dev     # wrangler dev
bun run check   # tsc
bun test        # trim.ts unit tests
```
