export interface HeroPair {
	id: string;
	label: string;
	photo: string;
	depth: string;
	/**
	 * Stills of the tuned glyph render for the static <img> layer (the LCP
	 * element and every fallback path). Two widths served via srcset — the
	 * glyph texture compresses poorly, so mobile must get the small file.
	 * Regenerate with scripts/hero/capture-posters.mjs after retuning.
	 */
	poster: { small: string; large: string };
	/** width / height of the source photograph */
	aspect: number;
	/** normalized focal point retained when the landscape source is cropped */
	focus: readonly [x: number, y: number];
	/**
	 * Unsplash attribution, rendered bottom-left over the hero. Omit for
	 * uncredited/non-Unsplash images. `url` points to the photo's Unsplash page
	 * (append `?utm_source=enochzhu&utm_medium=referral` per their guidelines).
	 */
	credit?: { name: string; url: string };
}

/**
 * Curated (photo, depth map) pairs. Swapping or adding a pair is data, not
 * code: add the wallpaper url to scripts/hero/input.txt and run
 * scripts/hero/backdrops.py, which crops the photo, builds its depth map and
 * writes the entry below; then scripts/hero/capture-posters.mjs for the
 * poster stills. See scripts/hero/README.md.
 *
 * To attribute: add `credit: { name: "Jane Doe", url: "https://unsplash.com/photos/…" }`
 * to a pair below; it appears bottom-left over the hero automatically.
 */
export const heroPairs: HeroPair[] = [
	{
		id: "mountain",
		label: "mountain",
		photo: "/hero/mountain.jpeg",
		poster: {
			small: "/hero/mountain-poster-800.webp",
			large: "/hero/mountain-poster-1600.webp",
		},
		depth: "/hero/depth/mountain.png",
		aspect: 1920 / 800,
		focus: [0.5, 0.5],
		credit: {
			name: "robert haverly",
			url: "https://unsplash.com/photos/mqpGa3H_w7M?utm_source=enochzhu&utm_medium=referral",
		},
	},
	{
		id: "forest-road",
		label: "forest road",
		photo: "/hero/forest-road.jpeg",
		poster: {
			small: "/hero/forest-road-poster-800.webp",
			large: "/hero/forest-road-poster-1600.webp",
		},
		depth: "/hero/depth/forest-road.png",
		aspect: 1920 / 800,
		focus: [0.5, 0.5],
		credit: {
			name: "karina skrypnik",
			url: "https://unsplash.com/photos/-EQ8L9lY50A?utm_source=enochzhu&utm_medium=referral",
		},
	},
	{
		id: "blossom",
		label: "blossom",
		photo: "/hero/blossom.jpeg",
		poster: {
			small: "/hero/blossom-poster-800.webp",
			large: "/hero/blossom-poster-1600.webp",
		},
		depth: "/hero/depth/blossom.png",
		aspect: 1920 / 800,
		focus: [0.5, 0.5],
		credit: {
			name: "jessica kramer",
			url: "https://unsplash.com/photos/AZTTuralYco?utm_source=enochzhu&utm_medium=referral",
		},
	},
	{
		id: "gapstow-bridge",
		label: "gapstow bridge",
		photo: "/hero/gapstow-bridge.jpeg",
		poster: {
			small: "/hero/gapstow-bridge-poster-800.webp",
			large: "/hero/gapstow-bridge-poster-1600.webp",
		},
		depth: "/hero/depth/gapstow-bridge.png",
		aspect: 1920 / 800,
		focus: [0.5, 0.5],
		credit: {
			name: "juan di nella",
			url: "https://unsplash.com/photos/ne1X1c9M0Hg?utm_source=enochzhu&utm_medium=referral",
		},
	},
	{
		id: "snow-peak",
		label: "snow peak",
		photo: "/hero/snow-peak.jpeg",
		poster: {
			small: "/hero/snow-peak-poster-800.webp",
			large: "/hero/snow-peak-poster-1600.webp",
		},
		depth: "/hero/depth/snow-peak.png",
		aspect: 1920 / 800,
		focus: [0.5, 0.5],
		credit: {
			name: "slava auchynnikau",
			url: "https://unsplash.com/photos/Z4g5S4sksPQ?utm_source=enochzhu&utm_medium=referral",
		},
	},
	{
		id: "red-flowers",
		label: "red flowers",
		photo: "/hero/red-flowers.jpeg",
		poster: {
			small: "/hero/red-flowers-poster-800.webp",
			large: "/hero/red-flowers-poster-1600.webp",
		},
		depth: "/hero/depth/red-flowers.png",
		aspect: 1920 / 800,
		focus: [0.5, 0.5],
		credit: {
			name: "mariano baraldi",
			url: "https://unsplash.com/photos/oWljDFJCVAs?utm_source=enochzhu&utm_medium=referral",
		},
	},
];

export function heroPairById(id: string | undefined): HeroPair | undefined {
	return heroPairs.find((pair) => pair.id === id);
}

/** srcset/sizes for a pair's poster — shared by Hero, FogNotFound, proto. */
export function posterSrcset(pair: HeroPair): {
	srcset: string;
	sizes: string;
} {
	return {
		srcset: `${pair.poster.small} 800w, ${pair.poster.large} 1600w`,
		sizes: "100vw",
	};
}
