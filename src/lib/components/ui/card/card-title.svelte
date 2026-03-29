<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { cn } from "$lib/utils.js";

	let {
		class: className,
		children,
		...restProps
	}: HTMLAttributes<HTMLHeadingElement> & {
		children?: import("svelte").Snippet;
	} = $props();
</script>

<h3 class={cn("text-base font-semibold leading-none tracking-tight", className)} {...restProps}>
	{@render children?.()}
</h3>
