import * as THREE from 'three'
import { ProvincePathfindingSystem } from '../game/movement/ProvincePathfindingSystem'
import { ProvinceState } from '../game/province/ProvinceState'
import { COUNTRY_COLORS, COUNTRY_NAMES, type CountryId, type Province } from '../game/province/provinceTypes'
import { ProvinceMapRenderer } from './ProvinceMapRenderer'
import { UnitModelFactory } from './UnitModelFactory'

export interface PrototypeHudState {
  isLoading: boolean
  status: string
  selectedProvince: {
    name: string
    ownerName: string
    controllerName: string
    unitCount: number
  } | null
  selectedUnit: { name: string; owner: string } | null
  mapStats: {
    provinceCount: number
    azProvinceCount: number
    amProvinceCount: number
    azUnitCount: number
    amUnitCount: number
  } | null
}

interface UnitState {
  id: string
  name: string
  countryId: CountryId
  owner: string
  provinceId: number
  position: THREE.Vector3
  route: THREE.Vector3[]
  routeProvinceIds: number[]
  routeIndex: number
  speed: number
}

type HudCallback = (state: PrototypeHudState) => void

const BASE_CAMERA_HEIGHT = 190
const UNIT_Y = 2.2

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

  constructor(container: HTMLDivElement, setHudState: HudCallback) {
    this.container = container
    this.setHudState = setHudState
  }

  async start(): Promise<void> {
    try {
      this.setHudState({
        isLoading: true,
        selectedProvince: null,
        selectedUnit: null,
        status: 'Loading province map',
        mapStats: null,
      })

      this.setupRenderer()
      this.setupCamera()
      this.setupLighting()
      const provinces = await this.mapRenderer.load()
      this.provinceState = new ProvinceState(provinces)
      this.pathfinding = new ProvincePathfindingSystem(this.provinceState.provinces)
      this.mapRenderer.refreshAllProvinceColors(this.provinceState.provinces)
      this.scene.add(this.mapRenderer.object)
      await this.unitFactory.load()
      this.createSelectionMeshes()
      this.createUnits()
      this.addEventListeners()
      this.resize()
      this.updateHud('Map ready')
      this.animate()
    } catch (error) {
      this.setHudState({
        isLoading: false,
        selectedProvince: null,
        selectedUnit: null,
        status: error instanceof Error ? error.message : 'Province map failed to load',
        mapStats: null,
      })
    }
  }

  dispose(): void {
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

    if (!targetProvince || !unit) {
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
    const delta = Math.min(this.clock.getDelta(), 0.05)

    this.updateCamera(delta)
    this.updateUnits(delta)
    this.updateSelectionVisuals()
    this.renderer?.render(this.scene, this.camera!)
    this.animationFrame = requestAnimationFrame(this.animate)
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

    for (const unit of this.units) {
      const target = unit.route[unit.routeIndex]

      if (!target) {
        continue
      }

      const direction = target.clone().sub(unit.position)
      const distance = direction.length()
      const travel = unit.speed * delta

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

    if (this.provinceState.setController(provinceId, unit.countryId)) {
      this.mapRenderer.refreshAllProvinceColors(this.provinceState.provinces)
      this.setSelectedProvince(this.selectedProvinceId)
      this.updateHud('Province captured')
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

  private updateHud(status: string): void {
    if (!this.provinceState) {
      return
    }

    const selectedProvince = this.selectedProvinceId === null ? null : this.provinceState.getProvince(this.selectedProvinceId)
    const selectedUnit = this.units.find((unit) => unit.id === this.selectedUnitId) ?? null
    const counts = this.provinceState.getCounts()

    this.setHudState({
      isLoading: false,
      status,
      selectedProvince: selectedProvince
        ? {
            name: selectedProvince.name,
            ownerName: COUNTRY_NAMES[selectedProvince.ownerCountryId],
            controllerName: COUNTRY_NAMES[selectedProvince.controllerCountryId],
            unitCount: selectedProvince.units.length,
          }
        : null,
      selectedUnit: selectedUnit ? { name: selectedUnit.name, owner: selectedUnit.owner } : null,
      mapStats: {
        provinceCount: this.provinceState.provinces.length,
        azProvinceCount: counts.azerbaijan,
        amProvinceCount: counts.armenia,
        azUnitCount: this.units.filter((unit) => unit.countryId === 'azerbaijan').length,
        amUnitCount: this.units.filter((unit) => unit.countryId === 'armenia').length,
      },
    })
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
