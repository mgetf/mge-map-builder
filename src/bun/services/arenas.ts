import fs from "node:fs";
import path from "node:path";
import type { ArenaMeta, ArenaPackage, ArenaBounds } from "../types.js";

const COORD_REGEX = /\((-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\)/g;

export function measureBounds(vmfPath: string): ArenaBounds {
	const content = fs.readFileSync(vmfPath, "utf8");

	let minX = Infinity,
		maxX = -Infinity;
	let minY = Infinity,
		maxY = -Infinity;
	let minZ = Infinity,
		maxZ = -Infinity;

	let match: RegExpExecArray | null;
	while ((match = COORD_REGEX.exec(content)) !== null) {
		const x = parseFloat(match[1]);
		const y = parseFloat(match[2]);
		const z = parseFloat(match[3]);
		if (x < minX) minX = x;
		if (x > maxX) maxX = x;
		if (y < minY) minY = y;
		if (y > maxY) maxY = y;
		if (z < minZ) minZ = z;
		if (z > maxZ) maxZ = z;
	}

	if (minX === Infinity) {
		throw new Error(`No coordinates found in VMF: ${vmfPath}`);
	}

	return {
		minX,
		maxX,
		minY,
		maxY,
		minZ,
		maxZ,
		spanX: maxX - minX,
		spanY: maxY - minY,
		spanZ: maxZ - minZ,
	};
}

const REQUIRED_META_FIELDS = [
	"name",
	"vmf",
	"gamemode",
	"team_size",
	"frag_limit",
	"allowed_classes",
	"hp_multiplier",
	"early_leave_threshold",
	"infinite_ammo",
	"show_hp",
	"min_spawn_distance",
	"spawns",
] as const;

function isSafeFileName(name: string): boolean {
	return (
		name.length > 0 &&
		name === path.basename(name) &&
		!name.includes("..") &&
		!name.includes("/") &&
		!name.includes("\\")
	);
}

export function arenaIdFromName(folderName: string): string {
	const id = folderName
		.toLowerCase()
		.replace(/[^a-z0-9_-]+/g, "_")
		.replace(/^_+|_+$/g, "");
	return id || "arena";
}

export function readArenaPackage(
	arenaDir: string,
	id: string,
	imported: boolean,
): ArenaPackage {
	const metaPath = path.join(arenaDir, "meta.json");
	const meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as ArenaMeta;
	if (typeof meta.description !== "string") meta.description = "";

	if (!isSafeFileName(meta.vmf)) {
		throw new Error(`Arena ${id} has an invalid VMF file name.`);
	}

	const vmfPath = path.join(arenaDir, meta.vmf);
	if (!fs.existsSync(vmfPath)) {
		throw new Error(`VMF not found for arena ${id}: ${vmfPath}`);
	}

	const assetsDir = path.join(arenaDir, "assets");
	const hasCustomAssets = fs.existsSync(assetsDir);

	return {
		id,
		meta,
		vmfPath,
		assetsDir: hasCustomAssets ? assetsDir : null,
		hasCustomAssets,
		bounds: measureBounds(vmfPath),
		imported,
	};
}

export function validateArenaFolder(sourceDir: string): string | null {
	const metaPath = path.join(sourceDir, "meta.json");
	if (!fs.existsSync(metaPath)) {
		return "That folder has no meta.json.";
	}

	let meta: ArenaMeta;
	try {
		meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as ArenaMeta;
	} catch {
		return "meta.json is not valid JSON.";
	}

	const missing = REQUIRED_META_FIELDS.filter((field) => meta[field] === undefined);
	if (missing.length > 0) {
		return `meta.json is missing: ${missing.join(", ")}.`;
	}

	if (!isSafeFileName(meta.vmf)) {
		return "The vmf field must be a file name inside the arena folder.";
	}

	const vmfPath = path.join(sourceDir, meta.vmf);
	if (!fs.existsSync(vmfPath)) {
		return `VMF file not found: ${meta.vmf}`;
	}

	try {
		measureBounds(vmfPath);
	} catch {
		return "The VMF has no brush coordinates.";
	}

	return null;
}

export function loadArenas(arenasDir: string, imported = false): ArenaPackage[] {
	if (!fs.existsSync(arenasDir)) {
		throw new Error(`Arenas directory not found: ${arenasDir}`);
	}

	const entries = fs.readdirSync(arenasDir, { withFileTypes: true });
	const packages: ArenaPackage[] = [];

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;

		const arenaDir = path.join(arenasDir, entry.name);
		if (!fs.existsSync(path.join(arenaDir, "meta.json"))) continue;

		try {
			packages.push(readArenaPackage(arenaDir, entry.name, imported));
		} catch (err) {
			console.warn(
				`Skipping arena ${entry.name}:`,
				err instanceof Error ? err.message : err,
			);
		}
	}

	return packages;
}

export function importArenaFolder(
	sourceDir: string,
	userArenasDir: string,
	existingIds: ReadonlySet<string>,
): { arena: ArenaPackage } | { error: string } {
	const problem = validateArenaFolder(sourceDir);
	if (problem) return { error: problem };

	const id = arenaIdFromName(path.basename(sourceDir));
	if (existingIds.has(id)) {
		return { error: `An arena named "${id}" is already installed.` };
	}

	fs.mkdirSync(userArenasDir, { recursive: true });
	const dest = path.join(userArenasDir, id);
	fs.cpSync(sourceDir, dest, { recursive: true });

	try {
		return { arena: readArenaPackage(dest, id, true) };
	} catch (err) {
		fs.rmSync(dest, { recursive: true, force: true });
		return {
			error: err instanceof Error ? err.message : "Failed to import arena.",
		};
	}
}

export function deleteImportedArena(
	id: string,
	userArenasDir: string,
): boolean {
	if (!isSafeFileName(id)) return false;
	const arenaDir = path.join(userArenasDir, id);
	const relative = path.relative(path.resolve(userArenasDir), path.resolve(arenaDir));
	if (relative.startsWith("..") || path.isAbsolute(relative)) return false;
	if (!fs.existsSync(path.join(arenaDir, "meta.json"))) return false;
	fs.rmSync(arenaDir, { recursive: true, force: true });
	return true;
}
