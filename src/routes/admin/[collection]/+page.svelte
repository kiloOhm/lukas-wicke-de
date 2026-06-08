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
	import type { CollectionInfo, GalleryItemInfo } from '../../../types';
	import IDelete from '$lib/components/icons/i-delete.svelte';
	import IBack from '$lib/components/icons/i-back.svelte';
	import ImageCommentsOverlay from '$lib/components/ui/ImageCommentsOverlay.svelte';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	const { data } = $props() as PageProps;
	import { page } from '$app/state';
	import Item from '$lib/components/ui/item/item.svelte';

	let collection = $state(structuredClone(data.collection));

	const DEFAULT_BACK = '/admin';

	let backHref = $derived(() => {
		const rt = page.url.searchParams.get('returnto');
		if (!rt) return DEFAULT_BACK;

		// Only allow same-site paths like "/admin/feed" (reject "https://...", "//evil.com", etc.)
		if (rt.startsWith('/') && !rt.startsWith('//')) {
			return rt;
		}
		return DEFAULT_BACK;
	});

	const commentCounts = $derived(data.commentCounts ?? {});

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

	let deleteExtraConfirmOpen = $state(false);
	let deleteExtraTarget = $state<{ id: string; name: string } | null>(null);
	let deletingExtra = $state(false);

	function openDeleteExtraConfirm(ef: { id: string; name: string }) {
		deleteExtraTarget = { id: ef.id, name: ef.name };
		deleteExtraConfirmOpen = true;
	}

	let settingsDialogOpen = $state(false);
	let deleteConfirmDialogOpen = $state(false);
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
		const url = `./${collection.name.toLowerCase()}/prepareUploads`;

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
			const finalizePromises: Promise<void>[] = [];

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
					finalizePromises.push(tryFinalize(id, f.name));
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
										try {
											finalizePromises.push(tryFinalize(item.ticket.id, item.file.name));
										} finally {
											resolve();
										}
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
				await Promise.all(finalizePromises);

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
			async function tryFinalize(id: string, name: string): Promise<void> {
				if (finalized.has(id)) return;

				const up = progressMap[name]?.upload.status;
				const ms = progressMap[name]?.measure.status;
				if (up !== 'done' || (ms !== 'done' && ms !== 'error')) return;

				finalized.add(id);
				progressMap[name].finalize.status = 'finalizing';

				const dims = fileDims.get(name) ?? { width: 0, height: 0 };
				const finFd = new FormData();
				finFd.append('items', JSON.stringify([{ id, fileName: name, width: dims.width, height: dims.height }]));

				try {
					const finRes = await fetch(`./${collection.name.toLowerCase()}/finalizeUploads`, {
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

	let extraUploadOpen = $state(false);
	let extraUploading = $state(false);

	let extraFile: File | null = $state(null);
	let extraError: string | null = $state(null);
	let extraAbortController: AbortController | null = $state(null);
	let extraMultipartSession = $state<{ key: string; uploadId: string } | null>(null);
	let extraCancelling = $state(false);

	type ExtraProgress = { loaded: number; total: number; percent: number };

	let extraProgress = $state<ExtraProgress>({ loaded: 0, total: 0, percent: 0 });
	let extraPart = $state<{ current: number; total: number } | null>(null);

	// keep a handle to the in-flight XHR so Cancel can abort immediately
	let extraActiveXhr: XMLHttpRequest | null = null;

	async function abortExtraMultipartBestEffort() {
		const session = extraMultipartSession;
		if (!session) return;

		try {
			const fd = new FormData();
			fd.append('key', session.key);
			fd.append('uploadId', session.uploadId);

			await fetch(`./${collection.name.toLowerCase()}/abortExtraMultipart`, {
				method: 'POST',
				body: fd
			});
		} catch {
			// ignore
		}
	}

	async function cancelExtraUpload() {
		if (extraCancelling) return;
		extraCancelling = true;

		// 0) Abort the active XHR (multipart part upload) immediately
		try {
			extraActiveXhr?.abort();
		} catch {
			// ignore
		}

		// 1) Stop in-flight fetch() calls (prepare/complete)
		try {
			extraAbortController?.abort();
		} catch {
			// ignore
		}

		// 2) Abort the R2 multipart upload so you don't leak parts
		await abortExtraMultipartBestEffort();

		// 3) Reset state/UI
		extraAbortController = null;
		extraMultipartSession = null;
		extraUploading = false;
		extraCancelling = false;

		resetExtraUpload();
		extraUploadOpen = false;

		toast.message('Upload cancelled.', { position: 'top-left' });
	}

	function resetExtraUpload() {
		extraFile = null;
		extraUploading = false;
		extraProgress = { loaded: 0, total: 0, percent: 0 };
		extraError = null;
		extraAbortController = null;
		extraMultipartSession = null;
		extraCancelling = false;

		extraPart = null;
		extraActiveXhr = null;
	}

	function formatBytes(n: number) {
		if (!Number.isFinite(n) || n <= 0) return '0 B';
		const units = ['B', 'KB', 'MB', 'GB', 'TB'];
		let u = 0;
		let v = n;
		while (v >= 1024 && u < units.length - 1) {
			v = v / 1024;
			u += 1;
		}
		return `${v.toFixed(u === 0 ? 0 : 1)} ${units[u]}`;
	}

	function uploadExtraPartWithXhr(opts: {
		url: string;
		chunk: Blob;
		baseLoaded: number; // bytes already fully uploaded before this part
		totalBytes: number;
		signal: AbortSignal;
	}): Promise<string> {
		if (opts.signal.aborted) {
			throw new DOMException('Aborted', 'AbortError');
		}

		return new Promise<string>((resolve, reject) => {
			const xhr = new XMLHttpRequest();
			extraActiveXhr = xhr;

			const onAbort = () => {
				try {
					xhr.abort();
				} catch {
					// ignore
				}
			};

			const cleanup = () => {
				if (extraActiveXhr === xhr) {
					extraActiveXhr = null;
				}
				opts.signal.removeEventListener('abort', onAbort);
			};

			opts.signal.addEventListener('abort', onAbort);

			xhr.open('POST', opts.url, true);
			xhr.responseType = 'json';
			xhr.setRequestHeader('content-type', 'application/octet-stream');

			xhr.upload.onprogress = (e) => {
				const partLoaded = e.loaded;
				const overallLoaded = opts.baseLoaded + partLoaded;

				const percent =
					opts.totalBytes > 0
						? Math.min(100, Math.round((overallLoaded / opts.totalBytes) * 100))
						: 0;

				extraProgress = { loaded: overallLoaded, total: opts.totalBytes, percent };
			};

			xhr.onload = () => {
				cleanup();

				if (xhr.status >= 200 && xhr.status < 300) {
					// expect: { etag: string }
					let etag: string | null = null;

					const respAny = xhr.response as any;
					if (respAny && typeof respAny.etag === 'string') {
						etag = respAny.etag;
					} else {
						try {
							const parsed = JSON.parse(xhr.responseText);
							if (typeof parsed?.etag === 'string') etag = parsed.etag;
						} catch {
							// ignore
						}
					}

					if (!etag) {
						reject(new Error('Missing etag in part upload response.'));
						return;
					}

					resolve(etag);
					return;
				}

				let msg = xhr.responseText || `Part upload failed (HTTP ${xhr.status}).`;
				try {
					const j = JSON.parse(xhr.responseText);
					if (typeof j?.error === 'string') msg = j.error;
				} catch {
					// ignore
				}
				reject(new Error(msg));
			};

			xhr.onerror = () => {
				cleanup();
				reject(new Error('Network error.'));
			};

			xhr.onabort = () => {
				cleanup();
				reject(new DOMException('Aborted', 'AbortError'));
			};

			xhr.send(opts.chunk);
		});
	}

	async function uploadExtraMultipart(file: File): Promise<CollectionInfo> {
		// new controller per upload
		const controller = new AbortController();
		extraAbortController = controller;

		// 1) prepare
		const prepFd = new FormData();
		prepFd.append('filename', file.name);
		prepFd.append('size', String(file.size));
		prepFd.append('contentType', file.type || 'application/octet-stream');

		const prepRes = await fetch(`./${collection.name.toLowerCase()}/prepareExtraMultipart`, {
			method: 'POST',
			body: prepFd,
			signal: controller.signal
		});
		if (!prepRes.ok) throw new Error(await prepRes.text());

		const prep = (await prepRes.json()) as { key: string; uploadId: string; partSize: number };
		const { key, uploadId, partSize } = prep;

		console.log('multipart prep', {
			size: file.size,
			partSize,
			totalParts: Math.ceil(file.size / partSize)
		});

		if (!Number.isFinite(partSize) || partSize <= 0) {
			throw new Error(`Invalid partSize from server: ${partSize}`);
		}
		if (file.size > 0 && Math.ceil(file.size / partSize) < 1) {
			throw new Error('Invalid part sizing calculation.');
		}

		// store session so Cancel can abort server-side
		extraMultipartSession = { key, uploadId };

		// 2) upload parts sequentially (easiest). You can add concurrency later.
		const parts: { partNumber: number; etag: string }[] = [];
		const totalParts = Math.ceil(file.size / partSize);

		try {
			// 2) upload parts sequentially
			for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
				const start = (partNumber - 1) * partSize;
				const end = Math.min(start + partSize, file.size);
				if (end <= start) {
					throw new Error(
						`Bad slice math: part=${partNumber}/${totalParts} start=${start} end=${end} size=${file.size} partSize=${partSize}`
					);
				}

				const chunk = file.slice(start, end);
				if (chunk.size === 0) {
					throw new Error(
						`Client produced empty chunk (part ${partNumber}/${totalParts}, start=${start}, end=${end}, size=${file.size}, partSize=${partSize})`
					);
				}

				const isLast = partNumber === totalParts;

				// show "Part X/Y" in UI
				extraPart = { current: partNumber, total: totalParts };

				// ensure UI knows we already have start bytes uploaded when a new part begins
				{
					const percent = file.size > 0 ? Math.round((start / file.size) * 100) : 0;
					extraProgress = { loaded: start, total: file.size, percent };
				}

				const url =
					`./${collection.name.toLowerCase()}/uploadExtraPart` +
					`?key=${encodeURIComponent(key)}` +
					`&uploadId=${encodeURIComponent(uploadId)}` +
					`&partNumber=${partNumber}` +
					`&isLast=${isLast}`;

				const etag = await uploadExtraPartWithXhr({
					url,
					chunk,
					baseLoaded: start,
					totalBytes: file.size,
					signal: controller.signal
				});

				parts.push({ partNumber, etag });

				// snap to the part end (in case the last progress event didn't hit 100%)
				{
					const percent = file.size > 0 ? Math.round((end / file.size) * 100) : 0;
					extraProgress = { loaded: end, total: file.size, percent };
				}
			}

			// 3) complete
			const finFd = new FormData();
			finFd.append('key', key);
			finFd.append('uploadId', uploadId);
			finFd.append('filename', file.name);
			finFd.append('parts', JSON.stringify(parts));

			const finRes = await fetch(`./${collection.name.toLowerCase()}/completeExtraMultipart`, {
				method: 'POST',
				body: finFd,
				signal: controller.signal
			});
			if (!finRes.ok) throw new Error(await finRes.text());

			return (await finRes.json()) as CollectionInfo;
		} catch (e: any) {
			// If user canceled (AbortError), just bubble up after aborting server-side best-effort
			await abortExtraMultipartBestEffort();
			throw e;
		} finally {
			// clear controller if this upload is done
			extraAbortController = null;
			extraMultipartSession = null;
			extraPart = null;
			extraActiveXhr = null;
		}
	}

	async function uploadExtra() {
		if (!extraFile) {
			extraError = 'Please pick a file.';
			return;
		}

		extraError = null;
		extraUploading = true;
		extraProgress = { loaded: 0, total: extraFile.size, percent: 0 };

		try {
			// If > ~95MB, use multipart to stay under Cloudflare 100MB request limit
			if (extraFile.size > 95 * 1024 * 1024) {
				const updated = await uploadExtraMultipart(extraFile);
				collection = updated;
			} else {
				await new Promise<void>((resolve) => {
					const xhr = new XMLHttpRequest();
					xhr.open('POST', `./${collection.name.toLowerCase()}/uploadExtra`, true);

					xhr.upload.onprogress = (e) => {
						if (!e.lengthComputable) return;
						const percent = e.total > 0 ? Math.round((e.loaded / e.total) * 100) : 0;
						extraProgress = { loaded: e.loaded, total: e.total, percent };
					};

					xhr.onreadystatechange = () => {
						if (xhr.readyState !== 4) return;

						if (xhr.status >= 200 && xhr.status < 300) {
							const updated = JSON.parse(xhr.responseText) as CollectionInfo;

							collection = updated; // simplest: replace local state

							toast.success('Extra file uploaded!', { position: 'top-left' });

							extraUploading = false;
							extraUploadOpen = false;
							resetExtraUpload();
							resolve();
							return;
						}

						// Try to parse server error
						let msg = 'Upload failed.';
						try {
							const j = JSON.parse(xhr.responseText);
							if (typeof j?.error === 'string') msg = j.error;
						} catch {
							if (xhr.responseText) msg = xhr.responseText;
						}
						extraError = msg;
						toast.error(msg, { position: 'top-left' });
						resolve();
					};

					xhr.onerror = () => {
						extraError = 'Network error.';
						toast.error('Network error.', { position: 'top-left' });
						resolve();
					};

					const fd = new FormData();
					if (!extraFile) throw new Error('No extra file selected');
					fd.append('file', extraFile);
					xhr.send(fd);
				});
			}

			toast.success('Extra file uploaded!', { position: 'top-left' });
			extraUploadOpen = false;
			resetExtraUpload();
		} catch (e: any) {
			console.error(e);
			extraError = e?.message ?? 'Upload failed.';
			toast.error(extraError!, { position: 'top-left' });
		} finally {
			extraUploading = false;
		}
	}
</script>

<section class="flex flex-col gap-4">
	<div class="flex justify-between gap-2">
		<Button variant="outline" class="cursor-pointer" href={backHref()}>
			<IBack />
		</Button>
		<h1 class="text-xl font-semibold">{collection.name}</h1>
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
									<div class="flex items-center gap-4">
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
								if (result.type === 'success') {
									const updated = (result.data as CollectionInfo) ?? null;
									if (updated) {
										collection = updated; // ✅ override local state
									}
									toast.success('Settings updated successfully!', { position: 'top-left' });
									return;
								}

								if (result.type === 'failure') {
									const msg = (result.data as any)?.error ?? 'Failed to update settings.';
									toast.error(msg, { position: 'top-left' });
									return;
								}

								toast.error('Failed to update settings.', { position: 'top-left' });
							};
						}}
						class="flex flex-col gap-2"
					>
						<!-- <Input required name="name" placeholder="Collection Name" value={collection.name} /> -->
						<input type="hidden" name="name" value={collection.name} />
						<Input name="password" placeholder="Collection Password" value={collection.password} />
						<Button class="cursor-pointer" type="submit">Update</Button>
					</form>
					<Separator class="my-2" />

					<div class="flex flex-col gap-2">
						<div class="flex items-center justify-between">
							<div class="text-sm font-medium">Extra files</div>
							<Button
								variant="outline"
								class="cursor-pointer"
								disabled={extraUploading}
								onclick={() => {
									resetExtraUpload();
									extraUploadOpen = true;
								}}
							>
								<IUpload class="h-5 w-5" />
								<span class="ml-2">Upload extra</span>
							</Button>
						</div>
						{#if collection.extraFiles && collection.extraFiles.length > 0}
							<ul class="flex flex-col gap-2">
								{#each collection.extraFiles as ef}
									<Item variant="outline" class=" flex justify-between px-4 py-2">
										<span>{ef.name}</span>
										<Button
											type="button"
											variant="destructive"
											class="cursor-pointer"
											disabled={deletingExtra || extraUploading}
											onclick={() => openDeleteExtraConfirm(ef)}
										>
											<IDelete class="*:stroke-[#DDD]" />
										</Button>
									</Item>
								{/each}
							</ul>
							<Dialog.Root bind:open={deleteExtraConfirmOpen}>
								<Dialog.Content
									escapeKeydownBehavior={deletingExtra ? 'ignore' : 'close'}
									onInteractOutside={(e) => {
										if (deletingExtra) e.preventDefault();
									}}
								>
									<Dialog.Header>
										<Dialog.Title>Delete extra file</Dialog.Title>
									</Dialog.Header>

									{#if deleteExtraTarget}
										<p class="mb-4">
											Delete <span class="font-medium">{deleteExtraTarget.name}</span>? This cannot
											be undone.
										</p>

										<form
											action="?/deleteExtra"
											method="POST"
											use:enhance={() => {
												deletingExtra = true;

												return async ({ result, update }) => {
													deletingExtra = false;

													if (result.type === 'success') {
														const updated = (result.data as CollectionInfo) ?? null;
														if (updated) {
															collection = updated;
														}
														toast.success('Extra file deleted successfully!', {
															position: 'top-left'
														});
														deleteExtraConfirmOpen = false;
														deleteExtraTarget = null;
														return;
													}

													if (result.type === 'failure') {
														const msg =
															(result.data as any)?.error ?? 'Failed to delete extra file.';
														toast.error(msg, { position: 'top-left' });
														return;
													}

													toast.error('Failed to delete extra file.', { position: 'top-left' });
												};
											}}
										>
											<input type="hidden" name="fileId" value={deleteExtraTarget.id} />

											<div class="flex items-center justify-end gap-2">
												<Button
													type="button"
													variant="outline"
													class="cursor-pointer"
													disabled={deletingExtra}
													onclick={() => {
														deleteExtraConfirmOpen = false;
														deleteExtraTarget = null;
													}}
												>
													Cancel
												</Button>

												<Button
													type="submit"
													variant="destructive"
													class="cursor-pointer"
													disabled={deletingExtra}
												>
													{#if deletingExtra}
														<Loader2Icon class="mr-2 h-4 w-4 animate-spin" />
													{/if}
													Delete
												</Button>
											</div>
										</form>
									{/if}
								</Dialog.Content>
							</Dialog.Root>
						{:else}
							<p class="text-sm opacity-70">No extra files uploaded yet.</p>
						{/if}

						<Dialog.Root bind:open={extraUploadOpen}>
							<Dialog.Content
								onOpenAutoFocus={(e) => e.preventDefault()}
								escapeKeydownBehavior={extraUploading ? 'ignore' : 'close'}
								onInteractOutside={(e) => {
									if (extraUploading) e.preventDefault();
								}}
							>
								<Dialog.Header>
									<Dialog.Title>Upload extra file</Dialog.Title>
								</Dialog.Header>

								<div class="flex flex-col gap-3">
									<Input
										class="cursor-pointer"
										type="file"
										disabled={extraUploading}
										onchange={(e) => {
											const input = e.currentTarget as HTMLInputElement;
											extraFile = input.files && input.files.length > 0 ? input.files[0] : null;
											extraError = null;
											extraProgress = { loaded: 0, total: extraFile?.size ?? 0, percent: 0 };
										}}
									/>

									{#if extraFile}
										<div class="text-xs opacity-70">
											{extraFile.name} — {formatBytes(extraFile.size)}
										</div>
									{/if}

									{#if extraUploading}
										<div class="flex flex-col gap-1">
											<div class="flex items-center justify-between text-xs opacity-70">
												<span>Uploading…</span>
												<span>{extraProgress.percent}%</span>
											</div>
											<div class="h-2 w-full rounded bg-gray-200">
												<div
													class="h-2 rounded bg-green-600"
													style={`width:${extraProgress.percent}%`}
												></div>
											</div>
											{#if extraPart}
												<div class="text-xs opacity-70">
													Part {extraPart.current} / {extraPart.total}
												</div>
											{/if}
											<div class="text-xs opacity-70">
												{formatBytes(extraProgress.loaded)} / {formatBytes(extraProgress.total)}
											</div>
										</div>
									{/if}

									{#if extraError}
										<p class="text-sm text-red-600">{extraError}</p>
									{/if}

									{#if extraUploading}
										<Button
											variant="outline"
											class="cursor-pointer"
											disabled={extraCancelling}
											onclick={() => {
												if (extraUploading) {
													cancelExtraUpload();
												} else {
													extraUploadOpen = false;
												}
											}}
										>
											{#if extraCancelling}
												<Loader2Icon class="mr-2 h-4 w-4 animate-spin" />
											{/if}
											{extraUploading ? 'Cancel upload' : 'Cancel'}
										</Button>
									{:else}
										<div class="flex items-center justify-end gap-2">
											<Button
												variant="outline"
												class="cursor-pointer"
												disabled={extraUploading}
												onclick={() => (extraUploadOpen = false)}
											>
												Cancel
											</Button>

											<Button
												class="cursor-pointer"
												disabled={extraUploading || !extraFile}
												onclick={uploadExtra}
											>
												{#if extraUploading}
													<Loader2Icon class="mr-2 h-4 w-4 animate-spin" />
												{/if}
												Upload
											</Button>
										</div>
									{/if}
								</div>
							</Dialog.Content>
						</Dialog.Root>
					</div>

					<Separator class="my-2" />
					<Dialog.Root bind:open={deleteConfirmDialogOpen}>
						<Button
							variant="destructive"
							class="cursor-pointer"
							type="submit"
							onclick={() => (deleteConfirmDialogOpen = true)}
						>
							{#if deletingCollection}
								<div class="contents" transition:fade>
									<Loader2Icon class="animate-spin" />
								</div>
							{/if}
							Delete Collection
						</Button>
						<Dialog.Content>
							<Dialog.Header>
								<Dialog.Title>Confirm Deletion</Dialog.Title>
							</Dialog.Header>
							<p class="mb-4">
								Are you sure you want to delete this collection? This action cannot be undone.
							</p>
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
								<Button variant="destructive" class="w-full cursor-pointer" type="submit">
									I'm sure, delete collection
								</Button>
							</form>
						</Dialog.Content>
					</Dialog.Root>
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
		<ImageCommentsOverlay
			{info}
			collection={collection.name}
			initialCount={commentCounts[info.id] ?? 0}
		/>
	{/snippet}
	<Gallery images={data.images} {extra} />
</section>
