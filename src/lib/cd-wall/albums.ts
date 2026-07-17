import type { Entry } from "$lib/content";
import type { Music } from "$lib/content/schema";
import type { DiscStyle } from "./disc-art";

/**
 * What the wall renders. The renderer consumes this array and does not care
 * where it came from — today a curated content collection, later possibly a
 * live source (Navidrome / Spotify / Last.fm). Swap the adapter, not the wall.
 */
export interface CdAlbum {
	id: string;
	title: string;
	artist?: string;
	year?: string;
	/** cover image path (≤512px square lives under static/music/) */
	cover: string;
	/** optional looping mp4 cover, played in place of the still on the wall */
	video?: string;
	/** dominant cover hex — placeholder shown before the texture streams in */
	color: string;
	link?: string;
	note?: string;
	/** optional manual override of the auto-assigned disc face (see pickDiscStyle) */
	discStyle?: DiscStyle;
}

const FALLBACK_COLOR = "#1d211f";

/** curated content collection → wall data. Albums without cover art stay in
 * the plain grid; the wall only shows real covers. */
export function toCdAlbums(entries: Entry<Music>[]): CdAlbum[] {
	return entries
		.filter((e) => e.meta.kind === "album" && e.meta.cover)
		.map((e) => ({
			id: e.slug,
			title: e.meta.title,
			artist: e.meta.artist,
			year: e.meta.year,
			cover: e.meta.cover as string,
			video: e.meta.video,
			color: e.meta.color ?? FALLBACK_COLOR,
			link: e.meta.link,
			note: e.meta.note,
			discStyle: e.meta.discStyle as DiscStyle | undefined,
		}));
}
