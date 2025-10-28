<script lang="ts">
	import type { PageProps } from './$types';
	import Gallery from '$lib/components/ui/gallery.svelte';
	import type { GalleryItemInfo } from '../../../types';

	const { data } = $props() as PageProps;

	const images: GalleryItemInfo[] = data.images.map((img) => ({
		...img,
		href: `/c/${data.name}/export/${img.id}`
	}));
</script>

<svelte:head>
	<title>{data.name}</title>
	<meta name="description" content="{data.name} - Lukas Wicke Photography" />
</svelte:head>

<section>
	<Gallery images={images} />
</section>
