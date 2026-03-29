<script lang="ts">
	import { onMount } from "svelte";
	import Sidebar from "$lib/components/Sidebar.svelte";
	import TF2Setup from "$lib/components/TF2Setup.svelte";
	import { getTf2State, detectTF2 } from "$lib/stores/tf2.svelte.js";
	import { fetchArenas } from "$lib/stores/arenas.svelte.js";

	let { children } = $props();

	const tf2 = getTf2State();
	let setupDismissed = $state(false);

	onMount(() => {
		detectTF2();
		fetchArenas();
	});

	function handleContinue() {
		setupDismissed = true;
	}

	const showSetup = $derived(!tf2.loading && !tf2.detected && !setupDismissed);
</script>

{#if showSetup}
	<TF2Setup onContinue={handleContinue} />
{:else}
	<div class="flex h-screen overflow-hidden">
		<Sidebar />
		<main class="flex-1 overflow-y-auto bg-background">
			{@render children()}
		</main>
	</div>
{/if}
