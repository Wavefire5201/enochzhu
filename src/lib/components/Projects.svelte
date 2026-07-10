<script lang="ts">
import type { Entry } from "$lib/content";
import type { Project } from "$lib/content/schema";

interface Props {
	projects: Entry<Project>[];
}

const { projects }: Props = $props();
</script>

{#if projects.length > 0}
	<section class="mx-auto max-w-4xl px-6 py-24">
		<h2 id="projects" class="scroll-mt-8 font-mono text-sm text-muted">projects</h2>

		<ul class="mt-8 divide-y divide-line border-y border-line">
			{#each projects as project (project.slug)}
				{@const href = project.meta.live ?? project.meta.github}
				<li>
					<div class="group grid gap-1 py-5 sm:grid-cols-[10rem_1fr_auto] sm:gap-6">
						<h3 class="font-display text-base text-bright">
							{#if href}
								<a
									{href}
									class="link-trace project-link"
									target="_blank"
									rel="noopener noreferrer"
								>
									{project.meta.title}
								</a>
							{:else}
								{project.meta.title}
							{/if}
						</h3>
						<div>
							<p class="text-sm leading-relaxed text-fg">{project.meta.description}</p>
							{#if project.meta.stack.length > 0}
								<p class="mt-1.5 font-mono text-xs text-muted">
									{project.meta.stack.join(' · ')}
								</p>
							{/if}
						</div>
						{#if project.meta.year}
							<span class="font-mono text-xs text-muted sm:pt-1">{project.meta.year}</span>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	</section>
{/if}
