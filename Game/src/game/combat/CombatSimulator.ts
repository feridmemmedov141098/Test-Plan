import type { TerrainType } from '../province/provinceTypes'
import type { Province } from '../province/provinceTypes'
import { BATTALION_DEFINITIONS } from '../units/DivisionDesignerTypes'
import { recalculateUnitFromBattalions, type UnitBattalionState, type UnitState } from '../units/UnitTypes'

export type BattleWinner = 'attacker' | 'defender' | 'stalemate'

export interface BattleSideProjection {
  unitCount: number
  manpower: number
  maxManpower: number
  equipment: number
  maxEquipment: number
  organization: number
  maxOrganization: number
  softAttack: number
  hardAttack: number
  defense: number
  breakthrough: number
  armor: number
  piercing: number
  hardness: number
  maneuverability: number
  logisticsLoad: number
  logisticsPenalty: number
  fortificationLevel: number
  supplyRatio: number
  encircledUnits: number
  surrenderedBattalions: number
  destroyedBattalions: number
  score: number
  projectedManpowerLoss: number
  projectedEquipmentLoss: number
}

export interface BattleProjection {
  winner: BattleWinner
  confidence: number
  estimatedHours: number
  terrain: TerrainType
  attacker: BattleSideProjection
  defender: BattleSideProjection
  reasons: string[]
  messages: string[]
}

interface TerrainCombatProfile {
  armorExposure: number
  logisticsCapacity: number
  reliabilityHazard: number
  defenderOrgBonus: number
}

interface SideFirepower {
  softAttack: number
  hardAttack: number
  piercing: number
  maneuverability: number
  speed: number
  logisticsPenalty: number
}

const MAX_FORECAST_HOURS = 1680
const DAMAGE_PACE = 0.18
const ATTACKER_ASSAULT_EFFICIENCY = 0.82
const MAX_FORTIFICATION_DAYS = 7
const MAX_FORTIFICATION_DEFENSE_BONUS = 0.6
const MAX_FORTIFICATION_FIRE_BONUS = 0.15
const VARIANCE_SEQUENCE = [0.98, 1.02, 1, 1.04, 0.96]
const TERRAIN_COMBAT: Record<TerrainType, TerrainCombatProfile> = {
  urban: { armorExposure: 0.55, logisticsCapacity: 8, reliabilityHazard: 1.22, defenderOrgBonus: 1.14 },
  suburban: { armorExposure: 0.75, logisticsCapacity: 10, reliabilityHazard: 1.08, defenderOrgBonus: 1.06 },
  plains: { armorExposure: 1.05, logisticsCapacity: 14, reliabilityHazard: 0.96, defenderOrgBonus: 0.98 },
  fields: { armorExposure: 1, logisticsCapacity: 12, reliabilityHazard: 1, defenderOrgBonus: 1 },
  forest: { armorExposure: 0.65, logisticsCapacity: 8, reliabilityHazard: 1.16, defenderOrgBonus: 1.1 },
  hills: { armorExposure: 0.78, logisticsCapacity: 8, reliabilityHazard: 1.1, defenderOrgBonus: 1.08 },
  mountain: { armorExposure: 0.45, logisticsCapacity: 6, reliabilityHazard: 1.28, defenderOrgBonus: 1.18 },
  desert: { armorExposure: 0.95, logisticsCapacity: 7, reliabilityHazard: 1.2, defenderOrgBonus: 0.95 },
}

export function forecastBattle(attackers: UnitState[], defenders: UnitState[], province: Province): BattleProjection {
  const attackerClones = attackers.map(cloneUnitForSimulation)
  const defenderClones = defenders.map(cloneUnitForSimulation)
  const initialAttackers = snapshotSide(attackers, province, 'attacker')
  const initialDefenders = snapshotSide(defenders, province, 'defender')
  let elapsedHours = 0

  while (elapsedHours < MAX_FORECAST_HOURS && !isSideBroken(attackerClones) && !isSideBroken(defenderClones)) {
    simulateBattleHour(attackerClones, defenderClones, province, elapsedHours)
    elapsedHours += 1
  }

  const projection = buildProjection(attackerClones, defenderClones, province, elapsedHours, initialAttackers, initialDefenders)

  if (projection.winner === 'stalemate') {
    projection.estimatedHours = MAX_FORECAST_HOURS
  }

  return projection
}

export function resolveCombatHour(attackers: UnitState[], defenders: UnitState[], province: Province, elapsedHours: number): BattleProjection {
  const initialAttackers = snapshotSide(attackers, province, 'attacker')
  const initialDefenders = snapshotSide(defenders, province, 'defender')
  simulateBattleHour(attackers, defenders, province, elapsedHours)
  return buildProjection(attackers, defenders, province, elapsedHours + 1, initialAttackers, initialDefenders)
}

export function getBattleProjection(attackers: UnitState[], defenders: UnitState[], province: Province): BattleProjection {
  return forecastBattle(attackers, defenders, province)
}

export function isSideBroken(units: UnitState[]): boolean {
  if (units.length === 0) {
    return true
  }

  const manpower = units.reduce((sum, unit) => sum + unit.manpower, 0)
  const maxManpower = units.reduce((sum, unit) => sum + unit.maxManpower, 0)
  const equipment = units.reduce((sum, unit) => sum + unit.equipment, 0)
  const maxEquipment = units.reduce((sum, unit) => sum + unit.maxEquipment, 0)

  return units.every((unit) => unit.organization <= 0) || manpower <= maxManpower * 0.32 || equipment <= maxEquipment * 0.28
}

function simulateBattleHour(attackers: UnitState[], defenders: UnitState[], province: Province, elapsedHours: number): void {
  applyFire(attackers, defenders, province, 'attacker', elapsedHours)
  applyFire(defenders, attackers, province, 'defender', elapsedHours + 2)
  attackers.forEach(syncUnitFromBattalions)
  defenders.forEach(syncUnitFromBattalions)
}

function applyFire(attackers: UnitState[], defenders: UnitState[], province: Province, stance: 'attacker' | 'defender', varianceOffset: number): void {
  const liveDefenders = defenders.filter((unit) => unit.manpower > 0 && unit.equipment > 0)

  if (attackers.length === 0 || liveDefenders.length === 0) {
    return
  }

  const terrain = TERRAIN_COMBAT[province.terrainType]
  const firepower = calculateSideFirepower(attackers, province, stance)
  const defenderSummary = snapshotSide(liveDefenders, province, stance === 'attacker' ? 'defender' : 'attacker')
  const initiativeDelta = firepower.maneuverability - defenderSummary.maneuverability
  const initiativeModifier = clamp(1 + initiativeDelta / 220, 0.88, 1.14)
  const variance = VARIANCE_SEQUENCE[varianceOffset % VARIANCE_SEQUENCE.length]
  const targetEntries = liveDefenders.flatMap((unit) => unit.battalions
    .filter((battalion) => battalion.status === 'active' || battalion.status === 'shattered')
    .map((battalion) => ({ unit, battalion })))
  const totalTargetWeight = targetEntries.reduce((sum, entry) => sum + getTargetWeight(entry.battalion), 0)

  for (const { unit, battalion } of targetEntries) {
    if (battalion.manpower <= 0 || battalion.equipment <= 0) {
      continue
    }

    const definition = BATTALION_DEFINITIONS[battalion.battalionType]
    const targetHardness = definition.hardness
    const targetWeight = getTargetWeight(battalion) / Math.max(1, totalTargetWeight)
    const effectiveArmor = definition.armor * terrain.armorExposure * getBattalionReadiness(battalion)
    const piercingRatio = firepower.piercing / Math.max(1, effectiveArmor)
    const armorModifier = effectiveArmor <= 0 ? 1 : piercingRatio < 1 ? clamp(0.46 + piercingRatio * 0.36, 0.46, 0.82) : clamp(1 + (piercingRatio - 1) * 0.08, 1, 1.18)
    const softComponent = firepower.softAttack * (1 - targetHardness)
    const hardComponent = firepower.hardAttack * targetHardness * armorModifier
    const incoming = (softComponent + hardComponent) * targetWeight * initiativeModifier * variance
    const terrainDefense = definition.terrainModifiers[province.terrainType].defense
    const protectionBase = stance === 'attacker' ? definition.defense : definition.breakthrough
    const defenderStanceModifier = stance === 'attacker' ? terrain.defenderOrgBonus : 1
    const fortification = stance === 'attacker' ? getUnitFortification(unit, province).defense : 1
    const protection = protectionBase * terrainDefense * getBattalionReadiness(battalion) * defenderStanceModifier * defenderSummary.logisticsPenalty * fortification
    const protectedDamage = Math.min(incoming, protection) * 0.3
    const unprotectedDamage = Math.max(0, incoming - protection) * 0.65
    const damage = (protectedDamage + unprotectedDamage) * DAMAGE_PACE
    const reliability = definition.reliability * unit.reliability
    const breakdown = (1.05 - reliability) * terrain.reliabilityHazard
    const supplyVulnerability = getSupplyVulnerability(unit)
    const orgLoss = damage * 0.40 * supplyVulnerability
    const manpowerLoss = damage * (0.72 + (1 - targetHardness) * 0.26) * (stance === 'attacker' ? 1 : 0.92) * supplyVulnerability
    const equipmentLoss = damage * (0.18 + targetHardness * 0.2 + breakdown * 0.18) * supplyVulnerability

    battalion.organization = Math.max(0, battalion.organization - orgLoss)
    battalion.manpower = Math.max(0, battalion.manpower - manpowerLoss)
    battalion.equipment = Math.max(0, battalion.equipment - equipmentLoss)
    updateBattalionOutcome(unit, battalion, province)
  }

  liveDefenders.forEach(recalculateUnitFromBattalions)
}

function calculateSideFirepower(units: UnitState[], province: Province, stance: 'attacker' | 'defender'): SideFirepower {
  const terrain = TERRAIN_COMBAT[province.terrainType]
  const logisticsLoad = units.reduce((sum, unit) => sum + unit.supplyUse + unit.fuelUse, 0)
  const overload = Math.max(0, logisticsLoad - terrain.logisticsCapacity) / Math.max(1, terrain.logisticsCapacity)
  const logisticsPenalty = clamp(1 - overload * 0.22, 0.55, 1)
  let softAttack = 0
  let hardAttack = 0
  let piercingWeight = 0
  let weightedPiercing = 0
  let weightedManeuver = 0
  let weightedSpeed = 0
  let weight = 0

  for (const unit of units) {
    for (const battalion of unit.battalions) {
      if (battalion.status === 'destroyed' || battalion.status === 'surrendered') {
        continue
      }

      const definition = BATTALION_DEFINITIONS[battalion.battalionType]
      const readiness = getBattalionReadiness(battalion)
      const terrainAttack = definition.terrainModifiers[province.terrainType].attack
      const terrainSpeed = definition.terrainModifiers[province.terrainType].speed
      const fortification = stance === 'defender' ? getUnitFortification(unit, province).fire : 1
      const stanceModifier = stance === 'attacker' ? ATTACKER_ASSAULT_EFFICIENCY : terrain.defenderOrgBonus * fortification
      const supplyModifier = getSupplyCombatModifier(unit)
      const battalionSoft = definition.softAttack * readiness * terrainAttack * logisticsPenalty * stanceModifier * supplyModifier
      const battalionHard = definition.hardAttack * readiness * terrainAttack * logisticsPenalty * stanceModifier * supplyModifier
      const battalionWeight = battalionSoft + battalionHard + 1

      softAttack += battalionSoft
      hardAttack += battalionHard
      piercingWeight += battalionWeight
      weightedPiercing += definition.piercing * readiness * battalionWeight
      weightedManeuver += definition.maneuverability * readiness * battalionWeight
      weightedSpeed += definition.speed * terrainSpeed * readiness * battalionWeight
      weight += battalionWeight
    }
  }

  return {
    softAttack,
    hardAttack,
    piercing: weightedPiercing / Math.max(1, piercingWeight),
    maneuverability: weightedManeuver / Math.max(1, weight),
    speed: weightedSpeed / Math.max(1, weight),
    logisticsPenalty,
  }
}

function buildProjection(
  attackers: UnitState[],
  defenders: UnitState[],
  province: Province,
  elapsedHours: number,
  initialAttackers: BattleSideProjection,
  initialDefenders: BattleSideProjection,
): BattleProjection {
  const attacker = snapshotSide(attackers, province, 'attacker')
  const defender = snapshotSide(defenders, province, 'defender')
  const attackerBroken = isSideBroken(attackers)
  const defenderBroken = isSideBroken(defenders)
  const winner: BattleWinner = defenderBroken && !attackerBroken ? 'attacker' : attackerBroken && !defenderBroken ? 'defender' : elapsedHours >= MAX_FORECAST_HOURS ? 'stalemate' : attacker.score >= defender.score ? 'attacker' : 'defender'
  const scoreGap = Math.abs(attacker.score - defender.score) / Math.max(1, Math.max(attacker.score, defender.score))
  const confidence = winner === 'stalemate' ? 50 : Math.round(clamp(56 + scoreGap * 42, 56, 96))

  attacker.projectedManpowerLoss = Math.max(0, initialAttackers.manpower - attacker.manpower)
  attacker.projectedEquipmentLoss = Math.max(0, initialAttackers.equipment - attacker.equipment)
  defender.projectedManpowerLoss = Math.max(0, initialDefenders.manpower - defender.manpower)
  defender.projectedEquipmentLoss = Math.max(0, initialDefenders.equipment - defender.equipment)

  return {
    winner,
    confidence,
    estimatedHours: elapsedHours,
    terrain: province.terrainType,
    attacker,
    defender,
    reasons: buildReasons(attacker, defender, province),
    messages: buildBattleMessages(attacker, defender, province, winner),
  }
}

function snapshotSide(units: UnitState[], province: Province, stance: 'attacker' | 'defender'): BattleSideProjection {
  const terrain = TERRAIN_COMBAT[province.terrainType]
  const manpower = units.reduce((sum, unit) => sum + unit.manpower, 0)
  const maxManpower = units.reduce((sum, unit) => sum + unit.maxManpower, 0)
  const equipment = units.reduce((sum, unit) => sum + unit.equipment, 0)
  const maxEquipment = units.reduce((sum, unit) => sum + unit.maxEquipment, 0)
  const organization = units.reduce((sum, unit) => sum + unit.organization, 0)
  const maxOrganization = units.reduce((sum, unit) => sum + unit.maxOrganization, 0)
  const logisticsLoad = units.reduce((sum, unit) => sum + unit.supplyUse + unit.fuelUse, 0)
  const supplyRatio = units.reduce((sum, unit) => sum + unit.supplyHours / Math.max(1, unit.maxSupplyHours), 0) / Math.max(1, units.length)
  const encircledUnits = units.filter((unit) => unit.isEncircled).length
  const surrenderedBattalions = units.reduce((sum, unit) => sum + unit.battalions.filter((battalion) => battalion.status === 'surrendered').length, 0)
  const destroyedBattalions = units.reduce((sum, unit) => sum + unit.battalions.filter((battalion) => battalion.status === 'destroyed').length, 0)
  const overload = Math.max(0, logisticsLoad - terrain.logisticsCapacity) / Math.max(1, terrain.logisticsCapacity)
  const logisticsPenalty = clamp(1 - overload * 0.22, 0.55, 1)
  const firepower = calculateSideFirepower(units, province, stance)
  const fortificationLevel = stance === 'defender' ? averageFortification(units, province) : 0
  const fortificationDefenseModifier = 1 + fortificationLevel * MAX_FORTIFICATION_DEFENSE_BONUS
  const readiness = (manpower / Math.max(1, maxManpower)) * (equipment / Math.max(1, maxEquipment)) * (organization / Math.max(1, maxOrganization))
  const armor = weightedUnitStat(units, 'armor') * terrain.armorExposure
  const piercing = firepower.piercing
  const hardness = weightedUnitStat(units, 'hardness')
  const defense = units.reduce((sum, unit) => sum + unit.defense * unit.terrainProfile[province.terrainType].defense * logisticsPenalty * getSupplyCombatModifier(unit) * (stance === 'defender' ? getUnitFortification(unit, province).defense : 1), 0)
  const breakthrough = units.reduce((sum, unit) => sum + unit.breakthrough * unit.terrainProfile[province.terrainType].defense * logisticsPenalty * getSupplyCombatModifier(unit), 0)
  const maneuverability = weightedUnitStat(units, 'maneuverability')
  const score = Math.max(1, (firepower.softAttack * (1 - hardness) + firepower.hardAttack * hardness + defense * 0.5 + breakthrough * 0.22 + armor * 0.28 + piercing * 0.22 + maneuverability * 0.08) * clamp(readiness, 0.08, 1.15) * logisticsPenalty * (stance === 'defender' ? fortificationDefenseModifier : ATTACKER_ASSAULT_EFFICIENCY))

  return {
    unitCount: units.length,
    manpower,
    maxManpower,
    equipment,
    maxEquipment,
    organization,
    maxOrganization,
    softAttack: firepower.softAttack,
    hardAttack: firepower.hardAttack,
    defense,
    breakthrough,
    armor,
    piercing,
    hardness,
    maneuverability,
    logisticsLoad,
    logisticsPenalty,
    fortificationLevel,
    supplyRatio,
    encircledUnits,
    surrenderedBattalions,
    destroyedBattalions,
    score,
    projectedManpowerLoss: 0,
    projectedEquipmentLoss: 0,
  }
}

function buildReasons(attacker: BattleSideProjection, defender: BattleSideProjection, province: Province): string[] {
  const reasons: string[] = []

  if (attacker.piercing < defender.armor * 0.9) {
    reasons.push('Attacker cannot reliably pierce defender armor')
  } else if (attacker.piercing > defender.armor * 1.15 && defender.armor > 1) {
    reasons.push('Attacker piercing beats defender armor')
  }

  if (defender.piercing < attacker.armor * 0.9 && attacker.armor > 1) {
    reasons.push('Defender struggles to pierce attacker armor')
  }

  if (province.terrainType === 'urban') {
    reasons.push('Urban terrain sharply reduces armor exposure')
  } else if (province.terrainType === 'plains' || province.terrainType === 'fields') {
    reasons.push('Open terrain favors armor and maneuver')
  } else if (province.terrainType === 'mountain' || province.terrainType === 'forest') {
    reasons.push('Rough terrain limits vehicles and favors defense')
  }

  if (attacker.maneuverability > defender.maneuverability + 12) {
    reasons.push('Attacker has maneuver advantage')
  } else if (defender.maneuverability > attacker.maneuverability + 12) {
    reasons.push('Defender has maneuver advantage')
  }

  if (attacker.logisticsPenalty < 0.92) {
    reasons.push('Attacker has heavy supply and fuel burden')
  }

  if (defender.logisticsPenalty < 0.92) {
    reasons.push('Defender has heavy supply and fuel burden')
  }

  if (defender.fortificationLevel >= 0.35) {
    reasons.push('Defender is fortified in prepared positions')
  }

  if (attacker.supplyRatio < 0.35 || defender.supplyRatio < 0.35) {
    reasons.push('Low supply is reducing combat effectiveness')
  }

  if (attacker.hardAttack < defender.hardness * 18) {
    reasons.push('Attacker lacks hard attack against armored targets')
  }

  return reasons.slice(0, 4)
}

function buildBattleMessages(attacker: BattleSideProjection, defender: BattleSideProjection, province: Province, winner: BattleWinner): string[] {
  const messages: string[] = []
  const attackerOrgRatio = attacker.organization / Math.max(1, attacker.maxOrganization)
  const defenderOrgRatio = defender.organization / Math.max(1, defender.maxOrganization)
  const attackerEquipmentRatio = attacker.equipment / Math.max(1, attacker.maxEquipment)
  const defenderEquipmentRatio = defender.equipment / Math.max(1, defender.maxEquipment)

  if (winner === 'attacker') {
    messages.push('Attacking formations are creating a breach in the defensive line.')
  } else if (winner === 'defender') {
    messages.push('Defenders are holding their positions and absorbing the assault.')
  } else {
    messages.push('Neither side has achieved a decisive local advantage.')
  }

  if (attacker.piercing < defender.armor * 0.9) {
    messages.push('Anti-armor fire is failing to penetrate the defender armor screen.')
  } else if (attacker.piercing > defender.armor * 1.15 && defender.armor > 1) {
    messages.push('Attacker anti-armor weapons are defeating enemy armor at effective ranges.')
  }

  if (defender.piercing < attacker.armor * 0.9 && attacker.armor > 1) {
    messages.push('Defender anti-tank assets are struggling against the attacking armor.')
  } else if (defender.piercing > attacker.armor * 1.1 && attacker.armor > 1) {
    messages.push('Defensive anti-tank teams are threatening the attacking armored elements.')
  }

  if (province.terrainType === 'urban') {
    messages.push('Urban terrain is breaking lines of sight and exposing armor to close assaults.')
  } else if (province.terrainType === 'plains' || province.terrainType === 'fields') {
    messages.push('Open ground is increasing the value of speed, armor, and long-range fire.')
  } else if (province.terrainType === 'forest') {
    messages.push('Forest cover is reducing vehicle effectiveness and favoring infantry defense.')
  } else if (province.terrainType === 'mountain' || province.terrainType === 'hills') {
    messages.push('Elevation and narrow approaches are slowing the assault and strengthening defense.')
  } else if (province.terrainType === 'desert') {
    messages.push('Desert conditions are stressing vehicles and supply movement.')
  }

  if (defender.fortificationLevel > 0.7) {
    messages.push('Prepared defensive positions are significantly reducing incoming damage.')
  } else if (defender.fortificationLevel > 0.25) {
    messages.push('Defenders have partial fieldworks, improving their staying power.')
  }

  if (attacker.maneuverability > defender.maneuverability + 12) {
    messages.push('Attacker maneuver elements are finding better angles of attack.')
  } else if (defender.maneuverability > attacker.maneuverability + 12) {
    messages.push('Defenders are repositioning faster than the assault can exploit gaps.')
  }

  if (attacker.logisticsPenalty < 0.9) {
    messages.push('Attacker supply load is slowing coordination and reducing combat output.')
  }

  if (defender.logisticsPenalty < 0.9) {
    messages.push('Defender logistics congestion is weakening sustained resistance.')
  }

  if (attackerOrgRatio < 0.35) {
    messages.push('Attacker organization is close to collapse under defensive fire.')
  }

  if (defenderOrgRatio < 0.35) {
    messages.push('Defender organization is deteriorating and a retreat is becoming likely.')
  }

  if (attackerEquipmentRatio < 0.45) {
    messages.push('Attacker equipment losses are reducing combat effectiveness.')
  }

  if (defenderEquipmentRatio < 0.45) {
    messages.push('Defender equipment losses are limiting their ability to hold ground.')
  }

  if (attacker.encircledUnits > 0) {
    messages.push('Attacking units are cut off from friendly supply routes.')
  }

  if (defender.encircledUnits > 0) {
    messages.push('Defending units are encircled and supply trucks cannot reach them.')
  }

  if (attacker.surrenderedBattalions + defender.surrenderedBattalions > 0) {
    messages.push('Exhausted battalions are surrendering under pressure.')
  }

  if (attacker.destroyedBattalions + defender.destroyedBattalions > 0) {
    messages.push('Some battalions have been destroyed and removed from the order of battle.')
  }

  return [...new Set(messages)].slice(0, 8)
}

function cloneUnitForSimulation(unit: UnitState): UnitState {
  return {
    ...unit,
    route: [...unit.route],
    routeProvinceIds: [...unit.routeProvinceIds],
    templateNodes: unit.templateNodes.map((node) => ({ ...node })),
    stats: { ...unit.stats, resourceCost: { ...unit.stats.resourceCost }, terrainProfile: unit.stats.terrainProfile },
    battalions: unit.battalions.map((battalion) => ({ ...battalion })),
  }
}

function getUnitFortification(unit: UnitState, province: Province): { defense: number; fire: number; level: number } {
  const level = unit.fortifiedProvinceId === province.id ? clamp(unit.fortificationDays / MAX_FORTIFICATION_DAYS, 0, 1) : 0

  return {
    level,
    defense: 1 + level * MAX_FORTIFICATION_DEFENSE_BONUS,
    fire: 1 + level * MAX_FORTIFICATION_FIRE_BONUS,
  }
}

function averageFortification(units: UnitState[], province: Province): number {
  const weight = units.reduce((sum, unit) => sum + unit.maxManpower + unit.maxEquipment, 0)

  return units.reduce((sum, unit) => sum + getUnitFortification(unit, province).level * (unit.maxManpower + unit.maxEquipment), 0) / Math.max(1, weight)
}

function syncUnitFromBattalions(unit: UnitState): void {
  recalculateUnitFromBattalions(unit)
}

function getTargetWeight(battalion: UnitBattalionState): number {
  const definition = BATTALION_DEFINITIONS[battalion.battalionType]
  return (0.75 + definition.hardness) * getBattalionReadiness(battalion) * Math.max(0.2, battalion.manpower / Math.max(1, battalion.maxManpower))
}

function getBattalionReadiness(battalion: UnitBattalionState): number {
  if (battalion.status === 'destroyed' || battalion.status === 'surrendered') {
    return 0
  }

  const manpowerRatio = battalion.manpower / Math.max(1, battalion.maxManpower)
  const equipmentRatio = battalion.equipment / Math.max(1, battalion.maxEquipment)
  const organizationRatio = battalion.organization / Math.max(1, battalion.maxOrganization)

  const statusModifier = battalion.status === 'shattered' ? 0.45 : 1

  return clamp((manpowerRatio * 0.42 + equipmentRatio * 0.34 + organizationRatio * 0.24) * statusModifier, 0.03, 1)
}

function updateBattalionOutcome(unit: UnitState, battalion: UnitBattalionState, province: Province): void {
  if (battalion.status === 'destroyed' || battalion.status === 'surrendered') {
    return
  }

  const manpowerRatio = battalion.manpower / Math.max(1, battalion.maxManpower)
  const equipmentRatio = battalion.equipment / Math.max(1, battalion.maxEquipment)
  const organizationRatio = battalion.organization / Math.max(1, battalion.maxOrganization)
  const noRetreat = unit.isEncircled || unit.encircledHours >= 12 || unit.hoursOutOfSupply >= 48

  if (manpowerRatio <= 0.05 || equipmentRatio <= 0.03) {
    battalion.status = 'destroyed'
    pushCombatEvent(unit, `${battalion.name} destroyed in ${province.displayName}`)
    return
  }

  if (noRetreat && organizationRatio <= 0.10 && (manpowerRatio <= 0.28 || equipmentRatio <= 0.25)) {
    battalion.status = 'surrendered'
    battalion.organization = 0
    pushCombatEvent(unit, `${battalion.name} surrendered while encircled`)
    return
  }

  if (organizationRatio <= 0.14 || manpowerRatio <= 0.16 || equipmentRatio <= 0.14) {
    battalion.status = 'shattered'
    pushCombatEvent(unit, `${battalion.name} shattered by combat losses`)
  }
}

function getSupplyCombatModifier(unit: UnitState): number {
  const supplyRatio = unit.supplyHours / Math.max(1, unit.maxSupplyHours)
  const shortagePenalty = unit.hoursOutOfSupply >= 72 ? 0.45 : unit.hoursOutOfSupply >= 48 ? 0.6 : unit.hoursOutOfSupply >= 24 ? 0.75 : unit.hoursOutOfSupply >= 12 ? 0.88 : 1
  const encirclementPenalty = unit.isEncircled ? 0.9 : 1

  return clamp((0.62 + supplyRatio * 0.38) * shortagePenalty * encirclementPenalty, 0.35, 1)
}

function getSupplyVulnerability(unit: UnitState): number {
  return clamp(1 + Math.max(0, unit.hoursOutOfSupply - 12) / 120 + (unit.isEncircled ? 0.12 : 0), 1, 1.55)
}

function pushCombatEvent(unit: UnitState, event: string): void {
  if (unit.recentCombatEvents[0] === event) {
    return
  }

  unit.recentCombatEvents = [event, ...unit.recentCombatEvents].slice(0, 8)
}

function weightedUnitStat(units: UnitState[], key: 'armor' | 'hardness' | 'maneuverability'): number {
  const weight = units.reduce((sum, unit) => sum + unit.maxEquipment + unit.maxManpower * 0.08, 0)

  return units.reduce((sum, unit) => sum + unit[key] * (unit.maxEquipment + unit.maxManpower * 0.08), 0) / Math.max(1, weight)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
