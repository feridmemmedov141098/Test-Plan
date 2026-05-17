import type { EconomySystem } from '../economy/EconomySystem'
import type { CountryId, Province, TerrainType } from '../province/provinceTypes'
import { createEmptyYields } from '../province/provinceMetadata'
import type { UnitState } from '../units/UnitTypes'
import {
  AI_GENERAL_CONFIGS,
  DOCTRINE_TRAIT_BONUSES,
  GENERAL_CREATION_COST,
  GENERAL_NAMES,
  TERRAIN_TRAIT_MAP,
  type BattlePlan,
  type General,
  type GeneralTrait,
} from './GeneralTypes'

export interface GeneralSystemContext {
  provinces: Province[]
  units: UnitState[]
  currentDay: number
  currentHour: number
}

export interface GeneralSystemActions {
  issueMoveOrder(unitId: string, targetProvinceId: number): boolean
}

export interface GeneralTrainingJob {
  countryId: CountryId
  daysRemaining: number
  name?: string
  skill?: number
  traits?: GeneralTrait[]
}

export class GeneralSystem {
  private readonly generals = new Map<string, General>()
  private readonly trainingQueue: GeneralTrainingJob[] = []
  private nextGeneralId = 1

  constructor() {}

  queueGeneralTraining(countryId: CountryId, economy: EconomySystem): boolean {
    const cost = { ...createEmptyYields(), ...GENERAL_CREATION_COST }
    if (!economy.canAfford(countryId, cost)) {
      return false
    }
    economy.spendResources(countryId, cost)
    this.trainingQueue.push({
      countryId,
      daysRemaining: 7,
      name: undefined,
      skill: undefined,
      traits: undefined,
    })
    return true
  }

  tickDaily(): void {
    for (const job of this.trainingQueue) {
      job.daysRemaining -= 1
    }

    const completed = this.trainingQueue.filter((job) => job.daysRemaining <= 0)
    for (const job of completed) {
      this.createGeneral(job.countryId, job.name, job.skill, job.traits)
    }

    // Remove completed jobs
    for (let i = this.trainingQueue.length - 1; i >= 0; i--) {
      if (this.trainingQueue[i].daysRemaining <= 0) {
        this.trainingQueue.splice(i, 1)
      }
    }
  }

  getTrainingQueueForCountry(countryId: CountryId): GeneralTrainingJob[] {
    return this.trainingQueue.filter((job) => job.countryId === countryId)
  }

  createGeneral(countryId: CountryId, name?: string, skill?: number, traits?: GeneralTrait[]): General {
    const id = `general-${countryId}-${this.nextGeneralId++}`
    const availableNames = GENERAL_NAMES[countryId]
    const randomName = name ?? availableNames[(this.nextGeneralId - 1) % availableNames.length]
    const randomSkill = skill ?? Math.floor(Math.random() * 3) + 2 // 2-4
    const randomTraits = traits ?? this.randomTraits()

    const general: General = {
      id,
      name: randomName,
      countryId,
      skill: randomSkill,
      traits: randomTraits,
      assignedUnitIds: [],
      frontlineProvinceIds: [],
      battlePlan: null,
      isPlayerAssigned: countryId === 'azerbaijan',
    }

    this.generals.set(id, general)
    return general
  }

  setupAIGenerals(countryId: CountryId): void {
    const configs = AI_GENERAL_CONFIGS[countryId]
    for (const config of configs) {
      this.createGeneral(countryId, config.name, config.skill, config.traits)
    }
  }

  private randomTraits(): GeneralTrait[] {
    // 50% chance of having no traits at all
    if (Math.random() < 0.5) {
      return []
    }

    const allTraits: GeneralTrait[] = [
      'infantry_specialist',
      'armored_expert',
      'artillery_specialist',
      'defensive_doctrine',
      'offensive_doctrine',
      'mountain_lion',
      'desert_fox',
      'urban_warfare_specialist',
      'jungle_ghost',
      'plains_rider',
      'organizer',
      'logistics_wizard',
    ]

    const shuffled = [...allTraits].sort(() => Math.random() - 0.5)
    const count = Math.random() < 0.1 ? 2 : 1 // 10% chance of 2 traits
    return shuffled.slice(0, count)
  }

  getGeneralsForCountry(countryId: CountryId): General[] {
    return [...this.generals.values()].filter((g) => g.countryId === countryId)
  }

  getGeneral(id: string): General | undefined {
    return this.generals.get(id)
  }

  assignUnits(generalId: string, unitIds: string[]): void {
    const general = this.generals.get(generalId)
    if (!general) return

    // Remove these units from other generals
    for (const other of this.generals.values()) {
      if (other.id !== generalId) {
        other.assignedUnitIds = other.assignedUnitIds.filter((id) => !unitIds.includes(id))
      }
    }

    general.assignedUnitIds = unitIds
  }

  setFrontline(generalId: string, provinceIds: number[]): void {
    const general = this.generals.get(generalId)
    if (!general) return
    general.frontlineProvinceIds = provinceIds
  }

  createBattlePlan(generalId: string, targetProvinceIds: number[], requiredUnits = 2): void {
    const general = this.generals.get(generalId)
    if (!general) return

    general.battlePlan = {
      targetProvinceIds,
      requiredUnits,
      currentPhase: 'holding',
      preparationProgress: 0,
      daysInPhase: 0,
    }
  }

  cancelBattlePlan(generalId: string): void {
    const general = this.generals.get(generalId)
    if (!general) return
    general.battlePlan = null
  }

  tick(context: GeneralSystemContext, actions: GeneralSystemActions): void {
    for (const general of this.generals.values()) {
      this.tickGeneral(general, context, actions)
    }
  }

  private tickGeneral(general: General, context: GeneralSystemContext, actions: GeneralSystemActions): void {
    if (general.frontlineProvinceIds.length === 0 || general.assignedUnitIds.length === 0) {
      return
    }

    const assignedUnits = context.units.filter((u) => general.assignedUnitIds.includes(u.id) && u.manpower > 0)
    if (assignedUnits.length === 0) return

    // Place units on frontline by terrain match
    this.placeUnitsOnFrontline(general, assignedUnits, context, actions)

    // Manage reserves
    this.manageReserves(general, assignedUnits, context, actions)

    // Progress battle plan
    if (general.battlePlan) {
      this.progressBattlePlan(general, assignedUnits, context, actions)
    }
  }

  private placeUnitsOnFrontline(general: General, assignedUnits: UnitState[], context: GeneralSystemContext, actions: GeneralSystemActions): void {
    const reserveRatio = 0.35
    const reserveCount = Math.ceil(general.assignedUnitIds.length * reserveRatio)
    const frontlineCount = general.assignedUnitIds.length - reserveCount
    const availableForFront = assignedUnits
      .filter((u) => u.status !== 'inCombat' && u.status !== 'retreating' && u.route.length === 0)
      .sort((a, b) => getUnitReadiness(b) - getUnitReadiness(a))
      .slice(0, Math.max(frontlineCount, general.frontlineProvinceIds.length))

    for (const provinceId of general.frontlineProvinceIds) {
      const province = context.provinces[provinceId]
      if (!province) continue

      const alreadyHere = availableForFront.filter((u) => u.provinceId === provinceId)
      if (alreadyHere.length > 0) continue

      const bestUnit = this.pickBestUnitForTerrain(availableForFront, province.terrainType, general.traits)
      if (bestUnit && bestUnit.provinceId !== provinceId) {
        if (actions.issueMoveOrder(bestUnit.id, provinceId)) {
          bestUnit.provinceId = provinceId // optimistic update
        }
      }
    }
  }

  private pickBestUnitForTerrain(units: UnitState[], terrain: TerrainType, traits: GeneralTrait[]): UnitState | null {
    if (units.length === 0) return null

    // Check if general has terrain specialist for this terrain
    const terrainTrait = traits.find((t) => TERRAIN_TRAIT_MAP[t]?.terrain === terrain)

    const scored = units.map((unit) => {
      let score = getUnitReadiness(unit) * 50
      score += unit.defense * 0.3
      score += unit.attack * 0.2

      if (terrainTrait) {
        // If general specializes in this terrain, boost units that fit
        const bonus = TERRAIN_TRAIT_MAP[terrainTrait]
        if (terrain === 'mountain' || terrain === 'forest' || terrain === 'urban') {
          // Prefer high-defense units (infantry) in difficult terrain
          score += unit.defense * (bonus?.defenseBonus ?? 0) * 100
        } else if (terrain === 'plains' || terrain === 'desert') {
          // Prefer fast units in open terrain
          score += unit.speed * (bonus?.speedBonus ?? 0) * 100
          score += unit.attack * (bonus?.attackBonus ?? 0) * 100
        }
      }

      return { unit, score }
    })

    scored.sort((a, b) => b.score - a.score)
    return scored[0]?.unit ?? null
  }

  private manageReserves(general: General, assignedUnits: UnitState[], context: GeneralSystemContext, actions: GeneralSystemActions): void {
    const frontlineIds = new Set(general.frontlineProvinceIds)
    const reserves = assignedUnits.filter((u) => !frontlineIds.has(u.provinceId) && u.status !== 'inCombat' && u.status !== 'retreating')

    // Fill gaps on frontline
    for (const provinceId of general.frontlineProvinceIds) {
      const province = context.provinces[provinceId]
      if (!province) continue

      const unitsHere = assignedUnits.filter((u) => u.provinceId === provinceId && u.manpower > 0)
      if (unitsHere.length === 0 && reserves.length > 0) {
        const fastest = reserves.sort((a, b) => b.speed - a.speed)[0]
        if (fastest && actions.issueMoveOrder(fastest.id, provinceId)) {
          fastest.provinceId = provinceId
          reserves.splice(reserves.indexOf(fastest), 1)
        }
      }
    }
  }

  private progressBattlePlan(general: General, assignedUnits: UnitState[], context: GeneralSystemContext, actions: GeneralSystemActions): void {
    const plan = general.battlePlan!
    const targetProvince = context.provinces[plan.targetProvinceIds[0]]
    if (!targetProvince) {
      general.battlePlan = null
      return
    }

    switch (plan.currentPhase) {
      case 'holding':
        this.tickHoldingPhase(general, plan, assignedUnits, context, actions)
        break
      case 'preparing':
        this.tickPreparingPhase(general, plan, assignedUnits, context, actions)
        break
      case 'attacking':
        this.tickAttackingPhase(general, plan, assignedUnits, context, actions)
        break
      case 'exploiting':
        this.tickExploitingPhase(general, plan, assignedUnits, context, actions)
        break
      case 'consolidating':
        this.tickConsolidatingPhase(general, plan, assignedUnits, context, actions)
        break
    }
  }

  private tickHoldingPhase(general: General, plan: BattlePlan, assignedUnits: UnitState[], context: GeneralSystemContext, _actions: GeneralSystemActions): void {
    // Ensure all frontline provinces have at least 1 unit
    for (const provinceId of general.frontlineProvinceIds) {
      const province = context.provinces[provinceId]
      if (!province) continue
      const unitsHere = assignedUnits.filter((u) => u.provinceId === provinceId && u.manpower > 0)
      if (unitsHere.length === 0) return // Not ready yet
    }

    // Transition to preparing if target is set and not already ours
    const targetProvince = context.provinces[plan.targetProvinceIds[0]]
    if (targetProvince && targetProvince.controllerCountryId !== general.countryId) {
      plan.currentPhase = 'preparing'
      plan.daysInPhase = 0
    }
  }

  private tickPreparingPhase(general: General, plan: BattlePlan, assignedUnits: UnitState[], context: GeneralSystemContext, actions: GeneralSystemActions): void {
    plan.daysInPhase += 1

    const targetProvince = context.provinces[plan.targetProvinceIds[0]]
    if (!targetProvince) {
      plan.currentPhase = 'holding'
      return
    }

    // Move units to staging provinces (adjacent to target)
    const stagingProvinces = targetProvince.neighbors.filter((id) => {
      const p = context.provinces[id]
      return p && p.controllerCountryId === general.countryId && !p.isContested
    })

    const readyAttackers = assignedUnits.filter(
      (u) => u.status !== 'inCombat' && u.status !== 'retreating' && getUnitReadiness(u) >= 0.6 && u.route.length === 0
    )

    // Count units near target
    const nearTarget = readyAttackers.filter((u) => {
      const dist = distanceByProvince(context.provinces[u.provinceId], targetProvince)
      return dist < 15 // adjacent-ish
    }).length

    if (nearTarget >= plan.requiredUnits) {
      plan.preparationProgress += 15
    }

    // Move more units to staging if needed
    const stagingNeeds = plan.requiredUnits - nearTarget
    if (stagingNeeds > 0) {
      const candidates = readyAttackers
        .filter((u) => !stagingProvinces.includes(u.provinceId))
        .sort((a, b) => getUnitReadiness(b) - getUnitReadiness(a))

      for (const unit of candidates.slice(0, stagingNeeds)) {
        const bestStaging = stagingProvinces.sort((a, b) => {
          return distanceByProvince(context.provinces[a], targetProvince) - distanceByProvince(context.provinces[b], targetProvince)
        })[0]
        if (bestStaging !== undefined) {
          actions.issueMoveOrder(unit.id, bestStaging)
        }
      }
    }

    if (plan.preparationProgress >= 100) {
      plan.currentPhase = 'attacking'
      plan.daysInPhase = 0
    }
  }

  private tickAttackingPhase(general: General, plan: BattlePlan, assignedUnits: UnitState[], context: GeneralSystemContext, actions: GeneralSystemActions): void {
    const targetProvince = context.provinces[plan.targetProvinceIds[0]]
    if (!targetProvince) {
      plan.currentPhase = 'consolidating'
      return
    }

    // Select attackers with readiness > 0.75
    const readyAttackers = assignedUnits
      .filter((u) => u.status !== 'inCombat' && u.status !== 'retreating' && getUnitReadiness(u) >= 0.75 && u.route.length === 0)
      .sort((a, b) => {
        // Prefer units matching terrain
        const aMatch = this.unitMatchesTerrain(a, targetProvince.terrainType)
        const bMatch = this.unitMatchesTerrain(b, targetProvince.terrainType)
        if (aMatch && !bMatch) return -1
        if (!aMatch && bMatch) return 1
        return getUnitReadiness(b) - getUnitReadiness(a)
      })
    const attackers = readyAttackers.slice(0, Math.min(4, readyAttackers.length))

    for (const unit of attackers) {
      if (unit.provinceId !== targetProvince.id) {
        actions.issueMoveOrder(unit.id, targetProvince.id)
      }
    }

    // Check if target captured (controller changed)
    if (targetProvince.controllerCountryId === general.countryId) {
      plan.currentPhase = 'exploiting'
      plan.daysInPhase = 0
    } else if (plan.daysInPhase > 3) {
      // If attack hasn't succeeded after 3 days of this phase, consolidate
      plan.currentPhase = 'consolidating'
    }

    plan.daysInPhase += 1
  }

  private tickExploitingPhase(general: General, plan: BattlePlan, assignedUnits: UnitState[], context: GeneralSystemContext, actions: GeneralSystemActions): void {
    const capturedProvince = context.provinces[plan.targetProvinceIds[0]]
    if (!capturedProvince || capturedProvince.controllerCountryId !== general.countryId) {
      plan.currentPhase = 'consolidating'
      return
    }

    // Evaluate adjacent enemy provinces
    const adjacentEnemies = capturedProvince.neighbors
      .map((id) => context.provinces[id])
      .filter((p) => p && p.controllerCountryId !== general.countryId && !p.isContested)

    if (adjacentEnemies.length === 0 || plan.daysInPhase >= 2) {
      plan.currentPhase = 'consolidating'
      return
    }

    // Continue with mobile reserves if available
    const mobileUnits = assignedUnits.filter(
      (u) => u.status !== 'inCombat' && u.status !== 'retreating' && u.speed >= 3 && getUnitReadiness(u) >= 0.6 && u.route.length === 0
    )

    if (mobileUnits.length > 0) {
      const nextTarget = adjacentEnemies[0]
      for (const unit of mobileUnits.slice(0, 2)) {
        actions.issueMoveOrder(unit.id, nextTarget.id)
      }
    }

    plan.daysInPhase += 1
  }

  private tickConsolidatingPhase(general: General, plan: BattlePlan, assignedUnits: UnitState[], context: GeneralSystemContext, actions: GeneralSystemActions): void {
    plan.daysInPhase += 1

    // Move damaged units to rear
    const damaged = assignedUnits.filter((u) => getUnitReadiness(u) < 0.5 && u.status !== 'inCombat')
    for (const unit of damaged) {
      const rearProvince = this.findRearProvince(general, context)
      if (rearProvince && unit.provinceId !== rearProvince) {
        actions.issueMoveOrder(unit.id, rearProvince)
      }
    }

    if (plan.daysInPhase >= 2) {
      plan.currentPhase = 'holding'
      plan.preparationProgress = 0
      plan.daysInPhase = 0
    }
  }

  private unitMatchesTerrain(unit: UnitState, terrain: TerrainType): boolean {
    if (terrain === 'mountain' || terrain === 'forest' || terrain === 'urban') {
      return unit.defense >= unit.attack
    }
    return unit.speed >= 3
  }

  private findRearProvince(general: General, context: GeneralSystemContext): number | null {
    // Find a safe province 2+ provinces away from frontline
    const frontlineSet = new Set(general.frontlineProvinceIds)
    for (const province of context.provinces) {
      if (province.controllerCountryId !== general.countryId) continue
      if (frontlineSet.has(province.id)) continue
      if (province.isContested) continue
      const isNearFront = province.neighbors.some((n) => frontlineSet.has(n))
      if (!isNearFront) return province.id
    }
    return null
  }

  getTerrainBonuses(general: General, terrain: TerrainType): { attackMult: number; defenseMult: number; speedMult: number } {
    let attackMult = 1.0
    let defenseMult = 1.0
    let speedMult = 1.0

    for (const trait of general.traits) {
      const terrainBonus = TERRAIN_TRAIT_MAP[trait]
      if (terrainBonus && terrainBonus.terrain === terrain) {
        attackMult += terrainBonus.attackBonus
        defenseMult += terrainBonus.defenseBonus
        speedMult += terrainBonus.speedBonus
      }
    }

    for (const trait of general.traits) {
      const doctrine = DOCTRINE_TRAIT_BONUSES[trait]
      if (doctrine) {
        attackMult += doctrine.attackBonus
        defenseMult += doctrine.defenseBonus
      }
    }

    return { attackMult, defenseMult, speedMult }
  }

  dismissGeneral(generalId: string): void {
    this.generals.delete(generalId)
  }
}

function getUnitReadiness(unit: UnitState): number {
  const manpowerRatio = unit.manpower / Math.max(1, unit.maxManpower)
  const equipmentRatio = unit.equipment / Math.max(1, unit.maxEquipment)
  const organizationRatio = unit.organization / Math.max(1, unit.maxOrganization)
  const supplyRatio = unit.supplyHours / Math.max(1, unit.maxSupplyHours)
  return clamp(manpowerRatio * 0.35 + equipmentRatio * 0.3 + organizationRatio * 0.25 + supplyRatio * 0.1, 0, 1)
}

function distanceByProvince(left: Province, right: Province): number {
  return left.centerWorld.distanceTo(right.centerWorld)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
