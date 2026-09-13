<script lang="ts">
	import { onMount } from "svelte";
	import { LISTENING_ENDPOINT } from "./store.svelte";

	// Ambient trace from the listening worker's /visit endpoint: a cumulative
	// count and the coarse trace of whoever came just before you. Texture, not a
	// feature — it fills in after a client fetch and stays hidden on any failure
	// (same state ladder as the listening feed), so prerendered HTML is unchanged.
	type Trace = { count: number; last: { t: number; place: string } | null };
	let trace = $state<Trace | null>(null);

	/** the referrer's origin, or "" — the path is never sent anywhere */
	function referrerOrigin(): string {
		if (!document.referrer) return "";
		try {
			return new URL(document.referrer).origin;
		} catch {
			return "";
		}
	}

	function ago(seconds: number): string {
		const d = Math.max(0, Math.floor(Date.now() / 1000) - seconds);
		if (d < 60) return "moments ago";
		if (d < 3600) return `${Math.floor(d / 60)}m ago`;
		if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
		return `${Math.floor(d / 86400)}d ago`;
	}

	onMount(async () => {
		if (!LISTENING_ENDPOINT) return;
		try {
			// the worker only ever sees our origin as Referer (cross-origin fetch),
			// so pass where this page visit actually came from explicitly — the
			// origin only, never the path, which can carry private query strings
			const origin = referrerOrigin();
			const from = origin ? `?from=${encodeURIComponent(origin)}` : "";
			const res = await fetch(`${LISTENING_ENDPOINT}visit${from}`);
			if (!res.ok) return;
			trace = (await res.json()) as Trace;
		} catch {
			// stay hidden — the trace is a nicety, never an error state
		}
	});
</script>

{#if trace}
	<p class="mt-6 font-mono text-xs text-muted">
		you're visitor no. {trace.count.toLocaleString()}
		{#if trace.last}
			<span class="text-line">・</span> someone was here {ago(
				trace.last.t,
			)}{trace.last.place ? ` from ${trace.last.place.toLowerCase()}` : ""}
		{/if}
	</p>
{/if}
