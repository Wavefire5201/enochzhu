<script lang="ts">
	import { onMount } from "svelte";

	interface Props {
		url: string;
		note?: string;
	}

	const { url, note }: Props = $props();

	// derived synchronously from the url so owner/name prerenders without
	// waiting on the client-side fetch below
	const { owner, name } = $derived.by(() => {
		const match = url.match(/github\.com\/([^/]+)\/([^/#?]+)/);
		return { owner: match?.[1] ?? "", name: match?.[2] ?? "" };
	});

	interface RepoMeta {
		description: string | null;
		stars: number;
		language: string | null;
		updated: string | null;
	}

	let meta = $state<RepoMeta | null>(null);

	const starFormatter = new Intl.NumberFormat("en", { notation: "compact" });

	// joined with the site's katakana middle-dot separator; only present
	// fields make it in, so a partial API response still reads cleanly
	const metaLine = $derived.by(() => {
		if (!meta) return "";
		const parts: string[] = [];
		if (meta.stars) parts.push(`★ ${starFormatter.format(meta.stars)}`);
		if (meta.language) parts.push(meta.language);
		if (meta.updated) parts.push(`updated ${meta.updated}`);
		return parts.join(" ・ ");
	});

	onMount(async () => {
		if (!owner || !name) return;
		try {
			const res = await fetch(`https://api.github.com/repos/${owner}/${name}`);
			if (!res.ok) return; // rate-limited (403) or gone; keep the static fallback
			const data = await res.json();
			meta = {
				description: data.description ?? null,
				stars:
					typeof data.stargazers_count === "number" ? data.stargazers_count : 0,
				language: data.language ?? null,
				updated:
					typeof data.pushed_at === "string"
						? data.pushed_at.slice(0, 10)
						: null,
			};
		} catch {
			// network error; keep the static fallback
		}
	});
</script>

<a
	href={url}
	target="_blank"
	rel="noopener noreferrer"
	aria-label="{owner}/{name} on github"
	class="repo-card not-prose mt-4 mb-4 block rounded-sm border border-line px-4 py-3 no-underline transition-colors hover:border-ember"
>
	<span class="flex items-center gap-2">
		<!-- github mark from simple icons (simpleicons.org/?q=github), verbatim -->
		<svg
			viewBox="0 0 24 24"
			width="16"
			height="16"
			fill="currentColor"
			aria-hidden="true"
			class="shrink-0 overflow-visible text-fg"
		>
			<path
				d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
			/>
		</svg>
		<span class="font-mono text-sm text-bright">{owner}/{name}</span>
	</span>

	{#if meta?.description}
		<p class="repo-desc mt-2 text-sm text-fg">{meta.description}</p>
	{/if}

	{#if metaLine}
		<p class="repo-meta mt-2 font-mono text-xs text-muted">{metaLine}</p>
	{/if}
</a>

{#if note}
	<p class="repo-note not-prose mt-2 font-mono text-xs text-muted italic">
		{note}
	</p>
{/if}

<style>
	/* .post-prose :global(a/p) in the post page (src/routes/notes/[slug]/+page.svelte)
	   restyles every anchor and paragraph inside the article, including this
	   card's — beat it explicitly rather than fight specificity/ordering */
	.repo-card {
		text-decoration: none !important;
	}

	.repo-card:hover {
		text-decoration: none !important;
	}

	.repo-desc,
	.repo-meta,
	.repo-note {
		margin-top: 0.5rem !important;
	}

	@media print {
		.repo-card {
			border-color: #000;
			color: #000;
		}

		.repo-card :global(*) {
			color: #000 !important;
		}

		/* the post page has no site-wide a[href]::after rule to spell out
		   link destinations on paper, so this card supplies its own */
		.repo-card[href]::after {
			content: " (" attr(href) ")";
			font-size: 0.75em;
		}
	}
</style>
