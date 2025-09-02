<script lang="ts">
	import '../app.css';
	import { ModeWatcher } from 'mode-watcher';
	import { Toaster } from '$lib/components/ui/sonner/index.js';

	let { children } = $props();
</script>

<ModeWatcher defaultMode="dark" />
<Toaster />

<div class="app">
	<main class="mx-auto flex h-full min-h-screen max-w-6xl flex-col p-4 py-8">
		{@render children()}
	</main>
</div>

<style>
</style>
