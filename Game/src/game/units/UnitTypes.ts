import * as THREE from 'three'
import type { CountryId } from '../province/provinceTypes'

export type UnitStatus = 'idle' | 'moving' | 'inCombat' | 'retreating' | 'reinforcing'

export interface UnitState {
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
  manpower: number
  maxManpower: number
  organization: number
  maxOrganization: number
  equipment: number
  maxEquipment: number
  attack: number
  defense: number
  reliability: number
  experience: number
  status: UnitStatus
  reinforcementDelayHours: number
}
