<script lang="ts">
	import { toCdAlbums } from "$lib/cd-wall/albums";
	import CdWall from "$lib/cd-wall/CdWall.svelte";
	import type { Entry } from "$lib/content";
	import type { Music } from "$lib/content/schema";
	// Recently-played strip is parked for now — the section is the wall alone.
	// import RecentTracks from "$lib/listening/RecentTracks.svelte";

	interface Props {
		music: Entry<Music>[];
	}

	const { music }: Props = $props();

	// albums with cover art go on the CD wall; anything else (artists,
	// tracks, cover-less albums) keeps the plain grid below
	const albums = $derived(toCdAlbums(music));
	const rest = $derived.by(() => {
		const onWall = new Set(albums.map((album) => album.id));
		return music.filter((entry) => !onWall.has(entry.slug));
	});
</script>

<!-- curated taste, not a complete history; empty collection → no section -->
{#if music.length > 0}
	<section id="music" class="mx-auto max-w-4xl scroll-mt-8 px-6 py-24">
		<!-- no section header: the wall is meant to read as an object in the page,
		     not a labelled list — the immersion is the point -->

		{#if albums.length > 0}
			<!-- full-bleed breakout: the wall spans the viewport while the
			     section stays on the content column -->
			<div class="relative left-1/2 w-screen -translate-x-1/2">
				<CdWall {albums} />
			</div>
		{/if}

		{#if rest.length > 0}
			<ul class="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4">
				{#each rest as entry (entry.slug)}
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
		{/if}

		<!-- live strip parked for now — see the commented import above.
		<div class="mt-12">
			<RecentTracks limit={5} compact />
		</div>
		-->
	</section>
{/if}
