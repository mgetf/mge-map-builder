/**
 * Serialize a JavaScript object to Valve KeyValues text format.
 * Handles: arrays of objects (repeated section names), nested objects
 * (subsections), and scalar values (quoted key-value pairs).
 */
export function serializeKV(
	obj: Record<string, unknown>,
	indent: number = 0,
): string {
	const pad = "\t".repeat(indent);
	let result = "";

	for (const key of Object.keys(obj)) {
		const value = obj[key];

		if (Array.isArray(value)) {
			for (const item of value) {
				result += `${pad}"${key}"\n${pad}{\n`;
				result += serializeKV(
					item as Record<string, unknown>,
					indent + 1,
				);
				result += `${pad}}\n`;
			}
		} else if (value !== null && typeof value === "object") {
			result += `${pad}"${key}"\n${pad}{\n`;
			result += serializeKV(
				value as Record<string, unknown>,
				indent + 1,
			);
			result += `${pad}}\n`;
		} else {
			result += `${pad}"${key}"\t\t"${value}"\n`;
		}
	}

	return result;
}
