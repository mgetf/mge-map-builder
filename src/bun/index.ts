import { BrowserView, BrowserWindow, Updater, Utils } from "electrobun/bun";
import path from "node:path";
import fs from "node:fs";
import type { AppRPC } from "../shared/rpc.js";
import {
	clampArenaCount,
	type ArenaPackage,
	type BuildResult,
	type CompileProgress,
} from "../shared/types.js";
import {
	deleteImportedArena,
	importArenaFolder,
	loadArenas,
} from "./services/arenas.js";
import { findTF2, setTF2Path, getTF2Paths } from "./services/tf2.js";
import { layoutArenas } from "./services/layout.js";
import { generateVMF } from "./services/vmf.js";
import { generateConfig } from "./services/config.js";
import { compile, cancelCompile } from "./services/compiler.js";

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

async function getMainViewUrl(): Promise<string> {
	const channel = await Updater.localInfo.channel();
	if (channel === "dev") {
		try {
			await fetch(DEV_SERVER_URL, { method: "HEAD" });
			console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
			return DEV_SERVER_URL;
		} catch {
			console.log(
				"Vite dev server not running. Run 'bun run dev:hmr' for HMR support.",
			);
		}
	}
	return "views://mainview/index.html";
}

function getArenasDir(): string {
	const candidates = [
		path.resolve(path.dirname(process.execPath), "../Resources/app/arenas"),
		path.resolve(process.cwd(), "../Resources/app/arenas"),
		path.resolve(process.cwd(), "Resources/app/arenas"),
		path.resolve(process.cwd(), "arenas"),
	];
	for (const c of candidates) {
		if (fs.existsSync(c)) return c;
	}
	return candidates[0];
}

function getBuildDir(): string {
	const buildDir = path.join(Utils.paths.temp, "mge-map-builder");
	if (!fs.existsSync(buildDir)) {
		fs.mkdirSync(buildDir, { recursive: true });
	}
	return buildDir;
}

const arenasDir = getArenasDir();

function getUserArenasDir(): string {
	return path.join(Utils.paths.appData, "MGE Map Builder", "arenas");
}

function listAllArenas() {
	const bundled = fs.existsSync(arenasDir) ? loadArenas(arenasDir, false) : [];
	const userDir = getUserArenasDir();
	const imported = fs.existsSync(userDir) ? loadArenas(userDir, true) : [];
	const bundledIds = new Set(bundled.map((arena) => arena.id));
	return [
		...bundled,
		...imported.filter((arena) => !bundledIds.has(arena.id)),
	];
}

let mainWindow: BrowserWindow | null = null;

function viewEvents() {
	return mainWindow?.webview.rpc as
		| {
				send: {
					buildProgress: (progress: CompileProgress) => void;
					buildComplete: (result: BuildResult) => void;
				};
		  }
		| undefined;
}

const rpc = BrowserView.defineRPC<AppRPC>({
	handlers: {
		requests: {
			detectTF2: () => {
				return findTF2();
			},

			setTF2Path: ({ path: tf2Path }) => {
				return setTF2Path(tf2Path);
			},

			getArenas: () => {
				try {
					return listAllArenas();
				} catch (err) {
					console.error("[RPC] Failed to load arenas:", err);
					return [];
				}
			},

			importArena: async () => {
				const result = await Utils.openFileDialog({
					startingFolder: process.env.USERPROFILE || "C:\\",
					canChooseFiles: false,
					canChooseDirectory: true,
					allowsMultipleSelection: false,
				});
				const sourceDir = result?.[0];
				if (!sourceDir) {
					return { cancelled: true, error: null, arena: null };
				}

				const existingIds = new Set(listAllArenas().map((arena) => arena.id));
				const imported = importArenaFolder(
					sourceDir,
					getUserArenasDir(),
					existingIds,
				);
				if ("error" in imported) {
					return { cancelled: false, error: imported.error, arena: null };
				}
				return { cancelled: false, error: null, arena: imported.arena };
			},

			removeImportedArena: ({ id }) => {
				return deleteImportedArena(id, getUserArenasDir());
			},

			selectFolder: async () => {
				const result = await Utils.openFileDialog({
					startingFolder: process.env.USERPROFILE || "C:\\",
					canChooseFiles: false,
					canChooseDirectory: true,
					allowsMultipleSelection: false,
				});
				if (result && result.length > 0) {
					return result[0];
				}
				return null;
			},

			build: async (config) => {
				const tf2Root = findTF2();
				if (!tf2Root) {
					return {
						success: false,
						bspPath: null,
						cfgPath: null,
						error: "TF2 installation not found. Please set the TF2 path.",
					};
				}

				try {
					// 1. Load all arenas and resolve the selected ones
					const allArenas = listAllArenas();
					let used = 0;
					const selectedEntries: { arena: ArenaPackage; count: number }[] = [];
					for (const entry of config.arenas) {
						const arena = allArenas.find(
							(a: ArenaPackage) => a.id === entry.arenaId,
						);
						if (!arena) continue;
						const count = clampArenaCount(entry.count, 0, used);
						if (count <= 0) continue;
						selectedEntries.push({ arena, count });
						used += count;
					}

					if (selectedEntries.length === 0) {
						return {
							success: false,
							bspPath: null,
							cfgPath: null,
							error: "No valid arenas selected.",
						};
					}

					// 2. Layout arenas using shelf-packing algorithm
					const placedArenas = layoutArenas(selectedEntries);

					// 3. Generate VMF and MGEMod config
					const buildDir = getBuildDir();
					const vmfPath = generateVMF(config, placedArenas, buildDir);
					const cfgPath = generateConfig(
						config.mapName,
						placedArenas,
						buildDir,
					);

					// 4. Compile (VBSP → VVIS → VRAD → bspzip)
					const bspPath = path.join(buildDir, `${config.mapName}.bsp`);
					const result = await compile({
						vmfPath,
						bspPath,
						tf2Root,
						fastMode: config.fastMode,
						arenas: placedArenas,
						onProgress: (progress) => {
							viewEvents()?.send.buildProgress(progress);
						},
					});

					let finalResult: typeof result;

					if (result.success && config.outputDir) {
						const outBsp = path.join(config.outputDir, path.basename(result.bspPath!));
						const outCfg = path.join(config.outputDir, path.basename(cfgPath));
						fs.copyFileSync(result.bspPath!, outBsp);
						fs.copyFileSync(cfgPath, outCfg);
						finalResult = { ...result, bspPath: outBsp, cfgPath: outCfg };
					} else {
						finalResult = {
							...result,
							cfgPath: result.success ? cfgPath : null,
						};
					}

					viewEvents()?.send.buildComplete(finalResult);
					return finalResult;
				} catch (err) {
					const errorResult = {
						success: false,
						bspPath: null,
						cfgPath: null,
						error:
							err instanceof Error
								? err.message
								: "Unknown build error",
					} as const;
					viewEvents()?.send.buildComplete(errorResult);
					return errorResult;
				}
			},

			cancelBuild: () => {
				cancelCompile();
			},

			copyToTF2: ({ bspPath, cfgPath }) => {
				try {
					const tf2Root = findTF2();
					if (!tf2Root) return false;
					const { game } = getTF2Paths(tf2Root);

					// BSP → tf/maps/
					const mapsDir = path.join(game, "maps");
					if (!fs.existsSync(mapsDir))
						fs.mkdirSync(mapsDir, { recursive: true });
					fs.copyFileSync(
						bspPath,
						path.join(mapsDir, path.basename(bspPath)),
					);

					// MGEMod spawns cfg → tf/addons/sourcemod/configs/mge/
					const mgeDir = path.join(
						game,
						"addons",
						"sourcemod",
						"configs",
						"mge",
					);
					if (!fs.existsSync(mgeDir))
						fs.mkdirSync(mgeDir, { recursive: true });
					fs.copyFileSync(
						cfgPath,
						path.join(mgeDir, path.basename(cfgPath)),
					);

					return true;
				} catch (err) {
					console.error("[RPC] Failed to copy to TF2:", err);
					return false;
				}
			},

			openFolder: ({ path: folderPath }) => {
				Utils.openPath(folderPath);
			},
		},
		messages: {},
	},
});

const url = await getMainViewUrl();

mainWindow = new BrowserWindow({
	title: "MGE Map Builder",
	url,
	rpc,
	frame: {
		width: 1400,
		height: 900,
	},
});

// WebView2 on Windows miscalculates the initial content area size.
// Nudging the window size after DOM ready forces a correct layout pass.
mainWindow.webview.on("dom-ready", () => {
	if (!mainWindow) return;
	try {
		const { width, height } = mainWindow.getSize();
		mainWindow.setSize(width, height + 1);
		setTimeout(() => mainWindow?.setSize(width, height), 50);
	} catch (err) {
		console.error("Failed to refresh window size:", err);
	}
});

console.log("MGE Map Builder started!");
