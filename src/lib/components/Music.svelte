<script lang="ts">
	import type { Entry } from "$lib/content";
	import type { Music } from "$lib/content/schema";
	import RecentTracks from "$lib/listening/RecentTracks.svelte";

	interface Props {
		music: Entry<Music>[];
	}

	const { music }: Props = $props();
</script>

<!-- curated taste, not a complete history; empty collection → no section -->
{#if music.length > 0}
	<section class="mx-auto max-w-4xl px-6 py-24">
		<h2 id="music" class="scroll-mt-8 font-mono text-sm text-muted">music</h2>

		<ul class="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4">
			{#each music as entry (entry.slug)}
				<li>
					{#if entry.meta.cover}
						{#if entry.meta.link}
							<a
								href={entry.meta.link}
								target="_blank"
								rel="noopener noreferrer"
							>
								<img
									src={entry.meta.cover}
									alt="{entry.meta.title}{entry.meta.artist
										? ` — ${entry.meta.artist}`
										: ''}"
									loading="lazy"
									class="aspect-square w-full rounded-xs object-cover"
								/>
							</a>
						{:else}
							<img
								src={entry.meta.cover}
								alt="{entry.meta.title}{entry.meta.artist
									? ` — ${entry.meta.artist}`
									: ''}"
								loading="lazy"
								class="aspect-square w-full rounded-xs object-cover"
							/>
						{/if}
					{/if}
					<h3 class="mt-2 font-display text-sm text-bright">
						{#if entry.meta.link}
							<a
								href={entry.meta.link}
								class="link-trace"
								target="_blank"
								rel="noopener noreferrer"
							>
								{entry.meta.title}
							</a>
						{:else}
							{entry.meta.title}
						{/if}
					</h3>
					<p class="font-mono text-xs text-muted">
						{[entry.meta.artist, entry.meta.year].filter(Boolean).join(" · ")}
					</p>
					{#if entry.meta.note}
						<p class="mt-1 text-xs leading-relaxed text-fg">
							{entry.meta.note}
						</p>
					{/if}
				</li>
			{/each}
		</ul>

		<!-- live strip: progressive enhancement, absent without JS or feed -->
		<div class="mt-12">
			<RecentTracks limit={5} compact />
		</div>
	</section>
{/if}
