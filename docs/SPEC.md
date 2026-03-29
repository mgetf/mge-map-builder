# MGE Map Builder — Specification

## Overview

A desktop application that lets TF2 server operators build custom MGE maps by selecting prefab arenas, configuring layout, and producing a ready-to-use BSP + spawn config. Users are abstracted from all compilation details.

## Tech Stack

- **Electron** — desktop shell (file system access, compile pipeline)
- **SvelteKit** — UI framework (static adapter, prerendered)
- **Tailwind CSS** — styling
- **Bun** — package manager and script runner
- **Template** — based on [sveltronkit](https://github.com/Pandoks/sveltronkit) (Electron Forge + SvelteKit)

## Architecture

```
electron/main.ts      — Main process: window management, IPC handlers, compile pipeline
electron/preload.ts   — IPC bridge: exposes safe APIs to the renderer
src/                  — SvelteKit app (renderer process): arena selection UI, build config, progress
```

### Process Boundaries

- **Renderer** (browser): UI only. Cannot access file system directly.
- **Main** (Node.js): File system access, spawning VBSP/VVIS/VRAD, TF2 detection, asset management.
- **Preload**: Bridge exposing specific IPC channels from main to renderer.

## Requirements

### Hard Requirements

- **TF2 must be installed** on the user's machine. The compile pipeline depends on:
  1. **Compile tools** — VBSP, VVIS, VRAD, bspzip (in `Team Fortress 2/bin/`)
  2. **Stock materials/textures** — VBSP resolves texture references against `tf/materials/`. Stock assets are stored inside TF2's VPK archives and resolved automatically via the `-game` flag.
  3. **Game directory** — the `-game` flag points to `tf/` for material resolution

### Outputs

- A `.bsp` file (the compiled map) ready to drop into `tf/maps/`
- A `_spawns.cfg` file with arena spawn coordinates for the MGE mod plugin

---

## Content Distribution

### Bundled Arenas

The app ships with the 6 most played arenas pre-installed:

1. **Badlands Middle** (~11,600 plays/90d) — requires bundled `badlands_train_boxes.mdl`
2. **Badlands Spire** (~4,300 plays/90d)
3. **Granary Pro Middle** (~1,000 plays/90d)
4. **Product Middle** (~530 plays/90d)
5. **Gullywash Middle** (~520 plays/90d)
6. **Endif** (~125 plays/90d)

Five are stock TF2 only. Badlands Middle is the sole bundled arena with a custom asset dependency.

### Arena Repository

All arenas (including the bundled ones) live in a separate GitHub repository. The repo is the single source of truth for arena content.

```
arenas-repo/
  badlands_mid/
    area_badlands_mid.vmf
    meta.json
    assets/
      models/chillymge/badlands_train_boxes.mdl
      models/chillymge/badlands_train_boxes.vvd
      models/chillymge/badlands_train_boxes.dx90.vtx
      materials/models/chillymge/badlands_train_boxes/...
  gullywash_mid/
    area_gullywash_mid.vmf
    meta.json
  badlands_spire/
    area_badlands_spire.vmf
    meta.json
  ...
```

Most folders contain just a VMF + `meta.json`. The few arenas with custom assets include them in an `assets/` subfolder.

### Acquiring Arenas

Users get arenas through three channels:

1. **Bundled** — the ~5 starter arenas ship with the app installer
2. **Download from repo** — the app fetches a registry from the arena repo, displays available arenas with names/descriptions, and lets users one-click download + cache locally
3. **Manual import** — users can drop in their own arena folder (VMF + optional meta.json + optional assets) for custom/third-party arenas

---

## Arena System

### Arena as a Package

Each arena is a self-contained folder:

```
badlands_mid/
  area_badlands_mid.vmf        — The arena geometry (func_instance VMF)
  meta.json                    — Metadata: name, description, spawns
  assets/                      — Custom models/materials required (if any)
    models/chillymge/...
    materials/chillymge/...
  thumbnail.png                — Preview image for the UI (optional)
```

### Arena Metadata (`meta.json`)

Minimal schema for v1:

```json
{
  "name": "Badlands Middle",
  "description": "Classic mid-fight arena from cp_badlands",
  "vmf": "area_badlands_mid.vmf",
  "spawns": [
    "1850 500 750 0 90 0",
    "1700 900 750 0 90 0",
    "2000 900 750 0 90 0",
    "2200 800 750 0 135 0",
    "2700 1500 750 0 180 0",
    "1850 2300 750 0 -90 0",
    "1700 1900 750 0 -90 0",
    "2000 1900 750 0 -90 0",
    "1450 2000 750 0 -45 0",
    "1000 1350 750 0 0 0"
  ]
}
```

**Spawn format**: `"x y z pitch yaw roll"` — coordinates are relative to the arena's local origin (0,0,0). At build time, the tool adds the arena's placement offset to each spawn position, so spawns work correctly regardless of where the arena is placed in the final map.

**Derived properties** (the app can infer these without metadata):
- Has custom assets → `assets/` subfolder exists
- VMF filename → only `.vmf` file in the folder

**Optional extended fields** (for richer UI, can add later):
```json
{
  "category": "mid",
  "tags": ["5cp", "classic", "popular"],
  "source_map": "cp_badlands"
}
```

### Asset Dependency Categories

There are three categories of assets an arena VMF may reference:

1. **Stock TF2 assets** — Models and materials that ship with TF2 inside its VPK archives. No action needed; resolved automatically via the `-game` flag. The vast majority of arenas (40 out of 49 from ChillyMGE) use only stock assets.

2. **Custom arena assets** — Models and materials created specifically for MGE arenas (e.g., `models/chillymge/badlands_train_boxes.mdl`). These don't exist anywhere in TF2's game files — not in the VPKs, not in any stock map. They were hand-made by arena creators (PepperKick in the case of ChillyPunch) and must be:
   - Bundled in the arena's `assets/` folder
   - Made available to VBSP at compile time
   - Packed into the output BSP via bspzip

   **Why custom models exist**: Some arena geometry (like the train boxes in Badlands Middle) is brush-based in the original TF2 map. Arena creators convert complex brush geometry into single prop models to reduce brush count — critical when the same arena is instanced multiple times and each instance's brushes count against `MAX_MAP_PLANES`.

   **9 arenas** from ChillyMGE have custom asset dependencies:
   | Arena | Custom Assets |
   |-------|--------------|
   | badlands_mid | `badlands_train_boxes.mdl` |
   | process_mid | `process_corner_building.mdl` |
   | process_second | 13 custom models (building facades) |
   | metalworks_mid | 3 custom models |
   | sunshine_mid | 3 custom models (tower, cafes) |
   | logjam_second | 1 custom model |
   | bball | 3 custom models (snow pieces) |
   | bball_mountain | 9 custom models |
   | control | 1 custom texture (`chillymge/maplogo`) |

3. **Community map assets** — Textures/models from third-party community maps (e.g., `kalinka/`, `onsen/`, `pl_temple/`). Some arenas were decompiled from community maps and reference assets not in stock TF2. These would need extraction from their original map BSPs. Lower priority — arenas with unresolved community asset dependencies may be unsupported initially or render with missing textures.

### Asset Pipeline at Compile Time

1. Custom assets live in each arena's `assets/` folder (shipped with the arena package)
2. Before VBSP runs, assets are made discoverable — either:
   - Temporarily copied into the user's `tf/` directory, or
   - (Preferred) A custom `gameinfo.txt` search path is configured so VBSP searches both `tf/` and the app's asset directory
3. After VRAD completes, the compile pipeline scans all VMFs for custom asset references, finds matching files, and packs them into the BSP via `bspzip -addlist`
4. The final BSP is fully self-contained — anyone loading the map gets the custom assets from the BSP's embedded pak lump

---

## Map Generation Pipeline

### Step 1: VMF Generation

The master VMF is assembled from:
- **Worldspawn properties** — skybox name, detail sprites, map message
- **`func_instance` entities** — one per arena, pointing at the arena's VMF file with an origin offset
- **`light_environment` entity** — injected automatically (see Key Technical Decisions)

Instance file paths are written relative to the VMF output location so VBSP can resolve them.

### Step 2: Spawn Config Generation

For each arena instance, the tool:
1. Reads spawn positions from the arena's `meta.json` (local coordinates)
2. Adds the arena's placement origin offset to each spawn position
3. Writes world-space spawn coordinates to the output `_spawns.cfg`

This means spawn definitions are portable — defined once in `meta.json`, correct at any placement position.

### Step 3: Compilation

Sequential execution of Source SDK tools:
1. **VBSP** — Converts VMF to BSP (geometry, entities, textures)
2. **VVIS** — Calculates visibility (portal-based PVS)
3. **VRAD** — Computes lighting (radiosity). Uses `-both` for LDR+HDR lightmaps.
4. **bspzip** — Packs custom assets into the BSP

Supports `--fast` mode for quick iteration (single-bounce lighting, fast vis).

### Step 4: Output

- BSP written to build directory
- Spawn config written alongside
- User can copy to `tf/maps/` (or the app offers to do it)

---

## Key Technical Decisions

### `light_environment` Injection

Arena VMFs generally do NOT contain a `light_environment` entity (only 6 out of 49 in ChillyMGE do). Without one, the map has no sun/ambient light — only local point lights from the arenas, resulting in near-darkness. This was confirmed by testing: a map built with arenas lacking `light_environment` was completely dark.

**Solution**: The master VMF generator always injects a `light_environment` entity. Its lighting values (sun color, ambient, angle, pitch) are configurable per-map in the build config. The entity is placed 500 units above the first arena's origin to guarantee it's inside sealed geometry (entities in the void cause leaks).

Default values (Badlands warm theme):
- Sun: `251 201 155` brightness 250, pitch -30, yaw 210
- Ambient: `153 159 187` brightness 170

### Arena Layout / Placement

Arenas are placed at configurable origin offsets in the master VMF. The tool must handle automatic layout with these constraints:

- **No overlap** — arena bounding boxes (including all brush geometry) must not intersect. Requires measuring each arena's extents from its VMF.
- **Source engine limits** — all coordinates must be within ±16384 units
- **Sky camera conflicts** — arenas with `sky_camera` entities have 3D skybox geometry at ~8192 units offset that can collide with other arenas
- **MAX_MAP_PLANES** — Source BSP format has a hard limit on geometry complexity. Typically ~8-12 arenas per map depending on complexity. Exceeding this is a fatal VBSP error.
- **Leaked entities** — some arenas have entities (e.g., `func_nobuild`) placed outside their sealed brushwork, causing VBSP leaks when instanced standalone

### Arenas Excluded from Standard Use

| Arena | Reason |
|-------|--------|
| `propaganda_mid` | 3D skybox spans 30720x30720, fills entire map coordinate space |
| `ultiduo_badlands` | 3D skybox spans 13824x9728, very large; has its own `light_environment` |

---

## TF2 Detection

The app auto-detects the TF2 installation by checking (in order):
1. `TF2_PATH` environment variable
2. Common Steam library paths:
   - `C:\Program Files (x86)\Steam\steamapps\common\Team Fortress 2`
   - `C:\Program Files\Steam\steamapps\common\Team Fortress 2`
   - `D:\Steam\steamapps\common\Team Fortress 2`
   - `D:\SteamLibrary\steamapps\common\Team Fortress 2`
3. Steam registry key (Windows): `HKCU\Software\Valve\Steam\SteamPath` → parse `libraryfolders.vdf`

Validation: check for `bin/vbsp.exe` existence at the candidate path.

---

## User Flow (Target UX)

1. **Launch app** → TF2 detected (or prompt to locate)
2. **Arena selection** → Browse available arenas (bundled + downloaded + imported) with names, descriptions. Select which ones to include and how many instances of each.
3. **Map configuration** → Set map name, skybox, lighting preset
4. **Build** → One-click compile. Real-time log output, progress indication. Fast mode toggle.
5. **Done** → BSP + spawn config ready. Option to copy directly to TF2 maps folder, or export to a chosen location.

---

## File Structure (App)

```
mge-map-builder/
  electron/
    main.ts               — Electron main process
    preload.ts            — IPC bridge
  src/
    routes/               — SvelteKit pages (UI)
    lib/                  — Shared components and utilities
  arenas/                 — Bundled arena packages (VMFs + assets + metadata)
  docs/
    SPEC.md               — This document
    ARENA_GUIDELINES.md   — Guidelines for mappers creating/improving arenas
  package.json
  forge.config.ts
  svelte.config.js
  vite.config.ts
```

---

## Future Considerations

- **MGE mod spawn config format** — The MGE plugin needs a SpawnConfigs KeyValues file with gamemode, team_size, frag_limit, allowed_classes, and red/blu spawn sections per arena. The current spawn format is simplified; full MGE plugin compatibility needs proper KeyValues output.
- **Custom brush materials** — Some arenas reference custom-prefixed materials on brush faces (not just models). These need extraction and packing too.
- **Community arena submissions** — Allow users to contribute arenas via PRs to the arena repo.
- **Cloud compilation** — Optional server-side compile to remove TF2 install requirement. Adds significant complexity.
- **Arena preview rendering** — 3D or top-down preview of arena layout before building.
- **Model editing workflow** — Custom prop models (like `badlands_train_boxes.mdl`) can be edited by decompiling with Crowbar → editing in Blender (with Source Tools addon) → recompiling with StudioMDL.
