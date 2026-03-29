<script lang="ts">
	import BuildProgress from "$lib/components/BuildProgress.svelte";
	import BuildResult from "$lib/components/BuildResult.svelte";
	import { getBuildState } from "$lib/stores/build.svelte.js";

	let { onNavigate }: { onNavigate: (view: "arenas" | "config" | "build") => void } = $props();

	const build = getBuildState();
</script>

<div class="flex flex-col h-full">
	<!-- Header -->
	<div class="border-b border-border px-6 py-4 shrink-0">
		<h2 class="text-lg font-semibold text-foreground">
			{#if build.compileStatus === "running"}
				Building Map...
			{:else if build.compileStatus === "done"}
				Build Complete
			{:else if build.compileStatus === "error"}
				Build Failed
			{:else}
				Build
			{/if}
		</h2>
		<p class="text-sm text-muted-foreground mt-0.5">
			{#if build.compileStatus === "running"}
				Compiling your map — this may take a minute.
			{:else if build.compileStatus === "done"}
				Your map is ready.
			{:else if build.compileStatus === "error"}
				The compile process encountered an error.
			{/if}
		</p>
	</div>

	<!-- Content: progress or result -->
	<div class="flex-1 min-h-0">
		{#if build.compileStatus === "running"}
			<BuildProgress />
		{:else if build.compileStatus === "done" || build.compileStatus === "error"}
			<BuildResult {onNavigate} />
		{/if}
	</div>
</div>
