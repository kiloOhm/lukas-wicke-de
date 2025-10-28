<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { GalleryItemInfo } from '../../../types';
	const {
		images,
		extra
	}: { images: GalleryItemInfo[]; extra?: Snippet<[{ info: GalleryItemInfo }]> } = $props();
</script>

{#snippet figure({ src, alt, title, href, id, width, height }: GalleryItemInfo, eager = false)}
  <figure
    class="
      [container-type:inline-size] relative mb-4
      break-inside-avoid overflow-hidden rounded-sm
      supports-[grid-template-rows:masonry]:mb-0
      {href ? 'transition-transform duration-250 hover:scale-[1.01]' : ''}
    "
    style={`aspect-ratio:${width}/${height}; content-visibility:auto; contain-intrinsic-size:${Math.round(width ?? 0)}px ${Math.round(height ?? 0)}px;`}
  >
    <img
      src={src}
      alt={alt} 
      width={width}
      height={height}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      fetchpriority={eager ? 'high' : undefined}
      class={`block h-auto w-full ${href ? 'transition-transform duration-250 hover:scale-[1.01]' : ''}`}
      style="aspect-ratio:inherit; object-fit:cover;"
    />

    {#if extra}
      <div class="absolute inset-0 p-4">
        {@render extra({ info: { src, alt, title, href, id, width, height } })}
      </div>
    {/if}

    {#if title}
      <figcaption class="pointer-events-none absolute inset-0">
        <div class="absolute inset-0 [mask-image:linear-gradient(to_top,black_30%,transparent)] backdrop-blur-xs [-webkit-mask-image:linear-gradient(to_top,black_30%,transparent)]"></div>
        <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
        <span class="sr-only">{title}</span>
        <svg aria-hidden="true" class="absolute inset-x-0 -bottom-[1.7rem] h-[8rem] w-full">
          <text x="0" y="100%" dominant-baseline="ideographic" textLength="80%" lengthAdjust="spacingAndGlyphs" class="fill-white/30 [font-size:8rem] font-[700]">
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
	{#each images as img, i}
		{#if img.href}
			<a href={img.href} rel="noreferrer noopener">
				{@render figure(img, i < 6)}
			</a>
		{:else}
			{@render figure(img, i < 6)}
		{/if}
	{/each}
</article>
