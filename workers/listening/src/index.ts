/**
 * Last.fm proxy for the site's live listening feed
 * Stateless: one upstream call, trimmed to what the UI needs, cached at the
 * edge so visitor traffic does not proportionally hit Last.fm. The SvelteKit
 * site stays fully static; this worker is the only stateful piece.
 */
import { type LastfmRecentTracks, trimFeed } from "./trim";

const LASTFM_API = "https://ws.audioscrobbler.com/2.0/";
/** edge + browser cache TTL, seconds */
const CACHE_TTL = 25;
const TRACK_LIMIT = 12;
/** album art is immutable — cache it hard once fetched */
const IMG_CACHE_TTL = 31536000;
/** only these hosts may be proxied through /img (never an open proxy) */
const IMG_HOSTS = new Set(["lastfm.freetls.fastly.net"]);

export default {
	async fetch(request, env): Promise<Response> {
		const cors = corsHeaders(request.headers.get("Origin"), env);

		if (request.method === "OPTIONS") {
			return new Response(null, { status: 204, headers: cors });
		}
		if (request.method !== "GET") {
			return json({ error: "method not allowed" }, 405, cors);
		}

		// first-party, edge-cached album art — avoids the third-party image host
		// that content/DNS blockers flag (same reasoning as the custom domain)
		if (new URL(request.url).pathname === "/img") {
			return proxyImage(request);
		}

		if (!env.LASTFM_API_KEY || !env.LASTFM_USERNAME) {
			return json({ error: "not configured" }, 503, cors);
		}

		const url = new URL(LASTFM_API);
		url.searchParams.set("method", "user.getrecenttracks");
		url.searchParams.set("user", env.LASTFM_USERNAME);
		url.searchParams.set("api_key", env.LASTFM_API_KEY);
		url.searchParams.set("format", "json");
		url.searchParams.set("limit", String(TRACK_LIMIT));

		try {
			const upstream = await fetch(url, {
				cf: { cacheTtl: CACHE_TTL, cacheEverything: true },
			});
			if (!upstream.ok) {
				return json({ error: "upstream" }, 502, cors);
			}
			const data = (await upstream.json()) as LastfmRecentTracks;
			const feed = trimFeed(data, TRACK_LIMIT);
			// route covers through our own /img so they are first-party + edge-cached
			const origin = new URL(request.url).origin;
			for (const track of feed.tracks) {
				if (track.cover) {
					track.cover = `${origin}/img?u=${encodeURIComponent(track.cover)}`;
				}
			}
			return json(feed, 200, cors, CACHE_TTL);
		} catch (err) {
			console.log(
				JSON.stringify({
					level: "error",
					event: "lastfm_fetch_failed",
					message: String(err),
				}),
			);
			return json({ error: "upstream" }, 502, cors);
		}
	},
} satisfies ExportedHandler<Env>;

/** Proxy + edge-cache an allowlisted album-art URL. Loaded via <img>, so no CORS. */
async function proxyImage(request: Request): Promise<Response> {
	const src = new URL(request.url).searchParams.get("u");
	if (!src) return new Response("missing u", { status: 400 });
	let target: URL;
	try {
		target = new URL(src);
	} catch {
		return new Response("bad url", { status: 400 });
	}
	if (target.protocol !== "https:" || !IMG_HOSTS.has(target.hostname)) {
		return new Response("forbidden", { status: 403 });
	}
	const upstream = await fetch(target.toString(), {
		cf: { cacheTtl: IMG_CACHE_TTL, cacheEverything: true },
	});
	if (!upstream.ok) return new Response("upstream", { status: 502 });
	const headers = new Headers();
	headers.set(
		"Content-Type",
		upstream.headers.get("Content-Type") ?? "image/jpeg",
	);
	headers.set("Cache-Control", `public, max-age=${IMG_CACHE_TTL}, immutable`);
	return new Response(upstream.body, { status: 200, headers });
}

function corsHeaders(origin: string | null, env: Env): Record<string, string> {
	const headers: Record<string, string> = { Vary: "Origin" };
	const allowed = env.ALLOWED_ORIGINS.split(",").map((o) => o.trim());
	if (origin && allowed.includes(origin)) {
		headers["Access-Control-Allow-Origin"] = origin;
		headers["Access-Control-Allow-Methods"] = "GET, OPTIONS";
	}
	return headers;
}

function json(
	body: unknown,
	status: number,
	cors: Record<string, string>,
	maxAge = 0,
): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": maxAge > 0 ? `public, max-age=${maxAge}` : "no-store",
			...cors,
		},
	});
}
