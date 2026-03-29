<script lang="ts">
	import ArenaCard from "$lib/components/ArenaCard.svelte";
	import { getArenasState } from "$lib/stores/arenas.svelte.js";
	import { getBuildState } from "$lib/stores/build.svelte.js";

	let { onNavigate }: { onNavigate: (view: "arenas" | "config") => void } = $props();

	const arenasState = getArenasState();
	const build = getBuildState();
</script>

<div class="flex flex-col h-full">
	<!-- Header -->
	<div class="border-b border-border px-6 py-4">
		<h2 class="text-lg font-semibold text-foreground">Select Arenas</h2>
		<p class="text-sm text-muted-foreground mt-0.5">
			Choose which arenas to include in your map and how many instances of each.
		</p>
	</div>

	<!-- Grid -->
	<div class="flex-1 overflow-y-auto p-6">
		{#if arenasState.loading}
			<div class="flex items-center justify-center h-48 text-muted-foreground">
				<div class="text-center space-y-2">
					<div class="h-8 w-8 mx-auto rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
					<p class="text-sm">Loading arenas...</p>
				</div>
			</div>
		{:else if arenasState.arenas.length === 0}
			<div class="flex items-center justify-center h-48 text-muted-foreground">
				<p class="text-sm">No arenas found.</p>
			</div>
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
				{#each arenasState.arenas as arena (arena.id)}
					<ArenaCard {arena} />
				{/each}
			</div>
		{/if}
	</div>

	<!-- Bottom summary bar -->
	{#if build.totalInstances > 0}
		<div class="border-t border-border bg-card px-6 py-3 flex items-center justify-between">
			<div class="text-sm text-muted-foreground">
				<span class="font-semibold text-foreground">{build.totalInstances}</span>
				arena instance{build.totalInstances !== 1 ? "s" : ""} selected
			</div>
			<button
				onclick={() => onNavigate("config")}
				class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
			>
				Configure Build
				<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<polyline points="9 18 15 12 9 6" />
				</svg>
			</button>
		</div>
	{/if}
</div>
