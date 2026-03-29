import type {
	BuildConfig,
	LightEnvironment,
} from "../../electron/types.js";

// --- Lighting presets ---

export const LIGHT_PRESETS: { name: string; value: LightEnvironment }[] = [
	{
		name: "Badlands Warm",
		value: {
			angles: "0 210 0",
			pitch: "-30",
			_light: "251 201 155 250",
			_ambient: "153 159 187 170",
			_lightHDR: "-1 -1 -1 1",
			_lightscaleHDR: "1",
			_ambientHDR: "-1 -1 -1 1",
			_AmbientScaleHDR: "1",
		},
	},
	{
		name: "Granary Industrial",
		value: {
			angles: "0 180 0",
			pitch: "-45",
			_light: "180 195 215 220",
			_ambient: "140 150 175 150",
			_lightHDR: "-1 -1 -1 1",
			_lightscaleHDR: "1",
			_ambientHDR: "-1 -1 -1 1",
			_AmbientScaleHDR: "1",
		},
	},
	{
		name: "Overcast",
		value: {
			angles: "0 90 0",
			pitch: "-60",
			_light: "200 200 210 180",
			_ambient: "170 175 190 160",
			_lightHDR: "-1 -1 -1 1",
			_lightscaleHDR: "1",
			_ambientHDR: "-1 -1 -1 1",
			_AmbientScaleHDR: "1",
		},
	},
];

export const SKYBOX_OPTIONS = [
	"sky_trainyard_01",
	"sky_badlands_01",
	"sky_granary_01",
	"sky_well_01",
	"sky_dustbowl_01",
	"sky_hydro_01",
	"sky_gravel_01",
	"sky_tf2_04",
] as const;

// --- State ---

let selectedArenas = $state<Map<string, number>>(new Map());
let mapName = $state("mge_custom");
let fastMode = $state(true);
let skybox = $state<string>("sky_trainyard_01");
let lightPresetIndex = $state(0);

export function getBuildState() {
	return {
		get selectedArenas() {
			return selectedArenas;
		},
		get mapName() {
			return mapName;
		},
		get fastMode() {
			return fastMode;
		},
		get skybox() {
			return skybox;
		},
		get lightPresetIndex() {
			return lightPresetIndex;
		},
		get totalInstances() {
			let total = 0;
			for (const count of selectedArenas.values()) {
				total += count;
			}
			return total;
		},
		get canBuild() {
			let total = 0;
			for (const count of selectedArenas.values()) {
				total += count;
			}
			return total > 0 && mapName.length > 0;
		},
		get mapNameError() {
			if (mapName.length === 0) return "Map name is required";
			if (!/^[a-z][a-z0-9_]*$/.test(mapName))
				return "Lowercase letters, numbers, and underscores only";
			if (!mapName.startsWith("mge_"))
				return 'Must start with "mge_"';
			return null;
		},
	};
}

export function setArenaCount(arenaId: string, count: number) {
	const next = new Map(selectedArenas);
	if (count <= 0) {
		next.delete(arenaId);
	} else {
		next.set(arenaId, Math.min(count, 5));
	}
	selectedArenas = next;
}

export function removeArena(arenaId: string) {
	const next = new Map(selectedArenas);
	next.delete(arenaId);
	selectedArenas = next;
}

export function setMapName(name: string) {
	mapName = name;
}

export function setFastMode(value: boolean) {
	fastMode = value;
}

export function setSkybox(value: string) {
	skybox = value;
}

export function setLightPreset(index: number) {
	lightPresetIndex = index;
}

export function toBuildConfig(): BuildConfig {
	return {
		mapName,
		skybox,
		lightEnvironment: LIGHT_PRESETS[lightPresetIndex].value,
		fastMode,
		arenas: Array.from(selectedArenas.entries()).map(
			([arenaId, count]) => ({
				arenaId,
				count,
			}),
		),
	};
}
