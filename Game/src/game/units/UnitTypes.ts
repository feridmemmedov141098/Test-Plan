import * as THREE from 'three'
import { createEmptyEquipmentStockpiles, type EquipmentStockpiles } from '../equipment/EquipmentTypes'
import type { CountryId } from '../province/provinceTypes'
import {
  BATTALION_DEFINITIONS,
  calculateDivisionStats,
  type BattalionType,
  type DivisionNode,
  type DivisionStats,
  type TerrainModifierSet,
} from './DivisionDesignerTypes'

export type UnitStatus = 'idle' | 'moving' | 'inCombat' | 'retreating' | 'reinforcing'
export type BattalionCombatStatus = 'active' | 'shattered' | 'destroyed' | 'surrendered'

export interface UnitBattalionState {
  id: string
  battalionType: BattalionType
  name: string
  manpower: number
  maxManpower: number
  equipment: number
  maxEquipment: number
  equipmentRequirements: EquipmentStockpiles
  organization: number
  maxOrganization: number
  status: BattalionCombatStatus
}

export interface UnitState {
  id: string
  name: string
  templateId: string
  templateName: string
  templateNodes: DivisionNode[]
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
  battalions: UnitBattalionState[]
  stats: DivisionStats
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
  terrainProfile: TerrainModifierSet
  experience: number
  fortifiedProvinceId: number | null
  fortificationDays: number
  supplyHours: number
  maxSupplyHours: number
  hoursOutOfSupply: number
  encircledHours: number
  isEncircled: boolean
  lastSupplySourceProvinceId: number | null
  recentCombatEvents: string[]
  status: UnitStatus
  reinforcementDelayHours: number
}

export function createBattalionStates(nodes: DivisionNode[], unitId: string): UnitBattalionState[] {
  return nodes.map((node, index) => {
    const definition = BATTALION_DEFINITIONS[node.battalionType]

    return {
      id: `${unitId}-bn-${index + 1}`,
      battalionType: node.battalionType,
      name: definition.name,
      manpower: definition.manpower,
      maxManpower: definition.manpower,
      equipment: definition.equipment,
      maxEquipment: definition.equipment,
      equipmentRequirements: { ...definition.equipmentRequirements },
      organization: definition.organization,
      maxOrganization: definition.organization,
      status: 'active',
    }
  })
}

export function buildUnitCombatFields(
  unitId: string,
  templateId: string,
  templateName: string,
  nodes: DivisionNode[],
  stats: DivisionStats = calculateDivisionStats(nodes),
): Pick<UnitState,
  'templateId' |
  'templateName' |
  'templateNodes' |
  'speed' |
  'manpower' |
  'maxManpower' |
  'organization' |
  'maxOrganization' |
  'equipment' |
  'maxEquipment' |
  'battalions' |
  'stats' |
  'softAttack' |
  'hardAttack' |
  'attack' |
  'defense' |
  'breakthrough' |
  'armor' |
  'piercing' |
  'hardness' |
  'maneuverability' |
  'supplyUse' |
  'fuelUse' |
  'reliability' |
  'terrainProfile'
> {
  return {
    templateId,
    templateName,
    templateNodes: nodes.map((node) => ({ ...node })),
    speed: stats.speed,
    manpower: stats.manpower,
    maxManpower: stats.manpower,
    organization: stats.organization,
    maxOrganization: stats.organization,
    equipment: stats.equipment,
    maxEquipment: stats.equipment,
    battalions: createBattalionStates(nodes, unitId),
    stats,
    softAttack: stats.softAttack,
    hardAttack: stats.hardAttack,
    attack: Math.round(stats.attack),
    defense: Math.round(stats.defense),
    breakthrough: Math.round(stats.breakthrough),
    armor: stats.armor,
    piercing: stats.piercing,
    hardness: stats.hardness,
    maneuverability: stats.maneuverability,
    supplyUse: stats.supplyUse,
    fuelUse: stats.fuelUse,
    reliability: stats.reliability,
    terrainProfile: stats.terrainProfile,
  }
}

export function recalculateUnitFromBattalions(unit: UnitState): void {
  const activeBattalions = unit.battalions.filter((battalion) => battalion.status === 'active' || battalion.status === 'shattered')
  const activeNodes = unit.templateNodes.filter((_, index) => {
    const battalion = unit.battalions[index]
    return battalion?.status === 'active' || battalion?.status === 'shattered'
  })
  const stats = calculateDivisionStats(activeNodes)

  unit.manpower = activeBattalions.reduce((sum, battalion) => sum + battalion.manpower, 0)
  unit.maxManpower = activeBattalions.reduce((sum, battalion) => sum + battalion.maxManpower, 0)
  unit.equipment = activeBattalions.reduce((sum, battalion) => sum + battalion.equipment, 0)
  unit.maxEquipment = activeBattalions.reduce((sum, battalion) => sum + battalion.maxEquipment, 0)
  unit.organization = activeBattalions.reduce((sum, battalion) => sum + battalion.organization, 0) / Math.max(1, activeBattalions.length)
  unit.maxOrganization = activeBattalions.reduce((sum, battalion) => sum + battalion.maxOrganization, 0) / Math.max(1, activeBattalions.length)
  unit.stats = stats
  unit.softAttack = stats.softAttack
  unit.hardAttack = stats.hardAttack
  unit.attack = Math.round(stats.attack)
  unit.defense = Math.round(stats.defense)
  unit.breakthrough = Math.round(stats.breakthrough)
  unit.speed = stats.speed
  unit.armor = stats.armor
  unit.piercing = stats.piercing
  unit.hardness = stats.hardness
  unit.maneuverability = stats.maneuverability
  unit.supplyUse = stats.supplyUse
  unit.fuelUse = stats.fuelUse
  unit.reliability = stats.reliability
  unit.terrainProfile = stats.terrainProfile

  if (activeBattalions.length === 0) {
    unit.manpower = 0
    unit.equipment = 0
  }
}

export function getUnitEquipmentNeed(unit: UnitState): EquipmentStockpiles {
  const need = createEmptyEquipmentStockpiles()

  for (const battalion of unit.battalions) {
    if (battalion.status === 'destroyed' || battalion.status === 'surrendered') {
      continue
    }

    const missingRatio = 1 - battalion.equipment / Math.max(1, battalion.maxEquipment)

    for (const category of Object.keys(need) as Array<keyof EquipmentStockpiles>) {
      need[category] += battalion.equipmentRequirements[category] * Math.max(0, missingRatio)
    }
  }

  return need
}
