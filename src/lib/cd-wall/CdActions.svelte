<script lang="ts">
	import type { CdAlbum } from "./albums";

	interface Props {
		album: CdAlbum;
	}

	const { album }: Props = $props();

	type SearchResponse = {
		results?: Array<{ previewUrl?: string }>;
	};

	let audio: HTMLAudioElement | null = null;
	let previewUrl = $state<string | null>(null);
	let loading = $state(false);
	let playing = $state(false);
	let volume = $state(0.7);

	function stop() {
		if (!audio) return;
		audio.pause();
		audio.currentTime = 0;
		audio = null;
		playing = false;
	}

	function togglePreview() {
		if (!previewUrl) return;
		if (!audio) {
			audio = new Audio(previewUrl);
			audio.preload = "metadata";
			audio.volume = volume;
			audio.addEventListener("ended", () => (playing = false));
		}
		if (audio.paused) {
			audio.play().then(
				() => (playing = true),
				() => (playing = false),
			);
		} else {
			audio.pause();
			playing = false;
		}
	}

	$effect(() => {
		if (audio) audio.volume = volume;
	});

	$effect(() => {
		const query = [album.artist, album.title].filter(Boolean).join(" ");
		if (!query) return;
		let cancelled = false;
		stop();
		previewUrl = null;
		loading = true;

		void fetch(
			`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=5`,
		)
			.then(async (response) => {
				if (!response.ok) return null;
				const data = (await response.json()) as SearchResponse;
				return (
					data.results?.find((result) => result.previewUrl)?.previewUrl ?? null
				);
			})
			.then((url) => {
				if (!cancelled) previewUrl = url;
			})
			.catch(() => {})
			.finally(() => {
				if (!cancelled) loading = false;
			});

		return () => {
			cancelled = true;
			stop();
		};
	});
</script>

<div class="cd-actions" aria-label="album actions">
	{#if previewUrl}
		<button
			type="button"
			class="cd-orb cd-orb-play"
			aria-label={playing
				? "pause 30-second preview"
				: "play 30-second preview"}
			onclick={togglePreview}
		>
			{playing ? "Ⅱ" : "▶"}
		</button>
		<label class="cd-volume">
			<span class="sr-only">preview volume</span>
			<input
				type="range"
				min="0"
				max="1"
				step="0.05"
				bind:value={volume}
				aria-label="preview volume"
			/>
		</label>
	{:else if loading}
		<span class="cd-orb cd-orb-loading" aria-label="finding a preview"></span>
	{/if}

	{#if album.link}
		<a
			class="cd-orb cd-orb-link"
			href={album.link}
			target="_blank"
			rel="noopener noreferrer"
			aria-label={`open ${album.title}`}
			title={`open ${album.title}`}
		>
			↗
		</a>
	{/if}
</div>

<style>
	.cd-actions {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		min-height: 2.5rem;
	}

	.cd-orb {
		display: grid;
		width: 2.25rem;
		height: 2.25rem;
		place-items: center;
		border: 1px solid color-mix(in srgb, var(--color-fg) 34%, transparent);
		border-radius: 999px;
		background: color-mix(in srgb, var(--color-bg) 60%, transparent);
		color: var(--color-bright);
		box-shadow: 0 0 1.5rem color-mix(in srgb, var(--color-bg) 85%, transparent);
		backdrop-filter: blur(8px);
		transition:
			transform 180ms ease,
			background 180ms ease,
			border-color 180ms ease;
		animation: orb-in 320ms cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	.cd-orb:hover,
	.cd-orb:focus-visible {
		transform: scale(1.1);
		border-color: var(--color-bright);
		background: color-mix(in srgb, var(--color-fg) 13%, var(--color-bg));
		outline: none;
	}

	.cd-orb-play {
		font-family: var(--font-mono);
		font-size: 0.8rem;
		cursor: pointer;
	}

	.cd-orb-link {
		font-size: 1rem;
		text-decoration: none;
	}

	.cd-orb-loading {
		width: 0.7rem;
		height: 0.7rem;
		margin: 0 0.8rem;
		border-color: var(--color-muted);
		animation: orb-pulse 850ms ease-in-out infinite alternate;
	}

	.cd-volume {
		display: grid;
		width: 4.5rem;
		align-items: center;
	}

	.cd-volume input {
		width: 100%;
		accent-color: var(--color-bright);
		cursor: ew-resize;
	}

	@keyframes orb-in {
		from {
			opacity: 0;
			transform: scale(0.45);
		}
	}

	@keyframes orb-pulse {
		to {
			opacity: 0.25;
			transform: scale(0.65);
		}
	}
</style>
