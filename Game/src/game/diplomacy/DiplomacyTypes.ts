import type { CountryId, ResourceYields } from '../province/provinceTypes'

export type RelationScore = number // -100 to +100

export interface TradeDeal {
  id: string
  sender: CountryId
  receiver: CountryId
  offer: Partial<ResourceYields>
  request: Partial<ResourceYields>
  durationDays: number
  daysRemaining: number
  isMilitary: boolean
  isAccepted: boolean
  isPending: boolean
}

export interface DiplomaticRelation {
  countryA: CountryId
  countryB: CountryId
  score: RelationScore
  isAtWar: boolean
  warStartDay: number | null
  tradeDeals: TradeDeal[]
  nonAggressionPact: boolean
  pactExpiryDay: number | null
  daysBelowWarThreshold: number // tracks consecutive days relation < AI_WAR_RELATION_THRESHOLD
}

export type DiplomacyState = Record<string, DiplomaticRelation>

export interface DiplomaticAction {
  type: 'declareWar' | 'offerPeace' | 'proposeNap' | 'acceptTrade' | 'rejectTrade' | 'sendGift'
  actor: CountryId
  target: CountryId
  payload?: Partial<ResourceYields>
}

export const RELATION_WAR_THRESHOLD = -40
export const RELATION_TRADE_BASIC = -20
export const RELATION_TRADE_MILITARY = 50
export const RELATION_NAP_MIN = 20
export const NAP_DURATION_DAYS = 60
export const WAR_RELATION_PENALTY = -50
export const PROVINCE_CAPTURE_PENALTY = -15
export const GIFT_RELATION_BONUS = 8
export const DAILY_WAR_DRAIN = -2
export const DAILY_TRADE_BONUS = 0.3
export const DAILY_BORDER_TENSION = -0.5
export const AI_WAR_RELATION_THRESHOLD = -50
export const AI_WAR_DAYS_REQUIRED = 7
