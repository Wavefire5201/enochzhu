<script lang="ts">
	import Seo from "$lib/components/Seo.svelte";

	const { data } = $props();
	const post = $derived(data.post);

	let articleEl = $state<HTMLElement>();
	let wordCount = $state<number | null>(null);

	$effect(() => {
		const el = articleEl;
		if (!el) return;
		const text = el.innerText ?? el.textContent ?? "";
		wordCount = text.split(/\s+/).filter((word) => word.length > 0).length;
	});
</script>

<Seo
	title="{post.meta.series}: {post.meta.title}"
	description={post.meta.description ?? post.meta.title}
/>

<svelte:head>
	<!-- og:type is set site-wide in +layout.svelte; just date the article here -->
	<meta property="article:published_time" content={post.meta.date} />
</svelte:head>

<main class="mx-auto max-w-prose px-6 py-24 print:py-8">
	<header class="flex items-center gap-4">
		{#if post.meta.headshot}
			<img
				src={post.meta.headshot}
				alt="enoch zhu"
				width="64"
				height="64"
				class="h-14 w-14 shrink-0 rounded-sm object-cover grayscale sm:h-16 sm:w-16 print:grayscale-0"
			/>
		{/if}
		<div>
			<h1 class="font-mono text-xs text-muted">{post.meta.series}</h1>
			<h2 class="mt-1 font-display text-2xl text-bright">{post.meta.title}</h2>
			<p class="mt-2 font-mono text-xs text-muted">
				<time datetime={post.meta.date}>{post.meta.date}</time>
			</p>
		</div>
	</header>

	<article
		bind:this={articleEl}
		class="post-prose mt-10 text-base leading-relaxed text-fg"
	>
		{#if post.body}
			<post.body />
		{/if}
	</article>

	<p class="mt-16 flex items-baseline gap-2 font-mono text-xs text-muted">
		<a href="/notes" class="link-trace print:hidden">cd ..</a>
		{#if wordCount !== null}
			<span class="print:hidden">·</span>
			<span>{wordCount} words</span>
		{/if}
	</p>
</main>

<style>
	.post-prose :global(p) {
		margin-top: 1rem;
	}

	.post-prose :global(h2),
	.post-prose :global(h3) {
		margin-top: 2.5rem;
		font-family: var(--font-mono);
		font-size: 0.875rem;
		color: var(--color-muted);
	}

	.post-prose :global(ul),
	.post-prose :global(ol) {
		margin-top: 1rem;
		padding-left: 1.25rem;
		list-style: disc;
	}

	.post-prose :global(ol) {
		list-style: decimal;
	}

	.post-prose :global(blockquote) {
		margin-top: 1rem;
		padding-left: 1rem;
		border-left: 1px solid var(--color-line);
		color: var(--color-muted);
	}

	.post-prose :global(code) {
		font-family: var(--font-mono);
		font-size: 0.875em;
		color: var(--color-bright);
	}

	.post-prose :global(pre) {
		margin-top: 1rem;
		overflow-x: auto;
		border: 1px solid var(--color-line);
		padding: 0.75rem 1rem;
	}

	.post-prose :global(a) {
		color: var(--color-bright);
		text-decoration: underline;
		text-decoration-color: var(--color-line);
		text-underline-offset: 0.2em;
	}

	.post-prose :global(a:hover) {
		color: var(--color-ember);
	}

	@media print {
		main {
			color: #000;
		}
		.post-prose :global(a) {
			color: #000;
		}
	}
</style>
