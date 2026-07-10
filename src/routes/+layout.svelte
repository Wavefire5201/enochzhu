<script lang="ts">
import "../app.css";
import { inject } from "@vercel/analytics";
import type { Component } from "svelte";
import { browser } from "$app/environment";
import favicon from "$lib/assets/favicon.svg";

const { children } = $props();

if (browser) {
	inject();
}

// terminal: summoned by backtick, loaded only when summoned (PRD §7)
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
</svelte:head>

{#if terminalOpen && Terminal}
	<Terminal onclose={closeTerminal} />
{/if}

{@render children()}
