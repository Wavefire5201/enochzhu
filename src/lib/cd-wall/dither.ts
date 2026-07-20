import { CanvasTexture, NearestFilter, SRGBColorSpace } from "three";

export interface DitherOptions {
	enabled: boolean;
	resolution: number;
	colorMode: "bw" | "album" | "green" | "amber";
	contrast: number;
}

export function ditherImage(
	img: HTMLImageElement,
	albumColor: string,
	options: DitherOptions,
): HTMLCanvasElement {
	const res = options.resolution;
	const canvas = document.createElement("canvas");
	canvas.width = res;
	canvas.height = res;
	const ctx = canvas.getContext("2d")!;

	// Draw the image to the canvas to scale it
	ctx.drawImage(img, 0, 0, res, res);
	const imgData = ctx.getImageData(0, 0, res, res);
	const pixels = imgData.data;

	// Determine light and dark colors
	let lightColor: [number, number, number] = [255, 255, 255];
	let darkColor: [number, number, number] = [0, 0, 0];

	if (options.colorMode === "album") {
		lightColor = hexRgb(albumColor);
		const [r, g, b] = lightColor;
		// Make a very dark version of the album color
		darkColor = [
			Math.round(r * 0.08),
			Math.round(g * 0.08),
			Math.round(b * 0.08),
		];
	} else if (options.colorMode === "green") {
		lightColor = [139, 172, 15]; // GameBoy light green
		darkColor = [15, 30, 18]; // GameBoy dark forest green
	} else if (options.colorMode === "amber") {
		lightColor = [255, 176, 0]; // Amber phosphor
		darkColor = [21, 10, 0]; // Dark amber
	}

	// 8x8 Bayer Threshold Matrix
	const BAYER_8 = [
		0, 48, 12, 60, 3, 51, 15, 63, 32, 16, 44, 28, 35, 19, 47, 31, 8, 56, 4, 52,
		11, 59, 7, 55, 40, 24, 36, 20, 43, 27, 39, 23, 2, 50, 14, 62, 1, 49, 13, 61,
		34, 18, 46, 30, 33, 17, 45, 29, 10, 58, 6, 54, 9, 57, 5, 53, 42, 26, 38, 22,
		41, 25, 37, 21,
	];

	for (let y = 0; y < res; y++) {
		for (let x = 0; x < res; x++) {
			const i = (y * res + x) * 4;
			const r = pixels[i];
			const g = pixels[i + 1];
			const b = pixels[i + 2];
			const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

			// Adjust contrast around 0.5 midpoint
			const adjusted = (lum - 0.5) * options.contrast + 0.5;

			// Get Bayer threshold value mapped to 0..1
			const th = (BAYER_8[(y % 8) * 8 + (x % 8)] + 0.5) / 64;

			const isLight = adjusted > th;
			const [cr, cg, cb] = isLight ? lightColor : darkColor;

			pixels[i] = cr;
			pixels[i + 1] = cg;
			pixels[i + 2] = cb;
			pixels[i + 3] = 255; // Keep opaque
		}
	}

	ctx.putImageData(imgData, 0, 0);
	return canvas;
}

export function loadDitheredTexture(
	src: string,
	albumColor: string,
	options: DitherOptions,
	anisotropy: number,
): Promise<CanvasTexture> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload = () => {
			const canvas = ditherImage(img, albumColor, options);
			const texture = new CanvasTexture(canvas);
			texture.colorSpace = SRGBColorSpace;
			texture.minFilter = NearestFilter;
			texture.magFilter = NearestFilter;
			texture.anisotropy = anisotropy;
			texture.needsUpdate = true;
			resolve(texture);
		};
		img.onerror = (err) => {
			reject(err);
		};
		img.src = src;
	});
}

function hexRgb(hex: string): [number, number, number] {
	const clean = hex.replace("#", "");
	const n = parseInt(clean, 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
