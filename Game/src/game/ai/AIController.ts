import { BUILDING_DEFINITIONS, MAX_ACTIVE_CONSTRUCTION_JOBS, type BuildingType } from '../economy/ConstructionTypes'
import { EQUIPMENT_CATEGORIES, PRODUCIBLE_CATEGORIES, type ProducibleCategory } from '../equipment/EquipmentTypes'
import type { CountryId, Province } from '../province/provinceTypes'
import { calculateDivisionStats, type BattalionType, type DivisionNode, type DivisionTemplate } from '../units/DivisionDesignerTypes'
import type { UnitState } from '../units/UnitTypes'
import type { AIActions, AIContext, AIPersonality, AIPosture, CountryAIState } from './AITypes'

const DEFAULT_PERSONALITY: AIPersonality = {
  aggression: 0.45,
  riskTolerance: 0.42,
  reserveRatio: 0.25,
  industryPreference: 0.55,
  barracksPreference: 0.45,
  attackConfidenceThreshold: 62,
  reinforceConfidenceThreshold: 48,
  maxAttackOperations: 1,
}

const OPERATIONAL_TICK_HOURS = 6
const STRATEGIC_TICK_DAYS = 4
const ORDER_COOLDOWN_HOURS = 12

export class AIController {
  private readonly states = new Map<CountryId, CountryAIState>()

  constructor(countryIds: CountryId[]) {
    for (const countryId of countryIds) {
      this.states.set(countryId, {
        countryId,
        personality: { ...DEFAULT_PERSONALITY },
        posture: 'balanced',
        lastStrategicDay: 0,
        lastDailyDay: 0,
        lastOperationalHourKey: -1,
        templateIds: [],
        recentOrders: {},
        decisionLog: [],
      })
    }
  }

  tick(context: AIContext, actions: AIActions): void {
    for (const state of this.states.values()) {
      if (state.countryId === context.playerCountryId) {
        continue
      }

      this.ensureTemplates(state, context)

      if (context.currentDay - state.lastStrategicDay >= STRATEGIC_TICK_DAYS) {
        state.posture = this.evaluatePosture(state, context, actions)
        state.lastStrategicDay = context.currentDay
      }

      if (state.lastDailyDay !== context.currentDay) {
        this.runDailyPlanning(state, context, actions)
        state.lastDailyDay = context.currentDay
      }

      const hourKey = context.currentDay * 24 + context.currentHour
      if (hourKey - state.lastOperationalHourKey >= OPERATIONAL_TICK_HOURS) {
        this.runOperationalPlanning(state, context, actions, hourKey)
        state.lastOperationalHourKey = hourKey
      }
    }
  }

  private runDailyPlanning(state: CountryAIState, context: AIContext, actions: AIActions): void {
    this.planConstruction(state, context, actions)
    this.planProduction(state, context, actions)
    this.planTraining(state, context, actions)
  }

  private runOperationalPlanning(state: CountryAIState, context: AIContext, actions: AIActions, hourKey: number): void {
    this.reinforceActiveBattles(state, context, actions, hourKey)
    this.assignBorderDefense(state, context, actions, hourKey)
    this.considerAttacks(state, context, actions, hourKey)
  }

  private evaluatePosture(state: CountryAIState, context: AIContext, actions: AIActions): AIPosture {
    const units = this.getCountryUnits(state.countryId, context)
    const livingUnits = units.filter((unit) => unit.manpower > 0)
    const controlled = this.getControlledProvinces(state.countryId, context)
    const owned = context.provinces.filter((province) => province.ownerCountryId === state.countryId)
    const averageReadiness = livingUnits.reduce((sum, unit) => sum + getUnitReadiness(unit), 0) / Math.max(1, livingUnits.length)
    const activeCombats = [...context.combatSystem.combats.values()].filter((combat) => combat.attackerCountryId === state.countryId || combat.defenderCountryId === state.countryId)
    const buildings = actions.getBuildingCounts(state.countryId)

    if (controlled.length <= Math.max(1, owned.length * 0.45) || livingUnits.length <= 2) {
      return 'desperate'
    }

    if (averageReadiness < 0.48 || activeCombats.length >= 2) {
      return 'recovering'
    }

    if (buildings.barracks < 2 || buildings.militaryComplex < 2) {
      return 'defensive'
    }

    const borderBalance = this.getBorderBalance(state.countryId, context)
    if (borderBalance > 1.35 && averageReadiness > 0.78) {
      return 'offensive'
    }

    if (borderBalance < 0.8) {
      return 'defensive'
    }

    return 'balanced'
  }

  private planConstruction(state: CountryAIState, context: AIContext, actions: AIActions): void {
    const economy = context.economies[state.countryId]
    const validProvinces = actions.getValidConstructionProvinces(state.countryId)
    const buildings = actions.getBuildingCounts(state.countryId)

    while (economy.constructionQueue.length < MAX_ACTIVE_CONSTRUCTION_JOBS) {
      const buildingType = this.chooseBuildingType(state, buildings)
      const province = this.chooseConstructionProvince(state.countryId, buildingType, validProvinces, context, actions)

      if (!province || !context.economies[state.countryId]) {
        return
      }

      if (!canAffordConstruction(context, state.countryId, buildingType)) {
        return
      }

      if (!actions.queueConstruction(state.countryId, province.id, buildingType)) {
        return
      }

      buildings[buildingType] += 1
      this.log(state, `queued ${buildingType} in ${province.displayName}`)
    }
  }

  private chooseBuildingType(state: CountryAIState, buildings: { barracks: number; militaryComplex: number }): BuildingType {
    if (buildings.barracks <= 0) return 'barracks'
    if (buildings.militaryComplex <= 0) return 'militaryComplex'
    if (buildings.barracks < 2) return 'barracks'
    if (buildings.militaryComplex < 3) return 'militaryComplex'
    if (state.posture === 'recovering' || state.posture === 'desperate') return 'barracks'
    return buildings.militaryComplex / Math.max(1, buildings.barracks) < 1.5 ? 'militaryComplex' : 'barracks'
  }

  private chooseConstructionProvince(countryId: CountryId, buildingType: BuildingType, provinces: Province[], context: AIContext, actions: AIActions): Province | null {
    return [...provinces]
      .filter((province) => actions.getProjectedBuildingCount(countryId, province, buildingType) < BUILDING_DEFINITIONS[buildingType].maxPerProvince)
      .sort((left, right) => this.scoreConstructionProvince(countryId, right, buildingType, context) - this.scoreConstructionProvince(countryId, left, buildingType, context))[0] ?? null
  }

  private scoreConstructionProvince(countryId: CountryId, province: Province, buildingType: BuildingType, context: AIContext): number {
    const isBorder = province.neighbors.some((neighborId) => context.provinces[neighborId].controllerCountryId !== countryId)
    const borderPenalty = isBorder ? 30 : 0
    const existingPenalty = province.buildings[buildingType] * 12

    if (buildingType === 'militaryComplex') {
      return province.resourceYields.industry * 3 + province.resourceYields.metal * 1.4 + province.resourceYields.energy - borderPenalty - existingPenalty
    }

    return province.resourceYields.manpower * 2 + province.resourceYields.food + province.resourceYields.industry - borderPenalty * 0.35 - existingPenalty
  }

  private planProduction(state: CountryAIState, context: AIContext, actions: AIActions): void {
    const buildings = actions.getBuildingCounts(state.countryId)
    const factories = buildings.militaryComplex

    if (factories <= 0) {
      actions.setProductionPlan(state.countryId, {})
      return
    }

    const economy = context.economies[state.countryId]
    const allocations: Partial<Record<ProducibleCategory, number>> = {}
    const weights = this.getProductionWeights(state, context)
    let remaining = factories
    const sorted = [...PRODUCIBLE_CATEGORIES].sort((left, right) => (weights[right] ?? 0) - (weights[left] ?? 0))

    for (const category of sorted) {
      if (remaining <= 0) break
      const weight = weights[category] ?? 0
      if (weight <= 0) continue
      const count = Math.max(1, Math.round(factories * weight))
      const assigned = Math.min(remaining, count)
      allocations[category] = assigned
      remaining -= assigned
    }

    if (remaining > 0) {
      allocations.smallArms = (allocations.smallArms ?? 0) + remaining
    }

    if (economy.stockpiles.ammunition < 600 && factories >= 2) {
      allocations.ammunition = Math.max(1, allocations.ammunition ?? 0)
    }

    actions.setProductionPlan(state.countryId, allocations)
  }

  private getProductionWeights(state: CountryAIState, context: AIContext): Record<ProducibleCategory, number> {
    const economy = context.economies[state.countryId]
    const units = this.getCountryUnits(state.countryId, context)
    const shortages: Record<ProducibleCategory, number> = {
      smallArms: 0.35,
      antiTankWeapons: state.posture === 'defensive' ? 0.16 : 0.1,
      artillery: 0.14,
      tanks: state.posture === 'offensive' ? 0.08 : 0.02,
      apcIfv: state.posture === 'offensive' ? 0.08 : 0.03,
      supportVehicles: 0.14,
      supplyTrucks: economy.equipmentStockpiles.supplyTrucks < 4 ? 0.1 : 0.04,
      ammunition: economy.stockpiles.ammunition < 1200 ? 0.14 : 0.06,
    }

    for (const unit of units) {
      if (unit.manpower <= 0) continue
      for (const category of EQUIPMENT_CATEGORIES) {
        const ratio = economy.equipmentStockpiles[category] / Math.max(1, unit.stats.equipmentRequirements[category] || 1)
        if (ratio < 2) {
          shortages[category] += 0.04
        }
      }
    }

    return shortages
  }

  private planTraining(state: CountryAIState, context: AIContext, actions: AIActions): void {
    const economy = context.economies[state.countryId]
    const buildings = actions.getBuildingCounts(state.countryId)
    const activeTrainingCount = economy.trainingQueue.filter((job) => job.status === 'training').length
    const slots = Math.max(0, buildings.barracks - activeTrainingCount)
    const deploymentProvinces = actions.getValidDeploymentProvinces(state.countryId)

    if (slots <= 0 || deploymentProvinces.length === 0) {
      return
    }

    for (let i = 0; i < slots; i += 1) {
      const template = this.chooseTrainingTemplate(state, context)
      const province = this.chooseDeploymentProvince(state.countryId, deploymentProvinces, context)

      if (!template || !province || !actions.queueTraining(state.countryId, template.id, province.id)) {
        break
      }

      this.log(state, `training ${template.name}`)
    }
  }

  private chooseTrainingTemplate(state: CountryAIState, context: AIContext): DivisionTemplate | null {
    const economy = context.economies[state.countryId]
    const templates = state.templateIds.map((id) => context.templates.get(id)).filter((template): template is DivisionTemplate => Boolean(template))
    const scored = templates
      .map((template) => ({ template, score: this.scoreTemplateForTraining(template, state, economy) }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score)

    return scored[0]?.template ?? null
  }

  private scoreTemplateForTraining(template: DivisionTemplate, state: CountryAIState, economy: AIContext['economies'][CountryId]): number {
    const canAffordResources = Object.keys(template.stats.resourceCost).every((resourceId) => economy.stockpiles[resourceId as keyof typeof economy.stockpiles] >= template.stats.resourceCost[resourceId as keyof typeof template.stats.resourceCost] + (resourceId === 'manpower' ? template.stats.manpower : 0))
    const canAffordEquipment = EQUIPMENT_CATEGORIES.every((category) => economy.equipmentStockpiles[category] >= template.stats.equipmentRequirements[category])

    if (!canAffordResources || !canAffordEquipment) {
      return 0
    }

    let score = 20
    score += template.stats.defense * (state.posture === 'defensive' || state.posture === 'recovering' ? 1.2 : 0.7)
    score += template.stats.attack * (state.posture === 'offensive' ? 1.1 : 0.7)
    score += template.stats.speed * (state.posture === 'offensive' || state.posture === 'balanced' ? 0.45 : 0.15)
    score -= template.stats.supplyUse * 2
    score -= template.stats.trainingDays * 0.6

    if (state.posture === 'desperate' && template.stats.trainingDays <= 7) {
      score += 20
    }

    return score
  }

  private chooseDeploymentProvince(countryId: CountryId, provinces: Province[], context: AIContext): Province | null {
    const threatened = this.getFriendlyBorderProvinces(countryId, context)
      .sort((left, right) => this.scoreThreat(countryId, right, context) - this.scoreThreat(countryId, left, context))[0]

    if (!threatened) {
      return provinces[0] ?? null
    }

    return [...provinces].sort((left, right) => distanceByProvince(left, threatened) - distanceByProvince(right, threatened))[0] ?? null
  }

  private reinforceActiveBattles(state: CountryAIState, context: AIContext, actions: AIActions, hourKey: number): void {
    const combats = [...context.combatSystem.combats.values()].filter((combat) => combat.attackerCountryId === state.countryId || combat.defenderCountryId === state.countryId)

    for (const combat of combats) {
      const province = context.provinces[combat.provinceId]
      const sides = context.combatSystem.getSidesForOverlay(combat, context.units)
      const friendly = combat.attackerCountryId === state.countryId ? sides.attacker : sides.defender
      const enemy = combat.attackerCountryId === state.countryId ? sides.defender : sides.attacker

      if (friendly.length === 0 || enemy.length === 0) {
        continue
      }

      const projection = context.combatSystem.getForecast(sides.attacker, sides.defender, province)
      const isLosing = projection.winner === (combat.attackerCountryId === state.countryId ? 'defender' : 'attacker') || projection.confidence < state.personality.reinforceConfidenceThreshold

      if (!isLosing) {
        continue
      }

      const reserve = this.findNearestReadyUnit(state.countryId, province, context, hourKey, (unit) => unit.provinceId !== province.id)
      if (reserve) {
        actions.issueMoveOrder(reserve.id, province.id)
        state.recentOrders[reserve.id] = hourKey
        this.log(state, `reinforcing ${province.displayName}`)
      }
    }
  }

  private assignBorderDefense(state: CountryAIState, context: AIContext, actions: AIActions, hourKey: number): void {
    const borders = this.getFriendlyBorderProvinces(state.countryId, context)
      .sort((left, right) => this.scoreThreat(state.countryId, right, context) - this.scoreThreat(state.countryId, left, context))

    for (const province of borders) {
      const friendlyUnits = getLivingUnitsInProvince(province, context.units).filter((unit) => unit.countryId === state.countryId)
      const desired = this.scoreThreat(state.countryId, province, context) > 80 ? 2 : 1

      if (friendlyUnits.length >= desired) {
        continue
      }

      const reserve = this.findNearestReadyUnit(state.countryId, province, context, hourKey, (unit) => {
        if (unit.provinceId === province.id) return false
        const currentProvince = context.provinces[unit.provinceId]
        const currentFriendlyUnits = getLivingUnitsInProvince(currentProvince, context.units).filter((entry) => entry.countryId === state.countryId)
        const currentIsBorder = currentProvince.neighbors.some((neighborId) => context.provinces[neighborId].controllerCountryId !== state.countryId)
        return !currentIsBorder || currentFriendlyUnits.length > 1
      })

      if (reserve && actions.issueMoveOrder(reserve.id, province.id)) {
        state.recentOrders[reserve.id] = hourKey
        this.log(state, `defending ${province.displayName}`)
      }
    }
  }

  private considerAttacks(state: CountryAIState, context: AIContext, actions: AIActions, hourKey: number): void {
    if (state.posture === 'recovering') {
      return
    }

    const enemyBorders = this.getEnemyBorderProvinces(state.countryId, context)
      .map((province) => ({ province, score: this.scoreOpportunity(state.countryId, province, context) }))
      .sort((left, right) => right.score - left.score)

    let attacksIssued = 0

    for (const { province, score } of enemyBorders) {
      if (attacksIssued >= state.personality.maxAttackOperations) {
        return
      }

      if (province.isContested) {
        continue
      }

      const attackers = this.getAdjacentAttackers(state.countryId, province, context, hourKey)
      if (attackers.length === 0) {
        continue
      }

      const defenders = getLivingUnitsInProvince(province, context.units).filter((unit) => unit.countryId !== state.countryId)
      const attackProbability = this.calculateAttackProbability(state, attackers, defenders, province, score, context)
      const roll = Math.random() * 100

      if (attackProbability < roll) {
        continue
      }

      const selectedAttackers = defenders.length === 0 ? attackers.slice(0, 1) : attackers.slice(0, Math.min(3, attackers.length))
      let moved = 0

      for (const unit of selectedAttackers) {
        if (actions.issueMoveOrder(unit.id, province.id)) {
          state.recentOrders[unit.id] = hourKey
          moved += 1
        }
      }

      if (moved > 0) {
        attacksIssued += 1
        this.log(state, `attacking ${province.displayName} (${Math.round(attackProbability)}%)`)
      }
    }
  }

  private calculateAttackProbability(state: CountryAIState, attackers: UnitState[], defenders: UnitState[], province: Province, opportunityScore: number, context: AIContext): number {
    const readiness = attackers.reduce((sum, unit) => sum + getUnitReadiness(unit), 0) / Math.max(1, attackers.length)
    const supplyPenalty = attackers.some((unit) => unit.isEncircled || unit.supplyHours < 36) ? 25 : 0
    const terrainPenalty = province.terrainType === 'mountain' ? 18 : province.terrainType === 'forest' || province.terrainType === 'urban' ? 10 : 0
    const aggressionBonus = state.personality.aggression * 18
    const riskBonus = state.personality.riskTolerance * 12
    const postureBonus = state.posture === 'offensive' ? 18 : state.posture === 'desperate' ? 12 : state.posture === 'balanced' ? 6 : -6
    const noise = (Math.random() - 0.5) * 18

    let forecastScore = defenders.length === 0 ? 70 : 20

    if (defenders.length > 0) {
      const projection = context.combatSystem.getForecast(attackers, defenders, province)
      if (projection.winner === 'attacker') {
        forecastScore = 48 + projection.confidence * 0.45
      } else if (projection.winner === 'stalemate') {
        forecastScore = 35 + projection.confidence * 0.15
      } else {
        forecastScore = 12 + (100 - projection.confidence) * 0.22
      }
    }

    return clamp(forecastScore + readiness * 24 + opportunityScore * 0.2 + aggressionBonus + riskBonus + postureBonus + noise - supplyPenalty - terrainPenalty, 0, 100)
  }

  private getAdjacentAttackers(countryId: CountryId, target: Province, context: AIContext, hourKey: number): UnitState[] {
    return target.neighbors
      .filter((provinceId) => context.provinces[provinceId].controllerCountryId === countryId && !context.provinces[provinceId].isContested)
      .flatMap((provinceId) => getLivingUnitsInProvince(context.provinces[provinceId], context.units))
      .filter((unit) => unit.countryId === countryId && this.isUnitReadyForOrders(unit, hourKey) && getUnitReadiness(unit) >= 0.72 && !unit.isEncircled)
      .sort((left, right) => getUnitReadiness(right) - getUnitReadiness(left))
  }

  private findNearestReadyUnit(countryId: CountryId, target: Province, context: AIContext, hourKey: number, predicate: (unit: UnitState) => boolean): UnitState | null {
    return this.getCountryUnits(countryId, context)
      .filter((unit) => this.isUnitReadyForOrders(unit, hourKey) && getUnitReadiness(unit) >= 0.45 && predicate(unit))
      .sort((left, right) => distanceByProvince(context.provinces[left.provinceId], target) - distanceByProvince(context.provinces[right.provinceId], target))[0] ?? null
  }

  private isUnitReadyForOrders(unit: UnitState, hourKey: number): boolean {
    const lastOrder = this.states.get(unit.countryId)?.recentOrders[unit.id] ?? -Infinity
    return unit.manpower > 0 && unit.status !== 'inCombat' && unit.status !== 'retreating' && unit.reinforcementDelayHours <= 0 && unit.route.length === 0 && hourKey - lastOrder >= ORDER_COOLDOWN_HOURS
  }

  private getBorderBalance(countryId: CountryId, context: AIContext): number {
    const friendlyBorders = this.getFriendlyBorderProvinces(countryId, context)
    let friendlyStrength = 0
    let enemyStrength = 0

    for (const province of friendlyBorders) {
      friendlyStrength += getLivingUnitsInProvince(province, context.units).filter((unit) => unit.countryId === countryId).reduce((sum, unit) => sum + getUnitPower(unit), 0)
      for (const neighborId of province.neighbors) {
        const neighbor = context.provinces[neighborId]
        if (neighbor.controllerCountryId !== countryId) {
          enemyStrength += getLivingUnitsInProvince(neighbor, context.units).filter((unit) => unit.countryId !== countryId).reduce((sum, unit) => sum + getUnitPower(unit), 0)
        }
      }
    }

    return friendlyStrength / Math.max(1, enemyStrength)
  }

  private scoreThreat(countryId: CountryId, province: Province, context: AIContext): number {
    const friendlyPower = getLivingUnitsInProvince(province, context.units).filter((unit) => unit.countryId === countryId).reduce((sum, unit) => sum + getUnitPower(unit), 0)
    let enemyPower = 0

    for (const neighborId of province.neighbors) {
      const neighbor = context.provinces[neighborId]
      if (neighbor.controllerCountryId !== countryId) {
        enemyPower += getLivingUnitsInProvince(neighbor, context.units).filter((unit) => unit.countryId !== countryId).reduce((sum, unit) => sum + getUnitPower(unit), 0)
      }
    }

    const value = province.resourceYields.industry * 2 + province.resourceYields.manpower + (province.buildings.barracks + province.buildings.militaryComplex) * 20
    return enemyPower * 1.4 - friendlyPower + value
  }

  private scoreOpportunity(countryId: CountryId, province: Province, context: AIContext): number {
    const defenders = getLivingUnitsInProvince(province, context.units).filter((unit) => unit.countryId !== countryId)
    const defenderPower = defenders.reduce((sum, unit) => sum + getUnitPower(unit), 0)
    const value = province.resourceYields.industry * 3 + province.resourceYields.manpower + province.resourceYields.metal * 1.4 + (province.buildings.barracks + province.buildings.militaryComplex) * 18
    const terrainPenalty = province.terrainType === 'mountain' ? 25 : province.terrainType === 'urban' || province.terrainType === 'forest' ? 12 : 0
    return value - defenderPower * 0.9 - terrainPenalty
  }

  private getFriendlyBorderProvinces(countryId: CountryId, context: AIContext): Province[] {
    return this.getControlledProvinces(countryId, context).filter((province) => province.neighbors.some((neighborId) => context.provinces[neighborId].controllerCountryId !== countryId))
  }

  private getEnemyBorderProvinces(countryId: CountryId, context: AIContext): Province[] {
    const provinceIds = new Set<number>()

    for (const province of this.getControlledProvinces(countryId, context)) {
      for (const neighborId of province.neighbors) {
        const neighbor = context.provinces[neighborId]
        if (neighbor.controllerCountryId !== countryId) {
          provinceIds.add(neighbor.id)
        }
      }
    }

    return [...provinceIds].map((provinceId) => context.provinces[provinceId])
  }

  private getControlledProvinces(countryId: CountryId, context: AIContext): Province[] {
    return context.provinces.filter((province) => province.controllerCountryId === countryId)
  }

  private getCountryUnits(countryId: CountryId, context: AIContext): UnitState[] {
    return context.units.filter((unit) => unit.countryId === countryId)
  }

  private ensureTemplates(state: CountryAIState, context: AIContext): void {
    if (state.templateIds.length > 0) {
      return
    }

    const templates = [
      this.createTemplate(state.countryId, 'line-infantry', 'AI Line Infantry', ['infantry', 'infantry', 'infantry']),
      this.createTemplate(state.countryId, 'at-defense', 'AI AT Defense', ['infantry', 'antiTank', 'infantry']),
      this.createTemplate(state.countryId, 'fire-support', 'AI Fire Support Brigade', ['infantry', 'infantry', 'artillery']),
      this.createTemplate(state.countryId, 'motorized-reserve', 'AI Motorized Reserve', ['motorized', 'motorized', 'artillery']),
      this.createTemplate(state.countryId, 'armored-group', 'AI Armored Group', ['tank', 'motorized', 'mechanized']),
    ]

    for (const template of templates) {
      context.templates.set(template.id, template)
      state.templateIds.push(template.id)
    }
  }

  private createTemplate(countryId: CountryId, key: string, name: string, battalions: BattalionType[]): DivisionTemplate {
    const nodes: DivisionNode[] = battalions.map((battalionType, index) => ({
      id: `ai-${countryId}-${key}-node-${index + 1}`,
      battalionType,
      x: 120 + index * 180,
      y: 110,
    }))

    return {
      id: `ai-${countryId}-${key}`,
      name,
      nodes,
      stats: calculateDivisionStats(nodes),
    }
  }

  private log(state: CountryAIState, message: string): void {
    state.decisionLog = [`Day ${state.lastDailyDay}: ${message}`, ...state.decisionLog].slice(0, 12)
  }
}

function canAffordConstruction(context: AIContext, countryId: CountryId, buildingType: BuildingType): boolean {
  const economy = context.economies[countryId]
  const cost = BUILDING_DEFINITIONS[buildingType].cost
  return Object.keys(cost).every((resourceId) => economy.stockpiles[resourceId as keyof typeof cost] >= cost[resourceId as keyof typeof cost])
}

function getLivingUnitsInProvince(province: Province, units: UnitState[]): UnitState[] {
  const result: UnitState[] = []
  for (const unitId of province.units) {
    const unit = units.find((u) => u.id === unitId)
    if (unit && unit.manpower > 0) {
      result.push(unit)
    }
  }
  return result
}

function getUnitReadiness(unit: UnitState): number {
  const manpowerRatio = unit.manpower / Math.max(1, unit.maxManpower)
  const equipmentRatio = unit.equipment / Math.max(1, unit.maxEquipment)
  const organizationRatio = unit.organization / Math.max(1, unit.maxOrganization)
  const supplyRatio = unit.supplyHours / Math.max(1, unit.maxSupplyHours)
  return clamp(manpowerRatio * 0.35 + equipmentRatio * 0.3 + organizationRatio * 0.25 + supplyRatio * 0.1, 0, 1)
}

function getUnitPower(unit: UnitState): number {
  return (unit.attack + unit.defense + unit.breakthrough * 0.7) * getUnitReadiness(unit)
}

function distanceByProvince(left: Province, right: Province): number {
  return left.centerWorld.distanceTo(right.centerWorld)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
