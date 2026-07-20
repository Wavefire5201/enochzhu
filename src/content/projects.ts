import type { z } from "zod";
import type { projectSchema } from "$lib/content/schema";

export const projectEntries: (z.input<typeof projectSchema> & {
	slug: string;
})[] = [
	{
		slug: "clickr",
		title: "clickr",
		description: "lightweight autoclicker for wayland",
		stack: ["rust"],
		year: 2026,
		github: "https://github.com/Wavefire5201/clickr",
	},
	{
		slug: "dotfiles",
		title: "dotfiles",
		description:
			"my personal configuration files for linux and various applications",
		stack: ["chezmoi"],
		year: "2025-now",
		github: "https://github.com/Wavefire5201/dotfiles",
	},
	{
		slug: "duzhe",
		title: "duzhe",
		description: "chinese epub reader with pinyin",
		stack: ["typescript"],
		year: 2026,
		github: "https://github.com/Wavefire5201/duzhe",
	},
	{
		slug: "keeber",
		title: "keeber",
		description:
			"macos input blocker for safely cleaning your keyboard and screen",
		stack: ["swift"],
		year: 2026,
		github: "https://github.com/Wavefire5201/keeber",
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
		stack: ["typescript"],
		year: 2025,
		github: "https://github.com/Wavefire5201/random-image",
		live: "https://random.wavefire.co/random",
	},
	{
		slug: "rewind",
		title: "rewind",
		description: "mobile app to take a daily selfie to view a timelapse",
		stack: ["typescript", "expo"],
		year: 2026,
		github: "https://github.com/Wavefire5201/rewind",
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
		stack: ["typescript"],
		year: 2026,
		github: "https://github.com/Wavefire5201/txtfx",
		live: "https://txtfx.wavefire.co",
		featured: true,
	},
	{
		slug: "enochzhu",
		title: "enochzhu",
		description: "my personal website",
		stack: ["sveltekit, webgl, cloudflare"],
		year: 2026,
		github: "https://github.com/Wavefire5201/enochzhu",
		live: "https://enochzhu.com",
		featured: true,
	},
];
