<script lang="ts">
	import { listening } from "./store.svelte";

	interface Props {
		limit?: number;
		/** single-line rows, no covers — the strip variant on / */
		compact?: boolean;
	}

	const { limit = 10, compact = false }: Props = $props();

	$effect(() => {
		listening.start();
	});

	const tracks = $derived(listening.recent.slice(0, limit));

	function ago(uts: number | null): string {
		if (uts === null) return "";
		const s = Math.max(0, Math.floor(Date.now() / 1000) - uts);
		if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m`;
		if (s < 86400) return `${Math.floor(s / 3600)}h`;
		return `${Math.floor(s / 86400)}d`;
	}
</script>

{#if tracks.length > 0}
	<div>
		<h3 class="font-mono text-xs text-muted">recently played</h3>
		<ul
			class="mt-3 {compact ? '' : 'divide-y divide-line border-y border-line'}"
		>
			{#each tracks as t, i (i)}
				<li class="flex items-center gap-3 {compact ? 'py-1' : 'py-2.5'}">
					{#if !compact && t.cover}
						<img
							src={t.cover}
							alt=""
							loading="lazy"
							width="32"
							height="32"
							class="size-8 shrink-0 rounded-xs object-cover"
						/>
					{/if}
					<a
						href={t.url}
						target="_blank"
						rel="noopener noreferrer"
						class="link-trace min-w-0 truncate font-mono text-xs text-fg"
					>
						{t.name} — {t.artist}
					</a>
					<span class="ml-auto shrink-0 font-mono text-xs text-muted"
						>{ago(t.playedAt)}</span
					>
				</li>
			{/each}
		</ul>
	</div>
{/if}
