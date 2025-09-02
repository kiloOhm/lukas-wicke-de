<script lang="ts">
	import { enhance } from '$app/forms';
	import ISettings from '$lib/components/icons/i-settings.svelte';
	import IUpload from '$lib/components/icons/i-upload.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import Gallery from '$lib/components/ui/gallery.svelte';
	import { Input } from '$lib/components/ui/input';
	import type { PageProps } from './$types';
	import { toast } from 'svelte-sonner';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import { fade } from 'svelte/transition';
	import IFolder from '$lib/components/icons/i-folder.svelte';
	import type { GalleryItemInfo } from '../../../types';
	import IDelete from '$lib/components/icons/i-delete.svelte';
	const { data } = $props() as PageProps;

	let settingsDialogOpen = $state(false);
	let uploading = $state(false);
	let fileSelected = $state<File | null>(null);
	let deleting = $state(false);
</script>

<section class="flex flex-col gap-2">
	<div class="flex justify-between gap-2">
		<form
			class="flex gap-2"
			action="?/upload"
			method="POST"
			enctype="multipart/form-data"
			use:enhance={() => {
				uploading = true;
				return async ({ result, update }) => {
					uploading = false;
					update();
					if (result.status === 200) {
						toast.success('Upload successful!', { position: 'top-right' });
					}
				};
			}}
		>
			<div class="relative">
				<Input
					bind:value={fileSelected}
					class={`m-0 h-full w-10 p-0 text-transparent ${fileSelected != null ? 'bg-green-900!' : ''}`}
					name="file"
					type="file"
				/>
				<IFolder class="pointer-events-none absolute inset-0 m-auto h-5 w-5" />
			</div>
			<Button class="cursor-pointer" type="submit">
				{#if uploading}
					<div class="contents" transition:fade>
						<Loader2Icon class="animate-spin" />
					</div>
				{/if}
				<div class="contents" transition:fade>
					<IUpload class="color-black h-8 w-8 stroke-black" />
				</div>
			</Button>
		</form>
		<Dialog.Root bind:open={settingsDialogOpen}>
			<Button class="cursor-pointer" onclick={() => (settingsDialogOpen = true)}>
				<ISettings class="h-8 w-8" />
			</Button>
			<Dialog.Content>
				<Dialog.Header>
					<Dialog.Title>Settings</Dialog.Title>
				</Dialog.Header>
				<form
					action="?/updateSettings"
					method="POST"
					use:enhance={() => {
						return async ({ result, update }) => {
							settingsDialogOpen = false;
							update();
							if (result.status === 200) {
								toast.success('Settings updated successfully!', { position: 'top-left' });
							}
						};
					}}
					class="flex flex-col gap-2"
				>
					<Input required name="name" placeholder="Collection Name" value={data.collection.name} />
					<Input
						name="password"
						placeholder="Collection Password"
						value={data.collection.password}
					/>
					<Button class="cursor-pointer" type="submit">Update</Button>
				</form>
				<form
					action="?/deleteCollection"
					method="POST"
					use:enhance={() => {
						return async ({ result, update }) => {
							if (result.status === 200) {
								toast.success('Collection deleted successfully!', { position: 'top-left' });
							}
							update();
						};
					}}
				>
					<Button variant="destructive" class="w-min cursor-pointer" type="submit"
						>Delete Collection</Button
					>
				</form>
			</Dialog.Content>
		</Dialog.Root>
	</div>
	{#snippet extra({ info }: { info: GalleryItemInfo })}
		<form
			action="?/delete"
			method="POST"
			use:enhance={() => {
				deleting = true;
				return async ({ result, update }) => {
					deleting = false;
					update();
					if (result.status === 200) {
						toast.success('Image successfully deleted!', { position: 'top-right' });
					}
				};
			}}
		>
			<input type="hidden" name="id" value={info.id} />
			<Button
				type="submit"
				variant="destructive"
				class="absolute top-2 right-2 z-10 cursor-pointer"
			>
				{#if deleting}
					<div class="contents" transition:fade>
						<Loader2Icon class="animate-spin" />
					</div>
				{/if}
				<IDelete class="*:stroke-[#DDD]" />
			</Button>
		</form>
	{/snippet}
	<Gallery images={data.images} {extra} />
</section>
