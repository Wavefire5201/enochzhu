<script lang="ts">
	import { type Component, onMount } from "svelte";
	import type { CdAlbum } from "./albums";
	import { DEFAULT_WALL_HDRI_PATH } from "./models";

	interface Props {
		albums: CdAlbum[];
	}

	const { albums }: Props = $props();

	type WallModule = Component<{
		albums: CdAlbum[];
		openedSlot: number | null;
		onopen: (slot: number | null) => void;
		onfail: () => void;
	}>;

	let host = $state<HTMLElement>();
	let Wall3D = $state<WallModule | null>(null);
	let failed = $state(false);
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
	function prefetchAssets() {
		for (const href of [
			DEFAULT_WALL_HDRI_PATH,
			"/models/jewel-case-charcoal.glb",
			"/models/cd-case.glb",
		]) {
			const link = document.createElement("link");
			link.rel = "prefetch";
			link.href = href;
			document.head.appendChild(link);
		}
	}

	onMount(() => {
		if (albums.length === 0) return;
		// reduced motion and no-WebGL both live on the DOM strip below —
		// same philosophy as the hero (PRD-cd-wall §7)
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		const probe = document.createElement("canvas");
		if (!probe.getContext("webgl2")) return;

		// commit to the canvas: the fallback strip clips away now, so it never
		// flashes in during the load window before the wall mounts
		canvasIntended = true;

		// Mount (create the GL context + render loop) only as the section nears,
		// so an idle top-of-page visitor pays no continuous render cost. The
		// generous margin means it is already running before it scrolls into view.
		const io = new IntersectionObserver(
			async (entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				io.disconnect();
				await preloadWall();
				// chunk genuinely failed to load — bring the strip back
				if (preloaded) Wall3D = preloaded;
				else failed = true;
			},
			{ rootMargin: "1400px" },
		);
		if (host) io.observe(host);

		// Preload the chunk and assets during idle regardless of scroll, so the
		// download is done long before the mount — the user never waits on it.
		const eager = () => {
			prefetchAssets();
			void preloadWall();
		};
		const idle = window.requestIdleCallback;
		let cancelEager: () => void;
		if (idle) {
			const handle = idle(eager, { timeout: 2500 });
			cancelEager = () => window.cancelIdleCallback?.(handle);
		} else {
			const handle = setTimeout(eager, 1200);
			cancelEager = () => clearTimeout(handle);
		}

		return () => {
			io.disconnect();
			cancelEager();
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
				onfail={() => (failed = true)}
			/>
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
						class="aspect-square w-full rounded-xs object-cover"
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
						<p class="mt-1 text-xs leading-relaxed text-fg">{album.note}</p>
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
</style>
