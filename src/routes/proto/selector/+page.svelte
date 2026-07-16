<script lang="ts">
	// throwaway: custom backdrop selectors (not a dropdown). hover on desktop to
	// see the reveal animations. pick a number. noindex.
	import { heroPairs } from "$lib/hero/pairs";
	const opts = heroPairs.map((p) => ({ id: p.id, label: p.label }));

	let a = $state(opts[0].id);
	let b = $state(opts[0].id);
	let c = $state(opts[0].id);
	let d = $state(opts[0].id);
</script>

<svelte:head>
	<title>proto/selector</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="min-h-screen bg-bg px-10 py-16">
	<h1 class="font-mono text-sm text-muted">
		proto/selector — hover each, then pick a number
	</h1>

	<ul class="mt-16 flex flex-col gap-20 font-mono text-xs">
		<!-- 1 · reveal left→right (opacity stagger); only the active shows at rest -->
		<li>
			<p class="mb-5 text-[0.7rem] text-ember">
				1 · reveal left→right on hover
			</p>
			<div class="group inline-flex items-baseline gap-5">
				<span class="text-muted">backdrop</span>
				{#each opts as o, i (o.id)}
					<button
						onclick={() => (a = o.id)}
						class="transition-all duration-300 ease-out {a === o.id
							? 'text-ember'
							: 'text-fg opacity-0 group-hover:opacity-100 hover:text-ember'}"
						style="transition-delay:{a === o.id ? 0 : i * 70}ms"
						>{o.label}</button
					>
				{/each}
			</div>
		</li>

		<!-- 2 · dots that expand into labels left→right on hover -->
		<li>
			<p class="mb-5 text-[0.7rem] text-ember">2 · dots expand into labels</p>
			<div class="group inline-flex items-center gap-2.5">
				<span class="mr-1 text-muted">backdrop</span>
				{#each opts as o, i (o.id)}
					<button
						onclick={() => (b = o.id)}
						class="flex items-center gap-1.5"
						style="transition-delay:{i * 60}ms"
					>
						<span
							class="size-1.5 shrink-0 rounded-full transition-colors {b ===
							o.id
								? 'bg-ember'
								: 'bg-line group-hover:bg-muted'}"
						></span>
						<span
							class="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 ease-out group-hover:max-w-[8rem] group-hover:opacity-100 {b ===
							o.id
								? 'text-ember'
								: 'text-fg'}">{o.label}</span
						>
					</button>
				{/each}
			</div>
		</li>

		<!-- 3 · drawer slides open left→right from the label -->
		<li>
			<p class="mb-5 text-[0.7rem] text-ember">3 · drawer slides open</p>
			<div class="group inline-flex items-baseline">
				<span class="text-muted">backdrop</span>
				<div
					class="flex max-w-0 gap-5 overflow-hidden pl-0 opacity-0 transition-all duration-500 ease-out group-hover:max-w-2xl group-hover:pl-5 group-hover:opacity-100"
				>
					{#each opts as o (o.id)}
						<button
							onclick={() => (c = o.id)}
							class="whitespace-nowrap transition-colors {c === o.id
								? 'text-ember'
								: 'text-fg hover:text-ember'}">{o.label}</button
						>
					{/each}
				</div>
			</div>
		</li>

		<!-- 4 · always-on segmented row with an ember tick on the active -->
		<li>
			<p class="mb-5 text-[0.7rem] text-ember">
				4 · always-visible, ember tick
			</p>
			<div class="inline-flex gap-6">
				{#each opts as o (o.id)}
					<button
						onclick={() => (d = o.id)}
						class="relative pb-1.5 transition-colors {d === o.id
							? 'text-ember'
							: 'text-muted hover:text-fg'}"
					>
						{o.label}
						<span
							class="absolute inset-x-0 bottom-0 h-px origin-left bg-ember transition-transform duration-300 {d ===
							o.id
								? 'scale-x-100'
								: 'scale-x-0'}"
						></span>
					</button>
				{/each}
			</div>
		</li>
	</ul>
</div>
