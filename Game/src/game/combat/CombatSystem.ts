import type { EconomySystem } from '../economy/EconomySystem'
import type { Province } from '../province/provinceTypes'
import type { UnitState } from '../units/UnitTypes'

export interface CombatInstance {
  id: string
  provinceId: number
  attackerCountryId: UnitState['countryId']
  defenderCountryId: UnitState['countryId']
  participantUnitIds: string[]
  elapsedHours: number
  lastReport: string
}

export interface CombatResolution {
  status: string
  capturedProvinceId: number | null
}

export class CombatSystem {
  readonly combats = new Map<string, CombatInstance>()
  private nextCombatId = 1
  private varianceStep = 0

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
      this.applyCombatRound(sides.attacker, sides.defender, province)
      this.applyCombatRound(sides.defender, sides.attacker, province)

      const attackerDefeated = isSideDefeated(sides.attacker)
      const defenderDefeated = isSideDefeated(sides.defender)

      if (attackerDefeated || defenderDefeated) {
        const winningCountryId = attackerDefeated ? combat.defenderCountryId : combat.attackerCountryId
        this.handleDefeatedSide(attackerDefeated ? sides.attacker : sides.defender, province, provinces)
        resolutions.push(this.finishCombat(combat, province, winningCountryId, units))
      } else {
        combat.lastReport = `${formatSide(sides.attacker)} vs ${formatSide(sides.defender)}`
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

  private applyCombatRound(attackers: UnitState[], defenders: UnitState[], province: Province): void {
    const attackPower = getSideAttack(attackers, province)
    const defensePower = getSideDefense(defenders, province)
    const damage = Math.max(1, attackPower - defensePower * 0.45) * this.nextVariance()

    for (const defender of defenders) {
      const share = damage / defenders.length
      const orgLoss = share * 0.62
      const manpowerLoss = share * 1.4 * (1.05 - defender.reliability)
      const equipmentLoss = share * 0.12 * (1.05 - defender.reliability)

      defender.organization = Math.max(0, defender.organization - orgLoss)
      defender.manpower = Math.max(0, defender.manpower - manpowerLoss)
      defender.equipment = Math.max(0, defender.equipment - equipmentLoss)
    }
  }

  private nextVariance(): number {
    const values = [0.9, 0.96, 1.03, 1.1, 1.0]
    const value = values[this.varianceStep % values.length]
    this.varianceStep += 1
    return value
  }

  private handleDefeatedSide(defeatedUnits: UnitState[], province: Province, provinces: Province[]): void {
    for (const unit of defeatedUnits) {
      const retreatProvince = province.neighbors.map((provinceId) => provinces[provinceId]).find((candidate) => candidate.controllerCountryId === unit.countryId && !candidate.isContested)

      if (unit.manpower <= 0 || !retreatProvince) {
        unit.status = 'retreating'
        unit.manpower = 0
        continue
      }

      province.units = province.units.filter((unitId) => unitId !== unit.id)
      retreatProvince.units.push(unit.id)
      unit.provinceId = retreatProvince.id
      unit.position.copy(retreatProvince.centerWorld.clone().setY(unit.position.y))
      unit.status = 'reinforcing'
      unit.reinforcementDelayHours = 24
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

      unit.organization = Math.min(unit.maxOrganization, unit.organization + 5 / 24)

      const manpowerNeed = unit.maxManpower - unit.manpower
      const equipmentNeed = unit.maxEquipment - unit.equipment
      const manpowerReinforced = economy.spendManpower(unit.countryId, Math.min(manpowerNeed, unit.maxManpower * 0.03 / 24))
      const equipmentReinforced = economy.spendEquipment(unit.countryId, Math.min(equipmentNeed, unit.maxEquipment * 0.03 / 24))

      unit.manpower += manpowerReinforced
      unit.equipment += equipmentReinforced

      if (unit.organization >= unit.maxOrganization && unit.manpower >= unit.maxManpower && unit.equipment >= unit.maxEquipment) {
        unit.status = 'idle'
      }
    }
  }
}

function getSideAttack(units: UnitState[], province: Province): number {
  return units.reduce((sum, unit) => {
    const terrainModifier = unit.terrainProfile[province.terrainType]?.attack ?? 1
    return sum + unit.attack * terrainModifier * getUnitEffectiveness(unit)
  }, 0) * getStackingModifier(units.length)
}

function getSideDefense(units: UnitState[], province: Province): number {
  return units.reduce((sum, unit) => {
    const terrainModifier = unit.terrainProfile[province.terrainType]?.defense ?? 1
    return sum + unit.defense * terrainModifier * getUnitEffectiveness(unit)
  }, 0) * getStackingModifier(units.length)
}

function getUnitEffectiveness(unit: UnitState): number {
  return Math.max(0.05, (unit.organization / unit.maxOrganization) * (unit.manpower / unit.maxManpower) * (unit.equipment / unit.maxEquipment))
}

function getStackingModifier(unitCount: number): number {
  return unitCount <= 4 ? 1 : Math.max(0.35, 1 - (unitCount - 4) * 0.1)
}

function isSideDefeated(units: UnitState[]): boolean {
  if (units.length === 0) {
    return true
  }

  const totalManpower = units.reduce((sum, unit) => sum + unit.manpower, 0)
  const totalMaxManpower = units.reduce((sum, unit) => sum + unit.maxManpower, 0)

  return units.every((unit) => unit.organization <= 0) || totalManpower <= totalMaxManpower * 0.25
}

function formatSide(units: UnitState[]): string {
  const manpower = units.reduce((sum, unit) => sum + unit.manpower, 0)
  const organization = units.reduce((sum, unit) => sum + unit.organization, 0) / Math.max(1, units.length)

  return `${Math.round(manpower)} MP / ${Math.round(organization)} org`
}
