import type { CountryId } from '../province/provinceTypes'

export type EquipmentCategory = 'smallArms' | 'antiTankWeapons' | 'artillery' | 'tanks' | 'apcIfv' | 'supportVehicles' | 'supplyTrucks'

export type EquipmentStockpiles = Record<EquipmentCategory, number>

export interface ProductionLine {
  id: string
  countryId: CountryId
  category: EquipmentCategory
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

export const EQUIPMENT_LABELS: Record<EquipmentCategory, string> = {
  smallArms: 'Small Arms',
  antiTankWeapons: 'Anti-Tank',
  artillery: 'Artillery',
  tanks: 'Tanks',
  apcIfv: 'APC/IFV',
  supportVehicles: 'Support Vehicles',
  supplyTrucks: 'Supply Trucks',
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
