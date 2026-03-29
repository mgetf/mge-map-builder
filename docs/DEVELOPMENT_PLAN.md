# MGE Map Builder — Development Plan

> This document is a **reference artifact for phased execution**. It does not trigger implementation directly. Each phase is detailed enough to be used as a standalone execution brief in a separate session.

---

## Pre-Phase: Current State

The project scaffold is already in place at `mge-map-builder/`:

**Existing files:**
- `electron/main.ts` — Electron shell with dev server + production file loading
- `electron/preload.ts` — Empty preload (placeholder)
- `src/app.html`, `src/app.css` — SvelteKit app shell with Tailwind
- `src/routes/+layout.ts` — Prerender + trailing slash config
- `src/routes/+page.svelte` — Placeholder landing page
- `package.json` — Electron Forge + SvelteKit + Tailwind deps installed
- `forge.config.ts`, `svelte.config.js`, `vite.config.ts`, `vite.main.config.ts`, `vite.preload.config.ts` — Build config
- `docs/SPEC.md` — Full specification
- `docs/ARENA_GUIDELINES.md` — Mapper guidelines

**Verified working:** `bun run start` launches Electron with SvelteKit + Tailwind rendering.

**Reference implementations** (in the ChillyMGE project at `C:\Users\Maxi\Documents\GitHub\ChillyMGE`):
- `scripts/instance.js` — VMF generation with func_instance + light_environment injection
- `scripts/compile.js` — VBSP/VVIS/VRAD/bspzip pipeline with TF2 auto-detection
- `scripts/json_parser.js` — JSON-to-Valve-KeyValues serializer

**Reference config format** (in MGEMod at `C:\Users\Maxi\Documents\GitHub\MGEMod`):
- `addons/sourcemod/scripting/mge/arenas.sp` — Full config parser (KeyValues format, spawn loading, entity loading, validation)
- `addons/sourcemod/configs/mge/mge_chillypunch_final4_fix2.cfg` — Real-world config example

---

## Phase 1 — Foundation and Core Services

### Goal

Build all backend logic in the Electron main process as standalone service modules. By the end of this phase, every core operation (TF2 detection, arena loading, VMF generation, config generation, compilation) works programmatically and can be tested from the main process without any UI.

### 1.1 — Install shadcn-svelte

Initialize shadcn-svelte in the project and configure the dark theme with industrial styling.

**Tasks:**
- Run the shadcn-svelte init CLI (adapter: SvelteKit, style: default, base color: zinc or slate)
- Configure `components.json` with the project's `$lib` alias
- Verify components install correctly (test with a Button component)
- Set up CSS custom properties for the dark industrial palette in `src/app.css`:
  - Dark backgrounds (zinc-900/950)
  - Muted borders (zinc-700/800)
  - Accent color: an industrial orange or TF2-inspired red-orange
  - Text: white/zinc-300 primary, zinc-500 secondary

**Files created/modified:**
- `components.json` (new — shadcn-svelte config)
- `src/app.css` (modified — theme variables)
- `src/lib/components/ui/` (new — shadcn component directory, auto-populated)

**Acceptance:** `bun run start` renders a shadcn Button component in dark theme.

---

### 1.2 — Shared Types

Define TypeScript types shared across all services and the IPC boundary.

**File: `electron/types.ts`**

```typescript
// Arena package metadata (matches meta.json schema)
export interface ArenaMeta {
  name: string;
  description: string;
  vmf: string;
  gamemode: string;                    // "mge" | "bball" | "koth" | "ammomod" | "midair" | "endif" | "ultiduo" | "turris"
  team_size: string;                   // "1v1" | "2v2" | "1v1 2v2" | "2v2 1v1"
  frag_limit: number;
  allowed_classes: string;             // space-separated: "scout soldier demoman"
  hp_multiplier: number;
  early_leave_threshold: number;
  infinite_ammo: boolean;
  show_hp: boolean;
  min_spawn_distance: number;
  spawns: ArenaSpawns;
  // Optional fields
  cap_limit?: number;
  min_elo?: number;
  max_elo?: number;
  countdown_seconds?: number;
  knockback_boost?: boolean;
  visible_hoops?: boolean;
  allow_koth_switch?: boolean;
  koth_team_spawns?: boolean;
  respawn_delay?: number;
  allow_class_change?: boolean;
  koth_round_time?: number;
  entities?: ArenaEntities;
}

// Spawn coordinates: "x y z pitch yaw roll" (local to arena origin)
// Three supported formats matching MGEMod parser:
export type ArenaSpawns =
  | string[]                                            // Flat: ["coord1", "coord2", ...] — red = first half
  | { red: string[]; blu: string[] }                    // Team-split
  | { red: Record<string, string[]>; blu: Record<string, string[]> }; // Class-specific: { red: { soldier: [...], medic: [...] } }

export interface ArenaEntities {
  capture_point?: string;   // "x y z" — KOTH/Ultiduo
  hoop_red?: string;        // "x y z" — BBall
  hoop_blu?: string;
  intel_start?: string;
  intel_red?: string;
  intel_blu?: string;
}

// Loaded arena with resolved paths
export interface ArenaPackage {
  id: string;                // folder name
  meta: ArenaMeta;
  vmfPath: string;           // absolute path to VMF
  assetsDir: string | null;  // absolute path to assets/ or null
  hasCustomAssets: boolean;
  bounds: ArenaBounds;       // measured from VMF
}

export interface ArenaBounds {
  minX: number; maxX: number;
  minY: number; maxY: number;
  minZ: number; maxZ: number;
  spanX: number; spanY: number; spanZ: number;
}

// An arena placed in the map at a specific position
export interface PlacedArena {
  arena: ArenaPackage;
  instanceName: string;      // "Badlands Middle 1", "Badlands Middle 2", etc.
  origin: [number, number, number];
}

// Build configuration from the UI
export interface BuildConfig {
  mapName: string;
  skybox: string;
  lightEnvironment: LightEnvironment;
  fastMode: boolean;
  arenas: BuildArenaEntry[];
}

export interface BuildArenaEntry {
  arenaId: string;
  count: number;             // how many instances of this arena
}

export interface LightEnvironment {
  angles: string;
  pitch: string;
  _light: string;
  _ambient: string;
  _lightHDR: string;
  _lightscaleHDR: string;
  _ambientHDR: string;
  _AmbientScaleHDR: string;
}

// Compile pipeline events streamed to renderer
export type CompileStage = "vbsp" | "vvis" | "vrad" | "pack";

export interface CompileProgress {
  stage: CompileStage;
  status: "running" | "done" | "error";
  output: string;            // latest stdout/stderr line
  elapsedMs: number;
}

export interface BuildResult {
  success: boolean;
  bspPath: string | null;
  cfgPath: string | null;
  error: string | null;
}
```

**Acceptance:** Types compile without errors and are importable from any service module.

---

### 1.3 — TF2 Detection Service

Port the TF2 detection logic from `ChillyMGE/scripts/compile.js` to a typed module.

**File: `electron/services/tf2.ts`**

**Behavior:**
1. Check `TF2_PATH` env var
2. Scan common Steam library paths (see SPEC.md TF2 Detection section)
3. (Stretch) Read Windows registry `HKCU\Software\Valve\Steam\SteamPath`, parse `libraryfolders.vdf` for additional library folders
4. Validate by checking `bin/vbsp.exe` exists at the candidate path
5. Cache the result so detection only runs once per session

**Exports:**
- `findTF2(): string | null` — returns TF2 root path or null
- `getTF2Paths(tf2Root: string): { bin: string; game: string }` — derived paths
- `validateTF2(tf2Root: string): boolean` — checks vbsp.exe exists

**Acceptance:** Calling `findTF2()` returns the correct TF2 path on the dev machine. Returns null on a machine without TF2.

---

### 1.4 — Arena Loader Service

Scan the bundled `arenas/` directory and load each arena package.

**File: `electron/services/arenas.ts`**

**Behavior:**
1. Read all subdirectories of the arenas root directory
2. For each subdirectory, find the `.vmf` file and `meta.json`
3. Parse `meta.json` into `ArenaMeta`
4. Detect custom assets: check for `assets/` subfolder
5. Measure bounding box from VMF by scanning all `(x y z)` vertex coordinates (same regex approach used in the ChillyMGE layout scripts)
6. Return an array of `ArenaPackage` objects

**Exports:**
- `loadArenas(arenasDir: string): ArenaPackage[]`
- `measureBounds(vmfPath: string): ArenaBounds`

**Acceptance:** `loadArenas()` returns 6 `ArenaPackage` objects for the bundled arenas with correct metadata and measured bounds.

---

### 1.5 — Layout Engine Service

Automatically position arenas in the map without overlap, respecting Source engine limits.

**File: `electron/services/layout.ts`**

**Behavior:**
1. Takes an array of `ArenaPackage` objects with instance counts
2. Uses shelf-packing algorithm: sort by Y span descending, place left-to-right in rows
3. Compute origin offsets such that `arena.bounds.min + origin` positions the arena correctly
4. Enforce constraints:
   - All geometry within ±16384 on all axes
   - Minimum padding between arenas (500 units)
   - Multiple Z layers if single-layer exceeds Y bounds
5. Warn if arena count risks exceeding `MAX_MAP_PLANES` (~8-12 arenas depending on complexity)
6. Return an array of `PlacedArena` objects with computed origins

**Exports:**
- `layoutArenas(entries: { arena: ArenaPackage; count: number }[]): PlacedArena[]`
- Throws if arenas cannot fit within coordinate limits

**Acceptance:** Given 7 badlands_mid + 7 badlands_spire (14 instances), produces a valid non-overlapping layout within bounds.

---

### 1.6 — VMF Generator Service

Port `ChillyMGE/scripts/instance.js` logic to TypeScript. Generates the master VMF from placed arenas.

**File: `electron/services/vmf.ts`**

**Behavior:**
1. Build the VMF JSON structure:
   - `world` block: worldspawn with skybox, detail sprites, map message
   - `entity` array: one `func_instance` per `PlacedArena`
   - `light_environment` entity: placed 500 units above first arena's origin
   - `camera` and `cordon` blocks
2. Serialize to Valve KeyValues format (port `json_parser.js` or rewrite)
3. Write `func_instance` file paths relative to the VMF output location so VBSP resolves them
4. Write VMF to the build output directory

**Exports:**
- `generateVMF(config: BuildConfig, placedArenas: PlacedArena[], outputDir: string): string` — returns path to written VMF

**KeyValues serializer** (can be inline or a separate `electron/services/keyvalues.ts`):
- `serializeKV(obj: object): string` — converts nested JS object to Valve KeyValues text format
- Must handle: arrays of objects (repeated section names), nested objects (subsections), scalar values (quoted key-value pairs)

**Acceptance:** Generated VMF opens in Hammer and shows correct func_instance placements. VBSP can compile it.

---

### 1.7 — MGEMod Config Generator Service

Generate the `mapname.cfg` file in Valve KeyValues `SpawnConfigs` format, matching exactly what `arenas.sp` parses.

**File: `electron/services/config.ts`**

**Behavior:**
1. For each `PlacedArena`, read its `meta.json` gameplay settings
2. Apply spawn coordinate offsets: add the arena's placement origin `[ox, oy, oz]` to the `x y z` components of each spawn coordinate string, preserving `pitch yaw roll`
3. Generate arena section name with instance numbering: "Badlands Middle 1", "Badlands Middle 2", etc.
4. Serialize all arena sections under a root `SpawnConfigs` block
5. Write to `buildDir/mapname.cfg`

**Spawn offset logic** (critical — extracted from `instance.js`):
```
For each spawn coordinate "x y z pitch yaw roll":
  worldX = localX + arena.origin[0]
  worldY = localY + arena.origin[1]
  worldZ = localZ + arena.origin[2]
  Output: "worldX worldY worldZ pitch yaw roll"
```

**Output format** — must match this structure exactly (from `arenas.sp` parser):
```
SpawnConfigs
{
    "<Arena Name> <N>"
    {
        "gamemode"              "<value>"
        "team_size"             "<value>"
        "frag_limit"            "<value>"
        "allowed_classes"       "<value>"
        "hp_multiplier"         "<value>"
        "early_leave_threshold" "<value>"
        "infinite_ammo"         "<0|1>"
        "show_hp"               "<0|1>"
        "min_spawn_distance"    "<value>"
        // ... all other optional keys from ArenaMeta ...

        "spawns"
        {
            // Flat format:
            "1"     "<x y z pitch yaw roll>"
            "2"     "<x y z pitch yaw roll>"

            // OR team-split format:
            "red"
            {
                "1"     "<x y z pitch yaw roll>"
            }
            "blu"
            {
                "1"     "<x y z pitch yaw roll>"
            }

            // OR class-specific format (ultiduo):
            "red"
            {
                "soldier"
                {
                    "1"     "<x y z pitch yaw roll>"
                }
                "medic"
                {
                    "1"     "<x y z pitch yaw roll>"
                }
            }
            "blu"
            {
                "soldier"
                {
                    "1"     "<x y z pitch yaw roll>"
                }
                "medic"
                {
                    "1"     "<x y z pitch yaw roll>"
                }
            }
        }

        // Optional entities block (KOTH/BBall):
        "entities"
        {
            "capture_point"     "<x y z>"
            // or hoop_red, hoop_blu, intel_start, etc.
        }
    }
}
```

**Boolean serialization**: `meta.json` uses `true/false`, output must use `"0"/"1"` strings.

**Entity coordinate offsets**: `entities` positions (capture_point, hoops, intel) must also be offset by the arena placement origin, but only the first 3 components (x y z).

**All supported keys** (from `arenas.sp` lines 332-375):
| Key | Type | Default |
|-----|------|---------|
| gamemode | string | "mge" |
| team_size | string | "1v1" |
| frag_limit | int | server default |
| cap_limit | int | same as frag_limit |
| min_elo | int | -1 |
| max_elo | int | -1 |
| countdown_seconds | int | server default |
| hp_multiplier | float | 1.5 |
| airshot_min_height | int | 250 |
| knockback_boost | int (bool) | 0 |
| visible_hoops | int (bool) | 0 |
| early_leave_threshold | int | 0 |
| infinite_ammo | int (bool) | 1 |
| show_hp | int (bool) | 1 |
| min_spawn_distance | float | 100.0 |
| allow_koth_switch | int (bool) | 0 |
| koth_team_spawns | int (bool) | 0 |
| respawn_delay | float | 0.1 |
| allow_class_change | int (bool) | 1 |
| koth_round_time | int | 180 |
| allowed_classes | string | "" (all classes) |

**Exports:**
- `generateConfig(mapName: string, placedArenas: PlacedArena[], outputDir: string): string` — returns path to written cfg

**Acceptance:** Generated cfg loads correctly in MGEMod plugin. Validated by placing the cfg in `addons/sourcemod/configs/mge/` on a test server and confirming arenas appear with correct spawns.

---

### 1.8 — Compile Pipeline Service

Port `ChillyMGE/scripts/compile.js` to a module that spawns compile tools as child processes and streams progress.

**File: `electron/services/compiler.ts`**

**Behavior:**
1. Resolve tool paths from TF2 install: `vbsp.exe`, `vvis.exe`, `vrad.exe`, `bspzip.exe`
2. Run stages sequentially: VBSP → VVIS → VRAD → pack
3. For each stage:
   - Spawn the tool as a child process (`child_process.spawn`, NOT `execFileSync`)
   - Stream stdout/stderr line-by-line
   - Emit progress events via a callback or EventEmitter
   - Track elapsed time per stage
4. VRAD flags: always `-both` (LDR+HDR); add `-fast` when fast mode is on
5. VVIS flags: add `-fast` when fast mode is on
6. Asset packing stage:
   - Scan all arena VMFs for custom asset references (model paths matching asset prefixes)
   - For each reference, locate the file in the arena's `assets/` directory
   - Write bspzip file list (pairs of internal BSP path + disk path)
   - Run `bspzip -game <tf> -addlist <bsp> <filelist> <bsp>`
7. Return `BuildResult` with paths to BSP + cfg, or error details

**Exports:**
- `compile(options: CompileOptions): Promise<BuildResult>`
- `CompileOptions`: `{ vmfPath, bspPath, tf2Root, fastMode, arenas: PlacedArena[], onProgress: (p: CompileProgress) => void }`

**Error detection patterns** (parse from stdout):
- `**** leaked ****` → leak error, report which entity leaked
- `MAX_MAP_PLANES` → too much geometry, suggest reducing arena count
- Exit code != 0 → generic stage failure

**Acceptance:** Compile a map with 5 badlands_mid arenas end-to-end, receiving progress events for each stage, producing a valid BSP.

---

### 1.9 — IPC Bridge

Wire all services to the renderer through Electron's IPC.

**File: `electron/preload.ts`**

Expose a typed API to the renderer via `contextBridge.exposeInMainWorld`:

```typescript
// Available in renderer as window.api
interface ElectronAPI {
  // TF2
  detectTF2(): Promise<string | null>;
  setTF2Path(path: string): Promise<boolean>;

  // Arenas
  getArenas(): Promise<ArenaPackage[]>;

  // Build
  build(config: BuildConfig): Promise<BuildResult>;
  onBuildProgress(callback: (progress: CompileProgress) => void): void;

  // File operations
  copyToTF2(bspPath: string, cfgPath: string): Promise<boolean>;
  openFolder(path: string): void;
  selectFolder(): Promise<string | null>;
}
```

**File: `electron/main.ts`** — Register `ipcMain.handle` for each channel.

**IPC channels:**
| Channel | Direction | Purpose |
|---------|-----------|---------|
| `tf2:detect` | invoke → handle | Auto-detect TF2 path |
| `tf2:setPath` | invoke → handle | Manually set TF2 path |
| `arenas:list` | invoke → handle | Get all loaded arena packages |
| `build:start` | invoke → handle | Start the full build pipeline |
| `build:progress` | main → renderer | Stream compile progress events |
| `fs:copyToTF2` | invoke → handle | Copy BSP+cfg to tf/maps/ and tf/addons/sourcemod/configs/mge/ |
| `fs:openFolder` | invoke → handle | Open folder in file explorer |
| `fs:selectFolder` | invoke → handle | Show folder picker dialog |

**Acceptance:** Renderer can call `window.api.getArenas()` and receive the 6 bundled arenas. Renderer can call `window.api.build(config)` and receive progress events followed by a result.

---

### 1.10 — Bundle Starter Arenas

Create the 6 bundled arena packages with proper `meta.json` files. Spawn coordinates must be extracted from the ChillyPunch config (`mge_chillypunch_final4_fix2.cfg`) and converted to local coordinates (subtract the arena's original placement origin in ChillyPunch).

**Directory: `arenas/`**

```
arenas/
  badlands_mid/
    area_badlands_mid.vmf          — Copy from ChillyMGE/areas/
    meta.json
    assets/
      models/chillymge/badlands_train_boxes.mdl
      models/chillymge/badlands_train_boxes.vvd
      models/chillymge/badlands_train_boxes.dx90.vtx
      models/chillymge/badlands_train_boxes.dx80.vtx
      models/chillymge/badlands_train_boxes.sw.vtx
      materials/models/chillymge/badlands_train_boxes/*.vmt
  badlands_spire/
    area_badlands_spire.vmf
    meta.json
  granary_pro_mid/
    area_granary_pro_mid.vmf
    meta.json
  product_mid/
    area_product_mid.vmf
    meta.json
  gullywash_mid/
    area_gullywash_mid.vmf
    meta.json
  endif_open/
    area_endif_open.vmf
    meta.json
```

Each `meta.json` follows the `ArenaMeta` schema from 1.2 with:
- All gameplay settings (gamemode, team_size, frag_limit, etc.) taken from the ChillyPunch config
- Spawns in local coordinates with red/blu team split
- Endif uses flat spawn format (no red/blu split) and gamemode "endif"

**Acceptance:** `loadArenas("arenas/")` returns 6 valid packages. A full build with 5 badlands_mid + 5 badlands_spire produces a working BSP + cfg that loads in MGEMod.

---

## Phase 2 — UI Shell and Arena Selection

### Goal

Build the complete user interface. By the end of this phase, the user can browse arenas, configure a build, and see a ready-to-build configuration — but the "Build" button is not yet wired to the compile pipeline.

### 2.1 — App Layout Shell

**Files:**
- `src/routes/+layout.svelte` — Main layout with sidebar + content area
- `src/lib/components/Sidebar.svelte` — Navigation sidebar

**Layout structure:**
```
+------------------------------------------+
| Sidebar (240px)  |  Main Content          |
|                  |                        |
| [Logo/Title]     |  (routed page content) |
| [Arenas]         |                        |
| [Build Config]   |                        |
| [Build]          |                        |
|                  |                        |
| [TF2 Status]     |                        |
+------------------------------------------+
```

**Design tokens** (dark industrial):
- Background: zinc-950 sidebar, zinc-900 content
- Borders: zinc-800
- Accent: orange-500/600 (TF2-inspired)
- Font: system mono for compile output, system sans for UI

### 2.2 — TF2 Setup Screen

**File: `src/routes/setup/+page.svelte`**

Shown on first launch if TF2 is not auto-detected. Allows manual path selection.

**Elements:**
- Status indicator (detected/not detected)
- Auto-detected path display
- "Browse" button → `window.api.selectFolder()` → `window.api.setTF2Path()`
- "Continue" button (disabled until valid path)

### 2.3 — Arena Browser

**File: `src/routes/+page.svelte`** (or `src/routes/arenas/+page.svelte`)

Grid display of available arenas.

**Elements:**
- Arena cards: name, description, gamemode badge, instance count selector (+/- buttons)
- Active selection summary: total arena instances, estimated compile time hint
- Cards highlight when selected (count > 0)

**Svelte store: `src/lib/stores/build.svelte.ts`**

```typescript
// Svelte 5 runes-based store
let selectedArenas = $state<Map<string, number>>(new Map());
let mapName = $state("mge_custom");
let fastMode = $state(true);
let skybox = $state("sky_trainyard_01");
```

### 2.4 — Build Config Panel

**File: `src/routes/config/+page.svelte`** (or inline panel)

**Elements:**
- Map name input (validated: lowercase, underscores, no spaces)
- Skybox dropdown (common TF2 skyboxes)
- Lighting preset selector (Badlands warm, Granary industrial, custom)
- Fast mode toggle
- Summary: list of selected arenas with counts
- "Build" button (styled prominent, disabled state when no arenas selected)

### 2.5 — Svelte Stores and State Management

**File: `src/lib/stores/tf2.svelte.ts`** — TF2 path state, detection status
**File: `src/lib/stores/arenas.svelte.ts`** — Loaded arena packages from IPC
**File: `src/lib/stores/build.svelte.ts`** — Build configuration, selected arenas

**Acceptance:** User can browse arenas, adjust instance counts, configure map name/skybox, and see a summary. All state persists across navigation. No compile functionality yet.

---

## Phase 3 — Build Flow Integration

### Goal

Wire the UI to the compile pipeline. By the end of this phase, the app produces a working BSP + MGEMod cfg end-to-end.

### 3.1 — Build Orchestration

**File: `src/routes/build/+page.svelte`** (or modal/overlay)

When the user clicks "Build":
1. Renderer calls `window.api.build(buildConfig)`
2. Main process orchestrates: layout → VMF gen → config gen → compile
3. Progress events stream to renderer via `window.api.onBuildProgress()`
4. On completion, show result (success/error)

**Main process build flow** (in `electron/main.ts` or dedicated `electron/build.ts`):

```
1. loadArenas() → get ArenaPackage[]
2. layoutArenas(selectedArenas) → PlacedArena[]
3. generateVMF(config, placedArenas, buildDir) → vmfPath
4. generateConfig(mapName, placedArenas, buildDir) → cfgPath
5. compile({ vmfPath, bspPath, tf2Root, fastMode, arenas, onProgress }) → BuildResult
```

### 3.2 — Progress UI

**File: `src/lib/components/BuildProgress.svelte`**

**Elements:**
- Stage indicators: VBSP → VVIS → VRAD → PACK (with checkmarks/spinners)
- Live compile log output (scrollable terminal-style area, monospace font)
- Elapsed time per stage
- Overall progress bar (4 stages)
- Cancel button (kills child processes)

### 3.3 — Build Result Screen

**File: `src/lib/components/BuildResult.svelte`**

**On success:**
- BSP file path + size
- CFG file path
- "Copy to TF2" button — copies BSP to `tf/maps/` and cfg to `tf/addons/sourcemod/configs/mge/`
- "Open build folder" button
- "Build another" button

**On error:**
- Error message with human-readable explanation
- Common error patterns and suggestions:
  - Leak → "An arena has entities outside its sealed geometry"
  - MAX_MAP_PLANES → "Too many arenas — try removing some"
  - Missing texture → "Arena references missing materials"
- Full compile log expandable

### 3.4 — Asset Packing Integration

Ensure the compile pipeline handles custom assets from arena `assets/` folders:

1. Before VBSP: copy custom assets from each arena's `assets/` dir to a temp directory mirroring the `tf/` structure, or configure VBSP search paths
2. After VRAD: scan VMFs for custom references, build bspzip file list from arena `assets/` dirs
3. Run bspzip to pack into BSP

**Acceptance:** Building a map with badlands_mid (which has `badlands_train_boxes.mdl`) produces a BSP where the model renders in-game. The cfg loads in MGEMod with correct arena names, spawns, and gamemode settings.

---

## Phase 4 — Polish and Distribution

### Goal

Production-ready packaging, branding, and UX polish.

### 4.1 — Electron Forge Packaging

- Configure `forge.config.ts` makers for Windows (MakerSquirrel for installer, MakerZip for portable)
- Set app metadata: name, icon, version, description
- Test `bun run make` produces a working `.exe` installer
- Verify bundled arenas are included in the packaged app (via Electron's `extraResource` or asar)

### 4.2 — App Icon and Branding

- Create app icon (`.ico` for Windows)
- Window title bar: "MGE Map Builder"
- About dialog with version info

### 4.3 — Input Validation

- Map name: lowercase alphanumeric + underscores, starts with `mge_`
- Arena count: warn at >8, hard limit at ~12 (MAX_MAP_PLANES risk)
- Coordinate bounds: warn if layout exceeds ±14000 (close to ±16384 limit)
- TF2 path: validate vbsp.exe exists, show clear error if not

### 4.4 — Settings Persistence

- Store user preferences in Electron's `app.getPath('userData')`:
  - TF2 install path
  - Last used map name
  - Last used skybox/lighting preset
  - Fast mode preference
  - Window size/position
- Use a simple JSON file (`settings.json`)

### 4.5 — UX Polish

- Tooltips on MGEMod config fields explaining what each setting does
- Keyboard shortcuts (Ctrl+B to build)
- Loading states for arena scanning
- Confirmation dialog before overwriting existing BSP
- "What's this?" help text for non-obvious concepts (fast mode, lighting presets, team_size format)

### 4.6 — Testing

- Test with a real TF2 server deployment:
  1. Build a map with 5 badlands_mid + 3 badlands_spire
  2. Copy BSP to server's `tf/maps/`
  3. Copy cfg to server's `tf/addons/sourcemod/configs/mge/`
  4. Load map, verify all arenas appear in MGE plugin
  5. Join arenas, verify spawns are correct
  6. Verify custom models render (train boxes)
- Test edge cases:
  - Single arena map
  - Maximum arena count before MAX_MAP_PLANES
  - Fast mode vs full compile
  - Map name with special characters (should be rejected)

**Acceptance:** Packaged `.exe` installs on a clean Windows machine with TF2, user can build a working MGE map end-to-end without touching any config files or command lines.
