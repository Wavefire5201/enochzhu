import { SRGBColorSpace, VideoTexture } from "three";
import type { CdAlbum } from "./albums";

/**
 * Looping animated covers for the wall. One muted `<video>` + VideoTexture per
 * album, created lazily the first time an album with a `video` scrolls into the
 * pool and shared across every pooled mesh showing that album. A per-frame
 * keep/sweep pauses videos whose album has left the visible window, so at most a
 * handful ever decode at once. The still cover shows until the first frame is
 * ready, so there is never a black flash.
 */
export interface VideoCache {
	/** the album's texture once it can render a frame, else null (still shows) */
	get(album: CdAlbum): VideoTexture | null;
	/** mark an album on-screen this frame so its video keeps playing */
	keep(id: string): void;
	/** apply play/pause from recent keeps; call once per frame */
	sweep(): void;
	dispose(): void;
}

export function createVideoCache(anisotropy: number): VideoCache {
	const entries = new Map<
		string,
		{ video: HTMLVideoElement; texture: VideoTexture }
	>();
	const lastWanted = new Map<string, number>();
	let frame = 0;
	let disposed = false;

	function ensure(album: CdAlbum) {
		if (!album.video) return null;
		let entry = entries.get(album.id);
		if (!entry) {
			const video = document.createElement("video");
			video.src = album.video;
			video.loop = true;
			video.muted = true;
			video.defaultMuted = true;
			video.playsInline = true;
			video.autoplay = true;
			video.preload = "auto";
			video.crossOrigin = "anonymous"; // ready for a CDN origin later
			// a 1px hidden element in the DOM: detached videos play in Chrome but
			// Safari throttles them, and this keeps decoding reliable everywhere
			video.style.cssText =
				"position:fixed;left:-10px;top:-10px;width:1px;height:1px;opacity:0;pointer-events:none";
			document.body.appendChild(video);
			// muted autoplay is allowed; a rejected promise is harmless
			video.play().catch(() => {});
			const texture = new VideoTexture(video);
			texture.colorSpace = SRGBColorSpace;
			texture.anisotropy = anisotropy;
			entry = { video, texture };
			entries.set(album.id, entry);
		}
		return entry;
	}

	return {
		get(album) {
			const entry = ensure(album);
			// HAVE_CURRENT_DATA: a frame exists to sample; before that the still
			// cover stays up
			return entry && entry.video.readyState >= 2 ? entry.texture : null;
		},
		keep(id) {
			lastWanted.set(id, frame);
		},
		sweep() {
			if (disposed) return;
			frame++;
			for (const [id, { video }] of entries) {
				// a few frames of grace so play/pause never flickers at the window edge
				const recent = (lastWanted.get(id) ?? -999) >= frame - 3;
				if (recent) {
					if (video.paused) video.play().catch(() => {});
				} else if (!video.paused) {
					video.pause();
				}
			}
		},
		dispose() {
			disposed = true;
			for (const { video, texture } of entries.values()) {
				video.pause();
				video.removeAttribute("src");
				video.load(); // release the decoder
				video.remove();
				texture.dispose();
			}
			entries.clear();
			lastWanted.clear();
		},
	};
}
