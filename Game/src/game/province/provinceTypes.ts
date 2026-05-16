import * as THREE from 'three'
import type { ProvinceBuildings } from '../economy/ConstructionTypes'

export const PROVINCE_MAP_URL = '/data/maps/Map.glb'
export const UNIT_MODEL_URL = '/data/maps/Unit_A.glb'

export type CountryId = 'azerbaijan' | 'armenia'
export type ResourceId = 'oil' | 'gas' | 'metal' | 'food' | 'industry' | 'energy' | 'manpower' | 'ammunition'
export type ResourceYields = Record<ResourceId, number>
export type TerrainType = 'urban' | 'suburban' | 'plains' | 'fields' | 'forest' | 'hills' | 'mountain' | 'desert'

export interface ProvinceMetadata {
  displayName: string
  economyRegion: string
  primaryResource: ResourceId
  resourceYields: ResourceYields
  terrainType: TerrainType
}

export interface Province {
  id: number
  name: string
  displayName: string
  economyRegion: string
  primaryResource: ResourceId
  resourceYields: ResourceYields
  terrainType: TerrainType
  countryId: CountryId
  ownerCountryId: CountryId
  controllerCountryId: CountryId
  isContested: boolean
  combatId: string | null
  mesh: THREE.Mesh
  centerWorld: THREE.Vector3
  bounds: THREE.Box3
  neighbors: number[]
  units: string[]
  buildings: ProvinceBuildings
}

export const COUNTRY_NAMES: Record<CountryId, string> = {
  azerbaijan: 'Azerbaijan',
  armenia: 'Armenia',
}

export const COUNTRY_COLORS: Record<CountryId, number> = {
  azerbaijan: 0x4b9e89,
  armenia: 0xc77a5d,
}

export function countryFromProvinceName(name: string): CountryId | null {
  if (name.startsWith('AZ')) {
    return 'azerbaijan'
  }

  if (name.startsWith('AM')) {
    return 'armenia'
  }

  return null
}

export function normalizeProvinceName(name: string): string {
  return name.replace(/_mesh$/i, '').replace(/\.\d+$/i, '')
}
