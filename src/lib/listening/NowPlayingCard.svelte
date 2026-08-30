<script lang="ts">
	import { listening } from "./store.svelte";
	import Visualizer from "./Visualizer.svelte";

	// richer widget for /now; same store, same ladder: live → last played → hidden
	$effect(() => {
		listening.start();
	});
</script>

{#if listening.current}
	{@const t = listening.current}
	<a
		href={t.url}
		target="_blank"
		rel="noopener noreferrer"
		class="group flex items-center gap-4 rounded-xs border border-line bg-surface/60 p-4"
	>
		{#if t.cover}
			<img
				src={t.cover}
				alt=""
				fetchpriority="high"
				width="56"
				height="56"
				class="size-14 shrink-0 rounded-xs object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
			/>
		{/if}
		<div class="min-w-0">
			<p
				class="flex items-center gap-2 font-mono text-xs {listening.live
					? 'text-ember'
					: 'text-muted'}"
			>
				{#if listening.live}
					<i>now playing</i>
					<Visualizer />
				{:else}
					last played
				{/if}
			</p>
			<p class="mt-1 truncate font-display text-base text-bright">{t.name}</p>
			<p class="truncate font-mono text-xs text-muted">
				{t.artist}{t.album ? ` ・ ${t.album}` : ""}
			</p>
		</div>
	</a>
{/if}
