# Vertical Slice Development Blueprint

This blueprint explains how to start developing the Godot .NET/C# vertical slice for the 2.5D voxel-map grand strategy game, beginning with map generation, countries, selectable cells, units, supply, and core simulation systems.

## 1. Target Stack

Use this stack for the vertical slice:

- **Engine:** Godot 4 .NET.
- **Language:** C#.
- **Presentation:** 2.5D voxel-style 3D map with fixed camera rotation.
- **Camera controls:** Pan and zoom only; no rotation.
- **Map logic:** Data-driven voxel/cell grid.
- **Initial region:** Azerbaijan, Armenia, Georgia, Russia, Iran, and Caspian Sea water cells east of Azerbaijan.
- **Initial platform:** Windows desktop build.

Godot should handle rendering, scenes, UI layout, input routing, camera, materials, and reusable visual objects. C# should handle the map data, countries, ownership, movement, pathfinding, supply, economy, combat, AI, save/load, and rules.

## 2. Recommended Project Structure

Create a clean project structure before adding gameplay logic.

```text
res://
  scenes/
    main/
    map/
    ui/
    units/
    markers/
  scripts/
    core/
    data/
    map/
    countries/
    units/
    economy/
    diplomacy/
    combat/
    supply/
    ai/
    save/
    ui/
  data/
    countries/
    maps/
    units/
    terrain/
    economy/
    diplomacy/
  materials/
    terrain/
    countries/
    overlays/
  art/
    icons/
    markers/
    ui/
```

Suggested main scenes:

- **Main.tscn:** Root scene that loads managers, map, UI, and game state.
- **MapRoot.tscn:** Contains the generated voxel map, map markers, units, and selection layer.
- **CameraRig.tscn:** Fixed-angle camera controller with pan/zoom.
- **UnitCounter.tscn:** Visual representation of a division on the map.
- **CellMarker.tscn:** City, supply hub, fort, resource, or victory-point marker.
- **GameHUD.tscn:** Main UI overlay.

## 3. Core Architecture

Use a separation between **simulation data** and **Godot visuals**.

### 3.1 Simulation Layer

Pure C# classes with no direct scene dependency when possible.

Core classes:

- **GameState:** Owns current campaign state.
- **WorldMap:** Stores all voxel cells and map lookup functions.
- **VoxelCell:** Stores each cell's gameplay data.
- **Country:** Stores country resources, laws, factories, diplomacy, and AI state.
- **Division:** Stores unit location, template, strength, organization, equipment, and owner.
- **General:** Stores command stats, traits, assigned divisions.
- **War:** Stores attackers, defenders, active battles, capitulation progress.
- **SupplySystem:** Calculates supply connectivity and encirclement.
- **PathfindingSystem:** Finds valid paths across voxel cells.
- **CombatSystem:** Resolves cell-level battles.
- **EconomySystem:** Updates resources, factories, construction, production.
- **DiplomacySystem:** Handles relations, trade, war declarations, treaties.
- **AISystem:** Updates AI countries.

### 3.2 Presentation Layer

Godot nodes that display simulation data.

Visual nodes:

- **MapRenderer:** Builds visible voxel/cell terrain from `WorldMap`.
- **CellVisual:** Optional per-cell visual node for small prototypes.
- **UnitVisualController:** Creates and moves unit counters.
- **OverlayRenderer:** Shows ownership, terrain, supply, frontlines, and selected cells.
- **CameraController:** Handles fixed-angle pan/zoom.
- **UIController:** Updates UI panels from `GameState`.

Rule:

- Simulation should not depend on visuals.
- Visuals can read simulation data and call simulation commands.

## 4. Voxel Map Creation Method

Do not manually place every voxel cell in Godot. Use a **data-driven generated map**.

Recommended flow:

```text
Map data files -> C# loader -> WorldMap data -> MapRenderer -> Godot 3D visuals
```

### 4.1 First Prototype Map

Start with a small test grid before trying the full South Caucasus map.

Recommended first grid:

- **Size:** 30 x 20 cells.
- **Countries:** Azerbaijan, Armenia, Georgia, Russia, Iran.
- **Water:** Caspian Sea strip on the right/east side.
- **Terrain:** Plains, hills, mountains, urban, water.
- **Markers:** Baku as capital/city/supply hub; one Armenian city; one Georgian city.

Then expand to:

- **80 x 60 cells** for the first real vertical-slice map.
- **120 x 80 or 150 x 100 cells** only after performance is stable.

### 4.2 Voxel Cell Data Model

Each cell should contain:

```text
id
x
y
elevation
terrain_type
owner_country_id
controller_country_id
state_id
is_passable
has_road
has_city
has_capital
has_supply_hub
has_fort
resource_type
resource_amount
victory_value
infrastructure_level
supply_value
movement_cost
```

Suggested enums:

```text
TerrainType: Plains, Forest, Hills, Mountains, Desert, Swamp, Urban, River, Coast, Water, Snow
ResourceType: None, Food, Steel, Oil, RareMetals
BuildingType: CivilianFactory, MilitaryFactory, SupplyHub, Fort, Radar, AirfieldPlaceholder, PortPlaceholder
```

### 4.3 Map Data File Options

Use a simple format at first.

Best early option:

- **JSON:** Easy to generate with AI and easy to inspect.

Later options:

- **CSV:** Easier for spreadsheet editing.
- **Image import:** Color-coded PNGs for terrain, country ownership, and height.
- **Custom Godot map editor:** Best long-term, but too much work for the first step.

## 5. How to Generate the Voxel Map Visually

### 5.1 Prototype Renderer

For the first prototype, generate simple cube/prism cells in code.

For each `VoxelCell`:

1. Calculate world position from `x` and `y`.
2. Use `elevation` to set height.
3. Choose material from terrain type.
4. Add country color overlay or border tint.
5. Create city/supply/resource markers if needed.
6. Register clickable cell collision or coordinate lookup.

This is easiest to understand but may be inefficient for large maps.

### 5.2 Better Renderer

After prototype works, move to one of these:

- **MultiMeshInstance3D:** Good for many repeated cell meshes.
- **Chunked mesh generation:** Build larger combined meshes by terrain/country region.
- **GridMap:** Good for quick visual prototyping, but less flexible for strategy-specific overlays.

Recommended path:

1. Start with individual generated cells for clarity.
2. Switch to `MultiMeshInstance3D` when cell count becomes large.
3. Use separate overlay systems for ownership/supply/frontlines.

### 5.3 Cell Selection

Use one of these methods:

- **Raycast against cell collision:** Easy for prototype.
- **Math-based grid picking:** Better long-term if the map is flat/regular.

For prototype:

```text
Mouse click -> Camera raycast -> hit cell visual -> get cell ID -> show cell panel
```

For optimized version:

```text
Mouse click -> ray to ground plane -> convert world position to grid x/y -> lookup cell
```

## 6. Countries and Ownership

### 6.1 Country Data

Create country data files for:

- **Azerbaijan:** Player country.
- **Armenia:** AI defensive mountain neighbor.
- **Georgia:** AI defensive/trading neighbor.
- **Russia:** AI major northern power.
- **Iran:** AI southern neighbor.
- **Caspian Sea:** Not a country; use water cells with no land owner or special neutral controller.

Country fields:

```text
id
name
map_color
capital_cell_id
is_playable
ai_profile
money
manpower
food
steel
oil
fuel
rare_metals
political_power
civilian_factories
military_factories
stability
war_support
```

### 6.2 Ownership vs Control

Every cell should track two concepts:

- **Owner:** Legal country that owns the cell.
- **Controller:** Country currently occupying the cell.

Examples:

- At peace: owner and controller are the same.
- During war: Azerbaijan may control an Armenian cell, but Armenia may remain the legal owner until peace.

This is important for:

- occupation
- resistance
- resource access
- capitulation
- peace deals

### 6.3 Borders

Borders should not be manually drawn.

Generate borders from cell ownership/control:

```text
If adjacent cell has different owner/controller, draw border edge.
```

Start simple:

- Color each cell by country.
- Add visible dark lines between different countries.

Later:

- Add political map overlay.
- Add frontline overlay for war borders.

## 7. Camera and Controls

The camera should be fixed-rotation 2.5D.

Camera rules:

- Player can pan north/south/east/west.
- Player can zoom in/out.
- Player cannot rotate.
- Camera angle remains constant.
- Zoom levels change visible information.

Suggested controls:

- **WASD / edge pan / middle mouse drag:** Pan.
- **Mouse wheel:** Zoom.
- **Left click:** Select cell/unit.
- **Right click:** Move selected unit.
- **Escape:** Clear selection.

## 8. Development Milestones

### Milestone 1: Empty Godot .NET Project

Goal:

- Create Godot .NET project.
- Create basic scenes and folder structure.
- Add fixed camera with pan/zoom.
- Add placeholder UI overlay.

Done when:

- Game runs.
- Camera can pan and zoom.
- Empty map area is visible.

### Milestone 2: Data Model Foundation

Goal:

- Create C# model classes for `GameState`, `Country`, `WorldMap`, and `VoxelCell`.
- Create enums for terrain, resources, and buildings.
- Create sample JSON files for countries and a tiny map.
- Load data at game start.

Done when:

- Countries and cells load into memory.
- Debug UI/log can show number of countries and cells.

### Milestone 3: Voxel Map Renderer

Goal:

- Generate visible voxel/cell terrain from loaded map data.
- Assign terrain materials.
- Assign country colors.
- Add Caspian Sea water cells.
- Add height/elevation differences.

Done when:

- The map is visible in Godot.
- Azerbaijan, Armenia, Georgia, Russia, Iran, and water cells are visually distinct.

### Milestone 4: Cell Selection and Info Panel

Goal:

- Allow player to click cells.
- Highlight selected cell.
- Display cell data in UI.

Info panel should show:

- cell ID
- terrain
- elevation
- owner
- controller
- infrastructure
- supply
- road/city/supply hub flags
- resource
- victory value

Done when:

- Clicking any visible cell selects it and updates UI.

### Milestone 5: Country Overview

Goal:

- Add country overview panel for Azerbaijan.
- Show resources, factories, manpower, stability, war support, and political power.
- Add country selection/debug view for AI countries.

Done when:

- Player can see Azerbaijan's basic country data.

### Milestone 6: Unit Placement

Goal:

- Create `Division` data model.
- Create `UnitCounter` visual scene.
- Spawn starting divisions for countries.
- Place units on valid land cells.

Done when:

- Units appear on the map and belong to countries.

### Milestone 7: Pathfinding and Movement

Goal:

- Implement cell-to-cell pathfinding.
- Block water cells.
- Apply terrain movement costs.
- Make roads reduce movement cost.
- Move selected unit to a clicked target cell.

Done when:

- Player can select a unit and move it across valid cells.
- Units avoid Caspian Sea water cells.

### Milestone 8: Supply and Encirclement

Goal:

- Implement supply sources: capital, city, supply hub.
- Trace supply through friendly-controlled cells.
- Block supply through enemy cells and water.
- Mark units as supplied or encircled.
- Show supply overlay/debug view.

Done when:

- A unit cut off from friendly cells becomes encircled.
- UI shows supply state.

This is a high-effort system. Keep the first version simple: use breadth-first search from supply sources through friendly cells and mark reachable cells as supplied.

### Milestone 9: Basic Combat and Cell Capture

Goal:

- Start combat when a unit attacks an enemy-occupied adjacent cell.
- Use simple attack/defense/organization values.
- Apply terrain defense modifiers.
- Winner captures the cell.
- Update controller and redraw ownership/control colors.

Done when:

- Azerbaijan can attack and capture enemy cells.

Keep combat simple first. Advanced combat formulas, combat width, equipment losses, and tactics can be AI-generated later as separate systems.

### Milestone 10: Cities, Victory Points, and Capitulation

Goal:

- Add city and victory-value cells.
- Track country capitulation progress.
- Capitulate a country when enough victory value is controlled by enemies.

Done when:

- Capturing key cells can defeat a country.

### Milestone 11: Economy Prototype

Goal:

- Add daily resource income from controlled cells.
- Add civilian and military factory counts.
- Add simple production lines.
- Add stockpiles for infantry weapons, artillery, trucks, tanks, and supplies.

Done when:

- Azerbaijan produces resources/equipment over time.

Keep this simple. Complex factory efficiency, trade laws, consumer goods, and advanced production should be added later.

### Milestone 12: Diplomacy and War State

Goal:

- Add relations between countries.
- Add war declarations.
- Add peace/capitulation handling.
- Prevent combat unless countries are at war.

Done when:

- Azerbaijan can declare war and then capture enemy cells.

### Milestone 13: Defensive AI

Goal:

- AI countries defend important cells.
- AI moves units toward threatened borders.
- AI avoids offensive wars unless attacked.
- AI reinforces capital, cities, supply hubs, and victory cells.

Done when:

- Armenia, Georgia, Russia, and Iran can hold defensive positions and react to player attacks.

This is high effort. First AI should be a simple state machine, not advanced strategy planning.

### Milestone 14: Save/Load

Goal:

- Save and load `GameState`.
- Include countries, cells, units, wars, economy, and date/time.

Done when:

- Player can save, exit, reload, and continue.

## 9. Recommended C# Class Breakdown

### Core

```text
GameManager
GameState
GameClock
CommandSystem
EventBus optional
```

### Data

```text
CountryData
VoxelCellData
TerrainData
DivisionTemplateData
BattalionData
GeneralData
TechnologyData
```

### Map

```text
WorldMap
VoxelCell
MapDataLoader
MapRenderer
CellSelectionController
MapOverlayController
BorderRenderer
```

### Countries

```text
Country
CountryManager
ResourceStockpile
FactoryManager
```

### Units

```text
Division
Army
General
DivisionTemplate
Battalion
UnitManager
UnitVisualController
```

### Movement

```text
PathfindingSystem
MovementSystem
MovementOrder
TerrainMovementCostProvider
```

### Supply

```text
SupplySystem
SupplySource
SupplyGraph
EncirclementStatus
```

### Combat

```text
CombatSystem
Battle
BattleResolver
CombatModifierCalculator
```

### Diplomacy

```text
DiplomacySystem
RelationState
WarState
Treaty
TradeDeal
```

### AI

```text
CountryAIController
AIDefensivePlanner
AIBuildPlanner
AIUnitPlanner
AIState
```

### Save

```text
SaveGameService
SaveGameData
SerializationService
```

## 10. Data Files to Create First

Create small sample data before building complex tools.

### countries.json

Include:

- Azerbaijan
- Armenia
- Georgia
- Russia
- Iran

### terrain.json

Include terrain stats:

```text
movement_cost
attack_modifier
defense_modifier
supply_modifier
is_passable
material_id
```

### map_cells.json

Start with hand-authored test cells.

Later generate this using an AI script or image importer.

### starting_units.json

Define starting divisions:

```text
id
country_id
cell_id
template_id
strength
organization
```

### battalions.json

Define basic battalion stats:

- Infantry
- Motorized Infantry
- Artillery
- Anti-Tank
- Light Tank
- Medium Tank
- Mountain Infantry
- Engineers Support
- Recon Support
- Logistics Support

## 11. Voxel Map Generation Details

### 11.1 Coordinate System

Use a simple square grid first:

```text
cell x = east/west
cell y = north/south
world_x = x * cell_size
world_z = y * cell_size
world_y = elevation * height_scale
```

Later, if you want a nicer strategy look, consider hexes. But square cells are easier for the first version.

### 11.2 Cell Mesh

Use one simple mesh shape first:

- cube
- low rectangular prism
- beveled cube later

Terrain height:

- plains: low
- hills: medium
- mountains: high
- water: low/flat

### 11.3 Country Coloring

Use two visual layers:

- **Terrain material:** Shows land type.
- **Country overlay tint:** Shows owner/controller.

If that is too hard at first, simply color cells by country and use small icons/textures for terrain.

### 11.4 Borders

For every cell, check four neighbors:

```text
north
south
east
west
```

If neighbor owner/controller differs, draw a border line along that edge.

High-effort note: border rendering can be simplified at first by relying on visible color differences between cells.

## 12. How to Build Countries on the Map

### Step 1: Define country IDs

Use stable lowercase IDs:

```text
azerbaijan
armenia
georgia
russia
iran
```

### Step 2: Assign cell ownership

Each land cell receives an `owner_country_id` and `controller_country_id`.

Example:

```text
Azerbaijan cells: central/eastern land area
Armenia cells: western/southwestern mountain area
Georgia cells: northwestern mountain area
Russia cells: northern border area
Iran cells: southern border area
Caspian Sea cells: eastern water area
```

### Step 3: Add capitals/cities

Minimum cities:

- **Baku:** Azerbaijan capital, city, supply hub, oil/resource area nearby.
- **Yerevan:** Armenia capital/city.
- **Tbilisi:** Georgia capital/city.
- **Northern Russian city/strongpoint:** AI defense anchor.
- **Northern Iranian city/strongpoint:** AI defense anchor.

### Step 4: Add roads and supply paths

Roads should connect:

- capital to border
- capital to cities
- cities to supply hubs
- important mountain passes

Roads make movement and supply more strategic.

## 13. First Vertical Slice Gameplay Loop

The first playable loop should be:

1. Load map and countries.
2. Select Azerbaijan.
3. View country resources.
4. Select cells and units.
5. Move divisions across friendly cells.
6. Declare war on Armenia for testing.
7. Attack adjacent enemy cells.
8. Capture cells.
9. Cut supply to an enemy unit.
10. Encircled enemy suffers penalties.
11. Capture city/victory cells.
12. Trigger capitulation.

Do not build every economy/diplomacy/military feature before this loop works.

## 14. Features That Should Stay Simple First

These systems are important but can become too large. Implement simple versions first.

### Division Designer

Simple first version:

- Use predefined templates.
- Show stats.
- Let player switch template later.

AI prompt idea:

```text
Generate a C# data-driven division template system for Godot .NET with battalions, support companies, calculated stats, and JSON loading.
```

### Economy

Simple first version:

- Daily income from controlled cells.
- Factories produce equipment over time.
- Missing resources reduce production.

AI prompt idea:

```text
Generate a simple grand strategy economy system in C# with resources, factories, production lines, stockpiles, and daily ticks.
```

### Diplomacy

Simple first version:

- Relations score.
- Declare war.
- Peace/capitulation.
- Trade placeholder.

AI prompt idea:

```text
Generate a basic diplomacy system in C# with country relations, war states, non-aggression pacts, trade agreements, and declare-war validation.
```

### AI

Simple first version:

- Defensive state machine.
- Move units to threatened borders.
- Protect capitals and victory cells.

AI prompt idea:

```text
Generate a defensive AI state machine for a grid-based grand strategy game where countries defend borders, capitals, supply hubs, and victory cells.
```

### Combat

Simple first version:

- Attack vs defense.
- Organization loss.
- Terrain modifiers.
- Retreat/capture.

AI prompt idea:

```text
Generate a deterministic cell-based combat resolver in C# for divisions with attack, defense, organization, terrain modifiers, encirclement penalties, and victory capture.
```

### Save/Load

Simple first version:

- Serialize full game state to JSON.
- Load it back.

AI prompt idea:

```text
Generate a Godot .NET C# save/load service that serializes a strategy game state with countries, voxel cells, units, wars, economy, and date/time to JSON.
```

## 15. Build Order for AI-Assisted Development

Use AI to generate one small system at a time. Do not ask AI to create the entire game at once.

Recommended order:

1. **Create Godot .NET project structure.**
2. **Create C# data classes for country and voxel cells.**
3. **Create JSON loader for countries and map cells.**
4. **Generate map visuals from loaded cells.**
5. **Add fixed camera pan/zoom.**
6. **Add cell selection and info UI.**
7. **Add country ownership colors and Caspian Sea water cells.**
8. **Add starting divisions and unit counters.**
9. **Add pathfinding and movement.**
10. **Add supply connectivity and encirclement detection.**
11. **Add basic war/combat/capture.**
12. **Add simple country economy tick.**
13. **Add basic diplomacy/war declarations.**
14. **Add defensive AI.**
15. **Add save/load.**
16. **Polish overlays, readability, and scenario balance.**

## 16. Immediate First Tasks

Start with these concrete tasks:

1. Install/open **Godot 4 .NET**.
2. Create the project in the project folder.
3. Create the folder structure from this blueprint.
4. Create `Main.tscn` with root `Node`.
5. Create `MapRoot.tscn` with `Node3D` root.
6. Create `CameraRig.tscn` with fixed-angle `Camera3D`.
7. Create C# enums for terrain, resources, buildings.
8. Create `Country`, `VoxelCell`, `WorldMap`, and `GameState` classes.
9. Create small `countries.json` and `map_cells.json` files.
10. Generate a 30 x 20 voxel test map.
11. Add cell selection and UI readout.

Only after these work should movement, supply, combat, and economy begin.

## 17. Definition of Done for Development Start

The development-start phase is done when:

- Godot .NET project opens and runs.
- Fixed 2.5D camera pans and zooms.
- A data-driven voxel map appears.
- Azerbaijan, Armenia, Georgia, Russia, Iran, and Caspian Sea cells are visible.
- Cells can be selected.
- Selected cell info appears in UI.
- Country ownership/controller is stored in code.
- At least one Azerbaijan unit appears on the map.
- The architecture is ready for movement, supply, combat, and economy systems.

## 18. Notes From Current Plan Review

The current main design plan already defines the game direction: Godot Engine, C#, 2.5D voxel map, Azerbaijan as the player country, Armenia/Georgia/Russia/Iran as AI countries, Caspian Sea water cells east of Azerbaijan, land warfare first, defensive AI, supply/encirclement, terrain-based combat, economy, diplomacy, and division design.

Some large systems should be kept intentionally simple in the vertical slice:

- **AI:** Defensive state machine only.
- **Combat:** Deterministic/simple formulas first.
- **Economy:** Daily resource and equipment production first.
- **Diplomacy:** Relations, trade placeholder, declare war, peace/capitulation first.
- **Division designer:** Predefined templates first, editor later.
- **Voxel renderer:** Simple generated cells first, optimized rendering later.
