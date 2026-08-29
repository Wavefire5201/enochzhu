import { load } from "./index";
import { postSchema } from "./schema";

/**
 * Notes posts (see postSchema). Kept OUT of ./index on purpose: that module is
 * imported by the home page, and Vite would bundle every post's compiled
 * markdown into the shared chunk for every visitor to download. Import this
 * only from src/routes/notes/.
 */
export const posts = load(
	import.meta.glob("/src/content/notes/*.md", { eager: true }),
	postSchema,
)
	.filter((p) => !p.meta.draft)
	.sort((a, b) => b.meta.date.localeCompare(a.meta.date));
