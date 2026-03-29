<script lang="ts">
	import type { HTMLButtonAttributes } from "svelte/elements";
	import { type VariantProps } from "tailwind-variants";
	import { cn } from "$lib/utils.js";
	import { buttonVariants } from "./index.js";

	type Variant = VariantProps<typeof buttonVariants>["variant"];
	type Size = VariantProps<typeof buttonVariants>["size"];

	let {
		class: className,
		variant = "default" as Variant,
		size = "default" as Size,
		children,
		...restProps
	}: HTMLButtonAttributes & {
		variant?: Variant;
		size?: Size;
		children?: import("svelte").Snippet;
	} = $props();
</script>

<button class={cn(buttonVariants({ variant, size }), className)} {...restProps}>
	{@render children?.()}
</button>
