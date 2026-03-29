import fs from "node:fs";
import path from "node:path";
import type { PlacedArena, ArenaMeta, ArenaSpawns } from "../types.js";
import { serializeKV } from "./keyvalues.js";

/**
 * Apply origin offset to a spawn coordinate string.
 * Input: "x y z pitch yaw roll" (local) + origin [ox, oy, oz]
 * Output: "worldX worldY worldZ pitch yaw roll"
 */
function offsetSpawn(
	localSpawn: string,
	origin: [number, number, number],
): string {
	const parts = localSpawn.split(" ");
	const x = parseFloat(parts[0]) + origin[0];
	const y = parseFloat(parts[1]) + origin[1];
	const z = parseFloat(parts[2]) + origin[2];
	return `${x} ${y} ${z} ${parts[3]} ${parts[4]} ${parts[5]}`;
}

/**
 * Apply origin offset to an entity coordinate string.
 * Input: "x y z" or "x y z pitch yaw roll" (local) + origin [ox, oy, oz]
 * Output: offset version with only xyz modified
 */
function offsetEntityCoord(
	localCoord: string,
	origin: [number, number, number],
): string {
	const parts = localCoord.split(" ");
	const x = parseFloat(parts[0]) + origin[0];
	const y = parseFloat(parts[1]) + origin[1];
	const z = parseFloat(parts[2]) + origin[2];
	const rest = parts.slice(3).join(" ");
	return rest ? `${x} ${y} ${z} ${rest}` : `${x} ${y} ${z}`;
}

function boolToKV(value: boolean | undefined): string {
	return value ? "1" : "0";
}

/**
 * Build the spawns subsection for a single arena.
 * Handles all three MGEMod spawn formats.
 */
function buildSpawnsSection(
	spawns: ArenaSpawns,
	origin: [number, number, number],
): Record<string, unknown> {
	if (Array.isArray(spawns)) {
		// Flat format: numbered keys
		const section: Record<string, string> = {};
		spawns.forEach((s, i) => {
			section[String(i + 1)] = offsetSpawn(s, origin);
		});
		return section;
	}

	if ("red" in spawns && "blu" in spawns) {
		const redVal = spawns.red;
		const bluVal = spawns.blu;

		if (Array.isArray(redVal) && Array.isArray(bluVal)) {
			// Team-split format: red { "1" "..." } blu { "1" "..." }
			const redSection: Record<string, string> = {};
			redVal.forEach((s, i) => {
				redSection[String(i + 1)] = offsetSpawn(s, origin);
			});
			const bluSection: Record<string, string> = {};
			bluVal.forEach((s, i) => {
				bluSection[String(i + 1)] = offsetSpawn(s, origin);
			});
			return { red: redSection, blu: bluSection };
		}

		// Class-specific format: red { soldier { "1" "..." } } blu { ... }
		const redClasses = redVal as Record<string, string[]>;
		const bluClasses = bluVal as Record<string, string[]>;

		const redSection: Record<string, Record<string, string>> = {};
		for (const [cls, coords] of Object.entries(redClasses)) {
			const clsSection: Record<string, string> = {};
			coords.forEach((s, i) => {
				clsSection[String(i + 1)] = offsetSpawn(s, origin);
			});
			redSection[cls] = clsSection;
		}

		const bluSection: Record<string, Record<string, string>> = {};
		for (const [cls, coords] of Object.entries(bluClasses)) {
			const clsSection: Record<string, string> = {};
			coords.forEach((s, i) => {
				clsSection[String(i + 1)] = offsetSpawn(s, origin);
			});
			bluSection[cls] = clsSection;
		}

		return { red: redSection, blu: bluSection };
	}

	return {};
}

function buildArenaSection(
	meta: ArenaMeta,
	origin: [number, number, number],
): Record<string, unknown> {
	const section: Record<string, unknown> = {};

	section.gamemode = meta.gamemode;
	section.team_size = meta.team_size;
	section.frag_limit = String(meta.frag_limit);
	if (meta.cap_limit !== undefined) section.cap_limit = String(meta.cap_limit);
	if (meta.min_elo !== undefined) section.min_elo = String(meta.min_elo);
	if (meta.max_elo !== undefined) section.max_elo = String(meta.max_elo);
	if (meta.countdown_seconds !== undefined)
		section.countdown_seconds = String(meta.countdown_seconds);
	section.allowed_classes = meta.allowed_classes;
	section.hp_multiplier = String(meta.hp_multiplier);
	section.early_leave_threshold = String(meta.early_leave_threshold);
	section.infinite_ammo = boolToKV(meta.infinite_ammo);
	section.show_hp = boolToKV(meta.show_hp);
	section.min_spawn_distance = String(meta.min_spawn_distance);

	if (meta.knockback_boost !== undefined)
		section.knockback_boost = boolToKV(meta.knockback_boost);
	if (meta.visible_hoops !== undefined)
		section.visible_hoops = boolToKV(meta.visible_hoops);
	if (meta.allow_koth_switch !== undefined)
		section.allow_koth_switch = boolToKV(meta.allow_koth_switch);
	if (meta.koth_team_spawns !== undefined)
		section.koth_team_spawns = boolToKV(meta.koth_team_spawns);
	if (meta.respawn_delay !== undefined)
		section.respawn_delay = String(meta.respawn_delay);
	if (meta.allow_class_change !== undefined)
		section.allow_class_change = boolToKV(meta.allow_class_change);
	if (meta.koth_round_time !== undefined)
		section.koth_round_time = String(meta.koth_round_time);

	// Spawns
	section.spawns = buildSpawnsSection(meta.spawns, origin);

	// Entities (capture_point, hoops, intel)
	if (meta.entities) {
		const entities: Record<string, string> = {};
		for (const [key, value] of Object.entries(meta.entities)) {
			if (value) {
				entities[key] = offsetEntityCoord(value, origin);
			}
		}
		if (Object.keys(entities).length > 0) {
			section.entities = entities;
		}
	}

	return section;
}

export function generateConfig(
	mapName: string,
	placedArenas: PlacedArena[],
	outputDir: string,
): string {
	if (!fs.existsSync(outputDir)) {
		fs.mkdirSync(outputDir, { recursive: true });
	}

	const spawnConfigs: Record<string, unknown> = {};

	for (const placed of placedArenas) {
		spawnConfigs[placed.instanceName] = buildArenaSection(
			placed.arena.meta,
			placed.origin,
		);
	}

	const root: Record<string, unknown> = { SpawnConfigs: spawnConfigs };
	const content = serializeKV(root);

	const cfgPath = path.join(outputDir, `${mapName}.cfg`);
	fs.writeFileSync(cfgPath, content, "utf8");

	return cfgPath;
}
