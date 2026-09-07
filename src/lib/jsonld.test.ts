import { describe, expect, test } from "bun:test";
import { jsonLdScript } from "./jsonld";

describe("structured data", () => {
	test("round-trips unicode and script delimiters without injecting markup", () => {
		const data = {
			"@type": "Person",
			name: '朱 </script><script>alert("x")</script>',
		};
		const html = jsonLdScript(data);
		expect(html.match(/<script/g)).toHaveLength(1);
		expect(html.match(/<\/script>/g)).toHaveLength(1);
		expect(
			JSON.parse(html.slice(html.indexOf(">") + 1, html.lastIndexOf("<"))),
		).toEqual(data);
	});
});
