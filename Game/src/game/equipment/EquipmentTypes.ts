import type { CountryId } from '../province/provinceTypes'

export type EquipmentCategory = 'smallArms' | 'antiTankWeapons' | 'artillery' | 'tanks' | 'apcIfv' | 'supportVehicles' | 'supplyTrucks'

export type ProducibleCategory = EquipmentCategory | 'ammunition'

export type EquipmentStockpiles = Record<EquipmentCategory, number>

export interface ProductionLine {
  id: string
  countryId: CountryId
  category: ProducibleCategory
  factoryCount: number
}

export const EQUIPMENT_CATEGORIES: EquipmentCategory[] = [
  'smallArms',
  'antiTankWeapons',
  'artillery',
  'tanks',
  'apcIfv',
  'supportVehicles',
  'supplyTrucks',
]

export const PRODUCIBLE_CATEGORIES: ProducibleCategory[] = [
  ...EQUIPMENT_CATEGORIES,
  'ammunition',
]

export const EQUIPMENT_LABELS: Record<EquipmentCategory, string> = {
  smallArms: 'Small Arms',
  antiTankWeapons: 'Anti-Tank',
  artillery: 'Artillery',
  tanks: 'Tanks',
  apcIfv: 'APC/IFV',
  supportVehicles: 'Support Vehicles',
  supplyTrucks: 'Supply Trucks',
}

export const PRODUCIBLE_LABELS: Record<ProducibleCategory, string> = {
  ...EQUIPMENT_LABELS,
  ammunition: 'Ammunition',
}

export const EQUIPMENT_PRODUCTION_OUTPUT: Record<EquipmentCategory, number> = {
  smallArms: 48,
  antiTankWeapons: 8,
  artillery: 5,
  tanks: 3,
  apcIfv: 5,
  supportVehicles: 12,
  supplyTrucks: 1,
}

export const FACTORY_OUTPUT_BASE: Record<ProducibleCategory, number> = {
  smallArms: 48,
  antiTankWeapons: 8,
  artillery: 5,
  tanks: 3,
  apcIfv: 5,
  supportVehicles: 12,
  supplyTrucks: 1,
  ammunition: 40,
}

export const MAX_FACTORY_COUNT_PER_LINE = 15

export function createEmptyEquipmentStockpiles(): EquipmentStockpiles {
  return {
    smallArms: 0,
    antiTankWeapons: 0,
    artillery: 0,
    tanks: 0,
    apcIfv: 0,
    supportVehicles: 0,
    supplyTrucks: 0,
  }
}

export function addEquipmentStockpiles(left: EquipmentStockpiles, right: Partial<EquipmentStockpiles>, multiplier = 1): EquipmentStockpiles {
  const result = { ...left }

  for (const category of EQUIPMENT_CATEGORIES) {
    result[category] += (right[category] ?? 0) * multiplier
  }

  return result
}

export function canAffordEquipment(stockpiles: EquipmentStockpiles, cost: Partial<EquipmentStockpiles>): boolean {
  return EQUIPMENT_CATEGORIES.every((category) => stockpiles[category] >= (cost[category] ?? 0))
}
