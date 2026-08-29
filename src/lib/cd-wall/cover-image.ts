/**
 * One decode per cover, shared by everything that reads it. The case texture,
 * the palette histogram, and the dithered disc face each used to decode the
 * same jpg independently — three full decodes of a 1000px image per album, all
 * on the main thread, right as the wall is starting up. Keyed by src and never
 * evicted, for the same reason the cover cache isn't: the collection is a
 * curated tens.
 */
export type CoverImage = ImageBitmap | HTMLImageElement;

const decodes = new Map<string, Promise<CoverImage>>();

export function loadCoverBitmap(src: string): Promise<CoverImage> {
	let entry = decodes.get(src);
	if (!entry) {
		entry = decode(src);
		// a failed decode must not stick — a later retry should get a fresh try
		entry.catch(() => decodes.delete(src));
		decodes.set(src, entry);
	}
	return entry;
}

async function decode(src: string): Promise<CoverImage> {
	// createImageBitmap decodes off the main thread and hands back a source both
	// canvas 2D and WebGL upload directly; the <img> path is the fallback.
	if (typeof createImageBitmap === "function") {
		try {
			const response = await fetch(src);
			if (response.ok) return await createImageBitmap(await response.blob());
		} catch {
			// fall through to the <img> path
		}
	}
	return loadImageElement(src);
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = "anonymous"; // keeps the canvas untainted for getImageData
		img.onload = () => resolve(img);
		img.onerror = reject;
		img.src = src;
	});
}
