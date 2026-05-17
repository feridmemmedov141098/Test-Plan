import { useCallback, useEffect, useRef, useState } from 'react'
import { Banknote, Bomb, Edit3, Factory, Flame, Fuel, Hammer, Handshake, MapPin, PencilRuler, Pickaxe, Plus, Save, Shield, Swords, Trash2, User, Users, Wheat, X, Zap } from 'lucide-react'
import './App.css'
import { EQUIPMENT_CATEGORIES, EQUIPMENT_LABELS, FACTORY_OUTPUT_BASE, MAX_FACTORY_COUNT_PER_LINE, PRODUCIBLE_CATEGORIES, PRODUCIBLE_LABELS, type EquipmentCategory, type ProducibleCategory } from './game/equipment/EquipmentTypes'
import { AI_WAR_DAYS_REQUIRED } from './game/diplomacy/DiplomacyTypes'
import { BUILDING_DEFINITIONS, type BuildingType } from './game/economy/ConstructionTypes'
import type { ResourceId, ResourceYields } from './game/province/provinceTypes'
import {
  BATTALION_DEFINITIONS,
  calculateDivisionStats,
  MAX_BATTALIONS_PER_TEMPLATE,
  TERRAIN_TYPES,
  type BattalionType,
  type DivisionNode,
  type DivisionTemplate,
} from './game/units/DivisionDesignerTypes'
import { StrategyPrototype, type ActiveCombatOverlay, type PrototypeHudState, type TimeSpeed } from './rendering/StrategyPrototype'

const PLAYER_COUNTRY_ID = 'azerbaijan'
const RESOURCE_ORDER: ResourceId[] = ['manpower', 'industry', 'money', 'oil', 'gas', 'metal', 'food', 'energy', 'ammunition']
const RESOURCE_META: Record<ResourceId, { label: string; Icon: typeof Users }> = {
  manpower: { label: 'Manpower', Icon: Users },
  industry: { label: 'Industry', Icon: Factory },
  money: { label: 'Money', Icon: Banknote },
  oil: { label: 'Oil', Icon: Fuel },
  gas: { label: 'Gas', Icon: Flame },
  metal: { label: 'Metal', Icon: Pickaxe },
  food: { label: 'Food', Icon: Wheat },
  energy: { label: 'Energy', Icon: Zap },
  ammunition: { label: 'Ammunition', Icon: Bomb },
}

const initialHudState: PrototypeHudState = {
  isLoading: true,
  selectedProvince: null,
  selectedUnit: null,
  economy: null,
  construction: {
    jobs: [],
    playerBuildings: { barracks: 0, militaryComplex: 0 },
    validConstructionProvinceIds: [],
  },
  training: {
    jobs: [],
    templates: [],
    validDeploymentProvinceIds: [],
    trainingSlots: 0,
    activeTrainingCount: 0,
  },
  activeCombat: null,
  activeCombats: [],
  battleForecast: null,
  logistics: { supplyVehicleCount: 0, activeSupplyVehicleCount: 0 },
  stockpile: {
    equipmentStockpiles: { smallArms: 0, antiTankWeapons: 0, artillery: 0, tanks: 0, apcIfv: 0, supportVehicles: 0, supplyTrucks: 0 },
    ammunition: 0,
    food: 0,
    productionRates: {} as Record<EquipmentCategory, number>,
  },
  production: {
    lines: [],
    totalFactories: 0,
    usedFactories: 0,
    isOverassigned: false,
  },
  time: { day: 1, hour: 0, speed: 1 },
  status: 'Loading province map',
  mapStats: null,
}

function DiplomacyPanel({ prototypeRef, currentDay }: { prototypeRef: React.MutableRefObject<StrategyPrototype | null>; currentDay: number }) {
  const [relations, setRelations] = useState<import('./game/diplomacy/DiplomacyTypes').DiplomaticRelation[]>([])

  useEffect(() => {
    const interval = setInterval(() => {
      setRelations(prototypeRef.current?.getDiplomacyRelations() ?? [])
    }, 1000)
    return () => clearInterval(interval)
  }, [prototypeRef])

  if (relations.length === 0) {
    return <div className="empty-state compact">No diplomatic relations</div>
  }

  return (
    <div className="diplomacy-panel">
      {relations.map((relation) => {
        const otherCountry = relation.countryA === PLAYER_COUNTRY_ID ? relation.countryB : relation.countryA
        const isWar = relation.isAtWar
        const relationColor = relation.score > 40 ? 'good' : relation.score > -20 ? 'neutral' : relation.score > -60 ? 'poor' : 'hostile'

        return (
          <div key={`${relation.countryA}-${relation.countryB}`} className={`diplomacy-card ${isWar ? 'at-war' : ''}`}>
            <div className="diplomacy-header">
              <span className="diplomacy-country">{otherCountry === 'armenia' ? 'Armenia' : 'Azerbaijan'}</span>
              <span className={`diplomacy-score ${relationColor}`}>{relation.score > 0 ? '+' : ''}{Math.round(relation.score)}</span>
            </div>
            <div className="diplomacy-status">
              {isWar ? (
                <span className="war-badge"><Swords size={12} /> War (Day {currentDay - (relation.warStartDay ?? 0)})</span>
              ) : relation.nonAggressionPact ? (
                <span className="nap-badge">Non-Aggression Pact</span>
              ) : relation.daysBelowWarThreshold > 0 ? (
                <span className="tension-badge">Tension: {relation.daysBelowWarThreshold}/{AI_WAR_DAYS_REQUIRED} days</span>
              ) : (
                <span className="peace-badge">Peace</span>
              )}
            </div>
            <div className="diplomacy-actions">
              {isWar ? (
                <>
                  <button className="management-btn small" onClick={() => prototypeRef.current?.offerPeace(otherCountry)}>Offer Peace</button>
                  <button className="management-btn small" onClick={() => prototypeRef.current?.sendGift(otherCountry)}>Send Gift</button>
                </>
              ) : (
                <>
                  <button className="management-btn small danger" onClick={() => prototypeRef.current?.declareWar(otherCountry)}>Declare War</button>
                  {!relation.nonAggressionPact && (
                    <button className="management-btn small" onClick={() => prototypeRef.current?.proposeNap(otherCountry)}>Propose NAP</button>
                  )}
                  <button className="management-btn small" onClick={() => prototypeRef.current?.sendGift(otherCountry)}>Send Gift</button>
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function GeneralsPanel({ prototypeRef }: { prototypeRef: React.MutableRefObject<StrategyPrototype | null> }) {
  const [generals, setGenerals] = useState<import('./game/generals/GeneralTypes').General[]>([])
  const [selectedGeneralId, setSelectedGeneralId] = useState<string | null>(null)

  useEffect(() => {
    const interval = setInterval(() => {
      setGenerals(prototypeRef.current?.getAllGenerals() ?? [])
    }, 1000)
    return () => clearInterval(interval)
  }, [prototypeRef])

  const playerGenerals = generals.filter((g) => g.countryId === PLAYER_COUNTRY_ID)
  const aiGenerals = generals.filter((g) => g.countryId !== PLAYER_COUNTRY_ID)

  return (
    <div className="generals-panel">
      <button className="management-btn" onClick={() => {
        const g = prototypeRef.current?.createGeneral()
        if (g) setSelectedGeneralId(g.id)
      }}>
        <Plus size={14} />
        <span>Recruit General (50 Money)</span>
      </button>

      <div className="generals-section">
        <span className="generals-section-title">Your Generals</span>
        {playerGenerals.length === 0 && <div className="empty-state compact">No generals recruited</div>}
        {playerGenerals.map((general) => (
          <div key={general.id} className={`general-card ${selectedGeneralId === general.id ? 'selected' : ''}`} onClick={() => setSelectedGeneralId(general.id)}>
            <div className="general-header">
              <User size={14} />
              <span className="general-name">{general.name}</span>
              <span className="general-skill">{'★'.repeat(general.skill)}</span>
            </div>
            <div className="general-traits">
              {general.traits.map((trait) => (
                <span key={trait} className="general-trait">{trait.replace(/_/g, ' ')}</span>
              ))}
            </div>
            <div className="general-stats">
              <span>Units: {general.assignedUnitIds.length}</span>
              <span>Front: {general.frontlineProvinceIds.length} provs</span>
              {general.battlePlan && <span className="battle-phase">Phase: {general.battlePlan.currentPhase}</span>}
            </div>
            {selectedGeneralId === general.id && (
              <div className="general-actions">
                <button className="management-btn small" onClick={(e) => { e.stopPropagation(); prototypeRef.current?.cancelGeneralBattlePlan(general.id) }}>Cancel Plan</button>
                <button className="management-btn small danger" onClick={(e) => { e.stopPropagation(); prototypeRef.current?.dismissGeneral(general.id); setSelectedGeneralId(null) }}>Dismiss</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="generals-section">
        <span className="generals-section-title">Enemy Generals</span>
        {aiGenerals.map((general) => (
          <div key={general.id} className="general-card enemy">
            <div className="general-header">
              <User size={14} />
              <span className="general-name">{general.name}</span>
              <span className="general-skill">{'★'.repeat(general.skill)}</span>
            </div>
            <div className="general-traits">
              {general.traits.map((trait) => (
                <span key={trait} className="general-trait">{trait.replace(/_/g, ' ')}</span>
              ))}
            </div>
            <div className="general-stats">
              <span>Units: {general.assignedUnitIds.length}</span>
              {general.battlePlan && <span className="battle-phase">Phase: {general.battlePlan.currentPhase}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function App() {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const prototypeRef = useRef<StrategyPrototype | null>(null)
  const showLegacyUnitPanel = false
  const [hudState, setHudState] = useState<PrototypeHudState>(initialHudState)
  const [isDesignerOpen, setIsDesignerOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<DivisionTemplate | null>(null)
  const [deploymentProvinceId, setDeploymentProvinceId] = useState<number | null>(null)
  const onSelectTrainingProvinceRef = useRef<((provinceId: number) => void) | undefined>(undefined)
  onSelectTrainingProvinceRef.current = (provinceId) => {
    setDeploymentProvinceId(provinceId)
  }
  const [activeTab, setActiveTab] = useState<'construction' | 'stockpile' | 'production' | 'diplomacy' | 'generals'>('construction')
  const playerEconomy = hudState.economy?.[PLAYER_COUNTRY_ID] ?? null
  const selectedProvinceId = hudState.selectedProvince?.id ?? null
  const activeDeploymentProvinceId = deploymentProvinceId ?? selectedProvinceId ?? hudState.training.validDeploymentProvinceIds[0] ?? null
  const showLegacyEconomyPanel = hudState.time.day < 0

  useEffect(() => {
    const mount = mountRef.current

    if (!mount) {
      return
    }

    const prototype = new StrategyPrototype(mount, setHudState, (provinceId) => {
      onSelectTrainingProvinceRef.current?.(provinceId)
    })
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

  const queueConstruction = useCallback((buildingType: BuildingType) => {
    if (selectedProvinceId === null) return
    prototypeRef.current?.queueConstruction(selectedProvinceId, buildingType)
  }, [selectedProvinceId])

  const queueTraining = useCallback((templateId: string) => {
    if (activeDeploymentProvinceId === null) return
    prototypeRef.current?.queueDivisionTraining(templateId, activeDeploymentProvinceId)
  }, [activeDeploymentProvinceId])

  const saveTemplate = useCallback((draft: { id?: string; name: string; nodes: DivisionNode[] }) => {
    prototypeRef.current?.saveDivisionTemplate(draft)
  }, [])

  const addProductionLine = useCallback((category: ProducibleCategory, factoryCount = 1) => {
    prototypeRef.current?.addProductionLine(category, factoryCount)
  }, [])

  const deleteProductionLine = useCallback((lineId: string) => {
    prototypeRef.current?.deleteProductionLine(lineId)
  }, [])

  const setProductionLineCategory = useCallback((lineId: string, category: ProducibleCategory) => {
    prototypeRef.current?.setProductionLineCategory(lineId, category)
  }, [])

  const setProductionLineFactoryCount = useCallback((lineId: string, factoryCount: number) => {
    prototypeRef.current?.setProductionLineFactoryCount(lineId, factoryCount)
  }, [])

  const openNewDesigner = useCallback(() => {
    setEditingTemplate(null)
    setIsDesignerOpen(true)
  }, [])

  const openDesignerForTemplate = useCallback((template: DivisionTemplate) => {
    setEditingTemplate(template)
    setIsDesignerOpen(true)
  }, [])

  return (
    <main className="app-shell" onContextMenu={(event) => event.preventDefault()}>
      <section ref={mountRef} className="map-viewport" aria-label="South Caucasus province strategy map" />
      
      {/* Top Bar */}
      <header className="top-bar">
        <div className="top-bar-left">
          <div className="game-title">
            <Swords className="title-icon" size={20} />
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

        <div className="panel-section construction-panel">
          <div className="panel-tab-sidebar">
            <button className={`panel-tab ${activeTab === 'construction' ? 'active' : ''}`} onClick={() => setActiveTab('construction')} title="Construction">
              <Hammer size={16} />
              <span>Build</span>
            </button>
            <button className={`panel-tab ${activeTab === 'production' ? 'active' : ''}`} onClick={() => setActiveTab('production')} title="Production">
              <PencilRuler size={16} />
              <span>Prod</span>
            </button>
            <button className={`panel-tab ${activeTab === 'stockpile' ? 'active' : ''}`} onClick={() => setActiveTab('stockpile')} title="Stockpile">
              <Factory size={16} />
              <span>Stock</span>
            </button>
            <button className={`panel-tab ${activeTab === 'diplomacy' ? 'active' : ''}`} onClick={() => setActiveTab('diplomacy')} title="Diplomacy">
              <Handshake size={16} />
              <span>Diplo</span>
            </button>
            <button className={`panel-tab ${activeTab === 'generals' ? 'active' : ''}`} onClick={() => setActiveTab('generals')} title="Generals">
              <Shield size={16} />
              <span>Gens</span>
            </button>
          </div>
          <div key={activeTab} className="panel-tab-content">
          {activeTab === 'construction' ? (
            <>
              <div className="building-summary">
                <span>Barracks {hudState.construction.playerBuildings.barracks}</span>
                <span>Military Complexes {hudState.construction.playerBuildings.militaryComplex}</span>
              </div>
              <div className="construction-actions">
                {(Object.keys(BUILDING_DEFINITIONS) as BuildingType[]).map((buildingType) => {
                  const building = BUILDING_DEFINITIONS[buildingType]
                  const disabled =
                    selectedProvinceId === null ||
                    !hudState.construction.validConstructionProvinceIds.includes(selectedProvinceId) ||
                    hudState.construction.jobs.length >= 2

                  return (
                    <button key={buildingType} className="management-btn" disabled={disabled} onClick={() => queueConstruction(buildingType)}>
                      <Plus size={14} />
                      <span>{building.name}</span>
                    </button>
                  )
                })}
              </div>
              <div className="queue-list">
                {hudState.construction.jobs.length > 0 ? hudState.construction.jobs.map((job) => (
                  <div key={job.id} className="queue-item">
                    <div>
                      <span className="queue-title">{job.buildingName}</span>
                      <span className="queue-subtitle">{job.provinceName}</span>
                    </div>
                    <div className="queue-controls">
                      <span>{job.daysRemaining}d</span>
                      <button className="icon-btn" onClick={() => prototypeRef.current?.cancelConstruction(job.id)} title="Cancel construction">
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                )) : <div className="empty-state compact">No construction queued</div>}
              </div>
            </>
          ) : activeTab === 'stockpile' ? (
            <>
              <div className="stockpile-section">
                <span className="stockpile-section-title">Equipment Stockpile</span>
                <div className="stockpile-grid">
                  {EQUIPMENT_CATEGORIES.map((category) => {
                    const count = Math.floor(hudState.stockpile.equipmentStockpiles[category])
                    const rate = hudState.stockpile.productionRates[category] ?? 0
                    const isShortage = playerEconomy && playerEconomy.trainingQueue.some((job) =>
                      job.status === 'training' && (job.stats?.equipmentRequirements?.[category] ?? 0) > count
                    )
                    return (
                      <div key={category} className={`stockpile-item ${isShortage ? 'shortage' : ''}`}>
                        <span className="stockpile-name">{EQUIPMENT_LABELS[category]}</span>
                        <span className="stockpile-count">{count}</span>
                        {rate > 0 && <span className="stockpile-rate">+{rate}/day</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="stockpile-section">
                <span className="stockpile-section-title">Supplies</span>
                <div className="stockpile-grid">
                  <div className="stockpile-item">
                    <span className="stockpile-name">Food</span>
                    <span className="stockpile-count">{Math.floor(hudState.stockpile.food)}</span>
                  </div>
                  <div className="stockpile-item">
                    <span className="stockpile-name">Ammunition</span>
                    <span className="stockpile-count">{Math.floor(hudState.stockpile.ammunition)}</span>
                    {(() => {
                      const ammoRate = hudState.production.lines
                        .filter((line) => line.category === 'ammunition')
                        .reduce((sum, line) => sum + line.factoryCount * FACTORY_OUTPUT_BASE.ammunition, 0)
                      return ammoRate > 0 ? <span className="stockpile-rate">+{ammoRate}/day</span> : null
                    })()}
                  </div>
                </div>
              </div>
            </>
          ) : activeTab === 'diplomacy' ? (
            <DiplomacyPanel prototypeRef={prototypeRef} currentDay={hudState.time.day} />
          ) : activeTab === 'generals' ? (
            <GeneralsPanel prototypeRef={prototypeRef} />
          ) : (
            <ProductionPanel
              production={hudState.production}
              onAddLine={addProductionLine}
              onDeleteLine={deleteProductionLine}
              onSetCategory={setProductionLineCategory}
              onSetFactoryCount={setProductionLineFactoryCount}
            />
          )}
          </div>
        </div>

        {!hudState.selectedUnit ? <div className="panel-section training-panel">
          <div className="section-header">
            <PencilRuler className="section-icon-svg" size={16} />
            <span className="header-title">DIVISIONS</span>
          </div>
          <div className="building-summary">
            <span>Training {hudState.training.activeTrainingCount}/{hudState.training.trainingSlots}</span>
            <span>Equipment {playerEconomy ? Math.round(playerEconomy.equipmentPool) : 0}</span>
          </div>
          <select
            className="deployment-select"
            value={activeDeploymentProvinceId ?? ''}
            onChange={(event) => setDeploymentProvinceId(Number(event.target.value))}
          >
            {hudState.training.validDeploymentProvinceIds.map((provinceId) => (
              <option key={provinceId} value={provinceId}>
                Province {provinceId}
              </option>
            ))}
          </select>
          <div className="template-list">
            {hudState.training.templates.map((template) => (
              <div key={template.id} className="template-card">
                <div>
                  <span className="queue-title">{template.name}</span>
                  <span className="queue-subtitle">
                    MP {template.stats.manpower} / EQ {template.stats.equipment} / SPD {Math.round(template.stats.speed)}
                  </span>
                </div>
                <button className="management-btn small" onClick={() => queueTraining(template.id)}>
                  <Plus size={14} />
                  Train
                </button>
                <button className="management-btn small secondary" onClick={() => openDesignerForTemplate(template)}>
                  <Edit3 size={14} />
                  Edit
                </button>
              </div>
            ))}
          </div>
          <button className="designer-open-btn" onClick={openNewDesigner}>
            <PencilRuler size={15} />
            Open Division Designer
          </button>
          <div className="queue-list">
            {hudState.training.jobs.length > 0 ? hudState.training.jobs.map((job) => (
              <div key={job.id} className="queue-item">
                <div>
                  <span className="queue-title">{job.templateName}</span>
                  <span className="queue-subtitle">{job.status === 'ready' ? 'Ready for deployment' : `${job.provinceName}`}</span>
                </div>
                <div className="queue-controls">
                  <span>{job.status === 'ready' ? 'Ready' : `${job.daysRemaining}d`}</span>
                  <button className="icon-btn" onClick={() => prototypeRef.current?.cancelTraining(job.id)} title="Cancel training">
                    <X size={14} />
                  </button>
                </div>
              </div>
            )) : <div className="empty-state compact">No divisions training</div>}
          </div>
        </div> : <UnitManagementPanel unit={hudState.selectedUnit} logistics={hudState.logistics} />}

        {/* Selected Province */}
        {hudState.selectedProvince && (
        <div className="panel-section province-panel">
          <div className="section-header">
            <MapPin className="section-icon-svg" size={16} />
            <span className="header-title">PROVINCE</span>
          </div>
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
                <span className="detail-label">Terrain</span>
                <span className="detail-value">{formatTerrainName(hudState.selectedProvince.terrainType)}</span>
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
              <div className="detail-row">
                <span className="detail-label">Buildings</span>
                <span className="detail-value">
                  B {hudState.selectedProvince.buildings.barracks} / MC {hudState.selectedProvince.buildings.militaryComplex}
                </span>
              </div>
            </div>
          </div>
        )}

        {hudState.battleForecast && (
          <div className="panel-section battle-intel-panel">
            <BattleIntelPanel
              forecast={hudState.battleForecast}
              combat={hudState.activeCombats.find((combat) => combat.id === hudState.activeCombat?.id) ?? null}
              activeCombat={hudState.activeCombat}
            />
          </div>
        )}

        {/* Selected Unit */}
        {showLegacyUnitPanel && hudState.selectedUnit && !hudState.battleForecast && (
          <div className="panel-section unit-panel">
            <div className="section-header">
              <Swords className="section-icon-svg" size={16} />
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
              <div className="fortification-meter">
                <div className="stat-bar-header">
                  <span className="stat-bar-label">Fortification</span>
                  <span className="stat-bar-value">{Math.round(hudState.selectedUnit.fortificationLevel * 100)}%</span>
                </div>
                <div className="stat-bar-track">
                  <div className="stat-bar-fill fortification" style={{ width: `${hudState.selectedUnit.fortificationLevel * 100}%` }}></div>
                </div>
                <span className="fortification-note">
                  {hudState.selectedUnit.fortificationLevel >= 1 ? 'Prepared positions' : `${Math.max(0, Math.ceil(7 - hudState.selectedUnit.fortificationDays))}d to full`}
                </span>
              </div>
              
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
                  <span className="combat-stat-label">BRK</span>
                  <span className="combat-stat-value">{hudState.selectedUnit.breakthrough}</span>
                </div>
                <div className="combat-stat">
                  <span className="combat-stat-label">ARM</span>
                  <span className="combat-stat-value">{Math.round(hudState.selectedUnit.armor)}</span>
                </div>
                <div className="combat-stat">
                  <span className="combat-stat-label">PEN</span>
                  <span className="combat-stat-value">{Math.round(hudState.selectedUnit.piercing)}</span>
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
        {hudState.activeCombat && !hudState.battleForecast && (
          <div className="panel-section combat-section">
            <div className="section-header">
              <Flame className="section-icon-svg" size={16} />
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
              <Factory className="section-icon-svg" size={16} />
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
      {hudState.activeCombats.filter((combat) => combat.id !== hudState.activeCombat?.id && !hudState.battleForecast).map((combat) => (
        <BattlePopup key={combat.id} combat={combat} prototypeRef={prototypeRef} />
      ))}

      {isDesignerOpen && (
        <DivisionDesignerModal
          initialTemplate={editingTemplate}
          onClose={() => setIsDesignerOpen(false)}
          onSave={saveTemplate}
        />
      )}
    </main>
  )
}

interface BattlePopupProps {
  combat: ActiveCombatOverlay
}

interface BattleForecastPanelProps {
  forecast: NonNullable<PrototypeHudState['battleForecast']>
  combat: ActiveCombatOverlay | null
  activeCombat: PrototypeHudState['activeCombat']
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
    <div className="resource-chip-wrapper">
      <div className={`resource-chip ${resourceId}`}>
        <ResourceIcon resourceId={resourceId} />
        <span className="resource-amount">{isLoading ? '...' : compactNumber(value)}</span>
        {!isLoading && <span className={`resource-income ${roundedIncome >= 0 ? 'positive' : 'negative'}`}>{formatIncome(roundedIncome)}</span>}
      </div>
      <span className="resource-tooltip">{meta.label}: {Math.round(value).toLocaleString()} ({formatIncome(roundedIncome)}/day)</span>
    </div>
  )
}

function ResourceIcon({ resourceId }: { resourceId: ResourceId }) {
  const Icon = RESOURCE_META[resourceId].Icon

  return (
    <span className={`resource-icon ${resourceId}`} aria-hidden="true">
      <Icon size={15} strokeWidth={2.4} />
    </span>
  )
}

function BattleIntelPanel({ forecast, combat, activeCombat }: BattleForecastPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const [messageIndex, setMessageIndex] = useState(0)
  const combatIdRef = useRef<string | null>(null)
  const messagesRef = useRef(forecast.messages)
  messagesRef.current = forecast.messages

  const winnerLabel = forecast.winner === 'attacker' ? 'Attacker advantage' : forecast.winner === 'defender' ? 'Defender holds' : 'Stalemate likely'
  const winnerClass = forecast.winner === 'attacker' ? 'attacker' : forecast.winner === 'defender' ? 'defender' : 'even'

  useEffect(() => {
    if (!activeCombat) {
      combatIdRef.current = null
      setMessageIndex(0)
      return
    }

    if (combatIdRef.current !== activeCombat.id) {
      combatIdRef.current = activeCombat.id
      setMessageIndex(0)
    }

    if (messagesRef.current.length <= 1) return

    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messagesRef.current.length)
    }, 8000)

    return () => clearInterval(interval)
  }, [activeCombat?.id])

  const currentMessage = forecast.messages[messageIndex] ?? forecast.messages[0] ?? 'Commanders are assessing the battlefield.'

  return (
    <div className={`battle-intel-details ${expanded ? 'expanded' : 'minimal'}`}>
      {combat && (
        <div className="intel-flag-header" onClick={() => setExpanded(!expanded)}>
          <IntelSide side="attacker" countryId={combat.attacker.countryId} countryName={combat.attacker.countryName} unitCount={combat.attacker.unitCount} />
          <div className="intel-vs">VS</div>
          <IntelSide side="defender" countryId={combat.defender.countryId} countryName={combat.defender.countryName} unitCount={combat.defender.unitCount} />
        </div>
      )}

      {!expanded ? (
        <div className="battle-minimal-body" onClick={() => setExpanded(true)}>
          {combat && (
            <div className="battle-minimal-stats">
              <div className="battle-minimal-side">
                <span><strong>{combat.attacker.totalManpower}</strong> MP</span>
                <span><strong>{Math.round(combat.attacker.avgOrganization)}</strong> ORG</span>
                <span><strong>{combat.attacker.unitCount}</strong> UNITS</span>
              </div>
              <div className="battle-minimal-divider"></div>
              <div className="battle-minimal-side">
                <span><strong>{combat.defender.totalManpower}</strong> MP</span>
                <span><strong>{Math.round(combat.defender.avgOrganization)}</strong> ORG</span>
                <span><strong>{combat.defender.unitCount}</strong> UNITS</span>
              </div>
            </div>
          )}
          <div className="battle-minimal-forecast">{forecast.confidence}% FORECAST</div>
        </div>
      ) : (
        <div className="battle-expanded-body">
          <div className={`forecast-result ${winnerClass}`}>
            <strong>{winnerLabel}</strong>
            <span>{forecast.confidence}% confidence</span>
          </div>
          <div className="forecast-meta">
            <span>{formatTerrainName(forecast.terrain)}</span>
            <span>{forecast.estimatedHours >= 720 ? '30d+' : `${forecast.estimatedHours}h`}</span>
          </div>
          <div className="forecast-side-grid">
            <div className="forecast-side">
              <span className="forecast-side-title">Attacker</span>
              <div><span>Score</span><strong>{Math.round(forecast.attacker.score)}</strong></div>
              <div><span>Soft / Hard</span><strong>{Math.round(forecast.attacker.softAttack)} / {Math.round(forecast.attacker.hardAttack)}</strong></div>
              <div><span>ORG</span><strong>{Math.round(forecast.attacker.organization)}/{Math.round(forecast.attacker.maxOrganization)}</strong></div>
              <div><span>Losses</span><strong>{Math.round(forecast.attacker.projectedManpowerLoss)} MP</strong></div>
            </div>
            <div className="forecast-side">
              <span className="forecast-side-title">Defender</span>
              <div><span>Score</span><strong>{Math.round(forecast.defender.score)}</strong></div>
              <div><span>Soft / Hard</span><strong>{Math.round(forecast.defender.softAttack)} / {Math.round(forecast.defender.hardAttack)}</strong></div>
              <div><span>ORG</span><strong>{Math.round(forecast.defender.organization)}/{Math.round(forecast.defender.maxOrganization)}</strong></div>
              <div><span>Losses</span><strong>{Math.round(forecast.defender.projectedManpowerLoss)} MP</strong></div>
            </div>
          </div>
          <div className="battle-message">
            <span>Battlefield report</span>
            <strong>{currentMessage}</strong>
          </div>
          <div className="forecast-matchups">
            <div>
              <span>Armor / Piercing</span>
              <strong>{Math.round(forecast.attacker.piercing)} vs {Math.round(forecast.defender.armor)}</strong>
            </div>
            <div>
              <span>Logistics</span>
              <strong>{Math.round(forecast.attacker.logisticsPenalty * 100)}% / {Math.round(forecast.defender.logisticsPenalty * 100)}%</strong>
            </div>
            <div>
              <span>Fortification</span>
              <strong>{Math.round(forecast.defender.fortificationLevel * 100)}%</strong>
            </div>
            <div>
              <span>Supply</span>
              <strong>{Math.round(forecast.attacker.supplyRatio * 100)}% / {Math.round(forecast.defender.supplyRatio * 100)}%</strong>
            </div>
            <div>
              <span>Cut Off</span>
              <strong>{forecast.attacker.encircledUnits} / {forecast.defender.encircledUnits}</strong>
            </div>
            <div>
              <span>Lost Bns</span>
              <strong>{forecast.attacker.destroyedBattalions + forecast.attacker.surrenderedBattalions} / {forecast.defender.destroyedBattalions + forecast.defender.surrenderedBattalions}</strong>
            </div>
          </div>
          <button className="battle-collapse-btn" onClick={() => setExpanded(false)}>Close details</button>
        </div>
      )}
    </div>
  )
}

function IntelSide({ side, countryId, countryName, unitCount }: { side: 'attacker' | 'defender'; countryId: string; countryName: string; unitCount: number }) {
  return (
    <div className={`intel-side ${side}`}>
      <span className={`side-flag ${countryId === 'azerbaijan' ? 'az-flag' : 'am-flag'}`}></span>
      <div>
        <span>{countryName}</span>
        <strong>{unitCount} units</strong>
      </div>
      <span className={`side-badge ${side === 'attacker' ? 'attacking' : 'defending'}`}>{side === 'attacker' ? 'ATK' : 'DEF'}</span>
    </div>
  )
}

function UnitManagementPanel({ unit, logistics }: { unit: NonNullable<PrototypeHudState['selectedUnit']>; logistics: PrototypeHudState['logistics'] }) {
  return (
    <div className="panel-section training-panel unit-management-panel">
      <div className="section-header">
        <Swords className="section-icon-svg" size={16} />
        <span className="header-title">UNIT</span>
      </div>
      <div className="unit-details">
        <div className="unit-header">
          <span className="unit-name">{unit.name}</span>
          <span className={`unit-owner ${unit.owner === 'Azerbaijan' ? 'az-color' : 'am-color'}`}>{unit.owner}</span>
        </div>
        <div className={`unit-status ${unit.isEncircled ? 'contested' : ''}`}>
          {unit.isEncircled ? `Encircled ${Math.round(unit.encircledHours)}h` : unit.status}
        </div>
        <div className="unit-supply-card">
          <div className="stat-bar-header">
            <span className="stat-bar-label">Supply</span>
            <span className="stat-bar-value">{Math.round(unit.supplyHours)}/{unit.maxSupplyHours}h</span>
          </div>
          <div className="stat-bar-track">
            <div className="stat-bar-fill supply" style={{ width: `${Math.max(0, Math.min(100, (unit.supplyHours / unit.maxSupplyHours) * 100))}%` }}></div>
          </div>
          <span className="fortification-note">
            Trucks {logistics.activeSupplyVehicleCount}/{logistics.supplyVehicleCount} active
            {unit.hoursOutOfSupply > 0 ? ` / ${Math.round(unit.hoursOutOfSupply)}h out of supply` : ''}
          </span>
        </div>
        <div className="fortification-meter">
          <div className="stat-bar-header">
            <span className="stat-bar-label">Fortification</span>
            <span className="stat-bar-value">{Math.round(unit.fortificationLevel * 100)}%</span>
          </div>
          <div className="stat-bar-track">
            <div className="stat-bar-fill fortification" style={{ width: `${unit.fortificationLevel * 100}%` }}></div>
          </div>
        </div>
        <div className="unit-combat-stats">
          <div className="combat-stat"><span className="combat-stat-label">ATK</span><span className="combat-stat-value">{unit.attack}</span></div>
          <div className="combat-stat"><span className="combat-stat-label">DEF</span><span className="combat-stat-value">{unit.defense}</span></div>
          <div className="combat-stat"><span className="combat-stat-label">BRK</span><span className="combat-stat-value">{unit.breakthrough}</span></div>
          <div className="combat-stat"><span className="combat-stat-label">ARM</span><span className="combat-stat-value">{Math.round(unit.armor)}</span></div>
          <div className="combat-stat"><span className="combat-stat-label">PEN</span><span className="combat-stat-value">{Math.round(unit.piercing)}</span></div>
          <div className="combat-stat"><span className="combat-stat-label">REL</span><span className="combat-stat-value">{Math.round(unit.reliability * 100)}%</span></div>
        </div>
        <div className="battalion-status-list">
          <span className="designer-column-title">Battalions</span>
          {unit.battalions.map((battalion, index) => (
            <div key={`${battalion.name}-${index}`} className={`battalion-status ${battalion.status}`}>
              <div>
                <span className="queue-title">{battalion.name}</span>
                <span className="queue-subtitle">{battalion.status}</span>
              </div>
              <span>{Math.round(battalion.manpower)}/{battalion.maxManpower} MP</span>
            </div>
          ))}
        </div>
        <div className="recent-events">
          <span className="designer-column-title">Recent Events</span>
          {unit.recentCombatEvents.length > 0
            ? unit.recentCombatEvents.slice(0, 5).map((event) => <span key={event}>{event}</span>)
            : <span>No recent combat events</span>}
        </div>
      </div>
    </div>
  )
}

interface DivisionDesignerModalProps {
  initialTemplate: DivisionTemplate | null
  onClose: () => void
  onSave: (draft: { id?: string; name: string; nodes: DivisionNode[] }) => void
}

function DivisionDesignerModal({ initialTemplate, onClose, onSave }: DivisionDesignerModalProps) {
  const [templateId] = useState<string | undefined>(initialTemplate?.id)
  const [name, setName] = useState(initialTemplate?.name ?? 'New Division')
  const [nodes, setNodes] = useState<DivisionNode[]>(() => initialTemplate ? cloneTemplateNodes(initialTemplate) : [])
  const baselineStats = initialTemplate?.stats ?? null
  const stats = calculateDivisionStats(nodes)
  const canSave = nodes.length > 0 && nodes.length <= MAX_BATTALIONS_PER_TEMPLATE

  const addNode = (battalionType: BattalionType, x: number, y: number) => {
    if (nodes.length >= MAX_BATTALIONS_PER_TEMPLATE) {
      return
    }

    setNodes((current) => [
      ...current,
      {
        id: `node-${Date.now()}-${current.length}`,
        battalionType,
        x: Math.max(30, Math.min(560, x)),
        y: Math.max(30, Math.min(300, y)),
      },
    ])
  }

  const handleCanvasDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const canvas = event.currentTarget.getBoundingClientRect()
    const battalionType = event.dataTransfer.getData('battalionType') as BattalionType
    const nodeId = event.dataTransfer.getData('nodeId')

    if (nodeId) {
      setNodes((current) => current.map((node) => (
        node.id === nodeId ? { ...node, x: event.clientX - canvas.left - 65, y: event.clientY - canvas.top - 24 } : node
      )))
      return
    }

    if (battalionType) {
      addNode(battalionType, event.clientX - canvas.left - 65, event.clientY - canvas.top - 24)
    }
  }

  const save = () => {
    if (!canSave) {
      return
    }

    onSave({ id: templateId, name, nodes })
    onClose()
  }

  return (
    <div className="designer-backdrop">
      <div className="designer-modal">
        <div className="designer-header">
          <div>
            <span className="designer-kicker">{initialTemplate ? 'Edit Division Template' : 'Division Designer'}</span>
            <input className="designer-name-input" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="designer-header-actions">
            <button className="management-btn" disabled={!canSave} onClick={save}>
              <Save size={15} />
              Save
            </button>
            <button className="icon-btn large" onClick={onClose} title="Close designer">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="designer-body">
          <aside className="battalion-palette">
            <span className="designer-column-title">Battalions</span>
            {(Object.keys(BATTALION_DEFINITIONS) as BattalionType[]).map((battalionType) => {
              const battalion = BATTALION_DEFINITIONS[battalionType]

              return (
                <div
                  key={battalionType}
                  className="battalion-card"
                  draggable
                  onDragStart={(event) => event.dataTransfer.setData('battalionType', battalionType)}
                >
                  <span className="battalion-name">{battalion.name}</span>
                  <span className="battalion-role">{battalion.role}</span>
                </div>
              )
            })}
          </aside>

          <section
            className="division-canvas"
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleCanvasDrop}
          >
            <svg className="division-lines">
              {nodes.map((node) => (
                <line
                  key={`center-${node.id}`}
                  x1="50%"
                  y1="50%"
                  x2={node.x + 65}
                  y2={node.y + 24}
                />
              ))}
            </svg>
            <div className="division-center-emblem">
              <Swords size={42} />
              <span>Division</span>
            </div>
            {nodes.length === 0 && <div className="canvas-empty">Drag battalions here</div>}
            {nodes.map((node, index) => {
              const battalion = BATTALION_DEFINITIONS[node.battalionType]

              return (
                <div
                  key={node.id}
                  className="division-node"
                  draggable
                  style={{ left: node.x, top: node.y }}
                  onDragStart={(event) => event.dataTransfer.setData('nodeId', node.id)}
                >
                  <span className="node-index">{index + 1}</span>
                  <span className="node-title">{battalion.name}</span>
                  <button className="node-remove" onClick={() => setNodes((current) => current.filter((candidate) => candidate.id !== node.id))}>
                    <Trash2 size={12} />
                  </button>
                </div>
              )
            })}
          </section>

          <aside className="designer-stats">
            <span className="designer-column-title">Template Stats</span>
            <DesignerStat label="Manpower" value={stats.manpower} baseline={baselineStats?.manpower} harmfulIncrease />
            <DesignerStat label="Equipment" value={stats.equipment} baseline={baselineStats?.equipment} harmfulIncrease />
            <DesignerStat label="Training" value={stats.trainingDays} suffix="d" baseline={baselineStats?.trainingDays} harmfulIncrease />
            <DesignerStat label="Speed" value={Math.round(stats.speed)} baseline={baselineStats ? Math.round(baselineStats.speed) : undefined} />
            <DesignerStat label="Soft Attack" value={Math.round(stats.softAttack)} baseline={baselineStats ? Math.round(baselineStats.softAttack) : undefined} />
            <DesignerStat label="Hard Attack" value={Math.round(stats.hardAttack)} baseline={baselineStats ? Math.round(baselineStats.hardAttack) : undefined} />
            <DesignerStat label="Defense" value={Math.round(stats.defense)} baseline={baselineStats ? Math.round(baselineStats.defense) : undefined} />
            <DesignerStat label="Breakthrough" value={Math.round(stats.breakthrough)} baseline={baselineStats ? Math.round(baselineStats.breakthrough) : undefined} />
            <DesignerStat label="Armor" value={Math.round(stats.armor)} baseline={baselineStats ? Math.round(baselineStats.armor) : undefined} />
            <DesignerStat label="Piercing" value={Math.round(stats.piercing)} baseline={baselineStats ? Math.round(baselineStats.piercing) : undefined} />
            <DesignerStat label="Reliability" value={Math.round(stats.reliability * 100)} suffix="%" baseline={baselineStats ? Math.round(baselineStats.reliability * 100) : undefined} />
            <DesignerStat label="Maneuver" value={Math.round(stats.maneuverability)} baseline={baselineStats ? Math.round(baselineStats.maneuverability) : undefined} />
            <DesignerStat label="Supply" value={Number(stats.supplyUse.toFixed(1))} baseline={baselineStats ? Number(baselineStats.supplyUse.toFixed(1)) : undefined} harmfulIncrease />
            <DesignerStat label="Fuel" value={Number(stats.fuelUse.toFixed(1))} baseline={baselineStats ? Number(baselineStats.fuelUse.toFixed(1)) : undefined} harmfulIncrease />
            <span className="designer-column-title terrain-title">Terrain Effects</span>
            <div className="terrain-effects-table">
              {TERRAIN_TYPES.map((terrainType) => (
                <div key={terrainType} className="terrain-effect-row">
                  <span>{formatTerrainName(terrainType)}</span>
                  <strong>{formatModifier(stats.terrainProfile[terrainType].attack)}</strong>
                  <strong>{formatModifier(stats.terrainProfile[terrainType].defense)}</strong>
                  <strong>{formatModifier(stats.terrainProfile[terrainType].speed)}</strong>
                </div>
              ))}
            </div>
            <div className={`designer-validation ${canSave ? 'valid' : 'invalid'}`}>
              {canSave ? `${nodes.length}/${MAX_BATTALIONS_PER_TEMPLATE} battalions` : 'Add 1-6 battalions'}
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

function DesignerStat({
  label,
  value,
  suffix = '',
  baseline,
  harmfulIncrease = false,
}: {
  label: string
  value: number
  suffix?: string
  baseline?: number
  harmfulIncrease?: boolean
}) {
  const delta = baseline === undefined ? 0 : value - baseline
  const isMeaningfulDelta = Math.abs(delta) > 0.01
  const isGood = harmfulIncrease ? delta < 0 : delta > 0

  return (
    <div className="designer-stat-row">
      <span>{label}</span>
      <strong>
        {value}{suffix}
        {isMeaningfulDelta && (
          <span className={`stat-delta ${isGood ? 'positive' : 'negative'}`}>
            {delta > 0 ? '+' : ''}{formatDelta(delta)}{suffix}
          </span>
        )}
      </strong>
    </div>
  )
}

function cloneTemplateNodes(template: DivisionTemplate): DivisionNode[] {
  return template.nodes.map((node, index) => ({
    ...node,
    id: `${template.id}-edit-${index}-${Date.now()}`,
  }))
}

function formatTerrainName(terrainType: string): string {
  return terrainType.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase())
}

function formatModifier(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value}%`
}

function formatDelta(delta: number): string {
  return Number.isInteger(delta) ? String(delta) : delta.toFixed(1)
}

interface BattlePopupProps {
  combat: ActiveCombatOverlay
  prototypeRef: React.MutableRefObject<StrategyPrototype | null>
}

function BattlePopup({ combat, prototypeRef }: BattlePopupProps) {
  const divRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let animFrame: number
    const update = () => {
      const div = divRef.current
      const prototype = prototypeRef.current
      if (div && prototype && combat.worldPosition) {
        const pos = prototype.getScreenPosition(combat.worldPosition.x, combat.worldPosition.y, combat.worldPosition.z)
        if (pos) {
          div.style.left = `${pos.x - 140}px`
          div.style.top = `${pos.y - 80}px`
        }
      }
      animFrame = requestAnimationFrame(update)
    }
    animFrame = requestAnimationFrame(update)
    return () => cancelAnimationFrame(animFrame)
  }, [combat.id, prototypeRef])

  const indicatorClass =
    combat.advantage === 'attacker' ? 'advantage-winning' :
    combat.advantage === 'defender' ? 'advantage-losing' :
    'advantage-even'

  return (
    <div
      ref={divRef}
      className="battle-popup"
      style={{
        left: combat.screenPosition ? combat.screenPosition.x - 140 : 0,
        top: combat.screenPosition ? combat.screenPosition.y - 80 : 0,
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
          <div className="side-confidence">{combat.confidence}% forecast</div>
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

interface ProductionPanelProps {
  production: PrototypeHudState['production']
  onAddLine: (category: ProducibleCategory, factoryCount?: number) => void
  onDeleteLine: (lineId: string) => void
  onSetCategory: (lineId: string, category: ProducibleCategory) => void
  onSetFactoryCount: (lineId: string, factoryCount: number) => void
}

function ProductionPanel({ production, onAddLine, onDeleteLine, onSetCategory, onSetFactoryCount }: ProductionPanelProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [newCategory, setNewCategory] = useState<ProducibleCategory>('smallArms')

  const canAddLine = production.totalFactories > 0 && production.usedFactories < production.totalFactories

  return (
    <div className="production-panel">
      <div className="factory-usage">
        <div className="factory-usage-header">
          <span className="factory-usage-label">Factories</span>
          <span className={`factory-usage-value ${production.isOverassigned ? 'overassigned' : ''}`}>
            {production.usedFactories} / {production.totalFactories}
          </span>
        </div>
        <div className="factory-usage-track">
          <div
            className={`factory-usage-fill ${production.isOverassigned ? 'overassigned' : ''}`}
            style={{ width: `${production.totalFactories > 0 ? (production.usedFactories / production.totalFactories) * 100 : 0}%` }}
          ></div>
        </div>
        {production.isOverassigned && (
          <span className="overassigned-warning">Overassigned! Reallocate or delete lines.</span>
        )}
      </div>

      <div className="production-lines">
        {production.lines.length > 0 ? production.lines.map((line) => {
          const output = FACTORY_OUTPUT_BASE[line.category] * line.factoryCount
          return (
            <div key={line.id} className="production-line-card">
              <div className="production-line-header">
                <select
                  className="production-line-category"
                  value={line.category}
                  onChange={(e) => onSetCategory(line.id, e.target.value as ProducibleCategory)}
                >
                  {PRODUCIBLE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{PRODUCIBLE_LABELS[cat]}</option>
                  ))}
                </select>
                <button className="icon-btn danger" onClick={() => onDeleteLine(line.id)} title="Delete line">
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="production-line-body">
                <div className="factory-control">
                  <span className="factory-control-label">Factories</span>
                  <div className="factory-stepper">
                    <button
                      className="stepper-btn"
                      disabled={line.factoryCount <= 1}
                      onClick={() => onSetFactoryCount(line.id, line.factoryCount - 1)}
                    >-</button>
                    <span className="stepper-value">{line.factoryCount}</span>
                    <button
                      className="stepper-btn"
                      disabled={line.factoryCount >= MAX_FACTORY_COUNT_PER_LINE || production.usedFactories >= production.totalFactories}
                      onClick={() => onSetFactoryCount(line.id, line.factoryCount + 1)}
                    >+</button>
                  </div>
                </div>
                <span className="production-line-output">+{output}/day</span>
              </div>
            </div>
          )
        }) : (
          <div className="empty-state compact">
            {production.totalFactories > 0 ? 'No production lines. Add one below.' : 'Build Military Complexes to start production.'}
          </div>
        )}
      </div>

      {isAdding ? (
        <div className="add-line-form">
          <select value={newCategory} onChange={(e) => setNewCategory(e.target.value as ProducibleCategory)}>
            {PRODUCIBLE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{PRODUCIBLE_LABELS[cat]}</option>
            ))}
          </select>
          <button className="management-btn small" onClick={() => { onAddLine(newCategory, 1); setIsAdding(false) }}>Add</button>
          <button className="management-btn small secondary" onClick={() => setIsAdding(false)}>Cancel</button>
        </div>
      ) : (
        <button className="management-btn" disabled={!canAddLine} onClick={() => setIsAdding(true)}>
          <Plus size={14} />
          <span>Add Production Line</span>
        </button>
      )}
    </div>
  )
}

export default App
