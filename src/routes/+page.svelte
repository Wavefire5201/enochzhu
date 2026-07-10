<script lang="ts">
import AboutSection from "$lib/components/About.svelte";
import Experience from "$lib/components/Experience.svelte";
import Footer from "$lib/components/Footer.svelte";
import Hero from "$lib/components/Hero.svelte";
import Photos from "$lib/components/Photos.svelte";
import Projects from "$lib/components/Projects.svelte";
import { about, photos, projects } from "$lib/content";
</script>

<svelte:head>
	<title>enoch zhu</title>
	<meta name="description" content="enoch zhu — cs @ ut austin. projects and photos." />
</svelte:head>

<main>
	{#if about}
		<Hero about={about.meta} />
	{/if}

	<Projects {projects} />
	{#if about}
		<Experience about={about.meta} />
	{/if}
	<Photos {photos} />

	{#if about}
		<AboutSection about={about.meta} />
		<Footer about={about.meta} />
	{/if}
</main>
