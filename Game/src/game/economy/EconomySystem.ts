import type { CountryId, Province, ResourceId, ResourceYields } from '../province/provinceTypes'
import { createEmptyYields, RESOURCE_IDS } from '../province/provinceMetadata'

export interface CountryEconomy {
  stockpiles: ResourceYields
  dailyIncome: ResourceYields
  manpowerPool: number
  equipmentPool: number
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
      economy.equipmentPool += economy.dailyIncome.industry * 5 + economy.dailyIncome.metal * 2
    }
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
  stockpiles.manpower = startingManpower
  stockpiles.industry = startingIndustry

  return {
    stockpiles,
    dailyIncome: createEmptyYields(),
    manpowerPool: startingManpower,
    equipmentPool: startingIndustry * 5,
  }
}
