<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import type { Snippet } from 'svelte';
	import type { GalleryImage, GalleryItemInfo } from '../../../types';

	const EAGER_LOAD_COUNT = 4;
	const BLANK_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

	const imageSizes = $derived(() => {
		const w = Math.max(1, Math.round(actualColumnWidth()));
		return `${w}px`;
	});

	// Masonry knobs (tweak to taste)
	const TARGET_COLUMN_WIDTH = 400; // roughly matches your old minmax(400px, 1fr)
	const GAP = 8;
	const MAX_COLUMNS = 0; // 0 = no cap

	const {
		images,
		extra
	}: { images: GalleryImage[]; extra?: Snippet<[{ info: GalleryItemInfo }]> } = $props();

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
		if (!node.src) node.src = BLANK_IMAGE;

		function apply(p: LazySrcParams) {
			if (typeof p === 'string') {
				node.src = p;
				return;
			}
			node.src = p.src;
			if (p.srcset) node.srcset = p.srcset;
			if (p.sizes) node.sizes = p.sizes;
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
				if (seen) apply(current);
			},
			destroy() {
				io.disconnect();
			}
		};
	}

	// --- Balanced masonry layout ---
	let container = $state<HTMLElement | null>(null);
	let containerWidth = $state(0);
	let ro: ResizeObserver | null = null;

	onMount(() => {
		if (!container) return;
		ro = new ResizeObserver(([entry]) => (containerWidth = entry.contentRect.width));
		ro.observe(container);
	});

	onDestroy(() => ro?.disconnect());

	const columnCount = $derived(() => {
		const w = containerWidth || 0;
		if (w <= 0) return 1;

		const raw = Math.max(1, Math.floor((w + GAP) / (TARGET_COLUMN_WIDTH + GAP)));
		return MAX_COLUMNS && MAX_COLUMNS > 0 ? Math.min(raw, MAX_COLUMNS) : raw;
	});

	const actualColumnWidth = $derived(() => {
		const n = columnCount();
		const w = containerWidth || 0;
		if (w <= 0) return TARGET_COLUMN_WIDTH;
		const totalGap = GAP * (n - 1);
		return Math.max(1, (w - totalGap) / n);
	});

	const columns = $derived(() => {
		const n = columnCount();
		const colW = actualColumnWidth();
		const cols: { items: { img: GalleryImage; index: number }[]; h: number }[] = Array.from(
			{ length: n },
			() => ({ items: [], h: 0 })
		);

		for (let i = 0; i < (images?.length ?? 0); i++) {
			const img = images[i];
			const w = img.width || 1;
			const h = img.height || 1;

			const scaledH = (colW * h) / w;

			// pick the currently shortest column
			let target = 0;
			for (let c = 1; c < n; c++) if (cols[c].h < cols[target].h) target = c;

			cols[target].items.push({ img, index: i });
			cols[target].h += scaledH + GAP;
		}

		return cols.map((c) => c.items);
	});

	function srcsetFor(img: GalleryImage) {
		return `${img.src400} 400w, ${img.src800} 800w, ${img.src1440} 1440w, ${img.src4k} 3840w, ${img.src8k} 7680w`;
	}
</script>

<article aria-label="Photo gallery" class="masonry" bind:this={container} style={`--gap:${GAP}px;`}>
	{#each columns() as col, colIndex (colIndex)}
		<div class="col">
			{#each col as item (item.img.id)}
				<figure
					class="card"
					style={`--w:${item.img.width};--h:${item.img.height}; aspect-ratio:${item.img.width}/${item.img.height};`}
				>
					{#if item.img.href}
						<a
							href={item.img.href}
							rel="noreferrer noopener"
							class="media"
							aria-label={item.img.title ?? item.img.alt ?? 'Open image'}
						>
							{#if item.index < EAGER_LOAD_COUNT}
								<img
									class="img"
									alt={item.img.alt}
									width={item.img.width}
									height={item.img.height}
									src={item.img.src400}
									srcset={srcsetFor(item.img)}
									sizes={imageSizes()}
									loading="eager"
									decoding="async"
									fetchpriority="high"
								/>
							{:else}
								<img
									class="img"
									alt={item.img.alt}
									width={item.img.width}
									height={item.img.height}
									src={BLANK_IMAGE}
									use:lazySrc={{
										src: item.img.src400,
										srcset: srcsetFor(item.img),
										sizes: imageSizes()
									}}
									loading="lazy"
									decoding="async"
								/>
							{/if}
						</a>
					{:else if item.index < EAGER_LOAD_COUNT}
						<img
							class="img"
							alt={item.img.alt}
							width={item.img.width}
							height={item.img.height}
							src={item.img.src400}
							srcset={srcsetFor(item.img)}
							sizes={imageSizes()}
							loading="eager"
							decoding="async"
							fetchpriority="high"
						/>
					{:else}
						<img
							class="img"
							alt={item.img.alt}
							width={item.img.width}
							height={item.img.height}
							src={BLANK_IMAGE}
							use:lazySrc={{
								src: item.img.src400,
								srcset: srcsetFor(item.img),
								sizes: imageSizes()
							}}
							loading="lazy"
							decoding="async"
						/>
					{/if}

					{#if extra}
						<!-- overlay: lets the underlying link/image remain clickable -->
						<div class="extra">
							{@render extra({ info: item.img })}
						</div>
					{/if}

					{#if item.img.title}
						<!-- your existing figcaption -->
					{/if}
				</figure>
			{/each}
		</div>
	{/each}
</article>

<style>
	.masonry {
		display: flex;
		gap: var(--gap);
		align-items: flex-start;
		width: 100%;
	}

	.col {
		flex: 1 1 0;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: var(--gap);
	}

	.card {
		position: relative;
		overflow: hidden;
		border-radius: 4px;
		container-type: inline-size;
	}

	.media {
		display: block;
	}

	.img {
		display: block;
		width: 100%;
		height: auto;
		object-fit: cover;
		aspect-ratio: inherit;

		content-visibility: auto;
		contain-intrinsic-size: 400px 300px;
		font-size: 0px;
	}

	/* Overlay behaviour: doesn't block image/link clicks except on actual controls */
	.extra {
		position: absolute;
		inset: 0;
		z-index: 2;
		pointer-events: none;
	}

	.extra :global(button),
	.extra :global(a),
	.extra :global(input),
	.extra :global(select),
	.extra :global(textarea),
	.extra :global(label),
	.extra :global(form) {
		pointer-events: auto;
	}
</style>
