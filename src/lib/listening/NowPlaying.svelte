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
	let distPx = $state(0);
	let durSec = $state(0);

	const GAP = 48; // px between the two looping copies (matches .np-row gap)
	const SPEED = 42; // px/second — calm, readable

	// measure on every track change; scroll only when the title overflows
	$effect(() => {
		void listening.current?.name; // dependency: re-run when the track changes
		scroll = false; // reset so we measure the true single-copy width
		const clip = clipEl;
		const seg = segEl;
		if (!clip || !seg) return;
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		const raf = requestAnimationFrame(() => {
			const textW = seg.offsetWidth;
			const clipW = clip.clientWidth;
			if (textW > clipW + 2) {
				distPx = textW + GAP;
				durSec = distPx / SPEED;
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
		class="pointer-events-none fixed inset-x-0 bottom-0 z-30 sm:inset-x-auto sm:right-5 sm:bottom-3"
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
					style={scroll ? `--dist:${distPx}px; --dur:${durSec}s` : ""}
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
	/* Clip the title with a mask, NOT overflow:hidden — a mask is a paint effect
	   so the flex baseline stays the text baseline (overflow:hidden would snap it
	   to the bottom edge and misalign against the label). */
	.np-clip {
		-webkit-mask-image: linear-gradient(
			to right,
			#000 calc(100% - 1rem),
			transparent
		);
		mask-image: linear-gradient(to right, #000 calc(100% - 1rem), transparent);
		-webkit-mask-repeat: no-repeat;
		mask-repeat: no-repeat;
	}

	/* while scrolling, fade both edges so the loop enters and exits softly */
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
	}

	.np-row {
		display: inline-flex;
		gap: 3rem; /* must equal GAP (48px) in the script */
		white-space: nowrap;
	}

	.np-seg {
		white-space: nowrap;
	}

	/* seamless one-direction scroll: the second copy is exactly GAP behind, so
	   translating by (textWidth + GAP) lands it where the first copy started */
	.np-animate {
		animation: np-scroll var(--dur) linear infinite;
	}

	@keyframes np-scroll {
		from {
			transform: translateX(0);
		}
		to {
			transform: translateX(calc(-1 * var(--dist)));
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.np-animate {
			animation: none;
		}
	}
</style>
