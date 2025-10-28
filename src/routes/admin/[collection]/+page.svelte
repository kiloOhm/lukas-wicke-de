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
	let deletingCollection = $state(false);
	let progressMap = $state<
		Record<
			string,
			{
				loaded: number;
				total: number;
				status: 'queued' | 'uploading' | 'done' | 'error' | 'finalizing';
				tries: number;
			}
		>
	>({});
	let completedIds: string[] = [];

	function pickFiles() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'image/*';
		input.multiple = true;
		input.onchange = async () => {
			if (!input.files || input.files.length === 0) return;
			uploading = true;
			completedIds = [];
			progressMap = {};
			const files = Array.from(input.files);

			const fileDims = new Map<string, { width: number; height: number }>();
			await Promise.all(
				files.map(async (f) => {
					try {
						fileDims.set(f.name, await measureFile(f));
					} catch(e) {
						console.error('Error measuring file dimensions for', f.name, e);
						// leave missing; we’ll default to 0/0
					}
				})
			);

			try {
				// 1) Ask server for N direct-upload tickets
				const prepFd = new FormData();
				prepFd.append('count', String(files.length));

				const prepRes = await fetch(`./${data.collection.name.toLowerCase()}/prepareUploads`, {
					method: 'POST',
					body: prepFd
				});
				if (!prepRes.ok) throw new Error(await prepRes.text());
				const { tickets } = (await prepRes.json()) as {
					tickets: { id: string; uploadURL: string }[];
				};

				const idToName = new Map<string, string>();
				const idToDims = new Map<string, { width: number; height: number }>();

				// 2) Upload with throttling + progress
				const CONCURRENCY = 3;
				const queue = files.map((file, idx) => {
					const ticket = tickets[idx];
					const dims = fileDims.get(file.name);
					idToName.set(ticket.id, file.name);
					if (dims) idToDims.set(ticket.id, dims);
					return { file, ticket, dims };
				});

				for (const { file } of queue) {
					progressMap[file.name] = { loaded: 0, total: file.size, status: 'queued', tries: 0 };
				}

				const runOne = (item: { file: File; ticket: { id: string; uploadURL: string } }) =>
					new Promise<void>((resolve) => {
						const maxRetries = 3;

						const attempt = (n: number) => {
							progressMap[item.file.name].status = 'uploading';
							progressMap[item.file.name].tries = n;

							const xhr = new XMLHttpRequest();
							xhr.open('POST', item.ticket.uploadURL, true);

							xhr.upload.onprogress = (e) => {
								if (e.lengthComputable) {
									progressMap[item.file.name].loaded = e.loaded;
									progressMap[item.file.name].total = e.total;
								}
							};
							xhr.onreadystatechange = () => {
								if (xhr.readyState === 4) {
									if (xhr.status >= 200 && xhr.status < 300) {
										progressMap[item.file.name].status = 'done';
										completedIds.push(item.ticket.id);
										idToDims.set(item.ticket.id, fileDims.get(item.file.name) ?? { width: 0, height: 0 });
										resolve();
									} else {
										if (n < maxRetries) {
											// simple backoff
											const delay = 300 * Math.pow(2, n);
											setTimeout(() => attempt(n + 1), delay);
										} else {
											progressMap[item.file.name].status = 'error';
											resolve(); // swallow; we’ll report errors later
										}
									}
								}
							};

							const fd = new FormData();
							fd.append('file', item.file);
							// you can add metadata if you want to set later:
							// fd.append('metadata', JSON.stringify({ alt: item.file.name }))
							xhr.send(fd);
						};

						attempt(0);
					});

				// throttle
				let idx = 0;
				const workers: Promise<void>[] = [];
				for (let i = 0; i < Math.min(CONCURRENCY, queue.length); i++) {
					workers.push(
						(async function loop() {
							while (idx < queue.length) {
								const current = queue[idx++];
								await runOne(current);
							}
						})()
					);
				}
				await Promise.all(workers);

				// 3) Finalize only the successful ones
				if (completedIds.length) {
					for (const id of completedIds) {
						const name = idToName.get(id);
						if (name && progressMap[name]) {
							progressMap[name].status = 'finalizing';
							progressMap[name].loaded = 0;
							progressMap[name].total = 1;
						}
					}

					const items = completedIds.map((id) => {
						const dims = idToDims.get(id);
						return { id, width: dims?.width ?? 0, height: dims?.height ?? 0 };
					});

					const finFd = new FormData();
					finFd.append('items', JSON.stringify(items));
					const finRes = await fetch(`./${data.collection.name.toLowerCase()}/finalizeUploads`, {
						method: 'POST',
						body: finFd
					});
					if (!finRes.ok) throw new Error(await finRes.text());
					const { saved } = (await finRes.json()) as { saved: number };
				}

				const failed = Object.entries(progressMap).filter(([, v]) => v.status === 'error').length;
				if (failed === 0) {
					toast.success('Files uploaded successfully!', { position: 'top-left' });
					location.reload();
				} else if (completedIds.length) {
					toast.message(`Uploaded ${completedIds.length}, ${failed} failed.`, {
						position: 'top-left'
					});
					location.reload();
				} else {
					toast.error('All uploads failed.', { position: 'top-left' });
				}
			} catch (e: any) {
				console.error(e);
				toast.error('Error preparing or finalizing uploads.', { position: 'top-left' });
			} finally {
				uploading = false;
			}
		};
		input.click();
	}

	async function measureFile(file: File): Promise<{ width: number; height: number }> {
		// Most browsers: EXIF-aware
		if ('createImageBitmap' in window) {
			const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' as const });
			try {
				return { width: bmp.width, height: bmp.height };
			} finally {
				bmp.close?.();
			}
		}

		// Fallback: object URL + HTMLImageElement (may ignore EXIF in some browsers)
		const url = URL.createObjectURL(file);
		try {
			const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
				const img = new Image();
				img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
				img.onerror = reject;
				img.src = url;
			});
			return dims;
		} finally {
			URL.revokeObjectURL(url);
		}
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
			<Dialog.Root bind:open={uploading}>
				<Dialog.Content>
					<Dialog.Header>
						<Dialog.Title>Upload</Dialog.Title>
					</Dialog.Header>
					<div class="flex flex-col gap-2 overflow-auto max-h-[60vh]">
						{#each Object.entries(progressMap) as [name, p]}
							<div class="flex items-center gap-3">
								<div class="w-40 truncate">{name}</div>
								<div class="h-2 flex-1 rounded bg-gray-200">
									<div
										class="h-2 rounded"
										style={`width:${p.total ? ((p.loaded / p.total) * 100).toFixed(1) : 0}%`}
									></div>
								</div>
								<div class="w-24 text-sm">{p.status}</div>
								{#if p.status === 'uploading'}
									<Loader2Icon class="animate-spin" />
								{/if}
							</div>
						{/each}
					</div>
				</Dialog.Content>
			</Dialog.Root>
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
							deletingCollection = true;
							return async ({ result, update }) => {
								if (result.status === 200) {
									toast.success('Collection deleted successfully!', { position: 'top-left' });
								}
								deletingCollection = false;
								update();
							};
						}}
					>
						<Button variant="destructive" class="w-min cursor-pointer" type="submit">
							{#if deletingCollection}
								<div class="contents" transition:fade>
									<Loader2Icon class="animate-spin" />
								</div>
							{/if}
							Delete Collection
						</Button>
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
				disabled={deleting !== null}
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
