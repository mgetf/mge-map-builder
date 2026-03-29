<script lang="ts">
	import type { ArenaPackage } from "$lib/stores/arenas.svelte.js";
	import {
		Card,
		CardHeader,
		CardContent,
		CardFooter,
	} from "$lib/components/ui/card/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { getBuildState, setArenaCount } from "$lib/stores/build.svelte.js";

	let { arena }: { arena: ArenaPackage } = $props();

	const build = getBuildState();

	const count = $derived(build.selectedArenas.get(arena.id) ?? 0);
	const isSelected = $derived(count > 0);

	function increment() {
		setArenaCount(arena.id, count + 1);
	}

	function decrement() {
		setArenaCount(arena.id, count - 1);
	}

	function spawnLabel(): string {
		const spawns = arena.meta.spawns;
		if (Array.isArray(spawns)) {
			return `${spawns.length} spawns`;
		}
		if ("red" in spawns && "blu" in spawns) {
			const red = Array.isArray(spawns.red)
				? spawns.red.length
				: Object.values(spawns.red as Record<string, string[]>).reduce((a: number, b: string[]) => a + b.length, 0);
			const blu = Array.isArray(spawns.blu)
				? spawns.blu.length
				: Object.values(spawns.blu as Record<string, string[]>).reduce((a: number, b: string[]) => a + b.length, 0);
			return `${red}v${blu} spawns`;
		}
		return "spawns";
	}

	function classesLabel(): string {
		const classes = arena.meta.allowed_classes.split(" ");
		if (classes.length >= 9) return "All classes";
		return classes
			.map((c: string) => c.charAt(0).toUpperCase() + c.slice(1, 4))
			.join(", ");
	}

	const gamemodeColors: Record<string, "default" | "secondary" | "outline"> = {
		mge: "default",
		endif: "secondary",
		bball: "outline",
		koth: "outline",
		ammomod: "secondary",
		ultiduo: "outline",
	};
</script>

<Card
	class="transition-all duration-150 {isSelected
		? 'border-primary/60 shadow-md shadow-primary/5'
		: 'hover:border-muted-foreground/30'}"
>
	<CardHeader class="pb-2">
		<div class="flex items-start justify-between gap-2">
			<div class="space-y-1 min-w-0">
				<h3 class="text-sm font-semibold leading-tight text-foreground">
					{arena.meta.name}
				</h3>
				<p class="text-xs text-muted-foreground line-clamp-2">
					{arena.meta.description}
				</p>
			</div>
			<Badge variant={gamemodeColors[arena.meta.gamemode] ?? "outline"} class="shrink-0 text-[10px]">
				{arena.meta.gamemode.toUpperCase()}
			</Badge>
		</div>
	</CardHeader>

	<CardContent class="pb-3">
		<div class="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
			<span>{arena.meta.team_size}</span>
			<span>Frag {arena.meta.frag_limit}</span>
			<span>{spawnLabel()}</span>
			<span>{classesLabel()}</span>
		</div>
	</CardContent>

	<CardFooter class="justify-between">
		<div class="flex items-center gap-1.5">
			<Button
				variant="outline"
				size="icon"
				class="h-7 w-7"
				disabled={count <= 0}
				onclick={decrement}
			>
				<svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
					<line x1="5" y1="12" x2="19" y2="12" />
				</svg>
			</Button>
			<span
				class="w-6 text-center text-sm font-semibold tabular-nums {isSelected
					? 'text-primary'
					: 'text-muted-foreground'}"
			>
				{count}
			</span>
			<Button
				variant="outline"
				size="icon"
				class="h-7 w-7"
				disabled={count >= 5}
				onclick={increment}
			>
				<svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
					<line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
				</svg>
			</Button>
		</div>

		{#if isSelected}
			<span class="text-xs font-medium text-primary">
				{count} instance{count !== 1 ? "s" : ""}
			</span>
		{/if}
	</CardFooter>
</Card>
