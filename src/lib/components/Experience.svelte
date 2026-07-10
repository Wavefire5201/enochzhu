<script lang="ts">
import type { About } from "$lib/content/schema";

interface Props {
	about: About;
}

const { about }: Props = $props();
</script>

{#if about.experience.length > 0}
	<section class="mx-auto max-w-4xl px-6 py-24">
		<h2 id="experience" class="scroll-mt-8 font-mono text-sm text-muted">experience</h2>

		<ol class="mt-8 divide-y divide-line border-y border-line">
			{#each about.experience as item (`${item.organization}-${item.period}`)}
				<li class="grid gap-2 py-5 sm:grid-cols-[1fr_auto] sm:items-baseline sm:gap-8">
					<div>
						<h3 class="font-display text-lg text-bright">{item.organization}</h3>
						<p class="mt-1 font-mono text-xs text-fg">{item.role}</p>
						{#if item.location}
							<p class="mt-1 font-mono text-xs text-muted">{item.location}</p>
						{/if}
					</div>
					<time class="font-mono text-xs text-muted">{item.period}</time>
				</li>
			{/each}
		</ol>
	</section>
{/if}
