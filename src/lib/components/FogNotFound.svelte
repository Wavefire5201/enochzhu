<script lang="ts">
	import type { Component } from "svelte";
	import { onMount } from "svelte";
	import type { HeroPair } from "$lib/hero/pairs";
	import { heroPairById, heroPairs, posterSrcset } from "$lib/hero/pairs";

	interface Props {
		status?: number;
		message?: string;
	}

	const { status = 404, message = "no route to host" }: Props = $props();

	// same backdrop as the hero — same rotation, same glyph params, same scrim.
	// only the words differ (per Enoch: one treatment, not two).
	let pair = $state<HeroPair | null>(null);
	let GlyphCanvas = $state<Component<{ pair: HeroPair }> | null>(null);

	onMount(async () => {
		pair =
			heroPairById(document.documentElement.dataset.heroPair) ?? heroPairs[0];
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		if (!document.createElement("canvas").getContext("webgl2")) return;
		try {
			GlyphCanvas = (await import("$lib/hero/GlyphCanvas.svelte")).default;
		} catch {
			// static image stays
		}
	});
</script>

<section
	class="relative h-svh w-full overflow-hidden bg-bg"
	aria-label="not found"
>
	{#if pair}
		<img
			src={pair.poster.large}
			srcset={posterSrcset(pair).srcset}
			sizes={posterSrcset(pair).sizes}
			alt=""
			class="absolute inset-0 h-full w-full object-cover"
		/>
	{/if}

	<noscript>
		<img
			src={heroPairs[0].poster.large}
			srcset={posterSrcset(heroPairs[0]).srcset}
			sizes={posterSrcset(heroPairs[0]).sizes}
			alt=""
			class="absolute inset-0 h-full w-full object-cover"
		/>
	</noscript>

	{#if GlyphCanvas && pair}
		<div class="absolute inset-0">
			<GlyphCanvas {pair} />
		</div>
	{/if}

	<!-- legibility scrim, identical to the hero's -->
	<div
		class="pointer-events-none absolute inset-0 bg-gradient-to-b from-bg/60 via-transparent to-bg"
	></div>

	<div class="absolute inset-x-0 top-0 z-10">
		<div class="mx-auto max-w-4xl px-6 pt-10">
			<h1
				class="font-display text-5xl font-medium tracking-tight text-bright sm:text-6xl"
			>
				{status}
			</h1>
			<p class="mt-2 font-mono text-sm text-fg">{message}</p>
			<p class="mt-6 font-mono text-sm">
				<a href="/" class="link-trace text-fg">cd /</a>
			</p>
		</div>
	</div>
</section>
