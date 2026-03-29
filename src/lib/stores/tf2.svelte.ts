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
		const result = await window.api.detectTF2();
		tf2Path = result;
		detected = result !== null;
	} catch {
		tf2Path = null;
		detected = false;
	} finally {
		loading = false;
	}
}

export async function setManualTF2Path(path: string): Promise<boolean> {
	const valid = await window.api.setTF2Path(path);
	if (valid) {
		tf2Path = path;
		detected = true;
	}
	return valid;
}
