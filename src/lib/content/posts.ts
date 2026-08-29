import { load } from "./index";
import { postSchema } from "./schema";

/**
 * Unlisted posts (see postSchema). Kept OUT of ./index on purpose: that module
 * is imported by the home page, and Vite would bundle every post's compiled
 * markdown into the shared chunk for all visitors to read. Import this only
 * from src/routes/p/. The directory is gitignored, so a fresh clone builds
 * zero posts and /p/* simply doesn't exist there.
 */
export const posts = load(
	import.meta.glob("/src/content/blog/*.md", { eager: true }),
	postSchema,
).sort((a, b) => b.meta.date.localeCompare(a.meta.date));
