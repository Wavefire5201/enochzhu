import { CanvasTexture, SRGBColorSpace } from "three";
import { buildGlyphAtlas } from "../hero/glyph-atlas";
import type { CdAlbum } from "./albums";
import { type CoverImage, loadCoverBitmap } from "./cover-image";

/**
 * Disc-face treatments, previewable in /proto/cd-case. A real CD is two
 * surfaces: a matte printed LABEL and a shiny mirror DATA ring, and a style
 * paints both into one colour map — the rings glint because the disc material
 * underneath is already metal, not because the style ships its own
 * metalness/roughness maps. "mirror" returns no map at all and falls back to
 * the material's own iridescent metal.
 */
export type DiscStyle =
	| "mirror"
	| "catalog"
	| "label"
	| "art"
	| "color"
	| "clean"
	| "palette"
	| "spiral"
	| "duotone"
	| "pressed"
	| "halftone"
	| "halftone-clean"
	| "geo"
	| "marquee"
	| "index"
	| "ascii"
	| "dither";

export const DISC_STYLES: { value: DiscStyle; label: string; hint: string }[] =
	[
		{
			value: "catalog",
			label: "catalog label",
			hint: "The overlay replacement: high-contrast title, artist, and year set horizontally on a palette-led A-side label.",
		},
		{
			value: "mirror",
			label: "iridescent mirror",
			hint: "Bare reflective disc — lets the HDR glints be the star.",
		},
		{
			value: "clean",
			label: "clean label",
			hint: "Minimal print — title set small near the hub, lots of bare disc, a single hairline accent pulled from the cover palette. Extra clean.",
		},
		{
			value: "palette",
			label: "palette bands",
			hint: "Concentric rings coloured from the cover's extracted palette — a unique, textless disc per album.",
		},
		{
			value: "spiral",
			label: "curved type",
			hint: "Title curved along the outer ring, artist along the inner — reads as pressed-in editorial type.",
		},
		{
			value: "duotone",
			label: "duotone print",
			hint: "Cover art screen-printed in two palette tones — a bold graphic label.",
		},
		{
			value: "pressed",
			label: "pressed disc",
			hint: "Realistic manufactured CD: silver face with a faint rainbow data groove, catalog microtype curved at the hub, printed title, and 'compact disc · digital audio' set near the rim with registration ticks.",
		},
		{
			value: "halftone",
			label: "halftone print",
			hint: "Cover art rendered as a one-tone dot screen over the album colour — a screen-printed graphic with the title set clean near the hub.",
		},
		{
			value: "halftone-clean",
			label: "halftone + clean label",
			hint: "A restrained dot field carries the cover image while the clean label's quiet title, subtitle, and single accent ring keep the disc legible.",
		},
		{
			value: "geo",
			label: "generative geometry",
			hint: "Textless palette-seeded mandala — concentric segmented rings and rays derived from the album, unique to each record. Leans on the caption for words.",
		},
		{
			value: "marquee",
			label: "type marquee",
			hint: "Title repeated as a continuous ticker curved around the outer ring; artist and year set small at the hub.",
		},
		{
			value: "index",
			label: "index card",
			hint: "Monospace card-catalog grid: a big stacked lowercase title over a hairline baseline grid, year set as a coordinate.",
		},
		{
			value: "ascii",
			label: "ascii dither",
			hint: "Cover art transcoded to a glyph field with the home hero's coverage-equalized atlas — every glyph coloured from the album's own palette over a dim wash of the cover.",
		},
		{
			value: "dither",
			label: "1-bit dither",
			hint: "Pure ordered-dither of the cover in one colour — the dominant palette shade on a dark disc. No type, no dots, just pixel cells.",
		},
		{
			value: "label",
			label: "disc + label ring",
			hint: "Realistic CD: matte printed label in the album colour, shiny clamp + edge rings, title/artist set near the hub.",
		},
		{
			value: "art",
			label: "faded album art",
			hint: "The cover printed across the disc, desaturated so it reads as print.",
		},
		{
			value: "color",
			label: "album colour + mark",
			hint: "Solid dominant colour with a faint initial watermark and a shiny clamp ring.",
		},
	];

export interface DiscMaps {
	map: CanvasTexture | null;
	dispose(): void;
}

export interface HalftoneOptions {
	/** number of dot cells across the source image */
	density: number;
	/** maximum dot radius as a fraction of each cell */
	dotScale: number;
	/** contrast curve applied before dot size is calculated */
	contrast: number;
	/** ink strength over the album-colour paper */
	inkOpacity: number;
}

export const DEFAULT_HALFTONE_OPTIONS: HalftoneOptions = {
	density: 66,
	dotScale: 1.28,
	contrast: 1,
	inkOpacity: 0.82,
};

export interface DitherDiscOptions {
	density: number;
	colorMode: "bw" | "album" | "green" | "amber";
	contrast: number;
}

export const DEFAULT_DITHER_DISC_OPTIONS: DitherDiscOptions = {
	density: 256,
	colorMode: "bw",
	contrast: 1.0,
};

const SIZE = 1024;
const C = SIZE / 2;
const R_OUT = SIZE / 2; // outer edge
const R_HUB = SIZE * 0.06; // centre hole
const R_CLAMP = SIZE * 0.17; // clamping/mirror ring outer edge
const R_EDGE = SIZE * 0.47; // where the shiny outer rim begins

function canvas() {
	const el = document.createElement("canvas");
	el.width = el.height = SIZE;
	return el;
}

/** clip to the disc annulus (outer circle minus the centre hole) */
function clipDisc(ctx: CanvasRenderingContext2D) {
	ctx.beginPath();
	ctx.arc(C, C, R_OUT, 0, Math.PI * 2);
	ctx.arc(C, C, R_HUB, 0, Math.PI * 2, true);
	ctx.clip("evenodd");
}

function ring(
	ctx: CanvasRenderingContext2D,
	inner: number,
	outer: number,
	fill: string,
) {
	ctx.beginPath();
	ctx.arc(C, C, outer, 0, Math.PI * 2);
	ctx.arc(C, C, inner, 0, Math.PI * 2, true);
	ctx.fillStyle = fill;
	ctx.fill("evenodd");
}

function clearRing(
	ctx: CanvasRenderingContext2D,
	inner: number,
	outer: number,
) {
	ctx.save();
	ctx.globalCompositeOperation = "destination-out";
	ctx.beginPath();
	ctx.arc(C, C, outer, 0, Math.PI * 2);
	ctx.arc(C, C, inner, 0, Math.PI * 2, true);
	ctx.fillStyle = "rgba(0,0,0,1)";
	ctx.fill("evenodd");
	ctx.restore();
}

function texture(el: HTMLCanvasElement, srgb: boolean): CanvasTexture {
	const tex = new CanvasTexture(el);
	if (srgb) tex.colorSpace = SRGBColorSpace;
	tex.needsUpdate = true;
	return tex;
}

function readable(hex: string) {
	const n = parseInt(hex.replace("#", ""), 16);
	const r = (n >> 16) & 255,
		g = (n >> 8) & 255,
		b = n & 255;
	// perceived luminance → pick black or white text for contrast
	return 0.2126 * r + 0.7152 * g + 0.0722 * b > 140 ? "#1a1a1a" : "#f2f2f2";
}

function translucent(hex: string, alpha: number) {
	const [r, g, b] = hexRgb(hex);
	return `rgb(${r} ${g} ${b} / ${alpha})`;
}

/** Draw the largest readable text that fits the requested label width. */
function fittedText(
	ctx: CanvasRenderingContext2D,
	text: string,
	maxWidth: number,
	startSize: number,
	minSize: number,
) {
	let size = startSize;
	while (size > minSize) {
		ctx.font = `600 ${size}px 'Commit Mono', ui-monospace, monospace`;
		if (ctx.measureText(text).width <= maxWidth) break;
		size -= 2;
	}
	ctx.font = `600 ${size}px 'Commit Mono', ui-monospace, monospace`;
}

function labelBase(album: CdAlbum): HTMLCanvasElement {
	const el = canvas();
	const ctx = el.getContext("2d")!;
	clipDisc(ctx);
	// printed label fills the disc; a paler concentric sheen keeps it from
	// reading as one flat chip
	const grad = ctx.createRadialGradient(C, C, R_CLAMP, C, C, R_OUT);
	grad.addColorStop(0, album.color);
	grad.addColorStop(1, album.color);
	ctx.fillStyle = grad;
	ctx.fillRect(0, 0, SIZE, SIZE);
	// silver rings sit over the print so the shine has a colour to reflect
	ring(ctx, R_HUB, R_CLAMP, "#c9ccce");
	ring(ctx, R_EDGE, R_OUT, "#c9ccce");
	// Information reads horizontally at the disc's resting angle. Printed proto
	// styles use a stable radial UV disc, so no pre-flipping is needed.
	const ink = readable(album.color);
	ctx.fillStyle = ink;
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	fittedText(ctx, album.title.toLowerCase(), R_OUT * 1.5, 72, 34);
	ctx.fillText(album.title.toLowerCase(), C, C - 292, R_OUT * 1.5);
	if (album.artist) {
		ctx.globalAlpha = 0.7;
		ctx.font = `400 38px 'Commit Mono', ui-monospace, monospace`;
		ctx.fillText(album.artist.toLowerCase(), C, C - 224, R_OUT * 1.45);
		ctx.globalAlpha = 1;
	}
	if (album.year) {
		ctx.globalAlpha = 0.58;
		ctx.font = `500 30px 'Commit Mono', ui-monospace, monospace`;
		ctx.fillText(album.year, C, C + 236);
		ctx.globalAlpha = 1;
	}
	return el;
}

/**
 * The information-forward option: a real A-side label with cover-derived
 * colours confined to graphic detail. This deliberately avoids curved title
 * type — it stays legible when the viewer catches the disc at a glance.
 */
function catalogBase(album: CdAlbum, palette: string[]): HTMLCanvasElement {
	const el = canvas();
	const ctx = el.getContext("2d")!;
	clipDisc(ctx);
	const accent = mostVibrant(palette) ?? album.color;
	// Light covers get a dark ink label; dark covers can use warm paper. This is
	// deliberately the inverse of the text-contrast decision above.
	const dark = readable(album.color) === "#1a1a1a" ? "#121413" : "#f1f2ee";
	ctx.fillStyle = dark;
	ctx.fillRect(0, 0, SIZE, SIZE);
	// Palette-recovered colour appears in a pair of precise rings, rather than
	// making the label itself low-contrast or decorative.
	ring(ctx, R_CLAMP + 9, R_CLAMP + 22, accent);
	ring(ctx, R_EDGE - 17, R_EDGE - 8, accent);
	strokeRing(ctx, R_EDGE - 42, translucent(accent, 0.4), 2);
	ring(ctx, R_HUB, R_CLAMP, "#c9ccce");
	ring(ctx, R_EDGE, R_OUT, "#c9ccce");

	ctx.fillStyle = readable(dark);
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	fittedText(ctx, album.title.toUpperCase(), R_OUT * 1.5, 86, 38);
	ctx.fillText(album.title.toUpperCase(), C, C - 300, R_OUT * 1.5);
	ctx.globalAlpha = 0.72;
	ctx.font = `500 42px 'Commit Mono', ui-monospace, monospace`;
	ctx.fillText(
		(album.artist ?? "unknown artist").toUpperCase(),
		C,
		C - 230,
		R_OUT * 1.45,
	);
	ctx.globalAlpha = 0.55;
	ctx.font = `500 34px 'Commit Mono', ui-monospace, monospace`;
	ctx.fillText(album.year ?? "—", C, C + 230);
	ctx.globalAlpha = 0.5;
	ctx.font = `500 20px 'Commit Mono', ui-monospace, monospace`;
	ctx.fillText("SIDE A  ·  COMPACT DISC", C, C + 292, R_OUT * 1.35);
	ctx.globalAlpha = 1;
	return el;
}

function colorBase(album: CdAlbum): HTMLCanvasElement {
	const el = canvas();
	const ctx = el.getContext("2d")!;
	clipDisc(ctx);
	ctx.fillStyle = album.color;
	ctx.fillRect(0, 0, SIZE, SIZE);
	ring(ctx, R_HUB, R_CLAMP, "#c9ccce");
	ring(ctx, R_EDGE, R_OUT, "#c9ccce");
	// faint initial watermark
	const ink = readable(album.color);
	ctx.fillStyle = ink;
	ctx.globalAlpha = 0.14;
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.font = `700 260px 'EB Garamond', Georgia, serif`;
	ctx.fillText(album.title.charAt(0).toUpperCase(), C, C + 20);
	ctx.globalAlpha = 1;
	return el;
}

function artBase(album: CdAlbum): Promise<HTMLCanvasElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload = () => {
			const el = canvas();
			const ctx = el.getContext("2d")!;
			clipDisc(ctx);
			// cover-fill the square art into the disc
			const s = Math.max(SIZE / img.width, SIZE / img.height);
			const w = img.width * s,
				h = img.height * s;
			ctx.drawImage(img, C - w / 2, C - h / 2, w, h);
			// desaturate + darken so it reads as printed, not a bright sticker
			ctx.globalCompositeOperation = "saturation";
			ctx.fillStyle = "#808080";
			ctx.fillRect(0, 0, SIZE, SIZE);
			ctx.globalCompositeOperation = "source-over";
			ctx.fillStyle = "rgba(20,20,22,0.35)";
			ctx.fillRect(0, 0, SIZE, SIZE);
			ring(ctx, R_HUB, R_CLAMP, "#c9ccce");
			ring(ctx, R_EDGE, R_OUT, "#c9ccce");
			resolve(el);
		};
		img.onerror = reject;
		img.src = album.cover;
	});
}

function hexRgb(hex: string): [number, number, number] {
	const n = parseInt(hex.replace("#", ""), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbHex(r: number, g: number, b: number): string {
	const h = (v: number) =>
		Math.round(Math.max(0, Math.min(255, v)))
			.toString(16)
			.padStart(2, "0");
	return `#${h(r)}${h(g)}${h(b)}`;
}

/** the palette entry with the most colour in it — for a single accent */
function mostVibrant(palette: string[]): string | null {
	let best: string | null = null;
	let bestScore = -1;
	for (const hex of palette) {
		const [r, g, b] = hexRgb(hex);
		const max = Math.max(r, g, b);
		const min = Math.min(r, g, b);
		const score = (max - min) * (max / 255); // saturation × value
		if (score > bestScore) {
			bestScore = score;
			best = hex;
		}
	}
	return best;
}

function strokeRing(
	ctx: CanvasRenderingContext2D,
	radius: number,
	color: string,
	width: number,
) {
	ctx.save();
	ctx.beginPath();
	ctx.arc(C, C, radius, 0, Math.PI * 2);
	ctx.strokeStyle = color;
	ctx.lineWidth = width;
	ctx.stroke();
	ctx.restore();
}

/** set text glyph-by-glyph around a circle of the given radius */
function curvedText(
	ctx: CanvasRenderingContext2D,
	text: string,
	radius: number,
	color: string,
	startAngle: number,
	fontSize: number,
	flip = false,
) {
	ctx.save();
	ctx.fillStyle = color;
	ctx.font = `600 ${fontSize}px 'Commit Mono', ui-monospace, monospace`;
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	const per = (fontSize * 0.9) / radius; // angular step per glyph
	let angle = startAngle - ((text.length - 1) * per) / 2;
	for (const ch of text) {
		ctx.save();
		ctx.translate(C, C);
		ctx.rotate(flip ? -angle : angle);
		ctx.translate(0, flip ? radius : -radius);
		if (flip) ctx.rotate(Math.PI);
		ctx.fillText(ch, 0, 0);
		ctx.restore();
		angle += per;
	}
	ctx.restore();
}

/**
 * Pull a small ordered palette from a cover image: draw it tiny, bucket colours
 * into a coarse histogram, then greedily take the most-common ones that are far
 * enough apart to read as distinct swatches. Runs on the client the first time a
 * palette style renders. Resolves to [] on any failure — callers fall back to
 * the album's single dominant colour.
 */
export async function extractPalette(
	src: string,
	count = 6,
): Promise<string[]> {
	let img: CoverImage;
	try {
		img = await loadCoverBitmap(src);
	} catch {
		return [];
	}
	const n = 48;
	const el = document.createElement("canvas");
	el.width = el.height = n;
	const ctx = el.getContext("2d", { willReadFrequently: true });
	if (!ctx) return [];
	ctx.drawImage(img, 0, 0, n, n);
	const data = ctx.getImageData(0, 0, n, n).data;
	const buckets = new Map<
		number,
		{ r: number; g: number; b: number; n: number }
	>();
	for (let i = 0; i < data.length; i += 4) {
		if (data[i + 3] < 128) continue;
		const r = data[i],
			g = data[i + 1],
			b = data[i + 2];
		const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
		const e = buckets.get(key);
		if (e) {
			e.r += r;
			e.g += g;
			e.b += b;
			e.n++;
		} else buckets.set(key, { r, g, b, n: 1 });
	}
	const sorted = [...buckets.values()]
		.map((e) => ({ r: e.r / e.n, g: e.g / e.n, b: e.b / e.n, n: e.n }))
		.sort((a, b) => b.n - a.n);
	const chosen: { r: number; g: number; b: number }[] = [];
	for (const col of sorted) {
		if (chosen.length >= count) break;
		const far = chosen.every((c2) => {
			const dr = c2.r - col.r,
				dg = c2.g - col.g,
				db = c2.b - col.b;
			return dr * dr + dg * dg + db * db > 900; // ≥ ~30/channel apart
		});
		if (far) chosen.push(col);
	}
	return chosen.map((c2) => rgbHex(c2.r, c2.g, c2.b));
}

/** minimal print: title small near the hub, a lot of bare disc, one accent ring */
function cleanBase(album: CdAlbum, palette: string[]): HTMLCanvasElement {
	const el = canvas();
	const ctx = el.getContext("2d")!;
	clipDisc(ctx);
	ctx.fillStyle = album.color;
	ctx.fillRect(0, 0, SIZE, SIZE);
	ring(ctx, R_HUB, R_CLAMP, "#c9ccce");
	ring(ctx, R_EDGE, R_OUT, "#c9ccce");
	strokeRing(ctx, R_EDGE - 14, mostVibrant(palette) ?? album.color, 4);
	const ink = readable(album.color);
	ctx.fillStyle = ink;
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	fittedText(ctx, album.title.toLowerCase(), R_OUT * 1.18, 38, 24);
	// letterSpacing is honoured by modern canvas; harmless where it is not
	ctx.letterSpacing = "6px";
	ctx.fillText(album.title.toLowerCase(), C, C - R_CLAMP - 44, R_OUT * 1.2);
	ctx.letterSpacing = "0px";
	ctx.globalAlpha = 0.7;
	ctx.font = `400 24px 'Commit Mono', ui-monospace, monospace`;
	ctx.fillText(
		[album.artist, album.year].filter(Boolean).join(" · ").toLowerCase(),
		C,
		C + R_CLAMP + 38,
		R_OUT * 1.2,
	);
	ctx.globalAlpha = 1;
	return el;
}

/** concentric bands coloured from the cover palette — textless, unique per album */
function paletteBase(album: CdAlbum, palette: string[]): HTMLCanvasElement {
	const el = canvas();
	const ctx = el.getContext("2d")!;
	clipDisc(ctx);
	const cols = palette.length ? palette : [album.color];
	const bands = 6;
	for (let i = 0; i < bands; i++) {
		const inner = R_CLAMP + ((R_EDGE - R_CLAMP) * i) / bands;
		const outer = R_CLAMP + ((R_EDGE - R_CLAMP) * (i + 1)) / bands;
		ring(ctx, inner, outer, cols[i % cols.length]);
	}
	ring(ctx, R_HUB, R_CLAMP, "#c9ccce");
	ring(ctx, R_EDGE, R_OUT, "#c9ccce");
	return el;
}

/** editorial: title curved along the outer ring, artist along the inner */
function spiralBase(album: CdAlbum, palette: string[]): HTMLCanvasElement {
	const el = canvas();
	const ctx = el.getContext("2d")!;
	clipDisc(ctx);
	ctx.fillStyle = album.color;
	ctx.fillRect(0, 0, SIZE, SIZE);
	ring(ctx, R_HUB, R_CLAMP, "#c9ccce");
	ring(ctx, R_EDGE, R_OUT, "#c9ccce");
	const ink = readable(album.color);
	const accent = mostVibrant(palette);
	if (accent) strokeRing(ctx, R_EDGE - 16, accent, 3);
	curvedText(
		ctx,
		album.title.toUpperCase(),
		R_EDGE - 52,
		ink,
		-Math.PI / 2,
		44,
	);
	if (album.artist)
		curvedText(
			ctx,
			album.artist.toUpperCase(),
			R_CLAMP + 40,
			ink,
			Math.PI / 2,
			26,
			true,
		);
	return el;
}

/** cover art posterised to two palette tones — a screen-printed graphic */
function duotoneBase(
	album: CdAlbum,
	palette: string[],
): Promise<HTMLCanvasElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload = () => {
			// posterise on an offscreen buffer, then draw it into the clipped disc:
			// putImageData ignores the clip path, so it can't run on the disc canvas
			const buf = canvas();
			const bctx = buf.getContext("2d", { willReadFrequently: true })!;
			const s = Math.max(SIZE / img.width, SIZE / img.height);
			const w = img.width * s,
				h = img.height * s;
			bctx.drawImage(img, C - w / 2, C - h / 2, w, h);
			const frame = bctx.getImageData(0, 0, SIZE, SIZE);
			const d = frame.data;
			const [dr, dg, db] = hexRgb(palette[0] ?? "#141414");
			const [lr, lg, lb] = hexRgb(palette[1] ?? palette[0] ?? "#e8e8e8");
			for (let i = 0; i < d.length; i += 4) {
				const t = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
				d[i] = dr + (lr - dr) * t;
				d[i + 1] = dg + (lg - dg) * t;
				d[i + 2] = db + (lb - db) * t;
			}
			bctx.putImageData(frame, 0, 0);

			const el = canvas();
			const ctx = el.getContext("2d")!;
			clipDisc(ctx);
			ctx.drawImage(buf, 0, 0);
			ring(ctx, R_HUB, R_CLAMP, "#c9ccce");
			ring(ctx, R_EDGE, R_OUT, "#c9ccce");
			resolve(el);
		};
		img.onerror = reject;
		img.src = album.cover;
	});
}

/** small stable string hash (FNV-1a) — deterministic per album id */
function hashString(text: string): number {
	let h = 2166136261;
	for (let i = 0; i < text.length; i++) {
		h ^= text.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

/** seeded PRNG (mulberry32) so generative faces are stable per album */
function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** 0…1 saturation of a hex colour — drives the auto-assignment palette bias */
function saturationOf(hex: string): number {
	const [r, g, b] = hexRgb(hex).map((v) => v / 255);
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	return max === 0 ? 0 : (max - min) / max;
}

/**
 * Realistic pressed CD: a brushed-silver face with a faint rainbow data groove
 * in the outer half, a printed title on the inner silver, catalog microtype at
 * the clamp, and rim text with registration ticks. The rainbow is drawn (not a
 * material effect) so the style renders identically on the wall and in proto.
 */
function pressedBase(album: CdAlbum, palette: string[]): HTMLCanvasElement {
	const el = canvas();
	const ctx = el.getContext("2d")!;
	clipDisc(ctx);
	const face = ctx.createRadialGradient(C, C, R_CLAMP, C, C, R_OUT);
	face.addColorStop(0, "#d9dbdf");
	face.addColorStop(1, "#c1c4c9");
	ctx.fillStyle = face;
	ctx.fillRect(0, 0, SIZE, SIZE);
	// data groove: thin hue-cycling rings across the outer half only
	const grooveIn = C * 0.53;
	const grooveOut = R_EDGE - 14;
	for (let r = grooveIn; r < grooveOut; r += 2) {
		const t = (r - grooveIn) / (grooveOut - grooveIn);
		ctx.beginPath();
		ctx.arc(C, C, r, 0, Math.PI * 2);
		ctx.strokeStyle = `hsl(${(t * 560) % 360} 72% 58% / 0.07)`;
		ctx.lineWidth = 2;
		ctx.stroke();
	}
	const accent = mostVibrant(palette) ?? album.color;
	strokeRing(ctx, grooveIn - 6, accent, 3);
	// brighter clamp + edge rings
	ring(ctx, R_HUB, R_CLAMP, "#e6e8ea");
	ring(ctx, R_EDGE - 8, R_OUT, "#e6e8ea");
	strokeRing(ctx, R_CLAMP, "#9aa0a6", 2);
	strokeRing(ctx, R_EDGE - 8, "#9aa0a6", 2);
	// catalog microtype pressed around the clamp
	curvedText(
		ctx,
		`CAT ${(hashString(album.id) % 9000) + 1000} · ${album.year ?? "—"}`,
		R_CLAMP + 20,
		"#6b7075",
		-Math.PI / 2,
		20,
	);
	// printed title + artist on the inner silver, readable at rest
	ctx.fillStyle = "#1a1c1e";
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	fittedText(ctx, album.title.toUpperCase(), C * 0.9, 52, 28);
	ctx.fillText(album.title.toUpperCase(), C, C - 118, C * 0.9);
	if (album.artist) {
		ctx.globalAlpha = 0.7;
		ctx.font = `500 28px 'Commit Mono', ui-monospace, monospace`;
		ctx.fillText(album.artist.toUpperCase(), C, C - 80, C * 0.82);
		ctx.globalAlpha = 1;
	}
	// rim text + registration ticks
	curvedText(
		ctx,
		"COMPACT DISC  ·  DIGITAL AUDIO  ·  SIDE A",
		R_EDGE - 30,
		"#565b60",
		Math.PI / 2,
		19,
		true,
	);
	for (const a of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
		ctx.save();
		ctx.translate(C, C);
		ctx.rotate(a);
		ctx.fillStyle = "#6b7075";
		ctx.fillRect(-2, -(R_EDGE - 20), 4, 13);
		ctx.restore();
	}
	return el;
}

/** cover art as a one-tone halftone dot screen — a screen-printed graphic */
function halftoneBase(
	album: CdAlbum,
	palette: string[],
	options: HalftoneOptions = DEFAULT_HALFTONE_OPTIONS,
	cleanLabel = false,
): Promise<HTMLCanvasElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload = () => {
			const n = Math.max(12, Math.round(options.density));
			const buf = document.createElement("canvas");
			buf.width = buf.height = n;
			const bctx = buf.getContext("2d", { willReadFrequently: true })!;
			const s = Math.max(n / img.width, n / img.height);
			const w = img.width * s,
				h = img.height * s;
			bctx.drawImage(img, n / 2 - w / 2, n / 2 - h / 2, w, h);
			const data = bctx.getImageData(0, 0, n, n).data;

			const el = canvas();
			const ctx = el.getContext("2d")!;
			clipDisc(ctx);
			ctx.fillStyle = album.color;
			ctx.fillRect(0, 0, SIZE, SIZE);
			const ink =
				mostVibrant(palette) ??
				(readable(album.color) === "#1a1a1a" ? "#141414" : "#f0f0f0");
			ctx.fillStyle = ink;
			const cell = SIZE / n;
			for (let y = 0; y < n; y++) {
				for (let x = 0; x < n; x++) {
					const i = (y * n + x) * 4;
					const lum =
						(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) /
						255;
					const contrasted = Math.max(
						0,
						Math.min(1, 0.5 + (lum - 0.5) * options.contrast),
					);
					const rad = (cell / 2) * Math.sqrt(1 - contrasted) * options.dotScale;
					if (rad < 0.4) continue;
					ctx.beginPath();
					ctx.arc(
						x * cell + cell / 2,
						y * cell + cell / 2,
						rad,
						0,
						Math.PI * 2,
					);
					ctx.globalAlpha = Math.max(0, Math.min(1, options.inkOpacity));
					ctx.fill();
				}
			}
			ctx.globalAlpha = 1;
			ring(ctx, R_HUB, R_CLAMP, "#c9ccce");
			ring(ctx, R_EDGE, R_OUT, "#c9ccce");
			const inkColor = readable(album.color);
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.fillStyle = inkColor;
			if (cleanLabel) {
				// The clean label contributes one precise accent ring and a quiet type
				// lockup; the halftone stays the image-making layer underneath it.
				strokeRing(ctx, R_EDGE - 14, mostVibrant(palette) ?? album.color, 4);
				fittedText(ctx, album.title.toLowerCase(), R_OUT * 1.18, 38, 24);
				ctx.letterSpacing = "6px";
				ctx.fillText(
					album.title.toLowerCase(),
					C,
					C - R_CLAMP - 44,
					R_OUT * 1.2,
				);
				ctx.letterSpacing = "0px";
				const sub = [album.artist, album.year]
					.filter(Boolean)
					.join(" · ")
					.toLowerCase();
				if (sub) {
					ctx.globalAlpha = 0.7;
					ctx.font = `400 24px 'Commit Mono', ui-monospace, monospace`;
					ctx.fillText(sub, C, C + R_CLAMP + 38, R_OUT * 1.2);
				}
			} else {
				// The original halftone lockup gets a small paper-colour halo so it
				// remains readable over dense dots.
				fittedText(ctx, album.title.toLowerCase(), R_OUT * 1.1, 40, 24);
				ctx.lineJoin = "round";
				ctx.strokeStyle = album.color;
				ctx.lineWidth = 7;
				ctx.strokeText(
					album.title.toLowerCase(),
					C,
					C - R_CLAMP - 46,
					R_OUT * 1.1,
				);
				ctx.fillText(
					album.title.toLowerCase(),
					C,
					C - R_CLAMP - 46,
					R_OUT * 1.1,
				);
				const sub = [album.artist, album.year]
					.filter(Boolean)
					.join(" · ")
					.toLowerCase();
				if (sub) {
					ctx.font = `400 24px 'Commit Mono', ui-monospace, monospace`;
					ctx.lineWidth = 6;
					ctx.strokeText(sub, C, C + R_CLAMP + 42, R_OUT);
					ctx.globalAlpha = 0.85;
					ctx.fillText(sub, C, C + R_CLAMP + 42, R_OUT);
				}
			}
			ctx.globalAlpha = 1;
			resolve(el);
		};
		img.onerror = reject;
		img.src = album.cover;
	});
}

/**
 * The cover transcoded to a glyph field, matching the home hero's quality: it
 * reuses the hero's coverage-equalized glyph atlas (so midtones read as
 * perceptually-linear tone, not a crushed ramp) and colours every glyph from the
 * album's own pixels over a dim wash of the cover — no green, the record's own
 * palette. A gamma/contrast curve plus an ordered dither keep gradients smooth.
 */
// 4×4 Bayer threshold matrix, values 0..15 — breaks tone banding
const BAYER_4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const ASCII_GAMMA = 0.9;
const ASCII_CONTRAST = 1.15;

// The perceptually-linear glyph ramp (sparse→dense) is built once from the hero
// atlas and reused for every album; the atlas handles font loading + coverage.
let asciiRampPromise: Promise<string> | null = null;
function asciiRamp(): Promise<string> {
	if (!asciiRampPromise)
		asciiRampPromise = buildGlyphAtlas().then((atlas) => atlas.charset);
	return asciiRampPromise;
}

async function asciiBase(
	album: CdAlbum,
	palette: string[],
): Promise<HTMLCanvasElement> {
	const ramp = await asciiRamp(); // sparse → dense, perceptually linear
	const last = ramp.length - 1;
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload = () => {
			const n = 92; // glyph cells across the cover — dense, hero-like
			const buf = document.createElement("canvas");
			buf.width = buf.height = n;
			const bctx = buf.getContext("2d", { willReadFrequently: true })!;
			const s = Math.max(n / img.width, n / img.height);
			const w = img.width * s,
				h = img.height * s;
			bctx.drawImage(img, n / 2 - w / 2, n / 2 - h / 2, w, h);
			const data = bctx.getImageData(0, 0, n, n).data;

			const el = canvas();
			const ctx = el.getContext("2d")!;
			clipDisc(ctx);
			// paper: near-black, faintly warmed by the album colour
			const [ar, ag, ab] = hexRgb(album.color);
			ctx.fillStyle = rgbHex(ar * 0.12 + 7, ag * 0.12 + 8, ab * 0.12 + 7);
			ctx.fillRect(0, 0, SIZE, SIZE);
			// colour floor: a dim wash of the actual cover, so the glyphs sit in the
			// album's real palette the way the hero glyphs sit in the photo
			ctx.save();
			ctx.globalAlpha = 0.22;
			const cs = Math.max(SIZE / img.width, SIZE / img.height);
			const cw = img.width * cs,
				chh = img.height * cs;
			ctx.drawImage(img, C - cw / 2, C - chh / 2, cw, chh);
			ctx.restore();

			const cell = SIZE / n;
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.font = `${Math.round(cell * 1.15)}px 'Commit Mono', ui-monospace, monospace`;
			for (let y = 0; y < n; y++) {
				for (let x = 0; x < n; x++) {
					const i = (y * n + x) * 4;
					const r = data[i],
						g = data[i + 1],
						b = data[i + 2];
					let lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
					lum = Math.pow(lum, ASCII_GAMMA);
					lum = 0.5 + (lum - 0.5) * ASCII_CONTRAST;
					const th = (BAYER_4[(y % 4) * 4 + (x % 4)] + 0.5) / 16 - 0.5;
					const l = Math.max(0, Math.min(1, lum + th / last));
					const ch = ramp[Math.round(l * last)];
					if (ch === " ") continue;
					// tint the glyph with the album's own colour at this cell, lifted so
					// even dark-but-saturated regions keep a legible, coloured glyph
					const boost = 0.6 + 0.6 * l;
					ctx.fillStyle = rgbHex(
						r * boost + 70,
						g * boost + 72,
						b * boost + 66,
					);
					ctx.fillText(ch, x * cell + cell / 2, y * cell + cell / 2);
				}
			}
			// CD anatomy, kept dark so the glyph field stays the subject
			const rim = rgbHex(ar * 0.16 + 10, ag * 0.16 + 11, ab * 0.16 + 10);
			ring(ctx, R_HUB, R_CLAMP, rim);
			ring(ctx, R_EDGE, R_OUT, rim);
			const accent = mostVibrant(palette) ?? album.color;
			strokeRing(ctx, R_EDGE - 6, accent, 2);
			// metadata, haloed in the paper colour so it stays legible over the glyphs
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.lineJoin = "round";
			ctx.strokeStyle = rgbHex(ar * 0.12 + 7, ag * 0.12 + 8, ab * 0.12 + 7);
			fittedText(ctx, album.title.toLowerCase(), R_OUT * 1.1, 40, 24);
			ctx.lineWidth = 9;
			ctx.strokeText(
				album.title.toLowerCase(),
				C,
				C - R_CLAMP - 46,
				R_OUT * 1.1,
			);
			ctx.fillStyle = "#eef2ee";
			ctx.fillText(album.title.toLowerCase(), C, C - R_CLAMP - 46, R_OUT * 1.1);
			const sub = [album.artist, album.year]
				.filter(Boolean)
				.join(" · ")
				.toLowerCase();
			if (sub) {
				ctx.font = `400 24px 'Commit Mono', ui-monospace, monospace`;
				ctx.lineWidth = 7;
				ctx.strokeText(sub, C, C + R_CLAMP + 42, R_OUT);
				ctx.fillStyle = accent;
				ctx.fillText(sub, C, C + R_CLAMP + 42, R_OUT);
			}
			resolve(el);
		};
		img.onerror = reject;
		img.src = album.cover;
	});
}

const BAYER_8 = [
	0, 48, 12, 60, 3, 51, 15, 63, 32, 16, 44, 28, 35, 19, 47, 31, 8, 56, 4, 52,
	11, 59, 7, 55, 40, 24, 36, 20, 43, 27, 39, 23, 2, 50, 14, 62, 1, 49, 13, 61,
	34, 18, 46, 30, 33, 17, 45, 29, 10, 58, 6, 54, 9, 57, 5, 53, 42, 26, 38, 22,
	41, 25, 37, 21,
];

async function ditherBase(
	album: CdAlbum,
	palette: string[],
	options: DitherDiscOptions = DEFAULT_DITHER_DISC_OPTIONS,
): Promise<HTMLCanvasElement> {
	const img = await loadCoverBitmap(album.cover);
	const n = options.density;
	const buf = document.createElement("canvas");
	buf.width = buf.height = n;
	const bctx = buf.getContext("2d", { willReadFrequently: true })!;
	const s = Math.max(n / img.width, n / img.height);
	const w = img.width * s,
		h = img.height * s;
	bctx.drawImage(img, n / 2 - w / 2, n / 2 - h / 2, w, h);
	const pixels = bctx.getImageData(0, 0, n, n).data;

	const el = canvas();
	const ctx = el.getContext("2d")!;
	clipDisc(ctx);

	// Determine light and dark colors
	let lightColor: [number, number, number] = [255, 255, 255];
	let darkColor: [number, number, number] = [0, 0, 0];

	const [ar, ag, ab] = hexRgb(album.color);

	if (options.colorMode === "bw") {
		lightColor = [245, 245, 245];
		darkColor = [10, 10, 10];
	} else if (options.colorMode === "album") {
		const ink = mostVibrant(palette) ?? album.color;
		lightColor = hexRgb(ink);
		darkColor = [
			Math.round(ar * 0.08),
			Math.round(ag * 0.08),
			Math.round(ab * 0.08),
		];
	} else if (options.colorMode === "green") {
		lightColor = [139, 172, 15]; // GameBoy light green
		darkColor = [15, 30, 18]; // GameBoy dark green
	} else if (options.colorMode === "amber") {
		lightColor = [255, 176, 0]; // Amber phosphor
		darkColor = [21, 10, 0]; // Dark amber
	}

	// Resolve the dither at its own resolution — one pixel per cell — then blow
	// it up nearest-neighbour. Painting each cell as its own fillRect meant
	// density² canvas ops (65k per album at 256), which is what made warming a
	// disc face expensive; a single scaled blit draws the identical hard-edged
	// blocks. The source buffer is reusable: `pixels` above is already a copy.
	const out = new ImageData(n, n);
	const cells = out.data;
	for (let y = 0; y < n; y++) {
		for (let x = 0; x < n; x++) {
			const i = (y * n + x) * 4;
			const r = pixels[i];
			const g = pixels[i + 1];
			const b = pixels[i + 2];
			const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

			// Apply contrast around 0.5 midpoint
			const adjusted = (lum - 0.5) * options.contrast + 0.5;

			// Get 8x8 Bayer threshold value mapped to 0..1
			const th = (BAYER_8[(y % 8) * 8 + (x % 8)] + 0.5) / 64;

			const ink = adjusted > th ? lightColor : darkColor;
			cells[i] = ink[0];
			cells[i + 1] = ink[1];
			cells[i + 2] = ink[2];
			cells[i + 3] = 255;
		}
	}
	bctx.putImageData(out, 0, 0);
	// the clip keeps everything outside the disc transparent, as before
	ctx.imageSmoothingEnabled = false;
	ctx.drawImage(buf, 0, 0, SIZE, SIZE);

	// CD anatomy
	clearRing(ctx, R_HUB, R_CLAMP);
	clearRing(ctx, R_EDGE, R_OUT);
	const accent = mostVibrant(palette) ?? album.color;
	strokeRing(ctx, R_EDGE - 6, accent, 2);

	return el;
}

/** textless generative mandala: palette-seeded segmented rings + rays */
function geoBase(album: CdAlbum, palette: string[]): HTMLCanvasElement {
	const el = canvas();
	const ctx = el.getContext("2d")!;
	clipDisc(ctx);
	const cols = palette.length ? palette : [album.color];
	const rnd = mulberry32(hashString(album.id));
	const [r, g, b] = hexRgb(album.color);
	ctx.fillStyle = rgbHex(r * 0.35, g * 0.35, b * 0.35);
	ctx.fillRect(0, 0, SIZE, SIZE);
	const rings = 4 + Math.floor(rnd() * 3);
	for (let k = 0; k < rings; k++) {
		const inner = R_CLAMP + ((R_EDGE - R_CLAMP) * k) / rings;
		const outer = R_CLAMP + ((R_EDGE - R_CLAMP) * (k + 0.74)) / rings;
		const seg = 4 + Math.floor(rnd() * 9);
		const rot = rnd() * Math.PI * 2;
		const gap = 0.14 + rnd() * 0.42;
		for (let s = 0; s < seg; s++) {
			const a0 = rot + (s / seg) * Math.PI * 2;
			const a1 = a0 + (Math.PI * 2 * (1 - gap)) / seg;
			ctx.beginPath();
			ctx.arc(C, C, outer, a0, a1);
			ctx.arc(C, C, inner, a1, a0, true);
			ctx.closePath();
			ctx.fillStyle = cols[(k + s) % cols.length];
			ctx.globalAlpha = 0.86;
			ctx.fill();
		}
	}
	ctx.globalAlpha = 0.5;
	ctx.strokeStyle = cols[0];
	ctx.lineWidth = 2;
	const rays = 8 + Math.floor(rnd() * 10);
	for (let i = 0; i < rays; i++) {
		const a = (i / rays) * Math.PI * 2 + rnd() * 0.1;
		ctx.beginPath();
		ctx.moveTo(C + Math.cos(a) * R_CLAMP, C + Math.sin(a) * R_CLAMP);
		ctx.lineTo(C + Math.cos(a) * (R_EDGE - 6), C + Math.sin(a) * (R_EDGE - 6));
		ctx.stroke();
	}
	ctx.globalAlpha = 1;
	ring(ctx, R_HUB, R_CLAMP, "#c9ccce");
	ring(ctx, R_EDGE, R_OUT, "#c9ccce");
	return el;
}

/** editorial ticker: the title repeated as a continuous curved band */
function marqueeBase(album: CdAlbum, palette: string[]): HTMLCanvasElement {
	const el = canvas();
	const ctx = el.getContext("2d")!;
	clipDisc(ctx);
	ctx.fillStyle = album.color;
	ctx.fillRect(0, 0, SIZE, SIZE);
	ring(ctx, R_HUB, R_CLAMP, "#c9ccce");
	ring(ctx, R_EDGE, R_OUT, "#c9ccce");
	const ink = readable(album.color);
	const accent = mostVibrant(palette);
	if (accent) strokeRing(ctx, R_EDGE - 16, accent, 3);
	// build a repeated ticker long enough to close the ring at this radius
	const radius = R_EDGE - 48;
	const fontSize = 40;
	const per = (fontSize * 0.9) / radius;
	const glyphs = Math.floor((Math.PI * 2) / per);
	const unit = ` ${album.title.toUpperCase()}   ·  `;
	let ticker = "";
	while (ticker.length < glyphs) ticker += unit;
	curvedText(ctx, ticker.slice(0, glyphs), radius, ink, -Math.PI / 2, fontSize);
	ctx.fillStyle = ink;
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	if (album.artist) {
		ctx.globalAlpha = 0.9;
		ctx.font = `600 30px 'Commit Mono', ui-monospace, monospace`;
		ctx.fillText(album.artist.toUpperCase(), C, C - 108, R_CLAMP * 1.4);
	}
	if (album.year) {
		ctx.globalAlpha = 0.65;
		ctx.font = `500 26px 'Commit Mono', ui-monospace, monospace`;
		ctx.fillText(album.year, C, C + 108, R_CLAMP * 1.4);
	}
	ctx.globalAlpha = 1;
	return el;
}

/** monospace card-catalog grid: stacked lowercase title over a baseline grid */
function indexBase(album: CdAlbum, palette: string[]): HTMLCanvasElement {
	const el = canvas();
	const ctx = el.getContext("2d")!;
	clipDisc(ctx);
	const paper = readable(album.color) === "#1a1a1a" ? "#15110b" : "#f2efe7";
	ctx.fillStyle = paper;
	ctx.fillRect(0, 0, SIZE, SIZE);
	const ink = readable(paper);
	const accent = mostVibrant(palette) ?? album.color;
	// hairline baseline grid
	ctx.strokeStyle = translucent(ink, 0.14);
	ctx.lineWidth = 1;
	for (let y = C - 170; y <= C + 190; y += 34) {
		ctx.beginPath();
		ctx.moveTo(C - 250, y);
		ctx.lineTo(C + 250, y);
		ctx.stroke();
	}
	// margin rule, like the red line on an index card
	ctx.strokeStyle = accent;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(C - 150, C - 200);
	ctx.lineTo(C - 150, C + 210);
	ctx.stroke();
	// stacked lowercase title, left-aligned to the margin
	ctx.fillStyle = ink;
	ctx.textAlign = "left";
	ctx.textBaseline = "alphabetic";
	const words = album.title.toLowerCase().split(/\s+/).filter(Boolean);
	const lineH = 68;
	let baseY = C - 150 + ((3 - Math.min(words.length, 3)) * lineH) / 2;
	for (const word of words.slice(0, 3)) {
		fittedText(ctx, word, 348, 60, 30);
		ctx.fillText(word, C - 130, baseY, 348);
		baseY += lineH;
	}
	// year as a coordinate + artist
	ctx.font = `500 26px 'Commit Mono', ui-monospace, monospace`;
	ctx.globalAlpha = 0.75;
	if (album.year) ctx.fillText(`№ ${album.year}`, C - 130, C + 158, 348);
	if (album.artist) {
		ctx.globalAlpha = 0.6;
		ctx.font = `400 24px 'Commit Mono', ui-monospace, monospace`;
		ctx.fillText(album.artist.toLowerCase(), C - 130, C + 194, 348);
	}
	ctx.globalAlpha = 1;
	ring(ctx, R_HUB, R_CLAMP, "#c9ccce");
	ring(ctx, R_EDGE, R_OUT, "#c9ccce");
	return el;
}

/**
 * The curated auto-assignment pools. Vibrant covers lean graphic/photographic;
 * muted covers lean typographic/realistic. A stable hash of the album id picks
 * within the biased pool, so every album gets a distinct-but-fixed face.
 */
const VIBRANT_POOL: DiscStyle[] = [
	"halftone",
	"halftone-clean",
	"duotone",
	"marquee",
	"geo",
	"ascii",
	"dither",
];
const MUTED_POOL: DiscStyle[] = ["pressed", "index", "clean", "catalog"];

/**
 * Hybrid per-album disc face: an explicit `album.discStyle` wins; otherwise a
 * deterministic hash of the id indexes a palette-biased pool. Pure and
 * DOM-free, so it is safe to call anywhere and is unit-testable.
 */
export function pickDiscStyle(album: CdAlbum): DiscStyle {
	if (album.discStyle) return album.discStyle;
	const pool = saturationOf(album.color) >= 0.32 ? VIBRANT_POOL : MUTED_POOL;
	return pool[hashString(album.id) % pool.length];
}

const EMPTY: DiscMaps = {
	map: null,
	dispose() {},
};

/** Build the disc maps for a style; async only because "art" loads the cover. */
export async function createDiscMaps(
	style: DiscStyle,
	album: CdAlbum,
	options: HalftoneOptions = DEFAULT_HALFTONE_OPTIONS,
	ditherOptions: DitherDiscOptions = DEFAULT_DITHER_DISC_OPTIONS,
): Promise<DiscMaps> {
	if (style === "mirror") return EMPTY;
	// mirror already returned above; every remaining style derives an accent
	// palette from the cover (cheap and cached by the browser image decode).
	const palette = await extractPalette(album.cover);
	let base: HTMLCanvasElement;
	switch (style) {
		case "catalog":
			base = catalogBase(album, palette);
			break;
		case "art":
			base = await artBase(album);
			break;
		case "color":
			base = colorBase(album);
			break;
		case "clean":
			base = cleanBase(album, palette);
			break;
		case "palette":
			base = paletteBase(album, palette);
			break;
		case "spiral":
			base = spiralBase(album, palette);
			break;
		case "duotone":
			base = await duotoneBase(album, palette);
			break;
		case "pressed":
			base = pressedBase(album, palette);
			break;
		case "halftone":
			base = await halftoneBase(album, palette, options);
			break;
		case "halftone-clean":
			base = await halftoneBase(album, palette, options, true);
			break;
		case "geo":
			base = geoBase(album, palette);
			break;
		case "marquee":
			base = marqueeBase(album, palette);
			break;
		case "index":
			base = indexBase(album, palette);
			break;
		case "ascii":
			base = await asciiBase(album, palette);
			break;
		case "dither":
			base = await ditherBase(album, palette, ditherOptions);
			break;
		default:
			base = labelBase(album);
	}
	const map = texture(base, true);
	const maps: DiscMaps = {
		map,
		dispose() {
			map.dispose();
		},
	};
	return maps;
}
