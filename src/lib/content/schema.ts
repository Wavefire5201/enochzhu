import { z } from "zod";

/**
 * One schema per collection. Every section of the site renders from one of
 * these; a collection with zero entries produces no section and, later, no
 * route (PRD §5).
 */

export const projectSchema = z.object({
	title: z.string(),
	/** short description — Enoch's own words from GitHub/resume, never invented */
	description: z.string(),
	stack: z.array(z.string()).default([]),
	/** display string, e.g. "2024–" or "2025" (bare YAML numbers coerced) */
	year: z.coerce.string().optional(),
	github: z.string().optional(),
	live: z.string().optional(),
	featured: z.boolean().default(false),
});

export const photoSchema = z.object({
	src: z.string(),
	alt: z.string(),
	location: z.string().optional(),
	date: z.string().optional(),
	order: z.number().default(99),
});

export const aboutSchema = z.object({
	name: z.string(),
	title: z.string(),
	location: z.string().optional(),
	bio: z.string().optional(),
	/**
	 * Freeform, ordered About rows. Add / reorder / rename sections purely in
	 * about.md — no schema change needed. Each renders a label plus either
	 * `items` (a separated list) or `text` (a block; newlines preserved).
	 */
	sections: z
		.array(
			z.object({
				label: z.string(),
				items: z.array(z.string()).optional(),
				text: z.string().optional(),
			}),
		)
		.default([]),
	experience: z
		.array(
			z.object({
				role: z.string(),
				organization: z.string(),
				period: z.string(),
				location: z.string().optional(),
				/** optional link to the org/company site */
				link: z.string().optional(),
				/** short annotation shown beside the org, e.g. "i made this website" */
				comment: z.string().optional(),
				/** one or two sentences on what the work actually was */
				description: z.string().optional(),
			}),
		)
		.default([]),
	links: z.record(z.string(), z.string()).default({}),
});

export const thoughtSchema = z.object({
	title: z.string(),
	date: z.string(),
	description: z.string().optional(),
	tags: z.array(z.string()).default([]),
	draft: z.boolean().default(false),
});

export const usesSchema = z.object({
	category: z.string(),
	name: z.string(),
	note: z.string().optional(),
	link: z.string().optional(),
	order: z.number().default(99),
});

export const musicSchema = z.object({
	kind: z.enum(["album", "artist", "track"]),
	title: z.string(),
	artist: z.string().optional(),
	link: z.string().optional(),
	/** cover art path (e.g. /music/foo.jpg under static/) */
	cover: z.string().optional(),
	/** optional animated cover — a looping muted mp4 (e.g. /music/foo.mp4);
	 * the CD wall plays it in place of the still, falling back to the cover */
	video: z.string().optional(),
	/** display string (bare YAML numbers coerced) */
	year: z.coerce.string().optional(),
	/** dominant cover hex — the CD wall placeholder while art streams in
	 * (scripts/music/fetch-cover.py extracts it) */
	color: z.string().optional(),
	/** one-line reason this made the cut — Enoch's words, never invented */
	note: z.string().optional(),
	/** optional manual override of the CD wall's auto-assigned disc face;
	 * matches a DiscStyle value in src/lib/cd-wall/disc-art.ts */
	discStyle: z.string().optional(),
	/** optional specific preview track name to search for (bypassing album title search) */
	previewTrack: z.string().optional(),
	/** optional direct iTunes preview URL to play (bypassing search completely) */
	previewUrl: z.string().optional(),
	order: z.number().default(99),
});

/** single-entry collection backing /now, same pattern as `about` */
export const nowSchema = z.object({
	/** display date, e.g. "2026-07-10" (bare YAML dates arrive as ISO datetimes — trim the time) */
	updated: z.coerce.string().transform((s) => s.replace(/T.*$/, "")),
});

/**
 * Unlisted posts served at /p/<slug>. The markdown lives in src/content/blog/,
 * which is gitignored: the route is public code, the writing never enters git.
 * Nothing links here — reach a post only by its (deliberately obscure) slug.
 */
export const postSchema = z.object({
	/** blog-level heading shown above every post, e.g. the course-mandated name */
	series: z.string(),
	title: z.string(),
	date: z.coerce.string().transform((s) => s.replace(/T.*$/, "")),
	/** path under static/, e.g. /blog/headshot.jpg (static/blog/ is gitignored) */
	headshot: z.string().optional(),
	description: z.string().optional(),
});

export const catSchema = z.object({
	src: z.string(),
	alt: z.string(),
	name: z.string().optional(),
	order: z.number().default(99),
});

export type Project = z.infer<typeof projectSchema>;
export type Now = z.infer<typeof nowSchema>;
export type Photo = z.infer<typeof photoSchema>;
export type About = z.infer<typeof aboutSchema>;
export type Thought = z.infer<typeof thoughtSchema>;
export type Uses = z.infer<typeof usesSchema>;
export type Music = z.infer<typeof musicSchema>;
export type Cat = z.infer<typeof catSchema>;
export type Post = z.infer<typeof postSchema>;
