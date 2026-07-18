<script lang="ts">
	import type { CdAlbum } from "./albums";
	import type { PreviewPlayer } from "./preview-player.svelte";

	interface Props {
		album: CdAlbum;
		/** the shared player owned by the parent, so audio outlives this panel */
		player: PreviewPlayer;
	}

	const { album, player }: Props = $props();
</script>

<div class="cd-actions" aria-label="album actions">
	{#if player.previewUrl}
		<button
			type="button"
			class="cd-orb cd-orb-play"
			aria-label={player.playing
				? "pause 30-second preview"
				: "play 30-second preview"}
			onclick={() => player.toggle()}
		>
			{player.playing ? "Ⅱ" : "▶"}
		</button>
	{:else if player.loading}
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
		gap: 0.35rem;
		min-height: 2rem;
		padding: 0.28rem 0.45rem;
		border: 1px solid color-mix(in srgb, var(--color-fg) 18%, transparent);
		border-radius: 999px;
		background: color-mix(in srgb, var(--color-bg) 68%, transparent);
		backdrop-filter: blur(10px);
		box-shadow: 0 0.4rem 1.6rem
			color-mix(in srgb, var(--color-bg) 70%, transparent);
	}

	.cd-orb {
		display: grid;
		width: 1.85rem;
		height: 1.85rem;
		place-items: center;
		border: 1px solid color-mix(in srgb, var(--color-fg) 30%, transparent);
		border-radius: 999px;
		background: color-mix(in srgb, var(--color-fg) 8%, transparent);
		color: var(--color-bright);
		box-shadow: 0 0 0.9rem color-mix(in srgb, var(--color-bg) 85%, transparent);
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
