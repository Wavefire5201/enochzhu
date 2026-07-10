export interface GlyphAtlas {
	canvas: HTMLCanvasElement;
	count: number;
	charset: string;
}

export function orderByCoverage(
	entries: { char: string; coverage: number }[],
): string[] {
	return [...entries]
		.sort((a, b) => a.coverage - b.coverage)
		.map((e) => e.char);
}

/**
 * Glyph ink coverage is far from linear in charset order (the jump from `*`
 * to `#` is huge), which crushes midtones. Equalize by picking, for each of
 * `slots` targets spaced linearly up to the densest glyph's coverage, the
 * char whose coverage is closest — index-space becomes perceptually linear.
 */
export function equalizeSlots(coverages: number[], slots: number): number[] {
	const max = Math.max(...coverages, Number.EPSILON);
	return Array.from({ length: slots }, (_, i) => {
		const target = (i / (slots - 1)) * max;
		let best = 0;
		for (let c = 1; c < coverages.length; c++) {
			if (
				Math.abs(coverages[c] - target) < Math.abs(coverages[best] - target)
			) {
				best = c;
			}
		}
		return best;
	});
}

export const DEFAULT_CHARSET = " .,:;i+*x#%@│┌┐└";
export const ATLAS_SLOTS = 32;

/**
 * Draws each glyph in Commit Mono to a single-row atlas, ordered by measured
 * ink coverage (sparse → dense) so the shader can index by tone. The alpha
 * channel carries the mask. Browser-only.
 */
export async function buildGlyphAtlas(
	charset: string = DEFAULT_CHARSET,
	cellPx = 64,
): Promise<GlyphAtlas> {
	const chars = [...new Set([...charset])];
	const font = `${Math.round(cellPx * 0.8)}px "Commit Mono"`;
	await document.fonts.load(font);

	const measure = document.createElement("canvas");
	measure.width = cellPx;
	measure.height = cellPx;
	const mctx = measure.getContext("2d", { willReadFrequently: true });
	if (!mctx) throw new Error("2d context unavailable");
	mctx.font = font;
	mctx.textAlign = "center";
	mctx.textBaseline = "middle";
	mctx.fillStyle = "#fff";

	const coverageOf = (char: string): number => {
		mctx.clearRect(0, 0, cellPx, cellPx);
		mctx.fillText(char, cellPx / 2, cellPx / 2);
		const data = mctx.getImageData(0, 0, cellPx, cellPx).data;
		let ink = 0;
		for (let i = 3; i < data.length; i += 4) ink += data[i];
		return ink / (255 * cellPx * cellPx);
	};

	const entries = chars.map((char) => ({ char, coverage: coverageOf(char) }));
	entries.sort((a, b) => a.coverage - b.coverage);
	const slotIndices = equalizeSlots(
		entries.map((e) => e.coverage),
		ATLAS_SLOTS,
	);
	const slots = slotIndices.map((i) => entries[i].char);

	const canvas = document.createElement("canvas");
	canvas.width = cellPx * slots.length;
	canvas.height = cellPx;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("2d context unavailable");
	ctx.font = font;
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillStyle = "#fff";
	slots.forEach((char, i) => {
		ctx.fillText(char, i * cellPx + cellPx / 2, cellPx / 2);
	});

	return { canvas, count: slots.length, charset: slots.join("") };
}
