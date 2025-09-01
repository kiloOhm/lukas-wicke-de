<!-- <section
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
</section> -->
