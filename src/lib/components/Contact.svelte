<script lang="ts">
	import type { About } from "$lib/content/schema";

	interface Props {
		about: About;
	}

	const { about }: Props = $props();

	const links = $derived(Object.entries(about.links));
</script>

<footer class="mx-auto max-w-4xl px-6 pt-24 pb-16">
	<h2 id="contact" class="scroll-mt-8 font-mono text-sm text-muted">contact</h2>

	{#if links.length > 0}
		<ul class="mt-8 flex flex-wrap gap-x-6 gap-y-2 font-mono text-sm">
			{#each links as [label, href] (label)}
				<li>
					<a
						class="link-trace text-fg"
						{href}
						target="_blank"
						rel="me noopener noreferrer"
					>
						{label}
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</footer>
