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
	order: z.number().default(99),
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
	edu: z.string().optional(),
	experience: z
		.array(
			z.object({
				role: z.string(),
				organization: z.string(),
				period: z.string(),
				location: z.string().optional(),
			}),
		)
		.default([]),
	stack: z.array(z.string()).default([]),
	interests: z.array(z.string()).default([]),
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
	order: z.number().default(99),
});

export const catSchema = z.object({
	src: z.string(),
	alt: z.string(),
	name: z.string().optional(),
	order: z.number().default(99),
});

export type Project = z.infer<typeof projectSchema>;
export type Photo = z.infer<typeof photoSchema>;
export type About = z.infer<typeof aboutSchema>;
export type Thought = z.infer<typeof thoughtSchema>;
export type Uses = z.infer<typeof usesSchema>;
export type Music = z.infer<typeof musicSchema>;
export type Cat = z.infer<typeof catSchema>;
