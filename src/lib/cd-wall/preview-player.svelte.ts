import type { CdAlbum } from "./albums";

/**
 * Owns the 30-second iTunes preview for the CD wall. It lives ABOVE the controls
 * panel (created by Wall3D / the proto lab, not inside CdActions) so it survives
 * the panel's mount/unmount: opening a case fades the clip in and loops it,
 * closing fades it out — and the fade-out completes even as the panel is torn
 * down. The reactive fields back the play button and the ambient volume orb;
 * the audio element itself is detached from the DOM.
 *
 * Level rides on a Web Audio GainNode, not `HTMLAudioElement.volume`: iOS
 * Safari hard-ignores `.volume` (playback level is hardware-only there), so the
 * fades and the slider both did nothing on iPhone. The element feeds
 * element → GainNode → destination and its own `.volume` stays at 1. Two
 * consequences: the element must be a CORS-clean source (iTunes previews send
 * `access-control-allow-origin: *`, so `crossOrigin = "anonymous"` is enough —
 * without it `createMediaElementSource` yields silence), and the AudioContext
 * must be started inside a user gesture, which is what `unlock()` is for.
 * Browsers without AudioContext keep the old `.volume` path.
 */

type SearchResponse = { results?: Array<{ previewUrl?: string }> };

const FADE_MS = 600;
const FADE_MS_REDUCED = 150;

function clamp01(v: number): number {
	return v < 0 ? 0 : v > 1 ? 1 : v;
}

function fadeDuration(): number {
	if (typeof window === "undefined") return FADE_MS;
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches
		? FADE_MS_REDUCED
		: FADE_MS;
}

export class PreviewPlayer {
	/** the resolved iTunes preview url, or null while searching / when none exists */
	previewUrl = $state<string | null>(null);
	loading = $state(false);
	playing = $state(false);
	/** target playback level (0..1); the live fade rides toward it */
	volume = $state(0.2);
	inspecting = $state(false);
	/** open animation progress (0..1) of the currently active case */
	openAmount = $state(0);

	#audio: HTMLAudioElement | null = null;
	#fade: number | null = null;
	#reqId = 0; // cancels a stale in-flight search
	#wantPlay = false; // true between open() and close(): the case is held open
	#activeAlbumId: string | null = null;
	#positions = new Map<string, number>();

	// one context for the whole wall; the source node is per-element because
	// createMediaElementSource throws if called twice on the same element
	#ctx: AudioContext | null = null;
	#gain: GainNode | null = null;
	#source: MediaElementAudioSourceNode | null = null;
	/** current playback level (0..1) — the fade's own state, mirrored to gain */
	#level = 0;

	#savePosition(): void {
		if (this.#audio && this.#activeAlbumId) {
			this.#positions.set(this.#activeAlbumId, this.#audio.currentTime);
		}
	}

	/** Look up the preview for an album. Cancels any prior search. If the case is
	 * already open by the time the url resolves, playback starts with a fade. */
	async load(album: CdAlbum): Promise<void> {
		this.#savePosition();
		this.#teardownAudio();
		this.#activeAlbumId = album.id;
		this.previewUrl = null;

		// 1. Direct Preview URL
		if (album.previewUrl) {
			this.previewUrl = album.previewUrl;
			if (this.#wantPlay) this.open();
			return;
		}

		// 2. Search Query (custom track or album title)
		const trackOrTitle = album.previewTrack || album.title;
		const query = [album.artist, trackOrTitle].filter(Boolean).join(" ");
		if (!query) return;
		this.loading = true;
		const reqId = ++this.#reqId;
		try {
			const res = await fetch(
				`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=5`,
			);
			if (!res.ok) return;
			const data = (await res.json()) as SearchResponse;
			const url = data.results?.find((r) => r.previewUrl)?.previewUrl ?? null;
			if (reqId !== this.#reqId) return;
			this.previewUrl = url;
			if (url && this.#wantPlay) this.open();
		} catch {
			// a failed lookup just leaves previewUrl null; the UI hides the control
		} finally {
			if (reqId === this.#reqId) this.loading = false;
		}
	}

	/** lazily build the shared context + gain. False → no Web Audio here. */
	#ensureGraph(): boolean {
		if (this.#ctx) return true;
		if (typeof window === "undefined") return false;
		const Ctor =
			window.AudioContext ??
			(window as unknown as { webkitAudioContext?: typeof AudioContext })
				.webkitAudioContext;
		if (!Ctor) return false;
		try {
			const ctx = new Ctor();
			const gain = ctx.createGain();
			gain.gain.value = this.#level;
			gain.connect(ctx.destination);
			this.#ctx = ctx;
			this.#gain = gain;
			return true;
		} catch {
			return false; // context budget exhausted — fall back to element volume
		}
	}

	/**
	 * Start the audio context from inside a user gesture. iOS only lets a
	 * context leave `suspended` while a gesture is being handled, and the Svelte
	 * effect that calls open() runs a microtask later — too late — so the wall
	 * calls this synchronously from its pointerdown handler.
	 */
	unlock(): void {
		if (!this.#ensureGraph()) return;
		if (this.#ctx && this.#ctx.state !== "running") void this.#ctx.resume();
	}

	/** route an element through the gain node; falls back to element volume */
	#connectAudio(a: HTMLAudioElement): void {
		if (!this.#ensureGraph() || !this.#ctx || !this.#gain) return;
		try {
			this.#source = this.#ctx.createMediaElementSource(a);
			this.#source.connect(this.#gain);
			a.volume = 1; // the gain node owns the level from here
		} catch {
			this.#source = null;
		}
	}

	/** write the level wherever it actually takes effect */
	#applyLevel(v: number): void {
		this.#level = v;
		if (this.#gain && this.#source) this.#gain.gain.value = v;
		else if (this.#audio) this.#audio.volume = v;
	}

	#ensureAudio(): HTMLAudioElement | null {
		if (this.#audio) return this.#audio;
		if (!this.previewUrl) return null;
		const a = new Audio();
		// must be set before src, or the fetch is not a CORS one and the Web
		// Audio graph gets a tainted (silent) source
		a.crossOrigin = "anonymous";
		a.src = this.previewUrl;
		a.preload = "metadata";
		a.loop = true; // the clip loops so an open case never falls silent
		if (this.#activeAlbumId) {
			const saved = this.#positions.get(this.#activeAlbumId);
			if (saved !== undefined) {
				a.currentTime = saved;
			}
		}
		this.#audio = a;
		this.#connectAudio(a);
		this.#applyLevel(0); // every clip fades up from silence
		return a;
	}

	/** case opened → fade the looping preview in */
	open(): void {
		this.#wantPlay = true;
		this.unlock(); // belt and suspenders; the real gesture hook is pointerdown
		const a = this.#ensureAudio();
		if (!a) return; // url not resolved yet; load() re-calls open() when it is
		void a
			.play()
			.then(() => (this.playing = true))
			.catch(() => (this.playing = false));
		this.#fadeTo(this.volume);
	}

	/** case closed → fade the preview out, then pause. Safe to call repeatedly. */
	close(): void {
		this.#wantPlay = false;
		const a = this.#audio;
		if (!a) return;
		this.#fadeTo(0, () => {
			this.#savePosition();
			a.pause();
			this.playing = false;
		});
	}

	/** the play/pause orb: toggles playback within an already-open case */
	toggle(): void {
		if (this.playing) {
			const a = this.#audio;
			if (a) {
				this.#savePosition();
				a.pause();
				this.playing = false;
			}
		} else {
			this.open();
		}
	}

	setVolume(v: number): void {
		this.volume = clamp01(v);
		// live drag: bypass the fade and set the level directly
		if (this.#audio && this.#wantPlay) {
			this.#cancelFade();
			this.#applyLevel(this.volume);
		}
	}

	#fadeTo(target: number, done?: () => void): void {
		if (!this.#audio) return;
		this.#cancelFade();
		const from = this.#level;
		const dur = fadeDuration();
		const start = performance.now();
		const step = (now: number) => {
			const t = Math.min(1, (now - start) / dur);
			this.#applyLevel(clamp01(from + (target - from) * t));
			if (t < 1) {
				this.#fade = requestAnimationFrame(step);
			} else {
				this.#fade = null;
				done?.();
			}
		};
		this.#fade = requestAnimationFrame(step);
	}

	#cancelFade(): void {
		if (this.#fade !== null) {
			cancelAnimationFrame(this.#fade);
			this.#fade = null;
		}
	}

	#teardownAudio(): void {
		this.#cancelFade();
		if (this.#audio) {
			this.#savePosition();
			this.#audio.pause();
			this.#audio = null;
		}
		// the source node is bound to the element that just died; the context and
		// gain stay, because re-creating a context needs another user gesture
		if (this.#source) {
			this.#source.disconnect();
			this.#source = null;
		}
		this.#level = 0;
		this.playing = false;
	}

	/** parent unmount: stop everything and invalidate pending searches */
	destroy(): void {
		this.#teardownAudio();
		// closed only here, on a real unmount: browsers cap how many contexts a
		// page may hold, so a remounted wall must not strand this one
		void this.#ctx?.close().catch(() => {});
		this.#ctx = null;
		this.#gain = null;
		this.#reqId++;
		this.previewUrl = null;
	}
}
