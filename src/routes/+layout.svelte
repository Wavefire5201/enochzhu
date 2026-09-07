<script lang="ts">
	import "../app.css";
	import { page } from "$app/state";
	import NowPlaying from "$lib/listening/NowPlaying.svelte";

	const { children } = $props();

	// canonical/og url follow the current route; everything else is site-wide
	const SITE = "https://enochzhu.com";
	const canonical = $derived(SITE + page.url.pathname);
</script>

<svelte:head>
	<link rel="canonical" href={canonical} />
	<meta name="theme-color" content="#0c110e" />

	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="enoch zhu" />
	<meta property="og:url" content={canonical} />
	<meta property="og:image" content="{SITE}/og.jpg" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content="enoch zhu ・ cs @ ut austin" />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:image" content="{SITE}/og.jpg" />
</svelte:head>

{@render children()}

<NowPlaying />
