<script lang="ts">
	import { Separator } from "$lib/components/ui/separator/index.js";
	import { getTf2State } from "$lib/stores/tf2.svelte.js";
	import { getBuildState } from "$lib/stores/build.svelte.js";

	let {
		currentView,
		onNavigate,
	}: {
		currentView: "arenas" | "config" | "build";
		onNavigate: (view: "arenas" | "config" | "build") => void;
	} = $props();

	const tf2 = getTf2State();
	const build = getBuildState();

	function isActive(view: "arenas" | "config"): boolean {
		return currentView === view;
	}

	function truncatePath(p: string, maxLen: number = 28): string {
		if (p.length <= maxLen) return p;
		return "..." + p.slice(-(maxLen - 3));
	}

	const navItems: { view: "arenas" | "config"; label: string; icon: string }[] = [
		{ view: "arenas", label: "Arenas", icon: "grid" },
		{ view: "config", label: "Build Config", icon: "settings" },
	];
</script>

<aside class="flex flex-col w-60 shrink-0 bg-sidebar border-r border-sidebar-border h-screen">
	<!-- Logo / Title -->
	<div class="p-5 pb-4">
		<h1 class="text-base font-bold tracking-tight text-sidebar-foreground">
			MGE Map Builder
		</h1>
		<p class="text-xs text-muted-foreground mt-0.5">TF2 Arena Assembler</p>
	</div>

	<Separator />

	<!-- Navigation -->
	<nav class="flex-1 p-3 space-y-1">
		{#each navItems as item}
			<button
				onclick={() => onNavigate(item.view)}
				class="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors {isActive(item.view)
					? 'bg-sidebar-accent text-sidebar-accent-foreground'
					: 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'}"
			>
				{#if item.icon === "grid"}
					<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
					</svg>
				{:else}
					<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
						<circle cx="12" cy="12" r="3" />
					</svg>
				{/if}
				<span>{item.label}</span>
				{#if item.view === "arenas" && build.totalInstances > 0}
					<span class="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground px-1.5">
						{build.totalInstances}
					</span>
				{/if}
			</button>
		{/each}
	</nav>

	<!-- TF2 Status -->
	<div class="mt-auto p-4">
		<Separator class="mb-3" />
		<div class="flex items-center gap-2 text-xs">
			<span
				class="h-2 w-2 rounded-full shrink-0 {tf2.detected
					? 'bg-green-500'
					: 'bg-red-500'}"
			></span>
			{#if tf2.detected && tf2.path}
				<span class="text-muted-foreground truncate" title={tf2.path}>
					{truncatePath(tf2.path)}
				</span>
			{:else}
				<span class="text-muted-foreground">TF2 not detected</span>
			{/if}
		</div>
	</div>
</aside>
