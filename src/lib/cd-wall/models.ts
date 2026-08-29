export type JewelCaseModel = "detailed" | "charcoal";

export const DEFAULT_JEWEL_CASE_MODEL: JewelCaseModel = "detailed";
export const DEFAULT_HDRI_FILE = "023-hdrmaps-4k.exr";
export const DEFAULT_HDRI_PATH = `/hdri/${DEFAULT_HDRI_FILE}`;

/** Production wall defaults; the prototype keeps its own selectable fixture. */
export const DEFAULT_WALL_CASE_MODEL: JewelCaseModel = "charcoal";
// The pine-attic room as TRUE HDR, at 1K (1024x512, 1.6MB). HDR matters here —
// its bright window becomes a sharp specular glint + bloom on the glass/disc (an
// SDR jpg clamps that away and the reflections go flat). Resolution does not:
// every use goes through PMREM, whose roughness-0 mip is capped at 256px, so the
// 4K original (9.3MB) was 6x the download for pixels the prefilter threw away.
// The EXR path desaturates on load (neutralizeEnvironment) to kill the warm cast.
export const DEFAULT_WALL_HDRI_FILE = "pine_attic-1k.exr";
export const DEFAULT_WALL_HDRI_PATH = `/hdri/${DEFAULT_WALL_HDRI_FILE}`;

/**
 * The production wall and the single-case lab deliberately start from this
 * one setup. The wall keeps every album in one Three scene, so the shared
 * filtered attic environment is sampled from a consistent room rather than
 * each case getting its own approximation.
 */
export const DEFAULT_CD_CASE_SCENE = {
	caseModel: DEFAULT_WALL_CASE_MODEL,
	hdriPath: DEFAULT_WALL_HDRI_PATH,
	hdriRotation: 0,
	backgroundIntensity: 0.75,
	backgroundBlurriness: 0,
	showBackground: false,
	lightboxEnabled: false,
	environmentDesaturation: 0.85,
	keyIntensity: 5,
	softboxScale: 0.3,
	fillIntensity: 2,
	rimIntensity: 1,
	stripCount: 2,
	stripIntensity: 10,
	stripWidth: 0.15,
	stripLength: 8,
	stripSpacing: 2.2,
	stripHeight: 1.25,
	stripDistance: -2.5,
	stripSpecular: 18,
	// NOT dead-mirror (0.02): a dead-mirror disc reflects the PMREM environment
	// at its ~256px cap, which magnifies into visible blocky pixelation on the
	// big focused disc. A fine satin (0.07) blurs that into a smooth gloss while
	// the bright HDR window still reads as a diamond glint.
	discRoughness: 0.07,
	glassRoughness: 0.01,
	glassTransmission: 1,
	glassClearcoat: 1,
	glassClearcoatRoughness: 0.04,
	glassReflectivity: 2.2,
	environmentIntensity: 1,
	exposure: 0.95,
	bloomStrength: 0.35,
	bloomRadius: 0.4,
	// linear HDR units, and the ONE knob that separates "too bright" from the
	// diamond glints: only the brightest specular PEAKS (the sharp window
	// reflection) clear this and bloom; the merely-bright washes on the lid/disc
	// stay put. Raised from 3 → 8 to pull back the broad glare while keeping the
	// sparkle — it isolates bloom without dimming the reflection itself
	// (glassReflectivity), so the diamonds survive at full strength.
	bloomThreshold: 8,
} as const;

/**
 * Where the tray's disc hub sits, in final world units, from least-squares
 * circle fits of the hub teeth AND the disc-seat rim (the two agree to
 * <0.001 per model). Both artists modeled the hub right of the case center —
 * the hinge/spine eats the left edge, exactly like a real jewel case — so a
 * disc drawn at x=0 misses the seat.
 */
export const CASE_MODEL_HUB: Record<JewelCaseModel, { x: number; y: number }> =
	{
		detailed: { x: 0.045, y: 0 },
		charcoal: { x: 0.051, y: 0 },
	};

/**
 * The booklet rectangle, measured from the detailed bundle's own
 * "Insert Paper" mesh (1.2201×1.1618 raw, centered at x +0.0135) and scaled
 * into world units. The model says the booklet is slightly wider than tall
 * and hugs the right lip — the square-art-at-center guess left a bare,
 * see-through strip along the case's right edge.
 */
export const BOOKLET_RECT = { x: 0.059, y: 0, w: 1.244, h: 1.185 };

export const JEWEL_CASE_MODELS: {
	value: JewelCaseModel;
	label: string;
	description: string;
}[] = [
	{
		value: "detailed",
		label: "detailed",
		description: "Jewel Case: detailed clear shell and black tray.",
	},
	{
		value: "charcoal",
		label: "charcoal",
		description: "Jewel Case(smudge) geometry with clean, texture-free glass.",
	},
];
