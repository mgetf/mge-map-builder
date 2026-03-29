import fs from "node:fs";
import path from "node:path";
import type { BuildConfig, PlacedArena } from "../types.js";
import { serializeKV } from "./keyvalues.js";

export function generateVMF(
	config: BuildConfig,
	placedArenas: PlacedArena[],
	outputDir: string,
): string {
	if (!fs.existsSync(outputDir)) {
		fs.mkdirSync(outputDir, { recursive: true });
	}

	const vmf: Record<string, unknown> = {};
	let entityId = 1;

	// World block — worldspawn properties
	vmf.world = {
		id: 0,
		mapversion: 0,
		classname: "worldspawn",
		skyname: config.skybox,
		detailvbsp: "detail.vbsp",
		detailmaterial: "detail/detailsprites",
		maxpropscreenwidth: -1,
		message: config.mapName,
		chaptertitle: config.mapName,
	};

	// Entity array — func_instance per arena + light_environment
	const entities: Record<string, unknown>[] = [];

	for (const placed of placedArenas) {
		const relPath = path
			.relative(outputDir, placed.arena.vmfPath)
			.replace(/\\/g, "/");

		entities.push({
			id: entityId++,
			classname: "func_instance",
			angles: "0 0 0",
			file: relPath,
			fixup_style: 0,
			targetname: "",
			origin: placed.origin.join(" "),
			editor: {
				color: "0 255 255",
				visgroupshown: 1,
				visgroupautoshown: 1,
				logicalpos: "[0 0]",
			},
		});
	}

	// light_environment — placed at the center of the first arena's bounding box
	// Must be inside sealed brushwork or VBSP reports a leak.
	// The instance origin != the arena geometry center, so we compute the
	// world-space center of the arena's bounds to guarantee containment.
	if (placedArenas.length > 0) {
		const p = placedArenas[0];
		const [ox, oy, oz] = p.origin;
		const { bounds } = p.arena;
		const centerX = ox + (bounds.minX + bounds.maxX) / 2;
		const centerY = oy + (bounds.minY + bounds.maxY) / 2;
		const centerZ = oz + (bounds.minZ + bounds.maxZ) / 2;
		const le = config.lightEnvironment;

		entities.push({
			id: entityId++,
			classname: "light_environment",
			angles: le.angles,
			pitch: le.pitch,
			_light: le._light,
			_ambient: le._ambient,
			_lightHDR: le._lightHDR,
			_lightscaleHDR: le._lightscaleHDR,
			_ambientHDR: le._ambientHDR,
			_AmbientScaleHDR: le._AmbientScaleHDR,
			origin: `${centerX} ${centerY} ${centerZ}`,
		});
	}

	vmf.entity = entities;

	// Camera and cordon blocks
	vmf.cameras = {
		activecamera: -1,
	};
	vmf.cordon = {
		mins: "(-1024 -1024 -1024)",
		maxs: "(1024 1024 1024)",
		active: 0,
	};

	const vmfContent = serializeKV(vmf);
	const vmfPath = path.join(outputDir, `${config.mapName}.vmf`);
	fs.writeFileSync(vmfPath, vmfContent, "utf8");

	return vmfPath;
}
