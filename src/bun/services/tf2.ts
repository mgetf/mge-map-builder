import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const TF2_SEARCH_PATHS = [
	process.env.TF2_PATH,
	"C:\\Program Files (x86)\\Steam\\steamapps\\common\\Team Fortress 2",
	"C:\\Program Files\\Steam\\steamapps\\common\\Team Fortress 2",
	"D:\\Steam\\steamapps\\common\\Team Fortress 2",
	"D:\\SteamLibrary\\steamapps\\common\\Team Fortress 2",
	"E:\\Steam\\steamapps\\common\\Team Fortress 2",
	"E:\\SteamLibrary\\steamapps\\common\\Team Fortress 2",
	"F:\\Steam\\steamapps\\common\\Team Fortress 2",
	"F:\\SteamLibrary\\steamapps\\common\\Team Fortress 2",
].filter(Boolean) as string[];

let cachedTF2Path: string | null | undefined;

export function validateTF2(tf2Root: string): boolean {
	return fs.existsSync(path.join(tf2Root, "bin", "vbsp.exe"));
}

export function getTF2Paths(tf2Root: string) {
	return {
		bin: path.join(tf2Root, "bin"),
		game: path.join(tf2Root, "tf"),
	};
}

/**
 * Attempts to find additional Steam library folders by reading the
 * Windows registry for SteamPath, then parsing libraryfolders.vdf.
 */
function getRegistryLibraryPaths(): string[] {
	const results: string[] = [];
	try {
		const regOutput = execSync(
			'reg query "HKCU\\Software\\Valve\\Steam" /v SteamPath',
			{ encoding: "utf8", timeout: 5000 },
		);
		const match = regOutput.match(/SteamPath\s+REG_SZ\s+(.+)/i);
		if (!match) return results;

		const steamPath = match[1].trim();
		const vdfPath = path.join(steamPath, "steamapps", "libraryfolders.vdf");
		if (!fs.existsSync(vdfPath)) return results;

		const vdf = fs.readFileSync(vdfPath, "utf8");
		const pathMatches = vdf.matchAll(/"path"\s+"([^"]+)"/g);
		for (const m of pathMatches) {
			const libPath = m[1].replace(/\\\\/g, "\\");
			const tf2Path = path.join(
				libPath,
				"steamapps",
				"common",
				"Team Fortress 2",
			);
			results.push(tf2Path);
		}
	} catch {
		// Registry/VDF parsing failed — not critical
	}
	return results;
}

export function findTF2(): string | null {
	if (cachedTF2Path !== undefined) return cachedTF2Path;

	// Check hardcoded paths first
	for (const p of TF2_SEARCH_PATHS) {
		if (validateTF2(p)) {
			cachedTF2Path = p;
			return p;
		}
	}

	// Try registry-based discovery
	for (const p of getRegistryLibraryPaths()) {
		if (validateTF2(p)) {
			cachedTF2Path = p;
			return p;
		}
	}

	cachedTF2Path = null;
	return null;
}

export function setTF2Path(tf2Path: string): boolean {
	if (validateTF2(tf2Path)) {
		cachedTF2Path = tf2Path;
		return true;
	}
	return false;
}
