<script lang="ts">
	import type { PreviewPlayer } from "./preview-player.svelte";

	interface Props {
		player: PreviewPlayer;
		/** projected disc centre + radius (px, in the canvas host's coordinates) */
		anchor: { x: number; y: number; radius: number } | null;
	}

	const { player, anchor }: Props = $props();

	// internal SVG coordinate space is a fixed 100×100 box scaled to the anchor,
	// so every radius below is a fraction of the disc's on-screen size
	const VOL_R = 45;
	const PROG_R = 34;
	const START = 225; // arc opens at the bottom: 225°→495° clockwise (270° sweep)
	const SWEEP = 270;

	function polar(r: number, deg: number): [number, number] {
		const a = (deg * Math.PI) / 180;
		return [50 + r * Math.sin(a), 50 - r * Math.cos(a)];
	}

	function arc(r: number, from: number, to: number): string {
		const [x0, y0] = polar(r, from);
		const [x1, y1] = polar(r, to);
		const large = to - from > 180 ? 1 : 0;
		return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
	}

	const volEnd = $derived(START + player.volume * SWEEP);
	const progEnd = $derived(START + player.progress * SWEEP);
	const [volThumbX, volThumbY] = $derived(polar(VOL_R, volEnd));

	let root = $state<SVGSVGElement>();
	let drag: "vol" | "seek" | null = null;

	/** map a pointer position (client px) to a 0..1 value along the arc */
	function valueAt(clientX: number, clientY: number): number {
		if (!root) return 0;
		const rect = root.getBoundingClientRect();
		const ux = ((clientX - rect.left) / rect.width) * 100;
		const uy = ((clientY - rect.top) / rect.height) * 100;
		const ang = (Math.atan2(ux - 50, -(uy - 50)) * 180) / Math.PI;
		const shifted = (ang - START + 360) % 360;
		if (shifted > SWEEP) return shifted > (360 + SWEEP) / 2 ? 0 : 1;
		return shifted / SWEEP;
	}

	function apply(clientX: number, clientY: number) {
		const v = valueAt(clientX, clientY);
		if (drag === "vol") player.setVolume(v);
		else if (drag === "seek") player.seek(v * player.duration);
	}

	function begin(zone: "vol" | "seek", event: PointerEvent) {
		event.stopPropagation();
		drag = zone;
		apply(event.clientX, event.clientY);
		window.addEventListener("pointermove", move);
		window.addEventListener("pointerup", end);
		window.addEventListener("pointercancel", end);
	}

	function move(event: PointerEvent) {
		apply(event.clientX, event.clientY);
	}

	function end() {
		drag = null;
		window.removeEventListener("pointermove", move);
		window.removeEventListener("pointerup", end);
		window.removeEventListener("pointercancel", end);
	}

	function onVolKey(event: KeyboardEvent) {
		const step = 0.05;
		if (event.key === "ArrowRight" || event.key === "ArrowUp")
			player.setVolume(player.volume + step);
		else if (event.key === "ArrowLeft" || event.key === "ArrowDown")
			player.setVolume(player.volume - step);
		else if (event.key === "Home") player.setVolume(0);
		else if (event.key === "End") player.setVolume(1);
		else return;
		event.preventDefault();
	}

	function onSeekKey(event: KeyboardEvent) {
		if (!player.duration) return;
		const step = 2; // seconds
		if (event.key === "ArrowRight" || event.key === "ArrowUp")
			player.seek(player.currentTime + step);
		else if (event.key === "ArrowLeft" || event.key === "ArrowDown")
			player.seek(player.currentTime - step);
		else if (event.key === "Home") player.seek(0);
		else if (event.key === "End") player.seek(player.duration);
		else return;
		event.preventDefault();
	}
</script>

{#if anchor}
	<div
		class="disc-dial"
		style="left:{anchor.x - anchor.radius}px; top:{anchor.y -
			anchor.radius}px; width:{anchor.radius * 2}px; height:{anchor.radius *
			2}px;"
	>
		<svg bind:this={root} viewBox="0 0 100 100" aria-hidden="true">
			<!-- progress ring -->
			<path class="track" d={arc(PROG_R, START, START + SWEEP)} />
			{#if player.progress > 0.001}
				<path class="prog-fill" d={arc(PROG_R, START, progEnd)} />
			{/if}
			<!-- volume arc -->
			<path class="track" d={arc(VOL_R, START, START + SWEEP)} />
			{#if player.volume > 0.001 && !player.muted}
				<path class="vol-fill" d={arc(VOL_R, START, volEnd)} />
			{/if}
			{#if !player.muted}
				<circle class="thumb" cx={volThumbX} cy={volThumbY} r="3.4" />
			{/if}
			<!-- Wide transparent hit paths make the whole band grabbable by pointer.
			     These are pointer-only conveniences; the focusable, keyboard- and
			     screen-reader-operable equivalents are the role="slider" elements
			     below, so the paths intentionally carry no ARIA role. -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<path
				class="hit"
				d={arc(VOL_R, START, START + SWEEP)}
				onpointerdown={(e) => begin("vol", e)}
			/>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<path
				class="hit"
				d={arc(PROG_R, START, START + SWEEP)}
				onpointerdown={(e) => begin("seek", e)}
			/>
		</svg>

		<!-- focusable, screen-reader-operable equivalents -->
		<div class="sliders">
			<div
				class="slider"
				role="slider"
				tabindex="0"
				aria-label="preview volume"
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={Math.round(player.volume * 100)}
				onkeydown={onVolKey}
			></div>
			<div
				class="slider"
				role="slider"
				tabindex="0"
				aria-label="preview position"
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={Math.round(player.progress * 100)}
				onkeydown={onSeekKey}
			></div>
		</div>

		<button
			type="button"
			class="mute"
			aria-label={player.muted ? "unmute preview" : "mute preview"}
			aria-pressed={player.muted}
			onpointerdown={(e) => e.stopPropagation()}
			onclick={() => player.toggleMute()}
		>
			{player.muted ? "🔇" : "🔊"}
		</button>
	</div>
{/if}

<style>
	.disc-dial {
		position: absolute;
		z-index: 12;
		pointer-events: none;
		touch-action: none;
		animation: dial-in 360ms cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	svg {
		width: 100%;
		height: 100%;
		overflow: visible;
	}

	.track {
		fill: none;
		stroke: color-mix(in srgb, var(--color-fg) 22%, transparent);
		stroke-width: 1.6;
		stroke-linecap: round;
	}

	.prog-fill {
		fill: none;
		stroke: var(--color-bright);
		stroke-width: 1.6;
		stroke-linecap: round;
		opacity: 0.85;
	}

	.vol-fill {
		fill: none;
		stroke: var(--color-ember);
		stroke-width: 2.6;
		stroke-linecap: round;
		filter: drop-shadow(
			0 0 2px color-mix(in srgb, var(--color-ember) 60%, transparent)
		);
	}

	.thumb {
		fill: var(--color-bright);
		stroke: var(--color-bg);
		stroke-width: 1;
	}

	.hit {
		fill: none;
		stroke: transparent;
		stroke-width: 9;
		pointer-events: stroke;
		cursor: pointer;
	}

	.sliders {
		position: absolute;
		inset: 0;
	}

	/* the operable slider proxies sit over the two bands, invisible but focusable
	   so the dial is fully keyboard- and screen-reader-operable */
	.slider {
		position: absolute;
		inset: 6%;
		border-radius: 999px;
		pointer-events: none;
	}

	.slider:focus-visible {
		outline: 2px solid var(--color-bright);
		outline-offset: 2px;
	}

	.mute {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		display: grid;
		place-items: center;
		width: 30%;
		height: 30%;
		min-width: 1.9rem;
		min-height: 1.9rem;
		padding: 0;
		border: 1px solid color-mix(in srgb, var(--color-fg) 26%, transparent);
		border-radius: 999px;
		background: color-mix(in srgb, var(--color-bg) 55%, transparent);
		backdrop-filter: blur(6px);
		color: var(--color-bright);
		font-size: 0.85rem;
		line-height: 1;
		cursor: pointer;
		pointer-events: auto;
		transition:
			transform 160ms ease,
			border-color 160ms ease;
	}

	.mute:hover,
	.mute:focus-visible {
		transform: translate(-50%, -50%) scale(1.08);
		border-color: var(--color-bright);
		outline: none;
	}

	@keyframes dial-in {
		from {
			opacity: 0;
			transform: scale(0.85);
		}
	}
</style>
