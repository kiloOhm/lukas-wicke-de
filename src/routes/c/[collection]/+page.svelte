<script lang="ts">
	import type { PageProps } from './$types';
	import Gallery from '$lib/components/ui/gallery.svelte';
	import type { GalleryItemInfo } from '../../../types';
	import ImageCommentsOverlay from '$lib/components/ui/ImageCommentsOverlay.svelte';

	type ImageWithHref = GalleryItemInfo & {
		href: string;
		src400: string;
		src800: string;
		src1440: string;
		src4k: string;
		src8k: string;
	};

	const { data } = $props() as PageProps;

	const images: ImageWithHref[] = data.images.map((img) => ({
		...img,
		// href: img.src8k,
		href: `/c/${data.name}/export/${img.id}`
	}));

	const commentCounts: Record<string, number> = data.commentCounts ?? {};
</script>

{#snippet imageExtra({ info }: any)}
	<ImageCommentsOverlay {info} collection={data.name} initialCount={commentCounts[info.id] ?? 0} />
{/snippet}

<svelte:head>
	<title>{data.name}</title>
	<meta name="description" content="{data.name} - Ess Ridley Photography" />
</svelte:head>

<section>
	<Gallery {images} extra={imageExtra} />
</section>
