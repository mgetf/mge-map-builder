<script lang="ts">
	import { onMount } from "svelte";
	import Sidebar from "$lib/components/Sidebar.svelte";
	import TF2Setup from "$lib/components/TF2Setup.svelte";
	import ArenasView from "$lib/views/ArenasView.svelte";
	import ConfigView from "$lib/views/ConfigView.svelte";
	import BuildView from "$lib/views/BuildView.svelte";
	import { getTf2State, detectTF2 } from "$lib/stores/tf2.svelte.js";
	import { fetchArenas } from "$lib/stores/arenas.svelte.js";

	const tf2 = getTf2State();
	let currentView = $state<"arenas" | "config" | "build">("arenas");
	let setupDismissed = $state(false);

	onMount(() => {
		detectTF2();
		fetchArenas();
	});

	const showSetup = $derived(!tf2.loading && !tf2.detected && !setupDismissed);

	function navigate(view: "arenas" | "config" | "build") {
		currentView = view;
	}
</script>

{#if showSetup}
	<TF2Setup onContinue={() => (setupDismissed = true)} />
{:else}
	<div class="flex h-full overflow-hidden">
		<Sidebar {currentView} onNavigate={navigate} />
		<main class="flex-1 overflow-y-auto bg-background">
			{#if currentView === "arenas"}
				<ArenasView onNavigate={navigate} />
			{:else if currentView === "config"}
				<ConfigView onNavigate={navigate} />
			{:else}
				<BuildView onNavigate={navigate} />
			{/if}
		</main>
	</div>
{/if}
