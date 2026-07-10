<script lang="ts">
import { page } from "$app/state";
import FogNotFound from "$lib/components/FogNotFound.svelte";
</script>

<svelte:head>
	<title>{page.status}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<FogNotFound
	status={page.status}
	message={page.status === 404 ? 'no route to host' : 'connection reset by peer'}
/>
