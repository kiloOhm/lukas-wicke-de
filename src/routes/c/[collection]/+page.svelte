<script lang="ts">
	import type { PageProps } from './$types';
	import Gallery from '$lib/components/ui/gallery.svelte';
	import { enhance } from '$app/forms';
	import type { GalleryItemInfo } from '../../../types';
	import IDownload from '$lib/components/icons/i-download.svelte';

	const { data } = $props() as PageProps;
</script>

<svelte:head>
	<title>{data.name}</title>
	<meta name="description" content="{data.name} - Lukas Wicke Photography" />
</svelte:head>

<section>
	{#snippet exportImage({ info }: { info: GalleryItemInfo })}
		<a
			href="/c/{data.name}/export/{info.id}"
			aria-label="export"
			class="absolute inset-0 grid cursor-pointer place-content-center opacity-0 backdrop-blur-[2px] backdrop-brightness-90 transition hover:opacity-100"
			download
		>
			<IDownload class="h-32 w-32 opacity-25 *:stroke-white" />
		</a>
		<a
			href="/c/{data.name}/export/{info.id}"
			aria-label="export"
			class="absolute inset-0 cursor-pointer"
		>
		</a>
	{/snippet}
	<Gallery images={data.images} extra={exportImage} />
</section>
