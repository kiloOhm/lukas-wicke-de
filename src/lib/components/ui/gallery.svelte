<script lang="ts">
	import type { GalleryItemInfo } from '../../../types';

	const EAGER_LOAD_COUNT = 4;
	const BLANK_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

	// Roughly matches your masonry layout:
	// - small screens: full width
	// - medium: half width
	// - large: ~third of viewport
	const RESPONSIVE_SIZES = '(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 33vw';

	// Allow optional href + the srcset variants
	type GalleryImage = GalleryItemInfo & {
		href?: string;
		src400: string;
		src800: string;
		src1440: string;
		src4k: string;
		src8k: string;
	};

	const { images, extra }: { images: GalleryImage[]; extra?: any } = $props();

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

	// IO-powered lazy: set src / srcset / sizes only when visible
	type LazySrcParams =
		| string
		| {
				src: string;
				srcset?: string;
				sizes?: string;
		  };

	function lazySrc(node: HTMLImageElement, params: LazySrcParams) {
		node.loading = 'eager';

		let current = params;
		let seen = false;

		// prevent browser from showing alt text before we swap in the real src
		if (!node.src) {
			node.src = BLANK_IMAGE;
		}

		function apply(p: LazySrcParams) {
			if (typeof p === 'string') {
				node.src = p;
				return;
			}

			node.src = p.src;

			if (p.srcset) {
				node.srcset = p.srcset;
			}

			if (p.sizes) {
				node.sizes = p.sizes;
			}
		}

		const io = new IntersectionObserver(
			(entries) => {
				for (const e of entries) {
					if (e.isIntersecting) {
						apply(current);
						seen = true;
						io.disconnect();
						break;
					}
				}
			},
			{ rootMargin: '800px' }
		);

		io.observe(node);

		return {
			update(next: LazySrcParams) {
				current = next;
				if (seen) {
					apply(current);
				}
			},
			destroy() {
				io.disconnect();
			}
		};
	}
</script>

<article aria-label="Photo gallery" class="masonry">
	{#each images as img, i (img.id)}
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
					{#if i < EAGER_LOAD_COUNT}
						<!-- Eager-load first ... -->
						<img
							class="img"
							alt={img.alt}
							width={img.width}
							height={img.height}
							src={img.src1440}
							srcset={`${img.src400} 400w, ${img.src800} 800w, ${img.src1440} 1440w, ${img.src4k} 3840w, ${img.src8k} 7680w`}
							sizes={RESPONSIVE_SIZES}
							loading="eager"
							decoding="async"
							fetchpriority="high"
						/>
					{:else}
						<!-- Lazy-load the rest -->
						<img
							class="img"
							alt={img.alt}
							width={img.width}
							height={img.height}
							src={BLANK_IMAGE}
							use:lazySrc={{
								src: img.src1440,
								srcset: `${img.src400} 400w, ${img.src800} 800w, ${img.src1440} 1440w, ${img.src4k} 3840w, ${img.src8k} 7680w`,
								sizes: RESPONSIVE_SIZES
							}}
							loading="lazy"
							decoding="async"
						/>
					{/if}
				</a>
			{:else if i < EAGER_LOAD_COUNT}
				<img
					class="img"
					alt={img.alt}
					width={img.width}
					height={img.height}
					src={img.src1440}
					srcset={`${img.src400} 400w, ${img.src800} 800w, ${img.src1440} 1440w, ${img.src4k} 3840w, ${img.src8k} 7680w`}
					sizes={RESPONSIVE_SIZES}
					loading="eager"
					decoding="async"
					fetchpriority="high"
				/>
			{:else}
				<img
					class="img"
					alt={img.alt}
					width={img.width}
					height={img.height}
					src={BLANK_IMAGE}
					use:lazySrc={{
						src: img.src1440,
						srcset: `${img.src400} 400w, ${img.src800} 800w, ${img.src1440} 1440w, ${img.src4k} 3840w, ${img.src8k} 7680w`,
						sizes: RESPONSIVE_SIZES
					}}
					loading="lazy"
					decoding="async"
				/>
			{/if}

			{#if extra}
				<div class="absolute inset-0 p-4">
					{@render extra({ info: img })}
				</div>
			{/if}

			{#if img.title}
				<!-- your existing figcaption -->
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
		font-size: 0px;
	}
</style>
