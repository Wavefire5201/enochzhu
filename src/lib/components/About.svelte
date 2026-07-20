<script lang="ts">
	import type { About } from "$lib/content/schema";

	interface Props {
		about: About;
	}

	const { about }: Props = $props();
</script>

<section class="mx-auto max-w-4xl px-6 py-24">
	<h2 id="about" class="scroll-mt-8 font-mono text-sm text-muted">about</h2>

	<div
		class="mt-8 grid gap-y-10 border-t border-line pt-8 sm:grid-cols-[13rem_1fr] sm:gap-x-20"
	>
		<div>
			<p class="font-display text-3xl leading-tight text-bright">
				{about.title}
			</p>
			{#if about.location}
				<p class="mt-2 font-mono text-xs text-muted">{about.location}</p>
			{/if}
			{#if about.bio}
				<p
					class="mt-6 font-mono text-xs leading-relaxed text-muted whitespace-pre-line"
				>
					{about.bio}
				</p>
			{/if}
		</div>

		<!-- generic rows: order, labels, and count all come from about.md -->
		<dl
			class="grid gap-y-6 font-mono text-sm leading-relaxed sm:grid-cols-[6rem_1fr] sm:gap-x-6"
		>
			{#each about.sections as section (section.label)}
				<dt class="text-muted">{section.label}</dt>
				<dd class="text-fg {section.text ? 'whitespace-pre-line' : ''}">
					{section.items ? section.items.join(", ") : section.text}
				</dd>
			{/each}
		</dl>
	</div>
</section>
