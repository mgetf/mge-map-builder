import { contextBridge, ipcRenderer } from "electron";
import type {
	ArenaPackage,
	BuildConfig,
	BuildResult,
	CompileProgress,
} from "./types.js";

const api = {
	// TF2
	detectTF2: (): Promise<string | null> => ipcRenderer.invoke("tf2:detect"),
	setTF2Path: (path: string): Promise<boolean> =>
		ipcRenderer.invoke("tf2:setPath", path),

	// Arenas
	getArenas: (): Promise<ArenaPackage[]> =>
		ipcRenderer.invoke("arenas:list"),

	// Build
	build: (config: BuildConfig): Promise<BuildResult> =>
		ipcRenderer.invoke("build:start", config),
	onBuildProgress: (callback: (progress: CompileProgress) => void) => {
		const handler = (
			_event: Electron.IpcRendererEvent,
			progress: CompileProgress,
		) => callback(progress);
		ipcRenderer.on("build:progress", handler);
		return () => ipcRenderer.removeListener("build:progress", handler);
	},
	cancelBuild: (): Promise<void> => ipcRenderer.invoke("build:cancel"),

	// File operations
	copyToTF2: (bspPath: string, cfgPath: string): Promise<boolean> =>
		ipcRenderer.invoke("fs:copyToTF2", bspPath, cfgPath),
	openFolder: (path: string): void => {
		ipcRenderer.send("fs:openFolder", path);
	},
	selectFolder: (): Promise<string | null> =>
		ipcRenderer.invoke("fs:selectFolder"),
};

contextBridge.exposeInMainWorld("api", api);

export type ElectronAPI = typeof api;
