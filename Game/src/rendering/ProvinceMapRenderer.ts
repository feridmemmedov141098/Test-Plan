import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
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

export class ProvinceMapRenderer {
  readonly object = new THREE.Group()
  readonly worldSize = WORLD_SIZE
  private provinceMeshes: THREE.Mesh[] = []
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

    const canonical = new Map<string, THREE.Mesh>()

    source.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) {
        return
      }

      const baseName = normalizeProvinceName(object.name || object.geometry.name || '')
      const countryId = countryFromProvinceName(baseName)
      const isCanonical = object.name === baseName

      object.visible = false

      if (!countryId || !isCanonical || canonical.has(baseName)) {
        return
      }

      object.visible = true
      object.castShadow = false
      object.receiveShadow = true
      object.frustumCulled = false
      canonical.set(baseName, object)
    })

    const provinces = [...canonical.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, mesh], id): Province => {
        const countryId = countryFromProvinceName(name)!
        const provinceBounds = new THREE.Box3().setFromObject(mesh)
        const centerWorld = new THREE.Vector3()
        provinceBounds.getCenter(centerWorld)
        centerWorld.y += 0.8
        mesh.userData.provinceId = id
        mesh.material = createProvinceMaterial(countryId, false)
        this.provinceMeshes.push(mesh)

        return {
          id,
          name,
          countryId,
          ownerCountryId: countryId,
          controllerCountryId: countryId,
          mesh,
          centerWorld,
          bounds: provinceBounds,
          neighbors: [],
          units: [],
        }
      })

    buildProvinceGraph(provinces)
    this.createProvinceEdges(provinces)
    this.object.add(source, this.edgeGroup)

    return provinces
  }

  getPickMeshes(): THREE.Object3D[] {
    return this.provinceMeshes
  }

  updateProvinceColor(province: Province): void {
    province.mesh.material = createProvinceMaterial(province.controllerCountryId, province.id === this.selectedProvinceId)
  }

  setSelectedProvince(province: Province | null): void {
    const previous = this.selectedProvinceId
    this.selectedProvinceId = province?.id ?? null

    if (previous !== null) {
      const previousMesh = this.provinceMeshes.find((mesh) => mesh.userData.provinceId === previous)

      if (previousMesh) {
        const previousCountry = previousMesh.userData.controllerCountryId as Province['controllerCountryId'] | undefined
        previousMesh.material = createProvinceMaterial(previousCountry ?? 'azerbaijan', false)
      }
    }

    if (province) {
      province.mesh.material = createProvinceMaterial(province.controllerCountryId, true)
    }
  }

  refreshAllProvinceColors(provinces: Province[]): void {
    for (const province of provinces) {
      province.mesh.userData.controllerCountryId = province.controllerCountryId
      this.updateProvinceColor(province)
    }
  }

  dispose(): void {
    this.object.traverse((object) => {
      if (!(object instanceof THREE.Mesh || object instanceof THREE.LineSegments)) {
        return
      }

      object.geometry.dispose()

      if (Array.isArray(object.material)) {
        object.material.forEach((material) => material.dispose())
      } else {
        object.material.dispose()
      }
    })
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

function createProvinceMaterial(countryId: Province['controllerCountryId'], isSelected: boolean): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: COUNTRY_COLORS[countryId],
    roughness: 0.86,
    metalness: 0,
    emissive: isSelected ? 0xffe28a : 0x000000,
    emissiveIntensity: isSelected ? 0.34 : 0,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: isSelected ? 0.98 : 0.86,
  })
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
