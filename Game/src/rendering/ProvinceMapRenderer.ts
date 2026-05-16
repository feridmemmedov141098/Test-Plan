import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { createEmptyProvinceBuildings } from '../game/economy/ConstructionTypes'
import { getProvinceMetadata } from '../game/province/provinceMetadata'
import {
  COUNTRY_COLORS,
  PROVINCE_MAP_URL,
  countryFromProvinceName,
  normalizeProvinceName,
  type Province,
} from '../game/province/provinceTypes'

const WORLD_SIZE = 210
const EDGE_Y_OFFSET = 0.18
const PROVINCE_Y_OFFSET = 0.02
const POLITICAL_OVERLAY_Y_OFFSET = 0.08
const CONTESTED_COLOR = 0x77736b

export class ProvinceMapRenderer {
  readonly object = new THREE.Group()
  readonly worldSize = WORLD_SIZE
  private provinceMeshes: THREE.Mesh[] = []
  private politicalOverlayGroup = new THREE.Group()
  private politicalOverlays = new Map<number, THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>>()
  private edgeGroup = new THREE.Group()
  private selectedProvinceId: number | null = null

  async load(): Promise<Province[]> {
    const loader = new GLTFLoader()
    const gltf = await loader.loadAsync(PROVINCE_MAP_URL)
    const source = gltf.scene
    const bounds = new THREE.Box3().setFromObject(source)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    bounds.getSize(size)
    bounds.getCenter(center)
    const scale = WORLD_SIZE / Math.max(size.x, size.z, 1)

    source.position.sub(center)
    source.scale.setScalar(scale)
    source.updateMatrixWorld(true)

    const provinceCandidates = new Map<string, THREE.Mesh[]>()

    source.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) {
        return
      }

      const baseName = normalizeProvinceName(object.name || object.geometry.name || '')
      const countryId = countryFromProvinceName(baseName)

      object.visible = false

      if (!countryId) {
        return
      }

      const candidates = provinceCandidates.get(baseName) ?? []
      candidates.push(object)
      provinceCandidates.set(baseName, candidates)
    })

    const canonical = new Map<string, THREE.Mesh>()

    for (const [baseName, candidates] of provinceCandidates) {
      const mesh = selectRenderableProvinceMesh(candidates)
      mesh.visible = true
      mesh.castShadow = false
      mesh.receiveShadow = true
      mesh.frustumCulled = false
      preserveGlbMaterial(mesh)
      canonical.set(baseName, mesh)
    }

    const provinces = [...canonical.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, mesh], id): Province => {
        const countryId = countryFromProvinceName(name)!
        const metadata = getProvinceMetadata(name, countryId)
        const provinceBounds = new THREE.Box3().setFromObject(mesh)
        const centerWorld = new THREE.Vector3()
        provinceBounds.getCenter(centerWorld)
        centerWorld.y += 0.8
        mesh.userData.provinceId = id
        this.provinceMeshes.push(mesh)

        return {
          id,
          name,
          displayName: metadata.displayName,
          economyRegion: metadata.economyRegion,
          primaryResource: metadata.primaryResource,
          resourceYields: metadata.resourceYields,
          countryId,
          ownerCountryId: countryId,
          controllerCountryId: countryId,
          isContested: false,
          combatId: null,
          mesh,
          centerWorld,
          bounds: provinceBounds,
          neighbors: [],
          units: [],
          buildings: createEmptyProvinceBuildings(),
        }
      })

    buildProvinceGraph(provinces)
    this.createPoliticalOverlays(provinces)
    this.createProvinceEdges(provinces)
    this.object.add(source, this.politicalOverlayGroup, this.edgeGroup)

    return provinces
  }

  getPickMeshes(): THREE.Object3D[] {
    return this.provinceMeshes
  }

  updateProvinceColor(province: Province): void {
    const overlay = this.politicalOverlays.get(province.id)

    if (!overlay) {
      return
    }

    updatePoliticalOverlayMaterial(overlay.material, province.controllerCountryId, province.id === this.selectedProvinceId, province.isContested)
  }

  setSelectedProvince(province: Province | null): void {
    const previous = this.selectedProvinceId
    this.selectedProvinceId = province?.id ?? null

    if (previous !== null) {
      const previousOverlay = this.politicalOverlays.get(previous)

      if (previousOverlay) {
        const previousCountry = previousOverlay.userData.controllerCountryId as Province['controllerCountryId'] | undefined
        const previousContested = Boolean(previousOverlay.userData.isContested)
        updatePoliticalOverlayMaterial(previousOverlay.material, previousCountry ?? 'azerbaijan', false, previousContested)
      }
    }

    if (province) {
      this.updateProvinceColor(province)
    }
  }

  refreshAllProvinceColors(provinces: Province[]): void {
    for (const province of provinces) {
      province.mesh.userData.controllerCountryId = province.controllerCountryId
      this.politicalOverlays.get(province.id)!.userData.controllerCountryId = province.controllerCountryId
      this.politicalOverlays.get(province.id)!.userData.isContested = province.isContested
      this.updateProvinceColor(province)
    }
  }

  dispose(): void {
    const disposedGeometries = new Set<THREE.BufferGeometry>()
    const disposedMaterials = new Set<THREE.Material>()

    this.object.traverse((object) => {
      if (!(object instanceof THREE.Mesh || object instanceof THREE.LineSegments)) {
        return
      }

      if (!disposedGeometries.has(object.geometry)) {
        object.geometry.dispose()
        disposedGeometries.add(object.geometry)
      }

      if (Array.isArray(object.material)) {
        object.material.forEach((material) => {
          if (!disposedMaterials.has(material)) {
            material.dispose()
            disposedMaterials.add(material)
          }
        })
      } else {
        if (!disposedMaterials.has(object.material)) {
          object.material.dispose()
          disposedMaterials.add(object.material)
        }
      }
    })
  }

  private createPoliticalOverlays(provinces: Province[]): void {
    for (const province of provinces) {
      const overlay = new THREE.Mesh(
        province.mesh.geometry,
        createPoliticalOverlayMaterial(province.controllerCountryId, false),
      )
      province.mesh.updateWorldMatrix(true, false)
      overlay.matrix.copy(province.mesh.matrixWorld)
      overlay.matrix.elements[13] += POLITICAL_OVERLAY_Y_OFFSET + PROVINCE_Y_OFFSET
      overlay.matrixAutoUpdate = false
      overlay.renderOrder = 2
      overlay.frustumCulled = false
      overlay.userData.provinceId = province.id
      overlay.userData.controllerCountryId = province.controllerCountryId
      overlay.userData.isContested = province.isContested
      this.politicalOverlays.set(province.id, overlay)
      this.politicalOverlayGroup.add(overlay)
    }
  }

  private createProvinceEdges(provinces: Province[]): void {
    const material = new THREE.LineBasicMaterial({ color: 0x202015, transparent: true, opacity: 0.52 })

    for (const province of provinces) {
      const geometry = new THREE.EdgesGeometry(province.mesh.geometry, 14)
      const line = new THREE.LineSegments(geometry, material)
      province.mesh.updateWorldMatrix(true, false)
      line.matrix.copy(province.mesh.matrixWorld)
      line.matrix.elements[13] += EDGE_Y_OFFSET + PROVINCE_Y_OFFSET
      line.matrixAutoUpdate = false
      this.edgeGroup.add(line)
    }
  }
}

function preserveGlbMaterial(mesh: THREE.Mesh): void {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]

  for (const material of materials) {
    material.side = THREE.DoubleSide
    material.needsUpdate = true
  }
}

function selectRenderableProvinceMesh(candidates: THREE.Mesh[]): THREE.Mesh {
  return [...candidates].sort((left, right) => scoreProvinceMesh(right) - scoreProvinceMesh(left))[0]
}

function scoreProvinceMesh(mesh: THREE.Mesh): number {
  let score = 0

  if (/_mesh(?:\.\d+)?$/i.test(mesh.name)) {
    score += 1_000_000
  }

  if (hasTextureMap(mesh.material)) {
    score += 100_000
  }

  if (mesh.geometry.attributes.uv) {
    score += 10_000
  }

  score += mesh.geometry.attributes.position?.count ?? 0

  return score
}

function hasTextureMap(material: THREE.Material | THREE.Material[]): boolean {
  return getMaterialList(material).some((candidate) => 'map' in candidate && candidate.map instanceof THREE.Texture)
}

function getMaterialList(material: THREE.Material | THREE.Material[]): THREE.Material[] {
  return Array.isArray(material) ? material : [material]
}

function createPoliticalOverlayMaterial(
  countryId: Province['controllerCountryId'],
  isSelected: boolean,
): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({
    color: COUNTRY_COLORS[countryId],
    side: THREE.DoubleSide,
    transparent: true,
    opacity: isSelected ? 0.58 : 0.36,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  })
  material.blending = THREE.NormalBlending
  material.needsUpdate = true

  return material
}

function updatePoliticalOverlayMaterial(
  material: THREE.MeshBasicMaterial,
  countryId: Province['controllerCountryId'],
  isSelected: boolean,
  isContested: boolean,
): void {
  material.color.setHex(isContested ? CONTESTED_COLOR : COUNTRY_COLORS[countryId])
  material.opacity = isContested ? 0.68 : isSelected ? 0.58 : 0.36
  material.needsUpdate = true
}

function buildProvinceGraph(provinces: Province[]): void {
  const nearestCount = 5

  for (const province of provinces) {
    province.neighbors = provinces
      .filter((candidate) => candidate.id !== province.id)
      .map((candidate) => ({
        id: candidate.id,
        distance: province.centerWorld.distanceToSquared(candidate.centerWorld),
      }))
      .sort((left, right) => left.distance - right.distance)
      .slice(0, nearestCount)
      .map((candidate) => candidate.id)
  }

  for (const province of provinces) {
    for (const neighborId of province.neighbors) {
      const neighbor = provinces[neighborId]

      if (!neighbor.neighbors.includes(province.id)) {
        neighbor.neighbors.push(province.id)
      }
    }
  }

  patchCrossBorderLinks(provinces)
}

function patchCrossBorderLinks(provinces: Province[]): void {
  const az = provinces.filter((province) => province.countryId === 'azerbaijan')
  const am = provinces.filter((province) => province.countryId === 'armenia')

  for (const armenianProvince of am) {
    const nearestAz = az
      .map((province) => ({
        province,
        distance: province.centerWorld.distanceToSquared(armenianProvince.centerWorld),
      }))
      .sort((left, right) => left.distance - right.distance)
      .slice(0, 2)

    for (const { province: azProvince } of nearestAz) {
      addNeighbor(armenianProvince, azProvince)
      addNeighbor(azProvince, armenianProvince)
    }
  }
}

function addNeighbor(province: Province, neighbor: Province): void {
  if (!province.neighbors.includes(neighbor.id)) {
    province.neighbors.push(neighbor.id)
  }
}
