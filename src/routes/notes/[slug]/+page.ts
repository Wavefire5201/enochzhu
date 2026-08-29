import { error } from "@sveltejs/kit";
import { posts } from "$lib/content/posts";
import type { EntryGenerator, PageLoad } from "./$types";

// one prerendered page per published post; drafts are already filtered out
export const entries: EntryGenerator = () =>
	posts.map((p) => ({ slug: p.slug }));

export const load: PageLoad = ({ params }) => {
	const post = posts.find((p) => p.slug === params.slug);
	if (!post) error(404, "no route to host");
	return { post };
};
