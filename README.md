# MGE Map Builder

Desktop app for building custom TF2 MGE maps. Select prefab arenas, configure settings, and get a ready-to-use BSP + MGEMod spawn config — no Hammer or command-line knowledge needed.

## Requirements

- Windows
- [TF2](https://store.steampowered.com/app/440/Team_Fortress_2/) installed (needs VBSP/VVIS/VRAD compile tools)
- [Bun](https://bun.sh)

## Development

```
bun install
bun run start
```

## How it works

1. Pick arenas and how many instances of each
2. Set map name, skybox, lighting
3. Hit Build — the app generates a VMF with `func_instance` references, runs VBSP/VVIS/VRAD, packs custom assets, and writes the MGEMod `SpawnConfigs` cfg
4. Copy the BSP + cfg to your server

## Tech

Electron + SvelteKit + Tailwind. Backend services in `electron/services/`, arena packages in `arenas/`.
