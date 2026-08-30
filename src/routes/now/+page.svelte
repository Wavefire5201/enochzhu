<script lang="ts">
	import FogNotFound from "$lib/components/FogNotFound.svelte";
	import Seo from "$lib/components/Seo.svelte";
	import { now } from "$lib/content";
	import NowPlayingCard from "$lib/listening/NowPlayingCard.svelte";
	import RecentTracks from "$lib/listening/RecentTracks.svelte";
</script>

{#if now}
	<Seo title="now — enoch zhu" description="what enoch is doing now" />
{/if}

<svelte:head>
	{#if !now}
		<title>404</title>
		<meta name="robots" content="noindex" />
	{/if}
</svelte:head>

{#if now}
	<main class="mx-auto max-w-4xl px-6 py-24">
		<header>
			<h1 class="font-mono text-sm text-muted">now</h1>
			<p class="mt-2 font-mono text-xs text-muted">
				updated {now.meta.updated} ・
				<a
					class="italic link-trace"
					href="https://nownownow.com/about"
					target="_blank">what is a now page?</a
				>
			</p>
		</header>

		<!-- the prose renders fully without JS; the widgets below are enhancement -->
		<div class="now-prose mt-10 max-w-prose text-base leading-relaxed text-fg">
			{#if now.body}
				<now.body />
			{/if}
		</div>

		<section
			class="mt-16 flex max-w-prose flex-col gap-8"
			aria-label="listening"
		>
			<NowPlayingCard />
			<RecentTracks limit={10} />
		</section>

		<p class="mt-16">
			<a href="/" class="link-trace font-mono text-xs text-muted">cd /</a>
		</p>
	</main>
{:else}
	<!-- empty collection: indistinguishable from a route that doesn't exist -->
	<FogNotFound />
{/if}

<style>
	.now-prose :global(p) {
		margin-top: 1rem;
	}

	.now-prose :global(h2) {
		margin-top: 2.5rem;
		font-family: var(--font-mono);
		font-size: 0.875rem;
		color: var(--color-muted);
	}

	.now-prose :global(ul) {
		margin-top: 1rem;
		padding-left: 1.25rem;
		list-style: disc;
	}

	.now-prose :global(a) {
		color: var(--color-bright);
		text-decoration: underline;
		text-decoration-color: var(--color-line);
		text-underline-offset: 0.2em;
	}

	.now-prose :global(a:hover) {
		color: var(--color-ember);
	}
</style>
