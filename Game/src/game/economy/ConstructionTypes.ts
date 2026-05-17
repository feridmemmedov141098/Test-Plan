import type { CountryId, ResourceYields } from '../province/provinceTypes'

export type BuildingType = 'barracks' | 'militaryComplex'

export type ProvinceBuildings = Record<BuildingType, number>

export interface BuildingDefinition {
  id: BuildingType
  name: string
  description: string
  cost: ResourceYields
  buildDays: number
  maxPerProvince: number
}

export interface ConstructionJob {
  id: string
  countryId: CountryId
  provinceId: number
  provinceName: string
  buildingType: BuildingType
  buildingName: string
  cost: ResourceYields
  totalDays: number
  daysRemaining: number
}

export const MAX_ACTIVE_CONSTRUCTION_JOBS = 2

export const BUILDING_DEFINITIONS: Record<BuildingType, BuildingDefinition> = {
  barracks: {
    id: 'barracks',
    name: 'Barracks',
    description: 'Adds one division training slot and acts as a deployment province.',
    cost: {
      oil: 0,
      gas: 0,
      metal: 60,
      food: 20,
      industry: 120,
      energy: 20,
      manpower: 0,
      ammunition: 0,
      money: 30,
    },
    buildDays: 6,
    maxPerProvince: 2,
  },
  militaryComplex: {
    id: 'militaryComplex',
    name: 'Military Complex',
    description: 'Produces abstract equipment for new divisions and reinforcement.',
    cost: {
      oil: 20,
      gas: 0,
      metal: 100,
      food: 0,
      industry: 180,
      energy: 50,
      manpower: 0,
      ammunition: 0,
      money: 50,
    },
    buildDays: 8,
    maxPerProvince: 2,
  },
}

export function createEmptyProvinceBuildings(): ProvinceBuildings {
  return {
    barracks: 0,
    militaryComplex: 0,
  }
}
