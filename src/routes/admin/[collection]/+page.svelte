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

	/** Run async work over a list with a max number of concurrent workers. */
	async function mapWithConcurrency<T, R>(
		items: T[],
		limit: number,
		worker: (item: T, index: number) => Promise<R>
	): Promise<R[]> {
		if (limit < 1) throw new Error('limit must be >= 1');
		let i = 0;
		const results = new Array<R>(items.length);
		const workerLoop = async () => {
			while (i < items.length) {
				const idx = i++;
				results[idx] = await worker(items[idx], idx);
			}
		};
		const workers = Array.from({ length: Math.min(limit, items.length) }, workerLoop);
		await Promise.all(workers);
		return results;
	}

	/** For side-effect tasks where you don't need the results. */
	async function forEachWithConcurrency<T>(
		items: T[],
		limit: number,
		worker: (item: T, index: number) => Promise<void>
	): Promise<void> {
		await mapWithConcurrency(items, limit, worker as any);
	}

	let settingsDialogOpen = $state(false);
	let gettingUploadTickets = $state(false);
	let uploading = $state(false);
	let deleting = $state<string | null>(null);
	let deletingCollection = $state(false);
	let progressMap = $state<
		Record<
			string,
			{
				measure: {
					loaded: number;
					total: number;
					status: 'pending' | 'measuring' | 'done' | 'error';
				};
				upload: {
					loaded: number;
					total: number;
					status: 'queued' | 'uploading' | 'done' | 'error';
					tries: number;
				};
				finalize: { status: 'pending' | 'finalizing' | 'done' | 'error' };
			}
		>
	>({});

	let numDone = $derived(() => {
		return Object.values(progressMap).filter((p) => p.finalize.status === 'done').length;
	});
	let numTotal = $derived(() => {
		return Object.keys(progressMap).length;
	});

	function barClassForUpload(s: string) {
		return s === 'done'
			? 'bg-green-800'
			: s === 'uploading'
				? 'bg-green-600'
				: s === 'error'
					? 'bg-red-600'
					: 'bg-gray-300';
	}
	function titleCase(s: string) {
		return s.charAt(0).toUpperCase() + s.slice(1);
	}
	let completedIds: string[] = [];

	/** Request upload tickets in batches of up to 40 per request to avoid CF "too many subrequests". */
	async function prepareUploadTickets(total: number): Promise<{ id: string; uploadURL: string }[]> {
		const MAX_PER_CALL = 40;
		const tickets: { id: string; uploadURL: string }[] = [];
		const url = `./${data.collection.name.toLowerCase()}/prepareUploads`;

		let remaining = total;
		while (remaining > 0) {
			const take = Math.min(MAX_PER_CALL, remaining);
			const fd = new FormData();
			fd.append('count', String(take));

			const res = await fetch(url, { method: 'POST', body: fd });
			if (!res.ok) throw new Error(await res.text());

			const json = (await res.json()) as { tickets: { id: string; uploadURL: string }[] };
			const got = json.tickets ?? [];

			// If the server returns fewer than requested, we'll use what we got and stop.
			tickets.push(...got);
			if (got.length < take) break;

			remaining -= take;
		}

		return tickets;
	}

	async function pickFiles() {
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

			// Seed parallel phase UIs
			for (const f of files) {
				progressMap[f.name] = {
					measure: { loaded: 0, total: 1, status: 'pending' },
					upload: { loaded: 0, total: f.size, status: 'queued', tries: 0 },
					finalize: { status: 'pending' }
				};
			}

			// Shared state
			const fileDims = new Map<string, { width: number; height: number }>();
			const nameToId = new Map<string, string>();
			const idToDims = new Map<string, { width: number; height: number }>();
			const finalized = new Set<string>(); // by ticket id

			let successFinalized = 0;
			let failedUploads = 0;

			// Start measuring immediately (do NOT await yet)
			const MEASURE_CONCURRENCY = 3;
			const measurePromise = forEachWithConcurrency(files, MEASURE_CONCURRENCY, async (f) => {
				progressMap[f.name].measure.status = 'measuring';
				try {
					const dims = await measureFile(f);
					fileDims.set(f.name, dims);
					progressMap[f.name].measure.loaded = 1;
					progressMap[f.name].measure.status = 'done';
				} catch {
					progressMap[f.name].measure.status = 'error';
				}
				// If upload already done for this file, we can attempt to finalize now
				const id = nameToId.get(f.name);
				if (id) {
					tryFinalize(id, f.name);
				}
			});

			try {
				gettingUploadTickets = true;
				const tickets = await prepareUploadTickets(files.length);

				// sanity check to keep mapping 1:1 with files
				if (tickets.length !== files.length) {
					throw new Error(`Server returned ${tickets.length} tickets for ${files.length} files`);
				}
				gettingUploadTickets = false;

				const queue = files.map((file, idx) => {
					const ticket = tickets[idx];
					nameToId.set(file.name, ticket.id);
					return { file, ticket };
				});

				// Upload with throttling, in parallel with ongoing measuring
				const UPLOAD_CONCURRENCY = 1; // tweak as desired
				const runOne = (item: { file: File; ticket: { id: string; uploadURL: string } }) =>
					new Promise<void>((resolve) => {
						const maxRetries = 3;
						const attempt = (n: number) => {
							progressMap[item.file.name].upload.status = 'uploading';
							progressMap[item.file.name].upload.tries = n;

							const xhr = new XMLHttpRequest();
							xhr.open('POST', item.ticket.uploadURL, true);

							xhr.upload.onprogress = (e) => {
								if (e.lengthComputable) {
									progressMap[item.file.name].upload.loaded = e.loaded;
									progressMap[item.file.name].upload.total = e.total;
								}
							};
							xhr.onreadystatechange = () => {
								if (xhr.readyState === 4) {
									if (xhr.status >= 200 && xhr.status < 300) {
										progressMap[item.file.name].upload.status = 'done';
										progressMap[item.file.name].upload.loaded =
											progressMap[item.file.name].upload.total;

										// cache dims if already known
										const dims = fileDims.get(item.file.name);
										if (dims) idToDims.set(item.ticket.id, dims);

										// Attempt finalize if measuring already finished (or errored)
										tryFinalize(item.ticket.id, item.file.name);
										resolve();
									} else {
										if (n < maxRetries) {
											setTimeout(() => attempt(n + 1), 300 * Math.pow(2, n));
										} else {
											progressMap[item.file.name].upload.status = 'error';
											failedUploads += 1;
											resolve();
										}
									}
								}
							};

							const fd = new FormData();
							fd.append('file', item.file);
							xhr.send(fd);
						};
						attempt(0);
					});

				const uploadPromise = forEachWithConcurrency(queue, UPLOAD_CONCURRENCY, async (item) => {
					await runOne(item);
				});

				// Wait for uploads & measuring to finish; finalization fires per-file as they become eligible
				await Promise.all([measurePromise, uploadPromise]);

				// After both phases done, if any file is uploaded but measurement never completed, we still finalize with 0/0 inside tryFinalize (already called). Nothing extra to do here.

				// Make a summary toast
				if (failedUploads === 0 && successFinalized > 0) {
					toast.success('Files uploaded and finalized successfully!', { position: 'top-left' });
					location.reload();
				} else if (successFinalized > 0) {
					toast.message(`Finalized ${successFinalized}, ${failedUploads} upload(s) failed.`, {
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

			// per-file finalize once both (upload + measure) complete
			async function tryFinalize(id: string, name: string) {
				if (finalized.has(id)) return;

				const up = progressMap[name]?.upload.status;
				const ms = progressMap[name]?.measure.status;
				if (up !== 'done' || (ms !== 'done' && ms !== 'error')) return; // wait until both finished (or measuring failed)

				finalized.add(id);
				progressMap[name].finalize.status = 'finalizing';

				const dims = fileDims.get(name) ?? { width: 0, height: 0 };
				const finFd = new FormData();
				finFd.append('items', JSON.stringify([{ id, width: dims.width, height: dims.height }]));
				try {
					const finRes = await fetch(`./${data.collection.name.toLowerCase()}/finalizeUploads`, {
						method: 'POST',
						body: finFd
					});
					if (!finRes.ok) throw new Error(await finRes.text());
					progressMap[name].finalize.status = 'done';
					successFinalized += 1;
				} catch {
					progressMap[name].finalize.status = 'error';
				}
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

	let remeasuring = $state(false);
	let remeasureMap = $state<
		Record<
			string,
			{ loaded: number; total: number; status: 'measuring' | 'saving' | 'done' | 'error' }
		>
	>({});
	async function remeasureAll() {
		remeasuring = true;
		remeasureMap = {};

		// Use the already-loaded list with signed URLs
		const items = [...data.images] as Array<Pick<GalleryItemInfo, 'id' | 'src'>>;

		const measureOne = async (id: string, url: string) => {
			remeasureMap[id] = { loaded: 0, total: 1, status: 'measuring' };

			try {
				// Fetch as blob so we can EXIF-correct via createImageBitmap
				const res = await fetch(url, { credentials: 'omit' });
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const blob = await res.blob();

				let width: number, height: number;

				if ('createImageBitmap' in window) {
					const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' as const });
					width = bmp.width;
					height = bmp.height;
					bmp.close?.();
				} else {
					// Fallback: may ignore EXIF in some browsers
					const objectUrl = URL.createObjectURL(blob);
					try {
						({ width, height } = await new Promise<{ width: number; height: number }>(
							(resolve, reject) => {
								const img = new Image();
								img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
								img.onerror = reject;
								img.src = objectUrl;
							}
						));
					} finally {
						URL.revokeObjectURL(objectUrl);
					}
				}

				remeasureMap[id].loaded = 1; // show 100%
				remeasureMap[id].status = 'saving';
				return { id, width, height };
			} catch (e) {
				remeasureMap[id].status = 'error';
				return null;
			}
		};

		const CONCURRENCY = 3;

		const measured = (
			await mapWithConcurrency(items, CONCURRENCY, async ({ id, src }) => {
				return await measureOne(id, src); // returns {id,width,height} | null
			})
		).filter((m): m is { id: string; width: number; height: number } => m !== null);

		// Save results in one request
		if (measured.length) {
			const fd = new FormData();
			fd.append('items', JSON.stringify(measured));
			const res = await fetch(`./${data.collection.name.toLowerCase()}/remeasure`, {
				method: 'POST',
				body: fd
			});
			if (!res.ok) {
				// mark all saving as error
				for (const m of measured) remeasureMap[m.id].status = 'error';
				toast.error('Failed to save new dimensions', { position: 'top-left' });
			} else {
				const { updated, skipped } = (await res.json()) as { updated: number; skipped: number };
				for (const m of measured) {
					remeasureMap[m.id].status = 'done';
				}
				toast.success(`Re-measured ${updated}${skipped ? `, skipped ${skipped}` : ''}.`, {
					position: 'top-left'
				});
				// Refresh the page so Gallery gets the new width/height
				location.reload();
			}
		} else {
			toast.message('No images could be measured.', { position: 'top-left' });
		}

		remeasuring = false;
	}
</script>

<section class="flex flex-col gap-4">
	<div class="flex justify-between gap-2">
		<Button variant="outline" class="cursor-pointer" href="/admin">
			<IBack />
		</Button>
		<h1 class="text-xl font-semibold">{data.collection.name}</h1>
		<div class="flex items-center gap-2">
			<Button class="cursor-pointer" variant="outline" onclick={remeasureAll}>Re-measure</Button>
			<Dialog.Root bind:open={remeasuring}>
				<Dialog.Content
					escapeKeydownBehavior="ignore"
					showCloseButton={false}
					onInteractOutside={(e) => e.preventDefault()}
				>
					<Dialog.Header>
						<Dialog.Title>Re-measuring images</Dialog.Title>
					</Dialog.Header>
					<div class="flex max-h-[60vh] flex-col gap-2 overflow-auto">
						{#each Object.entries(remeasureMap) as [id, p]}
							<div class="flex items-center gap-3">
								<div class="w-40 truncate">{id}</div>
								<div class="h-2 flex-1 rounded bg-gray-200">
									<div
										class="h-2 rounded bg-green-600"
										style={`width:${p.total ? ((p.loaded / p.total) * 100).toFixed(1) : 0}%`}
									></div>
								</div>
								<div class="w-24 text-sm capitalize">{p.status}</div>
								{#if p.status === 'measuring' || p.status === 'saving'}
									<Loader2Icon class="animate-spin" />
								{/if}
							</div>
						{/each}
					</div>
				</Dialog.Content>
			</Dialog.Root>
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
				<Dialog.Content
					escapeKeydownBehavior="ignore"
					showCloseButton={false}
					onInteractOutside={(e) => e.preventDefault()}
				>
					<Dialog.Header>
						<Dialog.Title>
							<div class="flex items-center justify-between">
								<span>
									Upload ({numDone()}/{numTotal()})
								</span>
								{#if gettingUploadTickets}
									<div>
										<span class="mr-2">Getting upload tickets...</span>
										<Loader2Icon class="animate-spin" />
									</div>
								{/if}
							</div>
						</Dialog.Title>
					</Dialog.Header>

					<div class="flex max-h-[60vh] flex-col gap-3 overflow-auto">
						{#each Object.entries(progressMap) as [name, p]}
							<div class="flex w-full flex-col gap-1">
								<div class="flex items-center justify-between gap-2">
									<div class="w-52 truncate">{name}</div>
									<div class="text-xs capitalize opacity-70">
										{titleCase(
											p.measure.status === 'measuring'
												? 'measuring'
												: p.upload.status === 'uploading'
													? 'uploading'
													: p.finalize.status === 'finalizing'
														? 'finalizing'
														: p.finalize.status
										)}
									</div>
								</div>

								<!-- Upload bar -->
								<div class="flex items-center gap-2">
									<div class="w-20 text-xs opacity-70">Upload</div>
									<div class="h-2 w-full rounded bg-gray-200">
										<div
											class={`h-2 rounded ${barClassForUpload(p.upload.status)}`}
											style={`width:${p.upload.total ? ((p.upload.loaded / p.upload.total) * 100).toFixed(1) : 0}%`}
										></div>
									</div>
									{#if p.upload.status === 'uploading'}
										<Loader2Icon class="ml-1 size-4 animate-spin" />
									{/if}
								</div>
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
