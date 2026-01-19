<script lang="ts">
	import type { PageProps } from './$types';
	import Gallery from '$lib/components/ui/gallery.svelte';
	import type { GalleryItemInfo } from '../../../types';
	import ImageCommentsOverlay from '$lib/components/ui/ImageCommentsOverlay.svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import IDownload from '$lib/components/icons/i-download.svelte';

	type ImageWithHref = GalleryItemInfo & {
		href: string;
		src400: string;
		src800: string;
		src1440: string;
		src4k: string;
		src8k: string;
	};

	const { data } = $props() as PageProps;

	const images: ImageWithHref[] = data.images.map((img) => ({
		...img,
		// href: img.src8k,
		href: `/c/${data.name}/export/${img.id}`
	}));

	const commentCounts: Record<string, number> = data.commentCounts ?? {};

	const kParam = data.k ? `?k=${encodeURIComponent(data.k)}` : '';

	let downloadsOpen = $state(false);
</script>

{#snippet imageExtra({ info }: any)}
	<ImageCommentsOverlay {info} collection={data.name} initialCount={commentCounts[info.id] ?? 0} />
{/snippet}

<svelte:head>
	<title>{data.name}</title>
	<meta name="description" content="{data.name} - Ess Ridley Photography" />
</svelte:head>

<header class="mb-4 flex items-center justify-between gap-2">
	<h1 class="text-xl font-semibold">{data.name}</h1>

	{#if data.extraFiles && data.extraFiles.length > 0}
		<Dialog.Root bind:open={downloadsOpen}>
			<Button
				variant="outline"
				class="cursor-pointer"
				onclick={() => (downloadsOpen = true)}
				aria-label="Downloads"
				title="Downloads"
			>
				<IDownload class="h-6 w-6" />
			</Button>

			<Dialog.Content>
				<Dialog.Header>
					<Dialog.Title>Files</Dialog.Title>
				</Dialog.Header>

				<ul class="flex max-h-[60vh] flex-col gap-2 overflow-auto">
					{#each data.extraFiles as f}
						<li class="flex items-center justify-between gap-3">
							<div class="min-w-0 flex-1 truncate">{f.name}</div>

							<a
								class="shrink-0 underline"
								href={`/c/${data.name}/extra/${encodeURIComponent(f.id)}${kParam}`}
							>
								Download
							</a>
						</li>
					{/each}
				</ul>
			</Dialog.Content>
		</Dialog.Root>
	{/if}
</header>

<section>
	<Gallery {images} extra={imageExtra} />
</section>
