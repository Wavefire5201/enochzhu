import { afterEach, describe, expect, test } from "bun:test";
import { notifyVisit, referrerHost, type VisitEnv } from "../src/index";

/** minimal in-memory stand-in for the bits of KV the notifier touches */
function fakeKv() {
	const store = new Map<string, string>();
	return {
		store,
		get: async (key: string) => store.get(key) ?? null,
		put: async (key: string, value: string) => {
			store.set(key, value);
		},
	} as unknown as KVNamespace & { store: Map<string, string> };
}

const visit = { n: 1, place: "Austin, US", from: "", ua: "" };
// only the notifier's own fields matter here; the rest of Env is unused
const env = { NTFY_URL: "https://ntfy.example/secret-topic" } as VisitEnv;
const envOff = {} as VisitEnv;
const realFetch = globalThis.fetch;

function stubFetch() {
	const calls: string[] = [];
	globalThis.fetch = (async (input: RequestInfo | URL) => {
		calls.push(String(input));
		return new Response("ok", { status: 200 });
	}) as typeof fetch;
	return calls;
}

afterEach(() => {
	globalThis.fetch = realFetch;
});

describe("notifyVisit rate limiting", () => {
	test("only the first visit in a bucket sends a note", async () => {
		const kv = fakeKv();
		const calls = stubFetch();
		await notifyVisit(env, kv, visit);
		await notifyVisit(env, kv, { ...visit, n: 2 });
		expect(calls).toHaveLength(1);
		expect([...kv.store.keys()].some((k) => k.startsWith("ntfy:bucket:"))).toBe(
			true,
		);
	});

	test("sends nothing once the daily cap is reached", async () => {
		const kv = fakeKv();
		const calls = stubFetch();
		const dayKey = `ntfy:day:${new Date().toISOString().slice(0, 10)}`;
		await kv.put(dayKey, "200");
		await notifyVisit(env, kv, visit);
		expect(calls).toHaveLength(0);
	});

	test("no NTFY_URL means no KV writes and no request", async () => {
		const kv = fakeKv();
		const calls = stubFetch();
		await notifyVisit(envOff, kv, visit);
		expect(calls).toHaveLength(0);
		expect(kv.store.size).toBe(0);
	});
});

describe("referrerHost", () => {
	test("keeps the host of a real web referrer", () => {
		expect(referrerHost("https://evil.com/path")).toBe("evil.com");
		expect(referrerHost("http://news.ycombinator.com/item?id=1")).toBe(
			"news.ycombinator.com",
		);
	});

	test("rejects non-http schemes and junk hostnames", () => {
		expect(referrerHost("foo://%20free%20bitcoin")).toBe("");
		expect(referrerHost("javascript:alert(1)")).toBe("");
		expect(referrerHost("data:text/html,<b>hi</b>")).toBe("");
		expect(referrerHost("not a url")).toBe("");
		expect(referrerHost("")).toBe("");
	});

	test("own-site navigation is not a referral", () => {
		expect(referrerHost("https://enochzhu.com/notes")).toBe("");
		expect(referrerHost("https://www.enochzhu.com/")).toBe("");
	});
});
