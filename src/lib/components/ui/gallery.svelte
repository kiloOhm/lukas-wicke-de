<script lang="ts">
  import type { GalleryItemInfo } from '../../../types';
  const { images, extra }:{ images: GalleryItemInfo[]; extra?: any } = $props();

  // computes grid-row span based on known aspect ratio + current column width
  function spanByAspect(node: HTMLElement, opts: { row: number; gap: number }) {
    let ro: ResizeObserver | null = null;
    const figure = node; // the <figure>
    const img = figure.querySelector('img') as HTMLImageElement | null;
    const { row, gap } = opts;

    function apply() {
      const card = figure; // figure’s grid item
      const col = (card.parentElement as HTMLElement); // the grid container
      if (!col) return;

      // compute the current column width (first track’s width is fine for uniform grid)
      const styles = getComputedStyle(col);
      // Parse grid-template-columns to estimate one column width
      const cols = styles.gridTemplateColumns.split(' ').length;
      const colWidth = (col.clientWidth - (cols - 1) * gap) / cols;

      // pull intended intrinsic size (set below as CSS vars)
      const w = Number(figure.style.getPropertyValue('--w') || img?.getAttribute('width') || 1);
      const h = Number(figure.style.getPropertyValue('--h') || img?.getAttribute('height') || 1);

      const targetPxHeight = (h / w) * colWidth;
      const span = Math.ceil((targetPxHeight + gap) / (row + gap));
      figure.style.gridRowEnd = `span ${span}`;
    }

    ro = new ResizeObserver(apply);
    ro.observe(figure.parentElement as Element);
    apply();

    return {
      destroy() { ro?.disconnect(); }
    };
  }

  // IO-powered lazy: set src only when visible (works reliably vs columns)
  function lazySrc(node: HTMLImageElement, src: string) {
    // Avoid native lazy when we control it — some browsers overfetch with masonry/columns
    node.loading = 'eager';
    const io = new IntersectionObserver(
      entries => {
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
    return { destroy() { io.disconnect(); } };
  }
</script>

<style>
  /* Grid container */
  .masonry {
    display: grid;
    grid-auto-rows: 8px;       /* the “row unit” */
    gap: 16px;                  /* must match the JS ‘gap’ */
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

<article aria-label="Photo gallery" class="masonry">
  {#each images as img, i}
    {#if img.href}
      <a href={img.href} rel="noreferrer noopener">
        <figure
          class="card"
          use:spanByAspect={{ row: 8, gap: 16 }}
          style={`--w:${img.width};--h:${img.height}; aspect-ratio:${img.width}/${img.height};`}
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
          {#if extra}
            <div class="absolute inset-0 p-4">
              {@render extra({ info: img })}
            </div>
          {/if}
          {#if img.title}
            <figcaption class="pointer-events-none absolute inset-0"> 
              <div class="absolute inset-0 [mask-image:linear-gradient(to_top,black_30%,transparent)] backdrop-blur-xs [-webkit-mask-image:linear-gradient(to_top,black_30%,transparent)]"></div>
              <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div> 
              <span class="sr-only">{img.title}</span> 
              <svg aria-hidden="true" class="absolute inset-x-0 -bottom-[1.7rem] h-[8rem] w-full"> 
                <text x="0" y="100%" dominant-baseline="ideographic" textLength="80%" lengthAdjust="spacingAndGlyphs" class="fill-white/30 [font-size:8rem] font-[700]"> 
                  {img.title} 
                </text> 
              </svg> 
            </figcaption>
          {/if}
        </figure>
      </a>
    {:else}
      <figure
        class="card"
        use:spanByAspect={{ row: 8, gap: 16 }}
        style={`--w:${img.width};--h:${img.height}; aspect-ratio:${img.width}/${img.height};`}
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
        {#if extra}
          <div class="absolute inset-0 p-4">
            {@render extra({ info: img })}
          </div>
        {/if}
        {#if img.title}
          <figcaption class="pointer-events-none absolute inset-0"> 
            <div class="absolute inset-0 [mask-image:linear-gradient(to_top,black_30%,transparent)] backdrop-blur-xs [-webkit-mask-image:linear-gradient(to_top,black_30%,transparent)]"></div>
            <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div> 
            <span class="sr-only">{img.title}</span> 
            <svg aria-hidden="true" class="absolute inset-x-0 -bottom-[1.7rem] h-[8rem] w-full"> 
              <text x="0" y="100%" dominant-baseline="ideographic" textLength="80%" lengthAdjust="spacingAndGlyphs" class="fill-white/30 [font-size:8rem] font-[700]"> 
                {img.title} 
              </text> 
            </svg> 
          </figcaption>
        {/if}
      </figure>
    {/if}
  {/each}
</article>
