import { CanvasTexture, SRGBColorSpace } from "three";
import type { CdAlbum } from "./albums";

/**
 * Disc-face treatments, previewable in /proto/cd-case. A real CD is two
 * surfaces: a matte printed LABEL and a shiny mirror DATA ring — so a style is
 * not one image but a (colour, metalness, roughness) triple of canvas maps that
 * let the label read as print while the rings still glint. "mirror" returns no
 * maps and falls back to the material's own iridescent metal.
 */
export type DiscStyle = "mirror" | "label" | "art" | "color";

export const DISC_STYLES: { value: DiscStyle; label: string; hint: string }[] =
	[
		{
			value: "mirror",
			label: "iridescent mirror",
			hint: "Bare reflective disc — lets the HDR glints be the star.",
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
	const base =
		style === "art"
			? await artBase(album)
			: style === "color"
				? colorBase(album)
				: labelBase(album);
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
