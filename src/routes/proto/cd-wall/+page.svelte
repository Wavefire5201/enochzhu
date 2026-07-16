<script lang="ts">
	// throwaway: synthetic fixtures to exercise the CD wall — seam order
	// through the loop point, placeholder→art fade, drag/inertia, empty
	// collection, mount/unmount leak cycles. Not content; noindex.
	import type { CdAlbum } from "$lib/cd-wall/albums";
	import CdWall from "$lib/cd-wall/CdWall.svelte";

	const swatches = [
		"#b5543a",
		"#b09a3c",
		"#4d9a4a",
		"#3a9a8c",
		"#4a6ab0",
		"#8a55b0",
		"#b04a86",
	];

	function cover(i: number, hex: string): string {
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="${hex}"/><text x="128" y="168" font-size="140" font-family="monospace" fill="#fff" text-anchor="middle">${i}</text></svg>`;
		return `data:image/svg+xml,${encodeURIComponent(svg)}`;
	}

	const albums: CdAlbum[] = swatches.map((hex, i) => ({
		id: `t${i + 1}`,
		title: `test ${i + 1}`,
		artist: "fixture",
		cover: cover(i + 1, hex),
		color: hex,
		link: i % 2 === 0 ? "https://example.com" : undefined,
	}));

	let mounted = $state(true);
	let cycles = $state(0);
</script>

<svelte:head>
	<title>proto/cd-wall</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="min-h-screen bg-bg px-10 py-16">
	<h1 class="font-mono text-sm text-muted">
		proto/cd-wall — 7 numbered fixtures; loop order must read 1…7 forever
	</h1>

	<button
		class="mt-4 font-mono text-xs text-ember"
		data-testid="toggle"
		onclick={() => {
			mounted = !mounted;
			if (mounted) cycles += 1;
		}}
	>
		{mounted ? "unmount" : "mount"} (cycles: {cycles})
	</button>

	<div class="mt-8" data-testid="wall-many">
		{#if mounted}
			<CdWall {albums} />
		{/if}
	</div>

	<p class="mt-16 font-mono text-xs text-muted">
		below: empty collection — must render nothing inside the marker
	</p>
	<div data-testid="wall-empty" class="border border-line">
		<CdWall albums={[]} />
	</div>
</div>
