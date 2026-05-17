import type { CountryId, ResourceYields, TerrainType } from '../province/provinceTypes'
import { createEmptyEquipmentStockpiles, type EquipmentStockpiles } from '../equipment/EquipmentTypes'

export type BattalionType = 'infantry' | 'motorized' | 'mechanized' | 'tank' | 'antiTank' | 'artillery'
export type TerrainModifierSet = Record<TerrainType, { attack: number; defense: number; speed: number }>

export interface BattalionDefinition {
  id: BattalionType
  name: string
  role: string
  manpower: number
  equipment: number
  equipmentRequirements: EquipmentStockpiles
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
  hardness: number
  maneuverability: number
  supplyUse: number
  fuelUse: number
  terrainModifiers: TerrainModifierSet
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
  equipmentRequirements: EquipmentStockpiles
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
  hardness: number
  maneuverability: number
  supplyUse: number
  fuelUse: number
  terrainProfile: TerrainModifierSet
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
  nodes: DivisionNode[]
  stats: DivisionStats
  totalDays: number
  daysRemaining: number
  status: TrainingJobStatus
}

export const MAX_BATTALIONS_PER_TEMPLATE = 6
export const TERRAIN_TYPES: TerrainType[] = ['urban', 'suburban', 'plains', 'fields', 'forest', 'hills', 'mountain', 'desert']

export const NEUTRAL_TERRAIN_PROFILE = createTerrainModifiers()

export const BATTALION_DEFINITIONS: Record<BattalionType, BattalionDefinition> = {
  infantry: {
    id: 'infantry',
    name: 'Infantry Battalion',
    role: 'Cheap line defense',
    manpower: 450,
    equipment: 35,
    equipmentRequirements: { ...createEmptyEquipmentStockpiles(), smallArms: 450 },
    resourceCost: { oil: 0, gas: 0, metal: 8, food: 10, industry: 10, energy: 0, manpower: 0, ammunition: 0, money: 0 },
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
    hardness: 0.05,
    maneuverability: 42,
    supplyUse: 1,
    fuelUse: 0,
    terrainModifiers: createTerrainModifiers({
      urban: { attack: 1.08, defense: 1.16, speed: 0.9 },
      forest: { attack: 1.05, defense: 1.12, speed: 0.92 },
      hills: { attack: 1.02, defense: 1.1, speed: 0.88 },
      desert: { speed: 0.85 },
      mountain: { attack: 0.9, defense: 1.04, speed: 0.78 },
    }),
  },
  motorized: {
    id: 'motorized',
    name: 'Motorized Infantry',
    role: 'Fast exploitation infantry',
    manpower: 430,
    equipment: 55,
    equipmentRequirements: { ...createEmptyEquipmentStockpiles(), smallArms: 430, supportVehicles: 15 },
    resourceCost: { oil: 14, gas: 0, metal: 16, food: 8, industry: 18, energy: 4, manpower: 0, ammunition: 0, money: 0 },
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
    hardness: 0.22,
    maneuverability: 65,
    supplyUse: 1.4,
    fuelUse: 1.2,
    terrainModifiers: createTerrainModifiers({
      plains: { attack: 1.05, defense: 1.0, speed: 1.12 },
      fields: { attack: 1.04, defense: 1.0, speed: 1.08 },
      desert: { attack: 1.02, defense: 0.95, speed: 1.08 },
      forest: { attack: 0.86, defense: 0.92, speed: 0.72 },
      urban: { attack: 0.88, defense: 0.92, speed: 0.68 },
      mountain: { attack: 0.72, defense: 0.8, speed: 0.55 },
    }),
  },
  mechanized: {
    id: 'mechanized',
    name: 'Mechanized Infantry',
    role: 'Protected mobile infantry',
    manpower: 420,
    equipment: 75,
    equipmentRequirements: { ...createEmptyEquipmentStockpiles(), smallArms: 420, apcIfv: 35 },
    resourceCost: { oil: 18, gas: 0, metal: 28, food: 8, industry: 26, energy: 6, manpower: 0, ammunition: 0, money: 0 },
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
    hardness: 0.48,
    maneuverability: 56,
    supplyUse: 1.8,
    fuelUse: 1.7,
    terrainModifiers: createTerrainModifiers({
      plains: { attack: 1.06, defense: 1.02, speed: 1.05 },
      suburban: { attack: 1.05, defense: 1.05, speed: 0.95 },
      fields: { attack: 1.03, defense: 1.02, speed: 1.0 },
      urban: { attack: 0.96, defense: 1.03, speed: 0.76 },
      forest: { attack: 0.82, defense: 0.92, speed: 0.68 },
      mountain: { attack: 0.68, defense: 0.78, speed: 0.48 },
    }),
  },
  tank: {
    id: 'tank',
    name: 'Tank Battalion',
    role: 'Armored breakthrough',
    manpower: 300,
    equipment: 100,
    equipmentRequirements: { ...createEmptyEquipmentStockpiles(), smallArms: 300, tanks: 40, supportVehicles: 20 },
    resourceCost: { oil: 28, gas: 0, metal: 46, food: 4, industry: 38, energy: 10, manpower: 0, ammunition: 0, money: 0 },
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
    hardness: 0.85,
    maneuverability: 48,
    supplyUse: 2.4,
    fuelUse: 2.6,
    terrainModifiers: createTerrainModifiers({
      plains: { attack: 1.15, defense: 1.02, speed: 1.06 },
      fields: { attack: 1.12, defense: 1.0, speed: 1.02 },
      suburban: { attack: 1.02, defense: 0.95, speed: 0.86 },
      desert: { attack: 1.02, defense: 0.92, speed: 0.9 },
      urban: { attack: 0.72, defense: 0.78, speed: 0.55 },
      forest: { attack: 0.68, defense: 0.78, speed: 0.52 },
      mountain: { attack: 0.45, defense: 0.58, speed: 0.35 },
    }),
  },
  antiTank: {
    id: 'antiTank',
    name: 'Anti-Tank Infantry',
    role: 'Armor piercing support',
    manpower: 260,
    equipment: 45,
    equipmentRequirements: { ...createEmptyEquipmentStockpiles(), smallArms: 260, antiTankWeapons: 20 },
    resourceCost: { oil: 0, gas: 0, metal: 26, food: 5, industry: 20, energy: 4, manpower: 0, ammunition: 0, money: 0 },
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
    hardness: 0.12,
    maneuverability: 36,
    supplyUse: 1.2,
    fuelUse: 0,
    terrainModifiers: createTerrainModifiers({
      urban: { attack: 1.02, defense: 1.18, speed: 0.88 },
      forest: { attack: 1.0, defense: 1.14, speed: 0.86 },
      hills: { attack: 1.0, defense: 1.16, speed: 0.82 },
      mountain: { attack: 0.95, defense: 1.12, speed: 0.72 },
      plains: { attack: 0.9, defense: 1.0, speed: 0.95 },
    }),
  },
  artillery: {
    id: 'artillery',
    name: 'Artillery Battalion',
    role: 'Soft attack fire support',
    manpower: 220,
    equipment: 65,
    equipmentRequirements: { ...createEmptyEquipmentStockpiles(), smallArms: 220, artillery: 24, supportVehicles: 10 },
    resourceCost: { oil: 0, gas: 0, metal: 34, food: 4, industry: 28, energy: 6, manpower: 0, ammunition: 0, money: 0 },
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
    hardness: 0.04,
    maneuverability: 28,
    supplyUse: 1.8,
    fuelUse: 0,
    terrainModifiers: createTerrainModifiers({
      plains: { attack: 1.12, defense: 0.92, speed: 0.9 },
      urban: { attack: 1.08, defense: 0.95, speed: 0.72 },
      fields: { attack: 1.06, defense: 0.92, speed: 0.88 },
      mountain: { attack: 0.72, defense: 0.86, speed: 0.5 },
      forest: { attack: 0.78, defense: 0.88, speed: 0.58 },
      desert: { attack: 0.86, defense: 0.84, speed: 0.65 },
    }),
  },
}

export function createEmptyDivisionResourceCost(): ResourceYields {
  return { oil: 0, gas: 0, metal: 0, food: 0, industry: 0, energy: 0, manpower: 0, ammunition: 0, money: 0 }
}

export function calculateDivisionStats(nodes: DivisionNode[]): DivisionStats {
  const battalions = nodes.map((node) => BATTALION_DEFINITIONS[node.battalionType])
  const resourceCost = createEmptyDivisionResourceCost()
  const equipmentRequirements = createEmptyEquipmentStockpiles()

  if (battalions.length === 0) {
    return {
      manpower: 0,
      equipment: 0,
      equipmentRequirements,
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
      hardness: 0,
      maneuverability: 0,
      supplyUse: 0,
      fuelUse: 0,
      terrainProfile: NEUTRAL_TERRAIN_PROFILE,
    }
  }

  for (const battalion of battalions) {
    for (const resourceId of Object.keys(resourceCost) as Array<keyof ResourceYields>) {
      resourceCost[resourceId] += battalion.resourceCost[resourceId]
    }

    for (const category of Object.keys(equipmentRequirements) as Array<keyof EquipmentStockpiles>) {
      equipmentRequirements[category] += battalion.equipmentRequirements[category]
    }
  }

  const equipment = battalions.reduce((sum, battalion) => sum + battalion.equipment, 0)
  const weightedReliability = battalions.reduce((sum, battalion) => sum + battalion.reliability * battalion.equipment, 0) / Math.max(1, equipment)
  const armorValues = battalions.map((battalion) => battalion.armor)
  const piercingValues = battalions.map((battalion) => battalion.piercing)
  const supplyUse = sumBattalionStat(battalions, 'supplyUse')
  const fuelUse = sumBattalionStat(battalions, 'fuelUse')
  const avgManeuver = avgBattalionStat(battalions, 'maneuverability')
  const hardnessWeight = battalions.reduce((sum, battalion) => sum + battalion.equipment + battalion.manpower * 0.08, 0)

  return {
    manpower: sumBattalionStat(battalions, 'manpower'),
    equipment,
    equipmentRequirements,
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
    hardness: battalions.reduce((sum, battalion) => sum + battalion.hardness * (battalion.equipment + battalion.manpower * 0.08), 0) / Math.max(1, hardnessWeight),
    maneuverability: Math.max(5, avgManeuver - supplyUse * 1.8 - fuelUse * 1.2),
    supplyUse,
    fuelUse,
    terrainProfile: calculateTerrainProfile(battalions),
  }
}

export function createTerrainModifiers(overrides: Partial<Record<TerrainType, Partial<{ attack: number; defense: number; speed: number }>>> = {}): TerrainModifierSet {
  return TERRAIN_TYPES.reduce((profile, terrainType) => {
    const override = overrides[terrainType] ?? {}
    profile[terrainType] = {
      attack: override.attack ?? 1,
      defense: override.defense ?? 1,
      speed: override.speed ?? 1,
    }
    return profile
  }, {} as TerrainModifierSet)
}

function calculateTerrainProfile(battalions: BattalionDefinition[]): TerrainModifierSet {
  return TERRAIN_TYPES.reduce((profile, terrainType) => {
    const attackWeight = battalions.reduce((sum, battalion) => sum + battalion.softAttack + battalion.hardAttack, 0)
    const defenseWeight = battalions.reduce((sum, battalion) => sum + battalion.defense, 0)

    profile[terrainType] = {
      attack: battalions.reduce((sum, battalion) => sum + battalion.terrainModifiers[terrainType].attack * (battalion.softAttack + battalion.hardAttack), 0) / Math.max(1, attackWeight),
      defense: battalions.reduce((sum, battalion) => sum + battalion.terrainModifiers[terrainType].defense * battalion.defense, 0) / Math.max(1, defenseWeight),
      speed: Math.min(...battalions.map((battalion) => battalion.terrainModifiers[terrainType].speed)),
    }

    return profile
  }, {} as TerrainModifierSet)
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
