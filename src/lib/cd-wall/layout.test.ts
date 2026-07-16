/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import {
	albumIndexAt,
	floorMod,
	poolSize,
	slotForMesh,
	slotX,
	windowStart,
} from "./layout";

describe("floorMod", () => {
	test("wraps negatives into [0, m)", () => {
		expect(floorMod(-1, 5)).toBe(4);
		expect(floorMod(-5, 5)).toBe(0);
		expect(floorMod(7, 5)).toBe(2);
		expect(floorMod(0, 5)).toBe(0);
	});
});

describe("slotForMesh", () => {
	const POOL = 8;

	test("every mesh gets a unique slot inside the window", () => {
		for (const start of [-37, -8, -1, 0, 1, 5, 8, 123]) {
			const slots = Array.from({ length: POOL }, (_, i) =>
				slotForMesh(i, POOL, start),
			);
			// all inside [start, start + POOL)
			for (const j of slots) {
				expect(j).toBeGreaterThanOrEqual(start);
				expect(j).toBeLessThan(start + POOL);
			}
			// congruence: mesh i owns slot ≡ i (mod POOL)
			slots.forEach((j, i) => expect(floorMod(j, POOL)).toBe(i));
			// bijective: the window is covered exactly
			expect(new Set(slots).size).toBe(POOL);
		}
	});

	test("advancing the window by one slot recycles exactly one mesh", () => {
		for (let start = -20; start < 20; start++) {
			const before = Array.from({ length: POOL }, (_, i) =>
				slotForMesh(i, POOL, start),
			);
			const after = Array.from({ length: POOL }, (_, i) =>
				slotForMesh(i, POOL, start + 1),
			);
			const moved = before.filter((j, i) => after[i] !== j);
			expect(moved.length).toBe(1);
			// and it jumps forward by exactly one pool span
			const i = before.findIndex((j, k) => after[k] !== j);
			expect(after[i] - before[i]).toBe(POOL);
		}
	});
});

describe("seamless looping", () => {
	test("album assignment repeats with the collection period", () => {
		expect(albumIndexAt(0, 3)).toBe(albumIndexAt(3, 3));
		expect(albumIndexAt(-1, 3)).toBe(2);
		expect(albumIndexAt(7, 3)).toBe(1);
	});

	test("single-album collection maps every slot to it", () => {
		for (let j = -10; j <= 10; j++) expect(albumIndexAt(j, 1)).toBe(0);
	});

	test("scrolling exactly one collection width lands on identical content", () => {
		const SPACING = 0.78;
		const ALBUMS = 5;
		const loop = ALBUMS * SPACING;
		// a slot's album + screen position pair recurs one loop later
		for (let j = -5; j <= 5; j++) {
			expect(albumIndexAt(j, ALBUMS)).toBe(albumIndexAt(j + ALBUMS, ALBUMS));
			expect(slotX(j + ALBUMS, SPACING, loop)).toBeCloseTo(
				slotX(j, SPACING, 0),
			);
		}
	});
});

describe("windowStart / poolSize", () => {
	test("window follows the scroll offset", () => {
		expect(windowStart(0, 1, 8)).toBe(-4);
		expect(windowStart(10, 1, 8)).toBe(6);
		expect(windowStart(-10, 1, 8)).toBe(-14);
	});

	test("pool covers the viewport with buffer, capped", () => {
		expect(poolSize(10, 0.78)).toBe(19);
		expect(poolSize(100, 0.78)).toBe(40);
	});
});
