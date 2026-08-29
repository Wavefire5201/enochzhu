/**
 * Last.fm proxy for the site's live listening feed
 * Stateless: one upstream call, trimmed to what the UI needs, cached at the
 * edge so visitor traffic does not proportionally hit Last.fm. The SvelteKit
 * site stays fully static; this worker is the only stateful piece.
 */
import { type LastfmRecentTracks, trimFeed } from "./trim";

const LASTFM_API = "https://ws.audioscrobbler.com/2.0/";
/** edge + browser cache TTL, seconds — matches the site's 10s poll */
const CACHE_TTL = 10;
const TRACK_LIMIT = 12;
/** album art is immutable — cache it hard once fetched */
const IMG_CACHE_TTL = 31536000;
/**
 * Only these hosts may be proxied through /img (never an open proxy). Last.fm
 * serves art from the hyphenated host today and the bare one historically;
 * both are kept so older feed payloads keep resolving. Deliberately exact
 * hosts, not a `*.freetls.fastly.net` wildcard — that domain is Fastly's
 * shared free-TLS endpoint, so a wildcard would proxy unrelated tenants.
 */
const IMG_HOSTS = new Set([
	"lastfm-img.freetls.fastly.net",
	"lastfm.freetls.fastly.net",
]);

type VisitEnv = Env & { BLACKLISTED_LOCATIONS?: string };

export default {
	async fetch(request, env, ctx): Promise<Response> {
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

		// ambient visitor trace — a cumulative count plus the previous visitor's
		// coarse trace. Independent of the Last.fm config below.
		if (new URL(request.url).pathname === "/visit") {
			return handleVisit(request, env, cors);
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
			const upstreamCovers = new Set<string>();
			for (const track of feed.tracks) {
				if (track.cover) {
					if (allowedImageUrl(track.cover)) upstreamCovers.add(track.cover);
					track.cover = `${origin}/img?u=${encodeURIComponent(track.cover)}`;
				}
			}
			ctx.waitUntil(warmCovers([...upstreamCovers].slice(0, TRACK_LIMIT)));
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

/** The allowlist gate, shared by /img and the cover warmer. Null → not ours. */
function allowedImageUrl(src: string): URL | null {
	let target: URL;
	try {
		target = new URL(src);
	} catch {
		return null;
	}
	if (target.protocol !== "https:" || !IMG_HOSTS.has(target.hostname)) {
		return null;
	}
	return target;
}

/**
 * Pull each cover into the edge cache while the visitor is still reading the
 * feed response, so the /img requests their browser fires a moment later are
 * already warm. It has to happen here, inside their own request: Cloudflare's
 * cache is per-colo, so a cron would only ever warm whichever colo the
 * scheduled run landed in — never the one this visitor is talking to.
 * Best-effort by construction: allSettled swallows every upstream failure, and
 * the body is cancelled because only the cache entry is wanted.
 */
async function warmCovers(covers: string[]): Promise<void> {
	await Promise.allSettled(
		covers.map(async (url) => {
			const res = await fetch(url, {
				cf: { cacheTtl: IMG_CACHE_TTL, cacheEverything: true },
			});
			await res.body?.cancel();
		}),
	);
}

/** Proxy + edge-cache an allowlisted album-art URL. Loaded via <img>, so no CORS. */
async function proxyImage(request: Request): Promise<Response> {
	const src = new URL(request.url).searchParams.get("u");
	if (!src) return new Response("missing u", { status: 400 });
	if (!URL.canParse(src)) return new Response("bad url", { status: 400 });
	const target = allowedImageUrl(src);
	if (!target) return new Response("forbidden", { status: 403 });
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

/**
 * Ambient visitor trace: a cumulative visit count and the coarse trace (city /
 * country + when) of the visitor immediately BEFORE this one — so each visitor
 * sees "someone was here 3h ago from Tokyo". Deliberately privacy-light: the IP
 * is only used, salted-and-hashed with the UTC date, to dedupe same-day
 * refreshes (24h TTL); the raw IP is never stored. Best-effort — KV is
 * eventually consistent and the increment is not atomic, which is fine at this
 * traffic, and any failure just leaves the trace hidden on the site.
 */
async function handleVisit(
	request: Request,
	env: Env,
	cors: Record<string, string>,
): Promise<Response> {
	const kv = (env as unknown as { VISITS?: KVNamespace }).VISITS;
	if (!kv) return json({ error: "not configured" }, 503, cors);

	const cf = request.cf as { city?: string; country?: string } | undefined;
	const place = [cf?.city, cf?.country].filter(Boolean).join(", ");
	const isBlacklistedLocation = locationIsBlacklisted(
		place,
		(env as VisitEnv).BLACKLISTED_LOCATIONS,
	);

	const total = parseInt((await kv.get("total")) ?? "0", 10) || 0;
	const last = (await kv.get("last", "json")) as {
		t: number;
		place: string;
	} | null;

	// dedupe same-day refreshes without keeping the IP: only a salted hash is
	// stored, and only for a day
	const ip = request.headers.get("CF-Connecting-IP") ?? "";
	const day = new Date().toISOString().slice(0, 10);
	const seenKey = `seen:${await sha256(`${ip}:${day}`)}`;
	if (await kv.get(seenKey)) {
		return json({ count: total, last }, 200, cors);
	}

	const now = Math.floor(Date.now() / 1000);
	// The new visitor is counted and shown whoever came before them. Blacklisted
	// locations deliberately do not replace the public trace, so local testing
	// cannot expose a real city or hide the previous non-blacklisted visitor.
	await kv.put("total", String(total + 1));
	if (!isBlacklistedLocation) {
		await kv.put("last", JSON.stringify({ t: now, place }));
	}
	await kv.put(seenKey, "1", { expirationTtl: 86400 });
	return json({ count: total + 1, last }, 200, cors);
}

/**
 * Semicolon-separated, case-insensitive location fragments. We support a
 * city alone ("chicago") or the exact Cloudflare form ("chicago, us").
 */
function locationIsBlacklisted(place: string, configured?: string): boolean {
	const normalizedPlace = place.trim().toLocaleLowerCase();
	if (!normalizedPlace || !configured) return false;

	return configured
		.split(";")
		.map((entry) => entry.trim().toLocaleLowerCase())
		.filter(Boolean)
		.some(
			(entry) =>
				entry === normalizedPlace ||
				normalizedPlace
					.split(",")
					.map((part) => part.trim())
					.includes(entry),
		);
}

async function sha256(input: string): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(input),
	);
	return [...new Uint8Array(digest)]
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
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
