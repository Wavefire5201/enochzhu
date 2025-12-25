const EMAIL = "root@enochzhu.com";
const GITHUB_PROFILE = "https://github.com/Wavefire5201";

export default function Home() {
	return (
		<div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
			<main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
				<div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
					<h1 className="max-w-xs text-3xl font-serif font-semibold leading-10 tracking-tight italic text-black dark:text-zinc-50">
						Coming soon.
					</h1>
					<p className="max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
						Hi there, I&apos;m Enoch Zhu. Currently studying Computer Science at
						The University of Texas at Austin. This is a placeholder website
						while I come up with designs that I like.
					</p>
				</div>
				<div className="flex flex-col gap-4 text-base sm:flex-row">
					<a
						className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] md:w-[158px]"
						href={`mailto:${EMAIL}`}
						target="_blank"
						rel="noopener noreferrer"
					>
						Contact Me
					</a>
					<a
						className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/8 px-5 transition-colors hover:border-transparent hover:bg-black/4 dark:border-white/[.145] dark:hover:bg-[#1a1a1a] md:w-[158px]"
						href={GITHUB_PROFILE}
						target="_blank"
						rel="noopener noreferrer"
					>
						GitHub
					</a>
				</div>
			</main>
		</div>
	);
}
