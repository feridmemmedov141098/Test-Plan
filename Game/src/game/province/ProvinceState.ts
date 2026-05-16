import * as THREE from 'three'
import type { CountryId, Province } from './provinceTypes'

export class ProvinceState {
  readonly provinces: Province[]
  private readonly byMesh = new Map<THREE.Object3D, Province>()

  constructor(provinces: Province[]) {
    this.provinces = provinces

    for (const province of provinces) {
      this.byMesh.set(province.mesh, province)
    }
  }

  getProvince(provinceId: number): Province {
    return this.provinces[provinceId]
  }

  getProvinceByMesh(mesh: THREE.Object3D): Province | null {
    let current: THREE.Object3D | null = mesh

    while (current) {
      const province = this.byMesh.get(current)

      if (province) {
        return province
      }

      current = current.parent
    }

    return null
  }

  setController(provinceId: number, countryId: CountryId): boolean {
    const province = this.provinces[provinceId]

    if (!province || province.controllerCountryId === countryId) {
      return false
    }

    province.controllerCountryId = countryId

    return true
  }

  getByCountry(countryId: CountryId): Province[] {
    return this.provinces.filter((province) => province.countryId === countryId)
  }

  getCounts(): Record<CountryId, number> {
    return {
      azerbaijan: this.provinces.filter((province) => province.controllerCountryId === 'azerbaijan').length,
      armenia: this.provinces.filter((province) => province.controllerCountryId === 'armenia').length,
    }
  }
}
