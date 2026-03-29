<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import {
		Card,
		CardHeader,
		CardTitle,
		CardDescription,
		CardContent,
		CardFooter,
	} from "$lib/components/ui/card/index.js";
	import { getTf2State, setManualTF2Path } from "$lib/stores/tf2.svelte.js";
	import { api } from "$lib/rpc.js";

	const tf2 = getTf2State();

	let browseError = $state<string | null>(null);
	let browsing = $state(false);

	async function handleBrowse() {
		browseError = null;
		browsing = true;
		try {
			const selectedPath = await api.selectFolder({});
			if (selectedPath) {
				const valid = await setManualTF2Path(selectedPath);
				if (!valid) {
					browseError = "Selected folder doesn't contain TF2 compile tools (bin/vbsp.exe not found).";
				}
			}
		} catch (err) {
			browseError = "Failed to open folder dialog.";
			console.error(err);
		} finally {
			browsing = false;
		}
	}

	let { onContinue }: { onContinue: () => void } = $props();
</script>

<div class="flex items-center justify-center min-h-screen bg-background p-8">
	<Card class="w-full max-w-lg">
		<CardHeader class="text-center">
			<div class="mx-auto mb-3">
				{#if tf2.loading}
					<div class="h-12 w-12 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
				{:else if tf2.detected}
					<div class="h-12 w-12 rounded-full bg-green-500/15 flex items-center justify-center">
						<svg class="h-6 w-6 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
							<polyline points="20 6 9 17 4 12" />
						</svg>
					</div>
				{:else}
					<div class="h-12 w-12 rounded-full bg-destructive/15 flex items-center justify-center">
						<svg class="h-6 w-6 text-destructive" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
							<circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
						</svg>
					</div>
				{/if}
			</div>
			<CardTitle class="text-xl">
				{#if tf2.loading}
					Searching for TF2...
				{:else if tf2.detected}
					TF2 Found
				{:else}
					TF2 Not Found
				{/if}
			</CardTitle>
			<CardDescription>
				{#if tf2.loading}
					Checking common installation paths...
				{:else if tf2.detected}
					Compile tools are available at the path below.
				{:else}
					MGE Map Builder needs TF2 installed for its compile tools (VBSP, VVIS, VRAD).
				{/if}
			</CardDescription>
		</CardHeader>

		<CardContent class="space-y-4">
			{#if tf2.detected && tf2.path}
				<div class="rounded-md bg-secondary px-3 py-2 text-sm font-mono text-secondary-foreground break-all">
					{tf2.path}
				</div>
			{/if}

			{#if !tf2.loading && !tf2.detected}
				<Button variant="outline" class="w-full" disabled={browsing} onclick={handleBrowse}>
					{browsing ? "Opening..." : "Browse for TF2 folder..."}
				</Button>
				{#if browseError}
					<p class="text-sm text-destructive">{browseError}</p>
				{/if}
			{/if}
		</CardContent>

		<CardFooter class="justify-center">
			<Button
				disabled={!tf2.detected}
				onclick={onContinue}
				class="w-full"
			>
				Continue
			</Button>
		</CardFooter>
	</Card>
</div>
