<script lang="ts">
	import "../app.css";
	import { type Component } from "svelte";
	import { page } from "$app/state";
	import favicon from "$lib/assets/favicon.svg";
	import NowPlaying from "$lib/listening/NowPlaying.svelte";

	const { children } = $props();

	// canonical/og url follow the current route; everything else is site-wide
	const SITE = "https://enochzhu.com";
	const canonical = $derived(SITE + page.url.pathname);

	let Terminal = $state<Component<{ onclose: () => void }> | null>(null);
	let terminalOpen = $state(false);
	let restoreFocus: HTMLElement | null = null;

	async function onKeydown(e: KeyboardEvent) {
		if (e.key !== "`" || e.metaKey || e.ctrlKey || e.altKey) return;
		const target = e.target as HTMLElement;
		if (
			target instanceof HTMLInputElement ||
			target instanceof HTMLTextAreaElement ||
			target.isContentEditable
		) {
			return;
		}
		e.preventDefault();
		if (!Terminal) {
			Terminal = (await import("$lib/terminal/Terminal.svelte")).default;
		}
		restoreFocus = document.activeElement as HTMLElement;
		terminalOpen = true;
	}

	function closeTerminal() {
		terminalOpen = false;
		restoreFocus?.focus();
	}
</script>

<svelte:window onkeydown={onKeydown} />

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="canonical" href={canonical} />
	<meta name="theme-color" content="#0c110e" />

	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="enoch zhu" />
	<meta property="og:url" content={canonical} />
	<meta property="og:image" content="{SITE}/og.jpg" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content="enoch zhu — cs @ ut austin" />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:image" content="{SITE}/og.jpg" />
</svelte:head>

{#if terminalOpen && Terminal}
	<Terminal onclose={closeTerminal} />
{/if}

{@render children()}

<NowPlaying />
