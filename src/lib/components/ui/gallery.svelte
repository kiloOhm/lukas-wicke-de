<script lang="ts">
	import type { ImageInfo } from '../../../types';
	const { images }: { images: ImageInfo[] } = $props();
</script>

{#snippet figure({ src, alt, title, href }: ImageInfo)}
	<figure
		class={`
				[container-type:inline-size] relative mb-4
				break-inside-avoid overflow-hidden
				rounded-sm [contain-intrinsic-size:300px_200px] [content-visibility:auto]
				supports-[grid-template-rows:masonry]:mb-0
				${href ? 'transition-transform duration-500 hover:scale-102' : ''}
			`}
	>
		<img
			{src}
			{alt}
			loading="lazy"
			decoding="async"
			class={`block h-auto w-full ${href ? 'transition-transform duration-500 hover:scale-115' : ''}`}
		/>
		{#if title}
			<figcaption class="pointer-events-none absolute inset-0">
				<!-- 1) Blur layer, revealed by a vertical gradient mask -->
				<div
					class="
						absolute inset-0 [mask-image:linear-gradient(to_top,black_30%,transparent)]
						backdrop-blur-sm
						[-webkit-mask-image:linear-gradient(to_top,black_30%,transparent)]
					"
				></div>

				<!-- 2) Optional color tint on top of the blur -->
				<div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>

				<!-- 3) Accessible text + your visual SVG title -->
				<span class="sr-only">{title}</span>
				<svg aria-hidden="true" class="absolute inset-x-0 -bottom-[1.7rem] h-[8rem] w-full">
					<text
						x="0"
						y="100%"
						dominant-baseline="ideographic"
						textLength="90%"
						lengthAdjust="spacingAndGlyphs"
						class="fill-white/30 [font-size:8rem] font-[700]"
					>
						{title}
					</text>
				</svg>
			</figcaption>
		{/if}
	</figure>
{/snippet}

<article
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
	{#each images as img}
		{#if img.href}
			<a href={img.href} rel="noreferrer noopener">
				{@render figure(img)}
			</a>
		{:else}
			{@render figure(img)}
		{/if}
	{/each}
</article>
