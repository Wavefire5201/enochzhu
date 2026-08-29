import type { z } from "zod";
import type { projectSchema } from "$lib/content/schema";

export const projectEntries: (z.input<typeof projectSchema> & {
	slug: string;
})[] = [
	{
		slug: "bell-pepper",
		title: "bell pepper",
		description:
			"farm-to-customer marketplace where local farmers sell produce, independent drivers deliver, and stripe connect pays both",
		stack: [
			"react-native",
			"expo",
			"next.js",
			"supabase",
			"stripe",
			"typescript",
		],
		year: "2026–now",
		live: "https://bellpepper.shop",
	},
	{
		slug: "chengli-wei",
		title: "chengli wei",
		description:
			"professional site for an optics professor at lipscomb university, covering research, publications, and teaching",
		stack: ["astro", "tailwind", "netlify"],
		year: 2020,
		live: "https://chengliwei.org",
	},
	{
		slug: "clickr",
		title: "clickr",
		description: "lightweight autoclicker for wayland",
		stack: ["rust", "wayland"],
		year: 2026,
		github: "https://github.com/Wavefire5201/clickr",
	},
	{
		slug: "cuaya",
		title: "cuaya",
		description:
			"pre-health app with a provider directory built on cms nppes data and a clinical hours tracker tiered against admissions targets",
		stack: [
			"react-native",
			"expo",
			"hono",
			"drizzle",
			"postgresql",
			"docker",
			"typescript",
		],
		year: "2026–now",
	},
	{
		slug: "dotfiles",
		title: "dotfiles",
		description:
			"my personal configuration files for linux and various applications",
		stack: ["linux", "chezmoi", "bash"],
		year: "2025-now",
		github: "https://github.com/Wavefire5201/dotfiles",
	},
	{
		slug: "dp-filtration",
		title: "dp filtration",
		description:
			"marketing site for a new mexico company that builds automated self-cleaning strainers for saltwater disposal and industrial fluid systems",
		stack: ["astro", "tailwind"],
		year: 2026,
		live: "https://dpfiltration.com",
	},
	{
		slug: "duzhe",
		title: "duzhe",
		description: "chinese epub reader with pinyin",
		stack: ["typescript", "epub", "pinyin"],
		year: 2026,
		github: "https://github.com/Wavefire5201/duzhe",
	},
	{
		slug: "keeber",
		title: "keeber",
		description:
			"macos input blocker for safely cleaning your keyboard and screen",
		stack: ["swift", "macos"],
		year: 2026,
		github: "https://github.com/Wavefire5201/keeber",
	},
	{
		slug: "pedroplusnoah",
		title: "pedro & noah",
		description:
			"campaign site for a ut austin student government president and vice president campaign",
		stack: ["next.js", "tailwind", "drizzle", "postgresql"],
		year: 2026,
		live: "https://pedroplusnoah.com",
	},
	{
		slug: "private-cloud",
		title: "private cloud",
		description: "self-hosted linux homelab",
		stack: ["linux", "docker", "tailscale", "wireguard", "nginx", "cloudflare"],
		year: "2024–now",
		live: "https://homepage.wavefire.co",
		featured: true,
	},
	{
		slug: "random-image",
		title: "random-image",
		description: "random image server",
		stack: ["typescript", "bun", "cloudflare"],
		year: 2025,
		github: "https://github.com/Wavefire5201/random-image",
		live: "https://random.wavefire.co/random",
	},
	{
		slug: "rewind",
		title: "rewind",
		description: "mobile app to take a daily selfie to view a timelapse",
		stack: ["typescript", "react-native", "expo"],
		year: 2026,
		github: "https://github.com/Wavefire5201/rewind",
	},
	{
		slug: "signature-steel",
		title: "signature steel structures",
		description:
			"marketing site for a central texas steel builder doing barndominiums, metal buildings, and fabrication",
		stack: ["astro", "tailwind", "netlify"],
		year: 2026,
		live: "https://signaturesteelstructures.com",
	},
	{
		slug: "sbi-portal",
		title: "sbi portal",
		description:
			"custom client/team portal for the sustainable building initiative at ut austin",
		stack: ["next.js", "typescript", "tailwind", "supabase", "postgresql"],
		year: "2024–now",
		live: "https://utsbi.org",
		featured: true,
	},
	{
		slug: "txtfx",
		title: "txtfx",
		description: "make cool ascii backgrounds",
		stack: ["typescript", "webgl", "canvas", "ascii"],
		year: 2026,
		github: "https://github.com/Wavefire5201/txtfx",
		live: "https://txtfx.wavefire.co",
		featured: true,
	},
	{
		slug: "enochzhu",
		title: "enochzhu",
		description: "my personal website",
		stack: [
			"sveltekit",
			"threlte",
			"three.js",
			"webgl",
			"typescript",
			"cloudflare",
		],
		year: 2026,
		github: "https://github.com/Wavefire5201/enochzhu",
		live: "https://enochzhu.com",
		featured: true,
	},
];
