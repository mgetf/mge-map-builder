import type { ArenaPackage, PlacedArena } from "../types.js";

const COORD_LIMIT = 16384;
const SAFE_LIMIT = 14000;
const PADDING = 500;
const Z_LAYER_OFFSET = 5000;

interface LayoutEntry {
	arena: ArenaPackage;
	index: number; // 1-based instance number for this arena type
}

export function layoutArenas(
	entries: { arena: ArenaPackage; count: number }[],
): PlacedArena[] {
	// Expand entries into individual instances
	const items: LayoutEntry[] = [];
	for (const entry of entries) {
		for (let i = 1; i <= entry.count; i++) {
			items.push({ arena: entry.arena, index: i });
		}
	}

	if (items.length === 0) {
		return [];
	}

	// Sort by Y span descending (tallest first for shelf-packing)
	items.sort((a, b) => b.arena.bounds.spanY - a.arena.bounds.spanY);

	const placed: PlacedArena[] = [];
	let cursorX = 0;
	let rowY = 0;
	let rowHeight = 0;
	let zLayer = 0;

	for (const item of items) {
		const { bounds } = item.arena;

		// Origin offset: position arena so bounds.min + origin = target position
		const targetX = cursorX - bounds.minX;
		const targetY = rowY - bounds.minY;
		const targetZ = -(zLayer * Z_LAYER_OFFSET) - bounds.minZ;

		// Check if this arena exceeds X limit in current row
		if (cursorX + bounds.spanX > SAFE_LIMIT && cursorX > 0) {
			// Start new row
			rowY += rowHeight + PADDING;
			rowHeight = 0;
			cursorX = 0;

			// Check if new row exceeds Y limit — move to new Z layer
			if (rowY + bounds.spanY > SAFE_LIMIT) {
				zLayer++;
				rowY = 0;
			}

			const newTargetX = cursorX - bounds.minX;
			const newTargetY = rowY - bounds.minY;
			const newTargetZ =
				-(zLayer * Z_LAYER_OFFSET) - bounds.minZ;

			placed.push(
				makePlaced(
					item,
					newTargetX,
					newTargetY,
					newTargetZ,
					entries,
				),
			);
		} else {
			placed.push(
				makePlaced(item, targetX, targetY, targetZ, entries),
			);
		}

		cursorX += bounds.spanX + PADDING;
		rowHeight = Math.max(rowHeight, bounds.spanY);
	}

	// Validate all geometry is within coordinate limits
	for (const p of placed) {
		const { bounds } = p.arena;
		const [ox, oy, oz] = p.origin;
		const worldMinX = bounds.minX + ox;
		const worldMaxX = bounds.maxX + ox;
		const worldMinY = bounds.minY + oy;
		const worldMaxY = bounds.maxY + oy;
		const worldMinZ = bounds.minZ + oz;
		const worldMaxZ = bounds.maxZ + oz;

		if (
			Math.abs(worldMinX) > COORD_LIMIT ||
			Math.abs(worldMaxX) > COORD_LIMIT ||
			Math.abs(worldMinY) > COORD_LIMIT ||
			Math.abs(worldMaxY) > COORD_LIMIT ||
			Math.abs(worldMinZ) > COORD_LIMIT ||
			Math.abs(worldMaxZ) > COORD_LIMIT
		) {
			throw new Error(
				`Arena "${p.instanceName}" exceeds Source engine coordinate limit (±${COORD_LIMIT}). ` +
					`Try reducing the number of arenas.`,
			);
		}
	}

	return placed;
}

function makePlaced(
	item: LayoutEntry,
	ox: number,
	oy: number,
	oz: number,
	entries: { arena: ArenaPackage; count: number }[],
): PlacedArena {
	const entry = entries.find((e) => e.arena.id === item.arena.id)!;
	const suffix = entry.count > 1 ? ` ${item.index}` : "";

	return {
		arena: item.arena,
		instanceName: `${item.arena.meta.name}${suffix}`,
		origin: [ox, oy, oz],
	};
}
