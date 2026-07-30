<script lang="ts">
	import { type Component, onMount } from "svelte";
	import type { CdAlbum } from "./albums";
	import { DEFAULT_WALL_CASE_MODEL, DEFAULT_WALL_HDRI_PATH } from "./models";

	interface Props {
		albums: CdAlbum[];
	}

	const { albums }: Props = $props();

	type WallModule = Component<{
		albums: CdAlbum[];
		openedSlot: number | null;
		onopen: (slot: number | null) => void;
		onready: () => void;
		onfail: () => void;
	}>;

	let host = $state<HTMLElement>();
	let Wall3D = $state<WallModule | null>(null);
	let failed = $state(false);
	let wallReady = $state(false);
	// true the moment we know WebGL will run — used to hide the 2D fallback strip
	// during the load window so it never flashes in before the canvas mounts. It
	// stays false for no-JS / no-WebGL / reduced-motion, where the strip IS the
	// experience, and `failed` re-reveals it if the canvas can't come up.
	let canvasIntended = $state(false);
	const canvasActive = $derived(Wall3D !== null && !failed);
	// clip the fallback strip as soon as the canvas is committed to (not only once
	// it mounts), so it never flashes; it stays reachable for keyboard reveal
	const stripClipped = $derived(canvasIntended && !failed);
	// one case open at a time; tapping the open one navigates, tapping
	// elsewhere closes it
	// which on-screen slot has its lid open — a slot, not an album id: the
	// collection tiles, and every copy of an album must not open at once
	let openedSlot = $state<number | null>(null);

	// the imported chunk, held until we actually mount — importing does NOT
	// create the GL context or start the render loop; assigning Wall3D does
	let preloaded: WallModule | null = null;

	async function preloadWall() {
		if (preloaded) return;
		try {
			preloaded = (await import("./Wall3D.svelte")).default;
		} catch {
			// chunk failed to load — the DOM strip is already up
		}
	}

	// Warm the HTTP cache for the wall's heaviest assets so its own loaders hit
	// cache the instant it mounts — this is what makes "scroll down and it's
	// already there" true instead of watching textures pop in.
	function prefetchAssets(): Promise<void> {
		return Promise.allSettled(
			[
				DEFAULT_WALL_HDRI_PATH,
				`/models/jewel-case-${DEFAULT_WALL_CASE_MODEL}.glb`,
				"/models/cd-case.glb",
			].map((href) => {
				// Fetch during the post-hero warm-up rather than relying on `prefetch`:
				// some browsers give a prefetch almost no bandwidth. This leaves the
				// response in the HTTP cache for Three's loaders when the canvas mounts.
				return fetch(href, { cache: "force-cache" }).then((response) => {
					if (!response.ok) throw new Error(`failed to warm ${href}`);
					// `fetch` resolves at response headers. Consume the body before the
					// renderer mounts so the browser can reuse a complete cache entry,
					// rather than competing with a second request for the same EXR/GLB.
					return response.arrayBuffer();
				});
			}),
		).then(() => {});
	}

	onMount(() => {
		if (albums.length === 0) return;
		// reduced motion and no-WebGL both live on the DOM strip below —
		// same philosophy as the hero (PRD-cd-wall §7)
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		const probe = document.createElement("canvas");
		if (!probe.getContext("webgl2")) return;

		let io: IntersectionObserver | null = null;
		type IdleHandle = number | ReturnType<typeof setTimeout>;
		let warmIdleId: IdleHandle | null = null;
		let mountIdleId: IdleHandle | null = null;
		let warmAssets: Promise<void> | null = null;
		let mountStarted = false;
		let disposed = false;

		const warmWall = () => {
			warmAssets ??= prefetchAssets();
			void preloadWall();
		};
		const idle = (callback: () => void, timeout: number) => {
			if ("requestIdleCallback" in window) {
				return window.requestIdleCallback(callback, { timeout });
			}
			return setTimeout(callback, timeout);
		};
		const cancelIdle = (id: IdleHandle) => {
			if (typeof id === "number" && "cancelIdleCallback" in window) {
				window.cancelIdleCallback(id);
			} else {
				clearTimeout(id);
			}
		};
		const mountWall = async () => {
			if (mountStarted || disposed) return;
			mountStarted = true;
			warmWall();
			await Promise.all([warmAssets, preloadWall()]);
			if (disposed) return;
			if (preloaded) Wall3D = preloaded;
			else failed = true;
		};

		// Import and download on an idle slice, never in a scroll handler. The EXR
		// remains lazy, but this ensures its network payload and the Three chunk are
		// normally ready long before the section is near the viewport.
		warmIdleId = idle(warmWall, 4_000);
		io = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				io?.disconnect();
				// Mounting decodes the HDRI and creates the GL context. Doing that from an
				// idle callback avoids a long task in the same frame as the scroll that
				// revealed this section. The loader preserves feedback for a fast scroll.
				canvasIntended = true;
				mountIdleId = idle(() => void mountWall(), 1_500);
			},
			{ rootMargin: "1400px 0px" },
		);
		if (host) io.observe(host);

		return () => {
			disposed = true;
			io?.disconnect();
			if (warmIdleId !== null) cancelIdle(warmIdleId);
			if (mountIdleId !== null) cancelIdle(mountIdleId);
		};
	});
</script>

{#if albums.length > 0}
	<div bind:this={host} class="relative">
		{#if canvasActive && Wall3D}
			<Wall3D
				{albums}
				{openedSlot}
				onopen={(slot) => (openedSlot = slot)}
				onready={() => (wallReady = true)}
				onfail={() => (failed = true)}
			/>
		{/if}

		{#if canvasIntended && !failed && !wallReady}
			<div
				class="pointer-events-none absolute inset-x-[13%] bottom-8 z-20"
				role="status"
				aria-label="loading the CD wall"
			>
				<div class="wall-loader-track"><span></span></div>
			</div>
		{/if}

		<!-- the real content: an accessible, keyboard-navigable album list.
		     It IS the experience when the canvas can't run (reduced motion,
		     no WebGL, context loss); behind a live canvas it stays in the tab
		     order and presents itself when focus enters. -->
		<!-- tabindex: a scrollable region must be keyboard-reachable, and
		     focusing it is what reveals the list when no album carries a
		     focusable link -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<ul
			class="wall-list flex snap-x snap-mandatory gap-5 overflow-x-auto px-6 pb-3"
			class:wall-list-clipped={stripClipped}
			tabindex={stripClipped ? 0 : undefined}
			aria-label="albums"
		>
			{#each albums as album (album.id)}
				<li class="w-36 shrink-0 snap-start sm:w-44">
					<img
						src={album.cover}
						alt="{album.title}{album.artist
							? ` — ${album.artist}`
							: ''} album cover"
						loading="lazy"
						width="1024"
						height="1024"
						class="aspect-square w-full rounded-xs object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
						style="background-color: {album.color}"
					/>
					<h3 class="mt-2 font-display text-sm text-bright">
						{#if album.link}
							<a
								href={album.link}
								class="link-trace"
								target="_blank"
								rel="noopener noreferrer"
							>
								{album.title}
							</a>
						{:else}
							{album.title}
						{/if}
					</h3>
					<p class="font-mono text-xs text-muted">
						{[album.artist, album.year].filter(Boolean).join(" · ")}
					</p>
					{#if album.note}
						<p class="mt-1 text-xs leading-relaxed text-fg text-pretty">
							{album.note}
						</p>
					{/if}
				</li>
			{/each}
		</ul>
	</div>
{/if}

<style>
	/* parked behind the canvas but still real: zero-clipped, in the tab
	   order. The moment keyboard focus lands inside, it overlays the wall. */
	.wall-list-clipped {
		position: absolute;
		inset: 0;
		z-index: 10;
		overflow: hidden;
		clip-path: inset(50%);
	}

	.wall-list-clipped:focus-within {
		clip-path: none;
		overflow-x: auto;
		background: var(--color-bg);
	}

	.wall-loader-track {
		height: 1px;
		overflow: hidden;
		background: color-mix(in srgb, var(--color-muted) 22%, transparent);
	}

	.wall-loader-track span {
		display: block;
		height: 100%;
		width: 32%;
		background: var(--color-bright);
		animation: wall-loader 1.05s ease-in-out infinite alternate;
	}

	@keyframes wall-loader {
		from {
			transform: translateX(-105%);
		}
		to {
			transform: translateX(315%);
		}
	}
</style>
