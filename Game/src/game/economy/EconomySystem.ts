import type { CountryId, Province, ResourceId, ResourceYields } from '../province/provinceTypes'
import { createEmptyYields, RESOURCE_IDS } from '../province/provinceMetadata'
import type { ConstructionJob } from './ConstructionTypes'
import type { TrainingJob } from '../units/DivisionDesignerTypes'
import {
  EQUIPMENT_CATEGORIES,
  FACTORY_OUTPUT_BASE,
  addEquipmentStockpiles,
  canAffordEquipment,
  createEmptyEquipmentStockpiles,
  type EquipmentCategory,
  type EquipmentStockpiles,
  type ProducibleCategory,
  type ProductionLine,
} from '../equipment/EquipmentTypes'

export interface CountryEconomy {
  stockpiles: ResourceYields
  dailyIncome: ResourceYields
  manpowerPool: number
  equipmentPool: number
  equipmentStockpiles: EquipmentStockpiles
  productionLines: ProductionLine[]
  constructionQueue: ConstructionJob[]
  trainingQueue: TrainingJob[]
}

export type EconomyState = Record<CountryId, CountryEconomy>

export class EconomySystem {
  readonly countries: EconomyState = {
    azerbaijan: createCountryEconomy(5000, 500),
    armenia: createCountryEconomy(3000, 350),
  }

  tickDaily(provinces: Province[]): void {
    for (const country of Object.values(this.countries)) {
      country.dailyIncome = createEmptyYields()
    }

    for (const province of provinces) {
      if (province.isContested) {
        continue
      }

      const economy = this.countries[province.controllerCountryId]

      for (const resourceId of RESOURCE_IDS) {
        economy.dailyIncome[resourceId] += province.resourceYields[resourceId]
        economy.stockpiles[resourceId] += province.resourceYields[resourceId]
      }
    }

    for (const economy of Object.values(this.countries)) {
      economy.manpowerPool = economy.stockpiles.manpower

      for (const line of economy.productionLines) {
        const output = FACTORY_OUTPUT_BASE[line.category] * line.factoryCount
        if (line.category === 'ammunition') {
          economy.stockpiles.ammunition += output
        } else {
          economy.equipmentStockpiles[line.category] += output
        }
      }
    }
  }

  addEquipment(countryId: CountryId, amount: number): void {
    this.countries[countryId].equipmentPool += amount
  }

  canAfford(countryId: CountryId, cost: ResourceYields): boolean {
    const country = this.countries[countryId]
    return RESOURCE_IDS.every((resourceId) => country.stockpiles[resourceId] >= cost[resourceId])
  }

  spendResources(countryId: CountryId, cost: ResourceYields): boolean {
    if (!this.canAfford(countryId, cost)) {
      return false
    }

    for (const resourceId of RESOURCE_IDS) {
      this.spend(countryId, resourceId, cost[resourceId])
    }

    return true
  }

  refundResources(countryId: CountryId, cost: ResourceYields, multiplier = 1): void {
    const country = this.countries[countryId]

    for (const resourceId of RESOURCE_IDS) {
      country.stockpiles[resourceId] += cost[resourceId] * multiplier
    }

    country.manpowerPool = country.stockpiles.manpower
  }

  spendManpower(countryId: CountryId, amount: number): number {
    return this.spend(countryId, 'manpower', amount)
  }

  spendEquipment(countryId: CountryId, amount: number): number {
    const country = this.countries[countryId]
    const availableEquipment = country.equipmentPool
    const spentEquipment = Math.min(availableEquipment, amount)

    country.equipmentPool -= spentEquipment
    return spentEquipment
  }

  canAffordEquipment(countryId: CountryId, cost: Partial<EquipmentStockpiles>): boolean {
    return canAffordEquipment(this.countries[countryId].equipmentStockpiles, cost)
  }

  spendEquipmentStockpiles(countryId: CountryId, cost: Partial<EquipmentStockpiles>): boolean {
    const country = this.countries[countryId]

    if (!canAffordEquipment(country.equipmentStockpiles, cost)) {
      return false
    }

    for (const category of EQUIPMENT_CATEGORIES) {
      country.equipmentStockpiles[category] -= cost[category] ?? 0
    }

    return true
  }

  spendAvailableEquipmentStockpiles(countryId: CountryId, cost: Partial<EquipmentStockpiles>, multiplier = 1): number {
    const country = this.countries[countryId]
    let totalNeeded = 0
    let totalSpent = 0

    for (const category of EQUIPMENT_CATEGORIES) {
      const needed = (cost[category] ?? 0) * multiplier
      const spent = Math.min(country.equipmentStockpiles[category], needed)
      country.equipmentStockpiles[category] -= spent
      totalNeeded += needed
      totalSpent += spent
    }

    return totalNeeded <= 0 ? 1 : totalSpent / totalNeeded
  }

  refundEquipmentStockpiles(countryId: CountryId, cost: Partial<EquipmentStockpiles>, multiplier = 1): void {
    const country = this.countries[countryId]
    country.equipmentStockpiles = addEquipmentStockpiles(country.equipmentStockpiles, cost, multiplier)
  }

  addEquipmentCategory(countryId: CountryId, category: EquipmentCategory, amount: number): void {
    this.countries[countryId].equipmentStockpiles[category] += amount
  }

  getTotalAssignedFactories(countryId: CountryId): number {
    return this.countries[countryId].productionLines.reduce((sum, line) => sum + line.factoryCount, 0)
  }

  addProductionLine(countryId: CountryId, category: ProducibleCategory, factoryCount = 1): ProductionLine {
    const country = this.countries[countryId]
    const line: ProductionLine = {
      id: `${countryId}-line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      countryId,
      category,
      factoryCount,
    }
    country.productionLines.push(line)
    return line
  }

  deleteProductionLine(countryId: CountryId, lineId: string): void {
    const country = this.countries[countryId]
    country.productionLines = country.productionLines.filter((line) => line.id !== lineId)
  }

  setProductionLineCategory(countryId: CountryId, lineId: string, category: ProducibleCategory): void {
    const line = this.countries[countryId].productionLines.find((candidate) => candidate.id === lineId)
    if (line) {
      line.category = category
    }
  }

  setProductionLineFactoryCount(countryId: CountryId, lineId: string, factoryCount: number): void {
    const line = this.countries[countryId].productionLines.find((candidate) => candidate.id === lineId)
    if (line) {
      line.factoryCount = Math.max(1, factoryCount)
    }
  }

  private spend(countryId: CountryId, resourceId: ResourceId, amount: number): number {
    const country = this.countries[countryId]
    const spent = Math.min(country.stockpiles[resourceId], amount)

    country.stockpiles[resourceId] -= spent

    if (resourceId === 'manpower') {
      country.manpowerPool = country.stockpiles.manpower
    }

    return spent
  }
}

function createCountryEconomy(startingManpower: number, startingIndustry: number): CountryEconomy {
  const stockpiles = createEmptyYields()
  const equipmentStockpiles = createEmptyEquipmentStockpiles()
  stockpiles.manpower = startingManpower
  stockpiles.industry = startingIndustry
  stockpiles.ammunition = startingIndustry * 4
  equipmentStockpiles.smallArms = startingIndustry * 3
  equipmentStockpiles.antiTankWeapons = Math.round(startingIndustry * 0.35)
  equipmentStockpiles.artillery = Math.round(startingIndustry * 0.25)
  equipmentStockpiles.tanks = Math.round(startingIndustry * 0.2)
  equipmentStockpiles.apcIfv = Math.round(startingIndustry * 0.28)
  equipmentStockpiles.supportVehicles = Math.round(startingIndustry * 0.8)
  equipmentStockpiles.supplyTrucks = 3

  return {
    stockpiles,
    dailyIncome: createEmptyYields(),
    manpowerPool: startingManpower,
    equipmentPool: startingIndustry * 5,
    equipmentStockpiles,
    productionLines: [],
    constructionQueue: [],
    trainingQueue: [],
  }
}
