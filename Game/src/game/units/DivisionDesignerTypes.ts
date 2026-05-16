import type { CountryId, ResourceYields } from '../province/provinceTypes'

export type BattalionType = 'infantry' | 'motorized' | 'mechanized' | 'tank' | 'antiTank' | 'artillery'

export interface BattalionDefinition {
  id: BattalionType
  name: string
  role: string
  manpower: number
  equipment: number
  resourceCost: ResourceYields
  trainingDays: number
  softAttack: number
  hardAttack: number
  defense: number
  breakthrough: number
  speed: number
  organization: number
  reliability: number
  armor: number
  piercing: number
  maneuverability: number
  supplyUse: number
  fuelUse: number
}

export interface DivisionNode {
  id: string
  battalionType: BattalionType
  x: number
  y: number
}

export interface DivisionStats {
  manpower: number
  equipment: number
  resourceCost: ResourceYields
  trainingDays: number
  softAttack: number
  hardAttack: number
  attack: number
  defense: number
  breakthrough: number
  speed: number
  organization: number
  reliability: number
  armor: number
  piercing: number
  maneuverability: number
  supplyUse: number
  fuelUse: number
}

export interface DivisionTemplate {
  id: string
  name: string
  nodes: DivisionNode[]
  stats: DivisionStats
}

export type TrainingJobStatus = 'training' | 'ready'

export interface TrainingJob {
  id: string
  countryId: CountryId
  provinceId: number
  provinceName: string
  templateId: string
  templateName: string
  stats: DivisionStats
  totalDays: number
  daysRemaining: number
  status: TrainingJobStatus
}

export const MAX_BATTALIONS_PER_TEMPLATE = 6

export const BATTALION_DEFINITIONS: Record<BattalionType, BattalionDefinition> = {
  infantry: {
    id: 'infantry',
    name: 'Infantry Battalion',
    role: 'Cheap line defense',
    manpower: 450,
    equipment: 35,
    resourceCost: { oil: 0, gas: 0, metal: 8, food: 10, industry: 10, energy: 0, manpower: 0 },
    trainingDays: 4,
    softAttack: 6,
    hardAttack: 1,
    defense: 12,
    breakthrough: 3,
    speed: 14,
    organization: 58,
    reliability: 0.92,
    armor: 0,
    piercing: 4,
    maneuverability: 42,
    supplyUse: 1,
    fuelUse: 0,
  },
  motorized: {
    id: 'motorized',
    name: 'Motorized Infantry',
    role: 'Fast exploitation infantry',
    manpower: 430,
    equipment: 55,
    resourceCost: { oil: 14, gas: 0, metal: 16, food: 8, industry: 18, energy: 4, manpower: 0 },
    trainingDays: 5,
    softAttack: 7,
    hardAttack: 2,
    defense: 10,
    breakthrough: 6,
    speed: 28,
    organization: 50,
    reliability: 0.86,
    armor: 1,
    piercing: 5,
    maneuverability: 65,
    supplyUse: 1.4,
    fuelUse: 1.2,
  },
  mechanized: {
    id: 'mechanized',
    name: 'Mechanized Infantry',
    role: 'Protected mobile infantry',
    manpower: 420,
    equipment: 75,
    resourceCost: { oil: 18, gas: 0, metal: 28, food: 8, industry: 26, energy: 6, manpower: 0 },
    trainingDays: 6,
    softAttack: 8,
    hardAttack: 4,
    defense: 14,
    breakthrough: 8,
    speed: 24,
    organization: 48,
    reliability: 0.82,
    armor: 8,
    piercing: 10,
    maneuverability: 56,
    supplyUse: 1.8,
    fuelUse: 1.7,
  },
  tank: {
    id: 'tank',
    name: 'Tank Battalion',
    role: 'Armored breakthrough',
    manpower: 300,
    equipment: 100,
    resourceCost: { oil: 28, gas: 0, metal: 46, food: 4, industry: 38, energy: 10, manpower: 0 },
    trainingDays: 8,
    softAttack: 10,
    hardAttack: 10,
    defense: 8,
    breakthrough: 20,
    speed: 22,
    organization: 35,
    reliability: 0.76,
    armor: 32,
    piercing: 18,
    maneuverability: 48,
    supplyUse: 2.4,
    fuelUse: 2.6,
  },
  antiTank: {
    id: 'antiTank',
    name: 'Anti-Tank Infantry',
    role: 'Armor piercing support',
    manpower: 260,
    equipment: 45,
    resourceCost: { oil: 0, gas: 0, metal: 26, food: 5, industry: 20, energy: 4, manpower: 0 },
    trainingDays: 5,
    softAttack: 3,
    hardAttack: 13,
    defense: 9,
    breakthrough: 2,
    speed: 13,
    organization: 48,
    reliability: 0.88,
    armor: 0,
    piercing: 34,
    maneuverability: 36,
    supplyUse: 1.2,
    fuelUse: 0,
  },
  artillery: {
    id: 'artillery',
    name: 'Artillery Battalion',
    role: 'Soft attack fire support',
    manpower: 220,
    equipment: 65,
    resourceCost: { oil: 0, gas: 0, metal: 34, food: 4, industry: 28, energy: 6, manpower: 0 },
    trainingDays: 6,
    softAttack: 18,
    hardAttack: 2,
    defense: 5,
    breakthrough: 4,
    speed: 12,
    organization: 32,
    reliability: 0.84,
    armor: 0,
    piercing: 6,
    maneuverability: 28,
    supplyUse: 1.8,
    fuelUse: 0,
  },
}

export function createEmptyDivisionResourceCost(): ResourceYields {
  return { oil: 0, gas: 0, metal: 0, food: 0, industry: 0, energy: 0, manpower: 0 }
}

export function calculateDivisionStats(nodes: DivisionNode[]): DivisionStats {
  const battalions = nodes.map((node) => BATTALION_DEFINITIONS[node.battalionType])
  const resourceCost = createEmptyDivisionResourceCost()

  if (battalions.length === 0) {
    return {
      manpower: 0,
      equipment: 0,
      resourceCost,
      trainingDays: 0,
      softAttack: 0,
      hardAttack: 0,
      attack: 0,
      defense: 0,
      breakthrough: 0,
      speed: 0,
      organization: 0,
      reliability: 0,
      armor: 0,
      piercing: 0,
      maneuverability: 0,
      supplyUse: 0,
      fuelUse: 0,
    }
  }

  for (const battalion of battalions) {
    for (const resourceId of Object.keys(resourceCost) as Array<keyof ResourceYields>) {
      resourceCost[resourceId] += battalion.resourceCost[resourceId]
    }
  }

  const equipment = battalions.reduce((sum, battalion) => sum + battalion.equipment, 0)
  const weightedReliability = battalions.reduce((sum, battalion) => sum + battalion.reliability * battalion.equipment, 0) / Math.max(1, equipment)
  const armorValues = battalions.map((battalion) => battalion.armor)
  const piercingValues = battalions.map((battalion) => battalion.piercing)
  const supplyUse = sumBattalionStat(battalions, 'supplyUse')
  const fuelUse = sumBattalionStat(battalions, 'fuelUse')
  const avgManeuver = avgBattalionStat(battalions, 'maneuverability')

  return {
    manpower: sumBattalionStat(battalions, 'manpower'),
    equipment,
    resourceCost,
    trainingDays: Math.max(...battalions.map((battalion) => battalion.trainingDays)) + battalions.length,
    softAttack: sumBattalionStat(battalions, 'softAttack'),
    hardAttack: sumBattalionStat(battalions, 'hardAttack'),
    attack: sumBattalionStat(battalions, 'softAttack') + sumBattalionStat(battalions, 'hardAttack') * 0.45,
    defense: sumBattalionStat(battalions, 'defense'),
    breakthrough: sumBattalionStat(battalions, 'breakthrough'),
    speed: Math.min(...battalions.map((battalion) => battalion.speed)),
    organization: avgBattalionStat(battalions, 'organization'),
    reliability: weightedReliability,
    armor: Math.max(...armorValues) * 0.4 + average(armorValues) * 0.6,
    piercing: Math.max(...piercingValues) * 0.4 + average(piercingValues) * 0.6,
    maneuverability: Math.max(5, avgManeuver - supplyUse * 1.8 - fuelUse * 1.2),
    supplyUse,
    fuelUse,
  }
}

export function createStarterDivisionTemplates(): DivisionTemplate[] {
  return [
    createTemplate('template-infantry', 'Infantry Brigade', [
      ['infantry', 120, 110],
      ['infantry', 300, 110],
      ['artillery', 480, 110],
    ]),
    createTemplate('template-at-defense', 'AT Defense', [
      ['infantry', 120, 110],
      ['antiTank', 300, 110],
      ['infantry', 480, 110],
    ]),
    createTemplate('template-motorized', 'Motorized Spearhead', [
      ['motorized', 120, 110],
      ['motorized', 300, 110],
      ['artillery', 480, 110],
    ]),
    createTemplate('template-armored', 'Armored Combined Arms', [
      ['tank', 120, 110],
      ['motorized', 300, 110],
      ['mechanized', 480, 110],
    ]),
  ]
}

function createTemplate(id: string, name: string, entries: Array<[BattalionType, number, number]>): DivisionTemplate {
  const nodes = entries.map(([battalionType, x, y], index) => ({
    id: `${id}-node-${index + 1}`,
    battalionType,
    x,
    y,
  }))

  return {
    id,
    name,
    nodes,
    stats: calculateDivisionStats(nodes),
  }
}

function sumBattalionStat<K extends keyof BattalionDefinition>(battalions: BattalionDefinition[], key: K): number {
  return battalions.reduce((sum, battalion) => sum + Number(battalion[key]), 0)
}

function avgBattalionStat<K extends keyof BattalionDefinition>(battalions: BattalionDefinition[], key: K): number {
  return sumBattalionStat(battalions, key) / Math.max(1, battalions.length)
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)
}
