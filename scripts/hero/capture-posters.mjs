#!/usr/bin/env node
/**
 * Capture the hero poster stills — the static <img> layer that is the LCP
 * element and every fallback path — straight out of the tuned glyph shader.
 *
 *   node scripts/hero/capture-posters.mjs --missing
 *   node scripts/hero/capture-posters.mjs sakura snow-peak
 *   node scripts/hero/capture-posters.mjs --all --no-build
 *
 * It builds the site, serves it with `vite preview`, and for each pair and each
 * poster width loads the home page, switches the backdrop to that pair, waits
 * for the canvas to finish fading in, hides everything in the hero except the
 * canvas, screenshots the canvas, and encodes the png to webp with cwebp.
 *
 * Needs `npx playwright install chromium` once.
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT_DIR = join(REPO, "scripts/hero/out");
const HERO_DIR = join(REPO, "static/hero");
const PORT = 4173;
// the two widths pairs.ts serves through srcset; the glyph texture compresses
// poorly, so mobile must get the small file
const SIZES = [
	{ width: 1600, height: 667 },
	{ width: 800, height: 333 },
];
const READY_TIMEOUT = 30_000;

const HELP = `capture-posters.mjs — screenshot the glyph hero into poster webps

usage:
  node scripts/hero/capture-posters.mjs [options] [id...]

  --all         every pair in src/lib/hero/pairs.ts
  --missing     only pairs with a poster webp missing from static/hero/
  --no-build    reuse the existing build/ instead of running npm run build
  --port N      preview port (default ${PORT})
  --keep-png    keep the intermediate pngs in scripts/hero/out/
  -h, --help    this

output: static/hero/<id>-poster-1600.webp and -800.webp
`;

// ------------------------------------------------------------------ options

function parseArgs(argv) {
	const opts = {
		ids: [],
		all: false,
		missing: false,
		build: true,
		port: PORT,
		keepPng: false,
	};
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "-h" || arg === "--help") {
			process.stdout.write(HELP);
			process.exit(0);
		} else if (arg === "--all") opts.all = true;
		else if (arg === "--missing") opts.missing = true;
		else if (arg === "--no-build") opts.build = false;
		else if (arg === "--keep-png") opts.keepPng = true;
		else if (arg === "--port") opts.port = Number(argv[++i]);
		else if (arg.startsWith("-")) {
			console.error(`unknown option ${arg}`);
			process.stdout.write(HELP);
			process.exit(2);
		} else opts.ids.push(arg);
	}
	return opts;
}

/** id + label straight out of pairs.ts — the label is what the switcher shows. */
function readPairs() {
	const source = readFileSync(join(REPO, "src/lib/hero/pairs.ts"), "utf8");
	const body = source.slice(source.indexOf("heroPairs: HeroPair[] = ["));
	const pairs = [];
	const re = /id:\s*"([^"]+)",\s*\n\s*label:\s*"([^"]+)"/g;
	let match;
	while ((match = re.exec(body))) pairs.push({ id: match[1], label: match[2] });
	return pairs;
}

// -------------------------------------------------------------- dependencies

function ensurePlaywright() {
	try {
		return require("playwright");
	} catch {
		console.log("playwright is not installed — adding it as a devDependency");
		// match whichever lockfile the repo keeps, so the install does not leave a
		// second one behind
		const bun = existsSync(join(REPO, "bun.lock"));
		const install = spawnSync(
			bun ? "bun" : "npm",
			bun
				? ["add", "--dev", "playwright"]
				: ["install", "--save-dev", "playwright"],
			{ cwd: REPO, stdio: "inherit" },
		);
		if (install.status !== 0) throw new Error("installing playwright failed");
		console.log(
			"run `npx playwright install chromium` if the browser is missing",
		);
		return require("playwright");
	}
}

function haveCwebp() {
	return spawnSync("cwebp", ["-version"], { stdio: "ignore" }).status === 0;
}

/** png -> webp, cwebp first, sharp if it happens to be installed. */
async function encodeWebp(png, webp, useCwebp) {
	if (useCwebp) {
		const run = spawnSync("cwebp", ["-quiet", "-q", "80", png, "-o", webp], {
			stdio: ["ignore", "ignore", "inherit"],
		});
		if (run.status === 0) return true;
	}
	try {
		const sharp = require("sharp");
		await sharp(png).webp({ quality: 80 }).toFile(webp);
		return true;
	} catch {
		console.warn(
			`  ! neither cwebp nor sharp available — left ${png} unencoded ` +
				"(brew install webp, or npm i -D sharp)",
		);
		return false;
	}
}

// ------------------------------------------------------------------ preview

function startPreview(port) {
	const server = spawn("npx", ["vite", "preview", "--port", String(port)], {
		cwd: REPO,
		stdio: ["ignore", "pipe", "pipe"],
	});
	server.stdout.on("data", () => {});
	server.stderr.on("data", (chunk) => process.stderr.write(chunk));
	return server;
}

async function waitForServer(url, timeout = 30_000) {
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		try {
			const response = await fetch(url);
			if (response.ok) return;
		} catch {
			// not listening yet
		}
		await new Promise((r) => setTimeout(r, 250));
	}
	throw new Error(`vite preview never answered on ${url}`);
}

// ------------------------------------------------------------------ capture

async function capture(browser, pair, size, opts, useCwebp) {
	// a fresh page per capture: chromium drops the oldest webgl context after a
	// handful of them, and a lost context screenshots as a blank canvas
	const page = await browser.newPage({
		viewport: { width: size.width, height: size.height },
		deviceScaleFactor: 1,
		// headless chromium reports prefers-reduced-motion: reduce, and Hero.svelte
		// treats that as "never start the shader" — the canvas would never mount
		reducedMotion: "no-preference",
	});
	try {
		await page.goto(`http://localhost:${opts.port}/`, { waitUntil: "load" });
		await page.evaluate(() => window.scrollTo(0, 0));

		// the switcher only lists the pairs that are NOT selected; if none of the
		// buttons carries this label the pair is already selected, and the
		// always-visible span.text-ember says so
		const button = page.locator("button", {
			hasText: new RegExp(`^${escapeRe(pair.label)}$`),
		});
		if ((await button.count()) > 0) {
			// dispatchEvent, not click(): a real click moves the mouse, which is the
			// gesture that boots the shader — the canvas would mount for the pair
			// that is still selected and then be torn down by the {#key} remount
			await button.first().dispatchEvent("click");
		} else {
			const selected = (
				await page.locator("span.text-ember").first().textContent()
			)?.trim();
			if (selected !== pair.label)
				throw new Error(
					`no switcher entry for "${pair.label}" (showing "${selected}")`,
				);
		}

		// the shader only boots after real input on a pointer device
		await page.mouse.move(size.width / 2, size.height / 2);
		await page.mouse.move(size.width / 2 + 8, size.height / 2 + 8);

		try {
			await page.waitForFunction(
				() => {
					const canvas = document.querySelector("canvas");
					return !!canvas && getComputedStyle(canvas).opacity === "1";
				},
				{ timeout: READY_TIMEOUT },
			);
		} catch {
			const state = await page.evaluate(() => ({
				canvas: !!document.querySelector("canvas"),
				webgl2: !!document.createElement("canvas").getContext("webgl2"),
			}));
			throw new Error(
				`canvas never reached full opacity for ${pair.id} ` +
					`(canvas mounted: ${state.canvas}, webgl2: ${state.webgl2})`,
			);
		}
		// one more frame after the 1s fade so the glyph field is fully settled
		await page.waitForTimeout(1200);

		// strip the copy off the plate: hide everything in the hero that is not
		// the canvas or one of its ancestors
		await page.evaluate(() => {
			const canvas = document.querySelector("canvas");
			const hero = canvas?.closest("section");
			if (!hero || !canvas) return;
			const keep = new Set();
			for (
				let node = canvas;
				node && node !== hero.parentElement;
				node = node.parentElement
			)
				keep.add(node);
			for (const el of hero.querySelectorAll("*"))
				if (!keep.has(el)) el.style.visibility = "hidden";
		});

		mkdirSync(OUT_DIR, { recursive: true });
		const png = join(OUT_DIR, `${pair.id}-poster-${size.width}.png`);
		const webp = join(HERO_DIR, `${pair.id}-poster-${size.width}.webp`);
		await page.locator("canvas").first().screenshot({ path: png });
		const encoded = await encodeWebp(png, webp, useCwebp);
		if (encoded && !opts.keepPng) unlinkSync(png);
		console.log(
			`  ${pair.id} ${size.width}x${size.height} -> ${encoded ? webp : png}`,
		);
	} finally {
		await page.close();
	}
}

function escapeRe(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// --------------------------------------------------------------------- main

async function main() {
	const opts = parseArgs(process.argv.slice(2));
	const pairs = readPairs();

	let selected;
	if (opts.all) selected = pairs;
	else if (opts.missing)
		selected = pairs.filter((p) =>
			SIZES.some(
				(s) => !existsSync(join(HERO_DIR, `${p.id}-poster-${s.width}.webp`)),
			),
		);
	else if (opts.ids.length) {
		selected = opts.ids.map((id) => {
			const pair = pairs.find((p) => p.id === id);
			if (!pair) throw new Error(`no pair "${id}" in pairs.ts`);
			return pair;
		});
	} else {
		process.stdout.write(HELP);
		process.exit(2);
	}

	if (!selected.length) {
		console.log("nothing to capture");
		return;
	}
	console.log(`capturing ${selected.map((p) => p.id).join(", ")}`);

	const { chromium } = ensurePlaywright();
	const useCwebp = haveCwebp();
	if (!useCwebp) console.warn("cwebp not found — will try sharp");

	if (opts.build) {
		console.log("npm run build");
		const build = spawnSync("npm", ["run", "build"], {
			cwd: REPO,
			stdio: "inherit",
		});
		if (build.status !== 0) throw new Error("build failed");
	}

	const server = startPreview(opts.port);
	let browser;
	try {
		await waitForServer(`http://localhost:${opts.port}/`);
		// only a permission to fall back to software gl where there is no gpu —
		// not a switch that forces it, so a real gpu still renders the poster
		browser = await chromium.launch({ args: ["--enable-unsafe-swiftshader"] });
		for (const pair of selected)
			for (const size of SIZES)
				await capture(browser, pair, size, opts, useCwebp);
	} finally {
		await browser?.close();
		server.kill("SIGTERM");
	}
	console.log("done");
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
