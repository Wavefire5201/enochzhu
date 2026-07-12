<script lang="ts">
	import { onMount } from "svelte";
	import { defaultGlyphParams, type GlyphParams } from "./glyph-params";
	import {
		createGlyphRenderer,
		type GlyphRenderer,
		type TiltStatus,
	} from "./glyph-renderer";
	import { type HeroPair, heroPairs } from "./pairs";

	interface Props {
		pair?: HeroPair;
		params?: GlyphParams;
		charset?: string;
		onready?: () => void;
		ontiltstatus?: (status: TiltStatus) => void;
	}

	const {
		pair = heroPairs[Math.floor(Math.random() * heroPairs.length)],
		params = defaultGlyphParams,
		charset,
		onready,
		ontiltstatus,
	}: Props = $props();

	let canvasEl = $state<HTMLCanvasElement>();
	let ready = $state(false);
	let dead = $state(false);
	let renderer: GlyphRenderer | undefined;

	$effect(() => {
		renderer?.setParams(params);
	});

	onMount(() => {
		let cancelled = false;
		(async () => {
			if (!canvasEl) return;
			try {
				const created = await createGlyphRenderer(canvasEl, {
					pair,
					params,
					charset,
					onready: () => {
						ready = true;
						onready?.();
					},
					onTiltStatus: ontiltstatus,
					onContextLost: () => {
						dead = true;
					},
				});
				if (cancelled) {
					created.destroy();
					return;
				}
				renderer = created;
			} catch {
				dead = true; // static poster underneath stays visible
			}
		})();
		return () => {
			cancelled = true;
			renderer?.destroy();
		};
	});
</script>

{#if !dead}
	<canvas
		bind:this={canvasEl}
		class="h-full w-full transition-opacity duration-1000 ease-out"
		class:opacity-0={!ready}
		class:opacity-100={ready}
		aria-hidden="true"
	></canvas>
{/if}
