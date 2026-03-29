# Arena VMF Guidelines for Mappers

Guidelines for creating or improving arena VMFs compatible with MGE Map Builder. These are based on real issues encountered when compiling 49 existing arenas.

---

## Requirements (Must Follow)

### Build at Origin

Build your arena geometry centered around or near world origin `(0 0 0)`. The tool offsets each arena via `func_instance` origin, so your local coordinates become relative. Don't place your arena thousands of units away from origin — it wastes coordinate space.

### Seal Your Geometry

Every point entity in your VMF must be inside sealed (airtight) brushwork. If any entity is outside the sealed volume, VBSP reports a **leak** and VVIS cannot run, resulting in a fullbright map with no visibility optimization.

Common offenders found in existing arenas:
- `func_nobuild` brushes extending outside the arena walls
- `func_respawnroom` triggers placed beyond the playable area
- `func_respawnroomvisualizer` brushes outside the sealed volume
- Stray `info_player_teamspawn` entities floating in the void

**Test**: Compile your arena standalone. If VBSP outputs `**** leaked ****`, find and fix the leak.

### Do NOT Include `light_environment`

The master VMF injects a global `light_environment` automatically. If your arena includes one, the map may end up with multiple competing `light_environment` entities (only the last one processed wins, and the result is unpredictable).

Only 6 of 49 existing arenas included a `light_environment`. All others relied on the master map providing it. This is the correct approach.

**Exception**: If your arena is specifically designed for a unique lighting mood (e.g., night map), document this in your arena metadata so the tool can use your values instead of defaults.

### Do NOT Include `sky_camera` or 3D Skybox Geometry

`sky_camera` entities are placed far from the arena (typically at `8192 0 0`) and come with 3D skybox brush geometry around them. This causes two problems:

1. **Coordinate space waste** — the 3D skybox geometry can span 10,000+ units, colliding with other arenas
2. **Entity collisions** — the `sky_camera` at 8192 units offset can land inside another arena's brushwork, causing a fatal VBSP error

The master map will provide its own skybox configuration. Arenas with sky cameras (`propaganda_mid` at 30720x30720, `ultiduo_badlands` at 13824x9728) are essentially unusable in multi-arena maps.

### Do NOT Include `info_player_teamspawn`

MGE mod handles spawning entirely through its own plugin config. Spawn entities in the VMF are ignored by the plugin and just add clutter. Worse, they can leak if placed outside sealed geometry.

Spawn positions are defined in the map builder's arena metadata, not in the VMF.

### Keep Geometry Complexity Reasonable

Source BSP has a hard limit (`MAX_MAP_PLANES`) on total geometry complexity. A single complex arena can consume a large portion of this budget, limiting how many arenas fit in one map.

**Typical budget**: 8-12 arenas per map, depending on complexity. A simple box arena like `ammomod_circular` uses very little budget. A detailed arena like `process_second` (with 13 custom prop models and detailed brushwork) uses significantly more.

Recommendations:
- Use prop models (`prop_static`, `prop_dynamic`) for visual detail instead of complex brushwork
- Use `func_detail` for non-structural brushes (pillars, trim, railings) — these don't split the BSP tree
- Avoid excessive displacement surfaces
- Avoid tiny brush faces and micro-geometry

---

## Recommendations (Should Follow)

### Use Stock TF2 Materials

Arenas that use only stock TF2 materials work out of the box — no asset bundling, no extraction, no packing. This is the path of least resistance.

**40 of 49 existing arenas are stock-only.** They compile cleanly and render correctly on any TF2 install.

If you must use custom materials or models, see the Custom Assets section below.

### Remove Areaportals

`func_areaportal` brushes are used in full maps to optimize rendering between rooms. In instanced arenas, they frequently cause warnings:

```
Areaportal brush doesn't touch two areas
```

These warnings are mostly harmless but add noise. Areaportals designed for the original map's room layout rarely make sense in a standalone instanced arena. Remove them unless your arena genuinely has distinct sealed rooms connected by doorways.

### Remove Soundscapes

`env_soundscape` entities reference soundscape definitions that may not exist in the target map. They won't cause compile failures but will spam console errors in-game. Remove them or document which soundscape pack they require.

### Remove Color Correction and Tonemap Controllers

`color_correction` and `env_tonemap_controller` entities are global post-processing effects. Like `light_environment`, these should be controlled by the master map, not individual arenas. Multiple competing tonemap controllers produce unpredictable visual results.

### Use `func_detail` Generously

Any brush that isn't structural (doesn't seal the map or block visibility) should be `func_detail`. This includes:
- Pillars, columns, beams
- Trim and molding
- Railings and fences
- Small decorative geometry
- Steps and stairs (unless they're part of the outer shell)

`func_detail` brushes don't create BSP splits, significantly reducing geometry complexity and compile time.

### Provide Adequate Ceiling / Sky Brushes

Your arena must be sealed — this means a ceiling or sky brush on top. Use `tools/toolsskybox` for open-air arenas. Make sure the skybox brush fully encloses the playable space with no gaps, including above any tall props or jump peaks.

### Keep the Arena Self-Contained

Your arena should be a complete, isolated unit. It should not depend on:
- Geometry from a parent map
- Entities defined elsewhere
- Specific world origin assumptions (other than being near 0,0,0)

Think of it as a building block that gets placed at an arbitrary position in a larger map.

---

## Custom Assets

### When Custom Assets Are Unavoidable

If your arena requires custom models or materials:

1. **Use a unique prefix** for all custom content paths (e.g., `models/mymgearena/`, `materials/mymgearena/`). This prevents naming collisions with other arenas or game content.

2. **Bundle all required files** alongside the VMF:
   - Models: `.mdl`, `.vvd`, `.vtx` variants (`.dx90.vtx`, `.dx80.vtx`, `.sw.vtx`), `.phy`
   - Materials: `.vmt` files
   - Textures: `.vtf` files referenced by the VMTs

3. **Document dependencies** in your arena metadata — list every custom asset path so the build tool knows what to pack.

4. **Prefer referencing stock TF2 textures in your VMTs**. If your custom model's material uses `$basetexture` pointing to a stock TF2 texture (e.g., `metal/metalwall048a`), no VTF needs bundling. Only bundle VTFs for truly custom textures.

5. **Do NOT reference assets from other community maps** (e.g., `kalinka/`, `onsen/`, `pl_temple/` prefixed materials). These are not available in stock TF2 and would need extraction from the original map's BSP — a legal and logistical headache. Recreate the look using stock TF2 materials or create your own.

### Existing Problem Arenas

These arenas reference materials from community maps that don't exist in stock TF2:

| Material Prefix | Source Map | Affected Arenas |
|----------------|------------|-----------------|
| `kalinka/` | cp_kalinka | kalinka_mid |
| `onsen/` | cp_onsen | several |
| `pl_temple/` | pl_temple | temple_knockout, temple_koth |
| `shivertextures/` | unknown | various |
| `metal/metalwall_sheet*` | various | multiple arenas |

These arenas compile with missing texture warnings and render with the pink-black checkerboard in-game.

---

## Testing Your Arena

Before submitting an arena, verify:

1. **Compile standalone** — Create a minimal VMF with just your arena as a `func_instance`, a `light_environment`, and worldspawn with a skybox. Compile with VBSP/VVIS/VRAD. Fix any leaks or errors.

2. **No leak** — VBSP should NOT output `**** leaked ****`.

3. **No `sky_camera`** — Grep your VMF for `sky_camera`. Remove it and any 3D skybox geometry.

4. **No `light_environment`** — Grep your VMF. Remove it (the master map provides one).

5. **No `info_player_teamspawn`** — Remove spawn entities.

6. **Measure your bounding box** — Check the min/max coordinates of your brush geometry. Ideally the arena fits within ~5000x5000 units in X/Y. Larger arenas eat more coordinate space and limit how many can fit in one map.

7. **Check custom asset references** — Grep for any non-stock material/model paths. Document them or replace with stock equivalents.

8. **Load in-game** — Verify textures render correctly, no pink checkerboards, no missing models (ERROR signs), lighting looks reasonable.

---

## Quick Reference

| Aspect | Do | Don't |
|--------|-----|-------|
| Origin | Build near `(0, 0, 0)` | Place arena at random large coordinates |
| Sealing | Ensure all entities are inside sealed brushwork | Leave entities floating in the void |
| Lighting | Use `light_spot` / `light` for local detail | Include `light_environment` |
| Skybox | Use `tools/toolsskybox` ceiling | Include `sky_camera` or 3D skybox geometry |
| Spawns | Define in arena metadata | Include `info_player_teamspawn` entities |
| Detail | Use `func_detail` for non-structural brushes | Make everything structural |
| Materials | Use stock TF2 materials | Reference community map textures |
| Props | Use `prop_static` for detail geometry | Build complex detail from brushes |
| Complexity | Keep reasonable brush count | Use excessive displacements or micro-geometry |
| Areaportals | Remove them | Leave orphaned areaportals |
