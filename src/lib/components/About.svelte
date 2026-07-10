<script lang="ts">
import type { About } from "$lib/content/schema";

interface Props {
	about: About;
}

const { about }: Props = $props();

const rows = $derived(
	[
		{ key: "education", values: about.edu ? [about.edu] : [] },
		{
			key: "tools",
			values: about.stack.length > 0 ? [about.stack.join(" · ")] : [],
		},
		{
			key: "interests",
			values: about.interests.length > 0 ? [about.interests.join(" · ")] : [],
		},
	].filter((row) => row.values.length > 0),
);
</script>

<section class="mx-auto max-w-4xl px-6 py-24">
	<h2 id="about" class="scroll-mt-8 font-mono text-sm text-muted">about</h2>

	<div class="mt-8 grid gap-10 border-t border-line pt-8 sm:grid-cols-[13rem_1fr] sm:gap-12">
		<div>
			<p class="font-display text-3xl leading-tight text-bright">{about.title}</p>
			{#if about.location}
				<p class="mt-2 font-mono text-xs text-muted">{about.location}</p>
			{/if}
		</div>

		<dl class="grid gap-y-6 font-mono text-sm leading-relaxed sm:grid-cols-[6rem_1fr] sm:gap-x-6">
			{#each rows as row (row.key)}
				<dt class="text-muted">{row.key}</dt>
				<dd>
					{#each row.values as value (value)}
						<p class="text-fg">{value}</p>
					{/each}
				</dd>
			{/each}
		</dl>
	</div>
</section>
