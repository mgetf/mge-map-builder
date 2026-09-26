import type { CompileStage } from "../types.js";

export interface CompileErrorInfo {
	message: string;
	detail: string;
}

const PATTERNS: { test: RegExp; message: string }[] = [
	{
		test: /nummapdispinfo\s*>\s*MAX_MAP_DISPINFO|MAX_MAP_DISPINFO/i,
		message:
			"Too many displacement surfaces (MAX_MAP_DISPINFO, TF2 limit 2048). Terrain-heavy arenas such as Badlands Middle and Spire fill this budget quickly. Remove copies or pick simpler arenas.",
	},
	{
		test: /MAX_MAP_PLANES/,
		message:
			"Too much brush geometry (MAX_MAP_PLANES). Try fewer arenas or simpler ones.",
	},
	{
		test: /MAX_MAP_BRUSHES/,
		message: "Too many brushes (MAX_MAP_BRUSHES). Try fewer arenas.",
	},
	{
		test: /MAX_MAP_SIDES|MAX_MAP_BRUSHSIDES/,
		message: "Too many brush sides (MAX_MAP_SIDES). Try fewer arenas.",
	},
	{
		test: /MAX_MAP_VERTS|MAX_MAP_VERTEXES/,
		message: "Too many vertices (MAX_MAP_VERTS). Try fewer arenas.",
	},
	{
		test: /MAX_MAP_FACES/,
		message: "Too many faces (MAX_MAP_FACES). Try fewer arenas.",
	},
	{
		test: /MAX_MAP_NODES/,
		message: "Too many BSP nodes (MAX_MAP_NODES). Try fewer arenas.",
	},
	{
		test: /MAX_MAP_LEAFS/,
		message: "Too many BSP leaves (MAX_MAP_LEAFS). Try fewer arenas.",
	},
	{
		test: /MAX_MAP_MODELS/,
		message: "Too many brush models (MAX_MAP_MODELS). Try fewer arenas.",
	},
	{
		test: /MAX_MAP_ENTITIES/,
		message: "Too many entities (MAX_MAP_ENTITIES). Try fewer arenas.",
	},
	{
		test: /MAX_MAP_TEXINFO|MAX_MAP_TEXDATA/,
		message: "Too many unique materials (MAX_MAP_TEXINFO). Try fewer arena types.",
	},
	{
		test: /MAX_MAP_LIGHTING/,
		message:
			"Lighting data exceeded MAX_MAP_LIGHTING. Try Fast Compile or fewer arenas.",
	},
	{
		test: /MAX_MAP_\w+/,
		message:
			"A Source engine map limit was exceeded. Try fewer or simpler arenas.",
	},
	{
		test: /\*{4}\s*leaked\s*\*{4}|entity .+ leaked/i,
		message:
			"Map has a leak. An entity is outside sealed geometry, so vis cannot run.",
	},
	{
		test: /FindPortalSide/i,
		message:
			"VBSP could not match a portal to a brush side. The map geometry is likely leaking or malformed.",
	},
	{
		test: /HashVec/i,
		message:
			"A vertex is outside the valid map bounds (plus or minus 16384). An arena may be placed too far out.",
	},
	{
		test: /Error loading|Error opening|Can't load|Cannot load|Could not load/i,
		message:
			"The compiler could not load a required file. Check that TF2 is detected and arena assets are present.",
	},
];

const INTERESTING =
	/error|failed|leaked|max_map_|nummapdispinfo|parse.?disp|brush \d+|warning:|couldn't|can't |cannot |not found|hashvec|findportalside/i;

function tail(lines: string[], count: number): string {
	return lines
		.filter((line) => line.trim().length > 0)
		.slice(-count)
		.join("\n")
		.trim();
}

function windowAround(lines: string[], index: number): string {
	const start = Math.max(0, index - 1);
	const end = Math.min(lines.length, index + 8);
	return lines.slice(start, end).join("\n").trim();
}

export function classifyCompileFailure(
	lines: string[],
	stage: CompileStage,
	exitCode: number | null,
): CompileErrorInfo {
	if (exitCode === null) {
		return { message: "Compile was cancelled.", detail: tail(lines, 12) };
	}

	for (const pattern of PATTERNS) {
		const idx = lines.findIndex((line) => pattern.test.test(line));
		if (idx >= 0) {
			return {
				message: pattern.message,
				detail: windowAround(lines, idx),
			};
		}
	}

	const interesting = lines.filter((line) => INTERESTING.test(line));
	const detail =
		interesting.length > 0
			? interesting.slice(-24).join("\n").trim()
			: tail(lines, 24);

	return {
		message: `${stage.toUpperCase()} failed with exit code ${exitCode}.`,
		detail: detail || "(no compiler output captured)",
	};
}
