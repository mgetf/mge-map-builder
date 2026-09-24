<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import { getBuildState, resetBuild } from "$lib/stores/build.svelte.js";
	import { api } from "$lib/rpc.js";

	let { onNavigate }: { onNavigate: (view: "arenas" | "config" | "build") => void } = $props();

	const build = getBuildState();

	let copying = $state(false);
	let copySuccess = $state(false);
	let copyError = $state<string | null>(null);

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

	function fileName(p: string): string {
		const parts = p.split(/[/\\]/);
		return parts[parts.length - 1] ?? p;
	}
</script>

<div class="shrink-0 border-t border-border bg-card px-6 py-3 space-y-2">
	{#if build.buildResult?.success}
		<div class="flex items-center gap-2 min-w-0">
			<svg class="h-4 w-4 shrink-0 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
				<polyline points="20 6 9 17 4 12" />
			</svg>
			<p class="text-sm text-foreground shrink-0">Build ready.</p>
			{#if build.buildResult.bspPath}
				<p class="text-xs font-mono text-muted-foreground truncate" title={build.buildResult.bspPath}>
					{fileName(build.buildResult.bspPath)}
				</p>
			{/if}
		</div>

		{#if copySuccess}
			<p class="text-sm text-green-400">Copied to TF2.</p>
		{:else if copyError}
			<p class="text-sm text-destructive">{copyError}</p>
		{/if}

		<div class="flex flex-wrap gap-2">
			<Button size="sm" disabled={copying || copySuccess} onclick={handleCopyToTF2}>
				{#if copying}
					Copying...
				{:else if copySuccess}
					Copied to TF2
				{:else}
					Copy to TF2
				{/if}
			</Button>
			<Button variant="outline" size="sm" onclick={handleOpenFolder}>
				Open Build Folder
			</Button>
			<Button variant="outline" size="sm" onclick={handleBuildAnother}>
				Build Another
			</Button>
		</div>
	{:else}
		<div class="flex items-start gap-2 min-w-0">
			<svg class="h-4 w-4 shrink-0 text-destructive mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
				<circle cx="12" cy="12" r="10" />
				<line x1="12" y1="8" x2="12" y2="12" />
				<line x1="12" y1="16" x2="12.01" y2="16" />
			</svg>
			<p class="text-sm text-destructive">
				{build.buildResult?.error ?? "The compile process encountered an error."}
			</p>
		</div>
		<Button variant="outline" size="sm" onclick={handleBuildAnother}>
			Try Again
		</Button>
	{/if}
</div>
