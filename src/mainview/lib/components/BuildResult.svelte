<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import { getBuildState, resetBuild } from "$lib/stores/build.svelte.js";
	import { api } from "$lib/rpc.js";
	let { onNavigate }: { onNavigate: (view: "arenas" | "config" | "build") => void } = $props();

	const build = getBuildState();

	let copying = $state(false);
	let copySuccess = $state(false);
	let copyError = $state<string | null>(null);
	let logExpanded = $state(false);

	async function handleCopyToTF2() {
		const result = build.buildResult;
		if (!result?.bspPath || !result?.cfgPath) return;

		copying = true;
		copySuccess = false;
		copyError = null;

		try {
			const ok = await api.copyToTF2({
				bspPath: result.bspPath,
				cfgPath: result.cfgPath,
			});
			if (ok) {
				copySuccess = true;
			} else {
				copyError = "Failed to copy files. Is TF2 still detected?";
			}
		} catch {
			copyError = "An error occurred while copying.";
		} finally {
			copying = false;
		}
	}

	async function handleOpenFolder() {
		const result = build.buildResult;
		if (!result?.bspPath) return;
		const folder = result.bspPath.replace(/[/\\][^/\\]+$/, "");
		await api.openFolder({ path: folder });
	}

	function handleBuildAnother() {
		resetBuild();
		onNavigate("config");
	}

	function truncatePath(p: string): string {
		const maxLen = 60;
		if (p.length <= maxLen) return p;
		return "..." + p.slice(-(maxLen - 3));
	}
</script>

<div class="flex flex-col items-center justify-center h-full p-8">
	{#if build.buildResult?.success}
		<!-- Success state -->
		<div class="w-full max-w-lg space-y-6">
			<div class="text-center space-y-2">
				<div class="h-14 w-14 rounded-full bg-green-500/15 flex items-center justify-center mx-auto">
					<svg class="h-7 w-7 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
						<polyline points="20 6 9 17 4 12" />
					</svg>
				</div>
				<h2 class="text-xl font-semibold text-foreground">Build Complete</h2>
				<p class="text-sm text-muted-foreground">Your map has been compiled successfully.</p>
			</div>

			<!-- Output paths -->
			<div class="rounded-lg border border-border bg-card p-4 space-y-3">
				{#if build.buildResult.bspPath}
					<div class="space-y-1">
						<p class="text-xs font-medium text-muted-foreground uppercase tracking-wider">BSP</p>
						<p class="text-sm font-mono text-foreground break-all">
							{build.buildResult.bspPath}
						</p>
					</div>
				{/if}
				{#if build.buildResult.cfgPath}
					<div class="space-y-1">
						<p class="text-xs font-medium text-muted-foreground uppercase tracking-wider">MGEMod Config</p>
						<p class="text-sm font-mono text-foreground break-all">
							{truncatePath(build.buildResult.cfgPath)}
						</p>
					</div>
				{/if}
			</div>

			<!-- Actions -->
			<div class="space-y-2">
				{#if copySuccess}
					<div class="flex items-center gap-2 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-400">
						<svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
							<polyline points="20 6 9 17 4 12" />
						</svg>
						Copied to TF2 successfully!
					</div>
				{:else if copyError}
					<p class="text-sm text-destructive">{copyError}</p>
				{/if}

				<Button
					class="w-full"
					disabled={copying || copySuccess}
					onclick={handleCopyToTF2}
				>
					{#if copying}
						Copying...
					{:else if copySuccess}
						Copied to TF2
					{:else}
						Copy to TF2
					{/if}
				</Button>

				<div class="flex gap-2">
					<Button variant="outline" class="flex-1" onclick={handleOpenFolder}>
						Open Build Folder
					</Button>
					<Button variant="outline" class="flex-1" onclick={handleBuildAnother}>
						Build Another
					</Button>
				</div>
			</div>
		</div>

	{:else}
		<!-- Error state -->
		<div class="w-full max-w-lg space-y-6">
			<div class="text-center space-y-2">
				<div class="h-14 w-14 rounded-full bg-destructive/15 flex items-center justify-center mx-auto">
					<svg class="h-7 w-7 text-destructive" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
						<circle cx="12" cy="12" r="10" />
						<line x1="12" y1="8" x2="12" y2="12" />
						<line x1="12" y1="16" x2="12.01" y2="16" />
					</svg>
				</div>
				<h2 class="text-xl font-semibold text-foreground">Build Failed</h2>
				{#if build.buildResult?.error}
					<p class="text-sm text-destructive">{build.buildResult.error}</p>
				{/if}
			</div>

			<!-- Expandable log -->
			<div class="rounded-lg border border-border overflow-hidden">
				<button
					class="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
					onclick={() => (logExpanded = !logExpanded)}
				>
					<span>Compile Log</span>
					<svg
						class="h-4 w-4 text-muted-foreground transition-transform {logExpanded ? 'rotate-180' : ''}"
						viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
					>
						<polyline points="6 9 12 15 18 9" />
					</svg>
				</button>
				{#if logExpanded}
					<div class="max-h-64 overflow-y-auto bg-black/40 p-3 font-mono text-xs text-muted-foreground leading-5">
						{#each build.compileLog as line, i (i)}
							<div class="whitespace-pre-wrap break-all
								{line.includes('error') || line.includes('Error') ? 'text-destructive' : ''}
								{line.includes('Warning') || line.includes('warning') ? 'text-yellow-500' : ''}">
								{line}
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<Button class="w-full" onclick={handleBuildAnother}>
				Try Again
			</Button>
		</div>
	{/if}
</div>
