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
import { classifyCompileFailure } from "./compile-errors.js";

interface StageResult {
	success: boolean;
	error: string | null;
	errorDetail: string | null;
}

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

function writeCompileLog(
	buildDir: string,
	mapStem: string,
	lines: string[],
): string {
	const logPath = path.join(buildDir, `${mapStem}_compile.log`);
	fs.writeFileSync(logPath, lines.join("\n") + "\n", "utf8");
	return logPath;
}

function failedBuild(
	error: string,
	errorDetail: string | null,
	logPath: string | null,
	bspPath: string | null = null,
): BuildResult {
	return {
		success: false,
		bspPath,
		cfgPath: null,
		error,
		errorDetail,
		logPath,
	};
}

function runStage(
	exe: string,
	args: string[],
	stage: CompileStage,
	logLines: string[],
	onProgress: (p: CompileProgress) => void,
): Promise<StageResult> {
	return new Promise((resolve) => {
		const startTime = Date.now();
		const stageLines: string[] = [];

		logLines.push("");
		logLines.push(`===== ${stage.toUpperCase()} =====`);
		logLines.push(`Command: ${exe} ${args.join(" ")}`);

		const proc = spawn(exe, args, { windowsHide: true });
		activeProcess = proc;

		const rl = createInterface({ input: proc.stdout! });
		const rlErr = createInterface({ input: proc.stderr! });

		const emitLine = (line: string) => {
			stageLines.push(line);
			logLines.push(line);
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
				const output = `${stage.toUpperCase()} completed in ${(elapsed / 1000).toFixed(1)}s`;
				logLines.push(output);
				onProgress({
					stage,
					status: "done",
					output,
					elapsedMs: elapsed,
				});
				resolve({ success: true, error: null, errorDetail: null });
				return;
			}

			const classified = classifyCompileFailure(stageLines, stage, code);
			logLines.push(`ERROR: ${classified.message}`);
			if (classified.detail) {
				logLines.push("----- compiler error detail -----");
				logLines.push(classified.detail);
			}
			onProgress({
				stage,
				status: "error",
				output: classified.message,
				elapsedMs: elapsed,
			});
			resolve({
				success: false,
				error: classified.message,
				errorDetail: classified.detail,
			});
		});

		proc.on("error", (err) => {
			activeProcess = null;
			const errorMsg = `Failed to launch ${stage.toUpperCase()}: ${err.message}`;
			logLines.push(`ERROR: ${errorMsg}`);
			onProgress({
				stage,
				status: "error",
				output: errorMsg,
				elapsedMs: Date.now() - startTime,
			});
			resolve({
				success: false,
				error: errorMsg,
				errorDetail: err.stack ?? null,
			});
		});
	});
}

const MODEL_SIDECAR_EXTS = [
	".mdl",
	".vvd",
	".dx90.vtx",
	".dx80.vtx",
	".sw.vtx",
	".phy",
];

const VMT_TEXTURE_KEYS = new Set([
	"basetexture",
	"basetexture2",
	"bumpmap",
	"normalmap",
	"detail",
	"phongexponenttexture",
	"lightwarptexture",
	"envmapmask",
	"selfillummask",
	"texture2",
	"blendmodulatetexture",
	"ambientoccltexture",
]);

function readCString(buf: Buffer, offset: number): string {
	if (offset < 0 || offset >= buf.length) return "";
	const end = buf.indexOf(0, offset);
	if (end < 0) return "";
	return buf.toString("utf8", offset, end);
}

/** Material VMTs named by a studio model's texture and cdmaterials tables. */
function modelMaterialPaths(mdlPath: string): string[] {
	const buf = fs.readFileSync(mdlPath);
	if (buf.length < 220 || buf.toString("utf8", 0, 4) !== "IDST") return [];

	const numtextures = buf.readInt32LE(204);
	const textureindex = buf.readInt32LE(208);
	const numcdtextures = buf.readInt32LE(212);
	const cdtextureindex = buf.readInt32LE(216);
	if (
		numtextures < 1 ||
		numtextures > 256 ||
		numcdtextures < 1 ||
		numcdtextures > 32 ||
		textureindex < 0 ||
		cdtextureindex < 0
	) {
		return [];
	}

	const cdpaths: string[] = [];
	for (let i = 0; i < numcdtextures; i++) {
		const entry = cdtextureindex + i * 4;
		if (entry + 4 > buf.length) break;
		const dir = readCString(buf, buf.readInt32LE(entry))
			.replace(/\\/g, "/")
			.replace(/^\/+|\/+$/g, "");
		if (dir.length > 0 && !dir.includes("..")) cdpaths.push(dir);
	}

	const paths: string[] = [];
	for (let i = 0; i < numtextures; i++) {
		const tex = textureindex + i * 64;
		if (tex + 4 > buf.length) break;
		const name = readCString(buf, tex + buf.readInt32LE(tex)).replace(
			/\\/g,
			"/",
		);
		if (name.length === 0 || name.includes("..") || name.includes("/")) continue;
		for (const dir of cdpaths) {
			paths.push(`materials/${dir}/${name}.vmt`);
		}
	}
	return paths;
}

function addPackFile(
	pairs: [string, string][],
	seen: Set<string>,
	internalPath: string,
	diskPath: string,
): void {
	const internal = internalPath.replace(/\\/g, "/");
	if (seen.has(internal) || !fs.existsSync(diskPath)) return;
	seen.add(internal);
	pairs.push([internal, diskPath]);
}

function addMaterialTree(
	pairs: [string, string][],
	seen: Set<string>,
	assetsDir: string,
	internalVmt: string,
	depth: number,
): void {
	if (depth > 4 || seen.has(internalVmt)) return;
	const diskVmt = path.join(assetsDir, internalVmt);
	if (!fs.existsSync(diskVmt)) return;
	addPackFile(pairs, seen, internalVmt, diskVmt);

	const text = fs.readFileSync(diskVmt, "utf8");
	const re = /\$([A-Za-z0-9]+)"?\s+"([^"]+)"/g;
	let match: RegExpExecArray | null;
	while ((match = re.exec(text)) !== null) {
		if (!VMT_TEXTURE_KEYS.has(match[1].toLowerCase())) continue;
		const tex = match[2].replace(/\\/g, "/").replace(/^\/+/, "");
		if (tex.length === 0 || tex.includes("..") || tex === "env_cubemap") continue;
		const vtf = `materials/${tex}.vtf`;
		addPackFile(pairs, seen, vtf, path.join(assetsDir, vtf));
		const nested = `materials/${tex}.vmt`;
		if (nested !== internalVmt) {
			addMaterialTree(pairs, seen, assetsDir, nested, depth + 1);
		}
	}
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
	const seen = new Set<string>();

	for (const placed of arenas) {
		if (!placed.arena.hasCustomAssets || !placed.arena.assetsDir) continue;
		const assetsDir = placed.arena.assetsDir;

		const vmfContent = fs.readFileSync(placed.arena.vmfPath, "utf8");
		const modelMatches = vmfContent.matchAll(/"model"\s+"([^"]+)"/g);

		for (const m of modelMatches) {
			const ref = m[1].replace(/\\/g, "/");
			if (!ref.toLowerCase().endsWith(".mdl")) continue;
			const baseName = ref.slice(0, -4);

			for (const ext of MODEL_SIDECAR_EXTS) {
				const internalPath = baseName + ext;
				addPackFile(
					filePairs,
					seen,
					internalPath,
					path.join(assetsDir, internalPath),
				);
			}

			const mdlDisk = path.join(assetsDir, `${baseName}.mdl`);
			if (!fs.existsSync(mdlDisk)) continue;
			for (const vmt of modelMaterialPaths(mdlDisk)) {
				addMaterialTree(filePairs, seen, assetsDir, vmt, 0);
			}
		}

		const materialMatches = vmfContent.matchAll(/"material"\s+"([^"]+)"/gi);
		for (const m of materialMatches) {
			const name = m[1].replace(/\\/g, "/").replace(/^\/+/, "");
			if (name.length === 0 || name.includes("..")) continue;
			const internalVmt = `materials/${name}.vmt`.toLowerCase();
			addMaterialTree(filePairs, seen, assetsDir, internalVmt, 0);
			addMaterialTree(
				filePairs,
				seen,
				assetsDir,
				internalVmt.replace(/\.vmt$/, "_cheap.vmt"),
				0,
			);
		}
	}

	if (filePairs.length === 0) return null;

	const fileListPath = path.join(buildDir, "_packlist.txt");
	const content =
		filePairs.map(([internal, disk]) => `${internal}\n${disk}`).join("\n") +
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
	const mapStem = path.basename(bspPath, ".bsp");
	const logLines: string[] = [
		`MGE Map Builder compile log`,
		`Map: ${mapStem}`,
		`VMF: ${vmfPath}`,
		`Started: ${new Date().toISOString()}`,
	];

	const stagedFiles = stageAssets(arenas, game);

	try {
		const vbsp = await runStage(
			path.join(bin, "vbsp.exe"),
			["-game", game, vmfPath],
			"vbsp",
			logLines,
			onProgress,
		);
		if (!vbsp.success) {
			const logPath = writeCompileLog(buildDir, mapStem, logLines);
			return failedBuild(
				vbsp.error ?? "VBSP failed.",
				vbsp.errorDetail,
				logPath,
			);
		}

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
			logLines,
			onProgress,
		);
		if (!vvis.success) {
			const logPath = writeCompileLog(buildDir, mapStem, logLines);
			return failedBuild(
				vvis.error ?? "VVIS failed.",
				vvis.errorDetail,
				logPath,
			);
		}

		const vradArgs = [
			"-both",
			...(fastMode ? ["-fast"] : ["-final"]),
			"-game",
			game,
			bspPath,
		];
		const vrad = await runStage(
			path.join(bin, "vrad.exe"),
			vradArgs,
			"vrad",
			logLines,
			onProgress,
		);
		if (!vrad.success) {
			const logPath = writeCompileLog(buildDir, mapStem, logLines);
			return failedBuild(
				vrad.error ?? "VRAD failed.",
				vrad.errorDetail,
				logPath,
			);
		}

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
					logLines,
					onProgress,
				);
				try {
					fs.unlinkSync(packList);
				} catch {}
				if (!pack.success) {
					const logPath = writeCompileLog(buildDir, mapStem, logLines);
					return failedBuild(
						pack.error ?? "PACK failed.",
						pack.errorDetail,
						logPath,
						bspPath,
					);
				}
			}
		} else {
			onProgress({
				stage: "pack",
				status: "done",
				output: "No custom assets to pack",
				elapsedMs: 0,
			});
			logLines.push("No custom assets to pack");
		}

		const logPath = writeCompileLog(buildDir, mapStem, logLines);
		return {
			success: true,
			bspPath,
			cfgPath: null,
			error: null,
			errorDetail: null,
			logPath,
		};
	} finally {
		cleanupStaged(stagedFiles);
	}
}
