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
	import type { GalleryItemInfo } from '../../../types';
	import IDelete from '$lib/components/icons/i-delete.svelte';
	import IBack from '$lib/components/icons/i-back.svelte';
	const { data } = $props() as PageProps;

	let settingsDialogOpen = $state(false);
	let uploading = $state(false);
	let deleting = $state<string | null>(null);

	function pickFiles() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'image/*';
		input.multiple = true;
		input.onchange = async () => {
			if (input.files) {
				uploading = true;
				const formData = new FormData();
				for (let i = 0; i < input.files.length; i++) {
					formData.append('files', input.files[i]);
				}
				const response = await fetch(`?/upload`, {
					method: 'POST',
					body: formData
				});
				uploading = false;
				if (response.ok) {
					toast.success('Files uploaded successfully!', { position: 'top-left' });
					location.reload();
				} else {
					toast.error('Error uploading files!', { position: 'top-left' });
				}
			}
		};
		input.click();
	}
</script>

<section class="flex flex-col gap-4">
	<div class="flex justify-between gap-2">
		<Button variant="outline" class="cursor-pointer" href="/admin">
			<IBack />
		</Button>
		<h1 class="text-xl font-semibold">{data.collection.name}</h1>
		<div class="flex items-center gap-2">
			<Button class="cursor-pointer" onclick={pickFiles}>
				{#if uploading}
					<div class="contents" transition:fade>
						<Loader2Icon class="animate-spin" />
					</div>
				{/if}
				<div class="contents">
					<IUpload class="color-black h-8 w-8 stroke-black" />
				</div>
			</Button>
			<Dialog.Root bind:open={settingsDialogOpen}>
				<Button
					variant="outline"
					class="cursor-pointer"
					onclick={() => (settingsDialogOpen = true)}
				>
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
						<Input
							required
							name="name"
							placeholder="Collection Name"
							value={data.collection.name}
						/>
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
	</div>
	{#snippet extra({ info }: { info: GalleryItemInfo })}
		<form
			action="?/delete"
			method="POST"
			use:enhance={() => {
				deleting = info.id;
				return async ({ result, update }) => {
					deleting = null;
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
				{#if deleting === info.id}
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
