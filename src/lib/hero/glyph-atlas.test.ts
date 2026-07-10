/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { equalizeSlots, orderByCoverage } from "./glyph-atlas";

describe("orderByCoverage", () => {
	test("sorts ascending by ink coverage", () => {
		const entries = [
			{ char: "@", coverage: 0.61 },
			{ char: " ", coverage: 0 },
			{ char: ":", coverage: 0.12 },
		];
		expect(orderByCoverage(entries)).toEqual([" ", ":", "@"]);
	});

	test("is stable for equal coverage", () => {
		const entries = [
			{ char: "a", coverage: 0.3 },
			{ char: "b", coverage: 0.3 },
		];
		expect(orderByCoverage(entries)).toEqual(["a", "b"]);
	});
});

describe("equalizeSlots", () => {
	test("maps slot targets to nearest coverage, ends anchored", () => {
		// coverages: space-ish, sparse, mid, dense
		const slots = equalizeSlots([0, 0.05, 0.3, 0.6], 7);
		expect(slots[0]).toBe(0); // target 0 → space
		expect(slots[6]).toBe(3); // target max → densest
		// target 0.3 (slot 3 of 0..0.6) → the mid glyph
		expect(slots[3]).toBe(2);
	});

	test("midtone slots do not collapse to sparse glyphs", () => {
		// nonlinear ramp like a real charset
		const slots = equalizeSlots([0, 0.02, 0.05, 0.1, 0.45, 0.6], 12);
		// upper-middle targets should reach the dense glyphs
		expect(slots[8]).toBeGreaterThanOrEqual(4);
	});
});
