import type { ArenaPackage } from "$lib/types.js";
import { api } from "$lib/rpc.js";

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
		arenas = await api.getArenas({});
		fetched = true;
	} catch (err) {
		console.error("Failed to fetch arenas:", err);
		arenas = [];
	} finally {
		loading = false;
	}
}
