<script lang="ts">
	import FogNotFound from "$lib/components/FogNotFound.svelte";
	import Seo from "$lib/components/Seo.svelte";
	import { posts } from "$lib/content/posts";
</script>

{#if posts.length > 0}
	<Seo title="notes — enoch zhu" description="writing by enoch zhu" />
{/if}

<svelte:head>
	{#if posts.length === 0}
		<title>404</title>
		<meta name="robots" content="noindex" />
	{/if}
</svelte:head>

{#if posts.length > 0}
	<main class="mx-auto max-w-4xl px-6 py-24">
		<header>
			<h1 class="font-mono text-sm text-muted">notes</h1>
		</header>

		<ul class="mt-10 flex max-w-prose flex-col gap-8">
			{#each posts as post (post.slug)}
				<li>
					<a
						class="link-trace font-display text-xl leading-none text-bright"
						href="/notes/{post.slug}">{post.meta.title}</a
					>
					<p class="mt-2.5 font-mono text-xs text-muted">
						<time datetime={post.meta.date}>{post.meta.date}</time>
						・ {post.meta.series}
					</p>
					{#if post.meta.description}
						<p class="mt-2 text-base leading-relaxed text-fg">
							{post.meta.description}
						</p>
					{/if}
				</li>
			{/each}
		</ul>

		<p class="mt-16">
			<a href="/" class="link-trace font-mono text-xs text-muted">cd /</a>
		</p>
	</main>
{:else}
	<!-- empty collection: indistinguishable from a route that doesn't exist -->
	<FogNotFound />
{/if}
