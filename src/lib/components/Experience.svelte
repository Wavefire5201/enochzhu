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
					class="relative grid gap-2 py-5 sm:grid-cols-[1fr_auto] sm:items-baseline sm:gap-8"
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
									class="exp-note ml-2 hidden align-middle font-mono text-xs text-ember italic sm:inline-block"
									><span aria-hidden="true" class="mr-3"
										>←
									</span>{item.comment}</span
								>{/if}
						</h3>
						<p class="mt-2.5 font-mono text-xs text-fg">{item.role}</p>
						{#if item.location}
							<p class="mt-1 font-mono text-xs text-muted">{item.location}</p>
						{/if}
					</div>
					<time class="font-mono text-xs text-muted">{item.period}</time>

					{#if item.comment}
						<!-- mobile: the note floats over the entry's empty right side; one
						     continuous loop-the-loop stroke curls up-left toward the org
						     (desktop shows the inline note above) -->
						<div
							class="exp-note pointer-events-none absolute right-1 bottom-2 flex flex-col items-end text-ember sm:hidden"
						>
							<svg
								viewBox="0 0 120 100"
								class="mr-4 mb-2 h-14 w-17"
								fill="none"
								stroke="currentColor"
								stroke-width="2.5"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
								transform="matrix(0 1 1 0 0 0)"
							>
								<path
									d="M106 86 C 90 92, 74 90, 64 80 C 52 68, 58 50, 72 52 C 84 54, 82 70, 66 72 C 46 74, 28 58, 22 34"
								/>
								<path d="M22 34 l 10 8 M22 34 l -5 12" />
							</svg>
							<span class="font-mono text-xs italic">{item.comment}</span>
						</div>
					{/if}
				</li>
			{/each}
		</ol>
	</section>
{/if}

<style>
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
