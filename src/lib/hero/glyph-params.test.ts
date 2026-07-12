/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { defaultGlyphParams } from "./glyph-params";

describe("glyph params", () => {
	test("spark ships at zero (spec §1)", () => {
		expect(defaultGlyphParams.sparkAmount).toBe(0);
	});

	test("cursor reveal ships at zero (rejected by Enoch)", () => {
		expect(defaultGlyphParams.cursorReveal).toBe(0);
	});
});
