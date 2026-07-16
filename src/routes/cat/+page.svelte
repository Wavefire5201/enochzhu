<script lang="ts">
	import FogNotFound from "$lib/components/FogNotFound.svelte";
	import { cats } from "$lib/content";
</script>

<svelte:head>
	<title>{cats.length > 0 ? "cat" : "404"}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

{#if cats.length > 0}
	<main class="mx-auto max-w-4xl px-6 py-24">
		<h1 class="font-mono text-sm text-muted">cat</h1>
		<div class="mt-8 columns-2 gap-3 sm:columns-3">
			{#each cats as cat (cat.slug)}
				<figure class="mb-3 break-inside-avoid">
					<img
						src={cat.meta.src}
						alt={cat.meta.alt}
						loading="lazy"
						class="w-full rounded-xs"
					/>
					{#if cat.meta.name}
						<figcaption class="mt-1 font-mono text-xs text-muted">
							{cat.meta.name}
						</figcaption>
					{/if}
				</figure>
			{/each}
		</div>
	</main>
{:else}
	<FogNotFound />
{/if}
