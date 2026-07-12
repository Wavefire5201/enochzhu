<script lang="ts">
	import type { About } from "$lib/content/schema";

	interface Props {
		about: About;
	}

	const { about }: Props = $props();
</script>

{#if about.experience.length > 0}
	<section class="mx-auto max-w-4xl px-6 py-24">
		<h2 id="experience" class="scroll-mt-8 font-mono text-sm text-muted">
			experience
		</h2>

		<ol class="mt-8 divide-y divide-line border-y border-line">
			{#each about.experience as item (`${item.organization}-${item.period}`)}
				<li
					class="grid gap-2 py-5 sm:grid-cols-[1fr_auto] sm:items-baseline sm:gap-8"
				>
					<div>
						<h3 class="font-display text-lg text-bright">
							{#if item.link}
								<a
									href={item.link}
									target="_blank"
									rel="noopener noreferrer"
									class="link-trace project-link"
								>
									{item.organization}
								</a>
							{:else}
								{item.organization}
							{/if}{#if item.comment}<span
									class="exp-note ml-2 inline-block align-middle font-mono text-xs text-ember italic"
									>{item.comment}</span
								>{/if}
						</h3>
						<p class="mt-2.5 font-mono text-xs text-fg">{item.role}</p>
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

<style>
	/* the "i made this website" note gently drifts — a slow, floating loop */
	.exp-note {
		animation: exp-drift 5s ease-in-out infinite;
	}

	@keyframes exp-drift {
		0%,
		100% {
			transform: translate(0, 0);
		}
		25% {
			transform: translate(2px, -3px);
		}
		50% {
			transform: translate(3px, 0);
		}
		75% {
			transform: translate(1px, 3px);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.exp-note {
			animation: none;
		}
	}
</style>
