<script lang="ts">
import { browser } from "$app/environment";
import { page } from "$app/state";
import GlyphCanvas from "$lib/hero/GlyphCanvas.svelte";
import { DEFAULT_CHARSET } from "$lib/hero/glyph-atlas";
import { defaultGlyphParams, type GlyphParams } from "$lib/hero/glyph-params";
import { heroPairs } from "$lib/hero/pairs";

// searchParams are unreadable during prerender; poster capture passes them
// at runtime only
let params = $state<GlyphParams>({ ...defaultGlyphParams });
let pairId = $state(
	(browser ? page.url.searchParams.get("pair") : null) ?? heroPairs[0].id,
);
let charset = $state(DEFAULT_CHARSET);
let forceFallback = $state(false);

const hideUi = browser && page.url.searchParams.get("hideui") === "1";
const pair = $derived(heroPairs.find((p) => p.id === pairId) ?? heroPairs[0]);

// Fallback decisions (PRD §6): reduced motion or no WebGL2 → static image.
let reducedMotion = $state(false);
let webglOk = $state(true);

$effect(() => {
	const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
	reducedMotion = mq.matches;
	const update = (e: MediaQueryListEvent) => {
		reducedMotion = e.matches;
	};
	mq.addEventListener("change", update);

	webglOk = document.createElement("canvas").getContext("webgl2") !== null;

	return () => mq.removeEventListener("change", update);
});

const useFallback = $derived(reducedMotion || !webglOk || forceFallback);

interface Slider {
	key: keyof GlyphParams;
	label: string;
	min: number;
	max: number;
	step: number;
}

const sliders: Slider[] = [
	{ key: "cellSize", label: "cell size", min: 4, max: 32, step: 1 },
	{ key: "ditherBlend", label: "dither blend", min: 0, max: 1, step: 0.01 },
	{ key: "contrast", label: "contrast", min: 0.5, max: 2, step: 0.05 },
	{ key: "gamma", label: "gamma", min: 0.4, max: 2, step: 0.05 },
	{ key: "flowScale", label: "flow scale", min: 0.5, max: 10, step: 0.1 },
	{ key: "flowSpeed", label: "flow speed", min: 0, max: 0.3, step: 0.005 },
	{ key: "parallax", label: "parallax", min: 0, max: 0.08, step: 0.002 },
	{ key: "cursorRadius", label: "cursor radius", min: 40, max: 400, step: 10 },
	{
		key: "cursorStrength",
		label: "cursor strength",
		min: 0,
		max: 1,
		step: 0.05,
	},
	{ key: "baseTint", label: "photo base", min: 0, max: 1, step: 0.02 },
	{ key: "cursorReveal", label: "cursor reveal", min: 0, max: 1, step: 0.05 },
	{ key: "damp", label: "damp", min: 0.5, max: 6, step: 0.1 },
	{ key: "sparkAmount", label: "spark (ships 0)", min: 0, max: 1, step: 0.05 },
];

function copyParams() {
	navigator.clipboard.writeText(
		JSON.stringify({ pair: pairId, charset, ...params }, null, 2),
	);
}
</script>

<svelte:head>
	<title>proto/hero</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="fixed inset-0 bg-bg">
	{#if useFallback}
		<img src={pair.poster.large} alt="" class="h-full w-full object-cover" />
	{:else}
		{#key `${pairId}/${charset}`}
			<GlyphCanvas {pair} {params} {charset} />
		{/key}
	{/if}
</div>

{#if !hideUi}
	<aside
		class="fixed top-4 right-4 z-10 w-64 rounded border border-white/10 bg-black/70 p-4 font-mono text-xs text-neutral-300 backdrop-blur select-none"
	>
		<div class="mb-3 flex items-center justify-between">
			<span class="text-neutral-500">proto/hero</span>
			<button
				class="cursor-pointer rounded border border-white/10 px-2 py-0.5 hover:bg-white/10"
				onclick={copyParams}>copy</button
			>
		</div>

		<label class="mb-2 block">
			<span class="mb-1 block text-neutral-500">pair</span>
			<select bind:value={pairId} class="w-full rounded border border-white/10 bg-black/60 p-1">
				{#each heroPairs as p (p.id)}
					<option value={p.id}>{p.label}</option>
				{/each}
			</select>
		</label>

		<label class="mb-2 block">
			<span class="mb-1 block text-neutral-500">charset</span>
			<input
				type="text"
				bind:value={charset}
				class="w-full rounded border border-white/10 bg-black/60 p-1 font-mono"
				spellcheck="false"
			/>
		</label>

		{#each sliders as s (s.key)}
			<label class="mb-2 block">
				<span class="mb-1 flex justify-between text-neutral-500">
					<span>{s.label}</span>
					<span class="text-neutral-300">{params[s.key]}</span>
				</span>
				<input
					type="range"
					min={s.min}
					max={s.max}
					step={s.step}
					bind:value={params[s.key]}
					class="w-full"
				/>
			</label>
		{/each}

		<div class="mt-2 mb-2 grid grid-cols-2 gap-2">
			<label class="block">
				<span class="mb-1 block text-neutral-500">paper</span>
				<input type="color" bind:value={params.paper} class="h-7 w-full" />
			</label>
			<label class="block">
				<span class="mb-1 block text-neutral-500">ink</span>
				<input type="color" bind:value={params.ink} class="h-7 w-full" />
			</label>
		</div>

		<label class="mt-3 flex items-center gap-2">
			<input type="checkbox" bind:checked={forceFallback} />
			<span>force static fallback</span>
		</label>

		{#if reducedMotion}
			<p class="mt-2 text-amber-400/80">prefers-reduced-motion active</p>
		{/if}
		{#if !webglOk}
			<p class="mt-2 text-amber-400/80">no webgl2 — static fallback</p>
		{/if}
	</aside>
{/if}
