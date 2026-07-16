import { SRGBColorSpace, type Texture, TextureLoader } from "three";
import type { CdAlbum } from "./albums";

/**
 * Texture streaming for the wall (PRD-cd-wall §5.2). One cache per mounted
 * scene, keyed by album id: every cover loads once and stays resident (the
 * collection is curated tens, not hundreds — no eviction by design), and the
 * whole cache is disposed with the scene so mount/unmount cycles don't leak.
 */
export interface CoverCache {
	/** resolved texture if already loaded, else null (load in flight) */
	get(album: CdAlbum): Texture | null;
	/** resolves when the album's texture is ready (rejects on load error) */
	ready(album: CdAlbum): Promise<Texture>;
	dispose(): void;
}

export function createCoverCache(anisotropy: number): CoverCache {
	const loader = new TextureLoader();
	const entries = new Map<
		string,
		{ texture: Texture | null; promise: Promise<Texture> }
	>();
	let disposed = false;

	function load(album: CdAlbum) {
		let entry = entries.get(album.id);
		if (!entry) {
			const record: { texture: Texture | null; promise: Promise<Texture> } = {
				texture: null,
				promise: loader.loadAsync(album.cover).then((texture) => {
					texture.colorSpace = SRGBColorSpace;
					texture.anisotropy = anisotropy;
					if (disposed) texture.dispose();
					else record.texture = texture;
					return texture;
				}),
			};
			// a failed cover keeps its placeholder forever — no flash, no crash
			record.promise.catch(() => {});
			entry = record;
			entries.set(album.id, entry);
		}
		return entry;
	}

	return {
		get: (album) => load(album).texture,
		ready: (album) => load(album).promise,
		dispose() {
			disposed = true;
			for (const { texture } of entries.values()) texture?.dispose();
			entries.clear();
		},
	};
}
