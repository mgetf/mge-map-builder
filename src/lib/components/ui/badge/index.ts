import { tv, type VariantProps } from "tailwind-variants";
import Root from "./badge.svelte";

const badgeVariants = tv({
	base: "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
	variants: {
		variant: {
			default:
				"border-transparent bg-primary text-primary-foreground",
			secondary:
				"border-transparent bg-secondary text-secondary-foreground",
			outline: "text-foreground",
			destructive:
				"border-transparent bg-destructive text-white",
		},
	},
	defaultVariants: {
		variant: "default",
	},
});

type Variant = VariantProps<typeof badgeVariants>["variant"];
type Props = { variant?: Variant };

export {
	Root,
	type Props,
	Root as Badge,
	type Props as BadgeProps,
	badgeVariants,
};
