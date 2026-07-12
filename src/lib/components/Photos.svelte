<script lang="ts">
	import type { Entry } from "$lib/content";
	import type { Photo } from "$lib/content/schema";

	interface Props {
		photos: Entry<Photo>[];
	}

	const { photos }: Props = $props();
</script>

{#if photos.length > 0}
	<section class="mx-auto max-w-4xl px-6 py-24">
		<h2 id="photos" class="scroll-mt-8 font-mono text-sm text-muted">photos</h2>

		<div class="mt-8 columns-2 gap-3 sm:columns-3">
			{#each photos as photo (photo.slug)}
				<figure class="mb-3 break-inside-avoid">
					<img
						src={photo.meta.src}
						alt={photo.meta.alt}
						loading="lazy"
						decoding="async"
						class="w-full rounded-xs"
					/>
					{#if photo.meta.location || photo.meta.date}
						<figcaption class="mt-1 font-mono text-xs text-muted">
							{[photo.meta.location, photo.meta.date]
								.filter(Boolean)
								.join(" — ")}
						</figcaption>
					{/if}
				</figure>
			{/each}
		</div>
	</section>
{/if}
