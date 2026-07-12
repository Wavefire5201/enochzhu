import adapter from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { mdsvex } from "mdsvex";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			extensions: [".svelte", ".md"],
			preprocess: [mdsvex({ extensions: [".md"] })],
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes("node_modules") ? undefined : true,
				// mdsvex 0.12.7 injects a deprecated `<script context="module">` into
				// every compiled .md; silence only that warning, only for .md, so real
				// warnings in .svelte files still surface. Remove once mdsvex updates.
				warningFilter: (w) =>
					!(
						w.code === "script_context_deprecated" &&
						w.filename?.endsWith(".md")
					),
			},
			adapter: adapter({ fallback: "404.html" }),
		}),
	],
});
