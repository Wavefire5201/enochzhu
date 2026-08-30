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
		<svg
			viewBox="0 0 16 16"
			width="16"
			height="16"
			fill="currentColor"
			aria-hidden="true"
			class="shrink-0 text-fg"
		>
			<path
				d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
				0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13
				-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07
				-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12
				0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27
				1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15
				0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2
				0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
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
