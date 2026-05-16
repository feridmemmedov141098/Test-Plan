# Web Vertical Slice Implementation Plan

This plan describes how to implement the grand strategy vertical slice as a reliable web game using TypeScript, React, and plain Three.js, with a data-driven voxel map, primitive placeholder shapes, and an organized asset structure that can later swap primitives for realistic 3D models.

## 1. Final Technical Direction

Use a web-first architecture instead of a game engine.

- **Application:** Vite + TypeScript + React.
- **3D renderer:** Plain Three.js controlled from TypeScript.
- **UI:** React components.
- **State management:** Zustand or a small custom store.
- **Styling:** CSS modules or TailwindCSS.
- **Data format:** JSON first, later optional image-map importer or map editor.
- **Target:** Browser vertical slice first; desktop packaging with Tauri/Electron later if needed.
- **Camera:** Fixed 2.5D camera with pan and zoom only.
- **Map:** Voxel-style square cell grid, not a fully destructible voxel sandbox.
- **Scenario:** Azerbaijan playable; Armenia, Georgia, Russia, Iran as AI; Caspian Sea water cells east of Azerbaijan.

## 2. Why Use Plain Three.js Instead of React Three Fiber

Use **plain Three.js + React** for the first implementation.

Reason:

- **More reliable for custom strategy maps:** Map rendering, instancing, picking, overlays, and camera control are easier to reason about directly.
- **Cleaner separation:** React handles UI; Three.js handles only the 3D map.
- **Better performance control:** Direct access to `InstancedMesh`, raycasting, materials, geometry, render loops, and disposal.
- **Easier AI-assisted debugging:** Fewer abstraction layers than React Three Fiber.
- **Future model swapping remains simple:** A dedicated asset/model registry can choose primitive placeholders now and GLTF models later.

React Three Fiber can be reconsidered later, but the vertical slice should prioritize clarity and control.

## 3. High-Level Architecture

Separate the game into four layers.

```text
React UI Layer
  reads game state and dispatches commands

Game Simulation Layer
  owns countries, cells, units, economy, diplomacy, combat, supply, AI

Three.js Rendering Layer
  displays map, units, markers, overlays, selection, camera

Data/Asset Layer
  JSON game data, primitive definitions, future 3D models, icons, materials
```

Rules:

- **Simulation must not depend on Three.js or React.**
- **Renderer reads simulation state and renders it.**
- **React UI reads simulation state and sends commands.**
- **Game commands mutate state through controlled systems, not random component logic.**

## 4. Recommended Project Structure

Create a structure that supports future realistic 3D models.

```text
project-root/
  package.json
  vite.config.ts
  tsconfig.json
  index.html
  public/
    data/
      countries/
        countries.json
      maps/
        south_caucasus_test_map.json
        terrain.json
        resources.json
      units/
        battalions.json
        division_templates.json
        starting_units.json
        generals.json
      economy/
        production_items.json
      diplomacy/
        starting_relations.json
    assets/
      models/
        primitives/
          cells/
          units/
          markers/
          buildings/
        gltf/
          cells/
          units/
          markers/
          buildings/
        textures/
          terrain/
          countries/
          ui/
        icons/
          resources/
          units/
          diplomacy/
          overlays/
  src/
    main.tsx
    App.tsx
    styles/
      globals.css
      theme.css
    game/
      core/
        GameApp.ts
        GameLoop.ts
        GameClock.ts
        GameCommandBus.ts
        GameEvents.ts
        GameConfig.ts
      state/
        gameStore.ts
        selectors.ts
        snapshots.ts
      data/
        loaders/
        schemas/
        validators/
        generated/
      map/
        WorldMap.ts
        VoxelCell.ts
        TerrainTypes.ts
        MapQueries.ts
        MapGenerator.ts
        BorderCalculator.ts
      countries/
        Country.ts
        CountryManager.ts
        ResourceStockpile.ts
        CountryTypes.ts
      units/
        Division.ts
        Army.ts
        General.ts
        DivisionTemplate.ts
        Battalion.ts
        UnitManager.ts
      movement/
        PathfindingSystem.ts
        MovementSystem.ts
        MovementOrder.ts
        MovementCost.ts
      supply/
        SupplySystem.ts
        SupplySource.ts
        SupplyGraph.ts
        Encirclement.ts
      combat/
        CombatSystem.ts
        Battle.ts
        BattleResolver.ts
        CombatModifiers.ts
      economy/
        EconomySystem.ts
        ProductionSystem.ts
        ConstructionSystem.ts
      diplomacy/
        DiplomacySystem.ts
        Relation.ts
        War.ts
        Treaty.ts
        TradeDeal.ts
      ai/
        AISystem.ts
        DefensiveAI.ts
        AIState.ts
        AIThreatMap.ts
      save/
        SaveService.ts
        SaveTypes.ts
        LocalStorageAdapter.ts
    rendering/
      engine/
        ThreeApp.ts
        SceneManager.ts
        RenderLoop.ts
        ResizeSystem.ts
        Disposal.ts
      camera/
        StrategyCamera.ts
        CameraInput.ts
      map/
        VoxelMapRenderer.ts
        CellInstancedRenderer.ts
        TerrainMaterialFactory.ts
        CountryColorLayer.ts
        BorderRenderer.ts
        OverlayRenderer.ts
        SelectionRenderer.ts
      units/
        UnitRenderer.ts
        UnitPrimitiveFactory.ts
        UnitModelFactory.ts
        UnitLabelRenderer.ts
      markers/
        MarkerRenderer.ts
        MarkerPrimitiveFactory.ts
        MarkerModelFactory.ts
      picking/
        PickingSystem.ts
        RaycastPicker.ts
        GridCoordinatePicker.ts
      assets/
        AssetRegistry.ts
        ModelRegistry.ts
        PrimitiveRegistry.ts
        MaterialRegistry.ts
        TextureRegistry.ts
    ui/
      layout/
        GameLayout.tsx
        TopBar.tsx
        LeftPanel.tsx
        RightPanel.tsx
        BottomBar.tsx
      panels/
        CountryOverviewPanel.tsx
        SelectedCellPanel.tsx
        UnitPanel.tsx
        ArmyPanel.tsx
        DiplomacyPanel.tsx
        TradePanel.tsx
        ProductionPanel.tsx
        ResearchPanel.tsx
        WarSummaryPanel.tsx
      controls/
        Button.tsx
        Tabs.tsx
        StatRow.tsx
        ProgressBar.tsx
        ResourceBadge.tsx
      overlays/
        OverlayToolbar.tsx
        TimeControls.tsx
    types/
      ids.ts
      common.ts
    utils/
      math.ts
      grid.ts
      color.ts
      priorityQueue.ts
```

## 5. Dependency Choices

Use a small reliable dependency set.

Required:

- **vite:** Project/dev server/build tool.
- **typescript:** Strong typing for large simulation systems.
- **react/react-dom:** UI framework.
- **three:** 3D rendering.

Recommended:

- **zustand:** Lightweight global state store.
- **zod:** Runtime validation for JSON data files.
- **nanoid:** Stable ID generation if needed.

Optional later:

- **@tweenjs/tween.js:** Smooth unit/camera animation.
- **dexie:** IndexedDB saves if localStorage becomes too small.
- **three/examples GLTFLoader:** Future realistic model loading.
- **Tauri/Electron:** Desktop packaging after browser vertical slice works.

Avoid at first:

- Physics engines.
- Multiplayer libraries.
- Heavy ECS frameworks.
- Raw WebGL.
- Complex terrain engines.

## 6. Core Data Models

### 6.1 Stable IDs

Use string IDs everywhere.

```text
CountryId = "azerbaijan" | "armenia" | "georgia" | "russia" | "iran"
CellId = "cell_x_y"
DivisionId = "division_001"
TemplateId = "infantry_basic"
GeneralId = "general_azerbaijan_001"
```

### 6.2 Voxel Cell

Each map cell should contain gameplay data only.

```text
id
x
y
elevation
terrainType
ownerCountryId
controllerCountryId
stateId
isPassable
movementCost
infrastructureLevel
supplyValue
hasRoad
hasCity
hasCapital
hasSupplyHub
hasFort
resourceType
resourceAmount
victoryValue
resistanceLevel
```

Rendering data such as mesh/material references should not be stored in `VoxelCell`.

### 6.3 Country

Country model:

```text
id
name
color
capitalCellId
isPlayable
aiProfile
resources
factories
laws
relations
wars
stability
warSupport
politicalPower
```

Initial countries:

- **Azerbaijan:** Player country, oil/resources near Baku, moderate army.
- **Armenia:** Defensive mountain AI.
- **Georgia:** Defensive/trade AI with mountain passes.
- **Russia:** Strong northern defensive AI.
- **Iran:** Southern defensive AI with manpower/resource potential.

### 6.4 Division

Division model:

```text
id
countryId
currentCellId
targetCellId optional
path CellId[]
templateId
generalId optional
strength
organization
morale
supplyStatus
movementProgress
isMoving
isInCombat
```

### 6.5 Asset Model Metadata

Every visible object should be referenced through an asset key, not hardcoded geometry.

```text
assetKey: "unit.infantry.placeholder"
assetType: "primitive" | "gltf"
category: "unit" | "cell" | "marker" | "building"
```

This allows replacing primitive shapes with realistic 3D models later.

## 7. Primitive-to-Model Replacement Strategy

Use primitives first, but organize them like real assets from day one.

### 7.1 Asset Registry

Create an `AssetRegistry` that resolves visual assets.

```text
request: "unit.infantry"
current result: primitive soldier/counter shape
future result: GLTF infantry model
```

Do not let gameplay systems know whether a unit is a cube, cone, cylinder, or GLTF model.

### 7.2 Primitive Categories

Use primitive placeholders:

#### Map cells

- **Plains:** Low box, green material.
- **Hills:** Medium raised box, olive/brown material.
- **Mountains:** Taller box or cone-like stacked shape, gray/brown material.
- **Forest:** Green box plus simple cone/tree markers.
- **Urban:** Box base plus small building cubes.
- **Water:** Flat blue plane/low box.
- **Road:** Thin dark strip overlay across cell.

#### Units

- **Infantry division:** Rectangular base + small upright box/cylinder.
- **Motorized division:** Rectangular base + small truck-like box.
- **Tank division:** Rectangular base + low tank-like box + barrel cylinder.
- **Artillery division:** Rectangular base + small cannon-like cylinder.
- **Mountain division:** Infantry marker with mountain icon/color.

#### Markers

- **City:** Cluster of small boxes.
- **Capital:** City marker plus star/crown icon.
- **Supply hub:** Cylinder/tower marker.
- **Fort:** Low wall blocks.
- **Resource:** Icon billboard or colored small sphere.
- **Victory point:** Flag or star marker.

### 7.3 Future Model Folders

Prepare future GLTF paths now:

```text
public/assets/models/gltf/units/infantry_division.glb
public/assets/models/gltf/units/tank_division.glb
public/assets/models/gltf/markers/city.glb
public/assets/models/gltf/buildings/supply_hub.glb
```

The code should only change inside `ModelRegistry` or `AssetRegistry` when switching from primitives to GLTF.

## 8. Voxel Map Rendering Plan

### 8.1 Start Small

First map:

- **30 x 20 cells** for fast debugging.
- Caspian Sea as right/eastern water strip.
- Azerbaijan central/east.
- Armenia west/southwest.
- Georgia northwest.
- Russia north.
- Iran south.

Then expand:

- **80 x 60 cells** for vertical slice.
- **120 x 80+** only after renderer and pathfinding are stable.

### 8.2 Use InstancedMesh for Cells

Use `THREE.InstancedMesh` for map cells.

Reason:

- Thousands of cells can render efficiently.
- Same geometry can be drawn many times.
- Per-instance transforms store position/elevation.
- Per-instance colors can show country or terrain.

Recommended early approach:

- One `InstancedMesh` per terrain type.
- Cell geometry is a box/prism.
- Instance color can represent owner/controller overlay.
- Maintain a mapping from `instanceId` to `cellId`.

Example mapping concept:

```text
cellInstanceLookup[terrainType][instanceId] = cellId
cellRenderLookup[cellId] = { mesh, instanceId }
```

### 8.3 Cell Dimensions

Use predictable dimensions.

```text
CELL_SIZE = 1
CELL_GAP = 0.02
HEIGHT_SCALE = 0.18
```

World position:

```text
worldX = x * CELL_SIZE
worldZ = y * CELL_SIZE
worldY = elevation * HEIGHT_SCALE
```

### 8.4 Terrain Height

Suggested default elevation:

- **Water:** 0
- **Plains:** 1
- **Forest:** 1
- **Urban:** 1
- **Hills:** 2
- **Mountains:** 4

### 8.5 Ownership Colors

Use country colors for political readability:

- Azerbaijan: blue/teal.
- Armenia: red/orange.
- Georgia: white/red accent or beige.
- Russia: gray/dark blue.
- Iran: green.
- Water: blue.

First version can color cells mainly by controller. Terrain can be represented by height and icons.

Later add overlays:

- terrain overlay
- political ownership overlay
- controller/frontline overlay
- supply overlay
- diplomacy overlay

## 9. Cell Selection and Picking

Use raycasting against the map meshes for the first version.

Flow:

```text
mouse down -> normalized device coords -> raycaster -> intersect InstancedMesh -> instanceId -> cellId -> select cell
```

Requirements:

- Each terrain `InstancedMesh` must keep `instanceId -> cellId` mapping.
- Selection state stores `selectedCellId`.
- `SelectionRenderer` draws a highlight frame/outline over selected cell.
- React `SelectedCellPanel` displays selected cell data.

Later optimization:

- Convert mouse position to grid coordinate directly if raycasting becomes expensive.

## 10. Camera System

Use a fixed strategic camera.

Rules:

- Orthographic camera is recommended for strategy readability.
- Perspective camera can be tested, but orthographic is more reliable for UI-heavy strategy.
- Camera rotation is fixed.
- Player can pan and zoom only.

Recommended:

```text
Camera type: OrthographicCamera
Rotation: fixed isometric-like angle
Controls: custom pan/zoom, not OrbitControls rotation
```

Controls:

- **WASD:** Pan.
- **Middle mouse drag:** Pan.
- **Mouse wheel:** Zoom.
- **Left click:** Select cell/unit.
- **Right click:** Move selected unit.
- **Escape:** Clear selection.

Camera constraints:

- Clamp pan inside map bounds.
- Clamp zoom min/max.
- Disable rotation entirely.

## 11. React UI Plan

React should own all management screens.

Required UI panels:

- **Top bar:** Date, speed, money, manpower, political power, major alerts.
- **Left panel:** Selected country overview or selected cell information.
- **Right panel:** Context actions, selected unit, army/general details.
- **Bottom bar:** Time controls, map overlays, messages.
- **Modal screens:** Production, diplomacy, trade, research, division designer.

Initial UI screens:

- `SelectedCellPanel`
- `CountryOverviewPanel`
- `UnitPanel`
- `DiplomacyPanel`
- `ProductionPanel`
- `WarSummaryPanel`

UI should use selectors from the state store and dispatch commands rather than directly editing game objects.

## 12. Game State and Command Pattern

Use commands to mutate game state.

Examples:

```text
SelectCellCommand
SelectUnitCommand
MoveUnitCommand
DeclareWarCommand
StartProductionCommand
AssignGeneralCommand
ChangeOverlayCommand
SetGameSpeedCommand
```

Benefits:

- Easier debugging.
- Easier save/load.
- Easier AI integration.
- Future multiplayer or replay support becomes possible.

State store should contain:

```text
gameState
selectedCellId
selectedDivisionId
activeCountryId
activeOverlay
timeSpeed
isPaused
uiPanelState
```

## 13. Data Files

### 13.1 countries.json

Create data for:

- Azerbaijan
- Armenia
- Georgia
- Russia
- Iran

Each country should include:

```text
id
name
color
capitalCellId
isPlayable
aiProfile
startingResources
startingFactories
stability
warSupport
politicalPower
```

### 13.2 terrain.json

Terrain fields:

```text
id
name
movementCost
attackModifier
defenseModifier
supplyModifier
isPassable
defaultElevation
primitiveAssetKey
materialKey
```

### 13.3 map_cells.json

Start with generated or hand-authored test map.

Cell fields:

```text
id
x
y
elevation
terrainType
ownerCountryId
controllerCountryId
isPassable
hasRoad
hasCity
hasCapital
hasSupplyHub
hasFort
resourceType
resourceAmount
victoryValue
infrastructureLevel
supplyValue
```

### 13.4 starting_units.json

Unit fields:

```text
id
countryId
cellId
templateId
generalId
strength
organization
```

### 13.5 division_templates.json

Template fields:

```text
id
name
battalions
supportCompanies
baseStats
assetKey
```

## 14. Map Generation Methods

### 14.1 First Version: Programmatic Generator

Use a simple TypeScript map generator to produce `map_cells.json`.

Rules:

- Rightmost columns are Caspian Sea water.
- Central/eastern land is Azerbaijan.
- West/southwest is Armenia with mountains.
- Northwest is Georgia with hills/mountains.
- North is Russia.
- South is Iran.
- Baku is near the Caspian coast.
- Main roads connect capitals and borders.

This is reliable for early development.

### 14.2 Second Version: JSON Editing

After the game works, manually improve map data.

Add:

- cities
- road routes
- supply hubs
- resource areas
- strategic passes
- victory cells

### 14.3 Later Version: Image Importer

Use color-coded images:

- `country_map.png`: pixel color -> country.
- `terrain_map.png`: pixel color -> terrain.
- `height_map.png`: brightness -> elevation.
- `roads_map.png`: pixel/line -> roads.

This is high effort; keep it for later.

## 15. Movement and Pathfinding

Use grid-based A* pathfinding.

Inputs:

- start cell
- target cell
- passability
- terrain movement cost
- road modifier
- elevation cost
- enemy control rules
- water blocking

First version rules:

- Land units cannot enter water.
- Units can move through friendly or neutral cells.
- Units can enter enemy cells only if at war.
- Roads reduce movement cost.
- Mountains and swamps increase movement cost.

Keep pathfinding independent from rendering.

## 16. Supply and Encirclement

Use breadth-first search/flood fill from supply sources.

Supply sources:

- capital cell
- city cell
- supply hub cell
- future port cell

Algorithm:

1. For each country, collect supply source cells.
2. Flood fill through friendly-controlled passable land cells.
3. Roads and infrastructure increase effective supply range/capacity.
4. Enemy-controlled cells block supply.
5. Water blocks land supply.
6. Mark reachable cells as supplied.
7. Units outside supplied cells become encircled.

First version penalties:

- no reinforcement
- organization recovery reduced
- combat penalty
- movement penalty after delay

Keep this simple first; advanced supply capacity and logistics can be added later.

## 17. Combat and Cell Capture

First combat should be deterministic and readable.

Battle trigger:

- selected unit attacks adjacent enemy-controlled cell
- countries must be at war
- if defender exists, battle starts
- if no defender exists, cell is captured after movement

Basic formula inputs:

- attacker soft/hard attack
- defender defense
- terrain modifiers
- fort/city modifiers
- supply/encirclement modifiers
- general modifiers later
- attack direction bonus later

Outcome:

- organization decreases first
- strength/equipment decreases slowly
- losing unit retreats if possible
- winner controls cell
- renderer updates ownership/control colors
- supply recalculates after control changes

## 18. Units, Armies, and Generals

### 18.1 Unit Visuals

Use organized primitive unit markers.

Each unit visual should include:

- base plate colored by country
- unit-type primitive shape
- small strength/organization label
- selected outline
- encirclement warning indicator

### 18.2 Asset Replacement

The unit renderer should ask `UnitModelFactory` for a visual.

```text
UnitRenderer -> UnitModelFactory -> AssetRegistry -> primitive now / GLTF later
```

This keeps future realistic models isolated from game logic.

### 18.3 Generals

First version:

- generals are data records
- divisions can store `generalId`
- general gives small attack/defense/logistics modifier

UI later:

- general portrait placeholder
- assigned divisions list
- command capacity

## 19. Economy Prototype

First economy should be simple.

Daily tick:

- controlled cells generate resources
- factories produce equipment
- manpower changes slowly
- political power increases

Resources:

- money
- manpower
- food
- steel
- oil
- fuel
- rare metals
- political power

Production:

- production line has equipment type and assigned factories
- output added to stockpile daily
- missing resources reduce output

Do not build full HOI-style economy before map/movement/combat works.

## 20. Diplomacy Prototype

First diplomacy:

- relation score between countries
- at war / at peace state
- declare war action
- simple peace/capitulation
- trade placeholder

Rules:

- combat only allowed between countries at war
- AI countries do not declare offensive wars in vertical slice
- declaring war increases threat/alert state

## 21. Defensive AI

Use a simple state machine.

States:

- peaceful
- suspicious
- defensiveWar
- counterattack
- collapse

AI priorities:

- defend capital
- defend city/victory cells
- defend supply hubs
- place units on threatened border cells
- avoid deep attacks
- counterattack only weak/isolated enemy cells

Implementation approach:

- build a threat map from enemy-controlled adjacent cells
- score friendly cells by importance
- move divisions toward highest score defensible cells

This is high effort; keep first version defensive and predictable.

## 22. Save and Load

Use JSON serialization first.

Save:

- date/time
- countries
- cells owner/controller and buildings
- divisions
- wars
- production
- diplomacy
- AI states

Storage:

- use `localStorage` for very early saves
- move to IndexedDB later if save files become large

## 23. Rendering Performance Rules

Use reliable performance practices from the beginning.

- Use `InstancedMesh` for map cells.
- Avoid creating one React component per voxel cell.
- Avoid one Three.js mesh per cell beyond tiny prototypes.
- Dispose geometries/materials when rebuilding.
- Rebuild map instances only when map shape changes.
- For ownership/control changes, update instance colors rather than rebuilding all meshes.
- Recalculate supply only after relevant changes, not every frame.
- Run AI on ticks, not every animation frame.
- Keep the render loop separate from simulation ticks.

## 24. First Implementation Milestones

### Milestone 1: Web Project Setup

Create Vite React TypeScript project and install dependencies.

Done when:

- app runs in browser
- blank UI loads
- Three.js canvas is mounted

### Milestone 2: Three.js Scene and Camera

Add `ThreeApp`, scene, renderer, orthographic fixed camera, pan/zoom controls.

Done when:

- camera pans/zooms over empty scene
- rotation is impossible

### Milestone 3: Data Models and JSON Loading

Create TS types and JSON loaders for countries, terrain, and a 30x20 map.

Done when:

- data loads and validates
- debug panel shows country/cell counts

### Milestone 4: Voxel Map Renderer

Render cells using primitive boxes and country/water colors.

Done when:

- Azerbaijan, Armenia, Georgia, Russia, Iran, and Caspian Sea cells appear
- map uses generated voxel cells

### Milestone 5: Cell Selection

Implement raycasting and selected-cell UI.

Done when:

- clicking a cell highlights it
- UI shows terrain, owner, controller, elevation, city, road, supply, resource

### Milestone 6: Primitive Asset System

Create registries/factories for unit, marker, building, and cell primitives.

Done when:

- units/markers are created through factories, not hardcoded in gameplay systems
- future GLTF replacement path is clear

### Milestone 7: Units and Movement

Add divisions, unit counters, pathfinding, and right-click movement.

Done when:

- Azerbaijan unit can move across land cells
- water cells block movement
- roads/terrain affect path cost

### Milestone 8: Supply and Encirclement

Add BFS supply calculation and encirclement status.

Done when:

- cutting a unit off from friendly cells marks it encircled
- overlay/UI shows supply state

### Milestone 9: War, Combat, and Capture

Add war state, basic combat, cell capture, and ownership color updates.

Done when:

- Azerbaijan can declare war and capture Armenian cells
- defeated defenders retreat or lose organization

### Milestone 10: Economy and Production

Add simple daily tick for resources/factories/stockpiles.

Done when:

- country resources change over time
- production lines create equipment

### Milestone 11: Diplomacy and Capitulation

Add relations, war declarations, peace/capitulation, victory values.

Done when:

- capturing key cells can capitulate a country

### Milestone 12: Defensive AI

Add defensive AI state machine.

Done when:

- AI moves units to threatened borders and protects important cells

### Milestone 13: Save/Load

Add JSON save/load.

Done when:

- browser can save and reload current game state

## 25. AI-Assisted Implementation Prompts

Use AI in small tasks, not one giant game prompt.

### Project setup prompt

```text
Create a Vite + React + TypeScript project structure for a browser grand strategy game using plain Three.js for rendering and React for UI. Include folders for game simulation, rendering, UI, data, assets, and types.
```

### Map data prompt

```text
Generate TypeScript interfaces and JSON schemas for countries, terrain, voxel cells, divisions, generals, and starting units for a South Caucasus strategy game with Azerbaijan, Armenia, Georgia, Russia, Iran, and Caspian Sea water cells.
```

### Renderer prompt

```text
Create a plain Three.js InstancedMesh voxel map renderer in TypeScript that renders square cells from map data, supports per-instance colors, stores instanceId-to-cellId lookup, and exposes updateCellColor(cellId, color).
```

### Selection prompt

```text
Create a Three.js raycasting selection system for InstancedMesh voxel cells that converts mouse clicks into selected cell IDs and calls a callback for React UI state updates.
```

### Primitive asset prompt

```text
Create an asset registry and primitive model factory in TypeScript for a strategy game. It should create placeholder meshes for infantry, tanks, cities, supply hubs, forts, roads, resources, and allow future GLTF replacement without changing gameplay code.
```

### Pathfinding prompt

```text
Create an A* pathfinding system in TypeScript for a square voxel grid with passability, terrain movement costs, road bonuses, elevation penalties, water blocking, and country war-state rules.
```

### Supply prompt

```text
Create a supply and encirclement system in TypeScript using BFS from capital, city, and supply hub cells through friendly-controlled passable cells. Mark units as supplied or encircled and expose supply overlay data.
```

### Combat prompt

```text
Create a deterministic cell-based combat system in TypeScript for divisions with attack, defense, organization, terrain modifiers, city/fort bonuses, encirclement penalties, retreat, and cell capture.
```

### AI prompt

```text
Create a defensive AI state machine in TypeScript for countries in a grid-based grand strategy game. AI should defend capitals, cities, supply hubs, borders, and victory cells, avoid offensive wars, and counterattack only weak exposed enemies.
```

## 26. Immediate First Tasks Before Building

1. Create the Vite React TypeScript project.
2. Install `three`, `zustand`, and optionally `zod`.
3. Create the folder structure above.
4. Build `ThreeApp` with scene, renderer, camera, resize system.
5. Build fixed orthographic camera pan/zoom.
6. Create TypeScript interfaces for `Country`, `VoxelCell`, `Division`, `TerrainData`.
7. Create test JSON data for countries and 30x20 cells.
8. Create `VoxelMapRenderer` using primitive boxes.
9. Add picking and selected-cell UI.
10. Add primitive asset registries for units and markers.

Only after these work should movement, supply, combat, economy, diplomacy, and AI begin.

## 27. Definition of Done for Web Development Start

The web implementation start is complete when:

- Vite React TypeScript app runs.
- Three.js canvas renders inside React layout.
- Fixed 2.5D camera pans and zooms.
- Data-driven 30x20 voxel map appears.
- Azerbaijan, Armenia, Georgia, Russia, Iran, and Caspian Sea cells are visible.
- Cells can be clicked and selected.
- Selected cell UI shows owner/controller/terrain/elevation/supply/resource.
- Primitive unit and marker factories exist.
- At least one Azerbaijan primitive unit appears on the map.
- The project structure is ready for pathfinding, supply, combat, and economy.

## 28. Review Notes From Existing Plans

The existing design plans define the final gameplay direction: 2.5D voxel/cell conquest, Azerbaijan as player country, Armenia/Georgia/Russia/Iran as defensive AI countries, Caspian Sea water cells east of Azerbaijan, land warfare first, terrain-aware units, division design, generals, economy, diplomacy, supply, and encirclement.

This web plan preserves those systems but replaces Godot/C# with a browser implementation:

- **Godot scenes become:** React layout plus Three.js renderer modules.
- **C# simulation classes become:** TypeScript simulation modules.
- **Godot resources become:** JSON data files and TypeScript schemas.
- **Godot meshes/nodes become:** Three.js primitives, instanced meshes, registries, and future GLTF models.
- **Godot UI controls become:** React panels and modals.

The most reliable first target is not a complete game. The reliable first target is a working data-driven voxel map with country ownership, primitive visuals, selection, unit placement, and a clean architecture for the rest of the vertical slice.

## 29. Full Original Vertical Slice Coverage Checklist

This section explicitly carries every major gameplay/design element from `grand-strategy-vertical-slice-plan.md` into the TypeScript + React + Three.js implementation plan so the web version does not lose scope.

### 29.1 Design Goal and Core Promises

The web implementation must preserve these original promises:

- **Rule a country:** Manage resources, production, trade, diplomacy, military, and generals.
- **Command armies on a voxel map:** Move divisions cell by cell and capture territory.
- **Design divisions:** Combine battalions and support companies to create units with different stats, costs, strengths, and weaknesses.
- **Fight terrain-aware wars:** Terrain, supply, general skill, unit composition, equipment, and morale affect battles.
- **Face defensive AI:** AI countries build armies, defend borders, react to threats, and mostly avoid aggression unless attacked.

### 29.2 Vertical Slice Scope

The web vertical slice must include:

- **Region:** South Caucasus and nearby border area.
- **Playable country:** Azerbaijan.
- **AI countries:** Armenia, Georgia, Russia, Iran.
- **Water boundary:** Caspian Sea east/right side of Azerbaijan, represented as water voxel cells.
- **Time scale:** Pausable real-time with speed controls.
- **Camera:** 2.5D fixed rotation; pan and zoom only.
- **War scope:** Land warfare first.
- **Future placeholders:** Air force, navy, ports, airfields, dockyards, espionage, advanced diplomacy.
- **Economy scope:** Resources, factories, production, construction, upkeep, trade.
- **Diplomacy scope:** Relations, trade, non-aggression, military access, justify war, declare war, peace/capitulation.
- **AI scope:** Defensive, border-aware, economy-aware, and able to train divisions.

### 29.3 Core Game Loop

The web game loop must remain:

1. **Assess country status:** Resources, factories, army strength, diplomacy, and threats.
2. **Build economy:** Civilian factories, infrastructure, supply hubs, forts, and resource improvements.
3. **Produce equipment:** Infantry weapons, artillery, trucks, tanks, support gear, and supplies.
4. **Design divisions:** Battalions and support units.
5. **Train and assign divisions:** Spend manpower/equipment, then attach divisions to generals.
6. **Plan military action:** Move armies to borders and set objectives.
7. **Fight and capture cells:** Resolve terrain/supply/general/unit-based combat.
8. **Occupy and stabilize:** Captured cells provide value but may create resistance and supply pressure.
9. **Negotiate or expand:** Use diplomacy, trade, alliances/placeholders, or war.

### 29.4 Voxel Map and Cell System

The TypeScript map system must preserve the original map layers:

- **World:** Entire playable region.
- **Country:** Political owner.
- **State/Region:** Administrative group of many voxel cells.
- **Voxel Cell/Chunk:** Selectable grid cell for movement, combat, ownership, terrain, buildings, and supply.

Each voxel cell must support:

- **Cell ID**
- **Grid coordinates**
- **Height/elevation**
- **Owner country**
- **Controller country**
- **Terrain type**
- **Infrastructure level**
- **Supply value**
- **Movement cost**
- **Road/route flag**
- **City flag**
- **Supply hub flag**
- **Resource deposits**
- **Buildings**
- **Victory value**
- **Resistance level**
- **Passability**

The voxel map must support:

- **Smoother conquest**
- **Flexible attack paths**
- **Natural encirclement**
- **Clear terrain logic**
- **Organic frontlines**
- **Caspian Sea water blocking normal land movement**
- **Prototype scale of 80 x 60 cells**
- **Expanded scale of 120 x 80 or 150 x 100 cells after optimization**

### 29.5 Terrain Types and Unit Effects

The web plan must include the original terrain strategy table:

| Terrain | General Effect | Strong Units | Weak Units |
|---|---|---|---|
| Plains | Open, fast, attacker-friendly | Tanks, motorized, artillery | Light infantry without support |
| Forest | Slower, defender advantage | Infantry, engineers, recon | Tanks, large armored divisions |
| Hills | Defensive, moderate movement penalty | Infantry, artillery, mountain troops | Tanks, trucks |
| Mountains | Very defensive, harsh supply | Mountain troops, engineers | Tanks, motorized, heavy artillery |
| Desert | Supply and attrition challenge | Motorized, light tanks, logistics support | Heavy infantry, heavy tanks without logistics |
| Swamp | Severe movement and attack penalty | Marines/light infantry, engineers | Tanks, artillery-heavy units |
| Urban | High defense, slow, costly combat | Infantry, engineers, artillery | Tanks without infantry support |
| River Crossing | Attack penalty unless bridged | Engineers, marines | Tanks, unsupported infantry |
| Snow/Tundra | Attrition and movement penalty | Infantry with logistics, winter-trained units | Motorized/tanks without support |
| Coast | Amphibious/port relevance later | Marines, infantry | Heavy armor in invasion context |

### 29.6 Economy System

The web implementation must include these original resources:

- **Money**
- **Manpower**
- **Food**
- **Steel**
- **Oil**
- **Fuel**
- **Rare metals**
- **Political power**

Factories/buildings:

- **Civilian factories:** Construction, infrastructure, forts, supply hubs, resource improvements.
- **Military factories:** Equipment production.
- **Future placeholders:** Dockyards, air industry, research facilities.

Production rules:

- Factories are assigned to production lines.
- More factories increase output.
- Missing resources reduce efficiency.
- Switching production can reduce efficiency.
- Equipment goes to national stockpiles.

Initial equipment categories:

- Infantry weapons
- Support equipment
- Artillery
- Anti-tank guns
- Trucks
- Light tanks
- Medium tanks
- Supplies/ammunition

Trade rules:

- Countries export surplus resources.
- Countries import missing resources using money or civilian factory capacity.
- Trade improves relations.
- War blocks enemy trade routes.
- AI accepts trade if it has surplus and relations are not hostile.

### 29.7 Military System and Division Designer

Military hierarchy:

- **Battalion**
- **Support company**
- **Division**
- **Army**
- **Theater placeholder**

Division stats:

- **Manpower cost**
- **Equipment cost**
- **Organization**
- **Morale/recovery**
- **Soft attack**
- **Hard attack**
- **Defense**
- **Breakthrough**
- **Armor**
- **Piercing**
- **Speed**
- **Supply use**
- **Fuel use**
- **Reliability**
- **Entrenchment**
- **Recon**
- **Combat width/size**

Division designer requirements:

- **Combat battalion slots:** 3-5 columns with limited rows.
- **Support slots:** 3-5 support company slots.
- **Template preview:** Manpower, equipment, speed, attack, defense, supply, fuel, terrain modifiers, production feasibility.
- **Validation:** At least one combat battalion and cannot exceed max size.
- **Training cost:** Army experience or political power placeholder.
- **Upgrade path:** Existing divisions can switch templates if equipment is available.

Starting battalion/support types:

| Battalion | Role | Strengths | Weaknesses |
|---|---|---|---|
| Infantry | Cheap defensive backbone | Forest, hills, urban, low supply | Slow, weak vs armor |
| Motorized Infantry | Fast infantry | Plains, desert movement, exploitation | Fuel/supply dependent |
| Artillery | High soft attack | Supports infantry, urban attacks | Weak alone, poor mountains/swamps |
| Anti-Tank | Counters armor | Defensive vs tanks | Limited vs infantry |
| Light Tank | Fast breakthrough | Plains, encirclement, weak enemies | Forest/mountains/urban, piercing risk |
| Medium Tank | Strong breakthrough | Plains, decisive attacks | Expensive, fuel, supply |
| Mountain Infantry | Specialist | Mountains, hills, snow | Expensive, weaker in plains than armor |
| Engineers Support | Terrain support | Rivers, forts, urban, entrenchment | Adds equipment cost |
| Recon Support | Tactics and speed | Helps generals pick tactics | Limited direct combat |
| Logistics Support | Reduces supply/fuel use | Desert, mountains, large armies | Adds support equipment cost |
| Medical Support | Reduces manpower loss | Long wars, expensive armies | No direct attack bonus |

### 29.8 Combat System

Battle trigger:

- Combat begins when divisions attack an enemy-controlled voxel cell with enemy forces or defended city/fortification.
- Empty hostile cells are captured after movement if no enemy blocks entry.

Battle inputs:

- Attacker/defender division stats
- Terrain modifiers
- River/fort/urban penalties
- General skill and traits
- Supply and fuel availability
- Encirclement status and supply path connection
- Number of attack directions from adjacent friendly cells
- Planning/preparation bonus
- Entrenchment bonus
- Equipment strength percentage
- Organization and morale
- Weather placeholder

Battle outcomes:

- Organization is lost first.
- Manpower/equipment losses happen based on damage.
- Units retreat when organization collapses or retreat is ordered.
- Winner controls the cell if defender retreats and attacker enters.
- Connected captures can create pockets and encirclements.

Readability rules:

- Rough terrain favors defenders.
- Tanks dominate open terrain but struggle in forests, mountains, swamps, and cities without support.
- Supply prevents unrealistic overstacking.
- Encircled units suffer severe penalties.
- Forts are strong but countered by engineers, artillery, or surrounding attacks.
- Multi-direction attacks reward maneuver.
- Cutting roads, supply hubs, cities, or corridors is a valid strategy.

### 29.9 Generals and Command

General stats:

- **Attack**
- **Defense**
- **Logistics**
- **Planning**
- **Adaptability**
- **Command capacity**

General traits:

- **Infantry Leader**
- **Panzer Leader**
- **Mountaineer**
- **Engineer Commander**
- **Defensive Doctrine**
- **Logistics Expert**
- **Cautious**
- **Aggressive**

Army orders:

- **Move to cell**
- **Hold position**
- **Attack target cell**
- **Frontline assignment**
- **Fallback line**
- **Capture objective**

Advanced battle-plan drawing remains a later feature.

### 29.10 Diplomacy System

Country relations must be affected by:

- Trade
- Border tension
- Ideology/government placeholder
- War declarations
- Non-aggression pacts
- Military access
- Threat level

Diplomatic actions:

- **Improve relations**
- **Trade agreement**
- **Non-aggression pact**
- **Request military access**
- **Guarantee independence placeholder**
- **Justify war goal**
- **Declare war**
- **Offer peace**

War rules:

- Player must justify war before declaring, except debug/sandbox mode.
- Justification increases global tension/threat and target alertness.
- AI countries do not start offensive wars in the first version unless scripted.
- Wars end through capitulation or peace offer.

### 29.11 AI Country Intelligence

AI states:

- **Peaceful**
- **Suspicious**
- **Defensive War**
- **Counterattack**
- **Collapse**

AI priorities:

- Protect capital and victory cells.
- Defend borders with hostile countries.
- Keep divisions supplied.
- Train divisions if manpower/equipment allow.
- Trade for missing resources.
- Build military factories if threatened.
- Build civilian economy if safe.

AI restrictions:

- No major offensive wars by itself.
- No complex naval/air systems in vertical slice.
- Avoid deep offensives unless counterattacking.
- Use predefined division templates first.

### 29.12 Occupation, Victory, and Capitulation

Occupation rules:

- Capturing a cell changes controller, not always legal owner.
- Capturing key cells gives access to some local resources/factories.
- Occupied non-core cells may generate resistance.

Capitulation rules:

- Countries capitulate when enemies control enough victory value.
- Capital cell example: 40 victory value.
- Major cities: 10-20 victory value.
- Strategic industry/resource cells: 3-8 victory value.
- Capitulation threshold: 70% of total victory value controlled by enemies.

Peace result placeholders:

- Annex all occupied territory.
- Puppet country placeholder.
- Return to pre-war borders placeholder.
- Resource concession placeholder.

### 29.13 Supply and Logistics

Supply elements:

- **National supply source:** Capital and connected supply hubs.
- **Supply hubs:** Project supply into nearby controlled cells.
- **Infrastructure:** Improves movement and supply flow.
- **Encirclement:** Cut-off units lose organization recovery, fuel, and combat performance.
- **Unit supply use:** Heavy divisions consume more supply.
- **Logistics support:** Reduces supply needs.

Voxel supply calculation:

- Cell supply capacity = local infrastructure + nearby hub + capital connection.
- Army supply demand = sum of divisions in the cell and nearby contested cells.
- If demand exceeds capacity, penalties apply.

Supply connectivity:

- Supply can pass through friendly-controlled land cells.
- Roads and high infrastructure increase supply range/capacity.
- Enemy-controlled cells block supply.
- Water blocks land supply unless future port/naval rules allow it.
- Impassable mountains block supply unless road/pass exists.
- Enemy zone of control may reduce/block supply depending on balance.

Encirclement penalties:

- **Immediately:** No reinforcement/equipment replacement.
- **Short delay:** Reduced organization recovery.
- **Sustained:** Fuel/ammunition shortages reduce attack, defense, and movement.
- **Long-term:** Attrition and forced retreat/surrender risk.

### 29.14 Technology and Progression

The web plan must include a small time-based research tree or upgrade system.

Research categories:

- **Infantry equipment**
- **Artillery**
- **Armor**
- **Logistics**
- **Industry**
- **Doctrine**

Rules:

- One or two research slots per country.
- Research consumes time.
- Some technologies require earlier technologies.

### 29.15 Government and Internal Management

Government systems:

- **Political power income:** Generated daily.
- **Stability:** Affects factory output, resistance, and political power.
- **War support:** Affects mobilization and surrender resistance.
- **Laws:** Conscription, economy law, trade law.
- **Advisors placeholder:** Purchased with political power later.

Example laws:

- **Conscription:** Volunteer Army, Limited Draft, Extensive Draft.
- **Economy:** Civilian Economy, Partial Mobilization, War Economy.
- **Trade:** Closed Economy, Limited Exports, Free Trade.

### 29.16 UI Screens

The React UI must cover all original screens:

- **Main map view:** Select voxel cells, terrain, owner, controller, supply, buildings, units.
- **Country overview:** Resources, factories, manpower, money, stability, war support.
- **Production screen:** Assign factories to equipment lines.
- **Construction screen:** Queue buildings in states/cells.
- **Division designer:** Build templates and preview stats/modifiers.
- **Army screen:** View divisions, assign generals, issue orders.
- **General details panel:** Stats, traits, command limit, assigned divisions.
- **Diplomacy screen:** Relations, actions, trade, war status.
- **Trade screen:** Import/export resources.
- **Research screen:** Pick technologies/upgrades.
- **War summary panel:** Front status, casualties, occupied victory value, capitulation progress.

### 29.17 Presentation and Readability

The web renderer must preserve the original 2.5D presentation:

- Low-poly/stylized 3D voxel/cell terrain board.
- Countries colored by owner/controller.
- Voxel cell borders visible when zoomed in.
- Terrain visuals for plains, mountains, forests, deserts, cities, rivers, roads, water.
- Height variation for hills, mountains, passes, plateaus.
- Caspian Sea east of Azerbaijan as water cells.
- Cities, supply hubs, forts, roads, resources shown through primitive markers now and GLTF later.
- Units represented by primitive counters first and future realistic 3D models later.
- 2D React UI overlay remains clear and readable.

Strategic zoom levels:

- **Far:** Country colors and frontlines.
- **Medium:** States, armies, supply.
- **Close:** Cells, terrain, individual divisions.

Readability rules:

- Cell size must be large enough.
- Avoid noisy tiny-cell visuals.
- Show detailed borders only at medium/close zoom.
- Provide overlays for ownership, supply, terrain, diplomacy, and frontlines.
- Encircled units must show warning icons/indicators.
- Roads, cities, and supply hubs must be easy to identify.

### 29.18 Data Model and Save/Load

Required data tables:

- **Countries**
- **Voxel cells/chunks**
- **States**
- **Battalions**
- **Support companies**
- **Division templates**
- **Generals**
- **Technologies**
- **Diplomacy**
- **Production lines**
- **Supply graph**

Save data must include:

- Current date/time speed.
- Countries and resources.
- Voxel cell owner/controller state.
- Voxel cell buildings, roads, cities, supply hubs, passability.
- Buildings and construction queues.
- Divisions, templates, generals, orders.
- Wars, diplomacy, trade deals.
- Production and research progress.
- AI state per country.

### 29.19 Balance Targets

Balance targets from the original plan:

- Infantry is affordable and reliable.
- Tanks are powerful but expensive and terrain-limited.
- Artillery improves attack but increases supply demand.
- Specialized units matter in specific terrain.
- Economy forces tradeoffs between industry, military, and infrastructure.
- Supply punishes overstacking.
- Defensive AI is beatable but not passive.

### 29.20 First Playable Scenario

Scenario setup:

- **Azerbaijan:** Main playable country, balanced economy, moderate army, oil resources, Caspian Sea on eastern side.
- **Armenia:** AI mountainous neighbor, strong defensive positions, early border tension.
- **Georgia:** AI northern/western neighbor, mountain passes, trade potential, defensive behavior.
- **Russia:** AI major northern power, stronger industry/military, mostly defensive unless attacked.
- **Iran:** AI southern neighbor, larger manpower/resource potential, defensive unless attacked.
- **Caspian Sea:** Eastern water boundary, future naval/trade/port expansion area.

Scenario objectives:

- Build economy.
- Design at least one improved division template.
- Assign divisions to a general.
- Justify war against a rival.
- Capture border cells, cities, supply hubs, roads, and victory cells.
- Force capitulation or peace.

### 29.21 Full Vertical Slice Milestones

The web implementation must still follow the original milestone coverage:

1. **Map and country foundation:** Render voxel cells, select cells, load country/cell data, support ownership changes.
2. **Economy and production:** Resources, factories, stockpiles, production lines, trade.
3. **Units and movement:** Divisions, cell-to-cell movement, pathfinding, supply/infrastructure/terrain costs.
4. **Division designer and generals:** Templates, stats, modifiers, general assignment.
5. **Combat and conquest:** Battles, terrain/supply/encirclement/multi-direction modifiers, capture, victory/capitulation.
6. **Diplomacy and defensive AI:** Relations, trade, justify war, declare war, peace, defensive AI.
7. **Scenario polish:** Tutorial hints, overlays, war summary, balance.

### 29.22 Future Expansion Roadmap

After the vertical slice:

1. **Air force:** Air regions, fighters, bombers, air superiority, close air support.
2. **Navy:** Sea regions, fleets, convoys, naval invasions, blockades.
3. **Advanced diplomacy:** Alliances, factions, puppets, guarantees, sanctions.
4. **Espionage:** Spies, intel networks, sabotage, counterintelligence.
5. **Deeper politics:** Ideologies, elections, civil wars, ministers, national focuses.
6. **Advanced logistics:** Railways, ports, truck supply, stockpile depots.
7. **Weather and seasons:** Mud, snow, winter attrition, storms.
8. **Mod support:** Data-driven countries, maps, units, technologies, scenarios.
9. **Multiplayer:** Only after core simulation is stable.

### 29.23 Risks and Solutions

Original risks remain:

- **Scope too large:** Build land warfare and basic diplomacy first.
- **3D map too time-consuming:** Use primitive voxel map and separate simulation from rendering.
- **Combat unreadable:** Show battle modifier breakdowns in UI.
- **AI too hard:** Use defensive state machine first.
- **Division designer confusing:** Provide starter templates and warnings.
- **Economy overwhelming:** Use few resources and clear production chains.

### 29.24 Full Vertical Slice Definition of Done

The full web vertical slice is complete when the player can:

- Choose Azerbaijan in the South Caucasus region.
- View a voxel world map with terrain, cell borders, countries, and Caspian Sea.
- Build factories/infrastructure and produce equipment.
- Trade for missing resources.
- Design at least three useful division templates.
- Train divisions and assign them to generals.
- Move units across voxel cells.
- Fight battles affected by terrain, supply, generals, and division design.
- Capture enemy cells and force capitulation.
- Use basic diplomacy to justify war and manage trade/non-aggression.
- Fight against AI that defends borders, cities, supply hubs, victory cells, and important territory.

### 29.25 Original Implementation Order Preserved

The web implementation order must preserve the original order, translated to web systems:

1. Build TypeScript data model and cell selection.
2. Add countries, ownership, controller state, and resource display.
3. Add division entities and movement.
4. Add simple combat before full division designer.
5. Add division templates and stat calculation.
6. Add terrain modifiers and supply.
7. Add generals and army assignment.
8. Add economy, production, and equipment requirements.
9. Add diplomacy and war declarations.
10. Add defensive AI.
11. Polish UI overlays and first scenario balance.
