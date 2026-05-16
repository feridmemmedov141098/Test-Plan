# Grand Strategy Country Ruler Vertical Slice Plan

This plan defines a playable vertical slice for a Godot 2.5D voxel-map grand strategy game where the player rules a country, manages economy, diplomacy, generals, division design, terrain-based warfare, and cell-by-cell conquest.

## 1. Design Goal

Build a smaller but polished version of a country-ruling grand strategy game inspired by the broad structure of games like `Hearts of Iron IV`, but with simpler systems that can be completed and expanded later.

The game will be built in **Godot Engine** using a **2.5D voxel-style strategy map**: the world is rendered with 3D voxel/cell terrain, but the camera rotation is fixed so the player only pans and zooms.

The vertical slice should prove these core promises:

- **Rule a country:** Manage resources, production, trade, diplomacy, military, and generals.
- **Command armies on a voxel map:** Move divisions across small voxel cells and capture territory cell by cell.
- **Design divisions:** Combine battalions and support companies to create units with different stats, costs, strengths, and terrain weaknesses.
- **Fight terrain-aware wars:** Terrain, supply, general skill, unit composition, equipment, and morale all affect battles.
- **Face basic defensive AI:** Other countries build armies, defend borders, respond to threats, and mostly avoid aggression unless attacked.

## 2. Recommended Vertical Slice Scope

The first playable version should not include the whole real world immediately. It should use a reduced map that proves the full game loop.

- **Map scope:** South Caucasus and nearby border region focused on Azerbaijan, Armenia, Georgia, Russia, Iran, and the Caspian Sea east of Azerbaijan.
- **Playable countries:** Azerbaijan as the first fully supported player country, with Armenia, Georgia, Russia, and Iran controlled by AI.
- **Time scale:** Pausable real-time strategy with adjustable speed.
- **Engine:** Godot Engine.
- **Camera:** 2.5D fixed-rotation 3D terrain board with selectable grid chunks; the player can pan and zoom but cannot rotate the camera.
- **War scope:** Land warfare only for the first vertical slice; air and navy can be planned as future systems.
- **Economy scope:** Basic resources, factories, production queues, construction, upkeep, and trade.
- **Diplomacy scope:** Relations, trade agreements, non-aggression pact, military access, justify war, declare war, peace/capitulation.
- **AI scope:** Defensive, border-aware, economy-aware, and capable of training divisions.

## 3. Core Game Loop

1. **Assess country status:** Review resources, factories, army strength, diplomacy, and threats.
2. **Build economy:** Construct factories, infrastructure, supply hubs, and resource improvements.
3. **Produce equipment:** Assign military factories to infantry weapons, artillery, trucks, tanks, support gear, and supplies.
4. **Design divisions:** Create or edit templates using battalions and support units.
5. **Train and assign divisions:** Spend manpower and equipment to form units, then attach them to generals.
6. **Plan military action:** Move armies to borders, choose objectives, and prepare attacks.
7. **Fight and capture cells:** Combat resolves based on unit stats, terrain, supply, general traits, and morale.
8. **Occupy and stabilize:** Captured voxel cells provide resources or factories but may create resistance and supply pressure.
9. **Negotiate or expand:** Use diplomacy, trade, alliances, or war to grow stronger.

## 4. Voxel-Based World Map and Territory System

### 4.1 Map Structure

The map should be a voxel-style strategic grid instead of a traditional hand-drawn province map. This does not mean a fully destructible sandbox world; it means a fixed strategy grid where every voxel/cell is a small capturable map area.

The map should be divided into layers:

- **World:** Entire playable region.
- **Country:** Political owner of territory.
- **State/Region:** Larger administrative area containing many voxel cells.
- **Voxel Cell/Chunk:** Small selectable 3D grid cell used for movement, combat, ownership, terrain, buildings, and supply.

The voxel approach should support:

- **Smoother conquest:** Armies advance by capturing small cells instead of large irregular provinces.
- **Flexible attack paths:** Players can flank, bypass strongpoints, cut roads, or attack cities from multiple directions.
- **Natural encirclement:** Units can be surrounded when enemy-controlled cells cut their supply path.
- **Clear terrain logic:** Each cell stores terrain, elevation, movement cost, supply value, and ownership.
- **Caspian Sea boundary:** Water cells east of Azerbaijan represent the Caspian Sea and block normal land movement.

Recommended vertical-slice grid size:

- **Prototype scale:** 80 x 60 cells.
- **Expanded vertical slice:** 120 x 80 or 150 x 100 cells if performance remains stable.

### 4.2 Voxel Cell Data

Each voxel cell/chunk should store:

- **Cell ID:** Unique identifier.
- **Grid coordinates:** X/Y location on the strategy grid.
- **Height/elevation:** Used for hills, mountains, plateaus, and visual terrain height.
- **Owner country:** Legal owner.
- **Controller country:** Current military occupier.
- **Terrain type:** Plains, forest, hills, mountains, desert, swamp, urban, river, coast, water, tundra/snow.
- **Infrastructure level:** Affects movement, supply, construction, and resource extraction.
- **Supply value:** Local ability to support units.
- **Movement cost:** Base movement difficulty for pathfinding.
- **Road/route flag:** Improves movement and supply flow if present.
- **City flag:** Marks population, victory value, local supply, and construction importance.
- **Supply hub flag:** Allows the cell to project supply through connected friendly cells.
- **Resource deposits:** Steel, oil, food, rare metals, fuel, industry materials.
- **Buildings:** Factory, fort, supply hub, radar/intelligence post, airfield placeholder, port placeholder.
- **Victory value:** Important chunks push countries toward surrender when captured.
- **Resistance level:** Occupied non-core territory may resist.
- **Passability:** Defines whether land units can enter the cell; water cells are blocked for land units unless future naval/port rules allow crossing.

### 4.3 Movement

- **Movement is cell-to-cell:** Units move between adjacent voxel cells.
- **Movement speed depends on:** Unit speed, terrain, elevation, infrastructure, roads, weather, supply, and enemy zone of control.
- **Pathfinding should prefer:** Friendly cells, roads, plains, supplied areas, and low movement-cost routes.
- **Pathfinding should avoid:** Mountains, swamps, enemy zones of control, unsupplied cells, and impassable water.
- **Hostile movement triggers combat:** If enemy divisions are present, attackers enter battle instead of immediately capturing.
- **Empty hostile cells are captured:** If no enemy blocks entry, the moving unit changes controller of the cell.
- **Cities and chokepoints matter:** Capturing city, road, bridge, pass, or supply cells should have strategic value beyond simple border pushing.
- **Frontlines become organic:** The border is the current edge between friendly-controlled and enemy-controlled voxel cells.

## 5. Terrain Types and Unit Effects

Terrain must meaningfully change strategy. Each terrain type should affect attack, defense, movement, supply, and unit preference.

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

## 6. Economy System

### 6.1 Resources

Start with a simple but expandable resource model:

- **Money:** Used for trade, maintenance, diplomacy, and construction acceleration.
- **Manpower:** Required for divisions and garrisons.
- **Food:** Supports population and army upkeep.
- **Steel:** Used for weapons, artillery, vehicles, buildings.
- **Oil:** Refined into fuel for motorized and armored units.
- **Fuel:** Consumed by tanks, trucks, future aircraft/navy.
- **Rare metals:** Used for advanced equipment and late-game technology.
- **Political power:** Abstract government capacity used for laws, diplomacy, generals, and decisions.

### 6.2 Factories and Construction

Use two core factory types at first:

- **Civilian factories:** Build infrastructure, factories, forts, supply hubs, and resource improvements.
- **Military factories:** Produce equipment for divisions.

Optional later factory types:

- **Dockyards:** Navy.
- **Air industry:** Aircraft.
- **Research facilities:** Advanced technology.

### 6.3 Production

Military production should work as assignment lines:

- Assign factories to equipment lines.
- More factories increase daily output.
- Missing resources reduce efficiency.
- Switching production loses some efficiency.
- Equipment is stored in national stockpiles.

Initial equipment categories:

- Infantry weapons
- Support equipment
- Artillery
- Anti-tank guns
- Trucks
- Light tanks
- Medium tanks
- Supplies/ammunition

### 6.4 Trade

Trade should be basic but useful:

- Countries can export surplus resources.
- Countries can import missing resources using money or civilian factory capacity.
- Trade improves relations.
- War blocks trade routes with enemies.
- AI accepts trade if it has surplus and relations are not hostile.

## 7. Military System

### 7.1 Unit Hierarchy

- **Battalion:** Smallest design component, e.g. infantry battalion, tank battalion.
- **Support company:** Non-frontline modifier, e.g. engineers, logistics, recon.
- **Division:** Main controllable unit on the map, created from battalions and support companies.
- **Army:** Group of divisions assigned to a general.
- **Theater:** Future grouping for multiple armies.

### 7.2 Division Stats

Every division should calculate stats from its battalions, support companies, equipment, training, and manpower.

Core stats:

- **Manpower cost**
- **Equipment cost**
- **Organization:** Ability to stay in battle.
- **Morale/recovery:** How quickly organization recovers.
- **Soft attack:** Damage against infantry-type targets.
- **Hard attack:** Damage against armored targets.
- **Defense:** Resistance when defending.
- **Breakthrough:** Resistance when attacking.
- **Armor:** Protection against weak attacks.
- **Piercing:** Ability to counter armor.
- **Speed:** Map movement rate.
- **Supply use:** Required supply per day.
- **Fuel use:** Required fuel per day.
- **Reliability:** Chance to avoid attrition/equipment loss.
- **Entrenchment:** Defensive preparation bonus.
- **Recon:** Helps choose better tactics.
- **Combat width/size:** Limits how many units fight efficiently in one chunk battle.

### 7.3 Division Designer

The designer should be clear and modular.

- **Combat battalion slots:** 3-5 columns with limited rows for frontline battalions.
- **Support slots:** 3-5 support company slots.
- **Template preview:** Shows manpower, equipment, speed, attack, defense, supply, fuel, terrain modifiers, and production feasibility.
- **Validation rules:** A division must have at least one combat battalion and cannot exceed max size.
- **Training cost:** New templates may cost army experience or political power.
- **Upgrade path:** Existing divisions can switch templates if equipment is available.

### 7.4 Starting Battalion Types

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

## 8. Combat System

### 8.1 Battle Trigger

Combat begins when divisions enter an enemy-controlled voxel cell occupied by enemy divisions, or when ordered to attack an adjacent enemy-held cell.

On the voxel map, combat is resolved at the cell level. A battle begins when a division attacks an adjacent enemy-controlled voxel cell that contains enemy forces or a defended city/fortification.

### 8.2 Battle Calculation

A battle should resolve over time using readable modifiers rather than instant random outcomes.

Inputs:

- Attacker and defender division stats.
- Terrain modifiers.
- River/fort/urban penalties.
- General skill and traits.
- Supply and fuel availability.
- Encirclement status and supply-path connection.
- Number of attack directions from adjacent friendly cells.
- Planning/preparation bonus.
- Entrenchment bonus for defender.
- Equipment strength percentage.
- Organization and morale.
- Weather, if included.

Outcome:

- Units lose organization first.
- Units also lose manpower/equipment based on damage.
- A side retreats when organization collapses or retreat is ordered.
- Winner controls the voxel cell if the defender retreats and attacker enters.
- Capturing connected cells can create pockets if enemy units lose all valid supply paths.

### 8.3 Combat Rules for Readability

- Defenders should usually have advantage in rough terrain.
- Tanks should dominate open terrain but struggle in mountains, forests, swamps, and cities without infantry/engineers.
- Supply should prevent unrealistic giant armies in poor terrain.
- Encircled units should suffer severe supply penalties.
- Forts should be strong but countered by engineers, artillery, or surrounding attacks.
- Multi-direction attacks should reward players for maneuvering around enemy cells instead of only pushing straight forward.
- Cutting roads, supply hubs, cities, or narrow corridors should be a valid strategy even when the enemy frontline is strong.

## 9. Generals and Command

### 9.1 General Role

Generals are leaders assigned to armies. The player attaches divisions to a general, and the general provides bonuses and manages army-level orders.

### 9.2 General Stats

- **Attack:** Bonus when attacking.
- **Defense:** Bonus when defending.
- **Logistics:** Reduces supply and fuel use.
- **Planning:** Improves preparation bonuses.
- **Adaptability:** Reduces terrain penalties.
- **Command capacity:** Number of divisions managed without penalty.

### 9.3 General Traits

Examples:

- **Infantry Leader:** Infantry attack/defense bonus.
- **Panzer Leader:** Tank and motorized bonus.
- **Mountaineer:** Mountain and hill bonus.
- **Engineer Commander:** River crossing and fort attack bonus.
- **Defensive Doctrine:** Entrenchment and defense bonus.
- **Logistics Expert:** Reduced supply use.
- **Cautious:** Better defense, slower attack planning.
- **Aggressive:** Better attack, higher casualties.

### 9.4 Army Orders

For the vertical slice, implement simple orders:

- **Move to chunk**
- **Hold position**
- **Attack target chunk**
- **Frontline assignment**
- **Fallback line**
- **Capture objective**

Advanced battle-plan drawing can be added later.

## 10. Diplomacy System

### 10.1 Country Relations

Every pair of countries should have a relation score affected by:

- Trade
- Border tension
- Ideology/government type placeholder
- War declarations
- Non-aggression pacts
- Military access
- Threat level

### 10.2 Diplomatic Actions

Vertical slice actions:

- **Improve relations**
- **Trade agreement**
- **Non-aggression pact**
- **Request military access**
- **Guarantee independence placeholder**
- **Justify war goal**
- **Declare war**
- **Offer peace**

### 10.3 War Rules

- Player must justify war before declaring, unless using debug/sandbox mode.
- Justification increases global tension and target alertness.
- AI countries do not start offensive wars in the first version unless scripted.
- Wars end through capitulation or peace offer.

## 11. AI Country Intelligence

The AI should be simple but believable.

### 11.1 Strategic AI States

- **Peaceful:** Build economy, trade, train small army.
- **Suspicious:** Increase border defense if relations drop or player justifies war.
- **Defensive War:** Hold important chunks, reinforce fronts, avoid reckless attacks.
- **Counterattack:** Limited attacks only if enemy is weak, undersupplied, or exposed.
- **Collapse:** Retreat toward victory chunks/capital when losing badly.

### 11.2 AI Priorities

- Protect capital and victory chunks.
- Defend borders with hostile countries.
- Keep divisions supplied.
- Train divisions if manpower/equipment allow.
- Trade for missing resources.
- Build military factories if threatened.
- Build civilian economy if safe.

### 11.3 AI Restrictions for First Version

- AI should not launch major wars by itself.
- AI should not use complex naval/air systems.
- AI should avoid deep offensive operations unless counterattacking.
- AI should use predefined division templates to reduce complexity.

## 12. Occupation, Victory, and Capitulation

### 12.1 Capturing Territory

- Capturing a chunk changes its controller but not necessarily legal owner.
- Capturing key chunks gives access to some local resources and factories.
- Occupied chunks may generate resistance if not core territory.

### 12.2 Capitulation

A country capitulates when enemies control enough victory value.

Example:

- Capital chunk: 40 victory value.
- Major cities: 10-20 victory value.
- Strategic industry/resource chunks: 3-8 victory value.
- Capitulation threshold: 70% of total victory value controlled by enemies.

### 12.3 Peace Result

For the vertical slice, keep peace simple:

- Annex all occupied territory.
- Puppet country placeholder.
- Return to pre-war borders placeholder.
- Resource concession placeholder.

## 13. Supply and Logistics

Supply is essential because it prevents unlimited armies from stacking in one area.

- **National supply source:** Capital and connected supply hubs.
- **Supply hubs:** Buildings that project supply into nearby voxel cells.
- **Infrastructure:** Increases supply flow and movement speed.
- **Encirclement:** Units cut off from supply lose organization recovery, fuel, and combat performance.
- **Unit supply use:** Heavy divisions consume more supply.
- **Logistics support:** Reduces division supply needs.

For the vertical slice, a simplified supply calculation is enough:

- Voxel cell supply capacity = local infrastructure + nearby supply hub + capital connection.
- Army supply demand = sum of division supply use in the cell and adjacent contested cells.
- If demand exceeds capacity, apply supply penalties.

### 13.1 Voxel Encirclement and Supply Connectivity

The voxel strategy grid should make encirclement a core mechanic. A division is considered supplied only if its current cell can trace a valid path through friendly-controlled cells to a supply source.

Supply sources:

- **Capital cell:** Main national supply origin.
- **Major city cell:** Local supply source if connected to the country.
- **Supply hub cell:** Projects supply through nearby friendly cells.
- **Port cell placeholder:** Future naval supply source when navy/sea trade is added.

Supply path rules:

- Supply can pass through friendly-controlled land cells.
- Roads and high infrastructure increase supply range and capacity.
- Enemy-controlled cells block supply.
- Water cells block land supply unless future port/naval rules allow it.
- Impassable mountain cells block supply unless a road/pass exists.
- Enemy zones of control can reduce or block supply depending on balance.

Encirclement penalties:

- **Immediately:** Unit cannot receive reinforcement or equipment replacement.
- **After short delay:** Organization recovery is reduced.
- **After sustained encirclement:** Fuel/ammunition shortages reduce attack, defense, and movement.
- **Long-term:** Attrition rises and the unit risks forced retreat or surrender.

This system allows players to win by maneuver, not only by direct frontal combat. Cutting a corridor, road, city, or supply hub can be as valuable as destroying enemy divisions directly.

## 14. Technology and Progression

The first version should include a small research tree or upgrade system.

Research categories:

- **Infantry equipment:** Better weapons, defense, soft attack.
- **Artillery:** Better soft attack.
- **Armor:** Unlock light/medium tanks and improve armor.
- **Logistics:** Better supply, infrastructure, fuel efficiency.
- **Industry:** Faster construction and production efficiency.
- **Doctrine:** Army-wide bonuses to planning, defense, breakthrough, organization.

Keep research time-based and simple:

- One or two research slots per country.
- Research consumes time, not resources.
- Some technologies require earlier technologies.

## 15. Government and Internal Management

Keep politics light in the vertical slice.

- **Political power income:** Generated daily by country stability and government level.
- **Stability:** Affects factory output, resistance, and political power.
- **War support:** Affects mobilization and surrender resistance.
- **Laws:** Conscription, economy law, trade law.
- **Advisors placeholder:** Optional modifiers purchased with political power.

Example laws:

- **Conscription:** Volunteer Army, Limited Draft, Extensive Draft.
- **Economy:** Civilian Economy, Partial Mobilization, War Economy.
- **Trade:** Closed Economy, Limited Exports, Free Trade.

## 16. User Interface Screens

Required vertical-slice UI:

- **Main map view:** Select chunks, view terrain, owner, controller, supply, buildings, units.
- **Country overview:** Resources, factories, manpower, money, stability, war support.
- **Production screen:** Assign factories to equipment lines.
- **Construction screen:** Queue buildings in states/chunks.
- **Division designer:** Build templates and preview stats/terrain modifiers.
- **Army screen:** View divisions, assign generals, issue orders.
- **General details panel:** Stats, traits, command limit, assigned divisions.
- **Diplomacy screen:** Relations, actions, trade, war status.
- **Trade screen:** Import/export resources.
- **Research screen:** Pick technologies/upgrades.
- **War summary panel:** Front status, casualties, occupied victory value, capitulation progress.

## 17. Godot 2.5D Presentation Plan

The game should use Godot Engine with a 2.5D voxel-style map. The map is technically 3D and built from voxel/cell terrain, but it should play like a readable strategy board rather than a free-rotation 3D globe.

### 17.1 Visual Style

- Low-poly or stylized 3D voxel/cell terrain-board map.
- Countries colored by owner.
- Voxel cell borders visible when zoomed in.
- Terrain voxel meshes/materials show plains, mountains, forests, deserts, cities, rivers, roads, and water.
- Height variation shows hills, mountains, passes, and plateaus.
- Water cells east of Azerbaijan form the Caspian Sea.
- Cities, supply hubs, forts, roads, and resources are shown with clear icons or small 3D markers.
- Units represented by 3D counters or simplified models.
- UI remains 2D overlay for clarity.

### 17.2 Camera

- Fixed-rotation strategic camera.
- Player can pan the map horizontally/vertically.
- Player can zoom in and zoom out.
- Player cannot rotate the camera.
- Camera angle should remain consistent to preserve map readability and reduce control complexity.
- Strategic zoom levels:
  - Far: country colors and frontlines.
  - Medium: states, armies, supply.
  - Close: chunks, terrain, individual divisions.

### 17.3 Godot Implementation Notes

- Use Godot 4 as the target engine.
- Use 3D nodes or instanced meshes for voxel cells, unit counters, borders, and map markers.
- Use Godot Control/UI nodes for management screens and overlays.
- Keep simulation logic separate from scene/rendering logic.
- Store countries, chunks, terrain, battalions, generals, and technologies in data files or Godot resources.
- Avoid relying on physics for strategy movement; movement should be data/grid based.
- Use pathfinding over the voxel/cell grid rather than physics navigation.
- Recalculate supply connectivity periodically or when cell control changes, not every rendered frame.
- Use instancing, chunk batching, or mesh merging if the voxel map becomes large.
- The voxel map should be fixed strategic terrain, not a fully destructible sandbox world.

### 17.4 Voxel Map Readability Rules

- Keep cell size large enough for strategy readability.
- Avoid excessive visual noise from too many tiny cells.
- Show detailed cell borders only at medium/close zoom.
- Use overlays for ownership, supply, terrain, diplomacy, and frontlines.
- Make encircled units visually obvious with warning icons or red supply indicators.
- Make roads, cities, and supply hubs easy to identify because they drive maneuver strategy.

## 18. Data Model

The game should be data-driven so countries, units, terrain, and technologies can be balanced without rewriting code.

Core data tables:

- **Countries:** Name, color, capital, resources, laws, AI personality.
- **Voxel cells/chunks:** ID, grid coordinates, elevation, terrain, owner, controller, passability, movement cost, roads, cities, supply hubs, buildings, resources.
- **States:** Grouped voxel cells, building slots, regional resources.
- **Battalions:** Stats, equipment requirements, terrain modifiers.
- **Support companies:** Bonuses, costs, requirements.
- **Division templates:** Battalion/support layout.
- **Generals:** Stats, traits, portrait, command capacity.
- **Technologies:** Unlocks, modifiers, prerequisites.
- **Diplomacy:** Relations, treaties, wars, trade deals.
- **Production lines:** Equipment type, assigned factories, efficiency.
- **Supply graph:** Connectivity from capitals, cities, supply hubs, roads, and controlled cells.

## 19. Save/Load Requirements

The vertical slice should support saving because strategy games are long-form.

Save data should include:

- Current date/time speed.
- Countries and resources.
- Voxel cell owner/controller state.
- Voxel cell buildings, roads, cities, supply hubs, and passability data.
- Buildings and construction queues.
- Divisions, templates, generals, orders.
- Wars, diplomacy, trade deals.
- Production and research progress.
- AI state per country.

## 20. Balance Targets

The game should be easy to understand but hard to master.

- Infantry should be affordable and reliable.
- Tanks should be powerful but expensive and terrain-limited.
- Artillery should improve attack but increase supply demand.
- Specialized units should matter in specific terrain.
- Economy should force tradeoffs between industry, military, and infrastructure.
- Supply should punish overstacking.
- Defensive AI should be beatable but not passive.

## 21. First Playable Scenario

Create a South Caucasus vertical-slice region with Azerbaijan and nearby countries:

- **Azerbaijan:** Main playable country, balanced economy, moderate army, access to oil resources, and the Caspian Sea on its eastern side.
- **Armenia:** AI-controlled neighboring country with mountainous terrain, strong defensive positions, and likely early border tension.
- **Georgia:** AI-controlled northern/western neighbor with mountain passes, trade potential, and defensive behavior.
- **Russia:** AI-controlled major northern power with stronger industry and military presence, mostly defensive in the vertical slice unless attacked.
- **Iran:** AI-controlled southern neighbor with larger manpower and resource potential, mostly defensive unless attacked.
- **Caspian Sea:** Eastern map boundary beside Azerbaijan, represented by water voxel cells that block land movement and create future expansion space for naval trade, ports, and sea control.

Scenario objective:

- Build economy.
- Design at least one improved division template.
- Assign divisions to a general.
- Justify war against a rival.
- Capture border voxel cells, then cities, supply hubs, roads, and victory cells.
- Force capitulation or peace.

## 22. Development Milestones

### Milestone 1: Map and Country Foundation

- Render Godot 2.5D voxel/cell map chunks with fixed camera rotation.
- Select voxel cells and show terrain, elevation, owner, controller, supply, roads, cities, and buildings.
- Load country and voxel cell data.
- Support ownership changes.

### Milestone 2: Economy and Production

- Add resources, factories, construction, and equipment stockpiles.
- Implement production lines.
- Add basic trade between countries.

### Milestone 3: Units and Movement

- Create division entities.
- Move divisions cell-to-cell across the voxel grid.
- Add pathfinding, roads, supply, infrastructure, elevation, and terrain movement costs.

### Milestone 4: Division Designer and Generals

- Build division templates from battalions/support companies.
- Calculate stats and terrain modifiers.
- Assign divisions to generals.
- Apply general bonuses.

### Milestone 5: Combat and Conquest

- Resolve battles over time.
- Apply terrain, supply, encirclement, multi-direction attack, entrenchment, and general modifiers.
- Capture voxel cells and calculate victory/capitulation.

### Milestone 6: Diplomacy and Defensive AI

- Add relations, trade, justify war, declare war, peace.
- Implement AI defensive states and border defense.
- Let AI train divisions and react to threats.

### Milestone 7: Scenario Polish

- Add tutorial hints.
- Add map overlays for terrain, supply, diplomacy, ownership.
- Add war summary and victory flow.
- Balance first scenario.

## 23. Future Expansion After Vertical Slice

After the vertical slice works, expand in this order:

1. **Air force:** Air regions, fighters, bombers, air superiority, close air support.
2. **Navy:** Sea regions, fleets, convoys, naval invasions, blockades.
3. **Advanced diplomacy:** Alliances, factions, puppets, guarantees, sanctions.
4. **Espionage:** Spies, intel networks, sabotage, counterintelligence.
5. **Deeper politics:** Ideologies, elections, civil wars, ministers, national focuses.
6. **Advanced logistics:** Railways, ports, truck supply, stockpile depots.
7. **Weather and seasons:** Mud, snow, winter attrition, storms.
8. **Mod support:** Data-driven countries, maps, units, technologies, scenarios.
9. **Multiplayer:** Only after core simulation is stable.

## 24. Biggest Risks and Solutions

- **Risk: Scope becomes too large.** Solution: Build only land warfare and basic diplomacy first.
- **Risk: 3D map consumes too much time.** Solution: Separate simulation from rendering and allow a 2D fallback.
- **Risk: Combat becomes unreadable.** Solution: Show clear modifiers and battle breakdowns in UI.
- **Risk: AI is too hard to build.** Solution: Start with defensive state-machine AI, not full grand strategy planning.
- **Risk: Division designer is confusing.** Solution: Provide starter templates and warnings for bad designs.
- **Risk: Economy is overwhelming.** Solution: Use few resources and clear production chains.

## 25. Definition of Done for the Vertical Slice

The vertical slice is complete when the player can:

- Choose a country in a small region.
- View a chunked world map with terrain and country borders.
- Build factories/infrastructure and produce equipment.
- Trade for missing resources.
- Design at least three useful division templates.
- Train divisions and assign them to generals.
- Move units across chunks.
- Fight battles affected by terrain, supply, generals, and division design.
- Capture enemy chunks and force capitulation.
- Use basic diplomacy to justify war and manage trade/non-aggression.
- Fight against AI that defends its borders and important territory.

## 26. Recommended First Implementation Order

1. Build the data model and map chunk selection.
2. Add countries, ownership, and resource display.
3. Add division entities and movement.
4. Add simple combat without designer.
5. Add division templates and stat calculation.
6. Add terrain modifiers and supply.
7. Add generals and army assignment.
8. Add economy, production, and equipment requirements.
9. Add diplomacy and war declarations.
10. Add defensive AI.
11. Polish UI overlays and first scenario balance.
