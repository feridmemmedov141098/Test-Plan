import * as THREE from 'three'
import { CombatSystem, type CombatInstance } from '../game/combat/CombatSystem'
import { EconomySystem, type EconomyState } from '../game/economy/EconomySystem'
import { ProvincePathfindingSystem } from '../game/movement/ProvincePathfindingSystem'
import { ProvinceState } from '../game/province/ProvinceState'
import { COUNTRY_COLORS, COUNTRY_NAMES, type CountryId, type Province } from '../game/province/provinceTypes'
import type { ResourceYields } from '../game/province/provinceTypes'
import type { UnitState } from '../game/units/UnitTypes'
import { ProvinceMapRenderer } from './ProvinceMapRenderer'
import { UnitModelFactory } from './UnitModelFactory'

export type TimeSpeed = 0 | 1 | 2 | 5 | 10

export interface PrototypeHudState {
  isLoading: boolean
  status: string
  selectedProvince: {
    name: string
    ownerName: string
    controllerName: string
    unitCount: number
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
  private readonly units: UnitState[] = []
  private readonly unitGroups = new Map<string, THREE.Group>()
  private readonly unitHitMeshes: THREE.Object3D[] = []
  private renderer: THREE.WebGLRenderer | null = null
  private camera: THREE.OrthographicCamera | null = null
  private provinceState: ProvinceState | null = null
  private pathfinding: ProvincePathfindingSystem | null = null
  private unitSelectionRing: THREE.Mesh | null = null
  private routeLine: THREE.Line | null = null
  private animationFrame = 0
  private selectedProvinceId: number | null = null
  private selectedUnitId: string | null = null
  private isMiddleDragging = false
  private lastPointer = { x: 0, y: 0 }
  private simHourAccumulator = 0
  private currentDay = 1
  private currentHour = 0
  private timeSpeed: TimeSpeed = 1
  private hudStatus = 'Loading province map'
  private hudUpdateTimer = 0
  private isDisposed = false
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
    this.unitSelectionRing = new THREE.Mesh(
      ringGeometry,
      new THREE.MeshBasicMaterial({ color: 0xf7df72, transparent: true, opacity: 0.92 }),
    )
    this.unitSelectionRing.visible = false
    this.scene.add(this.unitSelectionRing)

    this.routeLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0xffd76c, transparent: true, opacity: 0.94 }),
    )
    this.scene.add(this.routeLine)
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
    }
  }

  private readonly handlePointerMove = (event: PointerEvent): void => {
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
      this.handleLeftClick(event)
    }

    if (event.button === 2) {
      this.handleRightClick(event)
    }
  }

  private readonly handlePointerLeave = (): void => {
    this.isMiddleDragging = false
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
      this.selectedUnitId = unitId
      const unit = this.units.find((entry) => entry.id === unitId)
      this.selectedProvinceId = unit?.provinceId ?? null
      this.setSelectedProvince(this.selectedProvinceId)
      this.updateSelectionVisuals()
      this.updateHud('Unit selected')
      return
    }

    const province = this.pickProvince(event)

    if (province) {
      this.selectedUnitId = null
      this.selectedProvinceId = province.id
      this.setSelectedProvince(province.id)
      this.updateSelectionVisuals()
      this.updateHud('Province selected')
    }
  }

  private handleRightClick(event: PointerEvent): void {
    if (!this.provinceState || !this.pathfinding || !this.selectedUnitId) {
      return
    }

    const targetProvince = this.pickProvince(event)
    const unit = this.units.find((entry) => entry.id === this.selectedUnitId)

    if (!targetProvince || !unit || unit.manpower <= 0) {
      return
    }

    if (unit.status === 'inCombat') {
      this.updateHud('Unit is in combat')
      return
    }

    if (targetProvince.controllerCountryId !== unit.countryId && !areAtWar(unit.countryId, targetProvince.controllerCountryId)) {
      this.updateHud('Target country is not at war')
      return
    }

    const path = this.pathfinding.findPath(unit.provinceId, targetProvince.id)

    if (path.length === 0) {
      this.updateHud('No province route')
      return
    }

    unit.routeProvinceIds = path
    unit.route = path.map((provinceId) => this.provinceState!.getProvince(provinceId).centerWorld.clone().setY(UNIT_Y))
    unit.routeIndex = 0
    unit.status = 'moving'
    this.selectedProvinceId = targetProvince.id
    this.setSelectedProvince(targetProvince.id)
    this.updateSelectionVisuals()
    this.updateHud('Move order issued')
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

  private updateSelectionVisuals(): void {
    const selectedUnit = this.units.find((unit) => unit.id === this.selectedUnitId)

    if (this.unitSelectionRing) {
      this.unitSelectionRing.visible = Boolean(selectedUnit)

      if (selectedUnit) {
        this.unitSelectionRing.position.set(selectedUnit.position.x, 1.25, selectedUnit.position.z)
      }
    }

    if (this.routeLine && selectedUnit) {
      const remainingRoute = selectedUnit.route.slice(selectedUnit.routeIndex)
      const routePoints = remainingRoute.length > 0 ? [selectedUnit.position, ...remainingRoute] : []
      this.routeLine.geometry.dispose()
      this.routeLine.geometry = new THREE.BufferGeometry().setFromPoints(routePoints.map((point) => point.clone().setY(2.1)))
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
            name: `${selectedProvince.displayName} (${selectedProvince.name})`,
            ownerName: COUNTRY_NAMES[selectedProvince.ownerCountryId],
            controllerName: COUNTRY_NAMES[selectedProvince.controllerCountryId],
            unitCount: selectedProvince.units.length,
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
