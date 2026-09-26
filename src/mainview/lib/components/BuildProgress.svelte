<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import { getBuildState } from "$lib/stores/build.svelte.js";
	import { api } from "$lib/rpc.js";
	import type { CompileStage } from "$lib/types.js";

	const build = getBuildState();

	const STAGE_LABELS: Record<CompileStage, string> = {
		vbsp: "VBSP",
		vvis: "VVIS",
		vrad: "VRAD",
		pack: "PACK",
	};

	let logContainer: HTMLElement | undefined = $state();
	let copyFeedback = $state<"log" | null>(null);

	$effect(() => {
		void build.compileLog.length;
		void build.compileStatus;
		if (!logContainer) return;
		if (build.compileStatus !== "running" && build.compileStatus !== "error") {
			return;
		}
		Promise.resolve().then(() => {
			if (logContainer) {
				logContainer.scrollTop = logContainer.scrollHeight;
			}
		});
	});

	function formatElapsed(ms: number): string {
		if (ms === 0) return "";
		if (ms < 1000) return `${ms}ms`;
		return `${(ms / 1000).toFixed(1)}s`;
	}

	function lineTone(line: string): string {
		const l = line.toLowerCase();
		if (
			l.includes("max_map_") ||
			l.includes("nummapdispinfo") ||
			l.includes("leaked") ||
			l.includes("error") ||
			l.includes("failed") ||
			l.includes("parsedisp")
		) {
			return "text-destructive";
		}
		if (
			/^brush \d+/i.test(line) ||
			/^side \d+/i.test(line) ||
			/^texture:/i.test(line)
		) {
			return "text-destructive";
		}
		if (l.includes("warning")) return "text-yellow-500";
		if (l.includes("completed") || l.includes("finished")) return "text-green-400";
		return "";
	}

	async function handleCancel() {
		await api.cancelBuild({});
	}

	async function handleCopyLog() {
		const text = build.compileLog.join("\n");
		if (!text) return;
		try {
			await navigator.clipboard.writeText(text);
			copyFeedback = "log";
			setTimeout(() => {
				if (copyFeedback === "log") copyFeedback = null;
			}, 1500);
		} catch {
			copyFeedback = null;
		}
	}
</script>

<div class="flex flex-1 min-h-0 flex-col p-6 space-y-5">
	<!-- Stage pipeline -->
	<div class="flex items-center gap-2">
		{#each build.stageOrder as stage, i (stage)}
			{@const info = build.compileStages[stage]}
			<div class="flex items-center gap-2">
				<!-- Stage pill -->
				<div
					class="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-mono font-medium transition-colors
						{info.status === 'running' ? 'border-primary/50 bg-primary/10 text-primary' : ''}
						{info.status === 'done' ? 'border-green-500/50 bg-green-500/10 text-green-400' : ''}
						{info.status === 'error' ? 'border-destructive/50 bg-destructive/10 text-destructive' : ''}
						{info.status === 'pending' ? 'border-border bg-muted/30 text-muted-foreground' : ''}"
				>
					<!-- Status icon -->
					{#if info.status === "running"}
						<div class="h-3 w-3 rounded-full border border-current border-t-transparent animate-spin shrink-0"></div>
					{:else if info.status === "done"}
						<svg class="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
							<polyline points="20 6 9 17 4 12" />
						</svg>
					{:else if info.status === "error"}
						<svg class="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
							<line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
						</svg>
					{:else}
						<div class="h-3 w-3 rounded-full border border-current opacity-30 shrink-0"></div>
					{/if}

					<span>{STAGE_LABELS[stage]}</span>

					{#if info.status !== "pending" && info.elapsedMs > 0}
						<span class="text-xs opacity-60">{formatElapsed(info.elapsedMs)}</span>
					{/if}
				</div>

				<!-- Arrow between stages -->
				{#if i < build.stageOrder.length - 1}
					<svg class="h-3 w-3 text-muted-foreground shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<polyline points="9 18 15 12 9 6" />
					</svg>
				{/if}
			</div>
		{/each}

		<div class="ml-auto flex items-center gap-2">
			{#if build.compileLog.length > 0}
				<Button variant="outline" size="sm" onclick={handleCopyLog}>
					{copyFeedback === "log" ? "Copied" : "Copy log"}
				</Button>
			{/if}
			{#if build.compileStatus === "running"}
				<Button variant="outline" size="sm" onclick={handleCancel}>
					Cancel
				</Button>
			{:else if build.compileStatus === "done"}
				<span class="text-sm font-medium text-green-400">Ready</span>
			{:else if build.compileStatus === "error"}
				<span class="text-sm font-medium text-destructive">Failed</span>
			{/if}
		</div>
	</div>

	<!-- Compile log -->
	<div
		bind:this={logContainer as HTMLElement}
		class="flex-1 overflow-y-auto rounded-md border border-border bg-black/40 p-3 font-mono text-xs text-muted-foreground leading-5 min-h-0"
	>
		{#if build.compileLog.length === 0}
			<p class="text-muted-foreground/50">Waiting for output...</p>
		{:else}
			{#each build.compileLog as line, i (i)}
				<div class={["whitespace-pre-wrap break-all", lineTone(line)]}>
					{line}
				</div>
			{/each}
		{/if}
	</div>
</div>
