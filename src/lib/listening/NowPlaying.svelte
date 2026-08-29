<script lang="ts">
	import { listening } from "./store.svelte";
	import Visualizer from "./Visualizer.svelte";

	// ambient sitewide now-playing; absent without JS, absent until the feed
	// answers. live → visualizer + "now listening to"; stopped → resting
	// visualizer + "last listened to"; down → nothing. a title too long for the
	// chip scrolls continuously (seamless marquee); short titles sit still.
	$effect(() => {
		listening.start();
	});

	let clipEl = $state<HTMLElement>();
	let segEl = $state<HTMLElement>();
	let scroll = $state(false);
	let durSec = $state(0);

	const GAP = 48; // px trailing gap per copy (matches .np-seg margin-right)
	const SPEED = 42; // px/second — calm, readable

	// A stable title string. `listening.current` is a fresh object on every poll,
	// so depending on it would restart the marquee each refresh; the title text
	// only changes when the track actually changes.
	const title = $derived(
		listening.current
			? `${listening.current.name} — ${listening.current.artist}`
			: "",
	);
	let measuredFor = "";

	// re-measure only when the title text changes; the loop distance is a hard
	// -50% (see CSS), so this measurement sets the speed, never the wrap point.
	$effect(() => {
		const key = title;
		const clip = clipEl;
		const seg = segEl;
		if (!clip || !seg || key === measuredFor) return;
		measuredFor = key;
		scroll = false; // reset to a single copy so we measure the true width
		if (!key || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			return;
		}
		const raf = requestAnimationFrame(() => {
			const textW = seg.getBoundingClientRect().width;
			const clipW = clip.clientWidth;
			if (textW > clipW + 2) {
				durSec = (textW + GAP) / SPEED;
				scroll = true;
			}
		});
		return () => cancelAnimationFrame(raf);
	});
</script>

{#if listening.current}
	{@const t = listening.current}
	<!-- mobile: full-bleed bar on the very bottom edge; sm+: floating bottom-right -->
	<div
		class="pointer-events-none fixed inset-x-0 bottom-0 z-30 print:hidden sm:inset-x-auto sm:right-5 sm:bottom-3"
	>
		<a
			href={t.url}
			target="_blank"
			rel="noopener noreferrer"
			aria-label="{listening.live
				? 'now playing'
				: 'last played'}: {t.name} — {t.artist}"
			class="pointer-events-auto flex items-baseline gap-3 border-t border-line bg-bg/85 px-4 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:max-w-md sm:border-t-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none"
		>
			{#if listening.live}
				<span class="flex shrink-0 self-center" aria-hidden="true"
					><Visualizer /></span
				>
				<i class="shrink-0 font-display text-sm text-ember">now listening to</i>
			{:else}
				<span class="flex shrink-0 self-center" aria-hidden="true"
					><Visualizer resting /></span
				>
				<i class="shrink-0 font-display text-sm text-muted">last listened to</i>
			{/if}

			<span
				bind:this={clipEl}
				class="np-clip min-w-0"
				class:np-scrolling={scroll}
			>
				<span
					class="np-row"
					class:np-animate={scroll}
					style={scroll ? `--dur:${durSec}s` : ""}
				>
					<span
						bind:this={segEl}
						class="np-seg font-mono text-xs {listening.live
							? 'text-fg'
							: 'text-muted'}">{t.name} — {t.artist}</span
					>
					{#if scroll}
						<span
							class="np-seg font-mono text-xs {listening.live
								? 'text-fg'
								: 'text-muted'}"
							aria-hidden="true">{t.name} — {t.artist}</span
						>
					{/if}
				</span>
			</span>
		</a>
	</div>
{/if}

<style>
	/* A title that fits shows in full — no clipped edge. The fade appears ONLY
	   while scrolling (marquee), softening both ends of the loop. Masking (a paint
	   effect, not overflow:hidden) keeps the flex baseline aligned with the label. */
	.np-scrolling {
		-webkit-mask-image: linear-gradient(
			to right,
			transparent,
			#000 1rem,
			#000 calc(100% - 1rem),
			transparent
		);
		mask-image: linear-gradient(
			to right,
			transparent,
			#000 1rem,
			#000 calc(100% - 1rem),
			transparent
		);
		-webkit-mask-repeat: no-repeat;
		mask-repeat: no-repeat;
	}

	.np-row {
		display: inline-flex;
		white-space: nowrap;
	}

	.np-seg {
		white-space: nowrap;
	}

	/* Each copy carries its own trailing gap, so the row is exactly two identical
	   units wide. Translating by -50% advances exactly one unit — the loop point
	   is defined by layout, not a measured pixel width, so it is perfectly
	   seamless every cycle. */
	.np-animate .np-seg {
		margin-right: 3rem;
	}

	.np-animate {
		animation: np-scroll var(--dur) linear infinite;
	}

	@keyframes np-scroll {
		to {
			transform: translateX(-50%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.np-animate {
			animation: none;
		}
	}
</style>
