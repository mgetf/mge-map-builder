import { api } from "$lib/rpc.js";

let tf2Path = $state<string | null>(null);
let detected = $state(false);
let loading = $state(true);

export function getTf2State() {
	return {
		get path() {
			return tf2Path;
		},
		get detected() {
			return detected;
		},
		get loading() {
			return loading;
		},
	};
}

export async function detectTF2() {
	loading = true;
	try {
		const result = await api.detectTF2({});
		tf2Path = result;
		detected = result !== null;
	} catch (err) {
		console.error("TF2 detection failed:", err);
		tf2Path = null;
		detected = false;
	} finally {
		loading = false;
	}
}

export async function setManualTF2Path(selectedPath: string): Promise<boolean> {
	try {
		const valid = await api.setTF2Path({ path: selectedPath });
		if (valid) {
			tf2Path = selectedPath;
			detected = true;
		}
		return valid;
	} catch (err) {
		console.error("Failed to set TF2 path:", err);
		return false;
	}
}
