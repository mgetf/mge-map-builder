/** Arena slots MGEMod can load on one map. Arrays are sized MAXARENAS + 1 and index 0 is unused. */
export const MAX_ARENAS = 63;

/** TF2 engine cap on displacement faces (MAX_MAP_DISPINFO). */
export const MAX_MAP_DISPINFO = 2048;

const DISPINFO_KEY = /^\s*dispinfo\s*$/gm;

export function countDisplacementKeys(vmfText: string): number {
	DISPINFO_KEY.lastIndex = 0;
	return vmfText.match(DISPINFO_KEY)?.length ?? 0;
}

export function sumSelectedDisplacements(
	selected: Iterable<[string, number]>,
	arenas: { id: string; displacementCount: number }[],
): number {
	const counts = new Map<string, number>();
	for (const arena of arenas) counts.set(arena.id, arena.displacementCount);
	let total = 0;
	for (const [id, copies] of selected) {
		total += (counts.get(id) ?? 0) * copies;
	}
	return total;
}

export function displacementLimitError(used: number): string | null {
	if (used <= MAX_MAP_DISPINFO) return null;
	return `Too many displacement surfaces (${used} / ${MAX_MAP_DISPINFO}). TF2's MAX_MAP_DISPINFO is ${MAX_MAP_DISPINFO}. Remove copies or pick arenas with less terrain.`;
}

export function clampArenaCount(
	requested: number,
	currentForArena: number,
	totalInstances: number,
): number {
	const others = totalInstances - currentForArena;
	const room = Math.max(0, MAX_ARENAS - others);
	if (!Number.isFinite(requested)) return 0;
	const whole = Math.floor(requested);
	if (whole <= 0) return 0;
	return Math.min(whole, room);
}

// Arena package metadata (matches meta.json schema)
export interface ArenaMeta {
	name: string;
	description: string;
	vmf: string;
	gamemode: string; // "mge" | "bball" | "koth" | "ammomod" | "midair" | "endif" | "ultiduo" | "turris"
	team_size: string; // "1v1" | "2v2" | "1v1 2v2" | "2v2 1v1"
	frag_limit: number;
	allowed_classes: string; // space-separated: "scout soldier demoman"
	hp_multiplier: number;
	early_leave_threshold: number;
	infinite_ammo: boolean;
	show_hp: boolean;
	min_spawn_distance: number;
	spawns: ArenaSpawns;
	// Optional fields
	cap_limit?: number;
	min_elo?: number;
	max_elo?: number;
	countdown_seconds?: number;
	knockback_boost?: boolean;
	visible_hoops?: boolean;
	allow_koth_switch?: boolean;
	koth_team_spawns?: boolean;
	respawn_delay?: number;
	allow_class_change?: boolean;
	koth_round_time?: number;
	entities?: ArenaEntities;
}

// Spawn coordinates: "x y z pitch yaw roll" (local to arena origin)
// Three supported formats matching MGEMod parser:
export type ArenaSpawns =
	| string[] // Flat: ["coord1", "coord2", ...] — red = first half
	| { red: string[]; blu: string[] } // Team-split
	| {
			red: Record<string, string[]>;
			blu: Record<string, string[]>;
	  }; // Class-specific: { red: { soldier: [...], medic: [...] } }

export interface ArenaEntities {
	capture_point?: string; // "x y z" — KOTH/Ultiduo
	hoop_red?: string; // "x y z" — BBall
	hoop_blu?: string;
	intel_start?: string;
	intel_red?: string;
	intel_blu?: string;
}

// Loaded arena with resolved paths
export interface ArenaPackage {
	id: string; // folder name
	meta: ArenaMeta;
	vmfPath: string; // absolute path to VMF
	assetsDir: string | null; // absolute path to assets/ or null
	hasCustomAssets: boolean;
	bounds: ArenaBounds; // measured from VMF
	displacementCount: number;
	imported: boolean;
}

export interface ImportArenaResult {
	cancelled: boolean;
	error: string | null;
	arena: ArenaPackage | null;
}

export interface ArenaBounds {
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
	minZ: number;
	maxZ: number;
	spanX: number;
	spanY: number;
	spanZ: number;
}

// An arena placed in the map at a specific position
export interface PlacedArena {
	arena: ArenaPackage;
	instanceName: string; // "Badlands Middle 1", "Badlands Middle 2", etc.
	origin: [number, number, number];
	menuIndex: number;
}

// Build configuration from the UI
export interface BuildConfig {
	mapName: string;
	skybox: string;
	lightEnvironment: LightEnvironment;
	fastMode: boolean;
	arenas: BuildArenaEntry[];
	outputDir: string | null; // copy BSP + cfg here after build; null = temp only
}

export interface BuildArenaEntry {
	arenaId: string;
	count: number; // how many instances of this arena
}

export interface LightEnvironment {
	angles: string;
	pitch: string;
	_light: string;
	_ambient: string;
	_lightHDR: string;
	_lightscaleHDR: string;
	_ambientHDR: string;
	_AmbientScaleHDR: string;
}

// Compile pipeline events streamed to renderer
export type CompileStage = "vbsp" | "vvis" | "vrad" | "pack";

export interface CompileProgress {
	stage: CompileStage;
	status: "running" | "done" | "error";
	output: string; // latest stdout/stderr line
	elapsedMs: number;
}

export interface BuildResult {
	success: boolean;
	bspPath: string | null;
	cfgPath: string | null;
	error: string | null;
	errorDetail: string | null;
	logPath: string | null;
}
