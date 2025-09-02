<script lang="ts">
	import type { PageProps } from './$types';
	import Gallery from '$lib/components/ui/gallery.svelte';

	const { data } = $props() as PageProps;
</script>

<svelte:head>
	<title>{data.name}</title>
	<meta name="description" content="{data.name} - Lukas Wicke Photography" />
</svelte:head>

<section>
	<Gallery images={data.images} />
</section>
