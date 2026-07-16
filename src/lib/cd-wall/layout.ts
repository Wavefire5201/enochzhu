/**
 * Pure math for the recycled mesh pool (PRD-cd-wall §5.1).
 *
 * The row is an infinite line of "slots", one album per slot, repeating the
 * collection forever. Slot j sits at world x = j * spacing - scrollOffset.
 * A fixed pool of `poolSize` meshes covers the window of slots around the
 * current scroll position; mesh i always handles the unique slot congruent to
 * i (mod poolSize) inside that window, so when the window advances by one
 * slot exactly one mesh teleports across the row and is reassigned.
 */

/** mathematical modulo — result always in [0, m) even for negative n */
export function floorMod(n: number, m: number): number {
	return ((n % m) + m) % m;
}

/** first slot of the pool window centered on the scroll position */
export function windowStart(
	offset: number,
	spacing: number,
	poolSize: number,
): number {
	return Math.round(offset / spacing) - (poolSize >> 1);
}

/** the unique slot j ≡ meshIndex (mod poolSize) with j ∈ [start, start + poolSize) */
export function slotForMesh(
	meshIndex: number,
	poolSize: number,
	start: number,
): number {
	return meshIndex + Math.ceil((start - meshIndex) / poolSize) * poolSize;
}

/** which album a slot shows — the collection tiles forever */
export function albumIndexAt(slot: number, albumCount: number): number {
	return floorMod(slot, albumCount);
}

/** world-x of a slot at the current scroll offset */
export function slotX(slot: number, spacing: number, offset: number): number {
	return slot * spacing - offset;
}

/** meshes needed to cover a viewport `worldWidth` wide, plus recycle buffer */
export function poolSize(worldWidth: number, spacing: number): number {
	return Math.min(40, Math.ceil(worldWidth / spacing) + 6);
}
