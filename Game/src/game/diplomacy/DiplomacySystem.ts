import type { CountryId } from '../province/provinceTypes'
import type { DiplomaticRelation, TradeDeal } from './DiplomacyTypes'
import {
  AI_WAR_RELATION_THRESHOLD,
  DAILY_BORDER_TENSION,
  DAILY_TRADE_BONUS,
  DAILY_WAR_DRAIN,
  GIFT_RELATION_BONUS,
  NAP_DURATION_DAYS,
  PROVINCE_CAPTURE_PENALTY,
  RELATION_NAP_MIN,
  RELATION_TRADE_BASIC,
  RELATION_TRADE_MILITARY,
  WAR_RELATION_PENALTY,
} from './DiplomacyTypes'
import type { UnitState } from '../units/UnitTypes'

function relationKey(left: CountryId, right: CountryId): string {
  return [left, right].sort().join(':')
}

export class DiplomacySystem {
  readonly relations: Map<string, DiplomaticRelation> = new Map()

  constructor() {
    // Initial state: Azerbaijan and Armenia start at peace; war must be declared
    this.relations.set(relationKey('azerbaijan', 'armenia'), {
      countryA: 'azerbaijan',
      countryB: 'armenia',
      score: 0,
      isAtWar: false,
      warStartDay: null,
      tradeDeals: [],
      nonAggressionPact: false,
      pactExpiryDay: null,
      daysBelowWarThreshold: 0,
    })
  }

  getRelation(left: CountryId, right: CountryId): DiplomaticRelation | undefined {
    return this.relations.get(relationKey(left, right))
  }

  areAtWar(left: CountryId, right: CountryId): boolean {
    if (left === right) return false
    const relation = this.getRelation(left, right)
    return relation?.isAtWar ?? false
  }

  canTrade(sender: CountryId, receiver: CountryId, isMilitary: boolean): boolean {
    const relation = this.getRelation(sender, receiver)
    if (!relation) return false
    if (relation.isAtWar) return false
    if (isMilitary && relation.score < RELATION_TRADE_MILITARY) return false
    return relation.score >= RELATION_TRADE_BASIC
  }

  declareWar(actor: CountryId, target: CountryId, currentDay: number): boolean {
    const key = relationKey(actor, target)
    const existing = this.relations.get(key)

    if (existing?.isAtWar) return false
    if (existing?.nonAggressionPact && (existing.pactExpiryDay ?? 0) > currentDay) {
      // Breaking NAP is allowed but damages relations further
    }

    if (existing) {
      existing.isAtWar = true
      existing.warStartDay = currentDay
      existing.score = Math.max(-100, existing.score + WAR_RELATION_PENALTY)
      existing.nonAggressionPact = false
      existing.pactExpiryDay = null
    } else {
      this.relations.set(key, {
        countryA: actor,
        countryB: target,
        score: -100,
        isAtWar: true,
        warStartDay: currentDay,
        tradeDeals: [],
        nonAggressionPact: false,
        pactExpiryDay: null,
        daysBelowWarThreshold: 0,
      })
    }

    return true
  }

  offerPeace(actor: CountryId, target: CountryId, currentDay: number): boolean {
    const relation = this.getRelation(actor, target)
    if (!relation?.isAtWar) return false
    if ((relation.warStartDay ?? 0) > currentDay - 30) return false

    relation.isAtWar = false
    relation.warStartDay = null
    relation.score = -20
    return true
  }

  proposeNap(actor: CountryId, target: CountryId, currentDay: number): boolean {
    const relation = this.getRelation(actor, target)
    if (!relation) return false
    if (relation.isAtWar) return false
    if (relation.score < RELATION_NAP_MIN) return false

    relation.nonAggressionPact = true
    relation.pactExpiryDay = currentDay + NAP_DURATION_DAYS
    return true
  }

  sendGift(actor: CountryId, target: CountryId): boolean {
    const relation = this.getRelation(actor, target)
    if (!relation) return false
    relation.score = Math.min(100, relation.score + GIFT_RELATION_BONUS)
    return true
  }

  createTradeOffer(
    sender: CountryId,
    receiver: CountryId,
    offer: Partial<Record<string, number>>,
    request: Partial<Record<string, number>>,
    durationDays: number,
    isMilitary: boolean
  ): TradeDeal | null {
    if (!this.canTrade(sender, receiver, isMilitary)) return null

    const deal: TradeDeal = {
      id: `trade-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sender,
      receiver,
      offer,
      request,
      durationDays,
      daysRemaining: durationDays,
      isMilitary,
      isAccepted: false,
      isPending: true,
    }

    const relation = this.getRelation(sender, receiver)
    if (relation) {
      relation.tradeDeals.push(deal)
    }

    return deal
  }

  acceptTrade(dealId: string, countryId: CountryId): TradeDeal | null {
    for (const relation of this.relations.values()) {
      const deal = relation.tradeDeals.find((d) => d.id === dealId)
      if (deal && deal.receiver === countryId && deal.isPending) {
        deal.isAccepted = true
        deal.isPending = false
        return deal
      }
    }
    return null
  }

  rejectTrade(dealId: string, countryId: CountryId): boolean {
    for (const relation of this.relations.values()) {
      const deal = relation.tradeDeals.find((d) => d.id === dealId)
      if (deal && deal.receiver === countryId && deal.isPending) {
        deal.isPending = false
        return true
      }
    }
    return false
  }

  tickDaily(currentDay: number, units?: UnitState[], provinces?: import('../province/provinceTypes').Province[]): void {
    for (const relation of this.relations.values()) {
      // War relation drain
      if (relation.isAtWar) {
        relation.score = Math.max(-100, relation.score + DAILY_WAR_DRAIN)
      }

      // Border tension (only if units and provinces provided)
      if (!relation.isAtWar && units && provinces) {
        const tension = this.computeBorderTension(relation, units, provinces)
        if (tension !== 0) {
          relation.score = Math.max(-100, Math.min(100, relation.score + tension))
        }
      }

      // Track consecutive days below war threshold
      if (!relation.isAtWar && relation.score <= AI_WAR_RELATION_THRESHOLD) {
        relation.daysBelowWarThreshold += 1
      } else {
        relation.daysBelowWarThreshold = 0
      }

      // Active trade bonus
      const activeTrades = relation.tradeDeals.filter((d) => d.isAccepted && d.daysRemaining > 0)
      if (activeTrades.length > 0) {
        relation.score = Math.min(100, relation.score + DAILY_TRADE_BONUS * activeTrades.length)
      }

      // Decrement trade deal days
      for (const deal of relation.tradeDeals) {
        if (deal.isAccepted && deal.daysRemaining > 0) {
          deal.daysRemaining -= 1
        }
      }

      // Expire old NAPs
      if (relation.nonAggressionPact && relation.pactExpiryDay !== null && currentDay >= relation.pactExpiryDay) {
        relation.nonAggressionPact = false
        relation.pactExpiryDay = null
      }

      // Clean up expired deals
      relation.tradeDeals = relation.tradeDeals.filter((d) => d.daysRemaining > 0 || d.isPending)
    }
  }

  private computeBorderTension(
    relation: DiplomaticRelation,
    units: UnitState[],
    provinces: import('../province/provinceTypes').Province[]
  ): number {
    const countryIds = new Set([relation.countryA, relation.countryB])
    let tension = 0

    // Count friendly units on border provinces adjacent to the other country
    for (const province of provinces) {
      if (!countryIds.has(province.controllerCountryId)) continue
      if (province.isContested) continue

      const isBorder = province.neighbors.some((neighborId) => {
        const neighbor = provinces[neighborId]
        return neighbor && neighbor.controllerCountryId !== province.controllerCountryId && countryIds.has(neighbor.controllerCountryId)
      })

      if (isBorder) {
        const unitsHere = units.filter((u) => u.provinceId === province.id && u.manpower > 0 && countryIds.has(u.countryId))
        tension += unitsHere.length * DAILY_BORDER_TENSION * 0.2
      }
    }

    return Math.round(tension * 10) / 10
  }

  onProvinceCaptured(captor: CountryId, previousOwner: CountryId): void {
    const relation = this.getRelation(captor, previousOwner)
    if (relation) {
      relation.score = Math.max(-100, relation.score + PROVINCE_CAPTURE_PENALTY)
    }
  }

  getAllRelationsFor(countryId: CountryId): DiplomaticRelation[] {
    return [...this.relations.values()].filter((r) => r.countryA === countryId || r.countryB === countryId)
  }
}
