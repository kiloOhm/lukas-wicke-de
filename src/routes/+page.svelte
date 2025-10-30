<script lang="ts">
	import Gallery from '$lib/components/ui/gallery.svelte';
	import type { GalleryItemInfo } from '../types';
	import { m } from '$lib/paraglide/messages';

	const { data } = $props();

	const rootImages: GalleryItemInfo[] = [
		{
			title: m.contact(),
			href: 'https://www.instagram.com/lukasdabbelju/',
			alt: 'Photographer in Reflection',
			id: '9f15afec-920f-4385-e8e2-088144713e00',
			src: 'https://imagedelivery.net/k1HQsavJfzZQlI3O3ZBS7Q/9f15afec-920f-4385-e8e2-088144713e00/public',
			width: 1366,
			height: 910
		},
	];
</script>

<svelte:head>
	<title>Ess Ridley</title>
	<meta name="description" content="Ess Ridley Photography" />
</svelte:head>

<section>
	<h1>Ess Ridley Photography</h1>
	<!-- <Gallery images={rootImages} /> -->
</section>
