import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { toCdAlbums } from "$lib/cd-wall/albums";
import { music } from "$lib/content";
import type { PageServerLoad } from "./$types";

// Resolve from the project root so this also works after SvelteKit bundles the
// server module into .svelte-kit/output during a production build.
const hdriDirectory = resolve(process.cwd(), "static/hdri");

export const load: PageServerLoad = () => {
	try {
		return {
			albums: toCdAlbums(music),
			hdris: readdirSync(hdriDirectory)
				.filter((file) => /\.(hdr|exr|jpe?g)$/i.test(file))
				.sort((a, b) => a.localeCompare(b)),
		};
	} catch {
		return { albums: toCdAlbums(music), hdris: [] };
	}
};
