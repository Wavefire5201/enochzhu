<script lang="ts">
import type { Component } from "svelte";
import { onMount } from "svelte";
import { heroPairs, posterSrcset } from "$lib/hero/pairs";

interface Props {
	status?: number;
	message?: string;
}

const { status = 404, message = "no route to host" }: Props = $props();

// same forest as the hero, half-dissolved into characters
const pair = heroPairs[0];

let GlyphCanvas = $state<Component | null>(null);
let lostParams = $state<import("$lib/hero/glyph-params").GlyphParams | null>(
	null,
);

onMount(async () => {
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
	if (!document.createElement("canvas").getContext("webgl2")) return;
	try {
		const [canvasMod, paramsMod] = await Promise.all([
			import("$lib/hero/GlyphCanvas.svelte"),
			import("$lib/hero/glyph-params"),
		]);
		lostParams = paramsMod.lostGlyphParams;
		GlyphCanvas = canvasMod.default;
	} catch {
		// static image stays
	}
});
</script>

<section class="relative h-svh w-full overflow-hidden" aria-label="not found">
	<img
		src={pair.poster.large}
		srcset={posterSrcset(pair).srcset}
		sizes={posterSrcset(pair).sizes}
		alt=""
		class="absolute inset-0 h-full w-full object-cover"
	/>

	{#if GlyphCanvas && lostParams}
		<div class="absolute inset-0">
			<GlyphCanvas {pair} params={lostParams} />
		</div>
	{/if}

	<div class="pointer-events-none absolute inset-0 bg-gradient-to-b from-bg/70 via-bg/20 to-bg"></div>

	<div class="absolute inset-x-0 top-0 z-10">
		<div class="mx-auto max-w-4xl px-6 pt-10 font-mono">
			<p class="text-4xl text-bright">{status}</p>
			<p class="mt-2 text-sm text-fg">{message}</p>
			<p class="mt-6 text-sm">
				<a href="/" class="link-trace text-fg">cd /</a>
			</p>
		</div>
	</div>
</section>
