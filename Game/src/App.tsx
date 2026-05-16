import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import type { ResourceId, ResourceYields } from './game/province/provinceTypes'
import { StrategyPrototype, type ActiveCombatOverlay, type PrototypeHudState, type TimeSpeed } from './rendering/StrategyPrototype'

const PLAYER_COUNTRY_ID = 'azerbaijan'
const RESOURCE_ORDER: ResourceId[] = ['manpower', 'industry', 'oil', 'gas', 'metal', 'food', 'energy']
const RESOURCE_META: Record<ResourceId, { label: string; icon: string }> = {
  manpower: { label: 'Manpower', icon: 'MP' },
  industry: { label: 'Industry', icon: 'IN' },
  oil: { label: 'Oil', icon: 'OL' },
  gas: { label: 'Gas', icon: 'GS' },
  metal: { label: 'Metal', icon: 'MT' },
  food: { label: 'Food', icon: 'FD' },
  energy: { label: 'Energy', icon: 'EN' },
}

const initialHudState: PrototypeHudState = {
  isLoading: true,
  selectedProvince: null,
  selectedUnit: null,
  economy: null,
  activeCombat: null,
  activeCombats: [],
  time: { day: 1, hour: 0, speed: 1 },
  status: 'Loading province map',
  mapStats: null,
}

function App() {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const prototypeRef = useRef<StrategyPrototype | null>(null)
  const [hudState, setHudState] = useState<PrototypeHudState>(initialHudState)
  const playerEconomy = hudState.economy?.[PLAYER_COUNTRY_ID] ?? null
  const showLegacyEconomyPanel: boolean = false

  useEffect(() => {
    const mount = mountRef.current

    if (!mount) {
      return
    }

    const prototype = new StrategyPrototype(mount, setHudState)
    prototypeRef.current = prototype
    void prototype.start()

    return () => {
      prototype.dispose()
      prototypeRef.current = null
    }
  }, [])

  const setTimeSpeed = useCallback((speed: TimeSpeed) => {
    prototypeRef.current?.setTimeSpeed(speed)
  }, [])

  return (
    <main className="app-shell">
      <section ref={mountRef} className="map-viewport" aria-label="South Caucasus province strategy map" />
      
      {/* Top Bar */}
      <header className="top-bar">
        <div className="top-bar-left">
          <div className="game-title">
            <span className="title-icon">⚔</span>
            <span>CAUCASUS COMMAND</span>
          </div>
          <div className="game-status">
            <span className={`status-dot ${hudState.time.speed === 0 ? 'paused' : ''}`}></span>
            {hudState.status}
          </div>
        </div>
        <div className="top-bar-center">
          <div className="time-display">
            <span className="time-label">DAY</span>
            <span className="time-value">{hudState.time.day}</span>
            <span className="time-separator">|</span>
            <span className="time-value">{String(hudState.time.hour).padStart(2, '0')}:00</span>
          </div>
          <div className="time-controls">
            <button
              className={`time-btn ${hudState.time.speed === 0 ? 'active' : ''}`}
              onClick={() => setTimeSpeed(0)}
              title="Pause"
            >
              <span className="btn-icon">⏸</span>
            </button>
            <button
              className={`time-btn ${hudState.time.speed === 1 ? 'active' : ''}`}
              onClick={() => setTimeSpeed(1)}
              title="Play (1x)"
            >
              <span className="btn-icon">▶</span>
              <span className="btn-label">1x</span>
            </button>
            <button
              className={`time-btn ${hudState.time.speed === 2 ? 'active' : ''}`}
              onClick={() => setTimeSpeed(2)}
              title="2x Speed"
            >
              <span className="btn-label">2x</span>
            </button>
            <button
              className={`time-btn ${hudState.time.speed === 5 ? 'active' : ''}`}
              onClick={() => setTimeSpeed(5)}
              title="5x Speed"
            >
              <span className="btn-label">5x</span>
            </button>
            <button
              className={`time-btn ${hudState.time.speed === 10 ? 'active' : ''}`}
              onClick={() => setTimeSpeed(10)}
              title="10x Speed"
            >
              <span className="btn-label">10x</span>
            </button>
          </div>
        </div>
        <div className="top-bar-right">
          <div className="resource-strip" aria-label="Player resources">
            {playerEconomy
              ? RESOURCE_ORDER.map((resourceId) => (
                  <ResourceChip
                    key={resourceId}
                    resourceId={resourceId}
                    value={playerEconomy.stockpiles[resourceId]}
                    income={playerEconomy.dailyIncome[resourceId]}
                  />
                ))
              : RESOURCE_ORDER.map((resourceId) => (
                  <ResourceChip key={resourceId} resourceId={resourceId} value={0} income={0} isLoading />
                ))}
          </div>
          <div className="stat-badge">
            <span className="badge-label">Provinces</span>
            <span className="badge-value">{hudState.mapStats ? hudState.mapStats.provinceCount.toLocaleString() : '...'}</span>
          </div>
        </div>
      </header>

      {/* Side Panel */}
      <aside className="side-panel">
        {/* Country Overview */}
        <div className="panel-section country-overview">
          <div className="section-header">
            <span className="header-icon">🏛</span>
            <span className="header-title">NATIONS</span>
          </div>
          <div className="country-cards">
            <div className="country-card azerbaijan">
              <div className="country-flag"></div>
              <div className="country-info">
                <span className="country-name">Azerbaijan</span>
                <div className="country-stats">
                  {hudState.mapStats ? (
                    <>
                      <span className="stat">
                        <span className="stat-icon">🗺</span>
                        {hudState.mapStats.azProvinceCount}
                      </span>
                      <span className="stat">
                        <span className="stat-icon">⚔</span>
                        {hudState.mapStats.azUnitCount}
                      </span>
                    </>
                  ) : <span className="loading">Loading...</span>}
                </div>
              </div>
            </div>
            <div className="country-card armenia">
              <div className="country-flag"></div>
              <div className="country-info">
                <span className="country-name">Armenia</span>
                <div className="country-stats">
                  {hudState.mapStats ? (
                    <>
                      <span className="stat">
                        <span className="stat-icon">🗺</span>
                        {hudState.mapStats.amProvinceCount}
                      </span>
                      <span className="stat">
                        <span className="stat-icon">⚔</span>
                        {hudState.mapStats.amUnitCount}
                      </span>
                    </>
                  ) : <span className="loading">Loading...</span>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Selected Province */}
        <div className="panel-section">
          <div className="section-header">
            <span className="header-icon">📍</span>
            <span className="header-title">PROVINCE</span>
          </div>
          {hudState.selectedProvince ? (
            <div className="province-details">
              <div className="province-name">{hudState.selectedProvince.name}</div>
              <div className="detail-row">
                <span className="detail-label">Owner</span>
                <span className={`detail-value ${hudState.selectedProvince.ownerName === 'Azerbaijan' ? 'az-color' : 'am-color'}`}>
                  {hudState.selectedProvince.ownerName}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Controller</span>
                <span className={`detail-value ${hudState.selectedProvince.controllerName === 'Azerbaijan' ? 'az-color' : 'am-color'}`}>
                  {hudState.selectedProvince.controllerName}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Region</span>
                <span className="detail-value">{hudState.selectedProvince.economyRegion}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Status</span>
                <span className={`detail-value ${hudState.selectedProvince.isContested ? 'contested' : 'stable'}`}>
                  {hudState.selectedProvince.isContested ? '⚠ Contested' : '✓ Stable'}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Primary Resource</span>
                <span className="detail-value">{hudState.selectedProvince.primaryResource}</span>
              </div>
              <div className="resource-yields">
                <span className="detail-label">Yields</span>
                <div className="yield-list">{formatYieldsDetailed(hudState.selectedProvince.resourceYields)}</div>
              </div>
              <div className="detail-row">
                <span className="detail-label">Units Present</span>
                <span className="detail-value">{hudState.selectedProvince.unitCount}</span>
              </div>
            </div>
          ) : (
            <div className="empty-state">No province selected</div>
          )}
        </div>

        {/* Selected Unit */}
        {hudState.selectedUnit && (
          <div className="panel-section">
            <div className="section-header">
              <span className="header-icon">🎖</span>
              <span className="header-title">UNIT</span>
            </div>
            <div className="unit-details">
              <div className="unit-header">
                <span className="unit-name">{hudState.selectedUnit.name}</span>
                <span className={`unit-owner ${hudState.selectedUnit.owner === 'Azerbaijan' ? 'az-color' : 'am-color'}`}>
                  {hudState.selectedUnit.owner}
                </span>
              </div>
              <div className="unit-status">{hudState.selectedUnit.status}</div>
              
              <div className="stat-bars">
                <div className="stat-bar">
                  <div className="stat-bar-header">
                    <span className="stat-bar-label">Manpower</span>
                    <span className="stat-bar-value">{Math.round(hudState.selectedUnit.manpower)}/{hudState.selectedUnit.maxManpower}</span>
                  </div>
                  <div className="stat-bar-track">
                    <div 
                      className="stat-bar-fill manpower" 
                      style={{ width: `${(hudState.selectedUnit.manpower / hudState.selectedUnit.maxManpower) * 100}%` }}
                    ></div>
                  </div>
                </div>
                <div className="stat-bar">
                  <div className="stat-bar-header">
                    <span className="stat-bar-label">Organization</span>
                    <span className="stat-bar-value">{Math.round(hudState.selectedUnit.organization)}/{hudState.selectedUnit.maxOrganization}</span>
                  </div>
                  <div className="stat-bar-track">
                    <div 
                      className="stat-bar-fill organization" 
                      style={{ width: `${(hudState.selectedUnit.organization / hudState.selectedUnit.maxOrganization) * 100}%` }}
                    ></div>
                  </div>
                </div>
                <div className="stat-bar">
                  <div className="stat-bar-header">
                    <span className="stat-bar-label">Equipment</span>
                    <span className="stat-bar-value">{Math.round(hudState.selectedUnit.equipment)}/{hudState.selectedUnit.maxEquipment}</span>
                  </div>
                  <div className="stat-bar-track">
                    <div 
                      className="stat-bar-fill equipment" 
                      style={{ width: `${(hudState.selectedUnit.equipment / hudState.selectedUnit.maxEquipment) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="unit-combat-stats">
                <div className="combat-stat">
                  <span className="combat-stat-label">ATK</span>
                  <span className="combat-stat-value">{hudState.selectedUnit.attack}</span>
                </div>
                <div className="combat-stat">
                  <span className="combat-stat-label">DEF</span>
                  <span className="combat-stat-value">{hudState.selectedUnit.defense}</span>
                </div>
                <div className="combat-stat">
                  <span className="combat-stat-label">REL</span>
                  <span className="combat-stat-value">{Math.round(hudState.selectedUnit.reliability * 100)}%</span>
                </div>
              </div>

              {hudState.selectedUnit.reinforcementDelayHours > 0 && (
                <div className="detail-row">
                  <span className="detail-label">Reinforce Delay</span>
                  <span className="detail-value">{Math.max(0, Math.ceil(hudState.selectedUnit.reinforcementDelayHours))}h</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Active Combat */}
        {hudState.activeCombat && (
          <div className="panel-section combat-section">
            <div className="section-header">
              <span className="header-icon">💥</span>
              <span className="header-title">BATTLE</span>
            </div>
            <div className="combat-details">
              <div className="combat-id">{hudState.activeCombat.id}</div>
              <div className="combat-report">{hudState.activeCombat.lastReport}</div>
              <div className="detail-row">
                <span className="detail-label">Duration</span>
                <span className="detail-value">{hudState.activeCombat.elapsedHours}h</span>
              </div>
            </div>
          </div>
        )}

        {/* Economy */}
        {showLegacyEconomyPanel && hudState.economy && (
          <div className="panel-section">
            <div className="section-header">
              <span className="header-icon">💰</span>
              <span className="header-title">ECONOMY</span>
            </div>
            <div className="economy-sections">
              <div className="economy-card azerbaijan">
                <div className="economy-title">Azerbaijan</div>
                <div className="economy-data">
                  <div className="detail-row">
                    <span className="detail-label">Daily Income</span>
                    <span className="detail-value">{formatYields(hudState.economy!.azerbaijan.dailyIncome)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Stockpiles</span>
                    <span className="detail-value">{formatYields(hudState.economy!.azerbaijan.stockpiles)}</span>
                  </div>
                </div>
              </div>
              <div className="economy-card armenia">
                <div className="economy-title">Armenia</div>
                <div className="economy-data">
                  <div className="detail-row">
                    <span className="detail-label">Daily Income</span>
                    <span className="detail-value">{formatYields(hudState.economy!.armenia.dailyIncome)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Stockpiles</span>
                    <span className="detail-value">{formatYields(hudState.economy!.armenia.stockpiles)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Loading Overlay */}
      {hudState.isLoading && (
        <div className="loading-overlay">
          <div className="loading-content">
            <div className="loading-spinner"></div>
            <div className="loading-text">Preparing province map...</div>
          </div>
        </div>
      )}

      {/* Battle Popups */}
      {hudState.activeCombats.map((combat) => (
        <BattlePopup key={combat.id} combat={combat} />
      ))}
    </main>
  )
}

interface BattlePopupProps {
  combat: ActiveCombatOverlay
}

interface ResourceChipProps {
  resourceId: ResourceId
  value: number
  income?: number
  isLoading?: boolean
}

function ResourceChip({ resourceId, value, income = 0, isLoading = false }: ResourceChipProps) {
  const meta = RESOURCE_META[resourceId]
  const roundedIncome = Math.round(income)

  return (
    <div className={`resource-chip ${resourceId}`} title={`${meta.label}: ${Math.round(value).toLocaleString()} (${formatIncome(roundedIncome)}/day)`}>
      <ResourceIcon resourceId={resourceId} />
      <span className="resource-amount">{isLoading ? '...' : compactNumber(value)}</span>
      {!isLoading && <span className={`resource-income ${roundedIncome >= 0 ? 'positive' : 'negative'}`}>{formatIncome(roundedIncome)}</span>}
    </div>
  )
}

function ResourceIcon({ resourceId }: { resourceId: ResourceId }) {
  return (
    <span className={`resource-icon ${resourceId}`} aria-hidden="true">
      {RESOURCE_META[resourceId].icon}
    </span>
  )
}

function BattlePopup({ combat }: BattlePopupProps) {
  if (!combat.screenPosition) return null

  const indicatorClass =
    combat.advantage === 'attacker' ? 'advantage-winning' :
    combat.advantage === 'defender' ? 'advantage-losing' :
    'advantage-even'

  return (
    <div
      className="battle-popup"
      style={{
        left: combat.screenPosition.x - 140,
        top: combat.screenPosition.y - 80,
      }}
    >
      <div className={`battle-indicator ${indicatorClass}`}></div>
      <div className="battle-sides">
        <div className="battle-side attacker">
          <div className="side-header">
            <span className={`side-flag ${combat.attacker.countryId === 'azerbaijan' ? 'az-flag' : 'am-flag'}`}></span>
            <span className="side-name">{combat.attacker.countryName}</span>
            <span className="side-badge attacking">ATK</span>
          </div>
          <div className="side-stats">
            <div className="side-stat">
              <span className="stat-label">MP</span>
              <span className="stat-value">{combat.attacker.totalManpower}</span>
            </div>
            <div className="side-stat">
              <span className="stat-label">ORG</span>
              <span className="stat-value">{combat.attacker.avgOrganization}</span>
            </div>
            <div className="side-stat">
              <span className="stat-label">UNITS</span>
              <span className="stat-value">{combat.attacker.unitCount}</span>
            </div>
          </div>
        </div>
        <div className="battle-divider">VS</div>
        <div className="battle-side defender">
          <div className="side-header">
            <span className={`side-flag ${combat.defender.countryId === 'azerbaijan' ? 'az-flag' : 'am-flag'}`}></span>
            <span className="side-name">{combat.defender.countryName}</span>
            <span className="side-badge defending">DEF</span>
          </div>
          <div className="side-stats">
            <div className="side-stat">
              <span className="stat-label">MP</span>
              <span className="stat-value">{combat.defender.totalManpower}</span>
            </div>
            <div className="side-stat">
              <span className="stat-label">ORG</span>
              <span className="stat-value">{combat.defender.avgOrganization}</span>
            </div>
            <div className="side-stat">
              <span className="stat-label">UNITS</span>
              <span className="stat-value">{combat.defender.unitCount}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatYields(yields: Record<string, number>): string {
  return Object.entries(yields)
    .filter(([, value]) => Math.abs(value) > 0.01)
    .map(([resource, value]) => `${resource} ${Math.round(value)}`)
    .join(', ')
}

function formatYieldsDetailed(yields: ResourceYields): React.ReactNode {
  const entries = RESOURCE_ORDER.filter((resourceId) => Math.abs(yields[resourceId]) > 0.01)
  if (entries.length === 0) return <span className="no-yields">None</span>
  
  return entries.map((resourceId) => (
    <span key={resourceId} className="yield-item" title={RESOURCE_META[resourceId].label}>
      <ResourceIcon resourceId={resourceId} />
      <span className="yield-name">{RESOURCE_META[resourceId].label}</span>
      <span className="yield-value">{Math.round(yields[resourceId])}</span>
    </span>
  ))
}

function compactNumber(value: number): string {
  const rounded = Math.round(value)

  if (Math.abs(rounded) >= 1000) {
    return `${(rounded / 1000).toFixed(rounded >= 10000 ? 0 : 1)}k`
  }

  return rounded.toString()
}

function formatIncome(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`
}

export default App
