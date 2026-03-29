import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import fs from "node:fs";
import path from "node:path";
import type {
	PlacedArena,
	CompileProgress,
	CompileStage,
	BuildResult,
} from "../types.js";
import { getTF2Paths } from "./tf2.js";

export interface CompileOptions {
	vmfPath: string;
	bspPath: string;
	tf2Root: string;
	fastMode: boolean;
	arenas: PlacedArena[];
	onProgress: (p: CompileProgress) => void;
}

let activeProcess: ChildProcess | null = null;

export function cancelCompile(): void {
	if (activeProcess && !activeProcess.killed) {
		activeProcess.kill("SIGTERM");
		activeProcess = null;
	}
}

function runStage(
	exe: string,
	args: string[],
	stage: CompileStage,
	onProgress: (p: CompileProgress) => void,
): Promise<{ success: boolean; error: string | null }> {
	return new Promise((resolve) => {
		const startTime = Date.now();
		let lastError: string | null = null;

		const proc = spawn(exe, args, { windowsHide: true });
		activeProcess = proc;

		const rl = createInterface({ input: proc.stdout! });
		const rlErr = createInterface({ input: proc.stderr! });

		const emitLine = (line: string) => {
			if (line.includes("**** leaked ****")) {
				lastError =
					"Map has a leak — an arena entity is outside sealed geometry";
			} else if (line.includes("MAX_MAP_PLANES")) {
				lastError =
					"Too much geometry (MAX_MAP_PLANES exceeded) — try fewer arenas";
			}

			onProgress({
				stage,
				status: "running",
				output: line,
				elapsedMs: Date.now() - startTime,
			});
		};

		rl.on("line", emitLine);
		rlErr.on("line", emitLine);

		proc.on("close", (code) => {
			activeProcess = null;
			const elapsed = Date.now() - startTime;

			if (code === 0) {
				onProgress({
					stage,
					status: "done",
					output: `${stage.toUpperCase()} completed in ${(elapsed / 1000).toFixed(1)}s`,
					elapsedMs: elapsed,
				});
				resolve({ success: true, error: null });
			} else {
				const errorMsg =
					lastError ||
					`${stage.toUpperCase()} failed with exit code ${code}`;
				onProgress({
					stage,
					status: "error",
					output: errorMsg,
					elapsedMs: elapsed,
				});
				resolve({ success: false, error: errorMsg });
			}
		});

		proc.on("error", (err) => {
			activeProcess = null;
			const errorMsg = `Failed to launch ${stage.toUpperCase()}: ${err.message}`;
			onProgress({
				stage,
				status: "error",
				output: errorMsg,
				elapsedMs: Date.now() - startTime,
			});
			resolve({ success: false, error: errorMsg });
		});
	});
}

/**
 * Scan arena VMFs for custom model references and build a bspzip file list.
 * Returns the path to the file list, or null if no custom assets.
 */
function buildPackList(
	arenas: PlacedArena[],
	buildDir: string,
): string | null {
	const filePairs: [string, string][] = [];
	const modelExts = [".mdl", ".vvd", ".dx90.vtx", ".dx80.vtx", ".sw.vtx", ".phy"];

	for (const placed of arenas) {
		if (!placed.arena.hasCustomAssets || !placed.arena.assetsDir) continue;

		const vmfContent = fs.readFileSync(placed.arena.vmfPath, "utf8");
		const modelMatches = vmfContent.matchAll(/"model"\s+"([^"]+)"/g);

		for (const m of modelMatches) {
			const ref = m[1].replace(/\\/g, "/");
			const baseName = ref.replace(/\.mdl$/, "");

			for (const ext of modelExts) {
				const internalPath = baseName + ext;
				const diskPath = path.join(
					placed.arena.assetsDir,
					internalPath,
				);
				if (fs.existsSync(diskPath)) {
					filePairs.push([internalPath, diskPath]);
				}
			}

			// Associated materials
			const matDir = path.join(
				placed.arena.assetsDir,
				"materials",
				baseName.replace(/^models\//, "models/"),
			);
			if (fs.existsSync(matDir) && fs.statSync(matDir).isDirectory()) {
				for (const f of fs.readdirSync(matDir)) {
					const internalPath = path
						.join(
							"materials",
							baseName.replace(/^models\//, "models/"),
							f,
						)
						.replace(/\\/g, "/");
					filePairs.push([internalPath, path.join(matDir, f)]);
				}
			}
		}
	}

	if (filePairs.length === 0) return null;

	// De-duplicate
	const seen = new Set<string>();
	const unique = filePairs.filter(([internal]) => {
		if (seen.has(internal)) return false;
		seen.add(internal);
		return true;
	});

	const fileListPath = path.join(buildDir, "_packlist.txt");
	const content =
		unique.map(([internal, disk]) => `${internal}\n${disk}`).join("\n") +
		"\n";
	fs.writeFileSync(fileListPath, content, "utf8");

	return fileListPath;
}

/**
 * Stage custom arena assets into the TF2 tf/ directory so VBSP can resolve them.
 * Returns list of staged file paths for cleanup.
 */
function stageAssets(arenas: PlacedArena[], tfGameDir: string): string[] {
	const staged: string[] = [];

	for (const placed of arenas) {
		if (!placed.arena.hasCustomAssets || !placed.arena.assetsDir) continue;

		const walkDir = (dir: string, rel: string) => {
			for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
				const srcPath = path.join(dir, entry.name);
				const relPath = path.join(rel, entry.name);

				if (entry.isDirectory()) {
					walkDir(srcPath, relPath);
				} else {
					const destPath = path.join(tfGameDir, relPath);
					const destDir = path.dirname(destPath);
					if (!fs.existsSync(destDir)) {
						fs.mkdirSync(destDir, { recursive: true });
					}
					if (!fs.existsSync(destPath)) {
						fs.copyFileSync(srcPath, destPath);
						staged.push(destPath);
					}
				}
			}
		};

		walkDir(placed.arena.assetsDir, "");
	}

	return staged;
}

function cleanupStaged(files: string[]): void {
	for (const f of files) {
		try {
			fs.unlinkSync(f);
		} catch {
			// Best-effort cleanup
		}
	}
}

export async function compile(options: CompileOptions): Promise<BuildResult> {
	const { vmfPath, bspPath, tf2Root, fastMode, arenas, onProgress } =
		options;
	const { bin, game } = getTF2Paths(tf2Root);
	const buildDir = path.dirname(bspPath);

	// Stage custom assets so VBSP can find them
	const stagedFiles = stageAssets(arenas, game);

	try {
		// Stage 1: VBSP
		const vbsp = await runStage(
			path.join(bin, "vbsp.exe"),
			["-game", game, vmfPath],
			"vbsp",
			onProgress,
		);
		if (!vbsp.success) {
			return {
				success: false,
				bspPath: null,
				cfgPath: null,
				error: vbsp.error,
			};
		}

		// Stage 2: VVIS
		const vvisArgs = [
			...(fastMode ? ["-fast"] : []),
			"-game",
			game,
			bspPath,
		];
		const vvis = await runStage(
			path.join(bin, "vvis.exe"),
			vvisArgs,
			"vvis",
			onProgress,
		);
		if (!vvis.success) {
			return {
				success: false,
				bspPath: null,
				cfgPath: null,
				error: vvis.error,
			};
		}

		// Stage 3: VRAD
		const vradArgs = [
			"-both",
			...(fastMode ? ["-fast"] : []),
			"-game",
			game,
			bspPath,
		];
		const vrad = await runStage(
			path.join(bin, "vrad.exe"),
			vradArgs,
			"vrad",
			onProgress,
		);
		if (!vrad.success) {
			return {
				success: false,
				bspPath: null,
				cfgPath: null,
				error: vrad.error,
			};
		}

		// Stage 4: Pack custom assets via bspzip
		const packList = buildPackList(arenas, buildDir);
		if (packList) {
			const bspzip = path.join(bin, "bspzip.exe");
			if (fs.existsSync(bspzip)) {
				const pack = await runStage(
					bspzip,
					[
						"-game",
						game,
						"-addlist",
						bspPath,
						packList,
						bspPath,
					],
					"pack",
					onProgress,
				);
				// Clean up pack list file
				try {
					fs.unlinkSync(packList);
				} catch {}
				if (!pack.success) {
					return {
						success: false,
						bspPath,
						cfgPath: null,
						error: pack.error,
					};
				}
			}
		} else {
			onProgress({
				stage: "pack",
				status: "done",
				output: "No custom assets to pack",
				elapsedMs: 0,
			});
		}

		return {
			success: true,
			bspPath,
			cfgPath: null, // Set by the orchestrator after config generation
			error: null,
		};
	} finally {
		cleanupStaged(stagedFiles);
	}
}
