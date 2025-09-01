<script lang="ts">
	const images: [string, string][] = [
		[
			'red ropes',
			'https://imagedelivery.net/k1HQsavJfzZQlI3O3ZBS7Q/b436f869-88d7-422d-d450-e7246ff41d00/public'
		],
		[
			'Bridge under dark clouds',
			'https://imagedelivery.net/k1HQsavJfzZQlI3O3ZBS7Q/8fc8c582-f9bc-4b78-c3ef-6a5512c73400/public'
		],
		[
			'bronze woman stature',
			'https://imagedelivery.net/k1HQsavJfzZQlI3O3ZBS7Q/df0aae74-56c4-4c03-fac7-e6a2f678ef00/public'
		],
		[
			'little girl in red dress sticker',
			'https://imagedelivery.net/k1HQsavJfzZQlI3O3ZBS7Q/64d6da33-438d-4127-1dbd-7155fbd75f00/public'
		],
		[
			'Colorful Rocks',
			'https://imagedelivery.net/k1HQsavJfzZQlI3O3ZBS7Q/59ffa716-d204-46c7-4901-5a4e077ea000/public'
		],
		[
			'Photographer in Reflection',
			'https://imagedelivery.net/k1HQsavJfzZQlI3O3ZBS7Q/9f15afec-920f-4385-e8e2-088144713e00/public'
		]
	];
</script>

<svelte:head>
	<title>Lukas Wicke</title>
	<meta name="description" content="Lukas Wicke Photography" />
</svelte:head>

<section
	aria-label="Photo gallery"
	class="
		-mb-3
		columns-1
		gap-x-4
		supports-[grid-template-rows:masonry]:grid
		supports-[grid-template-rows:masonry]:grid-cols-1
		supports-[grid-template-rows:masonry]:gap-4
		sm:columns-1
    sm:supports-[grid-template-rows:masonry]:grid-cols-2
    md:columns-2
    md:supports-[grid-template-rows:masonry]:grid-cols-2
	"
>
	{#each images as [title, src]}
		<figure
			class="
				mb-4 break-inside-avoid
				[contain-intrinsic-size:300px_200px]
				[content-visibility:auto] supports-[grid-template-rows:masonry]:mb-0
			"
		>
			<img
				{src}
				alt={`by Lukas Wicke - ${title}`}
				loading="lazy"
				decoding="async"
				class="block h-auto w-full rounded-sm"
			/>
		</figure>
	{/each}
</section>
