<script lang="ts">
	import { Canvas } from "@threlte/core";
	import { onDestroy, onMount } from "svelte";
	import { WebGLRenderer } from "three";
	import type { CdAlbum } from "./albums";
	import CdActions from "./CdActions.svelte";
	import { albumIndexAt } from "./layout";
	import { PreviewPlayer } from "./preview-player.svelte";
	import Scene from "./Scene.svelte";
	import { WallScroll } from "./scroll";

	interface Props {
		albums: CdAlbum[];
		openedSlot: number | null;
		onopen: (slot: number | null) => void;
		onready: () => void;
		onfail: () => void;
	}

	const { albums, openedSlot, onopen, onready, onfail }: Props = $props();

	const scroll = new WallScroll();
	// The player is owned here, above CdActions, so opening a case fades the
	// looping preview in and closing fades it out even as the panel unmounts.
	const player = new PreviewPlayer();
	onDestroy(() => player.destroy());

	$effect(() => {
		if (openedSlot === null) {
			player.close();
			return;
		}
		const album = albums[albumIndexAt(openedSlot, albums.length)];
		player.open(); // mark open; plays at once if the clip is already resolved
		void player.load(album); // resolve the preview, auto-playing when ready
	});

	let host = $state<HTMLElement>();
	let hovered = $state<{ album: CdAlbum; slot: number } | null>(null);
	let pressed = false;
	let grabbing = $state(false);

	onMount(() => {
		const el = host;
		if (!el) return;
		// horizontal wheel/trackpad intent drives the row; vertical wheel keeps
		// scrolling the page — an embedded section must not hijack it. Manual
		// listener because Svelte registers `onwheel` passively.
		const onWheel = (event: WheelEvent) => {
			// a focused case locks the row AND the page: swallow the gesture so the
			// presented case can't scroll out from under the reader
			if (openedSlot !== null) {
				event.preventDefault();
				return;
			}
			if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
			event.preventDefault();
			scroll.wheel(event.deltaX, performance.now());
			hovered = null; // the row slid under the pointer; the label is stale
			onopen(null); // moving the row closes an open case
		};
		el.addEventListener("wheel", onWheel, { passive: false });
		// clicking outside the canvas closes an open case — feels right, keeps
		// the focus on the content the user is reading
		const onBackgroundClick = (event: MouseEvent) => {
			if (host && !host.contains(event.target as Node)) onopen(null);
		};
		// the immersive lock must have a keyboard exit, not only a click
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") onopen(null);
		};
		window.addEventListener("mousedown", onBackgroundClick);
		window.addEventListener("keydown", onKey);
		return () => {
			el.removeEventListener("wheel", onWheel);
			window.removeEventListener("mousedown", onBackgroundClick);
			window.removeEventListener("keydown", onKey);
			// unmount mid-drag (context loss during a fling, section teardown)
			// must not strand the window listeners
			detachDrag();
		};
	});

	// While a case is focused the page itself is pinned, so the presented case
	// holds center instead of scrolling away mid-read. Restored the instant it
	// closes — the effect's teardown also covers an unmount while still open.
	$effect(() => {
		if (openedSlot === null) return;
		const previous = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = previous;
		};
	});

	// drag via window listeners, no pointer capture: capture would retarget
	// pointerup away from the canvas and break tap-to-open on the cases
	function down(event: PointerEvent) {
		if (event.pointerType === "mouse" && event.button !== 0) return;
		pressed = true;
		scroll.beginDrag(event.clientX, performance.now());
		window.addEventListener("pointermove", move);
		window.addEventListener("pointerup", up);
		window.addEventListener("pointercancel", up);
	}

	function move(event: PointerEvent) {
		// a focused case owns the row — a stray drag must not scrub it off-center
		if (!pressed || scroll.inspecting || openedSlot !== null) return;
		scroll.moveDrag(event.clientX, performance.now());
		// same threshold as the tap guard in CdCase — the cursor must not
		// promise a drag that would still open a link
		if (scroll.dragDistance > 8 && !grabbing) {
			grabbing = true;
			onopen(null); // dragging the row closes an open case
		}
	}

	function up() {
		pressed = false;
		grabbing = false;
		// releasing an inspected case must not fling the row
		if (scroll.inspecting) scroll.cancelDrag();
		else scroll.endDrag(performance.now());
		detachDrag();
	}

	function detachDrag() {
		window.removeEventListener("pointermove", move);
		window.removeEventListener("pointerup", up);
		window.removeEventListener("pointercancel", up);
	}
</script>

<!-- decorative: the accessible album list lives in CdWall -->
<div
	bind:this={host}
	class="relative h-[28rem] w-full select-none sm:h-[36rem] {grabbing
		? 'cursor-grabbing'
		: hovered
			? 'cursor-pointer'
			: 'cursor-grab'}"
	style="touch-action: pan-y"
	aria-hidden="true"
	onpointerdown={down}
>
	<!-- alpha renderer: the canvas clears transparent so the site background
	     shows through — Threlte's default context is opaque black. It is wrapped
	     in a mask so the bright reflections dissolve into the page at every edge
	     instead of hard-cutting at the canvas rectangle. -->
	<div class="wall-canvas-mask absolute inset-0">
		<Canvas
			dpr={Math.min(2, window.devicePixelRatio)}
			createRenderer={(canvas) => {
				const r = new WebGLRenderer({
					canvas,
					alpha: true,
					antialias: true,
					powerPreference: "high-performance",
					premultipliedAlpha: false,
				});
				// belt and suspenders: explicit transparent clear so the site
				// background shows through no matter what
				r.setClearColor(0x000000, 0);
				return r;
			}}
		>
			<Scene
				{albums}
				perspectiveWall
				{scroll}
				{openedSlot}
				{onopen}
				{onready}
				onhover={(album, slot) =>
					(hovered = album && slot !== undefined ? { album, slot } : null)}
				{onfail}
			/>
		</Canvas>
	</div>

	<!-- the payoff: an opened case squares up center-stage while the row parts
	     around it, and its details arrive in the space cleared to its right.
	     Sits OUTSIDE the mask so the type stays crisp over the bright glass. -->
	{#if openedSlot !== null}
		{@const focused = albums[albumIndexAt(openedSlot, albums.length)]}
		<!-- text hugs the centered case's right edge. No scrim box — a black panel
		     read as a seam against the page's #0c110e; a bg-colored text-shadow
		     dissolves any bright reflection behind the glyphs instead. The pl
		     offset clears the case, which squares up at ~half its scaled width
		     right of screen center. -->
		<div
			class="pointer-events-none absolute inset-y-0 left-1/2 z-10 flex items-center pl-[11rem] sm:pl-[15rem]"
			style="text-shadow: 0 1px 14px var(--color-bg), 0 0 36px var(--color-bg)"
		>
			<!-- the disc itself now carries title/artist/year; this caption is
			     trimmed to the blurb + controls -->
			<div class="flex w-[19rem] flex-col gap-3">
				<span class="inline-block size-2 bg-white"></span>
				{#if focused.note}
					<p class="text-sm leading-relaxed text-muted">
						{focused.note}
					</p>
				{/if}
				<div class="pointer-events-auto">
					<CdActions album={focused} {player} />
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	/* Fade every edge of the canvas to transparent so bright reflections blend
	   into the dark page rather than terminating at a visible rectangle. Wide,
	   eased falloffs (intermediate half-alpha stops) so even a blown-out HDR
	   glint dissolves smoothly instead of showing a hard border where the halo
	   meets the canvas edge. Two gradients intersected mask all four sides. */
	.wall-canvas-mask {
		-webkit-mask-image:
			linear-gradient(
				to right,
				transparent,
				rgba(0, 0, 0, 0.5) 5%,
				#000 13%,
				#000 87%,
				rgba(0, 0, 0, 0.5) 95%,
				transparent
			),
			linear-gradient(
				to bottom,
				transparent,
				rgba(0, 0, 0, 0.5) 6%,
				#000 17%,
				#000 83%,
				rgba(0, 0, 0, 0.5) 94%,
				transparent
			);
		-webkit-mask-composite: source-in;
		mask-image:
			linear-gradient(
				to right,
				transparent,
				rgba(0, 0, 0, 0.5) 5%,
				#000 13%,
				#000 87%,
				rgba(0, 0, 0, 0.5) 95%,
				transparent
			),
			linear-gradient(
				to bottom,
				transparent,
				rgba(0, 0, 0, 0.5) 6%,
				#000 17%,
				#000 83%,
				rgba(0, 0, 0, 0.5) 94%,
				transparent
			);
		mask-composite: intersect;
	}
</style>
