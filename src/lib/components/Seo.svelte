<script lang="ts">
	// Per-page SEO: title + description drive the tab, search snippet, and the
	// title/description shown in link embeds. Global bits (canonical, og:image,
	// og:url, twitter:card, theme-color) live once in +layout.svelte.
	interface Props {
		title: string;
		description: string;
	}
	const { title, description }: Props = $props();
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
</svelte:head>
