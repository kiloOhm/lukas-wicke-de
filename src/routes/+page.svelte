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
		{
			alt: 'Bridge under dark clouds',
			id: '8fc8c582-f9bc-4b78-c3ef-6a5512c73400',
			src: 'https://imagedelivery.net/k1HQsavJfzZQlI3O3ZBS7Q/8fc8c582-f9bc-4b78-c3ef-6a5512c73400/public',
			width: 1366,
			height: 910
		},
		{
			alt: 'candy',
			id: '5e3020f1-8a3a-4fc9-fb42-78b4de8c8901',
			src: 'https://imagedelivery.net/k1HQsavJfzZQlI3O3ZBS7Q/5e3020f1-8a3a-4fc9-fb42-78b4de8c8901/public',
			width: 1366,
			height: 764
		},
		{
			alt: 'bronze woman stature',
			id: 'df0aae74-56c4-4c03-fac7-e6a2f678ef00',
			src: 'https://imagedelivery.net/k1HQsavJfzZQlI3O3ZBS7Q/df0aae74-56c4-4c03-fac7-e6a2f678ef00/public',
			width: 910,
			height: 1366
		},
		{
			alt: 'little girl in red dress sticker',
			id: '64d6da33-438d-4127-1dbd-7155fbd75f00',
			src: 'https://imagedelivery.net/k1HQsavJfzZQlI3O3ZBS7Q/64d6da33-438d-4127-1dbd-7155fbd75f00/public',
			width: 910,
			height: 1366
		},
		{
			alt: 'Colorful Rocks',
			id: '59ffa716-d204-46c7-4901-5a4e077ea000',
			src: 'https://imagedelivery.net/k1HQsavJfzZQlI3O3ZBS7Q/59ffa716-d204-46c7-4901-5a4e077ea000/public',
			width: 1366,
			height: 910
		},
		{
			alt: 'red ropes',
			id: 'b436f869-88d7-422d-d450-e7246ff41d00',
			src: 'https://imagedelivery.net/k1HQsavJfzZQlI3O3ZBS7Q/b436f869-88d7-422d-d450-e7246ff41d00/public',
			width: 1366,
			height: 910
		},
		{
			alt: 'colorful skulls in a row',
			id: '4c87dc53-9c79-495c-938d-ade3d5361c01',
			src: 'https://imagedelivery.net/k1HQsavJfzZQlI3O3ZBS7Q/4c87dc53-9c79-495c-938d-ade3d5361c01/public',
			width: 1366,
			height: 764
		}
	];

	if (data.authenticated) {
		rootImages.unshift({
			title: 'ADMIN',
			href: '/admin',
			alt: 'Bridge under dark clouds',
			id: '8fc8c582-f9bc-4b78-c3ef-6a5512c73400',
			src: 'https://imagedelivery.net/k1HQsavJfzZQlI3O3ZBS7Q/8fc8c582-f9bc-4b78-c3ef-6a5512c73400/public',
			width: 1366,
			height: 910
		});
	}
</script>

<svelte:head>
	<title>Lukas Wicke</title>
	<meta name="description" content="Lukas Wicke Photography" />
</svelte:head>

<section>
	<Gallery images={rootImages} />
</section>
