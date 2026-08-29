import { error } from "@sveltejs/kit";
import { posts } from "$lib/content/posts";
import type { EntryGenerator, PageLoad } from "./$types";

// prerender exactly the posts that exist on the building machine; none on a
// fresh clone, so the route vanishes rather than shipping empty shells
export const entries: EntryGenerator = () => posts.map((p) => ({ slug: p.slug }));

export const load: PageLoad = ({ params }) => {
	const post = posts.find((p) => p.slug === params.slug);
	if (!post) error(404, "no route to host");
	return { post };
};
