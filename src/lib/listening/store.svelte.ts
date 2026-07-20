/**
 * Live listening feed from the Last.fm worker proxy (workers/listening).
 * Runtime data, deliberately not a content collection — it is texture, not a
 * feature. Nothing here renders in prerendered HTML; every consumer fills in
 * after the first client-side fetch and hides on any failure. State ladder:
 * live → last played → hidden. Never an error state.
 */

/**
 * The deployed worker URL — a first-party custom domain (not *.workers.dev,
 * which content/DNS blockers flag, hiding the feed on some phones). Empty string
 * disables the feed entirely — every surface stays hidden (see CONTENT-NEEDED.md).
 */
export const LISTENING_ENDPOINT = "https://listening.enochzhu.com/";

export interface Track {
	name: string;
	artist: string;
	album: string;
	/** cover art URL; may be empty */
	cover: string;
	url: string;
	nowPlaying: boolean;
	/** unix seconds; null while playing */
	playedAt: number | null;
}

/** poll cadence: fast while something is live, slow while idle */
const POLL_LIVE_MS = 10_000;
const POLL_IDLE_MS = 30_000;

class Listening {
	tracks = $state<Track[]>([]);
	/** true only while something is actually playing — gates the ember accent */
	live = $derived(this.tracks[0]?.nowPlaying ?? false);
	/** now playing, or last played as the fallback rung */
	current = $derived<Track | null>(this.tracks[0] ?? null);
	recent = $derived(this.tracks.filter((t) => !t.nowPlaying));

	#started = false;
	#timer: ReturnType<typeof setTimeout> | undefined;

	/** idempotent; browser-only (call from an $effect) */
	start() {
		if (this.#started || !LISTENING_ENDPOINT) return;
		this.#started = true;
		void this.#tick();
		// returning to a backgrounded tab shows fresh data at once, instead of
		// waiting out the rest of the interval
		document.addEventListener("visibilitychange", () => {
			if (!document.hidden) void this.#refresh();
		});
	}

	/** self-scheduling poll — cadence follows playback, and the fetch is skipped
	 *  (but the loop keeps ticking) while the tab is hidden */
	async #tick() {
		if (!document.hidden) await this.#refresh();
		clearTimeout(this.#timer);
		// Poll faster while something is actively playing, slower when idle.
		const cadence = this.live ? POLL_LIVE_MS : POLL_IDLE_MS;
		this.#timer = setTimeout(() => void this.#tick(), cadence);
	}

	async #refresh() {
		try {
			const res = await fetch(LISTENING_ENDPOINT);
			if (!res.ok) return;
			const feed = (await res.json()) as { tracks?: Track[] };
			if (Array.isArray(feed.tracks)) this.tracks = feed.tracks;
		} catch {
			// endpoint down / offline — keep what we had; hidden if nothing
		}
	}
}

export const listening = new Listening();
