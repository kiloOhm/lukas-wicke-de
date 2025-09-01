<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<div class="app">
	<main class="p-8 lg:p-12">
		{@render children()}
	</main>
</div>

<style>
</style>
