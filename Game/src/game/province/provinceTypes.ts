import * as THREE from 'three'

export const PROVINCE_MAP_URL = '/data/maps/Map.glb'
export const UNIT_MODEL_URL = '/data/maps/Unit_A.glb'

export type CountryId = 'azerbaijan' | 'armenia'

export interface Province {
  id: number
  name: string
  countryId: CountryId
  ownerCountryId: CountryId
  controllerCountryId: CountryId
  mesh: THREE.Mesh
  centerWorld: THREE.Vector3
  bounds: THREE.Box3
  neighbors: number[]
  units: string[]
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
