import type { CountryId, TerrainType } from '../province/provinceTypes'

export type GeneralTrait =
  // Unit type specialists
  | 'infantry_specialist'
  | 'armored_expert'
  | 'artillery_specialist'
  | 'panzer_leader'
  // Doctrine specialists
  | 'defensive_doctrine'
  | 'offensive_doctrine'
  // Logistics
  | 'organizer'
  | 'logistics_wizard'
  // Terrain specialists
  | 'mountain_lion'
  | 'desert_fox'
  | 'urban_warfare_specialist'
  | 'jungle_ghost'
  | 'plains_rider'
  | 'winter_warrior'
  | 'river_crosser'

export type BattlePlanPhase = 'holding' | 'preparing' | 'attacking' | 'exploiting' | 'consolidating'

export interface BattlePlan {
  targetProvinceIds: number[]
  requiredUnits: number
  currentPhase: BattlePlanPhase
  preparationProgress: number
  daysInPhase: number
}

export interface General {
  id: string
  name: string
  countryId: CountryId
  skill: number // 1-5
  traits: GeneralTrait[]
  assignedUnitIds: string[]
  frontlineProvinceIds: number[]
  battlePlan: BattlePlan | null
  isPlayerAssigned: boolean
}

export interface TerrainBonus {
  attackMult: number
  defenseMult: number
  speedMult: number
  terrain?: TerrainType
}

export const TERRAIN_TRAIT_MAP: Record<string, { terrain: TerrainType; attackBonus: number; defenseBonus: number; speedBonus: number }> = {
  mountain_lion: { terrain: 'mountain', attackBonus: 0.25, defenseBonus: 0.25, speedBonus: 0 },
  desert_fox: { terrain: 'desert', attackBonus: 0.25, defenseBonus: 0.20, speedBonus: 0 },
  urban_warfare_specialist: { terrain: 'urban', attackBonus: 0.20, defenseBonus: 0.15, speedBonus: 0 },
  jungle_ghost: { terrain: 'forest', attackBonus: 0.20, defenseBonus: 0.20, speedBonus: 0 },
  plains_rider: { terrain: 'plains', attackBonus: 0.15, defenseBonus: 0, speedBonus: 0.15 },
  winter_warrior: { terrain: 'mountain', attackBonus: 0.20, defenseBonus: 0.20, speedBonus: 0 },
  river_crosser: { terrain: 'plains', attackBonus: 0.10, defenseBonus: 0, speedBonus: 0 },
}

export const DOCTRINE_TRAIT_BONUSES: Record<string, { attackBonus: number; defenseBonus: number }> = {
  defensive_doctrine: { attackBonus: -0.10, defenseBonus: 0.15 },
  offensive_doctrine: { attackBonus: 0.15, defenseBonus: -0.10 },
}

export const UNIT_TYPE_TRAIT_BONUSES: Record<string, { attackBonus: number; defenseBonus: number }> = {
  infantry_specialist: { attackBonus: 0.10, defenseBonus: 0.10 },
  armored_expert: { attackBonus: 0.10, defenseBonus: 0 },
  artillery_specialist: { attackBonus: 0.15, defenseBonus: 0 },
  panzer_leader: { attackBonus: 0.20, defenseBonus: 0 },
}

export const GENERAL_NAMES: Record<CountryId, string[]> = {
  azerbaijan: ['General Aliyev', 'General Mammadov', 'General Huseynov', 'General Ismayilov', 'General Guliyev', 'General Abbasov'],
  armenia: ['General Sargsyan', 'General Khachatryan', 'General Harutyunyan', 'General Grigoryan', 'General Martirosyan', 'General Manukyan'],
}

export const GENERAL_CREATION_COST = { money: 50, industry: 5 }

export const AI_GENERAL_CONFIGS: Record<CountryId, Array<{ name: string; skill: number; traits: GeneralTrait[] }>> = {
  azerbaijan: [],
  armenia: [
    { name: 'General Sargsyan', skill: 3, traits: ['defensive_doctrine', 'mountain_lion'] },
    { name: 'General Khachatryan', skill: 2, traits: ['infantry_specialist', 'urban_warfare_specialist'] },
  ],
}
