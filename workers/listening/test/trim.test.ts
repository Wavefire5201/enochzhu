import { describe, expect, test } from "bun:test";
import { type LastfmRecentTracks, trimFeed } from "../src/trim";

const img = (url: string) => [
	{ size: "small", "#text": `${url}-s` },
	{ size: "large", "#text": url },
	{ size: "extralarge", "#text": `${url}-xl` },
];

const playing = {
	name: "Weird Fishes/Arpeggi",
	url: "https://www.last.fm/music/Radiohead/_/Weird+Fishes%2FArpeggi",
	artist: { "#text": "Radiohead" },
	album: { "#text": "In Rainbows" },
	image: img("https://img/weird-fishes.jpg"),
	"@attr": { nowplaying: "true" },
};

const played = {
	name: "Reckoner",
	url: "https://www.last.fm/music/Radiohead/_/Reckoner",
	artist: { "#text": "Radiohead" },
	album: { "#text": "In Rainbows" },
	image: img("https://img/reckoner.jpg"),
	date: { uts: "1752170000" },
};

describe("trimFeed", () => {
	test("flags the nowplaying track and null playedAt", () => {
		const feed = trimFeed({ recenttracks: { track: [playing, played] } }, 12);
		expect(feed.nowPlaying).toBe(true);
		expect(feed.tracks[0]).toEqual({
			name: "Weird Fishes/Arpeggi",
			artist: "Radiohead",
			album: "In Rainbows",
			cover: "https://img/weird-fishes.jpg",
			url: "https://www.last.fm/music/Radiohead/_/Weird+Fishes%2FArpeggi",
			nowPlaying: true,
			playedAt: null,
		});
		expect(feed.tracks[1]?.nowPlaying).toBe(false);
		expect(feed.tracks[1]?.playedAt).toBe(1752170000);
	});

	test("handles history-only feeds", () => {
		const feed = trimFeed({ recenttracks: { track: [played] } }, 12);
		expect(feed.nowPlaying).toBe(false);
		expect(feed.tracks).toHaveLength(1);
	});

	test("handles last.fm's single-track bare object", () => {
		const feed = trimFeed({ recenttracks: { track: played } }, 12);
		expect(feed.tracks).toHaveLength(1);
		expect(feed.tracks[0]?.name).toBe("Reckoner");
	});

	test("empty and error payloads yield an empty feed, not a throw", () => {
		expect(trimFeed({}, 12)).toEqual({ nowPlaying: false, tracks: [] });
		expect(trimFeed({ recenttracks: {} }, 12)).toEqual({
			nowPlaying: false,
			tracks: [],
		});
	});

	test("respects the limit", () => {
		const feed = trimFeed(
			{ recenttracks: { track: Array.from({ length: 13 }, () => played) } },
			12,
		);
		expect(feed.tracks).toHaveLength(12);
	});

	test("missing fields degrade to empty strings", () => {
		const feed = trimFeed(
			{ recenttracks: { track: [{ name: "?" }] } } as LastfmRecentTracks,
			12,
		);
		expect(feed.tracks[0]).toEqual({
			name: "?",
			artist: "",
			album: "",
			cover: "",
			url: "",
			nowPlaying: false,
			playedAt: null,
		});
	});
});
