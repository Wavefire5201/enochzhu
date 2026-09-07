/** Serialize data for an HTML script raw-text context, not HTML text content. */
export function jsonLdScript(data: unknown): string {
	const json = JSON.stringify(data).replace(/</g, "\\u003c");
	return `<script type="application/ld+json">${json}</script>`;
}
