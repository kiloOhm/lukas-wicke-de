<script lang="ts">
	import type { GalleryItemInfo } from '../../../types';
	const { images, extra }: { images: GalleryItemInfo[]; extra?: any } = $props();

	// Svelte action: make grid-row span match the *rendered* height
	function spanByAspect(node: HTMLElement) {
		let ro: ResizeObserver | null = null;

		const fig = node as HTMLElement; // the <figure>
		const img = fig.querySelector('img') as HTMLImageElement | null;

		function apply() {
			const grid = fig.parentElement as HTMLElement;
			if (!grid) return;

			// 1) Read actual grid metrics so JS == CSS
			const cs = getComputedStyle(grid);
			const row = parseFloat(cs.gridAutoRows || '1'); // px
			const gap = parseFloat(cs.rowGap || '0'); // px

			// 2) Measure actual track width for this card
			const colWidth = fig.clientWidth || fig.getBoundingClientRect().width || 1;

			// 3) Get the intended aspect (prefer your --w/--h; fall back to actual image)
			const w =
				Number(fig.style.getPropertyValue('--w')) ||
				Number(img?.getAttribute('width')) ||
				(img?.naturalWidth ?? 1);

			const h =
				Number(fig.style.getPropertyValue('--h')) ||
				Number(img?.getAttribute('height')) ||
				(img?.naturalHeight ?? 1);

			// 4) Target *rendered* height
			const target = (h / w) * colWidth;

			// 5) Convert to rows. Use ceil with a tiny epsilon to avoid off-by-one bumps.
			//    height ≈ r*row + (r-1)*gap  =>  r = (height + gap) / (row + gap)
			const span = Math.max(1, Math.ceil((target + gap) / (row + gap) - 0.001));

			fig.style.gridRowEnd = `span ${span}`;
		}

		// Recompute when the grid/figure changes size…
		ro = new ResizeObserver(apply);
		ro.observe(fig);
		if (fig.parentElement) ro.observe(fig.parentElement);

		// …and once the image knows its real size.
		if (img && !img.complete) {
			img.addEventListener('load', apply, { once: true });
		}

		apply();

		return {
			destroy() {
				ro?.disconnect();
			}
		};
	}

	// IO-powered lazy: set src only when visible (works reliably vs columns)
	function lazySrc(node: HTMLImageElement, src: string) {
		// Avoid native lazy when we control it — some browsers overfetch with masonry/columns
		node.loading = 'eager';
		const io = new IntersectionObserver(
			(entries) => {
				for (const e of entries) {
					if (e.isIntersecting) {
						node.src = src;
						io.disconnect();
						break;
					}
				}
			},
			{ rootMargin: '400px' } // pre-load a bit before it appears
		);
		io.observe(node);
		return {
			destroy() {
				io.disconnect();
			}
		};
	}
</script>

<article aria-label="Photo gallery" class="masonry">
	{#each images as img, i}
		<figure
			class="card"
			use:spanByAspect
			style={`--w:${img.width};--h:${img.height}; aspect-ratio:${img.width}/${img.height};`}
		>
			{#if img.href}
				<a
					href={img.href}
					rel="noreferrer noopener"
					class="block"
					aria-label={img.title ?? img.alt ?? 'Open image'}
				>
					<img
						class="img"
						alt={img.alt}
						width={img.width}
						height={img.height}
						use:lazySrc={img.src}
						decoding="async"
						fetchpriority={i < 6 ? 'high' : undefined}
					/>
				</a>
			{:else}
				<img
					class="img"
					alt={img.alt}
					width={img.width}
					height={img.height}
					use:lazySrc={img.src}
					decoding="async"
					fetchpriority={i < 6 ? 'high' : undefined}
				/>
			{/if}
			{#if extra}
				<div class="absolute inset-0 p-4">
					{@render extra({ info: img })}
				</div>
			{/if}
			{#if img.title}
				<figcaption class="pointer-events-none absolute inset-0">
					<div
						class="absolute inset-0 [mask-image:linear-gradient(to_top,black_30%,transparent)] backdrop-blur-xs [-webkit-mask-image:linear-gradient(to_top,black_30%,transparent)]"
					></div>
					<div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
					<span class="sr-only">{img.title}</span>
					<svg aria-hidden="true" class="absolute inset-x-0 -bottom-[1.7rem] h-[8rem] w-full">
						<text
							x="0"
							y="100%"
							dominant-baseline="ideographic"
							textLength="80%"
							lengthAdjust="spacingAndGlyphs"
							class="fill-white/30 [font-size:8rem] font-[700]"
						>
							{img.title}
						</text>
					</svg>
				</figcaption>
			{/if}
		</figure>
	{/each}
</article>

<style>
	/* Grid container */
	.masonry {
		display: grid;
		grid-auto-rows: 2px; /* the “row unit” */
		gap: 8px; /* must match the JS ‘gap’ */
		grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
	}

	/* Card */
	.card {
		position: relative;
		overflow: hidden;
		border-radius: 4px;
		container-type: inline-size;
	}

	.img {
		display: block;
		width: 100%;
		height: auto;
		object-fit: cover;
		aspect-ratio: inherit;
		/* These still help with rendering cost */
		content-visibility: auto;
		contain-intrinsic-size: 400px 300px;
	}
</style>
