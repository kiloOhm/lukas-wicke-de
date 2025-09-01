<script lang="ts">
	import '../app.css';
	import { ModeWatcher } from 'mode-watcher';
	import { Toaster } from '$lib/components/ui/sonner/index.js';

	let { children } = $props();
</script>

<ModeWatcher defaultMode="dark" />
<Toaster />

<div class="app">
	<main class="mx-auto max-w-6xl p-4 py-8">
		{@render children()}
	</main>
</div>

<style>
</style>
