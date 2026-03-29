<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { cn } from "$lib/utils.js";

	let {
		class: className,
		children,
		...restProps
	}: HTMLAttributes<HTMLDivElement> & {
		children?: import("svelte").Snippet;
	} = $props();
</script>

<div class={cn("flex flex-col space-y-1.5 p-4", className)} {...restProps}>
	{@render children?.()}
</div>
