/** Live-tunable glyph-field parameters (spec §1 uniform inventory). */
export interface GlyphParams {
	/** cell size in CSS px */
	cellSize: number;
	/** 0 = glyph field, 1 = pure blue-noise dither */
	ditherBlend: number;
	contrast: number;
	gamma: number;
	flowScale: number;
	flowSpeed: number;
	/** cursor parallax amplitude in UV units (depth-weighted) */
	parallax: number;
	/** cursor disturbance radius in CSS px */
	cursorRadius: number;
	cursorStrength: number;
	/** opacity of the real photograph under the glyphs (legibility floor) */
	baseTint: number;
	/** how fully the cursor resolves the field back to the clean photo — ships at 0 */
	cursorReveal: number;
	/** ember accent frequency — ships at 0 (spec §1) */
	sparkAmount: number;
	paper: string;
	ink: string;
	/** pointer damping rate, 1/s */
	damp: number;
}

/** User-tuned on the proto page, 2026-07-10 — the shipped look. */
export const defaultGlyphParams: GlyphParams = {
	cellSize: 10,
	ditherBlend: 0.1,
	contrast: 1.15,
	gamma: 0.9,
	flowScale: 3.0,
	flowSpeed: 0.05,
	parallax: 0.028,
	cursorRadius: 150,
	cursorStrength: 0.35,
	baseTint: 0.36,
	cursorReveal: 0,
	sparkAmount: 0,
	paper: "#0c110e",
	ink: "#b6c2b9",
	damp: 2.0,
};

/** 404: the image half-dissolved into characters (spec §4). */
export const lostGlyphParams: GlyphParams = {
	...defaultGlyphParams,
	cellSize: 16,
	contrast: 0.85,
	flowSpeed: 0.09,
	cursorStrength: 0.2,
};
