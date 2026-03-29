import type { ArenaPackage } from "../../electron/types.js";

let arenas = $state<ArenaPackage[]>([]);
let loading = $state(true);
let fetched = false;

export type { ArenaPackage };

export function getArenasState() {
	return {
		get arenas() {
			return arenas;
		},
		get loading() {
			return loading;
		},
	};
}

export async function fetchArenas() {
	if (fetched) return;
	loading = true;
	try {
		arenas = await window.api.getArenas();
		fetched = true;
	} catch {
		arenas = [];
	} finally {
		loading = false;
	}
}
