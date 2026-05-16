import type { EconomySystem } from '../economy/EconomySystem'
import type { Province } from '../province/provinceTypes'
import { getUnitEquipmentNeed, recalculateUnitFromBattalions, type UnitState } from '../units/UnitTypes'
import { forecastBattle, isSideBroken, resolveCombatHour, type BattleProjection } from './CombatSimulator'

export interface CombatInstance {
  id: string
  provinceId: number
  attackerCountryId: UnitState['countryId']
  defenderCountryId: UnitState['countryId']
  participantUnitIds: string[]
  elapsedHours: number
  lastReport: string
  lastProjection: BattleProjection | null
}

export interface CombatResolution {
  status: string
  capturedProvinceId: number | null
}

export class CombatSystem {
  readonly combats = new Map<string, CombatInstance>()
  private nextCombatId = 1

  startCombat(province: Province, attacker: UnitState, units: UnitState[]): CombatInstance {
    if (province.combatId) {
      const existing = this.combats.get(province.combatId)

      if (existing) {
        this.refreshParticipants(existing, province, units)
        attacker.status = 'inCombat'
        return existing
      }
    }

    const defender = units.find((unit) => unit.provinceId === province.id && unit.countryId !== attacker.countryId)
    const combat: CombatInstance = {
      id: `combat-${this.nextCombatId}`,
      provinceId: province.id,
      attackerCountryId: attacker.countryId,
      defenderCountryId: defender?.countryId ?? province.controllerCountryId,
      participantUnitIds: [],
      elapsedHours: 0,
      lastReport: 'Battle joined',
      lastProjection: null,
    }

    this.nextCombatId += 1
    province.isContested = true
    province.combatId = combat.id
    this.combats.set(combat.id, combat)
    this.refreshParticipants(combat, province, units)

    return combat
  }

  tickHourly(provinces: Province[], units: UnitState[], economy: EconomySystem): CombatResolution[] {
    const resolutions: CombatResolution[] = []

    for (const combat of [...this.combats.values()]) {
      const province = provinces[combat.provinceId]
      this.refreshParticipants(combat, province, units)
      const sides = this.getSides(combat, units)

      if (sides.attacker.length === 0 || sides.defender.length === 0) {
        resolutions.push(this.finishCombat(combat, province, sides.attacker.length > 0 ? combat.attackerCountryId : combat.defenderCountryId, units))
        continue
      }

      combat.elapsedHours += 1
      resolveCombatHour(sides.attacker, sides.defender, province, combat.elapsedHours)
      combat.lastProjection = forecastBattle(sides.attacker, sides.defender, province)

      const attackerDefeated = isSideBroken(sides.attacker)
      const defenderDefeated = isSideBroken(sides.defender)

      if (attackerDefeated || defenderDefeated) {
        const winningCountryId = attackerDefeated ? combat.defenderCountryId : combat.attackerCountryId
        this.handleDefeatedSide(attackerDefeated ? sides.attacker : sides.defender, province, provinces)
        resolutions.push(this.finishCombat(combat, province, winningCountryId, units))
      } else {
        combat.lastReport = formatBattleReport(combat.lastProjection)
      }
    }

    this.reinforceUnits(units, economy)
    return resolutions
  }

  getActiveCombatForProvince(provinceId: number): CombatInstance | null {
    return [...this.combats.values()].find((combat) => combat.provinceId === provinceId) ?? null
  }

  getActiveCombatForUnit(unitId: string): CombatInstance | null {
    return [...this.combats.values()].find((combat) => combat.participantUnitIds.includes(unitId)) ?? null
  }

  getSidesForOverlay(combat: CombatInstance, units: UnitState[]): { attacker: UnitState[]; defender: UnitState[] } {
    return this.getSides(combat, units)
  }

  getForecast(attackers: UnitState[], defenders: UnitState[], province: Province): BattleProjection {
    return forecastBattle(attackers, defenders, province)
  }

  private refreshParticipants(combat: CombatInstance, province: Province, units: UnitState[]): void {
    combat.participantUnitIds = units
      .filter((unit) => unit.provinceId === province.id && (unit.countryId === combat.attackerCountryId || unit.countryId === combat.defenderCountryId))
      .map((unit) => unit.id)

    for (const unit of units) {
      if (combat.participantUnitIds.includes(unit.id)) {
        unit.route = []
        unit.routeProvinceIds = []
        unit.routeIndex = 0
        unit.status = 'inCombat'
      }
    }
  }

  private getSides(combat: CombatInstance, units: UnitState[]): { attacker: UnitState[]; defender: UnitState[] } {
    const participants = combat.participantUnitIds
      .map((unitId) => units.find((unit) => unit.id === unitId))
      .filter((unit): unit is UnitState => Boolean(unit))

    return {
      attacker: participants.filter((unit) => unit.countryId === combat.attackerCountryId),
      defender: participants.filter((unit) => unit.countryId === combat.defenderCountryId),
    }
  }

  private handleDefeatedSide(defeatedUnits: UnitState[], province: Province, provinces: Province[]): void {
    for (const unit of defeatedUnits) {
      const retreatProvince = province.neighbors.map((provinceId) => provinces[provinceId]).find((candidate) => candidate.controllerCountryId === unit.countryId && !candidate.isContested)

      if (unit.manpower <= 0 || !retreatProvince) {
        unit.status = 'retreating'
        unit.manpower = 0
        unit.equipment = 0
        unit.battalions.forEach((battalion) => {
          if (battalion.status !== 'destroyed') {
            battalion.status = unit.isEncircled || unit.hoursOutOfSupply >= 24 ? 'surrendered' : 'destroyed'
            battalion.manpower = 0
            battalion.equipment = 0
            battalion.organization = 0
          }
        })
        unit.recentCombatEvents = [unit.isEncircled ? 'Division surrendered after being encircled' : 'Division destroyed with no safe retreat', ...unit.recentCombatEvents].slice(0, 8)
        unit.fortificationDays = 0
        unit.fortifiedProvinceId = null
        continue
      }

      province.units = province.units.filter((unitId) => unitId !== unit.id)
      retreatProvince.units.push(unit.id)
      unit.provinceId = retreatProvince.id
      unit.position.copy(retreatProvince.centerWorld.clone().setY(unit.position.y))
      unit.status = 'reinforcing'
      unit.reinforcementDelayHours = 24
      unit.supplyHours = Math.min(unit.maxSupplyHours, unit.supplyHours + 12)
      unit.hoursOutOfSupply = 0
      unit.encircledHours = 0
      unit.isEncircled = false
      unit.fortificationDays = 0
      unit.fortifiedProvinceId = retreatProvince.id
    }
  }

  private finishCombat(combat: CombatInstance, province: Province, winningCountryId: UnitState['countryId'], units: UnitState[]): CombatResolution {
    province.isContested = false
    province.combatId = null
    province.controllerCountryId = winningCountryId
    this.combats.delete(combat.id)

    for (const unitId of combat.participantUnitIds) {
      const unit = units.find((entry) => entry.id === unitId)

      if (unit && unit.manpower > 0) {
        unit.status = 'reinforcing'
        unit.reinforcementDelayHours = Math.max(unit.reinforcementDelayHours, 24)
      }
    }

    return {
      status: `${winningCountryId === 'azerbaijan' ? 'Azerbaijan' : 'Armenia'} won ${province.displayName}`,
      capturedProvinceId: province.id,
    }
  }

  private reinforceUnits(units: UnitState[], economy: EconomySystem): void {
    for (const unit of units) {
      if (unit.status === 'inCombat' || unit.manpower <= 0) {
        continue
      }

      if (unit.reinforcementDelayHours > 0) {
        unit.reinforcementDelayHours -= 1
        continue
      }

      recoverBattalionOrganization(unit, 5 / 24)
      unit.organization = unit.battalions.reduce((sum, battalion) => sum + battalion.organization, 0) / Math.max(1, unit.battalions.length)

      const manpowerNeed = unit.maxManpower - unit.manpower
      const equipmentNeed = unit.maxEquipment - unit.equipment
      const manpowerReinforced = economy.spendManpower(unit.countryId, Math.min(manpowerNeed, unit.maxManpower * 0.03 / 24))
      const equipmentReinforcedLegacy = economy.spendEquipment(unit.countryId, Math.min(equipmentNeed, unit.maxEquipment * 0.015 / 24))
      const equipmentFillRatio = economy.spendAvailableEquipmentStockpiles(unit.countryId, getUnitEquipmentNeed(unit), 0.03 / 24)
      const equipmentReinforced = Math.min(equipmentNeed, equipmentReinforcedLegacy + unit.maxEquipment * 0.03 / 24 * equipmentFillRatio)

      reinforceBattalions(unit, manpowerReinforced, equipmentReinforced)
      recalculateUnitFromBattalions(unit)

      if (unit.organization >= unit.maxOrganization && unit.manpower >= unit.maxManpower && unit.equipment >= unit.maxEquipment) {
        unit.status = 'idle'
      }
    }
  }
}

function reinforceBattalions(unit: UnitState, manpower: number, equipment: number): void {
  distributeReinforcement(
    manpower,
    unit.battalions.filter((battalion) => battalion.status !== 'destroyed' && battalion.status !== 'surrendered').map((battalion) => ({
      need: battalion.maxManpower - battalion.manpower,
      apply: (amount: number) => {
        battalion.manpower = Math.min(battalion.maxManpower, battalion.manpower + amount)
      },
    })),
  )
  distributeReinforcement(
    equipment,
    unit.battalions.filter((battalion) => battalion.status !== 'destroyed' && battalion.status !== 'surrendered').map((battalion) => ({
      need: battalion.maxEquipment - battalion.equipment,
      apply: (amount: number) => {
        battalion.equipment = Math.min(battalion.maxEquipment, battalion.equipment + amount)
      },
    })),
  )
}

function recoverBattalionOrganization(unit: UnitState, amount: number): void {
  for (const battalion of unit.battalions) {
    if (battalion.status === 'destroyed' || battalion.status === 'surrendered') {
      continue
    }

    battalion.organization = Math.min(battalion.maxOrganization, battalion.organization + amount)

    if (battalion.status === 'shattered' && battalion.organization >= battalion.maxOrganization * 0.42 && battalion.manpower >= battalion.maxManpower * 0.35 && battalion.equipment >= battalion.maxEquipment * 0.35) {
      battalion.status = 'active'
    }
  }
}

function distributeReinforcement(amount: number, entries: Array<{ need: number; apply: (amount: number) => void }>): void {
  let remaining = amount
  let totalNeed = entries.reduce((sum, entry) => sum + Math.max(0, entry.need), 0)

  for (const entry of entries) {
    if (remaining <= 0 || totalNeed <= 0 || entry.need <= 0) {
      continue
    }

    const share = Math.min(entry.need, amount * (entry.need / totalNeed), remaining)
    entry.apply(share)
    remaining -= share
    totalNeed -= entry.need
  }
}

function formatBattleReport(projection: BattleProjection): string {
  const winner = projection.winner === 'attacker' ? 'attacker advantage' : projection.winner === 'defender' ? 'defender holding' : 'stalemate'
  return `${winner} ${projection.confidence}% | ${Math.round(projection.attacker.manpower)} MP vs ${Math.round(projection.defender.manpower)} MP`
}
