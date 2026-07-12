/**
 * Pure trim of Last.fm's user.getRecentTracks payload down to what the UI
 * needs. Kept free of runtime APIs so it is unit-testable with `bun test`.
 */

export interface Track {
	name: string;
	artist: string;
	album: string;
	cover: string;
	url: string;
	nowPlaying: boolean;
	/** unix seconds; null while playing */
	playedAt: number | null;
}

export interface Feed {
	nowPlaying: boolean;
	tracks: Track[];
}

interface LastfmImage {
	size: string;
	"#text": string;
}

interface LastfmTrack {
	name?: string;
	url?: string;
	artist?: { "#text"?: string };
	album?: { "#text"?: string };
	image?: LastfmImage[];
	date?: { uts?: string };
	"@attr"?: { nowplaying?: string };
}

export interface LastfmRecentTracks {
	recenttracks?: {
		track?: LastfmTrack | LastfmTrack[];
	};
}

export function trimFeed(data: LastfmRecentTracks, limit: number): Feed {
	const raw = data.recenttracks?.track ?? [];
	// last.fm returns a bare object instead of an array for a single track
	const list = Array.isArray(raw) ? raw : [raw];
	const tracks = list.slice(0, limit).map((t): Track => {
		const uts = Number(t.date?.uts);
		return {
			name: t.name ?? "",
			artist: t.artist?.["#text"] ?? "",
			album: t.album?.["#text"] ?? "",
			cover: t.image?.find((i) => i.size === "large")?.["#text"] ?? "",
			url: t.url ?? "",
			nowPlaying: t["@attr"]?.nowplaying === "true",
			playedAt: Number.isFinite(uts) ? uts : null,
		};
	});
	return { nowPlaying: tracks[0]?.nowPlaying ?? false, tracks };
}
