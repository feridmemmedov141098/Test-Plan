import * as THREE from 'three'
import { CombatSystem, type CombatInstance } from '../game/combat/CombatSystem'
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
import type { UnitState } from '../game/units/UnitTypes'
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
    attack: number
    defense: number
    reliability: number
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
  activeCombat: CombatInstance | null
  activeCombats: ActiveCombatOverlay[]
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
}

type HudCallback = (state: PrototypeHudState) => void

const BASE_CAMERA_HEIGHT = 190
const UNIT_Y = 2.2
const SIM_HOURS_PER_SECOND = 6
const PLAYER_COUNTRY_ID: CountryId = 'azerbaijan'
const MILITARY_COMPLEX_DAILY_EQUIPMENT = 25
const TRAINING_REFUND_MULTIPLIER = 0.5

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
      this.createSelectionMeshes()
      this.createUnits()
      this.economySystem.tickDaily(this.provinceState.provinces)
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

    spawnAzerbaijan.forEach((province, index) => this.createUnit(`az-${index + 1}`, `AZ Division ${index + 1}`, 'azerbaijan', province))
    spawnArmenia.forEach((province, index) => this.createUnit(`am-${index + 1}`, `AM Division ${index + 1}`, 'armenia', province))
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

    const bestProvince = [...this.provinceState.getByCountry(PLAYER_COUNTRY_ID)]
      .sort((left, right) => right.resourceYields.industry - left.resourceYields.industry || right.resourceYields.manpower - left.resourceYields.manpower)[0]

    if (!bestProvince) {
      return
    }

    bestProvince.buildings.barracks = 1
    bestProvince.buildings.militaryComplex = 1
  }

  private createUnit(id: string, name: string, countryId: CountryId, province: Province): void {
    const unit: UnitState = {
      id,
      name,
      countryId,
      owner: COUNTRY_NAMES[countryId],
      provinceId: province.id,
      position: province.centerWorld.clone().setY(UNIT_Y),
      route: [],
      routeProvinceIds: [],
      routeIndex: 0,
      speed: 22,
      manpower: 1000,
      maxManpower: 1000,
      organization: 100,
      maxOrganization: 100,
      equipment: 100,
      maxEquipment: 100,
      attack: 12,
      defense: 10,
      reliability: 0.85,
      experience: 0,
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

    if (!this.economySystem.canAfford(PLAYER_COUNTRY_ID, resourceCost) || economy.equipmentPool < template.stats.equipment) {
      this.updateHud('Not enough manpower, equipment, or resources')
      return
    }

    this.economySystem.spendResources(PLAYER_COUNTRY_ID, resourceCost)
    economy.equipmentPool -= template.stats.equipment
    economy.trainingQueue.push({
      id: `train-${this.nextTrainingJobId++}`,
      countryId: PLAYER_COUNTRY_ID,
      provinceId,
      provinceName: province.displayName,
      templateId,
      templateName: template.name,
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
    economy.equipmentPool += job.stats.equipment * TRAINING_REFUND_MULTIPLIER
    this.updateHud('Training cancelled')
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
    if (event.button === 1) {
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
    if (event.button === 1) {
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

    if (event.button === 2) {
      this.handleRightClick(event)
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
      const travel = unit.speed * scaledDelta

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
    this.economySystem.addEquipment(PLAYER_COUNTRY_ID, buildings.militaryComplex * MILITARY_COMPLEX_DAILY_EQUIPMENT)

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
    const unit: UnitState = {
      id,
      name: job.templateName,
      countryId: PLAYER_COUNTRY_ID,
      owner: COUNTRY_NAMES[PLAYER_COUNTRY_ID],
      provinceId: province.id,
      position: province.centerWorld.clone().setY(UNIT_Y),
      route: [],
      routeProvinceIds: [],
      routeIndex: 0,
      speed: job.stats.speed,
      manpower: job.stats.manpower,
      maxManpower: job.stats.manpower,
      organization: job.stats.organization,
      maxOrganization: job.stats.organization,
      equipment: job.stats.equipment,
      maxEquipment: job.stats.equipment,
      attack: Math.round(job.stats.attack),
      defense: Math.round(job.stats.defense),
      reliability: job.stats.reliability,
      experience: 0,
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
    if (!this.provinceState) {
      return { barracks: 0, militaryComplex: 0 }
    }

    return this.provinceState.provinces
      .filter((province) => this.isPlayerControlledProvince(province))
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
            attack: selectedUnit.attack,
            defense: selectedUnit.defense,
            reliability: selectedUnit.reliability,
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
      activeCombat,
      activeCombats,
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

      let advantage: 'attacker' | 'defender' | 'even' = 'even'
      if (attackerEffectiveness > defenderEffectiveness * 1.15) advantage = 'attacker'
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
      })
    }

    return overlays
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
