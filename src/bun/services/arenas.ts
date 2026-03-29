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

export function loadArenas(arenasDir: string): ArenaPackage[] {
	if (!fs.existsSync(arenasDir)) {
		throw new Error(`Arenas directory not found: ${arenasDir}`);
	}

	const entries = fs.readdirSync(arenasDir, { withFileTypes: true });
	const packages: ArenaPackage[] = [];

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;

		const arenaDir = path.join(arenasDir, entry.name);
		const metaPath = path.join(arenaDir, "meta.json");

		if (!fs.existsSync(metaPath)) continue;

		const meta: ArenaMeta = JSON.parse(
			fs.readFileSync(metaPath, "utf8"),
		);

		const vmfPath = path.join(arenaDir, meta.vmf);
		if (!fs.existsSync(vmfPath)) {
			console.warn(
				`VMF not found for arena ${entry.name}: ${vmfPath}`,
			);
			continue;
		}

		const assetsDir = path.join(arenaDir, "assets");
		const hasCustomAssets = fs.existsSync(assetsDir);

		const bounds = measureBounds(vmfPath);

		packages.push({
			id: entry.name,
			meta,
			vmfPath,
			assetsDir: hasCustomAssets ? assetsDir : null,
			hasCustomAssets,
			bounds,
		});
	}

	return packages;
}
