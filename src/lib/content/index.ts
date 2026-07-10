import type { Component } from "svelte";
import type { z } from "zod";
import {
	aboutSchema,
	catSchema,
	musicSchema,
	photoSchema,
	projectSchema,
	thoughtSchema,
	usesSchema,
} from "./schema";

export interface Entry<T> {
	slug: string;
	meta: T;
	/** mdsvex-compiled markdown body; render with <svelte:component> / snippet */
	body: Component;
}

interface MdModule {
	metadata?: unknown;
	default: Component;
}

/**
 * Loads a collection from glob-imported markdown modules, validating
 * frontmatter against its schema at build time. An empty directory yields an
 * empty array — the caller renders nothing (PRD §5: no empty shells).
 */
function load<S extends z.ZodType>(
	modules: Record<string, unknown>,
	schema: S,
): Entry<z.infer<S>>[] {
	return Object.entries(modules).map(([path, mod]) => {
		const m = mod as MdModule;
		const slug = path.split("/").pop()?.replace(/\.md$/, "") ?? path;
		const parsed = schema.safeParse(m.metadata ?? {});
		if (!parsed.success) {
			throw new Error(
				`invalid frontmatter in ${path}: ${parsed.error.message}`,
			);
		}
		return { slug, meta: parsed.data, body: m.default };
	});
}

const byOrder = <T extends { meta: { order?: number } }>(a: T, b: T) =>
	(a.meta.order ?? 99) - (b.meta.order ?? 99);

export const projects = load(
	import.meta.glob("/src/content/projects/*.md", { eager: true }),
	projectSchema,
).sort(byOrder);

export const photos = load(
	import.meta.glob("/src/content/photos/*.md", { eager: true }),
	photoSchema,
).sort(byOrder);

/** single-entry collection; undefined when the file doesn't exist */
export const about = load(
	import.meta.glob("/src/content/about/*.md", { eager: true }),
	aboutSchema,
)[0];

export const thoughts = load(
	import.meta.glob("/src/content/thoughts/*.md", { eager: true }),
	thoughtSchema,
)
	.filter((t) => !t.meta.draft)
	.sort((a, b) => b.meta.date.localeCompare(a.meta.date));

export const uses = load(
	import.meta.glob("/src/content/uses/*.md", { eager: true }),
	usesSchema,
).sort(byOrder);

export const music = load(
	import.meta.glob("/src/content/music/*.md", { eager: true }),
	musicSchema,
).sort(byOrder);

export const cats = load(
	import.meta.glob("/src/content/cats/*.md", { eager: true }),
	catSchema,
).sort(byOrder);
