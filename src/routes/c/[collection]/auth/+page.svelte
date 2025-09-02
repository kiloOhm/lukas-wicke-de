<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import Button from '$lib/components/ui/button/button.svelte';
	import { enhance } from '$app/forms';
</script>

<section class="flex w-full flex-grow items-center justify-center">
	<Card.Root class="max-w-md flex-grow">
		<Card.Content>
			<form action="?/login" method="POST" use:enhance class="flex flex-col gap-2">
				<div>
					<Input name="password" placeholder="Password" type="password" />
				</div>
				<Button type="submit">Submit</Button>
			</form>
		</Card.Content>
	</Card.Root>
</section>
