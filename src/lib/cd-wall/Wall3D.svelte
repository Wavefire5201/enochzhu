<script lang="ts">
	import { Canvas } from "@threlte/core";
	import { onDestroy, onMount, untrack } from "svelte";
	import { WebGLRenderer } from "three";
	import type { CdAlbum } from "./albums";
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
			untrack(() => player.close());
			return;
		}
		const album = albums[albumIndexAt(openedSlot, albums.length)];
		// untrack: the player reads its own reactive state (previewUrl) and load()
		// writes it, so tracking here would loop the effect and spawn audio nodes.
		untrack(() => {
			player.open(); // mark open; plays at once if the clip is already resolved
			void player.load(album); // resolve the preview, auto-playing when ready
		});
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

	function setVolume(event: Event) {
		player.setVolume(
			Number((event.currentTarget as HTMLInputElement).value) / 100,
		);
	}

	let lastOpenedSlot = $state<number | null>(null);
	$effect(() => {
		if (openedSlot !== null) {
			lastOpenedSlot = openedSlot;
		}
	});
	const activeSlot = $derived(
		openedSlot !== null ? openedSlot : lastOpenedSlot,
	);
</script>

<!-- decorative: the accessible album list lives in CdWall -->
<div
	bind:this={host}
	class="relative h-112 w-full select-none sm:h-144 {grabbing
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
				{player}
			/>
		</Canvas>
	</div>

	<!-- the payoff: an opened case squares up center-stage while the row parts
	     around it, and its details arrive in the space cleared to its right.
	     Sits OUTSIDE the mask so the type stays crisp over the bright glass. -->
	{#if activeSlot !== null && (openedSlot !== null || player.openAmount > 0.001)}
		{@const focused = albums[albumIndexAt(activeSlot, albums.length)]}

		<!-- HUD overlay containing both flat vertical control strip and notes.
		     On mobile, it centers at the bottom (below the case).
		     On desktop, it floats on the right of the CD case. -->
		<div
			class="pointer-events-none absolute z-10 flex flex-row items-center gap-6
			       inset-x-0 bottom-0 justify-center pl-0
			       sm:inset-y-0 sm:bottom-0 sm:left-1/2 sm:right-auto sm:justify-start sm:pl-[12.5rem] md:pl-[14.5rem] lg:pl-[16.5rem]"
			style="text-shadow: 0 1px 14px var(--color-bg), 0 0 36px var(--color-bg); opacity: {player.openAmount *
				(player.inspecting ? 0 : 1)}; transition: {player.openAmount > 0.001 &&
			player.openAmount < 0.999
				? 'none'
				: 'opacity 300ms'}"
		>
			<!-- Control Panel Column (holds horizontal layout on mobile, vertical column on desktop) -->
			<div
				class="{player.openAmount > 0.9 && !player.inspecting
					? 'pointer-events-auto'
					: 'pointer-events-none'} flex flex-row sm:flex-col items-center gap-4 sm:gap-5 py-1.5 select-none"
			>
				<!-- Play/Pause Button (left on mobile, bottom/3rd on desktop) -->
				{#if player.previewUrl}
					<button
						type="button"
						class="play-pause-flat-btn relative flex size-8 shrink-0 items-center justify-center text-muted hover:text-bright hover:scale-110 active:scale-[0.96] transition-[color,transform] duration-150 ease-out cursor-pointer after:absolute after:inset-[-6px] order-1 sm:order-3"
						onclick={() => player.toggle()}
						aria-label={player.playing ? "Pause preview" : "Play preview"}
					>
						{#if player.playing}
							<!-- Pause Icon -->
							<svg class="size-5 fill-current" viewBox="0 0 24 24">
								<rect x="5" y="4" width="4" height="16" />
								<rect x="15" y="4" width="4" height="16" />
							</svg>
						{:else}
							<!-- Play Icon -->
							<svg class="size-5 fill-current ml-0.5" viewBox="0 0 24 24">
								<path d="M8 5v14l11-7z" />
							</svg>
						{/if}
					</button>
				{/if}

				<!-- Volume Slider (middle on mobile, middle/2nd on desktop) -->
				{#if player.previewUrl}
					<div
						class="slider-container relative flex items-center justify-center order-2 sm:order-2"
					>
						<!-- Track line -->
						<div class="track-line absolute bg-muted/40">
							<div
								class="track-fill absolute bg-bright"
								style="--volume-percent: {player.volume * 100}%"
							></div>
						</div>
						<!-- Native range input -->
						<input
							type="range"
							min="0"
							max="100"
							step="1"
							value={Math.round(player.volume * 100)}
							oninput={setVolume}
							class="flat-slider"
							aria-label="Volume"
						/>
					</div>
				{/if}

				<!-- Spotify Icon Link (right on mobile, top/1st on desktop) -->
				{#if focused.link}
					<a
						class="text-muted hover:text-ember transition-[color,transform] duration-150 ease-out hover:scale-110 active:scale-[0.96] flex size-8 shrink-0 items-center justify-center cursor-pointer order-3 sm:order-1"
						href={focused.link}
						target="_blank"
						rel="noopener noreferrer"
						aria-label="Listen on Spotify"
					>
						<svg class="size-6 fill-current" viewBox="0 0 24 24">
							<path
								d="M12 2C6.477 2 2 6.484 2 12.017c0 5.537 4.477 10.019 10 10.019 5.522 0 10-4.482 10-10.019C22 6.484 17.522 2 12 2zm4.586 14.424c-.18.295-.563.387-.857.207-2.377-1.454-5.37-1.783-8.893-1.002-.336.075-.668-.136-.744-.471-.074-.337.136-.668.471-.744 3.844-.877 7.14-.5 9.822 1.141.295.18.387.563.201.869zm1.222-2.724c-.226.367-.707.487-1.074.26-2.72-1.672-6.87-2.157-10.082-1.182-.413.125-.847-.107-.972-.52-.125-.413.107-.847.52-.972 3.676-1.116 8.243-.574 11.35 1.339.366.226.486.707.258 1.075zm.106-2.833C14.492 8.847 8.79 8.658 5.485 9.66c-.524.16-1.078-.14-1.237-.664-.16-.524.14-1.078.664-1.237 3.8-1.153 10.1-.93 13.94 1.353.47.28.625.83.346 1.352-.28.523-.832.678-1.353.398z"
							/>
						</svg>
					</a>
				{/if}
			</div>

			<!-- Notes -->
			{#if focused.note}
				<div class="flex w-[14rem] sm:w-[17rem] flex-col gap-3">
					<p class="text-sm leading-relaxed text-muted text-pretty">
						{focused.note}
					</p>
				</div>
			{/if}
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

	.slider-container {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 5.5rem;
		height: 2.75rem;
	}

	@media (min-width: 640px) {
		.slider-container {
			width: 1.25rem;
			height: 5.5rem;
		}
	}

	.track-line {
		position: absolute;
		background: color-mix(in srgb, var(--color-muted) 40%, transparent);
		width: 5rem;
		height: 1.5px;
	}

	@media (min-width: 640px) {
		.track-line {
			width: 1.5px;
			height: 5rem;
		}
	}

	.track-fill {
		position: absolute;
		background: var(--color-bright);
		left: 0;
		top: 0;
		bottom: 0;
		width: var(--volume-percent);
	}

	@media (min-width: 640px) {
		.track-fill {
			top: auto;
			left: 0;
			right: 0;
			bottom: 0;
			width: auto;
			height: var(--volume-percent);
		}
	}

	.flat-slider {
		position: absolute;
		width: 5.5rem;
		height: 2.75rem;
		margin: 0;
		cursor: pointer;
		appearance: none;
		-webkit-appearance: none;
		background: transparent;
		outline: none;
	}

	@media (min-width: 640px) {
		.flat-slider {
			transform: rotate(-90deg);
			height: 1.25rem;
		}
	}

	.flat-slider::-webkit-slider-runnable-track {
		background: transparent;
	}

	.flat-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 50%;
		background: var(--color-bright);
		cursor: pointer;
		transition:
			transform 120ms ease,
			background-color 120ms ease;
	}

	.flat-slider::-webkit-slider-thumb:hover {
		transform: scale(1.3);
		background-color: var(--color-ember);
	}

	.flat-slider::-moz-range-thumb {
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 50%;
		background: var(--color-bright);
		cursor: pointer;
		transition:
			transform 120ms ease,
			background-color 120ms ease;
	}

	.flat-slider::-moz-range-thumb:hover {
		transform: scale(1.3);
		background-color: var(--color-ember);
	}
</style>
