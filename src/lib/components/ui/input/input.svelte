<script lang="ts">
	import type { HTMLInputAttributes, HTMLInputTypeAttribute } from 'svelte/elements';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import { IEye, IEyeClosed } from '$lib/components/icons';

	type InputType = Exclude<HTMLInputTypeAttribute, 'file'>;

	type Props = WithElementRef<
		Omit<HTMLInputAttributes, 'type'> &
			({ type: 'file'; files?: FileList } | { type?: InputType; files?: undefined })
	>;

	let {
		ref = $bindable(null),
		value = $bindable(),
		type,
		files = $bindable(),
		class: className,
		...restProps
	}: Props = $props();

	// Password visibility handling
	let showPassword = $state(false);
	const isPassword = $derived(type === 'password');
	const resolvedType = $derived(
		isPassword ? (showPassword ? 'text' : 'password') : (type ?? 'text')
	);
</script>

{#if type === 'file'}
	<input
		bind:this={ref}
		data-slot="input"
		class={cn(
			'flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 pt-1.5 text-sm font-medium shadow-xs ring-offset-background transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30',
			'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
			'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
			className
		)}
		type="file"
		bind:files
		bind:value
		{...restProps}
	/>
{:else}
	<div class="relative">
		<input
			bind:this={ref}
			data-slot="input"
			class={cn(
				'flex h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 py-1 text-base shadow-xs ring-offset-background transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30',
				'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
				'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
				className
			)}
			type={resolvedType}
			bind:value
			{...restProps}
		/>
		{#if isPassword}
			<button
				type="button"
				class="absolute inset-y-0 right-2 my-auto flex h-6 w-6 cursor-pointer items-center justify-center rounded-md ring-offset-background transition outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
				aria-label={showPassword ? 'Hide password' : 'Show password'}
				aria-pressed={showPassword}
				onclick={() => (showPassword = !showPassword)}
			>
				{#if showPassword}
					<IEyeClosed />
				{:else}
					<IEye />
				{/if}
				<span class="sr-only">{showPassword ? 'Hide password' : 'Show password'}</span>
			</button>
		{/if}
	</div>
{/if}
