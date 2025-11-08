<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import type { GalleryItemInfo } from '../../../types';

	import Button from '$lib/components/ui/button/button.svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import IExpand from '../icons/i-expand.svelte';

	type Comment = {
		id: string;
		imageId: string;
		text: string;
		createdAt: string;
		name?: string | null;
	};

	const {
		info,
		collection,
		initialCount = 0
	}: {
		info: GalleryItemInfo & { href?: string };
		collection: string;
		initialCount?: number;
	} = $props();

	const NAME_LS_KEY = 'gallery_comment_name';

	let comments = $state<Comment[] | null>(null);
	let commentCount = $state(initialCount);
	let loading = $state(false);
	let loadError = $state<string | null>(null);
	let showModal = $state(false);
	let newCommentText = $state('');

	let posting = $state(false);

	// Name-related state
	let username = $state<string | null>(null);
	let nameInput = $state('');
	let showNameDialog = $state(false);
	let pendingCommentText = $state<string | null>(null);
	let pendingCommentRaw = $state<string | null>(null);

	onMount(() => {
		if (!browser) {
			return;
		}
		const stored = localStorage.getItem(NAME_LS_KEY);
		if (stored && stored.trim()) {
			username = stored;
			nameInput = stored;
		}
	});

	function getApiUrl() {
		return `/c/${encodeURIComponent(collection)}/${encodeURIComponent(info.id)}/comments`;
	}

	async function loadComments() {
		if (!browser || loading) return;

		loading = true;
		loadError = null;

		try {
			const res = await fetch(getApiUrl());
			if (!res.ok) {
				const msg = (await res.text()) || 'Failed to load comments';
				throw new Error(msg);
			}
			const data = (await res.json()) as { comments: Comment[] };
			comments = (data.comments ?? []).slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
			commentCount = comments.length;
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Failed to load comments';
		} finally {
			loading = false;
		}
	}

	function openComments() {
		showModal = true;
		if (comments === null) {
			loadComments();
		}
	}

	async function submitComment() {
		if (!browser || posting) return;

		const rawText = newCommentText;
		const text = rawText.trim();
		if (!text) return;

		// If no username configured yet, ask for it first
		if (!username) {
			pendingCommentText = text;
			pendingCommentRaw = rawText;
			showNameDialog = true;
			return;
		}

		await actuallyPostComment(text, rawText);
	}

	async function actuallyPostComment(text: string, rawText: string) {
		if (!browser || posting) return;

		posting = true;

		// Create an optimistic comment
		const randomSuffix =
			typeof crypto !== 'undefined' && 'randomUUID' in crypto
				? crypto.randomUUID()
				: Math.random().toString(36).slice(2);
		const optimisticId = `optimistic-${randomSuffix}`;

		const optimisticComment: Comment = {
			id: optimisticId,
			imageId: info.id,
			text,
			createdAt: new Date().toISOString(),
			name: username // will not be null here
		};

		const previousComments = comments;
		const previousCount = commentCount;

		if (comments === null) {
			comments = [optimisticComment];
		} else {
			comments = [optimisticComment, ...comments];
		}
		commentCount = previousCount + 1;
		newCommentText = '';

		try {
			const res = await fetch(getApiUrl(), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ text, name: username })
			});

			if (!res.ok) {
				const msg = (await res.text()) || 'Failed to post comment';
				throw new Error(msg);
			}

			const data = (await res.json()) as { comment: Comment };
			const savedComment = data.comment;

			comments = (comments ?? []).map((c) => (c.id === optimisticId ? savedComment : c));
		} catch (err) {
			comments = previousComments;
			commentCount = previousCount;
			newCommentText = rawText;

			alert(err instanceof Error ? err.message : 'Failed to post comment');
		} finally {
			posting = false;
		}
	}

	function openFullscreen() {
		if (!browser) return;
		const url = info.href ?? info.src;
		if (!url) return;
		window.open(url, '_blank', 'noopener,noreferrer');
	}

	function cancelNameDialog() {
		showNameDialog = false;
		pendingCommentText = null;
		pendingCommentRaw = null;
	}

	async function confirmNameAndSend() {
		if (!browser) return;

		const trimmed = nameInput.trim();
		if (!trimmed) return;

		username = trimmed;
		localStorage.setItem(NAME_LS_KEY, trimmed);
		showNameDialog = false;

		if (pendingCommentText && pendingCommentRaw !== null) {
			const textToSend = pendingCommentText;
			const rawToSend = pendingCommentRaw;
			pendingCommentText = null;
			pendingCommentRaw = null;
			await actuallyPostComment(textToSend, rawToSend);
		}
	}
</script>

<!-- Overlay inside Gallery's absolute inset-0 container -->
<div class="flex h-full flex-col justify-between">
	<!-- Top: fullscreen button -->
	<div class="flex justify-end">
		<Button
			variant="secondary"
			class="h-7 w-7 cursor-pointer rounded-full border-transparent"
			onclick={(e) => {
				e.stopPropagation();
				openFullscreen();
			}}
			aria-label="Open fullscreen"
		>
			<IExpand class="h-4 w-4" />
		</Button>
	</div>

	<!-- Bottom: comment button with count -->
	<div class="flex justify-end">
		<Button
			variant="secondary"
			size="sm"
			class="cursor-pointer rounded-full border-transparent"
			onclick={(e) => {
				e.stopPropagation();
				openComments();
			}}
			aria-label="Open comments"
		>
			<span aria-hidden="true" class="mr-1">💬</span>
			<span>{commentCount}</span>
		</Button>
	</div>
</div>

<Dialog.Root bind:open={showModal}>
	<Dialog.Content class="box-border max-h-[100vh]! max-w-[90vw]! overflow-y-auto">
		<Dialog.Header>
			<Dialog.Title>Comments</Dialog.Title>
			<Dialog.Description>
				{commentCount}
				{commentCount === 1 ? 'comment' : 'comments'} on this image
			</Dialog.Description>
		</Dialog.Header>

		<div class="flex max-h-[80vh] flex-col gap-3">
			<!-- Image on top -->
			<div class="max-h-[30vh] w-full flex-shrink-0 overflow-hidden rounded-md bg-black">
				<img src={info.src} alt={info.alt} class="mx-auto max-h-[30vh] w-auto object-contain" />
			</div>

			<form
				class="flex gap-2"
				onsubmit={(e) => {
					e.preventDefault();
					submitComment();
				}}
			>
				<div class="flex-grow">
					<Input placeholder="Add a comment..." bind:value={newCommentText} />
				</div>
				<Button
					type="submit"
					class="cursor-pointer whitespace-nowrap"
					disabled={!newCommentText.trim() || posting}
				>
					{posting ? 'Posting…' : 'Post'}
				</Button>
			</form>
			<div class="mb-1 flex justify-end text-xs text-neutral-400">
				<span>Commenting as "<b>{username ?? 'Guest'}</b>"</span>
				{#if username}
					<button
						type="button"
						class="ml-1 cursor-pointer underline underline-offset-2 hover:no-underline"
						onclick={() => {
							showNameDialog = true;
						}}
					>
						change
					</button>
				{/if}
			</div>

			<!-- Comments list -->
			<div class="mt-1 space-y-2 pr-1 pb-10 text-sm">
				{#if loading && comments === null}
					<p class="text-xs text-muted-foreground">Loading comments…</p>
				{:else if loadError}
					<p class="text-xs text-destructive">Error: {loadError}</p>
				{:else if comments && comments.length > 0}
					{#each comments as comment (comment.id)}
						<div class="rounded-md bg-neutral-900/60 p-2">
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
					{/each}
				{:else}
					<p class="text-xs text-muted-foreground">No comments yet. Be the first to comment!</p>
				{/if}
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={showNameDialog}>
	<Dialog.Content class="box-border max-w-sm">
		<Dialog.Header>
			<Dialog.Title>Choose a display name</Dialog.Title>
			<Dialog.Description>
				This name will be shown next to your comments and saved for future use.
			</Dialog.Description>
		</Dialog.Header>

		<form
			class="mt-3 flex flex-col gap-3"
			onsubmit={(e) => {
				e.preventDefault();
				confirmNameAndSend();
			}}
		>
			<Input placeholder="Your name" autocomplete="name" bind:value={nameInput} />

			<div class="flex justify-end gap-2">
				<Button
					type="button"
					variant="ghost"
					class="cursor-pointer"
					onclick={() => cancelNameDialog()}
				>
					Cancel
				</Button>
				<Button type="submit" class="cursor-pointer" disabled={!nameInput.trim()}>Continue</Button>
			</div>
		</form>
	</Dialog.Content>
</Dialog.Root>
