<script lang="ts">
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import { Switch } from "$lib/components/ui/switch/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { dragHandle, dragHandleZone } from "svelte-dnd-action";
	import {
		getBuildState,
		setMapName,
		setSkybox,
		setFastMode,
		setLightPreset,
		setOutputDir,
		removeArena,
		reorderArenas,
		startBuild,
		finishBuild,
		toBuildConfig,
		SKYBOX_OPTIONS,
		LIGHT_PRESETS,
	} from "$lib/stores/build.svelte.js";
	import { getArenasState } from "$lib/stores/arenas.svelte.js";
	import { api } from "$lib/rpc.js";
	import MenuPreview from "$lib/components/MenuPreview.svelte";

	let { onNavigate }: { onNavigate: (view: "arenas" | "config" | "build") => void } = $props();

	const build = getBuildState();
	const arenasState = getArenasState();

	function arenaName(arenaId: string): string {
		const arena = arenasState.arenas.find((a) => a.id === arenaId);
		return arena?.meta.name ?? arenaId;
	}

	const menuEntries = $derived(
		[...build.selectedArenas].map(([arenaId, count]) => {
			const arena = arenasState.arenas.find((a) => a.id === arenaId);
			return {
				name: arena?.meta.name ?? arenaId,
				gamemode: arena?.meta.gamemode ?? "mge",
				teamSize: arena?.meta.team_size ?? "1v1",
				count,
			};
		}),
	);

	function handleMapNameInput(e: Event) {
		const target = e.target as HTMLInputElement;
		setMapName(target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""));
	}

	async function handleSelectOutputDir() {
		const dir = await api.selectFolder({}, { maxRequestTime: Infinity });
		if (dir) setOutputDir(dir);
	}

	async function handleBuild() {
		startBuild();
		onNavigate("build");
		const result = await api.build(toBuildConfig(), {
			maxRequestTime: Infinity,
		});
		finishBuild(result);
	}

	let mapNameValue = $derived(build.mapName);
	let fastModeValue = $derived(build.fastMode);

	type SummaryRow = { id: string; count: number };

	const sourceRows = $derived(
		[...build.selectedArenas].map(([id, count]) => ({ id, count })),
	);
	let dragRows = $state<SummaryRow[] | null>(null);
	const rows = $derived(dragRows ?? sourceRows);

	function onconsider(event: CustomEvent<{ items: SummaryRow[] }>) {
		dragRows = event.detail.items;
	}

	function onfinalize(event: CustomEvent<{ items: SummaryRow[] }>) {
		reorderArenas(event.detail.items.map((row) => row.id));
		dragRows = null;
	}
</script>

<div class="flex flex-col h-full">
	<!-- Header -->
	<div class="border-b border-border px-6 py-4">
		<h2 class="text-lg font-semibold text-foreground">Build Configuration</h2>
		<p class="text-sm text-muted-foreground mt-0.5">
			Configure your map settings before building.
		</p>
	</div>

	<div class="grid min-h-0 flex-1 grid-cols-1 gap-6 overflow-y-auto p-6 xl:grid-cols-3 xl:overflow-hidden">
			<!-- Left: Settings form -->
			<div class="space-y-6 min-h-0 xl:overflow-y-auto">
				<h3 class="text-sm font-semibold text-foreground uppercase tracking-wider">
					Map Settings
				</h3>

				<!-- Map Name -->
				<div class="space-y-2">
					<Label for="map-name">Map Name</Label>
					<Input
						id="map-name"
						value={mapNameValue}
						oninput={handleMapNameInput}
						placeholder="mge_custom"
					/>
					{#if build.mapNameError}
						<p class="text-xs text-destructive">{build.mapNameError}</p>
					{/if}
				</div>

				<!-- Skybox -->
				<div class="space-y-2">
					<Label for="skybox">Skybox</Label>
					<select
						id="skybox"
						class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
						value={build.skybox}
						onchange={(e) => setSkybox((e.target as HTMLSelectElement).value)}
					>
						{#each SKYBOX_OPTIONS as sky}
							<option value={sky}>{sky}</option>
						{/each}
					</select>
				</div>

				<!-- Lighting Preset -->
				<div class="space-y-2">
					<Label for="lighting">Lighting Preset</Label>
					<select
						id="lighting"
						class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
						value={build.lightPresetIndex}
						onchange={(e) =>
							setLightPreset(Number((e.target as HTMLSelectElement).value))}
					>
						{#each LIGHT_PRESETS as preset, i}
							<option value={i}>{preset.name}</option>
						{/each}
					</select>
				</div>

				<!-- Fast Mode -->
				<div class="flex items-center justify-between">
					<div class="space-y-0.5">
						<Label>Fast Compile</Label>
						<p class="text-xs text-muted-foreground">
							Compiles quickly for testing. Disable for final builds.
						</p>
					</div>
					<Switch
						checked={fastModeValue}
						onCheckedChange={(value) => setFastMode(value)}
					/>
				</div>

				<!-- Output Directory -->
				<div class="space-y-2">
					<Label>Output Directory</Label>
					<p class="text-xs text-muted-foreground">
						Where to place the final BSP and config after building.
					</p>
					<div class="flex gap-2">
						<Input
							value={build.outputDir ?? ""}
							placeholder="Temp folder (default)"
							readonly
							class="flex-1 cursor-default"
						/>
						<Button variant="outline" size="sm" onclick={handleSelectOutputDir}>
							Browse
						</Button>
						{#if build.outputDir}
							<Button variant="outline" size="sm" onclick={() => setOutputDir(null)}>
								Clear
							</Button>
						{/if}
					</div>
				</div>
			</div>

			<div class="flex min-h-0 flex-col gap-3 xl:h-full">
				<h3 class="text-sm font-semibold text-foreground uppercase tracking-wider shrink-0">
					Build Summary
				</h3>

				{#if build.totalInstances === 0}
					<div class="rounded-lg border border-dashed border-border p-6 text-center">
						<p class="text-sm text-muted-foreground">No arenas selected.</p>
						<button
							onclick={() => onNavigate("arenas")}
							class="text-sm text-primary hover:underline mt-1 inline-block"
						>
							Go to Arenas page to add some
						</button>
					</div>
				{:else}
					<p class="text-xs text-muted-foreground shrink-0">
						Drag a block to set the Join arena order.
					</p>
					<div
						class="max-h-72 space-y-1 overflow-y-auto xl:max-h-none xl:min-h-0 xl:flex-1"
						use:dragHandleZone={{
							items: rows,
							flipDurationMs: 200,
							dropTargetStyle: { outline: "none" },
						}}
						onconsider={onconsider}
						onfinalize={onfinalize}
					>
						{#each rows as row (row.id)}
							<div class="flex h-8 items-center gap-2 rounded-md border border-border bg-card px-2">
								<span
									class="cursor-grab text-muted-foreground active:cursor-grabbing"
									use:dragHandle
									aria-label="Drag {arenaName(row.id)}"
								>
									<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
										<circle cx="9" cy="7" r="1.4" /><circle cx="15" cy="7" r="1.4" />
										<circle cx="9" cy="12" r="1.4" /><circle cx="15" cy="12" r="1.4" />
										<circle cx="9" cy="17" r="1.4" /><circle cx="15" cy="17" r="1.4" />
									</svg>
								</span>
								<span class="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
									{arenaName(row.id)}
								</span>
								<span class="shrink-0 text-xs text-muted-foreground">x{row.count}</span>
								<button
									class="text-muted-foreground hover:text-destructive p-0.5"
									onclick={() => removeArena(row.id)}
									aria-label="Remove {arenaName(row.id)}"
								>
									<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
									</svg>
								</button>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<div class="min-h-0 xl:overflow-y-auto">
				<h3 class="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">
					Menu
				</h3>
				{#if build.totalInstances === 0}
					<p class="text-sm text-muted-foreground">Select arenas to preview the join menu.</p>
				{:else}
					<MenuPreview entries={menuEntries} />
				{/if}
			</div>
	</div>

	<div class="shrink-0 border-t border-border bg-card px-6 py-3 flex items-center justify-end gap-6">
		<div class="min-w-0 text-right">
			<p class="text-sm text-muted-foreground">
				Total instances
				<span class="ml-2 font-semibold text-foreground">{build.totalInstances} / {build.maxArenas}</span>
			</p>
			{#if build.atArenaCap}
				<p class="text-xs text-yellow-500">
					MGEMod loads at most {build.maxArenas} arenas on one map.
				</p>
			{/if}
			{#if build.totalInstances > 8}
				<p class="text-xs text-yellow-500">
					More than 8 arenas can hit Source engine limits.
				</p>
			{/if}
		</div>
		<Button
			size="lg"
			disabled={!build.canBuild}
			onclick={handleBuild}
		>
			{#if !build.canBuild}
				{build.totalInstances === 0 ? "Select arenas to build" : "Fix errors to build"}
			{:else}
				Build Map
			{/if}
		</Button>
	</div>
</div>
