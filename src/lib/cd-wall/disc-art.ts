import { CanvasTexture, SRGBColorSpace } from "three";
import type { CdAlbum } from "./albums";

/**
 * Disc-face treatments, previewable in /proto/cd-case. A real CD is two
 * surfaces: a matte printed LABEL and a shiny mirror DATA ring — so a style is
 * not one image but a (colour, metalness, roughness) triple of canvas maps that
 * let the label read as print while the rings still glint. "mirror" returns no
 * maps and falls back to the material's own iridescent metal.
 */
export type DiscStyle =
	| "mirror"
	| "label"
	| "art"
	| "color"
	| "clean"
	| "palette"
	| "spiral"
	| "duotone";

export const DISC_STYLES: { value: DiscStyle; label: string; hint: string }[] =
	[
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
	metalnessMap: CanvasTexture | null;
	roughnessMap: CanvasTexture | null;
	dispose(): void;
}

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

function texture(el: HTMLCanvasElement, srgb: boolean): CanvasTexture {
	const tex = new CanvasTexture(el);
	if (srgb) tex.colorSpace = SRGBColorSpace;
	tex.needsUpdate = true;
	return tex;
}

/**
 * metalness/roughness share a layout: the printed label (hub→edge) is matte, the
 * clamp ring and outer rim are mirror. White = shiny/smooth, black = matte/rough.
 */
function metalCanvas() {
	const el = canvas();
	const ctx = el.getContext("2d")!;
	ctx.fillStyle = "#000"; // matte print everywhere by default
	ctx.fillRect(0, 0, SIZE, SIZE);
	ring(ctx, R_HUB, R_CLAMP, "#fff"); // shiny clamp ring by the hub
	ring(ctx, R_EDGE, R_OUT, "#fff"); // shiny outer rim
	return el;
}

function roughCanvas() {
	const el = canvas();
	const ctx = el.getContext("2d")!;
	ctx.fillStyle = "#cfcfcf"; // matte label: rough
	ctx.fillRect(0, 0, SIZE, SIZE);
	ring(ctx, R_HUB, R_CLAMP, "#0a0a0a"); // rings: near-mirror smooth
	ring(ctx, R_EDGE, R_OUT, "#0a0a0a");
	return el;
}

function readable(hex: string) {
	const n = parseInt(hex.replace("#", ""), 16);
	const r = (n >> 16) & 255,
		g = (n >> 8) & 255,
		b = n & 255;
	// perceived luminance → pick black or white text for contrast
	return 0.2126 * r + 0.7152 * g + 0.0722 * b > 140 ? "#1a1a1a" : "#f2f2f2";
}

/** the modeled disc samples its face mirrored, so pre-flip text/art here */
function mirrorX(ctx: CanvasRenderingContext2D) {
	ctx.translate(SIZE, 0);
	ctx.scale(-1, 1);
}

function labelBase(album: CdAlbum): HTMLCanvasElement {
	const el = canvas();
	const ctx = el.getContext("2d")!;
	mirrorX(ctx);
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
	// title + artist, set just outside the clamp ring
	const ink = readable(album.color);
	ctx.fillStyle = ink;
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.font = `600 46px 'Commit Mono', ui-monospace, monospace`;
	ctx.fillText(album.title.toLowerCase(), C, C - R_CLAMP - 46, R_OUT * 1.3);
	if (album.artist) {
		ctx.globalAlpha = 0.7;
		ctx.font = `400 34px 'Commit Mono', ui-monospace, monospace`;
		ctx.fillText(album.artist.toLowerCase(), C, C + R_CLAMP + 46, R_OUT * 1.3);
		ctx.globalAlpha = 1;
	}
	return el;
}

function colorBase(album: CdAlbum): HTMLCanvasElement {
	const el = canvas();
	const ctx = el.getContext("2d")!;
	mirrorX(ctx);
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
			mirrorX(ctx);
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
export function extractPalette(src: string, count = 6): Promise<string[]> {
	return new Promise((resolve) => {
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload = () => {
			const n = 48;
			const el = document.createElement("canvas");
			el.width = el.height = n;
			const ctx = el.getContext("2d", { willReadFrequently: true });
			if (!ctx) return resolve([]);
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
			resolve(chosen.map((c2) => rgbHex(c2.r, c2.g, c2.b)));
		};
		img.onerror = () => resolve([]);
		img.src = src;
	});
}

/** minimal print: title small near the hub, a lot of bare disc, one accent ring */
function cleanBase(album: CdAlbum, palette: string[]): HTMLCanvasElement {
	const el = canvas();
	const ctx = el.getContext("2d")!;
	mirrorX(ctx);
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
	ctx.font = `500 34px 'Commit Mono', ui-monospace, monospace`;
	// letterSpacing is honoured by modern canvas; harmless where it is not
	ctx.letterSpacing = "6px";
	ctx.fillText(album.title.toLowerCase(), C, C - R_CLAMP - 44, R_OUT * 1.2);
	ctx.letterSpacing = "0px";
	return el;
}

/** concentric bands coloured from the cover palette — textless, unique per album */
function paletteBase(album: CdAlbum, palette: string[]): HTMLCanvasElement {
	const el = canvas();
	const ctx = el.getContext("2d")!;
	mirrorX(ctx);
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
	mirrorX(ctx);
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
			mirrorX(ctx);
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

const EMPTY: DiscMaps = {
	map: null,
	metalnessMap: null,
	roughnessMap: null,
	dispose() {},
};

/** Build the disc maps for a style; async only because "art" loads the cover. */
export async function createDiscMaps(
	style: DiscStyle,
	album: CdAlbum,
): Promise<DiscMaps> {
	if (style === "mirror") return EMPTY;
	const needsPalette =
		style === "clean" ||
		style === "palette" ||
		style === "spiral" ||
		style === "duotone";
	const palette = needsPalette ? await extractPalette(album.cover) : [];
	let base: HTMLCanvasElement;
	switch (style) {
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
		default:
			base = labelBase(album);
	}
	const map = texture(base, true);
	const metalnessMap = texture(metalCanvas(), false);
	const roughnessMap = texture(roughCanvas(), false);
	const maps: DiscMaps = {
		map,
		metalnessMap,
		roughnessMap,
		dispose() {
			map.dispose();
			metalnessMap.dispose();
			roughnessMap.dispose();
		},
	};
	return maps;
}
