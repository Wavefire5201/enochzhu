import type { CdAlbum } from "./albums";

/**
 * Owns the 30-second iTunes preview for the CD wall. It lives ABOVE the controls
 * panel (created by Wall3D / the proto lab, not inside CdActions) so it survives
 * the panel's mount/unmount: opening a case fades the clip in and loops it,
 * closing fades it out — and the fade-out completes even as the panel is torn
 * down. The reactive fields back the play button, the radial dial, and the
 * progress ring; the audio element itself is detached from the DOM.
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
	muted = $state(false);
	/** target playback level (0..1); the live fade rides toward it */
	volume = $state(0.7);
	/** clip position + length, in seconds — drives the progress ring */
	currentTime = $state(0);
	duration = $state(0);

	#audio: HTMLAudioElement | null = null;
	#fade: number | null = null;
	#reqId = 0; // cancels a stale in-flight search
	#wantPlay = false; // true between open() and close(): the case is held open

	/** Look up the preview for an album. Cancels any prior search. If the case is
	 * already open by the time the url resolves, playback starts with a fade. */
	async load(album: CdAlbum): Promise<void> {
		this.#teardownAudio();
		this.previewUrl = null;
		this.currentTime = 0;
		this.duration = 0;
		const query = [album.artist, album.title].filter(Boolean).join(" ");
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

	#ensureAudio(): HTMLAudioElement | null {
		if (this.#audio) return this.#audio;
		if (!this.previewUrl) return null;
		const a = new Audio(this.previewUrl);
		a.preload = "metadata";
		a.loop = true; // the clip loops so an open case never falls silent
		a.volume = 0;
		a.addEventListener("timeupdate", () => (this.currentTime = a.currentTime));
		a.addEventListener(
			"loadedmetadata",
			() => (this.duration = a.duration || 0),
		);
		this.#audio = a;
		return a;
	}

	/** case opened → fade the looping preview in */
	open(): void {
		this.#wantPlay = true;
		const a = this.#ensureAudio();
		if (!a) return; // url not resolved yet; load() re-calls open() when it is
		void a
			.play()
			.then(() => (this.playing = true))
			.catch(() => (this.playing = false));
		this.#fadeTo(this.muted ? 0 : this.volume);
	}

	/** case closed → fade the preview out, then pause. Safe to call repeatedly. */
	close(): void {
		this.#wantPlay = false;
		const a = this.#audio;
		if (!a) return;
		this.#fadeTo(0, () => {
			a.pause();
			this.playing = false;
		});
	}

	/** the play/pause orb: toggles playback within an already-open case */
	toggle(): void {
		if (this.playing) {
			const a = this.#audio;
			if (a) {
				a.pause();
				this.playing = false;
			}
		} else {
			this.open();
		}
	}

	setVolume(v: number): void {
		this.volume = clamp01(v);
		if (this.muted && this.volume > 0) this.muted = false;
		// live drag: bypass the fade and set the element directly
		const a = this.#audio;
		if (a && this.#wantPlay) {
			this.#cancelFade();
			a.volume = this.muted ? 0 : this.volume;
		}
	}

	toggleMute(): void {
		this.muted = !this.muted;
		this.#fadeTo(this.muted ? 0 : this.volume);
	}

	seek(seconds: number): void {
		const a = this.#audio;
		if (!a || !this.duration) return;
		a.currentTime = Math.max(0, Math.min(seconds, this.duration));
		this.currentTime = a.currentTime;
	}

	/** 0..1 playback position, for the progress ring */
	get progress(): number {
		return this.duration ? this.currentTime / this.duration : 0;
	}

	#fadeTo(target: number, done?: () => void): void {
		const a = this.#audio;
		if (!a) return;
		this.#cancelFade();
		const from = a.volume;
		const dur = fadeDuration();
		const start = performance.now();
		const step = (now: number) => {
			const t = Math.min(1, (now - start) / dur);
			a.volume = from + (target - from) * t;
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
			this.#audio.pause();
			this.#audio = null;
		}
		this.playing = false;
	}

	/** parent unmount: stop everything and invalidate pending searches */
	destroy(): void {
		this.#teardownAudio();
		this.#reqId++;
		this.previewUrl = null;
	}
}
