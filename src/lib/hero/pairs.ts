export interface HeroPair {
	id: string;
	label: string;
	photo: string;
	depth: string;
	/**
	 * Stills of the tuned glyph render for the static <img> layer (the LCP
	 * element and every fallback path). Two widths served via srcset — the
	 * glyph texture compresses poorly, so mobile must get the small file.
	 * Regenerate with scripts/capture-poster.mjs after retuning.
	 */
	poster: { small: string; large: string };
	/** width / height of the source photograph */
	aspect: number;
	/** normalized focal point retained when the landscape source is cropped */
	focus: readonly [x: number, y: number];
}

/**
 * Curated (photo, depth map) pairs. Swapping or adding a pair is data, not
 * code: drop the photo in static/hero/, run scripts/depth/generate-depth.py
 * and scripts/capture-poster.mjs, add an entry here.
 */
export const heroPairs: HeroPair[] = [
	{
		id: "fog-forest",
		label: "fog forest",
		photo: "/hero/fog-forest.jpeg",
		poster: {
			small: "/hero/fog-forest-poster-800.webp",
			large: "/hero/fog-forest-poster-1600.webp",
		},
		depth: "/hero/depth/fog-forest.png",
		aspect: 1920 / 800,
		focus: [0.5, 0.5],
	},
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
		focus: [0.59, 0.5],
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
		focus: [0.55, 0.5],
	},
	{
		id: "rain-city",
		label: "rain city",
		photo: "/hero/rain-city.jpeg",
		poster: {
			small: "/hero/rain-city-poster-800.webp",
			large: "/hero/rain-city-poster-1600.webp",
		},
		depth: "/hero/depth/rain-city.png",
		aspect: 1920 / 800,
		focus: [0.53, 0.5],
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
