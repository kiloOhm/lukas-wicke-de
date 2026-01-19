<script lang="ts">
	import IBack from '$lib/components/icons/i-back.svelte';
	import Badge from '$lib/components/ui/badge/badge.svelte';
	import { Button } from '$lib/components/ui/button';
	import ImageCommentsOverlay from '$lib/components/ui/ImageCommentsOverlay.svelte';
	import Item from '$lib/components/ui/item/item.svelte';
	import type { PageProps } from './$types';
	const { data } = $props() as PageProps;
</script>

<header class="mb-6 flex items-center gap-4">
	<Button variant="outline" class="cursor-pointer" href="/admin">
		<IBack />
	</Button>
	<h1 class="text-3xl font-bold">Comments</h1>
</header>

<main class="flex flex-col gap-4">
	{#each data.comments as comment}
		<Item variant="outline" class="relative">
			{#if comment.unread}
				<Badge class="absolute -top-2 -left-2 aspect-square h-4" variant="destructive" />
			{/if}
			<div class="flex grow flex-col gap-4">
				<div class="flex grow gap-4">
					<div class="relative">
						{#if comment.imageDeleted}
							<div
								class="flex h-32 w-32 items-center justify-center rounded-xs bg-neutral-800 text-center text-sm text-neutral-400"
							>
								Image deleted
							</div>
						{:else}
							<img class="w-32 rounded-xs" src={comment.imgSrc.href} alt="preview" />
							<div class="absolute inset-0">
								<ImageCommentsOverlay
									collection={comment.collection}
									info={{
										id: comment.imageId,
										src: comment.imgSrc.href,
										alt: 'Image preview'
									}}
									noCount
									highlight={comment.id}
								/>
							</div>
						{/if}
					</div>
					<div class="flex grow flex-col gap-2">
						<div class="grow rounded-md bg-neutral-900/60 p-2">
							<div class="flex items-center justify-between text-[0.7rem] text-neutral-400">
								<span>{comment.name ?? 'Guest'}</span>
								<time datetime={comment.createdAt}>
									{new Date(comment.createdAt).toLocaleString()}
								</time>
							</div>
							<p class="mt-1 text-sm whitespace-pre-wrap text-neutral-100">
								{comment.text}
							</p>
						</div>
						<div class="flex justify-end">
							<a href="/admin/{comment.collection}?returnto=/admin/feed" class="text-md underline">
								Collection:
								{comment.collection}
							</a>
						</div>
					</div>
				</div>
			</div>
		</Item>
	{/each}
</main>
