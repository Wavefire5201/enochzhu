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
	// pairId drives the backdrop; the switcher below can rebind it.
	let pairId = $state<string | null>(null);
	const pair = $derived<HeroPair | null>(
		pairId ? (heroPairById(pairId) ?? heroPairs[0]) : null,
	);
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

	let switcherOpacity = $state(1);

	const displayedPairs = $derived(
		pairId
			? [heroPairById(pairId)!, ...heroPairs.filter((p) => p.id !== pairId)]
			: heroPairs,
	);

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
		const synRemaining = Math.max(
			0,
			220 - (performance.now() - arrivalStarted),
		);
		revealTimer = setTimeout(() => {
			loaderAcknowledged = true;
			ackTimer = setTimeout(() => (posterReady = true), 140);
		}, synRemaining);
	}

	function onPosterLoad(event: Event) {
		const image = event.currentTarget as HTMLImageElement;
		// Only reveal the layer for the refresh-scoped selection.
		if (pair && image.currentSrc.includes(`/${pair.id}-poster-`))
			finishArrival();
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

		// app.html makes this selection before first paint. Resolve it once here;
		// the switcher can rebind pairId afterwards.
		pairId = document.documentElement.dataset.heroPair ?? heroPairs[0].id;
		posterReady = false;
		void tick().then(() => {
			if (posterEl?.complete && posterEl.naturalWidth > 0) finishArrival();
		});

		if (reducedMotion) return;

		const probe = document.createElement("canvas");
		if (!probe.getContext("webgl2")) return;

		// Keep the mobile startup path static. Starting the continuous WebGL render
		// loop immediately blocks the main thread on slower phones, even though the
		// poster already provides the complete hero. Touch/keyboard input still
		// wakes the shader; pointer-first devices also retain the delayed warm-up.
		// No 'scroll': hydration scroll-restoration fires it without user intent.
		const mobileFirst =
			window.matchMedia("(max-width: 639px)").matches ||
			window.matchMedia("(pointer: coarse)").matches ||
			navigator.maxTouchPoints > 0;
		// Browser/device emulation can synthesize pointer movement while a mobile
		// page loads. Require a press on touch-first devices so the shader only
		// starts after genuine user intent.
		const events = mobileFirst
			? (["pointerdown", "touchstart", "keydown"] as const)
			: (["pointermove", "wheel", "keydown"] as const);
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

		const idleTimer = mobileFirst ? undefined : setTimeout(start, 6000);
		const cleanup = () => {
			if (idleTimer) clearTimeout(idleTimer);
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

	$effect(() => {
		const onScroll = () => {
			const progress = window.scrollY / window.innerHeight;
			switcherOpacity = Math.max(0, Math.min(1, 1 - (progress - 0.25) / 0.35));
		};
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	});
</script>

<section class="relative h-svh w-full overflow-hidden bg-bg" aria-label="intro">
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
			{#key pair.id}
				<GlyphCanvas
					{pair}
					ontiltstatus={(status: TiltStatus) => (tiltStatus = status)}
				/>
			{/key}
		</div>
	{/if}

	<!-- JS keeps the hero neutral until the selected poster is decoded. -->
	<div
		class="hero-poster-mask pointer-events-none absolute inset-0 z-1 bg-bg transition-opacity duration-200"
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
		class="pointer-events-none absolute inset-0 bg-linear-to-b from-bg/60 via-transparent to-bg"
	></div>

	<div class="absolute inset-x-0 top-0 z-10">
		<div
			class="mx-auto flex max-w-4xl items-baseline justify-between px-6 pt-10"
		>
			<!-- name and title live in the open fog (PRD §6) -->
			<div>
				<h1
					class="font-display text-5xl font-medium tracking-tight text-bright sm:text-6xl"
				>
					{about.name}
				</h1>
				<p class="mt-2 font-mono text-sm text-fg">{about.title}</p>
			</div>

			<nav
				aria-label="sections"
				class="hidden gap-5 font-mono text-sm text-fg md:flex"
			>
				<a class="link-trace" href="#about">about</a>
				<a class="link-trace" href="#experience">experience</a>
				<a class="link-trace" href="#projects">projects</a>
				<a class="link-trace" href="#contact">contact</a>
				<a class="link-trace" href="/now">now</a>
				<a class="link-trace" href="#music">music</a>
			</nav>
		</div>

		<!-- points at the CD wall — grouped with the name/nav block (not the
		     switcher) so it doesn't inherit switcherOpacity's early scroll fade -->
		<div class="mx-auto max-w-4xl px-6">
			<a
				href="#music"
				class="hero-cd-hint mt-3 block text-right font-mono text-xs text-ember italic transition-opacity hover:opacity-80 md:mt-2"
			>
				<span aria-hidden="true">↓</span> there's a cd wall at the bottom
			</a>
		</div>
	</div>

	<!-- bottom-16: stays clear of the fixed now-playing bar when the feed is live -->
	<nav
		aria-label="sections"
		class="absolute bottom-16 left-6 z-10 flex flex-col items-start gap-1 font-mono text-sm text-fg md:hidden"
	>
		<a class="link-trace" href="#about">about</a>
		<a class="link-trace" href="#experience">experience</a>
		<a class="link-trace" href="#projects">projects</a>
		<a class="link-trace" href="#contact">contact</a>
		<a class="link-trace" href="/now">now</a>
		<a class="link-trace" href="#music">music</a>
	</nav>

	<!-- backdrop switcher + photo credit; desktop only — the mobile bottom-left
	     holds the section nav and the now-playing bar -->
	<div
		class="absolute bottom-3 left-6 z-10 hidden md:block"
		style="opacity:{switcherOpacity}"
	>
		<div class="flex items-end gap-2">
			<span class="font-mono text-[0.65rem] text-muted">backdrop</span>
			<div class="group flex flex-col items-start">
				<!-- non-selected options: hidden at rest, reveal upward with stagger -->
				<div class="flex flex-col-reverse items-start gap-1 pb-1.5">
					{#each displayedPairs.slice(1) as p, i (p.id)}
						<button
							onclick={() => (pairId = p.id)}
							class="font-mono text-[0.65rem] text-fg opacity-0 transition-opacity duration-300 hover:text-ember group-hover:opacity-100"
							style="transition-delay:{(i + 1) * 70}ms">{p.label}</button
						>
					{/each}
				</div>
				<!-- always-visible: selected label -->
				<span class="font-mono text-[0.65rem] text-ember"
					>{displayedPairs[0]?.label ?? ""}</span
				>
			</div>
		</div>

		{#if pair?.credit}
			<a
				href={pair.credit.url}
				target="_blank"
				rel="noopener noreferrer"
				class="link-trace mt-1.5 block font-mono text-[0.65rem] text-muted"
			>
				photo — {pair.credit.name}
			</a>
		{/if}
	</div>

	{#if tiltStatus === "needs-permission"}
		<button
			type="button"
			onclick={requestTilt}
			class="absolute right-6 bottom-16 z-10 font-mono text-xs text-fg transition-colors hover:text-ember md:hidden"
		>
			enable tilt
		</button>
	{/if}
</section>

<style>
	.hero-poster-mask {
		display: none;
	}

	:global(.js) .hero-poster-mask {
		display: block;
	}

	.hero-cd-hint {
		animation: hero-cd-hint-drift 3.5s ease-in-out infinite;
	}

	@keyframes hero-cd-hint-drift {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(3px);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.hero-cd-hint {
			animation: none;
		}
	}
</style>
