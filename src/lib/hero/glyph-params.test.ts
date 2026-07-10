/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { defaultGlyphParams, lostGlyphParams } from "./glyph-params";

describe("glyph params", () => {
	test("spark ships at zero (spec §1)", () => {
		expect(defaultGlyphParams.sparkAmount).toBe(0);
		expect(lostGlyphParams.sparkAmount).toBe(0);
	});

	test("404 preset is coarser and lower contrast than default", () => {
		expect(lostGlyphParams.cellSize).toBeGreaterThan(
			defaultGlyphParams.cellSize,
		);
		expect(lostGlyphParams.contrast).toBeLessThan(defaultGlyphParams.contrast);
	});
});
