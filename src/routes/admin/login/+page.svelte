<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import Button from '$lib/components/ui/button/button.svelte';
	import type { PageProps } from './$types';

	const { form } = $props() as PageProps;
	console.log(form);
</script>

<Card.Root class="mx-auto max-w-sm">
	<Card.Content>
		<form action="?/login" method="POST" class="flex flex-col gap-2">
			<div>
				<Input name="password" placeholder="Password" type="password" />
			</div>
			<Button type="submit">Submit</Button>
		</form>
	</Card.Content>
</Card.Root>
