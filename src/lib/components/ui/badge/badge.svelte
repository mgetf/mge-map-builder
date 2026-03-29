<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { cn } from "$lib/utils.js";
	import { badgeVariants } from "./index.js";
	import { type VariantProps } from "tailwind-variants";

	type Variant = VariantProps<typeof badgeVariants>["variant"];

	let {
		class: className,
		variant = "default" as Variant,
		children,
		...restProps
	}: HTMLAttributes<HTMLDivElement> & {
		variant?: Variant;
		children?: import("svelte").Snippet;
	} = $props();
</script>

<div class={cn(badgeVariants({ variant }), className)} {...restProps}>
	{@render children?.()}
</div>
