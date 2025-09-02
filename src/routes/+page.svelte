<script lang="ts">
	import Gallery from '$lib/components/ui/gallery.svelte';
	import type { CollectionInfo, ImageInfo } from '../types';
	import { m } from '$lib/paraglide/messages';

	const rootImages: ImageInfo[] = [
		{
			title: m.contact(),
			href: 'https://www.instagram.com/lukasdabbelju/',
			alt: 'Photographer in Reflection',
			src: 'https://imagedelivery.net/k1HQsavJfzZQlI3O3ZBS7Q/9f15afec-920f-4385-e8e2-088144713e00/public'
		},
		{
			alt: 'Bridge under dark clouds',
			src: 'https://imagedelivery.net/k1HQsavJfzZQlI3O3ZBS7Q/8fc8c582-f9bc-4b78-c3ef-6a5512c73400/public'
		},
		{
			alt: 'bronze woman stature',
			src: 'https://imagedelivery.net/k1HQsavJfzZQlI3O3ZBS7Q/df0aae74-56c4-4c03-fac7-e6a2f678ef00/public'
		},
		{
			alt: 'little girl in red dress sticker',
			src: 'https://imagedelivery.net/k1HQsavJfzZQlI3O3ZBS7Q/64d6da33-438d-4127-1dbd-7155fbd75f00/public'
		},
		{
			alt: 'Colorful Rocks',
			src: 'https://imagedelivery.net/k1HQsavJfzZQlI3O3ZBS7Q/59ffa716-d204-46c7-4901-5a4e077ea000/public'
		},
		{
			src: 'https://imagedelivery.net/k1HQsavJfzZQlI3O3ZBS7Q/b436f869-88d7-422d-d450-e7246ff41d00/public',
			alt: 'red ropes'
		}
	];
</script>

<svelte:head>
	<title>Lukas Wicke</title>
	<meta name="description" content="Lukas Wicke Photography" />
</svelte:head>

<section>
	<Gallery images={rootImages} />
</section>
