<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import { music, now, photos, projects } from "$lib/content";
	import { listening } from "$lib/listening/store.svelte";

	interface Props {
		onclose: () => void;
	}

	const { onclose }: Props = $props();

	interface Line {
		kind: "in" | "out";
		text: string;
	}

	let lines = $state<Line[]>([]);
	let input = $state("");
	const history: string[] = [];
	let historyIndex = -1;
	let inputEl = $state<HTMLInputElement>();
	let scrollEl = $state<HTMLDivElement>();

	let pdfPath = $state("/Zhu_Enoch_Resume.pdf");

	const PROMPT = "visitor@enochzhu:~$";

	const sections = [
		...(projects.length > 0 ? ["projects"] : []),
		...(photos.length > 0 ? ["photos/"] : []),
		"experience",
		"about",
		...(music.length > 0 ? ["music"] : []),
		...(now ? ["now/"] : []),
		"contact",
		"resume.pdf",
	];

	function out(...texts: string[]) {
		lines.push(...texts.map((text) => ({ kind: "out" as const, text })));
	}

	async function scrollToSection(id: string) {
		if (page.url.pathname !== "/") await goto(`/#${id}`);
		document.getElementById(id)?.scrollIntoView();
	}

	function run(raw: string) {
		const cmd = raw.trim();
		lines.push({ kind: "in", text: `${PROMPT} ${raw}` });
		if (cmd === "") return;

		history.push(cmd);
		historyIndex = history.length;

		const [name, ...args] = cmd.split(/\s+/);

		switch (name) {
			case "help":
				out(
					"help  ls [-a]  cd <dir>  cat <file>  whoami  nowplaying  neofetch  clear  exit",
				);
				break;
			case "ls": {
				const all = args.includes("-a");
				out((all ? [".", "..", ".cat", ...sections] : sections).join("  "));
				break;
			}
			case "cd": {
				const target = (args[0] ?? "~").replace(/\/$/, "");
				if (target === "~" || target === "/" || target === "") {
					onclose();
					goto("/");
				} else if (target === ".cat" || target === "cat") {
					onclose();
					goto("/cat");
				} else if (target === "now" && now) {
					onclose();
					goto("/now");
				} else if (
					[
						"projects",
						"photos",
						"experience",
						"about",
						"music",
						"contact",
					].includes(target)
				) {
					onclose();
					scrollToSection(target);
				} else {
					out(`cd: no such file or directory: ${target}`);
				}
				break;
			}
			case "cat": {
				const target = args[0];
				if (!target) {
					onclose();
					goto("/cat");
				} else if (target === "resume.pdf") {
					window.open(pdfPath, "_blank", "noopener");
				} else if (target === ".cat") {
					onclose();
					goto("/cat");
				} else {
					out(`cat: ${target}: no such file or directory`);
				}
				break;
			}
			case "whoami":
				out("visitor");
				break;
			case "nowplaying": {
				// same store as the ambient chip (PRD-music §3.1)
				listening.start();
				const t = listening.current;
				if (!t) out("silence");
				else if (t.nowPlaying) out(`▶ ${t.name} — ${t.artist}`);
				else out(`⏸ ${t.name} — ${t.artist}  (last played)`);
				break;
			}
			case "neofetch": {
				const s = Math.floor(performance.now() / 1000);
				out(
					"visitor@enochzhu.com",
					"--------------------",
					"os       sveltekit (static)",
					"wm       webgl2",
					"shell    web",
					`uptime   ${Math.floor(s / 60)}m ${s % 60}s`,
					"theme    forest-fog",
					"accent   #c9884e",
				);
				break;
			}
			case "clear":
				lines = [];
				break;
			case "exit":
				onclose();
				break;
			default:
				out(`command not found: ${name}`);
		}
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === "Enter") {
			run(input);
			input = "";
			requestAnimationFrame(() =>
				scrollEl?.scrollTo({ top: scrollEl.scrollHeight }),
			);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			if (historyIndex > 0) {
				historyIndex -= 1;
				input = history[historyIndex] ?? "";
			}
		} else if (e.key === "ArrowDown") {
			e.preventDefault();
			if (historyIndex < history.length) {
				historyIndex += 1;
				input = history[historyIndex] ?? "";
			}
		} else if (e.key === "Escape" || e.key === "`") {
			e.preventDefault();
			onclose();
		}
	}

	$effect(() => {
		inputEl?.focus();
	});
</script>

<div
	role="dialog"
	aria-label="terminal"
	class="fixed inset-x-0 top-0 z-40 border-b border-line bg-bg/95 font-mono text-sm text-fg backdrop-blur-sm"
>
	<div class="mx-auto max-w-4xl px-6 py-4">
		<div bind:this={scrollEl} class="max-h-[40svh] overflow-y-auto">
			{#each lines as line, i (i)}
				<p class="whitespace-pre-wrap" class:text-muted={line.kind === "in"}>
					{line.text}
				</p>
			{/each}
		</div>
		<div class="flex gap-2 pt-1">
			<label for="term-in" class="shrink-0 text-muted">{PROMPT}</label>
			<input
				id="term-in"
				bind:this={inputEl}
				bind:value={input}
				onkeydown={onKeydown}
				class="w-full bg-transparent text-bright caret-ember outline-none"
				autocomplete="off"
				autocapitalize="off"
				spellcheck="false"
			/>
		</div>
	</div>
</div>
