<script lang="ts">
	import About from "$lib/components/About.svelte";
	import Contact from "$lib/components/Contact.svelte";
	import Experience from "$lib/components/Experience.svelte";
	import Footer from "$lib/components/Footer.svelte";
	import Hero from "$lib/components/Hero.svelte";
	import Music from "$lib/components/Music.svelte";
	import Photos from "$lib/components/Photos.svelte";
	import Projects from "$lib/components/Projects.svelte";
	import Seo from "$lib/components/Seo.svelte";
	import { about, music, photos, projects } from "$lib/content";

	// Person structured data for richer search results
	const jsonld = about
		? JSON.stringify({
				"@context": "https://schema.org",
				"@type": "Person",
				name: about.meta.name,
				url: "https://enochzhu.com",
				jobTitle: about.meta.title,
				sameAs: Object.values(about.meta.links).filter((u) =>
					u.startsWith("http"),
				),
			})
		: null;
</script>

<Seo
	title="enoch zhu ・ cs @ ut austin"
	description="enoch zhu ・ cs @ ut austin. projects and photos."
/>

<svelte:head>
	{#if jsonld}
		<script type="application/ld+json">
			{@html jsonld}
		</script>
	{/if}
</svelte:head>

<main>
	{#if about}
		<Hero about={about.meta} />
	{/if}

	{#if about}
		<About about={about.meta} />
	{/if}

	{#if about}
		<Experience about={about.meta} />
	{/if}

	<Projects {projects} />

	<Photos {photos} />

	{#if about}
		<Contact about={about.meta} />
	{/if}

	<Music {music} />
	<Footer />
</main>
