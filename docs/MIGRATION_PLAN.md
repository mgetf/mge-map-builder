# MGE Map Builder — Electron to Electrobun Migration Plan

> Each phase is a self-contained, testable milestone. Use Plan Mode to expand any phase into a detailed execution brief before starting work.

---

## Overview

**Source:** `mge-map-builder/` (Electron 40 + Electron Forge + SvelteKit + Vite)
**Target:** `mge-map-builder-electrobun/` (Electrobun 1.16 + Bun + Svelte 5 + Vite)

### What changes

| Concern | Electron (current) | Electrobun (target) |
|---|---|---|
| Runtime | Node.js + bundled Chromium | Bun + system WebView |
| Main process entry | `electron/main.ts` (Electron APIs) | `src/bun/index.ts` (Electrobun APIs) |
| Renderer framework | SvelteKit + adapter-static | Plain Svelte 5 + Vite SPA |
| IPC | `ipcMain.handle` / `contextBridge` / `ipcRenderer.invoke` | Typed RPC (`BrowserView.defineRPC` / `Electroview.defineRPC`) |
| Dialogs / shell | `electron.dialog`, `electron.shell` | `Utils.openFileDialog`, `Utils.showItemInFolder`, `Utils.openPath` |
| App paths | `app.getPath("temp")`, `app.getPath("userData")` | `Utils.paths.temp`, `Utils.paths.userData` |
| Packaging | Electron Forge + MakerSquirrel | `electrobun build` |
| Bundle size | ~150MB | ~14MB |

### What stays the same

- **Service modules** — `tf2.ts`, `arenas.ts`, `layout.ts`, `vmf.ts`, `config.ts`, `compiler.ts`, `keyvalues.ts` move as-is (pure TS + Node `fs`/`path`/`child_process`, all supported by Bun)
- **Shared types** — `types.ts` is framework-agnostic
- **Svelte components** — All `.svelte` files migrate with minimal changes (drop `$app/stores` usage, update import paths)
- **Svelte stores** — Runes-based `.svelte.ts` stores keep their logic, only the `window.api.*` calls change to RPC calls
- **UI library** — bits-ui, tailwind-variants, clsx, tailwind-merge all work in plain Svelte
- **shadcn-svelte components** — All `ui/` primitives (button, card, badge, etc.) are plain Svelte, no SvelteKit dependency
- **Arena data** — `arenas/` folder with `meta.json` + `.vmf` files copies over unchanged
- **CSS / Tailwind** — `app.css` and Tailwind config transfer directly

### What gets removed

- `lzma-native` — was a one-off testing dependency, not needed
- `electron-squirrel-startup` — Electron-specific
- All `@electron-forge/*` packages
- `@electron/fuses`
- `forge.config.ts`, `forge.env.d.ts`, `vite.main.config.ts`, `vite.preload.config.ts`
- SvelteKit (`@sveltejs/kit`, `@sveltejs/adapter-static`, routing files like `+layout.ts`)

---

## Phase 1 — Project Scaffold and Dev Loop

### Goal

Get the electrobun project running with Svelte 5, Vite, and Tailwind CSS, producing a window with styled placeholder content. Confirm the dev loop works (both `bun run start` and HMR via `bun run dev:hmr`).

### Tasks

1. **Update `package.json`** — Add missing dependencies from the Electron project:
   - `tailwindcss`, `@tailwindcss/vite`, `@tailwindcss/forms`, `@tailwindcss/typography`
   - `bits-ui`, `tailwind-variants`, `clsx`, `tailwind-merge`
   - Keep existing: `electrobun`, `svelte`, `vite`, `@sveltejs/vite-plugin-svelte`, `typescript`
   - Remove `@types/bun` if present (Bun types are built-in)

2. **Configure Vite** — Update `vite.config.ts`:
   - Add Tailwind plugin (`@tailwindcss/vite`)
   - Configure path aliases (`$lib` → `src/mainview/lib`)

3. **Set up Tailwind** — Copy `app.css` from the Electron project (contains theme variables and Tailwind imports), adapting paths for the new `src/mainview/` structure

4. **Create app shell** — Replace the demo `App.svelte` with a minimal layout that proves Tailwind + shadcn styling works:
   - Dark background, a styled card, a button
   - Import and render one shadcn-svelte component to verify the pipeline

5. **Update `electrobun.config.ts`** — Set app metadata:
   - `name: "MGE Map Builder"`
   - `identifier: "mgemapbuilder.app"`
   - Update build `copy` rules if Vite output paths change

6. **Update main process** — Adjust `src/bun/index.ts` window config:
   - Title: `"MGE Map Builder"`
   - Size: 1200x800, min 900x600

7. **Run `bun install` and verify both dev flows work**

### Acceptance

- `bun run start` opens a window titled "MGE Map Builder" with dark-themed styled content
- `bun run dev:hmr` opens with HMR working (edit `App.svelte` → see changes without restart)
- Tailwind classes render correctly
- No console errors

### Files created/modified

- `package.json` (modified — deps)
- `vite.config.ts` (modified — Tailwind plugin, aliases)
- `src/mainview/app.css` (replaced — theme from Electron project)
- `src/mainview/App.svelte` (replaced — minimal shell)
- `electrobun.config.ts` (modified — app metadata)
- `src/bun/index.ts` (modified — window config)

---

## Phase 2 — UI Component Migration

### Goal

Migrate all Svelte components and UI primitives from the Electron project. Replace SvelteKit routing with a simple client-side view switcher. By the end, the full UI renders but is not wired to any backend logic — stores use mock data.

### Tasks

1. **Copy shadcn-svelte primitives** — Copy the entire `src/lib/components/ui/` tree (badge, button, card, input, label, separator, switch) into `src/mainview/lib/components/ui/`. Update import paths from `$lib/` to use the new alias.

2. **Copy `components.json`** — Adapt for the new project structure (update `aliases` to point at `src/mainview/lib`, update Tailwind CSS path).

3. **Copy `src/lib/utils.ts`** — The `cn()` utility (clsx + tailwind-merge).

4. **Implement client-side routing** — Replace SvelteKit's file-based routing with a simple state-based view switcher in `App.svelte`:
   ```
   let currentView = $state<"arenas" | "config">("arenas");
   ```
   Render `ArenasPage` or `ConfigPage` based on `currentView`. Pass a navigation callback to `Sidebar`.

5. **Migrate page components** — Convert SvelteKit route files to plain Svelte components:
   - `src/routes/+page.svelte` → `src/mainview/lib/views/ArenasView.svelte`
   - `src/routes/config/+page.svelte` → `src/mainview/lib/views/ConfigView.svelte`
   - Remove SvelteKit-specific imports (`$app/stores`)
   - Replace `<a href="/">` navigation with callback-based navigation

6. **Migrate app components** — Copy and adapt:
   - `Sidebar.svelte` — Remove `import { page } from "$app/stores"`, use a `currentView` prop + `onNavigate` callback instead of `<a href>`
   - `ArenaCard.svelte` — No changes needed (no SvelteKit deps)
   - `TF2Setup.svelte` — Replace `window.api.selectFolder()` with a TODO placeholder

7. **Migrate stores with mock data** — Copy the three `.svelte.ts` stores, replacing `window.api.*` calls with mock implementations:
   - `tf2.svelte.ts` — `detectTF2()` returns a hardcoded path
   - `arenas.svelte.ts` — `fetchArenas()` returns mock arena data
   - `build.svelte.ts` — No changes (it's pure local state, no IPC calls)
   - Update type imports from `../../electron/types.js` to a local `shared/types.ts`

8. **Copy shared types** — Copy `electron/types.ts` → `src/shared/types.ts` (remove any Electron-specific imports if present)

9. **Create `src/mainview/index.html`** — Ensure the mount point and Vite entry script are correct.

### Acceptance

- App launches with dark-themed sidebar, arena grid, and config page
- Sidebar navigation switches between Arenas and Config views
- Mock arenas display in the grid with working +/- instance counters
- Config page shows map name input, skybox dropdown, lighting preset selector, fast mode toggle
- TF2Setup screen appears initially (with mock "not detected" state), can be dismissed
- All shadcn-svelte components render correctly with the dark theme

### Files created/modified

- `src/mainview/lib/components/ui/` (new — copied from Electron project)
- `src/mainview/lib/components/Sidebar.svelte` (new — adapted)
- `src/mainview/lib/components/ArenaCard.svelte` (new — copied)
- `src/mainview/lib/components/TF2Setup.svelte` (new — adapted with placeholder)
- `src/mainview/lib/views/ArenasView.svelte` (new — from +page.svelte)
- `src/mainview/lib/views/ConfigView.svelte` (new — from config/+page.svelte)
- `src/mainview/lib/stores/tf2.svelte.ts` (new — mock)
- `src/mainview/lib/stores/arenas.svelte.ts` (new — mock)
- `src/mainview/lib/stores/build.svelte.ts` (new — copied)
- `src/mainview/lib/utils.ts` (new — copied)
- `src/shared/types.ts` (new — from electron/types.ts)
- `src/mainview/App.svelte` (modified — layout + view switching)
- `components.json` (new — adapted)

---

## Phase 3 — Service Layer Migration

### Goal

Port all backend service modules to the Bun main process. By the end, services are callable from `src/bun/index.ts` and can be tested by logging output to the console.

### Tasks

1. **Copy service modules** — Move all files from `electron/services/` to `src/bun/services/`:
   - `tf2.ts` — TF2 auto-detection (Windows registry, Steam library paths, env var)
   - `arenas.ts` — Arena package loader (scans dirs, parses meta.json, measures VMF bounds)
   - `layout.ts` — Shelf-packing layout engine
   - `vmf.ts` — VMF generator (func_instance, light_environment)
   - `config.ts` — MGEMod config generator (SpawnConfigs format)
   - `compiler.ts` — VBSP/VVIS/VRAD/bspzip pipeline
   - `keyvalues.ts` — Valve KeyValues serializer

2. **Audit Node API compatibility** — Verify each service's imports work in Bun:
   - `fs`, `path` — fully supported
   - `child_process.spawn` — supported (or swap to `Bun.spawn` if beneficial)
   - `os` — supported
   - `crypto` — supported
   - No native addons needed (lzma-native is removed)

3. **Adapt paths** — In `compiler.ts` and `arenas.ts`, update any path resolution that used Electron's `app.getAppPath()` or `process.resourcesPath`:
   - Use `PATHS.RESOURCES_FOLDER` from `electrobun/bun` for bundled arena data
   - Use `Utils.paths.temp` for build output directory

4. **Copy arena data** — Set up the `arenas/` folder in the project root (or under a `resources/` folder), and update `electrobun.config.ts` `build.copy` to include it in the bundle.

5. **Smoke test** — In `src/bun/index.ts`, after creating the window, call `loadArenas()` and `findTF2()`, log results to console:
   ```typescript
   const arenas = loadArenas(arenasDir);
   console.log(`Loaded ${arenas.length} arenas`);
   const tf2 = findTF2();
   console.log(`TF2 path: ${tf2 ?? "not found"}`);
   ```

### Acceptance

- `bun run start` logs `Loaded 6 arenas` and the TF2 path (or "not found") to the terminal
- No import errors or runtime crashes from any service module
- All service modules compile without type errors

### Files created/modified

- `src/bun/services/tf2.ts` (new — from electron/services/)
- `src/bun/services/arenas.ts` (new — from electron/services/)
- `src/bun/services/layout.ts` (new — from electron/services/)
- `src/bun/services/vmf.ts` (new — from electron/services/)
- `src/bun/services/config.ts` (new — from electron/services/)
- `src/bun/services/compiler.ts` (new — from electron/services/)
- `src/bun/services/keyvalues.ts` (new — from electron/services/)
- `arenas/` (copied from Electron project)
- `electrobun.config.ts` (modified — copy rules for arenas)
- `src/bun/index.ts` (modified — smoke test calls)

---

## Phase 4 — RPC Bridge

### Goal

Replace Electron's IPC bridge with Electrobun's typed RPC. Wire all services to the renderer so the UI can call backend functions with full type safety.

### Tasks

1. **Define the RPC schema** — Create `src/shared/rpc.ts` with the full typed interface:
   ```typescript
   import { RPCSchema } from "electrobun/bun";

   export type AppRPC = {
     bun: RPCSchema<{
       requests: {
         detectTF2: { params: {}; response: string | null };
         setTF2Path: { params: { path: string }; response: boolean };
         getArenas: { params: {}; response: ArenaPackage[] };
         build: { params: BuildConfig; response: BuildResult };
         cancelBuild: { params: {}; response: void };
         copyToTF2: { params: { bspPath: string; cfgPath: string }; response: boolean };
         selectFolder: { params: {}; response: string | null };
       };
       messages: {
         buildProgress: CompileProgress;
       };
     }>;
     webview: RPCSchema<{
       requests: {};
       messages: {};
     }>;
   };
   ```

2. **Implement Bun-side RPC handlers** — In `src/bun/index.ts`, define the RPC with `BrowserView.defineRPC<AppRPC>()`:
   - Wire each request handler to its corresponding service function
   - For `build`: orchestrate layout → VMF → config → compile, sending `buildProgress` messages during compilation
   - For `selectFolder`: use `Utils.openFileDialog({ canChooseDirectory: true, canChooseFiles: false })`
   - For `copyToTF2`: use `fs.copyFileSync` (same logic as Electron version)
   - Pass the RPC to `new BrowserWindow({ rpc })`

3. **Implement browser-side RPC** — Create `src/mainview/lib/rpc.ts`:
   - Initialize `Electroview.defineRPC<AppRPC>()` with any browser-side handlers
   - Export the `electroview` instance for stores to use
   - Export typed helper: `const api = electroview.rpc.request`

4. **Update stores** — Replace `window.api.*` calls with typed RPC calls:
   - `tf2.svelte.ts`: `window.api.detectTF2()` → `api.detectTF2({})`
   - `arenas.svelte.ts`: `window.api.getArenas()` → `api.getArenas({})`
   - `build.svelte.ts`: no changes (no IPC calls in this store)

5. **Update TF2Setup component** — Replace `window.api.selectFolder()` with `api.selectFolder({})`

6. **Remove `app.d.ts`** — No longer need the `Window.api` global type declaration; RPC is imported directly

7. **Initialize RPC in app entry** — In `src/mainview/main.ts`, ensure the Electroview RPC is initialized before the Svelte app mounts

### Acceptance

- App launches, TF2 detection runs via RPC (result shown in TF2Setup or sidebar status)
- Arena grid loads real arena data via `api.getArenas({})`
- "Browse" button in TF2Setup opens a native folder dialog via RPC
- No `window.api` references remain; all IPC is through typed RPC
- TypeScript reports no errors across the RPC boundary

### Files created/modified

- `src/shared/rpc.ts` (new — RPC type definition)
- `src/bun/index.ts` (modified — RPC handlers, service wiring)
- `src/mainview/lib/rpc.ts` (new — browser-side RPC init)
- `src/mainview/main.ts` (modified — RPC initialization)
- `src/mainview/lib/stores/tf2.svelte.ts` (modified — use RPC)
- `src/mainview/lib/stores/arenas.svelte.ts` (modified — use RPC)
- `src/mainview/lib/components/TF2Setup.svelte` (modified — use RPC)
- `src/mainview/app.d.ts` (deleted)

---

## Phase 5 — Build Pipeline Integration

### Goal

Wire the Build button to the full compile pipeline. Stream progress events from Bun to the renderer in real-time.

### Tasks

1. **Implement build orchestration** — In the Bun-side `build` RPC handler, orchestrate the full flow:
   - Load arenas → layout → generate VMF → generate config → compile
   - During compile, send `buildProgress` RPC messages to the renderer
   - Return `BuildResult` with paths or error

2. **Create BuildProgress component** — `src/mainview/lib/components/BuildProgress.svelte`:
   - Stage indicators: VBSP → VVIS → VRAD → PACK (checkmarks/spinners)
   - Live compile log (scrollable terminal-style monospace area)
   - Elapsed time per stage
   - Cancel button (calls `api.cancelBuild({})`)

3. **Create BuildResult component** — `src/mainview/lib/components/BuildResult.svelte`:
   - On success: BSP path, cfg path, "Copy to TF2" button, "Open folder" button, "Build another" button
   - On error: human-readable message, expandable log
   - "Open folder" uses `Utils.showItemInFolder()` via a new RPC request, or a dedicated RPC message

4. **Add build view** — Create `src/mainview/lib/views/BuildView.svelte`:
   - Shows BuildProgress during compile, BuildResult after completion
   - Listens for `buildProgress` RPC messages from Bun

5. **Wire the Build button** — In `ConfigView.svelte`, change the Build button from `alert()` to:
   - Navigate to the build view
   - Call `api.build(toBuildConfig())`
   - Display progress then result

6. **Add RPC message listener** — Set up `buildProgress` message handler in the browser-side RPC to feed compile events to the build store/view

7. **Add `openFolder` RPC endpoint** — For the "Open build folder" button:
   - Bun handler calls `Utils.showItemInFolder(path)` or `Utils.openPath(path)`

### Acceptance

- Click "Build Map" with arenas selected → build view shows with live progress
- Compile stages tick through: VBSP → VVIS → VRAD → PACK
- Compile log streams in real-time (monospace scrolling area)
- On success: BSP + cfg paths shown, "Copy to TF2" works, "Open folder" reveals file in explorer
- On error: clear error message with expandable log
- Cancel button stops the compile mid-run
- A produced BSP opens in TF2 and all arenas work in MGEMod

### Files created/modified

- `src/mainview/lib/views/BuildView.svelte` (new)
- `src/mainview/lib/components/BuildProgress.svelte` (new)
- `src/mainview/lib/components/BuildResult.svelte` (new)
- `src/mainview/lib/views/ConfigView.svelte` (modified — Build button wired)
- `src/mainview/App.svelte` (modified — add "build" view)
- `src/mainview/lib/stores/build.svelte.ts` (modified — compile state tracking)
- `src/shared/rpc.ts` (modified — add openFolder request)
- `src/bun/index.ts` (modified — openFolder handler)

---

## Phase 6 — Polish and Packaging

### Goal

Production-ready packaging, settings persistence, validation, and UX polish.

### Tasks

1. **Settings persistence** — Store user preferences using Bun's file APIs:
   - Save to `Utils.paths.userData + "/settings.json"`:
     - TF2 install path
     - Last map name, skybox, lighting preset
     - Fast mode preference
   - Load on startup, write on change

2. **Input validation** — Enforce constraints in the UI:
   - Map name: lowercase alphanumeric + underscores, starts with `mge_`
   - Arena count: warn at >8, hard limit at ~12
   - Coordinate bounds: warn if layout would exceed ±14000

3. **App icon** — Create/copy app icon:
   - `.ico` for Windows
   - `icon.iconset/` for macOS (if targeting macOS later)
   - Configure in `electrobun.config.ts`

4. **Window title / about** — Set `title: "MGE Map Builder"`, show version from config

5. **Production build** — Configure `electrobun.config.ts` for distribution:
   - Ensure `arenas/` data is bundled correctly
   - Test `electrobun build` produces a working artifact
   - Test on a clean Windows machine if possible

6. **UX refinements**:
   - Tooltips on MGEMod config fields
   - Loading states throughout
   - Confirmation dialog before overwriting existing BSP (using `Utils.showMessageBox()`)
   - Keyboard shortcut for build (global shortcut via `GlobalShortcut`)

7. **Cleanup** — Remove any mock data, TODO placeholders, debug logging from previous phases

### Acceptance

- Settings persist across app restarts (TF2 path, last config)
- Validation prevents invalid map names, warns on high arena counts
- `electrobun build` produces a distributable artifact
- Built artifact runs on a clean Windows machine with TF2 installed
- Full end-to-end: launch app → select arenas → configure → build → copy to TF2 → play map

### Files created/modified

- `src/bun/services/settings.ts` (new — persistence logic)
- `src/bun/index.ts` (modified — load/save settings, additional RPC endpoints)
- `src/shared/rpc.ts` (modified — settings RPC endpoints)
- `electrobun.config.ts` (modified — icons, build copy rules)
- Various UI components (modified — validation, tooltips, loading states)

---

## File Structure After Migration

```
mge-map-builder-electrobun/
├── src/
│   ├── bun/                        # Main process (Bun runtime)
│   │   ├── index.ts                # Window creation + RPC handlers
│   │   └── services/
│   │       ├── tf2.ts
│   │       ├── arenas.ts
│   │       ├── layout.ts
│   │       ├── vmf.ts
│   │       ├── config.ts
│   │       ├── compiler.ts
│   │       ├── keyvalues.ts
│   │       └── settings.ts
│   ├── mainview/                   # Renderer (Svelte 5 + Vite)
│   │   ├── index.html
│   │   ├── main.ts
│   │   ├── app.css
│   │   ├── App.svelte
│   │   └── lib/
│   │       ├── utils.ts
│   │       ├── rpc.ts              # Browser-side RPC initialization
│   │       ├── stores/
│   │       │   ├── tf2.svelte.ts
│   │       │   ├── arenas.svelte.ts
│   │       │   └── build.svelte.ts
│   │       ├── views/
│   │       │   ├── ArenasView.svelte
│   │       │   ├── ConfigView.svelte
│   │       │   └── BuildView.svelte
│   │       └── components/
│   │           ├── Sidebar.svelte
│   │           ├── ArenaCard.svelte
│   │           ├── TF2Setup.svelte
│   │           ├── BuildProgress.svelte
│   │           ├── BuildResult.svelte
│   │           └── ui/             # shadcn-svelte primitives
│   │               ├── badge/
│   │               ├── button/
│   │               ├── card/
│   │               ├── input/
│   │               ├── label/
│   │               ├── separator/
│   │               └── switch/
│   └── shared/                     # Shared types (imported by both sides)
│       ├── types.ts                # ArenaPackage, BuildConfig, etc.
│       └── rpc.ts                  # RPC schema definition
├── arenas/                         # Bundled arena packages
│   ├── badlands_mid/
│   ├── badlands_spire/
│   ├── endif_open/
│   ├── granary_pro_mid/
│   ├── gullywash_mid/
│   └── product_mid/
├── docs/
│   ├── MIGRATION_PLAN.md
│   ├── SPEC.md
│   └── ARENA_GUIDELINES.md
├── electrobun.config.ts
├── vite.config.ts
├── svelte.config.js
├── tsconfig.json
├── components.json
├── package.json
├── llms.txt
└── README.md
```

---

## Phase Dependency Graph

```
Phase 1 (Scaffold)
    │
    ├──► Phase 2 (UI Components)
    │        │
    │        └──► Phase 4 (RPC Bridge) ──► Phase 5 (Build Pipeline)
    │                                              │
    ├──► Phase 3 (Services) ─────────────┘         │
    │                                              │
    └──────────────────────────────────────► Phase 6 (Polish)
```

Phases 2 and 3 can run **in parallel** since UI uses mock data and services are tested via console. They converge at Phase 4 (RPC Bridge), which wires them together.
