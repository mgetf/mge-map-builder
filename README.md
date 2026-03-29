# MGE Map Builder

A desktop app for building custom [TF2](https://store.steampowered.com/app/440/Team_Fortress_2/) MGE maps. Select prefab arenas, configure layout and lighting, and compile a ready-to-play BSP + spawn config — no Hammer experience required.

## What it does

MGE (My Gaming Edge) is a popular 1v1 training mod for Team Fortress 2. Each MGE map contains multiple arenas built from competitive map geometry (Badlands mid, Gullywash mid, etc.). This tool automates the entire process of creating those maps:

1. **Pick arenas** from a library of prefab packages
2. **Configure** the map name, skybox, and lighting
3. **Build** — the app generates the VMF, runs the Source SDK compile tools (VBSP → VVIS → VRAD → bspzip), and outputs a finished `.bsp` with a matching spawn config

## Bundled arenas

Ships with the 6 most played MGE arenas:

| Arena | Source |
|-------|--------|
| Badlands Middle | cp_badlands |
| Badlands Spire | cp_badlands |
| Granary Pro Middle | cp_granary_pro |
| Product Middle | koth_product |
| Gullywash Middle | cp_gullywash |
| Endif | endif |

## Requirements

- **Windows** (macOS and Linux support planned)
- **TF2 installed** — the compile pipeline uses TF2's Source SDK tools (`vbsp.exe`, `vvis.exe`, `vrad.exe`, `bspzip.exe`) and resolves stock materials from TF2's VPK archives

The app auto-detects your TF2 installation. If it can't find it, you'll be prompted to locate it manually.

## Installation

Download the latest installer from the [Releases](../../releases) page and run the setup.

## Development

Built with [Electrobun](https://electrobun.dev), [Svelte 5](https://svelte.dev), [Tailwind CSS](https://tailwindcss.com), and [Bun](https://bun.sh).

```bash
# Install dependencies
bun install

# Run in dev mode
bun start

# Dev with hot module replacement
bun run dev:hmr

# Build installer (canary)
bun run build:canary

# Build installer (stable)
bun run build:stable
```

### Project structure

```
src/
  bun/              Main process (Electrobun/Bun) — window management, compile pipeline
  mainview/         UI (Svelte 5) — arena selection, config, build progress
  shared/           Shared types and utilities
arenas/             Bundled arena packages (VMF + meta.json + optional assets)
assets/             Application assets (icon)
electrobun.config.ts
vite.config.ts
```

### Arena package format

Each arena is a self-contained folder:

```
badlands_mid/
  area_badlands_mid.vmf     Arena geometry
  meta.json                 Name, description, spawn positions
  assets/                   Custom models/materials (if any)
```

See [`docs/ARENA_GUIDELINES.md`](docs/ARENA_GUIDELINES.md) for authoring details.