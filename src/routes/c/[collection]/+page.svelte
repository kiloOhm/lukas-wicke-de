<script lang="ts">
	import type { PageProps } from './$types';

	const { data, params } = $props() as PageProps;
</script>

<svelte:head>
	<title>{params.collection}</title>
	<meta name="description" content="{params.collection} - Lukas Wicke Photography" />
</svelte:head>

<section>
	<header>
		<h1>{params.collection}</h1>
	</header>

	<pre><code>{JSON.stringify(data, null, 2)}</code></pre>

	<article
		aria-label="Photo gallery"
		class="
		columns-1
		gap-x-4
    p-8
		supports-[grid-template-rows:masonry]:grid
		supports-[grid-template-rows:masonry]:grid-cols-1
		supports-[grid-template-rows:masonry]:gap-4
		sm:columns-1
    sm:supports-[grid-template-rows:masonry]:grid-cols-2
    md:columns-2
    md:supports-[grid-template-rows:masonry]:grid-cols-2
    lg:p-16
	"
	>
		{#each data.images as [title, src]}
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
	</article>

	<footer>
		<button>DOWNLOAD ALL</button>
	</footer>
</section>
