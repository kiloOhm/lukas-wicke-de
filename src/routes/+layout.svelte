<script lang="ts">
	import '../app.css';
	import { ModeWatcher } from 'mode-watcher';
	import { Toaster } from '$lib/components/ui/sonner/index.js';
	import { page } from '$app/state';

	let { children } = $props();
</script>

<ModeWatcher defaultMode="dark" />
<Toaster position="top-center" />

<div class="bg-[#111]">
	<main class="relative">
		{#key page.url.pathname}
			<div class="absolute inset-x-0 mx-auto max-w-6xl bg-[var(--background)] p-4 py-8">
				{@render children()}
			</div>
		{/key}
	</main>
</div>
