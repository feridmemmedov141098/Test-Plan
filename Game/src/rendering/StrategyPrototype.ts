import * as THREE from 'three'
import { CombatSystem, type CombatInstance } from '../game/combat/CombatSystem'
import type { BattleProjection } from '../game/combat/CombatSimulator'
import type { EquipmentCategory } from '../game/equipment/EquipmentTypes'
import {
  BUILDING_DEFINITIONS,
  MAX_ACTIVE_CONSTRUCTION_JOBS,
  type BuildingType,
  type ConstructionJob,
} from '../game/economy/ConstructionTypes'
import { EconomySystem, type EconomyState } from '../game/economy/EconomySystem'
import { ProvincePathfindingSystem } from '../game/movement/ProvincePathfindingSystem'
import { ProvinceState } from '../game/province/ProvinceState'
import { COUNTRY_COLORS, COUNTRY_NAMES, type CountryId, type Province } from '../game/province/provinceTypes'
import type { ResourceYields } from '../game/province/provinceTypes'
import {
  calculateDivisionStats,
  createStarterDivisionTemplates,
  MAX_BATTALIONS_PER_TEMPLATE,
  type DivisionNode,
  type DivisionTemplate,
  type TrainingJob,
} from '../game/units/DivisionDesignerTypes'
import { buildUnitCombatFields, type UnitState } from '../game/units/UnitTypes'
import { ProvinceMapRenderer } from './ProvinceMapRenderer'
import { UnitModelFactory } from './UnitModelFactory'

export type TimeSpeed = 0 | 1 | 2 | 5 | 10

export interface PrototypeHudState {
  isLoading: boolean
  status: string
  selectedProvince: {
    id: number
    name: string
    ownerName: string
    controllerName: string
    unitCount: number
    buildings: {
      barracks: number
      militaryComplex: number
    }
    terrainType: string
    economyRegion: string
    primaryResource: string
    resourceYields: ResourceYields
    isContested: boolean
  } | null
  selectedUnit: {
    name: string
    owner: string
    status: string
    manpower: number
    maxManpower: number
    organization: number
    maxOrganization: number
    equipment: number
    maxEquipment: number
    softAttack: number
    hardAttack: number
    attack: number
    defense: number
    breakthrough: number
    armor: number
    piercing: number
    hardness: number
    maneuverability: number
    supplyUse: number
    fuelUse: number
    reliability: number
    fortificationDays: number
    fortificationLevel: number
    supplyHours: number
    maxSupplyHours: number
    hoursOutOfSupply: number
    encircledHours: number
    isEncircled: boolean
    battalions: Array<{
      name: string
      status: string
      manpower: number
      maxManpower: number
      equipment: number
      maxEquipment: number
      organization: number
      maxOrganization: number
    }>
    recentCombatEvents: string[]
    reinforcementDelayHours: number
  } | null
  economy: EconomyState | null
  construction: {
    jobs: ConstructionJob[]
    playerBuildings: {
      barracks: number
      militaryComplex: number
    }
    validConstructionProvinceIds: number[]
  }
  training: {
    jobs: TrainingJob[]
    templates: DivisionTemplate[]
    validDeploymentProvinceIds: number[]
    trainingSlots: number
    activeTrainingCount: number
  }
  logistics: {
    supplyVehicleCount: number
    activeSupplyVehicleCount: number
  }
  activeCombat: CombatInstance | null
  activeCombats: ActiveCombatOverlay[]
  battleForecast: BattleProjection | null
  time: {
    day: number
    hour: number
    speed: TimeSpeed
  }
  mapStats: {
    provinceCount: number
    azProvinceCount: number
    amProvinceCount: number
    azUnitCount: number
    amUnitCount: number
  } | null
}

export interface ActiveCombatOverlay {
  id: string
  provinceId: number
  screenPosition: { x: number; y: number } | null
  attacker: {
    countryId: string
    countryName: string
    totalManpower: number
    totalMaxManpower: number
    avgOrganization: number
    maxOrganization: number
    unitCount: number
  }
  defender: {
    countryId: string
    countryName: string
    totalManpower: number
    totalMaxManpower: number
    avgOrganization: number
    maxOrganization: number
    unitCount: number
  }
  advantage: 'attacker' | 'defender' | 'even'
  confidence: number
  terrain: string
}

type HudCallback = (state: PrototypeHudState) => void

interface SupplyVehicleState {
  id: string
  countryId: CountryId
  sourceProvinceId: number
  targetUnitId: string | null
  position: THREE.Vector3
  routeProvinceIds: number[]
  route: THREE.Vector3[]
  routeIndex: number
  status: 'available' | 'toUnit' | 'returning'
  cargoHours: number
}

interface BattleEffect {
  id: string
  group: THREE.Group
  age: number
  duration: number
}

const BASE_CAMERA_HEIGHT = 190
const UNIT_Y = 2.2
const SIM_HOURS_PER_SECOND = 6
const PLAYER_COUNTRY_ID: CountryId = 'azerbaijan'
const MILITARY_COMPLEX_DAILY_EQUIPMENT = 25
const TRAINING_REFUND_MULTIPLIER = 0.5
const MOVEMENT_SPEED_MULTIPLIER = 0.2
const FORTIFICATION_DAYS_TO_MAX = 7
const MAX_SUPPLY_HOURS = 72
const SUPPLY_DISPATCH_THRESHOLD = 46
const SUPPLY_DELIVERY_HOURS = 42
const SUPPLY_VEHICLE_SPEED = 36

export class StrategyPrototype {
  private readonly container: HTMLDivElement
  private readonly setHudState: HudCallback
  private readonly scene = new THREE.Scene()
  private readonly raycaster = new THREE.Raycaster()
  private readonly pointer = new THREE.Vector2()
  private readonly clock = new THREE.Clock()
  private readonly keyState = new Set<string>()
  private readonly cameraTarget = new THREE.Vector3(0, 0, 0)
  private readonly mapRenderer = new ProvinceMapRenderer()
  private readonly unitFactory = new UnitModelFactory()
  private readonly economySystem = new EconomySystem()
  private readonly combatSystem = new CombatSystem()
  private readonly divisionTemplates = new Map<string, DivisionTemplate>()
  private readonly units: UnitState[] = []
  private readonly unitGroups = new Map<string, THREE.Group>()
  private readonly unitHitMeshes: THREE.Object3D[] = []
  private readonly selectedUnitIds = new Set<string>()
  private readonly unitSelectionRings = new Map<string, THREE.Mesh>()
  private readonly supplyVehicles: SupplyVehicleState[] = []
  private readonly supplyVehicleGroups = new Map<string, THREE.Mesh>()
  private readonly battleEffects: BattleEffect[] = []
  private renderer: THREE.WebGLRenderer | null = null
  private camera: THREE.OrthographicCamera | null = null
  private provinceState: ProvinceState | null = null
  private pathfinding: ProvincePathfindingSystem | null = null
  private unitSelectionRingGeometry: THREE.TorusGeometry | null = null
  private unitSelectionRingMaterial: THREE.MeshBasicMaterial | null = null
  private selectionBoxElement: HTMLDivElement | null = null
  private routeLine: THREE.Line | null = null
  private animationFrame = 0
  private selectedProvinceId: number | null = null
  private selectedUnitId: string | null = null
  private isMiddleDragging = false
  private leftDrag: {
    pointerId: number
    startX: number
    startY: number
    currentX: number
    currentY: number
    isSelecting: boolean
    addToSelection: boolean
  } | null = null
  private lastPointer = { x: 0, y: 0 }
  private simHourAccumulator = 0
  private currentDay = 1
  private currentHour = 0
  private timeSpeed: TimeSpeed = 1
  private hudStatus = 'Loading province map'
  private hudUpdateTimer = 0
  private isDisposed = false
  private nextConstructionJobId = 1
  private nextTrainingJobId = 1
  private nextUnitSerial = 1
  private nextTemplateSerial = 1
  private nextSupplyVehicleSerial = 1
  private nextBattleEffectSerial = 1
  private readonly HUD_UPDATE_INTERVAL = 0.15

  constructor(container: HTMLDivElement, setHudState: HudCallback) {
    this.container = container
    this.setHudState = setHudState
  }

  async start(): Promise<void> {
    try {
      if (this.isDisposed) {
        return
      }

      this.setHudState({
        isLoading: true,
        selectedProvince: null,
        selectedUnit: null,
        economy: null,
        construction: {
          jobs: [],
          playerBuildings: { barracks: 0, militaryComplex: 0 },
          validConstructionProvinceIds: [],
        },
        training: {
          jobs: [],
          templates: [],
          validDeploymentProvinceIds: [],
          trainingSlots: 0,
          activeTrainingCount: 0,
        },
        activeCombat: null,
        activeCombats: [],
        battleForecast: null,
        logistics: { supplyVehicleCount: 0, activeSupplyVehicleCount: 0 },
        time: { day: 1, hour: 0, speed: 1 },
        status: 'Loading province map',
        mapStats: null,
      })

      this.setupRenderer()
      this.setupCamera()
      this.setupLighting()
      const provinces = await this.mapRenderer.load()

      if (this.isDisposed) {
        return
      }

      this.provinceState = new ProvinceState(provinces)
      this.pathfinding = new ProvincePathfindingSystem(this.provinceState.provinces)
      this.mapRenderer.refreshAllProvinceColors(this.provinceState.provinces)
      this.scene.add(this.mapRenderer.object)
      await this.unitFactory.load()

      if (this.isDisposed) {
        return
      }

      this.initializeDivisionTemplates()
      this.initializeStartingBuildings()
      this.economySystem.ensureProductionSlots(PLAYER_COUNTRY_ID, this.getPlayerBuildingCounts().militaryComplex)
      this.economySystem.ensureProductionSlots('armenia', this.getBuildingCountsForCountry('armenia').militaryComplex)
      this.createSelectionMeshes()
      this.createUnits()
      this.economySystem.tickDaily(this.provinceState.provinces)
      this.absorbSupplyTruckStockpiles()
      this.addEventListeners()
      this.resize()
      this.updateHud('Map ready')
      this.animate()
    } catch (error) {
      if (this.isDisposed) {
        return
      }

      this.setHudState({
        isLoading: false,
        selectedProvince: null,
        selectedUnit: null,
        economy: null,
        construction: {
          jobs: [],
          playerBuildings: { barracks: 0, militaryComplex: 0 },
          validConstructionProvinceIds: [],
        },
        training: {
          jobs: [],
          templates: [],
          validDeploymentProvinceIds: [],
          trainingSlots: 0,
          activeTrainingCount: 0,
        },
        activeCombat: null,
        activeCombats: [],
        battleForecast: null,
        logistics: { supplyVehicleCount: 0, activeSupplyVehicleCount: 0 },
        time: { day: this.currentDay, hour: this.currentHour, speed: this.timeSpeed },
        status: error instanceof Error ? error.message : 'Province map failed to load',
        mapStats: null,
      })
    }
  }

  dispose(): void {
    this.isDisposed = true
    cancelAnimationFrame(this.animationFrame)
    window.removeEventListener('resize', this.resize)
    window.removeEventListener('keydown', this.handleKeyDown)
    window.removeEventListener('keyup', this.handleKeyUp)
    this.container.removeEventListener('pointerdown', this.handlePointerDown)
    this.container.removeEventListener('pointermove', this.handlePointerMove)
    this.container.removeEventListener('pointerup', this.handlePointerUp)
    this.container.removeEventListener('pointerleave', this.handlePointerLeave)
    this.container.removeEventListener('wheel', this.handleWheel)
    this.container.removeEventListener('contextmenu', this.handleContextMenu)
    this.mapRenderer.dispose()
    this.selectionBoxElement?.remove()
    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh || object instanceof THREE.Line)) {
        return
      }

      object.geometry?.dispose()

      if (Array.isArray(object.material)) {
        object.material.forEach((material) => material.dispose())
      } else {
        object.material?.dispose()
      }
    })
    this.renderer?.dispose()
    this.renderer?.domElement.remove()
  }

  private setupRenderer(): void {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.container.appendChild(this.renderer.domElement)
    this.scene.background = new THREE.Color(0x3b453f)
    this.scene.fog = new THREE.Fog(0x3b453f, 300, 680)
  }

  private setupCamera(): void {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 900)
    this.camera.position.set(0, 170, 165)
    this.camera.zoom = 0.95
    this.camera.lookAt(this.cameraTarget)
    this.scene.add(this.camera)
  }

  private setupLighting(): void {
    const hemisphere = new THREE.HemisphereLight(0xeaf2ff, 0x5f6043, 1.5)
    const ambient = new THREE.AmbientLight(0xffedd2, 0.46)
    const sun = new THREE.DirectionalLight(0xfff2cf, 3.5)
    sun.position.set(-80, 150, 70)
    sun.castShadow = true
    sun.shadow.mapSize.set(4096, 4096)
    sun.shadow.camera.left = -150
    sun.shadow.camera.right = 150
    sun.shadow.camera.top = 150
    sun.shadow.camera.bottom = -150
    sun.shadow.camera.near = 20
    sun.shadow.camera.far = 330
    sun.shadow.bias = -0.00008
    this.scene.add(hemisphere, ambient, sun)
  }

  private createSelectionMeshes(): void {
    const ringGeometry = new THREE.TorusGeometry(1.6, 0.06, 8, 52)
    ringGeometry.rotateX(Math.PI / 2)
    this.unitSelectionRingGeometry = ringGeometry
    this.unitSelectionRingMaterial = new THREE.MeshBasicMaterial({ color: 0xf7df72, transparent: true, opacity: 0.92 })

    this.routeLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0xffd76c, transparent: true, opacity: 0.94 }),
    )
    this.scene.add(this.routeLine)

    this.selectionBoxElement = document.createElement('div')
    this.selectionBoxElement.className = 'map-selection-box'
    this.container.appendChild(this.selectionBoxElement)
  }

  private createUnits(): void {
    if (!this.provinceState) {
      return
    }

    const spawnAzerbaijan = pickSpawnProvinces(this.provinceState.getByCountry('azerbaijan'), 5)
    const spawnArmenia = pickSpawnProvinces(this.provinceState.getByCountry('armenia'), 5)
    const templates = [...this.divisionTemplates.values()]
    const armeniaTemplates = [...templates].reverse()

    spawnAzerbaijan.forEach((province, index) => this.createUnit(`az-${index + 1}`, `AZ Division ${index + 1}`, 'azerbaijan', province, templates[index % templates.length]))
    spawnArmenia.forEach((province, index) => this.createUnit(`am-${index + 1}`, `AM Division ${index + 1}`, 'armenia', province, armeniaTemplates[index % armeniaTemplates.length]))
  }

  private initializeDivisionTemplates(): void {
    for (const template of createStarterDivisionTemplates()) {
      this.divisionTemplates.set(template.id, template)
    }
  }

  private initializeStartingBuildings(): void {
    if (!this.provinceState) {
      return
    }

    for (const countryId of ['azerbaijan', 'armenia'] as CountryId[]) {
      const bestProvince = [...this.provinceState.getByCountry(countryId)]
        .sort((left, right) => right.resourceYields.industry - left.resourceYields.industry || right.resourceYields.manpower - left.resourceYields.manpower)[0]

      if (!bestProvince) {
        continue
      }

      bestProvince.buildings.barracks = 1
      bestProvince.buildings.militaryComplex = 1
    }
  }

  private createUnit(id: string, name: string, countryId: CountryId, province: Province, template: DivisionTemplate): void {
    const combatFields = buildUnitCombatFields(id, template.id, template.name, template.nodes, template.stats)
    const unit: UnitState = {
      id,
      name,
      ...combatFields,
      countryId,
      owner: COUNTRY_NAMES[countryId],
      provinceId: province.id,
      position: province.centerWorld.clone().setY(UNIT_Y),
      route: [],
      routeProvinceIds: [],
      routeIndex: 0,
      experience: 0,
      fortifiedProvinceId: province.id,
      fortificationDays: FORTIFICATION_DAYS_TO_MAX,
      supplyHours: MAX_SUPPLY_HOURS,
      maxSupplyHours: MAX_SUPPLY_HOURS,
      hoursOutOfSupply: 0,
      encircledHours: 0,
      isEncircled: false,
      lastSupplySourceProvinceId: province.id,
      recentCombatEvents: [],
      status: 'idle',
      reinforcementDelayHours: 0,
    }
    const group = this.unitFactory.create(COUNTRY_COLORS[countryId])
    group.position.copy(unit.position)
    group.userData.unitId = id
    group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.userData.unitId = id
        this.unitHitMeshes.push(object)
      }
    })
    province.units.push(id)
    this.units.push(unit)
    this.unitGroups.set(id, group)
    this.scene.add(group)
  }

  queueConstruction(provinceId: number, buildingType: BuildingType): void {
    if (this.isDisposed || !this.provinceState) {
      return
    }

    const province = this.provinceState.getProvince(provinceId)
    const economy = this.economySystem.countries[PLAYER_COUNTRY_ID]
    const definition = BUILDING_DEFINITIONS[buildingType]

    if (!this.isPlayerControlledProvince(province) || province.isContested) {
      this.updateHud('Construction requires controlled, stable province')
      return
    }

    if (economy.constructionQueue.length >= MAX_ACTIVE_CONSTRUCTION_JOBS) {
      this.updateHud('Construction queue is full')
      return
    }

    if (this.getProjectedBuildingCount(province, buildingType) >= definition.maxPerProvince) {
      this.updateHud(`${definition.name} limit reached here`)
      return
    }

    if (!this.economySystem.spendResources(PLAYER_COUNTRY_ID, definition.cost)) {
      this.updateHud('Not enough resources')
      return
    }

    economy.constructionQueue.push({
      id: `build-${this.nextConstructionJobId++}`,
      countryId: PLAYER_COUNTRY_ID,
      provinceId,
      provinceName: province.displayName,
      buildingType,
      buildingName: definition.name,
      cost: { ...definition.cost },
      totalDays: definition.buildDays,
      daysRemaining: definition.buildDays,
    })
    this.updateHud(`${definition.name} queued`)
  }

  cancelConstruction(jobId: string): void {
    const economy = this.economySystem.countries[PLAYER_COUNTRY_ID]
    const job = economy.constructionQueue.find((candidate) => candidate.id === jobId)

    if (!job) {
      return
    }

    economy.constructionQueue = economy.constructionQueue.filter((candidate) => candidate.id !== jobId)
    this.economySystem.refundResources(PLAYER_COUNTRY_ID, job.cost, TRAINING_REFUND_MULTIPLIER)
    this.updateHud('Construction cancelled')
  }

  queueDivisionTraining(templateId: string, provinceId: number): void {
    if (this.isDisposed || !this.provinceState) {
      return
    }

    const template = this.divisionTemplates.get(templateId)
    const province = this.provinceState.getProvince(provinceId)
    const economy = this.economySystem.countries[PLAYER_COUNTRY_ID]
    const activeTrainingCount = economy.trainingQueue.filter((job) => job.status === 'training').length

    if (!template || template.nodes.length === 0) {
      this.updateHud('Select a valid division template')
      return
    }

    if (activeTrainingCount >= this.getPlayerBuildingCounts().barracks) {
      this.updateHud('No free barracks training slot')
      return
    }

    if (!this.isValidDeploymentProvince(province)) {
      this.updateHud('Deployment requires controlled barracks')
      return
    }

    const resourceCost = { ...template.stats.resourceCost, manpower: template.stats.manpower }

    if (
      !this.economySystem.canAfford(PLAYER_COUNTRY_ID, resourceCost) ||
      !this.economySystem.canAffordEquipment(PLAYER_COUNTRY_ID, template.stats.equipmentRequirements) ||
      economy.equipmentPool < template.stats.equipment * 0.25
    ) {
      this.updateHud('Not enough manpower, equipment, or resources')
      return
    }

    this.economySystem.spendResources(PLAYER_COUNTRY_ID, resourceCost)
    this.economySystem.spendEquipmentStockpiles(PLAYER_COUNTRY_ID, template.stats.equipmentRequirements)
    economy.equipmentPool -= template.stats.equipment * 0.25
    economy.trainingQueue.push({
      id: `train-${this.nextTrainingJobId++}`,
      countryId: PLAYER_COUNTRY_ID,
      provinceId,
      provinceName: province.displayName,
      templateId,
      templateName: template.name,
      nodes: template.nodes.map((node) => ({ ...node })),
      stats: template.stats,
      totalDays: template.stats.trainingDays,
      daysRemaining: template.stats.trainingDays,
      status: 'training',
    })
    this.updateHud(`${template.name} training`)
  }

  cancelTraining(jobId: string): void {
    const economy = this.economySystem.countries[PLAYER_COUNTRY_ID]
    const job = economy.trainingQueue.find((candidate) => candidate.id === jobId)

    if (!job) {
      return
    }

    economy.trainingQueue = economy.trainingQueue.filter((candidate) => candidate.id !== jobId)
    this.economySystem.refundResources(PLAYER_COUNTRY_ID, { ...job.stats.resourceCost, manpower: job.stats.manpower }, TRAINING_REFUND_MULTIPLIER)
    this.economySystem.refundEquipmentStockpiles(PLAYER_COUNTRY_ID, job.stats.equipmentRequirements, TRAINING_REFUND_MULTIPLIER)
    economy.equipmentPool += job.stats.equipment * 0.25 * TRAINING_REFUND_MULTIPLIER
    this.updateHud('Training cancelled')
  }

  setProductionLine(lineId: string, category: EquipmentCategory): void {
    this.economySystem.setProductionLine(PLAYER_COUNTRY_ID, lineId, category)
    this.updateHud('Production line updated')
  }

  saveDivisionTemplate(draft: { id?: string; name: string; nodes: DivisionNode[] }): void {
    const nodes = draft.nodes.slice(0, MAX_BATTALIONS_PER_TEMPLATE)

    if (nodes.length === 0) {
      this.updateHud('Template needs a battalion')
      return
    }

    const id = draft.id && this.divisionTemplates.has(draft.id) ? draft.id : `template-custom-${this.nextTemplateSerial++}`
    const name = draft.name.trim() || 'New Division'
    const template: DivisionTemplate = {
      id,
      name,
      nodes,
      stats: calculateDivisionStats(nodes),
    }

    this.divisionTemplates.set(id, template)
    this.updateHud(`${name} template saved`)
  }

  private addEventListeners(): void {
    window.addEventListener('resize', this.resize)
    window.addEventListener('keydown', this.handleKeyDown)
    window.addEventListener('keyup', this.handleKeyUp)
    this.container.addEventListener('pointerdown', this.handlePointerDown)
    this.container.addEventListener('pointermove', this.handlePointerMove)
    this.container.addEventListener('pointerup', this.handlePointerUp)
    this.container.addEventListener('pointerleave', this.handlePointerLeave)
    this.container.addEventListener('wheel', this.handleWheel, { passive: false })
    this.container.addEventListener('contextmenu', this.handleContextMenu)
  }

  private readonly resize = (): void => {
    if (!this.renderer || !this.camera) {
      return
    }

    const width = this.container.clientWidth
    const height = this.container.clientHeight
    const aspect = width / Math.max(1, height)

    this.camera.left = (-BASE_CAMERA_HEIGHT * aspect) / 2
    this.camera.right = (BASE_CAMERA_HEIGHT * aspect) / 2
    this.camera.top = BASE_CAMERA_HEIGHT / 2
    this.camera.bottom = -BASE_CAMERA_HEIGHT / 2
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    this.keyState.add(event.code)

    if (event.code === 'Space') {
      event.preventDefault()
      this.setTimeSpeed(this.timeSpeed === 0 ? 1 : 0)
    } else if (event.code === 'Digit1' || event.code === 'Numpad1') {
      this.setTimeSpeed(1)
    } else if (event.code === 'Digit2' || event.code === 'Numpad2') {
      this.setTimeSpeed(2)
    } else if (event.code === 'Digit3' || event.code === 'Numpad3') {
      this.setTimeSpeed(5)
    } else if (event.code === 'Digit4' || event.code === 'Numpad4') {
      this.setTimeSpeed(10)
    }
  }

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.keyState.delete(event.code)
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (event.button === 2) {
      event.preventDefault()
      event.stopPropagation()
      return
    }

    if (event.button === 1) {
      event.preventDefault()
      this.isMiddleDragging = true
      this.lastPointer = { x: event.clientX, y: event.clientY }
      this.container.setPointerCapture(event.pointerId)
      return
    }

    if (event.button === 0) {
      this.leftDrag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        currentX: event.clientX,
        currentY: event.clientY,
        isSelecting: false,
        addToSelection: event.shiftKey,
      }
      this.container.setPointerCapture(event.pointerId)
    }
  }

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (this.leftDrag?.pointerId === event.pointerId) {
      this.leftDrag.currentX = event.clientX
      this.leftDrag.currentY = event.clientY

      const movedDistance = Math.hypot(event.clientX - this.leftDrag.startX, event.clientY - this.leftDrag.startY)

      if (movedDistance >= 6) {
        this.leftDrag.isSelecting = true
        this.updateSelectionBox(this.leftDrag)
      }

      return
    }

    if (!this.isMiddleDragging || !this.camera) {
      return
    }

    const deltaX = event.clientX - this.lastPointer.x
    const deltaY = event.clientY - this.lastPointer.y
    const scale = 0.42 / this.camera.zoom
    this.cameraTarget.x -= deltaX * scale
    this.cameraTarget.z -= deltaY * scale
    this.clampCameraTarget()
    this.lastPointer = { x: event.clientX, y: event.clientY }
  }

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (event.button === 2) {
      event.preventDefault()
      event.stopPropagation()
      this.handleRightClick(event)
      return
    }

    if (event.button === 1) {
      event.preventDefault()
      this.isMiddleDragging = false
      this.container.releasePointerCapture(event.pointerId)
      return
    }

    if (event.button === 0) {
      if (this.leftDrag?.pointerId === event.pointerId) {
        const drag = this.leftDrag
        this.leftDrag = null
        this.hideSelectionBox()
        this.container.releasePointerCapture(event.pointerId)

        if (drag.isSelecting) {
          this.selectUnitsInScreenRect(drag)
          return
        }
      }

      this.handleLeftClick(event)
    }

  }

  private readonly handlePointerLeave = (): void => {
    this.isMiddleDragging = false
    this.leftDrag = null
    this.hideSelectionBox()
  }

  private readonly handleWheel = (event: WheelEvent): void => {
    if (!this.camera) {
      return
    }

    event.preventDefault()
    const zoomDelta = event.deltaY > 0 ? 0.88 : 1.12
    this.camera.zoom = THREE.MathUtils.clamp(this.camera.zoom * zoomDelta, 0.5, 3.1)
    this.camera.updateProjectionMatrix()
  }

  private readonly handleContextMenu = (event: MouseEvent): void => {
    event.preventDefault()
    event.stopPropagation()
  }

  private handleLeftClick(event: PointerEvent): void {
    const unitId = this.pickUnit(event)

    if (unitId) {
      if (event.shiftKey) {
        this.toggleUnitSelection(unitId)
      } else {
        this.setSelectedUnits([unitId], unitId)
      }
      const unit = this.units.find((entry) => entry.id === unitId)
      this.selectedProvinceId = unit?.provinceId ?? null
      this.setSelectedProvince(this.selectedProvinceId)
      this.updateSelectionVisuals()
      this.updateHud(this.selectedUnitIds.size > 1 ? `${this.selectedUnitIds.size} units selected` : 'Unit selected')
      return
    }

    const province = this.pickProvince(event)

    if (province) {
      if (!event.shiftKey) {
        this.clearUnitSelection()
      }
      this.selectedProvinceId = province.id
      this.setSelectedProvince(province.id)
      this.updateSelectionVisuals()
      this.updateHud('Province selected')
    }
  }

  private handleRightClick(event: PointerEvent): void {
    event.preventDefault()
    event.stopPropagation()

    if (!this.provinceState || !this.pathfinding || this.selectedUnitIds.size === 0) {
      return
    }

    const targetProvince = this.pickProvince(event)

    if (!targetProvince) {
      return
    }

    let issuedOrders = 0

    for (const unit of this.getSelectedUnits()) {
      if (unit.manpower <= 0 || unit.status === 'inCombat') {
        continue
      }

      if (targetProvince.controllerCountryId !== unit.countryId && !areAtWar(unit.countryId, targetProvince.controllerCountryId)) {
        continue
      }

      const path = this.pathfinding.findPath(unit.provinceId, targetProvince.id)

      if (path.length === 0) {
        continue
      }

      unit.routeProvinceIds = path
      unit.route = path.map((provinceId) => this.provinceState!.getProvince(provinceId).centerWorld.clone().setY(UNIT_Y))
      unit.routeIndex = 0
      unit.status = 'moving'
      unit.fortificationDays = 0
      unit.fortifiedProvinceId = null
      issuedOrders += 1
    }

    if (issuedOrders === 0) {
      this.updateHud('No province route')
      return
    }

    this.selectedProvinceId = targetProvince.id
    this.setSelectedProvince(targetProvince.id)
    this.updateSelectionVisuals()
    this.updateHud(issuedOrders > 1 ? `Move order issued to ${issuedOrders} units` : 'Move order issued')
  }

  private pickUnit(event: PointerEvent): string | null {
    if (!this.camera) {
      return null
    }

    this.updatePointer(event)
    this.raycaster.setFromCamera(this.pointer, this.camera)

    const hit = this.raycaster.intersectObjects(this.unitHitMeshes, false)[0]

    return hit?.object.userData.unitId ?? null
  }

  private pickProvince(event: PointerEvent): Province | null {
    if (!this.camera || !this.provinceState) {
      return null
    }

    this.updatePointer(event)
    this.raycaster.setFromCamera(this.pointer, this.camera)

    const hit = this.raycaster.intersectObjects(this.mapRenderer.getPickMeshes(), false)[0]

    return hit ? this.provinceState.getProvinceByMesh(hit.object) : null
  }

  private updatePointer(event: PointerEvent): void {
    const rect = this.container.getBoundingClientRect()
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  }

  private updateSelectionBox(drag: NonNullable<StrategyPrototype['leftDrag']>): void {
    if (!this.selectionBoxElement) {
      return
    }

    const containerRect = this.container.getBoundingClientRect()
    const left = Math.min(drag.startX, drag.currentX) - containerRect.left
    const top = Math.min(drag.startY, drag.currentY) - containerRect.top
    const width = Math.abs(drag.currentX - drag.startX)
    const height = Math.abs(drag.currentY - drag.startY)

    this.selectionBoxElement.style.display = 'block'
    this.selectionBoxElement.style.left = `${left}px`
    this.selectionBoxElement.style.top = `${top}px`
    this.selectionBoxElement.style.width = `${width}px`
    this.selectionBoxElement.style.height = `${height}px`
  }

  private hideSelectionBox(): void {
    if (this.selectionBoxElement) {
      this.selectionBoxElement.style.display = 'none'
    }
  }

  private selectUnitsInScreenRect(drag: NonNullable<StrategyPrototype['leftDrag']>): void {
    if (!this.camera) {
      return
    }

    const containerRect = this.container.getBoundingClientRect()
    const left = Math.min(drag.startX, drag.currentX) - containerRect.left
    const right = Math.max(drag.startX, drag.currentX) - containerRect.left
    const top = Math.min(drag.startY, drag.currentY) - containerRect.top
    const bottom = Math.max(drag.startY, drag.currentY) - containerRect.top
    const unitIds: string[] = []

    for (const unit of this.units) {
      if (unit.manpower <= 0) {
        continue
      }

      const screenPosition = this.getScreenPosition(unit.position)

      if (
        screenPosition.x >= left &&
        screenPosition.x <= right &&
        screenPosition.y >= top &&
        screenPosition.y <= bottom
      ) {
        unitIds.push(unit.id)
      }
    }

    if (unitIds.length === 0) {
      if (!drag.addToSelection) {
        this.clearUnitSelection()
        this.updateSelectionVisuals()
        this.updateHud('No units selected')
      }
      return
    }

    if (drag.addToSelection) {
      for (const unitId of unitIds) {
        this.selectedUnitIds.add(unitId)
      }
      this.selectedUnitId = unitIds.at(-1) ?? this.selectedUnitId
    } else {
      this.setSelectedUnits(unitIds, unitIds[0])
    }

    const selectedUnit = this.units.find((unit) => unit.id === this.selectedUnitId)
    this.selectedProvinceId = selectedUnit?.provinceId ?? null
    this.setSelectedProvince(this.selectedProvinceId)
    this.updateSelectionVisuals()
    this.updateHud(this.selectedUnitIds.size > 1 ? `${this.selectedUnitIds.size} units selected` : 'Unit selected')
  }

  private getScreenPosition(worldPosition: THREE.Vector3): { x: number; y: number } {
    const projected = worldPosition.clone().project(this.camera!)
    const containerRect = this.container.getBoundingClientRect()

    return {
      x: (projected.x * 0.5 + 0.5) * containerRect.width,
      y: (-projected.y * 0.5 + 0.5) * containerRect.height,
    }
  }

  private setSelectedUnits(unitIds: string[], primaryUnitId = unitIds[0] ?? null): void {
    this.selectedUnitIds.clear()

    for (const unitId of unitIds) {
      this.selectedUnitIds.add(unitId)
    }

    this.selectedUnitId = primaryUnitId
  }

  private toggleUnitSelection(unitId: string): void {
    if (this.selectedUnitIds.has(unitId)) {
      this.selectedUnitIds.delete(unitId)
      this.selectedUnitId = this.selectedUnitIds.values().next().value ?? null
      return
    }

    this.selectedUnitIds.add(unitId)
    this.selectedUnitId = unitId
  }

  private clearUnitSelection(): void {
    this.selectedUnitIds.clear()
    this.selectedUnitId = null
  }

  private getSelectedUnits(): UnitState[] {
    return [...this.selectedUnitIds]
      .map((unitId) => this.units.find((unit) => unit.id === unitId))
      .filter((unit): unit is UnitState => Boolean(unit))
  }

  private readonly animate = (): void => {
    if (this.isDisposed) {
      return
    }

    const delta = Math.min(this.clock.getDelta(), 0.05)

    this.updateCamera(delta)
    this.updateUnits(delta)
    this.updateSupplyVehicles(delta)
    this.updateBattleEffects(delta)
    this.updateSelectionVisuals()
    this.updateSimulation(delta)

    this.hudUpdateTimer += delta
    if (this.hudUpdateTimer >= this.HUD_UPDATE_INTERVAL) {
      this.hudUpdateTimer = 0
      if (this.timeSpeed === 0) {
        this.updateHud()
      } else if (this.combatSystem.combats.size > 0) {
        this.updateHud('Combat ongoing')
      } else if (this.selectedUnitId) {
        this.updateHud('Reinforcements updating')
      } else {
        this.updateHud()
      }
    }

    this.renderer?.render(this.scene, this.camera!)
    this.animationFrame = requestAnimationFrame(this.animate)
  }

  private updateSimulation(delta: number): void {
    if (!this.provinceState) {
      return
    }

    if (this.timeSpeed === 0) {
      return
    }

    this.simHourAccumulator += delta * SIM_HOURS_PER_SECOND * this.timeSpeed

    let hoursProcessed = 0
    const maxHoursPerFrame = 60 * this.timeSpeed

    while (this.simHourAccumulator >= 1 && hoursProcessed < maxHoursPerFrame) {
      this.simHourAccumulator -= 1
      this.currentHour += 1
      hoursProcessed += 1
      this.updateFortifications()
      this.updateSupplyState()
      this.dispatchSupplyVehicles()
      this.spawnCombatEffects()

      const resolutions = this.combatSystem.tickHourly(this.provinceState.provinces, this.units, this.economySystem)

      if (resolutions.length > 0) {
        this.mapRenderer.refreshAllProvinceColors(this.provinceState.provinces)
        this.syncUnitVisuals()
        this.updateHud(resolutions.at(-1)!.status)
      }

      if (this.currentHour >= 24) {
        this.currentHour = 0
        this.currentDay += 1
        this.economySystem.tickDaily(this.provinceState.provinces)
        this.updatePlayerProductionAndQueues()
      }
    }

    if (hoursProcessed > 0) {
      this.syncUnitVisuals()
    }
  }

  private updateFortifications(): void {
    if (!this.provinceState) {
      return
    }

    for (const unit of this.units) {
      if (unit.manpower <= 0 || unit.status === 'moving' || unit.status === 'inCombat' || unit.status === 'retreating' || unit.route.length > 0) {
        continue
      }

      if (unit.fortifiedProvinceId !== unit.provinceId) {
        unit.fortifiedProvinceId = unit.provinceId
        unit.fortificationDays = 0
      }

      const province = this.provinceState.getProvince(unit.provinceId)

      if (province.isContested) {
        continue
      }

      unit.fortificationDays = Math.min(FORTIFICATION_DAYS_TO_MAX, unit.fortificationDays + 1 / 24)
    }
  }

  private updateSupplyState(): void {
    if (!this.provinceState || !this.pathfinding) {
      return
    }

    for (const unit of this.units) {
      if (unit.manpower <= 0) {
        continue
      }

      const demand = Math.max(0.35, (unit.supplyUse + unit.fuelUse) / 3)
      unit.supplyHours = Math.max(0, unit.supplyHours - demand)

      const route = this.findSupplyRoute(unit)
      unit.isEncircled = route === null

      if (unit.isEncircled) {
        unit.encircledHours += 1
      } else {
        unit.encircledHours = Math.max(0, unit.encircledHours - 2)
      }

      if (unit.supplyHours <= 0) {
        unit.hoursOutOfSupply += 1
      } else {
        unit.hoursOutOfSupply = Math.max(0, unit.hoursOutOfSupply - 1)
      }

      if (unit.isEncircled && unit.encircledHours === 1) {
        unit.recentCombatEvents = ['Supply trucks cannot reach this division', ...unit.recentCombatEvents].slice(0, 8)
      }
    }
  }

  private dispatchSupplyVehicles(): void {
    if (!this.provinceState || !this.pathfinding) {
      return
    }

    this.absorbSupplyTruckStockpiles()

    const needyUnits = this.units
      .filter((unit) => unit.manpower > 0 && unit.supplyHours < SUPPLY_DISPATCH_THRESHOLD && !this.supplyVehicles.some((vehicle) => vehicle.targetUnitId === unit.id && vehicle.status === 'toUnit'))
      .sort((left, right) => left.supplyHours - right.supplyHours)

    for (const unit of needyUnits) {
      const vehicle = this.supplyVehicles.find((candidate) => candidate.countryId === unit.countryId && candidate.status === 'available')

      if (!vehicle) {
        break
      }

      const route = this.findSupplyRoute(unit)

      if (!route || route.length === 0) {
        continue
      }

      vehicle.targetUnitId = unit.id
      vehicle.routeProvinceIds = route
      vehicle.route = route.map((provinceId) => this.provinceState!.getProvince(provinceId).centerWorld.clone().setY(1.55))
      vehicle.routeIndex = 0
      vehicle.sourceProvinceId = route[0]
      vehicle.status = 'toUnit'
      vehicle.cargoHours = SUPPLY_DELIVERY_HOURS
      this.supplyVehicleGroups.get(vehicle.id)?.position.copy(vehicle.position)
    }
  }

  private updateSupplyVehicles(delta: number): void {
    if (!this.provinceState || this.timeSpeed === 0) {
      return
    }

    const scaledDelta = delta * this.timeSpeed

    for (const vehicle of this.supplyVehicles) {
      if (vehicle.status === 'available') {
        continue
      }

      const target = vehicle.route[vehicle.routeIndex]

      if (!target) {
        this.finishSupplyVehicleRoute(vehicle)
        continue
      }

      const direction = target.clone().sub(vehicle.position)
      const distance = direction.length()
      const travel = SUPPLY_VEHICLE_SPEED * MOVEMENT_SPEED_MULTIPLIER * scaledDelta

      if (distance <= travel) {
        vehicle.position.copy(target)
        vehicle.routeIndex += 1
      } else {
        vehicle.position.add(direction.normalize().multiplyScalar(travel))
      }

      this.supplyVehicleGroups.get(vehicle.id)?.position.copy(vehicle.position)
    }
  }

  private finishSupplyVehicleRoute(vehicle: SupplyVehicleState): void {
    if (vehicle.status === 'toUnit') {
      const unit = this.units.find((candidate) => candidate.id === vehicle.targetUnitId)

      if (unit && unit.manpower > 0) {
        unit.supplyHours = Math.min(unit.maxSupplyHours, unit.supplyHours + vehicle.cargoHours)
        unit.hoursOutOfSupply = 0
        unit.lastSupplySourceProvinceId = vehicle.sourceProvinceId
        unit.recentCombatEvents = ['Supply convoy delivered ammunition, fuel, and rations', ...unit.recentCombatEvents].slice(0, 8)
      }

      vehicle.route = [...vehicle.route].reverse()
      vehicle.routeProvinceIds = [...vehicle.routeProvinceIds].reverse()
      vehicle.routeIndex = 0
      vehicle.status = 'returning'
      return
    }

    vehicle.targetUnitId = null
    vehicle.route = []
    vehicle.routeProvinceIds = []
    vehicle.routeIndex = 0
    vehicle.status = 'available'
  }

  private findSupplyRoute(unit: UnitState): number[] | null {
    if (!this.provinceState || !this.pathfinding) {
      return null
    }

    const sources = this.getSupplySourceProvinces(unit.countryId)
    const unitProvince = this.provinceState.getProvince(unit.provinceId)
    const targets = unitProvince.controllerCountryId === unit.countryId && !unitProvince.isContested
      ? [unitProvince.id]
      : unitProvince.neighbors.filter((provinceId) => {
          const province = this.provinceState!.getProvince(provinceId)
          return province.controllerCountryId === unit.countryId && !province.isContested
        })

    let bestRoute: number[] | null = null

    for (const source of sources) {
      for (const targetProvinceId of targets) {
        const route = this.pathfinding.findPathWhere(source.id, targetProvinceId, (province) => province.controllerCountryId === unit.countryId && !province.isContested)

        if (route.length > 0 && (!bestRoute || route.length < bestRoute.length)) {
          bestRoute = route
        }
      }
    }

    return bestRoute
  }

  private getSupplySourceProvinces(countryId: CountryId): Province[] {
    if (!this.provinceState) {
      return []
    }

    return this.provinceState.provinces.filter((province) => (
      province.controllerCountryId === countryId &&
      !province.isContested &&
      (province.buildings.barracks > 0 || province.buildings.militaryComplex > 0)
    ))
  }

  private absorbSupplyTruckStockpiles(): void {
    if (!this.provinceState) {
      return
    }

    for (const countryId of ['azerbaijan', 'armenia'] as CountryId[]) {
      const economy = this.economySystem.countries[countryId]
      const sources = this.getSupplySourceProvinces(countryId)
      const source = sources[0]

      while (source && economy.equipmentStockpiles.supplyTrucks >= 1) {
        economy.equipmentStockpiles.supplyTrucks -= 1
        this.createSupplyVehicle(countryId, source)
      }
    }
  }

  private createSupplyVehicle(countryId: CountryId, source: Province): void {
    const id = `supply-${this.nextSupplyVehicleSerial++}`
    const position = source.centerWorld.clone().setY(1.55)
    const vehicle: SupplyVehicleState = {
      id,
      countryId,
      sourceProvinceId: source.id,
      targetUnitId: null,
      position,
      routeProvinceIds: [],
      route: [],
      routeIndex: 0,
      status: 'available',
      cargoHours: SUPPLY_DELIVERY_HOURS,
    }
    const geometry = new THREE.BoxGeometry(1.1, 0.7, 1.4)
    const material = new THREE.MeshStandardMaterial({
      color: COUNTRY_COLORS[countryId],
      roughness: 0.65,
      metalness: 0.12,
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.copy(position)
    mesh.castShadow = true
    this.supplyVehicles.push(vehicle)
    this.supplyVehicleGroups.set(id, mesh)
    this.scene.add(mesh)
  }

  private spawnCombatEffects(): void {
    if (!this.provinceState) {
      return
    }

    for (const combat of this.combatSystem.combats.values()) {
      if (combat.elapsedHours % 2 !== 0) {
        continue
      }

      const province = this.provinceState.getProvince(combat.provinceId)
      const projection = combat.lastProjection
      const intensity = projection ? Math.min(3, Math.max(1, (projection.attacker.softAttack + projection.defender.softAttack + projection.attacker.hardAttack + projection.defender.hardAttack) / 45)) : 1
      this.spawnBattleEffect(province.centerWorld, intensity)
    }
  }

  private spawnBattleEffect(center: THREE.Vector3, intensity: number): void {
    const group = new THREE.Group()
    const offset = new THREE.Vector3((Math.random() - 0.5) * 8, 3 + Math.random() * 2, (Math.random() - 0.5) * 8)
    group.position.copy(center.clone().add(offset))

    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.9 + intensity * 0.35, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xffa53a, transparent: true, opacity: 0.9 }),
    )
    const smoke = new THREE.Mesh(
      new THREE.SphereGeometry(1.4 + intensity * 0.45, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0x1f2933, transparent: true, opacity: 0.28 }),
    )
    smoke.position.y += 0.8
    group.add(flash, smoke)
    this.scene.add(group)
    this.battleEffects.push({
      id: `effect-${this.nextBattleEffectSerial++}`,
      group,
      age: 0,
      duration: 1.1 + intensity * 0.2,
    })
  }

  private updateBattleEffects(delta: number): void {
    for (const effect of [...this.battleEffects]) {
      effect.age += delta
      const progress = Math.min(1, effect.age / effect.duration)
      effect.group.scale.setScalar(1 + progress * 1.8)

      effect.group.traverse((object) => {
        if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshBasicMaterial) {
          object.material.opacity = Math.max(0, object.material.opacity * (1 - progress * 0.12))
        }
      })

      if (progress >= 1) {
        this.scene.remove(effect.group)
        effect.group.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.geometry.dispose()
            if (object.material instanceof THREE.Material) {
              object.material.dispose()
            }
          }
        })
        this.battleEffects.splice(this.battleEffects.indexOf(effect), 1)
      }
    }
  }

  setTimeSpeed(speed: TimeSpeed): void {
    if (this.isDisposed) {
      return
    }

    this.timeSpeed = speed
    this.hudUpdateTimer = 0
    this.updateHud(speed === 0 ? 'Paused' : `Speed ${speed}x`)
  }

  private updateCamera(delta: number): void {
    if (!this.camera) {
      return
    }

    const speed = (58 * delta) / this.camera.zoom

    if (this.keyState.has('KeyA') || this.keyState.has('ArrowLeft')) {
      this.cameraTarget.x -= speed
    }

    if (this.keyState.has('KeyD') || this.keyState.has('ArrowRight')) {
      this.cameraTarget.x += speed
    }

    if (this.keyState.has('KeyW') || this.keyState.has('ArrowUp')) {
      this.cameraTarget.z -= speed
    }

    if (this.keyState.has('KeyS') || this.keyState.has('ArrowDown')) {
      this.cameraTarget.z += speed
    }

    this.clampCameraTarget()
    this.camera.position.set(this.cameraTarget.x, 170, this.cameraTarget.z + 165)
    this.camera.lookAt(this.cameraTarget)
  }

  private updateUnits(delta: number): void {
    if (!this.provinceState) {
      return
    }

    if (this.timeSpeed === 0) {
      return
    }

    const scaledDelta = delta * this.timeSpeed

    for (const unit of this.units) {
      if (unit.status === 'inCombat' || unit.manpower <= 0) {
        continue
      }

      const target = unit.route[unit.routeIndex]

      if (!target) {
        continue
      }

      const direction = target.clone().sub(unit.position)
      const distance = direction.length()
      const targetProvinceId = unit.routeProvinceIds[unit.routeIndex]
      const targetTerrain = targetProvinceId === undefined ? null : this.provinceState.getProvince(targetProvinceId).terrainType
      const terrainSpeedModifier = targetTerrain ? unit.terrainProfile[targetTerrain]?.speed ?? 1 : 1
      const supplySpeedModifier = unit.hoursOutOfSupply >= 24 ? 0.55 : unit.hoursOutOfSupply >= 12 ? 0.75 : 1
      const travel = unit.speed * terrainSpeedModifier * supplySpeedModifier * MOVEMENT_SPEED_MULTIPLIER * scaledDelta

      if (distance <= travel) {
        unit.position.copy(target)
        const arrivedProvinceId = unit.routeProvinceIds[unit.routeIndex]
        this.moveUnitIntoProvince(unit, arrivedProvinceId)
        unit.routeIndex += 1
      } else {
        unit.position.add(direction.normalize().multiplyScalar(travel))
      }

      if (unit.routeIndex >= unit.route.length) {
        unit.route = []
        unit.routeProvinceIds = []
        unit.routeIndex = 0
        if (unit.status === 'moving') {
          unit.status = 'idle'
        }
      }

      this.unitGroups.get(unit.id)?.position.copy(unit.position)
    }
  }

  private moveUnitIntoProvince(unit: UnitState, provinceId: number): void {
    if (!this.provinceState) {
      return
    }

    const oldProvince = this.provinceState.getProvince(unit.provinceId)
    oldProvince.units = oldProvince.units.filter((unitId) => unitId !== unit.id)
    const province = this.provinceState.getProvince(provinceId)
    province.units.push(unit.id)
    unit.provinceId = provinceId
    unit.fortificationDays = 0
    unit.fortifiedProvinceId = provinceId

    const enemyUnit = province.units
      .map((unitId) => this.units.find((entry) => entry.id === unitId))
      .find((provinceUnit) => provinceUnit && provinceUnit.countryId !== unit.countryId && provinceUnit.manpower > 0)
    const hasEnemyUnits = Boolean(enemyUnit)
    const isEnemyControlled = province.controllerCountryId !== unit.countryId
    const enemyCountryId = enemyUnit?.countryId ?? province.controllerCountryId

    if ((hasEnemyUnits || isEnemyControlled) && areAtWar(unit.countryId, enemyCountryId)) {
      this.combatSystem.startCombat(province, unit, this.units)
      this.mapRenderer.refreshAllProvinceColors(this.provinceState.provinces)
      this.setSelectedProvince(this.selectedProvinceId)
      this.updateHud('Battle started')
    }
  }

  private updatePlayerProductionAndQueues(): void {
    if (!this.provinceState) {
      return
    }

    const economy = this.economySystem.countries[PLAYER_COUNTRY_ID]
    const buildings = this.getPlayerBuildingCounts()
    this.economySystem.ensureProductionSlots(PLAYER_COUNTRY_ID, buildings.militaryComplex)
    this.economySystem.ensureProductionSlots('armenia', this.getBuildingCountsForCountry('armenia').militaryComplex)
    this.economySystem.addEquipment(PLAYER_COUNTRY_ID, buildings.militaryComplex * MILITARY_COMPLEX_DAILY_EQUIPMENT)
    this.absorbSupplyTruckStockpiles()

    for (const job of [...economy.constructionQueue]) {
      job.daysRemaining = Math.max(0, job.daysRemaining - 1)

      if (job.daysRemaining > 0) {
        continue
      }

      const province = this.provinceState.getProvince(job.provinceId)

      if (this.isPlayerControlledProvince(province)) {
        province.buildings[job.buildingType] += 1
        economy.constructionQueue = economy.constructionQueue.filter((candidate) => candidate.id !== job.id)
      }
    }

    for (const job of economy.trainingQueue) {
      if (job.status === 'training') {
        job.daysRemaining = Math.max(0, job.daysRemaining - 1)

        if (job.daysRemaining === 0) {
          job.status = 'ready'
        }
      }
    }

    for (const job of [...economy.trainingQueue].filter((candidate) => candidate.status === 'ready')) {
      const preferredProvince = this.provinceState.getProvince(job.provinceId)
      const deploymentProvince = this.isValidDeploymentProvince(preferredProvince) ? preferredProvince : this.getValidDeploymentProvinces()[0]

      if (!deploymentProvince) {
        continue
      }

      this.deployTrainingJob(job, deploymentProvince)
      economy.trainingQueue = economy.trainingQueue.filter((candidate) => candidate.id !== job.id)
    }
  }

  private deployTrainingJob(job: TrainingJob, province: Province): void {
    const id = `az-trained-${this.nextUnitSerial++}`
    const combatFields = buildUnitCombatFields(id, job.templateId, job.templateName, job.nodes, job.stats)
    const unit: UnitState = {
      id,
      name: job.templateName,
      ...combatFields,
      countryId: PLAYER_COUNTRY_ID,
      owner: COUNTRY_NAMES[PLAYER_COUNTRY_ID],
      provinceId: province.id,
      position: province.centerWorld.clone().setY(UNIT_Y),
      route: [],
      routeProvinceIds: [],
      routeIndex: 0,
      experience: 0,
      fortifiedProvinceId: province.id,
      fortificationDays: 0,
      supplyHours: MAX_SUPPLY_HOURS,
      maxSupplyHours: MAX_SUPPLY_HOURS,
      hoursOutOfSupply: 0,
      encircledHours: 0,
      isEncircled: false,
      lastSupplySourceProvinceId: province.id,
      recentCombatEvents: [],
      status: 'idle',
      reinforcementDelayHours: 0,
    }
    const group = this.unitFactory.create(COUNTRY_COLORS[PLAYER_COUNTRY_ID])
    group.position.copy(unit.position)
    group.userData.unitId = id
    group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.userData.unitId = id
        this.unitHitMeshes.push(object)
      }
    })
    province.units.push(id)
    this.units.push(unit)
    this.unitGroups.set(id, group)
    this.scene.add(group)
    this.updateHud(`${job.templateName} deployed`)
  }

  private getPlayerBuildingCounts(): { barracks: number; militaryComplex: number } {
    return this.getBuildingCountsForCountry(PLAYER_COUNTRY_ID)
  }

  private getBuildingCountsForCountry(countryId: CountryId): { barracks: number; militaryComplex: number } {
    if (!this.provinceState) {
      return { barracks: 0, militaryComplex: 0 }
    }

    return this.provinceState.provinces
      .filter((province) => province.controllerCountryId === countryId)
      .reduce(
        (counts, province) => ({
          barracks: counts.barracks + province.buildings.barracks,
          militaryComplex: counts.militaryComplex + province.buildings.militaryComplex,
        }),
        { barracks: 0, militaryComplex: 0 },
      )
  }

  private getValidConstructionProvinces(): Province[] {
    if (!this.provinceState) {
      return []
    }

    return this.provinceState.provinces.filter((province) => this.isPlayerControlledProvince(province) && !province.isContested)
  }

  private getValidDeploymentProvinces(): Province[] {
    return this.getValidConstructionProvinces().filter((province) => province.buildings.barracks > 0)
  }

  private isValidDeploymentProvince(province: Province): boolean {
    return this.isPlayerControlledProvince(province) && !province.isContested && province.buildings.barracks > 0
  }

  private isPlayerControlledProvince(province: Province): boolean {
    return province.controllerCountryId === PLAYER_COUNTRY_ID
  }

  private getProjectedBuildingCount(province: Province, buildingType: BuildingType): number {
    const queued = this.economySystem.countries[PLAYER_COUNTRY_ID].constructionQueue.filter(
      (job) => job.provinceId === province.id && job.buildingType === buildingType,
    ).length

    return province.buildings[buildingType] + queued
  }

  private updateSelectionVisuals(): void {
    const selectedUnit = this.units.find((unit) => unit.id === this.selectedUnitId)

    for (const unitId of [...this.unitSelectionRings.keys()]) {
      if (!this.selectedUnitIds.has(unitId)) {
        const ring = this.unitSelectionRings.get(unitId)!
        this.scene.remove(ring)
        this.unitSelectionRings.delete(unitId)
      }
    }

    if (this.unitSelectionRingGeometry && this.unitSelectionRingMaterial) {
      for (const unit of this.getSelectedUnits()) {
        let ring = this.unitSelectionRings.get(unit.id)

        if (!ring) {
          ring = new THREE.Mesh(this.unitSelectionRingGeometry, this.unitSelectionRingMaterial)
          this.unitSelectionRings.set(unit.id, ring)
          this.scene.add(ring)
        }

        ring.visible = unit.manpower > 0
        ring.position.set(unit.position.x, 1.25, unit.position.z)
      }
    }

    if (this.routeLine && selectedUnit) {
      const remainingRoute = selectedUnit.route.slice(selectedUnit.routeIndex)
      const routePoints = remainingRoute.length > 0 ? [selectedUnit.position, ...remainingRoute] : []
      this.routeLine.geometry.dispose()
      this.routeLine.geometry = new THREE.BufferGeometry().setFromPoints(routePoints.map((point) => point.clone().setY(2.1)))
    } else if (this.routeLine) {
      this.routeLine.geometry.dispose()
      this.routeLine.geometry = new THREE.BufferGeometry()
    }
  }

  private syncUnitVisuals(): void {
    for (const unit of this.units) {
      const group = this.unitGroups.get(unit.id)

      if (!group) {
        continue
      }

      group.visible = unit.manpower > 0
      group.position.copy(unit.position)
    }
  }

  private updateHud(status = this.hudStatus): void {
    if (this.isDisposed || !this.provinceState) {
      return
    }

    this.hudStatus = status

    const selectedProvince = this.selectedProvinceId === null ? null : this.provinceState.getProvince(this.selectedProvinceId)
    const selectedUnit = this.units.find((unit) => unit.id === this.selectedUnitId) ?? null
    const counts = this.provinceState.getCounts()
    const playerBuildings = this.getPlayerBuildingCounts()
    const playerEconomy = this.economySystem.countries[PLAYER_COUNTRY_ID]
    const activeCombat = selectedProvince
      ? this.combatSystem.getActiveCombatForProvince(selectedProvince.id)
      : selectedUnit
        ? this.combatSystem.getActiveCombatForUnit(selectedUnit.id)
        : null

    const activeCombats = this.buildActiveCombatOverlays()
    const battleForecast = this.buildBattleForecast(activeCombat, selectedProvince)

    this.setHudState({
      isLoading: false,
      status,
      selectedProvince: selectedProvince
        ? {
            id: selectedProvince.id,
            name: `${selectedProvince.displayName} (${selectedProvince.name})`,
            ownerName: COUNTRY_NAMES[selectedProvince.ownerCountryId],
            controllerName: COUNTRY_NAMES[selectedProvince.controllerCountryId],
            unitCount: selectedProvince.units.length,
            buildings: selectedProvince.buildings,
            terrainType: selectedProvince.terrainType,
            economyRegion: selectedProvince.economyRegion,
            primaryResource: selectedProvince.primaryResource,
            resourceYields: selectedProvince.resourceYields,
            isContested: selectedProvince.isContested,
          }
        : null,
      selectedUnit: selectedUnit
        ? {
            name: selectedUnit.name,
            owner: selectedUnit.owner,
            status: selectedUnit.status,
            manpower: selectedUnit.manpower,
            maxManpower: selectedUnit.maxManpower,
            organization: selectedUnit.organization,
            maxOrganization: selectedUnit.maxOrganization,
            equipment: selectedUnit.equipment,
            maxEquipment: selectedUnit.maxEquipment,
            softAttack: selectedUnit.softAttack,
            hardAttack: selectedUnit.hardAttack,
            attack: selectedUnit.attack,
            defense: selectedUnit.defense,
            breakthrough: selectedUnit.breakthrough,
            armor: selectedUnit.armor,
            piercing: selectedUnit.piercing,
            hardness: selectedUnit.hardness,
            maneuverability: selectedUnit.maneuverability,
            supplyUse: selectedUnit.supplyUse,
            fuelUse: selectedUnit.fuelUse,
            reliability: selectedUnit.reliability,
            fortificationDays: selectedUnit.fortificationDays,
            fortificationLevel: selectedUnit.fortifiedProvinceId === selectedUnit.provinceId ? Math.min(1, selectedUnit.fortificationDays / FORTIFICATION_DAYS_TO_MAX) : 0,
            supplyHours: selectedUnit.supplyHours,
            maxSupplyHours: selectedUnit.maxSupplyHours,
            hoursOutOfSupply: selectedUnit.hoursOutOfSupply,
            encircledHours: selectedUnit.encircledHours,
            isEncircled: selectedUnit.isEncircled,
            battalions: selectedUnit.battalions.map((battalion) => ({
              name: battalion.name,
              status: battalion.status,
              manpower: battalion.manpower,
              maxManpower: battalion.maxManpower,
              equipment: battalion.equipment,
              maxEquipment: battalion.maxEquipment,
              organization: battalion.organization,
              maxOrganization: battalion.maxOrganization,
            })),
            recentCombatEvents: selectedUnit.recentCombatEvents,
            reinforcementDelayHours: selectedUnit.reinforcementDelayHours,
          }
        : null,
      economy: this.economySystem.countries,
      construction: {
        jobs: playerEconomy.constructionQueue,
        playerBuildings,
        validConstructionProvinceIds: this.getValidConstructionProvinces().map((province) => province.id),
      },
      training: {
        jobs: playerEconomy.trainingQueue,
        templates: [...this.divisionTemplates.values()],
        validDeploymentProvinceIds: this.getValidDeploymentProvinces().map((province) => province.id),
        trainingSlots: playerBuildings.barracks,
        activeTrainingCount: playerEconomy.trainingQueue.filter((job) => job.status === 'training').length,
      },
      logistics: {
        supplyVehicleCount: this.supplyVehicles.length,
        activeSupplyVehicleCount: this.supplyVehicles.filter((vehicle) => vehicle.status !== 'available').length,
      },
      activeCombat,
      activeCombats,
      battleForecast,
      time: {
        day: this.currentDay,
        hour: this.currentHour,
        speed: this.timeSpeed,
      },
      mapStats: {
        provinceCount: this.provinceState.provinces.length,
        azProvinceCount: counts.azerbaijan,
        amProvinceCount: counts.armenia,
        azUnitCount: this.units.filter((unit) => unit.countryId === 'azerbaijan').length,
        amUnitCount: this.units.filter((unit) => unit.countryId === 'armenia').length,
      },
    })
  }

  private buildActiveCombatOverlays(): ActiveCombatOverlay[] {
    if (!this.provinceState || !this.camera) return []

    const overlays: ActiveCombatOverlay[] = []

    for (const combat of this.combatSystem.combats.values()) {
      const province = this.provinceState.getProvince(combat.provinceId)
      const sides = this.combatSystem.getSidesForOverlay(combat, this.units)

      const attackerSide = sides.attacker
      const defenderSide = sides.defender

      const attackerManpower = attackerSide.reduce((sum, u) => sum + u.manpower, 0)
      const attackerMaxManpower = attackerSide.reduce((sum, u) => sum + u.maxManpower, 0)
      const attackerAvgOrg = attackerSide.length > 0 ? attackerSide.reduce((sum, u) => sum + u.organization, 0) / attackerSide.length : 0
      const attackerMaxOrg = attackerSide.length > 0 ? Math.max(...attackerSide.map(u => u.maxOrganization)) : 100

      const defenderManpower = defenderSide.reduce((sum, u) => sum + u.manpower, 0)
      const defenderMaxManpower = defenderSide.reduce((sum, u) => sum + u.maxManpower, 0)
      const defenderAvgOrg = defenderSide.length > 0 ? defenderSide.reduce((sum, u) => sum + u.organization, 0) / defenderSide.length : 0
      const defenderMaxOrg = defenderSide.length > 0 ? Math.max(...defenderSide.map(u => u.maxOrganization)) : 100

      const attackerEffectiveness = (attackerManpower / Math.max(1, attackerMaxManpower)) * (attackerAvgOrg / Math.max(1, attackerMaxOrg))
      const defenderEffectiveness = (defenderManpower / Math.max(1, defenderMaxManpower)) * (defenderAvgOrg / Math.max(1, defenderMaxOrg))
      const projection = combat.lastProjection ?? (attackerSide.length > 0 && defenderSide.length > 0 ? this.combatSystem.getForecast(attackerSide, defenderSide, province) : null)

      let advantage: 'attacker' | 'defender' | 'even' = 'even'
      if (projection) {
        advantage = projection.winner === 'attacker' ? 'attacker' : projection.winner === 'defender' ? 'defender' : 'even'
      } else if (attackerEffectiveness > defenderEffectiveness * 1.15) advantage = 'attacker'
      else if (defenderEffectiveness > attackerEffectiveness * 1.15) advantage = 'defender'

      const worldPos = new THREE.Vector3(province.centerWorld.x, province.centerWorld.y + 12, province.centerWorld.z)
      worldPos.project(this.camera!)
      const containerRect = this.container.getBoundingClientRect()
      const screenX = (worldPos.x * 0.5 + 0.5) * containerRect.width
      const screenY = (-worldPos.y * 0.5 + 0.5) * containerRect.height

      overlays.push({
        id: combat.id,
        provinceId: combat.provinceId,
        screenPosition: { x: screenX, y: screenY },
        attacker: {
          countryId: combat.attackerCountryId,
          countryName: COUNTRY_NAMES[combat.attackerCountryId],
          totalManpower: Math.round(attackerManpower),
          totalMaxManpower: attackerMaxManpower,
          avgOrganization: Math.round(attackerAvgOrg),
          maxOrganization: attackerMaxOrg,
          unitCount: attackerSide.length,
        },
        defender: {
          countryId: combat.defenderCountryId,
          countryName: COUNTRY_NAMES[combat.defenderCountryId],
          totalManpower: Math.round(defenderManpower),
          totalMaxManpower: defenderMaxManpower,
          avgOrganization: Math.round(defenderAvgOrg),
          maxOrganization: defenderMaxOrg,
          unitCount: defenderSide.length,
        },
        advantage,
        confidence: projection?.confidence ?? 50,
        terrain: province.terrainType,
      })
    }

    return overlays
  }

  private buildBattleForecast(activeCombat: CombatInstance | null, selectedProvince: Province | null): BattleProjection | null {
    if (!this.provinceState) {
      return null
    }

    if (activeCombat) {
      const province = this.provinceState.getProvince(activeCombat.provinceId)
      const sides = this.combatSystem.getSidesForOverlay(activeCombat, this.units)

      if (sides.attacker.length === 0 || sides.defender.length === 0) {
        return null
      }

      return activeCombat.lastProjection ?? this.combatSystem.getForecast(sides.attacker, sides.defender, province)
    }

    if (!selectedProvince || this.selectedUnitIds.size === 0) {
      return null
    }

    const attackers = this.getSelectedUnits().filter((unit) => unit.manpower > 0 && unit.countryId === PLAYER_COUNTRY_ID)

    if (attackers.length === 0) {
      return null
    }

    const defenderCountryId = selectedProvince.units
      .map((unitId) => this.units.find((unit) => unit.id === unitId))
      .filter((unit): unit is UnitState => Boolean(unit))
      .find((unit) => unit.countryId !== attackers[0].countryId && unit.manpower > 0)?.countryId ?? selectedProvince.controllerCountryId

    if (!areAtWar(attackers[0].countryId, defenderCountryId)) {
      return null
    }

    const defenders = selectedProvince.units
      .map((unitId) => this.units.find((unit) => unit.id === unitId))
      .filter((unit): unit is UnitState => Boolean(unit))
      .filter((unit) => unit.countryId === defenderCountryId && unit.manpower > 0)

    if (defenders.length === 0) {
      return null
    }

    return this.combatSystem.getForecast(attackers, defenders, selectedProvince)
  }

  private setSelectedProvince(provinceId: number | null): void {
    const province = provinceId === null || !this.provinceState ? null : this.provinceState.getProvince(provinceId)
    this.mapRenderer.setSelectedProvince(province)
  }

  private clampCameraTarget(): void {
    const limit = this.mapRenderer.worldSize * 0.46
    this.cameraTarget.x = THREE.MathUtils.clamp(this.cameraTarget.x, -limit, limit)
    this.cameraTarget.z = THREE.MathUtils.clamp(this.cameraTarget.z, -limit, limit)
  }
}

function pickSpawnProvinces(provinces: Province[], count: number): Province[] {
  if (provinces.length <= count) {
    return provinces
  }

  const sorted = [...provinces].sort((left, right) => left.centerWorld.x - right.centerWorld.x || left.centerWorld.z - right.centerWorld.z)
  const result: Province[] = []

  for (let index = 0; index < count; index += 1) {
    const provinceIndex = Math.round((index / Math.max(1, count - 1)) * (sorted.length - 1))
    result.push(sorted[provinceIndex])
  }

  return result
}

function areAtWar(left: CountryId, right: CountryId): boolean {
  return left !== right
}
