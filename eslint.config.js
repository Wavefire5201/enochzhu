import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import svelte from "eslint-plugin-svelte";
import globals from "globals";
import ts from "typescript-eslint";

// Flat config is a plain array; a wrapper helper isn't needed (and the
// typescript-eslint one is deprecated). Order matters — later entries win.
export default [
	{
		// Build output, vendored types, and mdsvex-compiled content are not ours to lint.
		ignores: [
			".svelte-kit/",
			"build/",
			"node_modules/",
			"static/",
			"workers/",
			"**/*.md",
		],
	},
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	// Turn off stylistic rules that Prettier owns (must come after the sets above).
	prettier,
	...svelte.configs.prettier,
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node },
		},
	},
	{
		// Parse <script> blocks (and .svelte.ts runes modules) with the TS parser.
		files: ["**/*.svelte", "**/*.svelte.ts", "**/*.svelte.js"],
		languageOptions: {
			parserOptions: {
				parser: ts.parser,
				extraFileExtensions: [".svelte"],
			},
		},
	},
	{
		// This site deploys at a root domain with no base path, so plain internal
		// hrefs and goto() are correct; resolve() would be pure ceremony here.
		rules: {
			"svelte/no-navigation-without-resolve": "off",
		},
	},
];
