import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import path from "node:path";
import fs from "node:fs";
import started from "electron-squirrel-startup";
import { findTF2, setTF2Path, getTF2Paths } from "./services/tf2.js";
import { loadArenas } from "./services/arenas.js";
import { layoutArenas } from "./services/layout.js";
import { generateVMF } from "./services/vmf.js";
import { generateConfig } from "./services/config.js";
import { compile, cancelCompile } from "./services/compiler.js";
import type { BuildConfig, ArenaPackage } from "./types.js";

if (started) {
	app.quit();
}

let mainWindow: BrowserWindow | null = null;
let cachedArenas: ArenaPackage[] | null = null;

function getArenasDir(): string {
	if (app.isPackaged) {
		return path.join(process.resourcesPath, "arenas");
	}
	return path.join(app.getAppPath(), "arenas");
}

function getBuildDir(): string {
	const buildDir = path.join(app.getPath("temp"), "mge-map-builder");
	if (!fs.existsSync(buildDir)) {
		fs.mkdirSync(buildDir, { recursive: true });
	}
	return buildDir;
}

const createWindow = () => {
	mainWindow = new BrowserWindow({
		width: 1200,
		height: 800,
		minWidth: 900,
		minHeight: 600,
		title: "MGE Map Builder",
		webPreferences: {
			preload: path.join(import.meta.dirname, "preload.js"),
		},
	});

	if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
		mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
		mainWindow.webContents.on("did-frame-finish-load", () => {
			mainWindow!.webContents.openDevTools({ mode: "detach" });
		});
	} else {
		mainWindow.loadFile(
			path.join(
				import.meta.dirname,
				`../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`,
			),
		);
	}
};

// --- IPC Handlers ---

ipcMain.handle("tf2:detect", () => {
	return findTF2();
});

ipcMain.handle("tf2:setPath", (_event, tf2Path: string) => {
	return setTF2Path(tf2Path);
});

ipcMain.handle("arenas:list", () => {
	if (!cachedArenas) {
		cachedArenas = loadArenas(getArenasDir());
	}
	return cachedArenas;
});

ipcMain.handle("build:start", async (_event, config: BuildConfig) => {
	const tf2Root = findTF2();
	if (!tf2Root) {
		return {
			success: false,
			bspPath: null,
			cfgPath: null,
			error: "TF2 installation not found. Please set the TF2 path in settings.",
		};
	}

	try {
		// 1. Load arenas
		const allArenas = loadArenas(getArenasDir());

		// 2. Resolve selected arenas
		const selectedEntries = config.arenas
			.map((entry) => {
				const arena = allArenas.find((a) => a.id === entry.arenaId);
				if (!arena) return null;
				return { arena, count: entry.count };
			})
			.filter(Boolean) as { arena: ArenaPackage; count: number }[];

		if (selectedEntries.length === 0) {
			return {
				success: false,
				bspPath: null,
				cfgPath: null,
				error: "No valid arenas selected.",
			};
		}

		// 3. Layout arenas
		const placedArenas = layoutArenas(selectedEntries);

		// 4. Generate VMF
		const buildDir = getBuildDir();
		const vmfPath = generateVMF(config, placedArenas, buildDir);

		// 5. Generate MGEMod config
		const cfgPath = generateConfig(config.mapName, placedArenas, buildDir);

		// 6. Compile
		const bspPath = path.join(buildDir, `${config.mapName}.bsp`);
		const result = await compile({
			vmfPath,
			bspPath,
			tf2Root,
			fastMode: config.fastMode,
			arenas: placedArenas,
			onProgress: (progress) => {
				mainWindow?.webContents.send("build:progress", progress);
			},
		});

		return {
			...result,
			cfgPath: result.success ? cfgPath : null,
		};
	} catch (err) {
		return {
			success: false,
			bspPath: null,
			cfgPath: null,
			error:
				err instanceof Error ? err.message : "Unknown build error",
		};
	}
});

ipcMain.handle("build:cancel", () => {
	cancelCompile();
});

ipcMain.handle(
	"fs:copyToTF2",
	async (_event, bspPath: string, cfgPath: string) => {
		const tf2Root = findTF2();
		if (!tf2Root) return false;

		const { game } = getTF2Paths(tf2Root);

		try {
			// Copy BSP to tf/maps/
			const mapsDir = path.join(game, "maps");
			if (!fs.existsSync(mapsDir)) fs.mkdirSync(mapsDir, { recursive: true });
			fs.copyFileSync(
				bspPath,
				path.join(mapsDir, path.basename(bspPath)),
			);

			// Copy cfg to tf/addons/sourcemod/configs/mge/
			const cfgDir = path.join(
				game,
				"addons",
				"sourcemod",
				"configs",
				"mge",
			);
			if (!fs.existsSync(cfgDir)) fs.mkdirSync(cfgDir, { recursive: true });
			fs.copyFileSync(
				cfgPath,
				path.join(cfgDir, path.basename(cfgPath)),
			);

			return true;
		} catch {
			return false;
		}
	},
);

ipcMain.on("fs:openFolder", (_event, folderPath: string) => {
	shell.openPath(folderPath);
});

ipcMain.handle("fs:selectFolder", async () => {
	if (!mainWindow) return null;
	const result = await dialog.showOpenDialog(mainWindow, {
		properties: ["openDirectory"],
	});
	return result.canceled ? null : result.filePaths[0] ?? null;
});

// --- App lifecycle ---

app.on("ready", createWindow);

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
	}
});

app.on("activate", () => {
	if (BrowserWindow.getAllWindows().length === 0) {
		createWindow();
	}
});
