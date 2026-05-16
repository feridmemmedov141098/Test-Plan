import { useEffect, useRef, useState } from 'react'
import './App.css'
import { StrategyPrototype, type PrototypeHudState } from './rendering/StrategyPrototype'

const initialHudState: PrototypeHudState = {
  isLoading: true,
  selectedProvince: null,
  selectedUnit: null,
  status: 'Loading province map',
  mapStats: null,
}

function App() {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const [hudState, setHudState] = useState<PrototypeHudState>(initialHudState)

  useEffect(() => {
    const mount = mountRef.current

    if (!mount) {
      return
    }

    const prototype = new StrategyPrototype(mount, setHudState)
    void prototype.start()

    return () => {
      prototype.dispose()
    }
  }, [])

  return (
    <main className="app-shell">
      <section ref={mountRef} className="map-viewport" aria-label="South Caucasus province strategy map" />
      <aside className="hud hud-top">
        <div>
          <strong>Province Prototype</strong>
          <span>{hudState.status}</span>
        </div>
        <div>
          <strong>Provinces</strong>
          <span>{hudState.mapStats ? hudState.mapStats.provinceCount.toLocaleString() : '...'}</span>
        </div>
      </aside>
      <aside className="hud hud-side">
        <div>
          <strong>Unit</strong>
          <span>{hudState.selectedUnit ? `${hudState.selectedUnit.name} - ${hudState.selectedUnit.owner}` : 'None'}</span>
        </div>
        <div>
          <strong>Province</strong>
          <span>{hudState.selectedProvince ? hudState.selectedProvince.name : 'None'}</span>
        </div>
        <div>
          <strong>Owner</strong>
          <span>{hudState.selectedProvince ? hudState.selectedProvince.ownerName : 'None'}</span>
        </div>
        <div>
          <strong>Controller</strong>
          <span>{hudState.selectedProvince ? hudState.selectedProvince.controllerName : 'None'}</span>
        </div>
        <div>
          <strong>Units Here</strong>
          <span>{hudState.selectedProvince ? hudState.selectedProvince.unitCount : 0}</span>
        </div>
        <div>
          <strong>Azerbaijan</strong>
          <span>
            {hudState.mapStats
              ? `${hudState.mapStats.azProvinceCount} provinces, ${hudState.mapStats.azUnitCount} units`
              : '...'}
          </span>
        </div>
        <div>
          <strong>Armenia</strong>
          <span>
            {hudState.mapStats
              ? `${hudState.mapStats.amProvinceCount} provinces, ${hudState.mapStats.amUnitCount} units`
              : '...'}
          </span>
        </div>
      </aside>
      {hudState.isLoading ? <div className="loading-panel">Preparing province map</div> : null}
    </main>
  )
}

export default App
