<script lang="ts">
import type { Component } from "svelte";
import { onDestroy, onMount, tick } from "svelte";
import type { About } from "$lib/content/schema";
import type { TiltStatus } from "$lib/hero/glyph-renderer";
import type { HeroPair } from "$lib/hero/pairs";
import { heroPairById, heroPairs, posterSrcset } from "$lib/hero/pairs";

interface Props {
	about: About;
}

const { about }: Props = $props();

// The static render is the default and the fallback. Text renders first;
// the WebGL bundle is lazily imported and never blocks paint (PRD §6).
let pair = $state<HeroPair | null>(null);
let posterReady = $state(false);
let posterEl = $state<HTMLImageElement>();
let loaderVisible = $state(false);
let loaderAcknowledged = $state(false);
let arrivalStarted = 0;
let finishing = false;
let revealTimer: ReturnType<typeof setTimeout> | undefined;
let ackTimer: ReturnType<typeof setTimeout> | undefined;

let GlyphCanvas = $state<Component | null>(null);
let tiltStatus = $state<TiltStatus | null>(null);

function requestTilt() {
	window.dispatchEvent(new Event("hero-request-tilt"));
}

function finishArrival() {
	if (finishing) return;
	finishing = true;

	if (!loaderVisible) {
		posterReady = true;
		return;
	}

	// Enough time to register as an intentional beat, never enough to become
	// an intro animation. Slow images simply hold on `syn` until decoded.
	const synRemaining = Math.max(0, 220 - (performance.now() - arrivalStarted));
	revealTimer = setTimeout(() => {
		loaderAcknowledged = true;
		ackTimer = setTimeout(() => (posterReady = true), 140);
	}, synRemaining);
}

function onPosterLoad(event: Event) {
	const image = event.currentTarget as HTMLImageElement;
	// Only reveal the layer for the refresh-scoped selection.
	if (pair && image.currentSrc.includes(`/${pair.id}-poster-`)) finishArrival();
}

onMount(() => {
	const reducedMotion = window.matchMedia(
		"(prefers-reduced-motion: reduce)",
	).matches;
	let firstArrival = true;
	try {
		firstArrival = sessionStorage.getItem("hero-arrival") !== "seen";
		sessionStorage.setItem("hero-arrival", "seen");
	} catch {
		// Storage can be unavailable in privacy modes; a brief arrival is safe.
	}
	loaderVisible = firstArrival && !reducedMotion;
	loaderAcknowledged = false;
	arrivalStarted = performance.now();
	finishing = false;

	// app.html makes this selection before first paint. Resolve it once here
	// and pass the same pair through the poster and WebGL layers.
	pair =
		heroPairById(document.documentElement.dataset.heroPair) ?? heroPairs[0];
	posterReady = false;
	void tick().then(() => {
		if (posterEl?.complete && posterEl.naturalWidth > 0) finishArrival();
	});

	if (reducedMotion) return;

	const probe = document.createElement("canvas");
	if (!probe.getContext("webgl2")) return;

	// Touch-first devices have no hover moment to wake the shader, so start
	// them automatically. Pointer-first devices retain the interaction gate.
	// No 'scroll': hydration scroll-restoration fires it without user intent.
	const events = ["pointermove", "wheel", "touchstart", "keydown"] as const;
	const mobileFirst =
		window.matchMedia("(max-width: 639px)").matches ||
		window.matchMedia("(pointer: coarse)").matches ||
		navigator.maxTouchPoints > 0;
	let started = false;

	const start = async () => {
		if (started) return;
		started = true;
		cleanup();
		try {
			GlyphCanvas = (await import("$lib/hero/GlyphCanvas.svelte")).default;
		} catch {
			// failed to load the shader bundle — the static image is already up
		}
	};

	const idleTimer = setTimeout(start, mobileFirst ? 0 : 6000);
	const cleanup = () => {
		clearTimeout(idleTimer);
		for (const name of events) window.removeEventListener(name, start);
	};

	for (const name of events) {
		window.addEventListener(name, start, { once: false, passive: true });
	}

	return cleanup;
});

onDestroy(() => {
	clearTimeout(revealTimer);
	clearTimeout(ackTimer);
});
</script>

<section
	class="relative h-svh w-full overflow-hidden bg-bg"
	aria-label="intro"
>
	{#if pair}
		<img
			bind:this={posterEl}
			src={pair.poster.large}
			srcset={posterSrcset(pair).srcset}
			sizes={posterSrcset(pair).sizes}
			alt=""
			class="absolute inset-0 h-full w-full object-cover"
			fetchpriority="high"
			onload={onPosterLoad}
		/>
	{/if}

	<noscript>
		<img
			src={heroPairs[0].poster.large}
			srcset={posterSrcset(heroPairs[0]).srcset}
			sizes={posterSrcset(heroPairs[0]).sizes}
			alt=""
			class="absolute inset-0 h-full w-full object-cover"
			fetchpriority="high"
		/>
	</noscript>

	{#if GlyphCanvas && pair}
		<div class="absolute inset-0">
			<GlyphCanvas
				{pair}
				ontiltstatus={(status: TiltStatus) => (tiltStatus = status)}
			/>
		</div>
	{/if}

	<!-- JS keeps the hero neutral until the selected poster is decoded. -->
	<div
		class="hero-poster-mask pointer-events-none absolute inset-0 z-[1] bg-bg transition-opacity duration-200"
		class:opacity-0={posterReady}
		aria-hidden="true"
	>
		{#if loaderVisible}
			<div class="flex h-full items-center justify-center">
				<p
					class="font-mono text-[0.65rem] tracking-[0.2em] text-muted uppercase"
					class:animate-pulse={!loaderAcknowledged}
				>
					{loaderAcknowledged ? "ack" : "syn"}
				</p>
			</div>
		{/if}
	</div>

	<!-- legibility scrim for the fog band; the photo is bright up top -->
	<div
		class="pointer-events-none absolute inset-0 bg-gradient-to-b from-bg/60 via-transparent to-bg"
	></div>

	<div class="absolute inset-x-0 top-0 z-10">
		<div class="mx-auto flex max-w-4xl items-baseline justify-between px-6 pt-10">
			<!-- name and title live in the open fog (PRD §6) -->
			<div>
				<h1 class="font-display text-5xl font-medium tracking-tight text-bright sm:text-6xl">
					{about.name}
				</h1>
				<p class="mt-2 font-mono text-sm text-fg">{about.title}</p>
			</div>

			<nav aria-label="sections" class="hidden gap-5 font-mono text-sm text-fg sm:flex">
				<a class="link-trace" href="#projects">projects</a>
				<a class="link-trace" href="#experience">experience</a>
				<a class="link-trace" href="#about">about</a>
				<a class="link-trace" href="#contact">contact</a>
			</nav>
		</div>
	</div>

	<nav
		aria-label="sections"
		class="absolute bottom-8 left-6 z-10 flex flex-col items-start gap-1 font-mono text-sm text-fg sm:hidden"
	>
		<a class="link-trace" href="#projects">projects</a>
		<a class="link-trace" href="#experience">experience</a>
		<a class="link-trace" href="#about">about</a>
		<a class="link-trace" href="#contact">contact</a>
	</nav>

	{#if tiltStatus === "needs-permission"}
		<button
			type="button"
			onclick={requestTilt}
			class="absolute right-6 bottom-8 z-10 font-mono text-xs text-fg transition-colors hover:text-ember sm:hidden"
		>
			enable tilt
		</button>
	{:else if tiltStatus}
		<p
			class="absolute right-6 bottom-8 z-10 font-mono text-xs text-muted sm:hidden"
			aria-live="polite"
		>
			{#if tiltStatus === "active"}
				tilt · on
			{:else if tiltStatus === "listening"}
				tilt · …
			{:else}
				tilt · unavailable
			{/if}
		</p>
	{/if}
</section>

<style>
	.hero-poster-mask {
		display: none;
	}

	:global(.js) .hero-poster-mask {
		display: block;
	}
</style>
