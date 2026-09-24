<script lang="ts">
	let {
		entries,
	}: {
		entries: { name: string; gamemode: string; teamSize: string; count: number }[];
	} = $props();

	const PAGE_SIZE = 7;

	const MODE_LABEL: Record<string, string> = {
		mge: "MGE",
		ultiduo: "ULTI",
		koth: "KOTH",
		ammomod: "AMOD",
		bball: "BBALL",
		midair: "MIDA",
		endif: "ENDIF",
	};

	function menuLabel(name: string, gamemode: string, teamSize: string, index: number, count: number): string {
		const mode = teamSize.split(" ")[0] === "2v2" ? "2v2" : "1v1";
		const type = MODE_LABEL[gamemode] ?? "";
		const suffix = count > 1 ? ` ${index}` : "";
		const typePart = type.length > 0 ? ` ${type}` : " ";
		return `${name}${suffix} [${mode}${typePart}]`;
	}

	const items = $derived.by(() => {
		const lines: string[] = [];
		for (const entry of entries) {
			for (let i = 1; i <= entry.count; i++) {
				lines.push(menuLabel(entry.name, entry.gamemode, entry.teamSize, i, entry.count));
			}
		}
		lines.push("Remove from queue");
		return lines;
	});

	const pageCount = $derived(Math.max(1, Math.ceil(items.length / PAGE_SIZE)));

	let page = $state(0);
	const safePage = $derived(Math.min(page, pageCount - 1));

	const rows = $derived.by(() => {
		const start = safePage * PAGE_SIZE;
		const slice = items.slice(start, start + PAGE_SIZE);
		const list: { slot: string; label: string; action: "prev" | "next" | "exit" | null }[] = slice.map(
			(label, i) => ({ slot: String(i + 1), label, action: null }),
		);
		if (safePage > 0) list.push({ slot: "8", label: "Previous", action: "prev" });
		if (safePage < pageCount - 1) list.push({ slot: "9", label: "Next", action: "next" });
		list.push({ slot: "0", label: "Exit", action: "exit" });
		return list;
	});

	function activate(action: "prev" | "next" | "exit" | null) {
		if (action === "next") page = Math.min(pageCount - 1, safePage + 1);
		else if (action === "prev") page = Math.max(0, safePage - 1);
		else if (action === "exit") page = 0;
	}
</script>

<div class="space-y-2">
	<p class="text-xs text-muted-foreground">
		Join menu preview. Previous, Next, and Exit work like they do in game.
	</p>
	<div class="rounded-md border border-[#5a4630] bg-[#1c1612]/95 px-4 py-3 shadow-inner">
		<p class="mb-2 text-[15px] font-semibold text-[#e8a33a]">Join arena...</p>
		<div class="space-y-0.5">
			{#each rows.filter((row) => row.action === null) as row (`${safePage}-${row.slot}-${row.label}`)}
				<p class="text-[15px] font-semibold leading-6 text-[#e8a33a]">
					{row.slot}. {row.label}
				</p>
			{/each}
		</div>
		<div class="mt-2 space-y-0.5">
			{#each rows.filter((row) => row.action !== null) as row (`${safePage}-${row.slot}-${row.label}`)}
				<button
					type="button"
					class="block w-full text-left text-[15px] font-semibold leading-6 text-[#e8a33a] hover:text-[#ffc15a]"
					onclick={() => activate(row.action)}
				>
					{row.slot}. {row.label}
				</button>
			{/each}
		</div>
		{#if pageCount > 1}
			<p class="mt-2 text-[11px] text-[#e8a33a]/60">Page {safePage + 1} / {pageCount}</p>
		{/if}
	</div>
</div>
