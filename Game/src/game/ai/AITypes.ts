import type { CombatSystem } from '../combat/CombatSystem'
import type { DiplomacySystem } from '../diplomacy/DiplomacySystem'
import type { BuildingType } from '../economy/ConstructionTypes'
import type { EconomyState } from '../economy/EconomySystem'
import type { ProducibleCategory } from '../equipment/EquipmentTypes'
import type { ProvincePathfindingSystem } from '../movement/ProvincePathfindingSystem'
import type { CountryId, Province } from '../province/provinceTypes'
import type { DivisionTemplate } from '../units/DivisionDesignerTypes'
import type { UnitState } from '../units/UnitTypes'

export type AIPosture = 'recovering' | 'defensive' | 'balanced' | 'offensive' | 'desperate'

export interface AIPersonality {
  aggression: number
  riskTolerance: number
  reserveRatio: number
  industryPreference: number
  barracksPreference: number
  attackConfidenceThreshold: number
  reinforceConfidenceThreshold: number
  maxAttackOperations: number
}

export interface CountryAIState {
  countryId: CountryId
  personality: AIPersonality
  posture: AIPosture
  lastStrategicDay: number
  lastDailyDay: number
  lastOperationalHourKey: number
  lastAttackDay?: number
  templateIds: string[]
  recentOrders: Record<string, number>
  decisionLog: string[]
}

export interface AIContext {
  currentDay: number
  currentHour: number
  playerCountryId: CountryId
  provinces: Province[]
  units: UnitState[]
  economies: EconomyState
  templates: Map<string, DivisionTemplate>
  pathfinding: ProvincePathfindingSystem
  combatSystem: CombatSystem
  diplomacySystem: DiplomacySystem
}

export interface AIActions {
  getBuildingCounts(countryId: CountryId): { barracks: number; militaryComplex: number }
  getValidConstructionProvinces(countryId: CountryId): Province[]
  getValidDeploymentProvinces(countryId: CountryId): Province[]
  getProjectedBuildingCount(countryId: CountryId, province: Province, buildingType: BuildingType): number
  queueConstruction(countryId: CountryId, provinceId: number, buildingType: BuildingType): boolean
  queueTraining(countryId: CountryId, templateId: string, provinceId: number): boolean
  issueMoveOrder(unitId: string, targetProvinceId: number): boolean
  setProductionPlan(countryId: CountryId, allocations: Partial<Record<ProducibleCategory, number>>): void
  declareWar(countryId: CountryId, target: CountryId): boolean
}
