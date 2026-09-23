import type { ArenaPackage } from "$lib/types.js";
import { api } from "$lib/rpc.js";
import { setArenaCount } from "$lib/stores/build.svelte.js";

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

async function refreshArenas() {
	arenas = await api.getArenas({});
	fetched = true;
}

export async function importArena(): Promise<string | null> {
	const result = await api.importArena({}, { maxRequestTime: Infinity });
	if (result.cancelled) return null;
	if (result.error) return result.error;
	await refreshArenas();
	return null;
}

export async function removeImportedArena(id: string): Promise<boolean> {
	const removed = await api.removeImportedArena({ id });
	if (!removed) return false;
	setArenaCount(id, 0);
	await refreshArenas();
	return true;
}
