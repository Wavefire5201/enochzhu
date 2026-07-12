<script lang="ts">
	// decorative equalizer — no real audio data exists (last.fm has none), so the
	// bars are random: random resting heights, random tempo and phase per bar.
	// reduced motion freezes them at their random heights. aria-hidden throughout.
	interface Props {
		/** freeze the bars at their resting heights — the "stopped" look */
		resting?: boolean;
	}
	const { resting = false }: Props = $props();

	const bars = Array.from({ length: 6 }, () => ({
		height: 3 + Math.random() * 11,
		// fast + jittery so it reads as lively; ~2.5x quicker than before
		duration: 0.32 + Math.random() * 0.34,
		// negative delay starts each bar mid-cycle so they never move in unison
		delay: -(Math.random() * 0.7),
	}));
</script>

<span class="flex h-3.5 shrink-0 items-end gap-[3px]" aria-hidden="true">
	{#each bars as bar, i (i)}
		<span
			class="viz-bar w-0.5 rounded-full bg-muted/80 {resting ? 'viz-rest' : ''}"
			style="height:{bar.height.toFixed(
				1,
			)}px; animation-duration:{bar.duration.toFixed(
				2,
			)}s; animation-delay:{bar.delay.toFixed(2)}s"
		></span>
	{/each}
</span>

<style>
	.viz-bar {
		transform-origin: bottom;
		animation-name: viz;
		animation-timing-function: ease-in-out;
		animation-iteration-count: infinite;
		animation-direction: alternate;
	}

	/* stopped state: hold the resting heights, no motion, slightly dimmed */
	.viz-rest {
		animation: none;
		opacity: 0.55;
	}

	@keyframes viz {
		from {
			transform: scaleY(0.12);
		}
		to {
			transform: scaleY(1);
		}
	}
</style>
