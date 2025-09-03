<script lang="ts">
	import { enhance } from '$app/forms';
	import IPlusCircle from '$lib/components/icons/i-plus-circle.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import type { PageProps } from './$types';
	const { data } = $props() as PageProps;

	let createDialogOpen = $state(false);
</script>

<section class="grid grid-flow-row grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
	<Dialog.Root bind:open={createDialogOpen}>
		<Dialog.Trigger>
			<button
				class="flex aspect-square w-full cursor-pointer flex-col items-center justify-center rounded-sm bg-white/20 transition-colors hover:bg-white/30"
			>
				<IPlusCircle class="h-32 w-32" />
			</button>
		</Dialog.Trigger>
		<Dialog.Content>
			<Dialog.Header>
				<Dialog.Title>Create new collection</Dialog.Title>
			</Dialog.Header>
			<form
				action="?/addCollection"
				method="POST"
				use:enhance={() => {
					return async ({ update }) => {
						createDialogOpen = false;
						update();
					};
				}}
				class="flex flex-col gap-2"
			>
				<div>
					<Input required name="name" placeholder="Collection Name" />
				</div>
				<Button type="submit">Create</Button>
			</form>
		</Dialog.Content>
	</Dialog.Root>
	{#each data.collections as collection}
		<a
			href={`/admin/${collection.name}`}
			class="block aspect-square w-full overflow-hidden rounded-sm bg-white/20 transition-colors hover:bg-white/30"
		>
			<figure class="relative h-full w-full">
				{#if collection.thumb}
					<img
						src={collection.thumb}
						alt={`${collection.name} thumbnail`}
						class="h-full w-full object-cover"
						loading="lazy"
						decoding="async"
					/>
				{/if}
				<div
					class="
						absolute inset-0 [mask-image:linear-gradient(to_top,black_30%,transparent)]
						backdrop-blur-xs
						[-webkit-mask-image:linear-gradient(to_top,black_30%,transparent)]
					"
				></div>

				<!-- 2) Optional color tint on top of the blur -->
				<div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
				<figcaption class="absolute inset-x-4 bottom-4 text-center text-xl font-semibold">
					{collection.name}
				</figcaption>
			</figure>
		</a>
	{/each}
</section>
