/**
 * Scroll physics for the wall (PRD-cd-wall §5.3). Wheel, drag, and touch all
 * collapse into one world-unit `offset`. Plain mutable object — the render
 * loop reads it every frame, so Svelte reactivity would be pure overhead.
 */

const FRICTION = 2.6; // s⁻¹ — exponential decay, "lazy Susan" coast
// negative: the row drifts left → right; barely perceptible idle breathing
const DRIFT_SPEED = -0.14; // world units/s
const IDLE_AFTER_MS = 2400;
const MAX_FLING = 7; // world units/s

export class WallScroll {
	offset = 0;
	/** set by the scene from the live camera zoom */
	worldPerPixel = 1 / 220;
	dragging = false;
	hovering = false;
	/** pause the idle side-to-side drift without disabling interaction */
	autoScrollPaused = false;
	/** a case is held for 360° inspection — the row must not move */
	inspecting = false;
	/** which slot is being inspected; neighbors ease aside to make room */
	inspectSlot: number | null = null;
	/**
	 * When a case is opened it takes over the row: the offset eases to this
	 * target (the value that parks the opened slot dead-center) and every other
	 * physics input — fling, drift, drag — is suspended until it clears. Null
	 * whenever nothing is focused, so the row scrolls freely.
	 */
	focusTarget: number | null = null;
	/** smoothed 0..1 scroll speed — drives the velocity-reactive shine */
	energy = 0;
	/** bumped by clearHover(); cases watching it drop their lift state */
	hoverEpoch = 0;
	/** px moved during the current/last drag — click handlers use it to
	 * distinguish a tap from a fling */
	dragDistance = 0;

	#velocity = 0; // world units/s (inertia after release/wheel)
	#drift = 0;
	#prevOffset = 0;
	#lastInputAt = 0;
	#lastX = 0;
	#lastMoveAt = 0;
	#sampledV = 0; // px/s, smoothed over recent pointer moves

	wheel(deltaPx: number, now: number) {
		this.offset += deltaPx * this.worldPerPixel;
		// a touch of carry so successive ticks feel continuous, not stepped
		this.#velocity = deltaPx * this.worldPerPixel * 4;
		this.#interrupt(now);
		// the row moved under a possibly-stationary pointer: raycast hover
		// only refreshes on pointer events, so a stale `hovering` would pin
		// the label and suppress idle drift forever
		this.clearHover();
	}

	clearHover() {
		this.hovering = false;
		this.hoverEpoch++;
	}

	beginDrag(x: number, now: number) {
		this.dragging = true;
		this.dragDistance = 0;
		this.#lastX = x;
		this.#lastMoveAt = now;
		this.#sampledV = 0;
		this.#interrupt(now);
		this.#velocity = 0;
	}

	moveDrag(x: number, now: number) {
		if (!this.dragging) return;
		const dx = x - this.#lastX;
		const dt = Math.max(1, now - this.#lastMoveAt) / 1000;
		this.offset -= dx * this.worldPerPixel;
		this.dragDistance += Math.abs(dx);
		this.#sampledV = 0.75 * this.#sampledV + 0.25 * (dx / dt);
		this.#lastX = x;
		this.#lastMoveAt = now;
		this.#interrupt(now);
	}

	/** abandon the current drag without a fling (a hold matured into inspect) */
	cancelDrag() {
		this.dragging = false;
		this.#velocity = 0;
	}

	endDrag(now: number) {
		if (!this.dragging) return;
		this.dragging = false;
		// stale sample = the pointer stopped before release; don't fling
		const fresh = now - this.#lastMoveAt < 90;
		const v = fresh ? -this.#sampledV * this.worldPerPixel : 0;
		this.#velocity = Math.max(-MAX_FLING, Math.min(MAX_FLING, v));
		this.#interrupt(now);
	}

	/** advance physics one frame; returns the new offset */
	update(dt: number, now: number): number {
		// measured from actual offset movement, so drags count too
		const speed = Math.abs(this.offset - this.#prevOffset) / Math.max(dt, 1e-4);
		this.#prevOffset = this.offset;
		this.energy += (Math.min(1, speed / 5) - this.energy) * Math.min(1, dt * 4);

		// a focused case owns the row: ease to the centering offset and ignore
		// every other input until it is dismissed
		if (this.focusTarget !== null) {
			this.offset += (this.focusTarget - this.offset) * Math.min(1, dt * 6);
			this.#velocity = 0;
			this.#drift = 0;
			return this.offset;
		}

		if (this.autoScrollPaused) {
			this.#velocity = 0;
			this.#drift = 0;
			return this.offset;
		}

		if (this.dragging || this.inspecting) return this.offset;

		this.offset += this.#velocity * dt;
		this.#velocity *= Math.exp(-FRICTION * dt);
		if (Math.abs(this.#velocity) < 0.005) this.#velocity = 0;

		// idle drift eases in after a beat, instantly interrupted by input
		const idle =
			now - this.#lastInputAt > IDLE_AFTER_MS &&
			!this.hovering &&
			this.#velocity === 0;
		const target = idle ? DRIFT_SPEED : 0;
		this.#drift += (target - this.#drift) * Math.min(1, dt * 1.6);
		this.offset += this.#drift * dt;
		return this.offset;
	}

	#interrupt(now: number) {
		this.#lastInputAt = now;
		this.#drift = 0;
	}
}
