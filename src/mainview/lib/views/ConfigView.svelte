<script lang="ts">
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import { Switch } from "$lib/components/ui/switch/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import {
		getBuildState,
		setMapName,
		setSkybox,
		setFastMode,
		setLightPreset,
		removeArena,
		startBuild,
		finishBuild,
		toBuildConfig,
		SKYBOX_OPTIONS,
		LIGHT_PRESETS,
	} from "$lib/stores/build.svelte.js";
	import { getArenasState } from "$lib/stores/arenas.svelte.js";
	import { api } from "$lib/rpc.js";

	let { onNavigate }: { onNavigate: (view: "arenas" | "config" | "build") => void } = $props();

	const build = getBuildState();
	const arenasState = getArenasState();

	function arenaName(arenaId: string): string {
		const arena = arenasState.arenas.find((a) => a.id === arenaId);
		return arena?.meta.name ?? arenaId;
	}

	function handleMapNameInput(e: Event) {
		const target = e.target as HTMLInputElement;
		setMapName(target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""));
	}

	async function handleBuild() {
		startBuild();
		onNavigate("build");
		const result = await api.build(toBuildConfig());
		finishBuild(result);
	}

	let mapNameValue = $derived(build.mapName);
	let fastModeValue = $derived(build.fastMode);
</script>

<div class="flex flex-col h-full">
	<!-- Header -->
	<div class="border-b border-border px-6 py-4">
		<h2 class="text-lg font-semibold text-foreground">Build Configuration</h2>
		<p class="text-sm text-muted-foreground mt-0.5">
			Configure your map settings before building.
		</p>
	</div>

	<div class="flex-1 overflow-y-auto p-6">
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-4xl">
			<!-- Left: Settings form -->
			<div class="space-y-6">
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
						onchange={() => setFastMode(!build.fastMode)}
					/>
				</div>
			</div>

			<!-- Right: Build Summary -->
			<div class="space-y-6">
				<h3 class="text-sm font-semibold text-foreground uppercase tracking-wider">
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
					<div class="space-y-2">
						{#each [...build.selectedArenas] as [arenaId, count] (arenaId)}
							<div class="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2">
								<div class="flex items-center gap-2 min-w-0">
									<span class="text-sm font-medium text-foreground truncate">
										{arenaName(arenaId)}
									</span>
									<span class="text-xs text-muted-foreground shrink-0">
										x{count}
									</span>
								</div>
								<button
									class="text-muted-foreground hover:text-destructive transition-colors p-1"
									onclick={() => removeArena(arenaId)}
									aria-label="Remove {arenaName(arenaId)}"
								>
									<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
									</svg>
								</button>
							</div>
						{/each}
					</div>

					<Separator />

					<div class="flex items-center justify-between text-sm">
						<span class="text-muted-foreground">Total instances</span>
						<span class="font-semibold text-foreground">{build.totalInstances}</span>
					</div>

					{#if build.totalInstances > 8}
						<p class="text-xs text-yellow-500">
							Warning: Maps with more than 8 arenas risk hitting Source engine limits (MAX_MAP_PLANES).
						</p>
					{/if}
				{/if}

				<!-- Build Button -->
				<Button
					class="w-full"
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
	</div>
</div>
