# Province-Based Web Vertical Slice Implementation Plan

This plan describes the current direction for the South Caucasus grand strategy prototype. The game uses TypeScript, React, and plain Three.js, with a province-based GLB map. The visible map and gameplay geography come from `public/data/maps/Map.glb`; province meshes are the selectable/movable/capturable territories.

## 1. Technical Direction

- **Application:** Vite + TypeScript + React.
- **3D renderer:** Plain Three.js.
- **UI:** React overlay panels.
- **State:** A small custom store or Zustand later.
- **Map source:** `Map.glb`.
- **Unit source:** `Unit_A.glb` for the first reusable unit model.
- **Camera:** Fixed 2.5D orthographic camera with pan and zoom only.
- **Gameplay geography:** Province meshes, not generated square grids.
- **Playable test country:** Azerbaijan.
- **Opponent for first prototype:** Armenia.

## 2. Architecture

Separate the project into four layers.

```text
React UI Layer
  reads selected province/unit state and displays panels

Game Simulation Layer
  owns provinces, countries, units, movement, control, future combat, supply, economy, diplomacy

Three.js Rendering Layer
  displays GLB map, province colors/borders, units, route lines, selection highlights, camera

Data/Asset Layer
  GLB assets, generated province metadata, country definitions, unit definitions, future save data
```

Rules:

- Simulation state must not depend on React.
- Renderer reads simulation state and updates Three.js objects.
- React reads view-model state and sends commands.
- Game commands mutate state through controlled systems.

## 3. Project Structure

```text
public/
  data/
    maps/
      Map.glb
      Unit_A.glb
    countries/
      countries.json
    units/
      starting_units.json

src/
  game/
    province/
      provinceTypes.ts
      ProvinceState.ts
    movement/
      ProvincePathfindingSystem.ts
    units/
      UnitTypes.ts
      UnitManager.ts
    combat/
      CombatSystem.ts
    economy/
      EconomySystem.ts
    diplomacy/
      DiplomacySystem.ts
  rendering/
    ProvinceMapRenderer.ts
    UnitModelFactory.ts
    StrategyPrototype.ts
  ui/
    panels/
```

## 4. Province Map Model

`Map.glb` is the source of truth for province shapes.

Province mesh naming:

- Names starting with `AZ` are Azerbaijan provinces.
- Names starting with `AM` are Armenia provinces.
- Duplicate export suffixes such as `_mesh` and `.001` are ignored when choosing the canonical province mesh.

Each province stores:

```text
id
name
countryId
ownerCountryId
controllerCountryId
mesh
centerWorld
bounds
neighbors
units
```

Definitions:

- **countryId:** Original country from the GLB mesh prefix.
- **ownerCountryId:** Legal owner, changed later by peace deals.
- **controllerCountryId:** Military controller, changed during movement/capture.
- **neighbors:** Connected province IDs used for movement and future supply.

## 5. Province Rendering

Province rendering rules:

- Render one canonical mesh per province.
- Tint province material by `controllerCountryId`.
- Draw province boundaries with edge geometry or future outline passes.
- Highlight selected province with emissive tint.
- Use GLB mesh raycasting for province selection.
- Do not render generated artificial map cells.

The renderer must expose:

```text
getPickMeshes()
updateProvinceColor(province)
setSelectedProvince(province | null)
refreshAllProvinceColors(provinces)
```

## 6. Province Graph Movement

Movement uses graph-based A*.

Inputs:

- start province
- target province
- province neighbors
- world-space province centers
- movement cost modifiers later

First prototype rules:

- Units can move across any connected province.
- Capturing is instant when a unit enters an enemy-controlled province.
- Armenia is passive.
- Azerbaijan is player-controlled.

Later rules:

- Enemy entry requires war.
- Defender presence starts combat.
- Terrain, roads, supply, and infrastructure affect movement cost.

## 7. Units

The first unit model comes from `Unit_A.glb`.

Rules:

- Clone only the `Unit_A` object from the GLB.
- Ignore province meshes embedded in the unit GLB.
- Spawn 5 Azerbaijan units.
- Spawn 5 Armenia units.
- Units sit at province centers.
- Left-click selects a unit.
- Right-click province gives a movement order.
- Units follow a province-center route.

Each unit stores:

```text
id
name
countryId
provinceId
routeProvinceIds
speed
strength
organization
```

## 8. Prototype Gameplay Scope

The first test prototype must support:

- Render `Map.glb` as a province map.
- Load Azerbaijan and Armenia provinces by mesh prefix.
- Show political/controller colors.
- Show province borders.
- Select province and view owner/controller.
- Select unit and issue movement order.
- Move units through province graph.
- Instantly capture provinces on arrival.
- Update province color and HUD after capture.

Out of scope for this pass:

- Full combat resolution.
- Economy screens.
- Diplomacy screens.
- Save/load.
- AI movement.
- Supply calculations.
- Production and division designer.

## 9. Later Systems

After the province prototype works:

- Add combat when opposing units occupy/enter the same province.
- Add province terrain and movement-cost metadata.
- Add supply hubs and capital-based supply paths over the province graph.
- Add economy resources and buildings per province.
- Add diplomatic war states.
- Add Armenian defensive AI.
- Add save/load using province and unit state snapshots.

## 10. Acceptance Criteria

The province prototype is complete when:

- `Map.glb` loads in browser.
- Around 77 Azerbaijan provinces and 11 Armenia provinces are detected.
- Province meshes are selectable.
- Province colors reflect controller state.
- Province borders are visible.
- `Unit_A.glb` provides the rendered unit model.
- 5 Azerbaijan and 5 Armenia units spawn.
- Player can select Azerbaijan units and move them.
- Movement follows province adjacency.
- Entered enemy provinces change controller.
- HUD shows selected province owner/controller and selected unit data.
- `npm.cmd run build` and `npm.cmd run lint` pass.
